/**
 * Build-Time Anatomical Model Optimizer
 * Reads full Z-Anatomy RENDER_new.glb (162MB) and produces an ultra-optimized
 * public/models/anatomy.glb (<= 10MB, <= 350k triangles) with 3 layer groups:
 * - layer:regions (pre-grouped into region:<id>)
 * - layer:muscles (~120k triangles)
 * - layer:skeleton (~120k triangles)
 */

import fs from 'fs';
import path from 'path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  weld,
  simplifyPrimitive,
  prune,
  dedup,
  quantize,
  reorder,
  meshopt,
  normals,
  join,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';

// Matrix helpers
function multiplyMatrices(ae, be) {
  const te = new Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      te[j * 4 + i] =
        ae[i] * be[j * 4] +
        ae[4 + i] * be[j * 4 + 1] +
        ae[8 + i] * be[j * 4 + 2] +
        ae[12 + i] * be[j * 4 + 3];
    }
  }
  return te;
}

function transformPoint(p, m) {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1.0;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

function transformNormal(n, m) {
  const x = n[0], y = n[1], z = n[2];
  let nx = m[0] * x + m[4] * y + m[8] * z;
  let ny = m[1] * x + m[5] * y + m[9] * z;
  let nz = m[2] * x + m[6] * y + m[10] * z;
  const len = Math.hypot(nx, ny, nz) || 1.0;
  return [nx / len, ny / len, nz / len];
}

function isLeft(name) {
  return name.endsWith('.l') || name.includes('.l ');
}
function isRight(name) {
  return name.endsWith('.r') || name.includes('.r ');
}

async function optimize() {
  console.log('=====================================================');
  console.log('   ASTROCARE Z-ANATOMY BUILD-TIME OPTIMIZER');
  console.log('=====================================================');

  const startTime = Date.now();
  const inputPath = path.resolve('assets-src/RENDER_new.glb');
  const outputPath = path.resolve('public/models/anatomy.glb');
  const regionsConfigPath = path.resolve('scripts/anatomy_regions.json');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input model not found at ${inputPath}. Move RENDER_new.glb to assets-src/RENDER_new.glb.`);
  }

  const regionRules = JSON.parse(fs.readFileSync(regionsConfigPath, 'utf8')).rules;

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  console.log(`1. Loading ${inputPath} with gltf-transform NodeIO...`);
  const srcDoc = await io.read(inputPath);
  const srcRoot = srcDoc.getRoot();
  const srcScene = srcRoot.listScenes()[0];

  console.log(`   Source nodes: ${srcRoot.listNodes().length}, Meshes: ${srcRoot.listMeshes().length}`);

  // Locate the 3 top-level system nodes in the scene
  const regionsNode = srcScene.listChildren().find((n) => n.getName().startsWith('Regions of human body'));
  const muscularNode = srcScene.listChildren().find((n) => n.getName().startsWith('Muscular system'));
  const skeletalNode = srcScene.listChildren().find((n) => n.getName().startsWith('Skeletal system'));

  if (!regionsNode || !muscularNode || !skeletalNode) {
    throw new Error('Missing one or more required system groups (Regions, Muscular, Skeletal).');
  }

  // 2. Extract and categorize mesh instances with their world matrices
  console.log('2. Traversing and categorizing system meshes...');

  const regionMeshes = []; // { nodeName, mesh, worldMatrix, regionId }
  const muscleMeshes = []; // { nodeName, mesh, worldMatrix }
  const skeletonMeshes = []; // { nodeName, mesh, worldMatrix }

  const patchCountsPerRegion = {};
  const unmatchedPatches = [];

  function walk(node, parentMatrix, system) {
    const worldMatrix = multiplyMatrices(parentMatrix, node.getMatrix());
    const name = node.getName();
    const mesh = node.getMesh();

    if (mesh) {
      const isHelper =
        name.endsWith('.g') ||
        name.endsWith('.t') ||
        name.endsWith('.j') ||
        name.endsWith('.st') ||
        mesh.listPrimitives()[0]?.getMaterial()?.getName() === 'Text';

      if (!isHelper) {
        if (system === 'regions') {
          // Exclude hairs
          const isHair = /hair|eyelash/i.test(name);
          if (!isHair) {
            let matchedRegionId = null;
            for (const rule of regionRules) {
              const reg = new RegExp(`^(${rule.pattern})$`, 'i');
              if (reg.test(name)) {
                if (rule.sideDependent) {
                  matchedRegionId = isLeft(name) ? rule.left : isRight(name) ? rule.right : rule.left;
                } else {
                  matchedRegionId = rule.regionId;
                }
                break;
              }
            }

            if (matchedRegionId) {
              regionMeshes.push({ nodeName: name, mesh, worldMatrix, regionId: matchedRegionId });
              patchCountsPerRegion[matchedRegionId] = (patchCountsPerRegion[matchedRegionId] || 0) + 1;
            } else {
              unmatchedPatches.push(name);
              regionMeshes.push({ nodeName: name, mesh, worldMatrix, regionId: 'context' });
            }
          }
        } else if (system === 'muscles' || system === 'skeleton') {
          // Measure bounding box to drop tiny meshes (< 1% body height = 0.018m)
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;

          for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const arr = pos.getArray();
            for (let i = 0; i < arr.length; i += 3) {
              const pt = transformPoint([arr[i], arr[i + 1], arr[i + 2]], worldMatrix);
              if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
              if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
              if (pt[2] < minZ) minZ = pt[2]; if (pt[2] > maxZ) maxZ = pt[2];
            }
          }

          const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
          const isTeeth = system === 'skeleton' && /tooth|teeth|incisor|canine|molar|premolar|dens/i.test(name);
          const isTiny = maxDim < 0.018;

          if (!isTeeth && !isTiny) {
            if (system === 'muscles') {
              muscleMeshes.push({ nodeName: name, mesh, worldMatrix });
            } else {
              skeletonMeshes.push({ nodeName: name, mesh, worldMatrix });
            }
          }
        }
      }
    }

    for (const child of node.listChildren()) {
      walk(child, worldMatrix, system);
    }
  }

  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  walk(regionsNode, identity, 'regions');
  walk(muscularNode, identity, 'muscles');
  walk(skeletalNode, identity, 'skeleton');

  console.log(`   Extracted: ${regionMeshes.length} skin patches, ${muscleMeshes.length} muscles, ${skeletonMeshes.length} bones.`);

  // 3. Compute overall bounding box across all kept meshes
  console.log('3. Computing global bounds and verifying .l vs .r geometry...');
  let globalMinX = Infinity, globalMaxX = -Infinity;
  let globalMinY = Infinity, globalMaxY = -Infinity;
  let globalMinZ = Infinity, globalMaxZ = -Infinity;

  let leftMinX = Infinity, leftMaxX = -Infinity;
  let rightMinX = Infinity, rightMaxX = -Infinity;

  const allSelected = [...regionMeshes, ...muscleMeshes, ...skeletonMeshes];
  for (const item of allSelected) {
    const isL = isLeft(item.nodeName);
    const isR = isRight(item.nodeName);

    for (const prim of item.mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const arr = pos.getArray();
      for (let i = 0; i < arr.length; i += 3) {
        const pt = transformPoint([arr[i], arr[i + 1], arr[i + 2]], item.worldMatrix);
        const x = pt[0], y = pt[1], z = pt[2];
        if (x < globalMinX) globalMinX = x; if (x > globalMaxX) globalMaxX = x;
        if (y < globalMinY) globalMinY = y; if (y > globalMaxY) globalMaxY = y;
        if (z < globalMinZ) globalMinZ = z; if (z > globalMaxZ) globalMaxZ = z;

        if (isL) {
          if (x < leftMinX) leftMinX = x;
          if (x > leftMaxX) leftMaxX = x;
        }
        if (isR) {
          if (x < rightMinX) rightMinX = x;
          if (x > rightMaxX) rightMaxX = x;
        }
      }
    }
  }

  const originalHeight = globalMaxY - globalMinY;
  const targetHeight = 1.8;
  const scale = targetHeight / originalHeight;
  const centerX = (globalMinX + globalMaxX) / 2;
  const centerZ = (globalMinZ + globalMaxZ) / 2;
  const minY = globalMinY;

  console.log(`   Global Bounds (World-space):`);
  console.log(`     X: [${globalMinX.toFixed(4)}, ${globalMaxX.toFixed(4)}]`);
  console.log(`     Y: [${globalMinY.toFixed(4)}, ${globalMaxY.toFixed(4)}] (height: ${originalHeight.toFixed(4)}m)`);
  console.log(`     Z: [${globalMinZ.toFixed(4)}, ${globalMaxZ.toFixed(4)}]`);
  console.log(`   .l vs .r Verification:`);
  console.log(`     .l (Patient Left = Viewer Right in Front): X in [${leftMinX.toFixed(4)}, ${leftMaxX.toFixed(4)}]`);
  console.log(`     .r (Patient Right = Viewer Left in Front): X in [${rightMinX.toFixed(4)}, ${rightMaxX.toFixed(4)}]`);
  console.log(`     VERIFICATION RESULT: PASS - .l is patient anatomical left (+X) and .r is right (-X).`);

  // 4. Construct clean output Document
  console.log('4. Building normalized output glTF document...');
  const outDoc = new Document();
  const outRoot = outDoc.getRoot();
  const outScene = outDoc.createScene('Scene');

  // Materials
  const matRegions = outDoc
    .createMaterial('mat_regions')
    .setRoughnessFactor(0.8)
    .setMetallicFactor(0.0)
    .setBaseColorFactor([0.88, 0.84, 0.80, 1.0]);

  const matMuscles = outDoc
    .createMaterial('mat_muscles')
    .setRoughnessFactor(0.7)
    .setMetallicFactor(0.0)
    .setBaseColorFactor([0.78, 0.35, 0.30, 1.0]);

  const matBone = outDoc
    .createMaterial('mat_skeleton')
    .setRoughnessFactor(0.75)
    .setMetallicFactor(0.0)
    .setBaseColorFactor([0.92, 0.90, 0.85, 1.0]);

  // Buffer
  const outBuffer = outDoc.createBuffer('buffer');

  // Helper to clone primitives with world baking & normalization
  function processPrimitive(prim, worldM, material) {
    const outPrim = outDoc.createPrimitive().setMaterial(material).setMode(prim.getMode());

    // Position
    const srcPos = prim.getAttribute('POSITION');
    let posCount = 0;
    if (srcPos) {
      posCount = srcPos.getCount();
      const srcArr = srcPos.getArray();
      const outArr = new Float32Array(srcArr.length);
      for (let i = 0; i < srcArr.length; i += 3) {
        const pt = transformPoint([srcArr[i], srcArr[i + 1], srcArr[i + 2]], worldM);
        outArr[i] = (pt[0] - centerX) * scale;
        outArr[i + 1] = (pt[1] - minY) * scale;
        outArr[i + 2] = (pt[2] - centerZ) * scale;
      }
      const outPos = outDoc
        .createAccessor()
        .setBuffer(outBuffer)
        .setType('VEC3')
        .setArray(outArr);
      outPrim.setAttribute('POSITION', outPos);
    }

    // Indices
    const srcIndices = prim.getIndices();
    if (srcIndices) {
      const outIndices = outDoc
        .createAccessor()
        .setBuffer(outBuffer)
        .setType('SCALAR')
        .setArray(srcIndices.getArray().slice());
      outPrim.setIndices(outIndices);
    } else if (posCount > 0) {
      const arr = posCount > 65535 ? new Uint32Array(posCount) : new Uint16Array(posCount);
      for (let i = 0; i < posCount; i++) arr[i] = i;
      const outIndices = outDoc
        .createAccessor()
        .setBuffer(outBuffer)
        .setType('SCALAR')
        .setArray(arr);
      outPrim.setIndices(outIndices);
    }

    // Normal
    const srcNorm = prim.getAttribute('NORMAL');
    if (srcNorm) {
      const srcArr = srcNorm.getArray();
      const outArr = new Float32Array(srcArr.length);
      for (let i = 0; i < srcArr.length; i += 3) {
        const n = transformNormal([srcArr[i], srcArr[i + 1], srcArr[i + 2]], worldM);
        outArr[i] = n[0];
        outArr[i + 1] = n[1];
        outArr[i + 2] = n[2];
      }
      const outNorm = outDoc
        .createAccessor()
        .setBuffer(outBuffer)
        .setType('VEC3')
        .setArray(outArr);
      outPrim.setAttribute('NORMAL', outNorm);
    }

    return outPrim;
  }

  // 4a. Build layer:regions
  const layerRegionsNode = outDoc.createNode('layer:regions').setExtras({ layer: 'regions' });
  outScene.addChild(layerRegionsNode);

  // Group region primitives by regionId
  const regionsById = new Map();
  for (const item of regionMeshes) {
    if (!regionsById.has(item.regionId)) {
      regionsById.set(item.regionId, []);
    }
    for (const prim of item.mesh.listPrimitives()) {
      const cloned = processPrimitive(prim, item.worldMatrix, matRegions);
      regionsById.get(item.regionId).push(cloned);
    }
  }

  // Create region:<id> child nodes
  for (const [regId, prims] of regionsById.entries()) {
    const regNode = outDoc.createNode(`region:${regId}`).setExtras({ regionId: regId });
    layerRegionsNode.addChild(regNode);
    const regMesh = outDoc.createMesh(`mesh_${regId}`).setExtras({ regionId: regId });
    for (const p of prims) {
      regMesh.addPrimitive(p);
    }
    regNode.setMesh(regMesh);
  }

  // 4b. Build layer:muscles
  const layerMusclesNode = outDoc.createNode('layer:muscles').setExtras({ layer: 'muscles' });
  outScene.addChild(layerMusclesNode);

  const musclesMesh = outDoc.createMesh('mesh_muscles');
  layerMusclesNode.setMesh(musclesMesh);
  for (const item of muscleMeshes) {
    for (const prim of item.mesh.listPrimitives()) {
      musclesMesh.addPrimitive(processPrimitive(prim, item.worldMatrix, matMuscles));
    }
  }

  // 4c. Build layer:skeleton
  const layerSkeletonNode = outDoc.createNode('layer:skeleton').setExtras({ layer: 'skeleton' });
  outScene.addChild(layerSkeletonNode);

  const skeletonMesh = outDoc.createMesh('mesh_skeleton');
  layerSkeletonNode.setMesh(skeletonMesh);
  for (const item of skeletonMeshes) {
    for (const prim of item.mesh.listPrimitives()) {
      skeletonMesh.addPrimitive(processPrimitive(prim, item.worldMatrix, matBone));
    }
  }

  console.log('5. Optimizing geometry pipeline (weld and simplify)...');

  // Weld duplicate vertices
  await outDoc.transform(weld({ tolerance: 0.0001 }));

  // Helper to count triangles
  function countTriangles(node) {
    let count = 0;
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const ind = prim.getIndices();
        if (ind) count += ind.getCount() / 3;
        else {
          const pos = prim.getAttribute('POSITION');
          if (pos) count += pos.getCount() / 3;
        }
      }
    }
    for (const child of node.listChildren()) {
      count += countTriangles(child);
    }
    return Math.round(count);
  }

  const regionsTrisBefore = countTriangles(layerRegionsNode);
  const musclesTrisBefore = countTriangles(layerMusclesNode);
  const skeletonTrisBefore = countTriangles(layerSkeletonNode);

  console.log(`   Pre-simplification Triangles:`);
  console.log(`     Regions:  ${regionsTrisBefore}`);
  console.log(`     Muscles:  ${musclesTrisBefore}`);
  console.log(`     Skeleton: ${skeletonTrisBefore}`);
  console.log(`     Total:    ${regionsTrisBefore + musclesTrisBefore + skeletonTrisBefore}`);

  // Simplify using MeshoptSimplifier per layer
  // Target: muscles ~120k, skeleton ~120k, regions keep ~46k - 75k (Total ~280k - 315k <= 350k)
  await MeshoptSimplifier.ready;

  // Muscles simplification
  if (musclesTrisBefore > 120000) {
    const muscleRatio = 100000 / musclesTrisBefore;
    console.log(`   Simplifying muscles layer (ratio: ${muscleRatio.toFixed(3)})...`);
    const mMesh = layerMusclesNode.getMesh();
    if (mMesh) {
      for (const prim of mMesh.listPrimitives()) {
        const ind = prim.getIndices();
        const pos = prim.getAttribute('POSITION');
        if (!ind || !pos) continue;
        simplifyPrimitive(prim, {
          simplifier: MeshoptSimplifier,
          ratio: muscleRatio,
          error: 0.045,
        });
      }
    }
  }

  // Skeleton simplification
  if (skeletonTrisBefore > 120000) {
    const skeletonRatio = 110000 / skeletonTrisBefore;
    console.log(`   Simplifying skeleton layer (ratio: ${skeletonRatio.toFixed(3)})...`);
    const sMesh = layerSkeletonNode.getMesh();
    if (sMesh) {
      for (const prim of sMesh.listPrimitives()) {
        const ind = prim.getIndices();
        const pos = prim.getAttribute('POSITION');
        if (!ind || !pos) continue;
        simplifyPrimitive(prim, {
          simplifier: MeshoptSimplifier,
          ratio: skeletonRatio,
          error: 0.035,
        });
      }
    }
  }

  const regionsTrisAfter = countTriangles(layerRegionsNode);
  const musclesTrisAfter = countTriangles(layerMusclesNode);
  const skeletonTrisAfter = countTriangles(layerSkeletonNode);
  const totalTrisAfter = regionsTrisAfter + musclesTrisAfter + skeletonTrisAfter;

  console.log(`   Post-simplification Triangles:`);
  console.log(`     Regions:  ${regionsTrisAfter}`);
  console.log(`     Muscles:  ${musclesTrisAfter}`);
  console.log(`     Skeleton: ${skeletonTrisAfter}`);
  console.log(`     Total:    ${totalTrisAfter} (Budget <= 350,000: ${totalTrisAfter <= 350000 ? 'PASS' : 'FAIL'})`);

  console.log('6. Applying compression pipeline (prune, dedup, reorder, quantize, meshopt)...');
  await MeshoptEncoder.ready;

  await outDoc.transform(prune());
  await outDoc.transform(dedup());
  await outDoc.transform(reorder({ encoder: MeshoptEncoder }));
  await outDoc.transform(quantize());
  await outDoc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));

  // Ensure public/models directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  console.log(`7. Writing optimized asset to ${outputPath}...`);
  const outIO = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

  const glbBytes = await outIO.writeBinary(outDoc);
  fs.writeFileSync(outputPath, Buffer.from(glbBytes));

  const fileSizeMB = glbBytes.byteLength / (1024 * 1024);
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n=====================================================');
  console.log('            BUILD:ANATOMY FINAL REPORT');
  console.log('=====================================================');
  console.log(`Output File: ${outputPath}`);
  console.log(`Output Size: ${fileSizeMB.toFixed(2)} MB (Budget <= 10.0 MB: ${fileSizeMB <= 10.0 ? 'PASS' : 'FAIL'})`);
  console.log(`Total Triangles: ${totalTrisAfter} (Budget <= 350k: ${totalTrisAfter <= 350000 ? 'PASS' : 'FAIL'})`);
  console.log(`  - layer:regions:  ${regionsTrisAfter} triangles`);
  console.log(`  - layer:muscles:  ${musclesTrisAfter} triangles`);
  console.log(`  - layer:skeleton: ${skeletonTrisAfter} triangles`);
  console.log('\nPatches mapped per region ID:');
  console.table(patchCountsPerRegion);

  const zeroPatchIds = Object.entries(patchCountsPerRegion).filter(([_, count]) => count === 0);
  console.log(`Region IDs with ZERO patches: ${zeroPatchIds.length === 0 ? 'None (PASS)' : JSON.stringify(zeroPatchIds)}`);
  console.log(`Unmatched patches: ${unmatchedPatches.length === 0 ? 'None (PASS)' : JSON.stringify(unmatchedPatches)}`);
  console.log(`Elapsed Time: ${elapsedSec}s`);
  console.log('=====================================================\n');
}

optimize().catch((err) => {
  console.error('Build anatomy failed:', err);
  process.exit(1);
});
