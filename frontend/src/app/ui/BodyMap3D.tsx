import React, {useState, useEffect, useRef, useMemo, useCallback, Suspense} from 'react';
import {Canvas, useThree, useFrame} from '@react-three/fiber';
import {useGLTF, OrbitControls, useProgress} from '@react-three/drei';
import * as THREE from 'three';
import {MeshoptDecoder} from 'meshoptimizer';
import {useReducedMotion} from '../../hooks/useReducedMotion';
import {useStore, type PainArea} from '../../store';
import {ANATOMICAL_REGIONS, normalizeRegionId, type AnatomicalRegionMeta} from '../../data/regionMap';
import {BodyMapProcedural} from './BodyMapProcedural';

export {ANATOMICAL_REGIONS};
export type {AnatomicalRegionMeta};

export type ViewMode = 'surface' | 'xray_skeleton' | 'xray_muscles';
export type CameraPreset = 'front' | 'back' | 'left' | 'right' | 'reset';

export interface BodyMap3DProps {
  selectedRegionId?: string;
  onSelectRegion?: (regionId: string) => void;
  activeAreas?: PainArea[];
  readOnly?: boolean;
  className?: string;
  onFallback2D?: () => void;
}

const MODEL_URL = `${import.meta.env.BASE_URL}models/anatomy.glb`;

// Preload model with MeshoptDecoder and Draco disabled
if (typeof window !== 'undefined') {
  useGLTF.preload(MODEL_URL, false, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
}

function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function getPainColor(severity: number): string {
  if (severity >= 7) return '#e2704a'; // Mars high
  if (severity >= 4) return '#e0b03a'; // Amber mid
  if (severity > 0) return '#6fb6ff';  // Earth low
  return '#6fb6ff';
}

// Camera controller managing presets and smooth transitions
interface CameraControllerProps {
  cameraPreset: CameraPreset;
  controlsRef: React.RefObject<any>;
}

function CameraController({cameraPreset, controlsRef}: CameraControllerProps) {
  const {camera, invalidate} = useThree();
  const reducedMotion = useReducedMotion();

  const transitionRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  }>({
    active: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    startTime: 0,
    duration: 500,
  });

  const triggerAnimation = useCallback(
    (endPos: THREE.Vector3, endTarget: THREE.Vector3, duration = 500) => {
      if (reducedMotion) {
        camera.position.copy(endPos);
        if (controlsRef.current) {
          controlsRef.current.target.copy(endTarget);
          controlsRef.current.update();
        }
        invalidate();
        return;
      }

      transitionRef.current = {
        active: true,
        startPos: camera.position.clone(),
        endPos,
        startTarget: controlsRef.current ? controlsRef.current.target.clone() : new THREE.Vector3(0, 0.9, 0),
        endTarget,
        startTime: performance.now(),
        duration,
      };
      invalidate();
    },
    [camera, controlsRef, invalidate, reducedMotion]
  );

  useEffect(() => {
    // Body height 1.8m, center at y = 0.9, camera distance 3.6m gives full body view with margins at 1440px and 390px
    const dist = 3.6;
    const target = new THREE.Vector3(0, 0.9, 0);
    let pos = new THREE.Vector3(0, 0.9, dist);

    switch (cameraPreset) {
      case 'front':
      case 'reset':
        pos = new THREE.Vector3(0, 0.9, dist);
        break;
      case 'back':
        pos = new THREE.Vector3(0, 0.9, -dist);
        break;
      case 'left':
        // Patient's anatomical left = +X (viewer's right in front view)
        pos = new THREE.Vector3(dist, 0.9, 0);
        break;
      case 'right':
        // Patient's anatomical right = -X (viewer's left in front view)
        pos = new THREE.Vector3(-dist, 0.9, 0);
        break;
    }

    triggerAnimation(pos, target, 500);
  }, [cameraPreset, triggerAnimation]);

  useFrame(() => {
    const tr = transitionRef.current;
    if (!tr.active) return;

    const elapsed = performance.now() - tr.startTime;
    const rawProgress = Math.min(1, elapsed / tr.duration);

    // Smooth cubic ease-in-out
    const t =
      rawProgress < 0.5
        ? 4 * rawProgress * rawProgress * rawProgress
        : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;

    camera.position.lerpVectors(tr.startPos, tr.endPos, t);

    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(tr.startTarget, tr.endTarget, t);
      controlsRef.current.update();
    }

    invalidate();

    if (rawProgress >= 1) {
      tr.active = false;
    }
  });

  return null;
}

// Inner Anatomy Scene rendering the 3 layers
interface AnatomySceneProps {
  viewMode: ViewMode;
  activeAreas: PainArea[];
  selectedRegionId: string;
  hoveredRegionId: string | null;
  onHoverRegion: (id: string | null) => void;
  onSelectRegion: (id: string) => void;
  readOnly?: boolean;
}

function AnatomyScene({
  viewMode,
  activeAreas,
  selectedRegionId,
  hoveredRegionId,
  onHoverRegion,
  onSelectRegion,
  readOnly,
}: AnatomySceneProps) {
  const {scene} = useGLTF(MODEL_URL, false, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
  const {invalidate, gl, camera} = useThree();

  // Material instances created ONCE and mutated in-place
  const regionMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const muscleMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const skeletonMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Initialize materials once
  if (regionMaterialsRef.current.size === 0) {
    ANATOMICAL_REGIONS.forEach((r) => {
      regionMaterialsRef.current.set(
        r.id,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#dcd3be'),
          roughness: 0.8,
          metalness: 0.05,
          depthWrite: true,
        })
      );
    });

    muscleMaterialRef.current = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8c3d35'),
      roughness: 0.7,
      metalness: 0.05,
    });

    skeletonMaterialRef.current = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e2decb'),
      roughness: 0.75,
      metalness: 0.05,
    });
  }

  // Setup meshes and assign materials
  useEffect(() => {
    if (!scene) return;

    scene.traverse((child: any) => {
      if (child.isMesh) {
        const mesh = child as THREE.Mesh;
        const name = (mesh.name || '').toLowerCase();
        const parentName = (mesh.parent?.name || '').toLowerCase();
        const regId = mesh.userData?.regionId || mesh.parent?.userData?.regionId;

        if (regId || name.startsWith('region') || parentName.startsWith('region')) {
          const canonicalId = regId || name.replace(/^region:?_?/, '') || parentName.replace(/^region:?_?/, '');
          const mat = regionMaterialsRef.current.get(canonicalId) || regionMaterialsRef.current.get(normalizeRegionId(canonicalId));
          if (mat) {
            mesh.material = mat;
            mesh.userData.regionId = canonicalId;
          }
        } else if (name.includes('muscle') || parentName.includes('muscle')) {
          if (muscleMaterialRef.current) {
            mesh.material = muscleMaterialRef.current;
          }
          // Only layer:regions is raycastable: set raycast to a no-op on muscles
          mesh.raycast = () => {};
        } else if (name.includes('skeleton') || parentName.includes('skeleton')) {
          if (skeletonMaterialRef.current) {
            mesh.material = skeletonMaterialRef.current;
          }
          // Only layer:regions is raycastable: set raycast to a no-op on skeleton
          mesh.raycast = () => {};
        }
      }
    });

    invalidate();
  }, [scene, invalidate]);

  // Update material styling on viewMode, activeAreas, selection, or hover change
  useEffect(() => {
    const normSelected = normalizeRegionId(selectedRegionId);

    // 1. Update region materials
    regionMaterialsRef.current.forEach((mat, regId) => {
      // Check if region is active in pain data
      const activeArea =
        activeAreas.find((a) => a.regionId === regId) ||
        (regId.includes('abdomen') && activeAreas.find((a) => a.regionId === 'abdomen'));

      const sev = activeArea ? activeArea.severity : 0;
      const isSelected = normSelected === regId || (normSelected === 'abdomen' && regId.includes('abdomen'));
      const isHovered = hoveredRegionId === regId;

      // Base color
      if (sev > 0) {
        mat.color.set(getPainColor(sev));
      } else {
        mat.color.set('#dcd3be');
      }

      // X-Ray vs Surface opacity & depthWrite
      if (viewMode === 'surface') {
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.depthWrite = true;
      } else {
        mat.transparent = true;
        mat.opacity = 0.20;
        mat.depthWrite = false;
      }

      // Emissive highlighting
      if (isSelected) {
        mat.emissive.set('#6fb6ff');
        mat.emissiveIntensity = 0.55;
      } else if (isHovered) {
        mat.emissive.set('#ffffff');
        mat.emissiveIntensity = 0.30;
        mat.color.lerp(new THREE.Color('#ffffff'), 0.25);
      } else {
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0.0;
      }

      mat.needsUpdate = true;
    });

    // 2. Update muscle material
    if (muscleMaterialRef.current) {
      if (viewMode === 'surface') {
        // Non-interactive muscle backing at 15% opacity prevents visible gaps
        muscleMaterialRef.current.visible = true;
        muscleMaterialRef.current.transparent = true;
        muscleMaterialRef.current.opacity = 0.15;
        muscleMaterialRef.current.depthWrite = false;
      } else if (viewMode === 'xray_muscles') {
        muscleMaterialRef.current.visible = true;
        muscleMaterialRef.current.transparent = false;
        muscleMaterialRef.current.opacity = 1.0;
        muscleMaterialRef.current.depthWrite = true;
      } else {
        // In xray_skeleton mode, muscles are hidden
        muscleMaterialRef.current.visible = false;
      }
      muscleMaterialRef.current.needsUpdate = true;
    }

    // 3. Update skeleton material
    if (skeletonMaterialRef.current) {
      if (viewMode === 'xray_skeleton') {
        skeletonMaterialRef.current.visible = true;
        skeletonMaterialRef.current.transparent = false;
        skeletonMaterialRef.current.opacity = 1.0;
        skeletonMaterialRef.current.depthWrite = true;
      } else {
        // In surface or xray_muscles mode, skeleton is hidden
        skeletonMaterialRef.current.visible = false;
      }
      skeletonMaterialRef.current.needsUpdate = true;
    }

    invalidate();
  }, [viewMode, activeAreas, selectedRegionId, hoveredRegionId, invalidate]);

  // Clean up materials on unmount
  useEffect(() => {
    return () => {
      regionMaterialsRef.current.forEach((mat) => mat.dispose());
      muscleMaterialRef.current?.dispose();
      skeletonMaterialRef.current?.dispose();
    };
  }, []);

  // Direct canvas raycasting on gl.domElement for precise mesh hits & drag-safe clicks
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const getRaycastHit = (event: MouseEvent | PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Only raycast against meshes with an identified regionId
      const candidateMeshes: THREE.Mesh[] = [];
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj.userData?.regionId) {
          candidateMeshes.push(obj as THREE.Mesh);
        }
      });

      const intersects = raycaster.intersectObjects(candidateMeshes, false);
      if (intersects.length > 0) {
        return (intersects[0].object as THREE.Mesh).userData.regionId as string;
      }
      return null;
    };

    const handleClick = (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 8) return; // Orbit drag
      const hitRegionId = getRaycastHit(e);
      if (hitRegionId && !readOnly) {
        onSelectRegion(hitRegionId);
        invalidate();
      }
    };

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      const hitRegionId = getRaycastHit(e);
      onHoverRegion(hitRegionId);
      invalidate();
    };

    const handlePointerLeave = () => {
      onHoverRegion(null);
      invalidate();
    };

    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      canvas.removeEventListener('mousedown', handlePointerDown);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [gl, camera, scene, readOnly, onSelectRegion, onHoverRegion, invalidate]);

  return <primitive object={scene} />;
}

// Progress Bar Loader component
function LoadingProgressBar({onFallback}: {onFallback?: () => void}) {
  const {progress, errors} = useProgress();

  useEffect(() => {
    if (errors && errors.length > 0) {
      onFallback?.();
    }
  }, [errors, onFallback]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-void/90 backdrop-blur-md font-mono text-xs text-regolith p-4">
      <div className="w-56 space-y-2.5">
        <div className="flex justify-between text-[11px] uppercase tracking-wider font-bold">
          <span className="text-white">Loading Z-Anatomy Twin</span>
          <span className="text-earth">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full rounded bg-void overflow-hidden border border-white/10">
          <div
            className="h-full bg-earth transition-all duration-300 ease-out"
            style={{width: `${Math.max(4, Math.round(progress))}%`}}
          />
        </div>
        <div className="text-[10px] text-regolith/50 text-center">
          Optimized Z-Anatomy 3D Mesh
        </div>
      </div>
    </div>
  );
}

export function BodyMap3D({
  selectedRegionId = 'lumbar_spine',
  onSelectRegion,
  activeAreas = [],
  readOnly = false,
  className = '',
  onFallback2D,
}: BodyMap3DProps) {
  const addToast = useStore((s) => s.addToast);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('surface');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('front');
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [regionSearchQuery, setRegionSearchQuery] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);

  const controlsRef = useRef<any>(null);

  // WebGL availability check
  useEffect(() => {
    if (!isWebGLSupported()) {
      addToast('WebGL unavailable in this browser — switched to 2D Body Map', 'warn');
      onFallback2D?.();
    }
  }, [addToast, onFallback2D]);

  const handleRegionClick = useCallback(
    (id: string) => {
      if (readOnly) return;
      const canonicalId = normalizeRegionId(id);
      onSelectRegion?.(canonicalId);
    },
    [readOnly, onSelectRegion]
  );

  // Filtered regions list for search
  const filteredRegions = useMemo(() => {
    const q = regionSearchQuery.toLowerCase().trim();
    if (!q) return ANATOMICAL_REGIONS;
    return ANATOMICAL_REGIONS.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [regionSearchQuery]);

  // Hovered label text
  const hoverTooltipLabel = useMemo(() => {
    if (!hoveredRegionId) return null;
    const def = ANATOMICAL_REGIONS.find((r) => r.id === hoveredRegionId || r.aliases.includes(hoveredRegionId));
    return def ? def.label : hoveredRegionId;
  }, [hoveredRegionId]);

  // Accessible aria description
  const ariaDescription = useMemo(() => {
    const count = activeAreas.length;
    if (count === 0) return 'Interactive 3D Anatomical Body Map. No active pain areas recorded.';
    const details = activeAreas.map((a) => `${a.label || a.regionId}: Severity ${a.severity}/10`).join(', ');
    return `Interactive 3D Anatomical Body Map. ${count} active pain area${count > 1 ? 's' : ''}: ${details}.`;
  }, [activeAreas]);

  if (hasError) {
    return (
      <BodyMapProcedural
        selectedRegionId={selectedRegionId}
        onSelectRegion={onSelectRegion}
        activeAreas={activeAreas}
        readOnly={readOnly}
        className={className}
        onFallback2D={onFallback2D}
      />
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Controls Strip: VIEW presets & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* VIEW Presets */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono uppercase text-regolith/50 mr-1 hidden sm:inline">
            View:
          </span>
          {(['front', 'back', 'left', 'right', 'reset'] as CameraPreset[]).map((preset) => {
            const isActive = cameraPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setCameraPreset(preset)}
                className={`rounded px-2.5 py-1 text-[11px] font-mono uppercase font-bold transition-all ${
                  isActive
                    ? 'bg-earth text-void shadow-sm'
                    : 'bg-void text-regolith/70 border border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher: Surface | X-ray Skeleton | X-ray Muscles */}
        <div className="flex items-center rounded-lg bg-void border border-white/10 p-0.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode('surface')}
            className={`rounded px-2.5 py-1 font-bold uppercase transition-colors ${
              viewMode === 'surface' ? 'bg-earth text-void' : 'text-regolith/60 hover:text-white'
            }`}
          >
            Surface
          </button>
          <button
            type="button"
            onClick={() => setViewMode('xray_skeleton')}
            className={`rounded px-2.5 py-1 font-bold uppercase transition-colors ${
              viewMode === 'xray_skeleton' ? 'bg-earth text-void' : 'text-regolith/60 hover:text-white'
            }`}
          >
            X-ray Skeleton
          </button>
          <button
            type="button"
            onClick={() => setViewMode('xray_muscles')}
            className={`rounded px-2.5 py-1 font-bold uppercase transition-colors ${
              viewMode === 'xray_muscles' ? 'bg-earth text-void' : 'text-regolith/60 hover:text-white'
            }`}
          >
            X-ray Muscles
          </button>
        </div>
      </div>

      {/* Region Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={regionSearchQuery}
          onChange={(e) => setRegionSearchQuery(e.target.value)}
          placeholder="Search region (e.g. Abdomen, Lumbar, Knee, Neck, Shoulder...)"
          className="w-full rounded-lg bg-void-2 border border-white/10 px-3 py-1.5 text-xs text-white placeholder:text-regolith/40 focus:border-earth focus:outline-none focus:ring-1 focus:ring-earth pr-8 font-mono"
        />
        {regionSearchQuery && (
          <button
            type="button"
            onClick={() => setRegionSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-regolith/50 hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main 3D Canvas Box */}
      <div
        role="img"
        aria-label={ariaDescription}
        className="relative mx-auto flex flex-col justify-center bg-void rounded-xl border border-white/10 overflow-hidden h-[380px] lg:h-[540px] w-full"
      >
        {/* Hover Tooltip Badge */}
        {hoverTooltipLabel && (
          <div className="pointer-events-none absolute top-3 left-3 z-30 flex items-center gap-2 rounded-md bg-void/90 backdrop-blur-md border border-white/20 px-2.5 py-1 text-xs font-mono shadow-lg">
            <span className="size-2 rounded-full bg-earth animate-pulse" />
            <span className="text-white font-bold">{hoverTooltipLabel}</span>
          </div>
        )}

        {/* 3D WebGL Canvas */}
        <Canvas
          frameloop="demand"
          dpr={[1, Math.min(window.devicePixelRatio || 1, 2)]}
          camera={{position: [0, 0.9, 3.6], fov: 35, near: 0.1, far: 20}}
          style={{width: '100%', height: '100%', touchAction: 'none'}}
          onCreated={({gl}) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              addToast('WebGL context lost — switching to 2D Body Map', 'warn');
              onFallback2D?.();
            });
          }}
        >
          {/* Plain local lights only (offline-safe, zero network CDN dependency) */}
          <hemisphereLight intensity={0.7} groundColor="#140b08" color="#ffffff" />
          <directionalLight position={[2.5, 4, 3.5]} intensity={1.5} />
          <directionalLight position={[-2.5, 2, -3]} intensity={0.8} />

          <CameraController cameraPreset={cameraPreset} controlsRef={controlsRef} />

          <OrbitControls
            ref={controlsRef}
            target={[0, 0.9, 0]}
            enablePan={false}
            minDistance={1.2}
            maxDistance={5.5}
            minPolarAngle={Math.PI * 0.1}
            maxPolarAngle={Math.PI * 0.9}
            autoRotate={false}
          />

          <Suspense fallback={null}>
            <AnatomyScene
              viewMode={viewMode}
              activeAreas={activeAreas}
              selectedRegionId={selectedRegionId}
              hoveredRegionId={hoveredRegionId}
              onHoverRegion={setHoveredRegionId}
              onSelectRegion={handleRegionClick}
              readOnly={readOnly}
            />
          </Suspense>
        </Canvas>

        {/* Suspense Progress Bar Overlay */}
        <Suspense fallback={<LoadingProgressBar onFallback={() => setHasError(true)} />}>
          <div />
        </Suspense>
      </div>

      {/* Accessible Anatomical Regions Listbox */}
      <div className="pt-2 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-regolith/70 font-mono">
          <span className="uppercase font-bold">Select Region via Keyboard / List:</span>
          <span>{filteredRegions.length} Regions</span>
        </div>
        <div
          role="listbox"
          aria-label="Anatomical Regions"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1"
        >
          {filteredRegions.map((r) => {
            const activeArea =
              activeAreas.find((a) => a.regionId === r.id) ||
              (r.id.includes('abdomen') && activeAreas.find((a) => a.regionId === 'abdomen'));
            const isSelected = selectedRegionId === r.id;
            const sev = activeArea ? activeArea.severity : 0;

            return (
              <button
                key={r.id}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => handleRegionClick(r.id)}
                className={`rounded px-2 py-1.5 text-left text-[11px] font-mono transition-all flex items-center justify-between border ${
                  isSelected
                    ? 'bg-earth/20 text-white border-earth font-bold'
                    : sev > 0
                    ? 'bg-white/5 text-white border-white/20 hover:border-white/40'
                    : 'bg-void text-regolith/70 border-white/5 hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="truncate mr-1">{r.label}</span>
                {sev > 0 && (
                  <span
                    className="shrink-0 rounded px-1 text-[10px] font-bold"
                    style={{backgroundColor: getPainColor(sev), color: '#000'}}
                  >
                    {sev}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mandatory Attribution Footer */}
      <div className="text-[10px] text-regolith/40 font-mono text-center pt-1">
        3D model: Z-Anatomy and BodyParts3D, CC BY-SA. Modified.
      </div>
    </div>
  );
}

export default BodyMap3D;
