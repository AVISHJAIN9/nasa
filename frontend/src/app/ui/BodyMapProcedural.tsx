import React, {useState, useEffect, useRef, useMemo, useCallback, Suspense} from 'react';
import {Canvas, useThree} from '@react-three/fiber';
import {OrbitControls, useProgress} from '@react-three/drei';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {useReducedMotion} from '../../hooks/useReducedMotion';
import {useStore, type PainArea} from '../../store';

export type BodyLayer = 'surface' | 'muscles' | 'skeleton';

export interface AnatomicalRegionDef {
  id: string;
  label: string;
  aliases: string[];
  // Procedural geometry specs: position [x, y, z], dimensions / radius
  type: 'capsule' | 'sphere' | 'cylinder' | 'box';
  position: [number, number, number];
  rotation?: [number, number, number];
  params: number[]; // radius, length, or width, height, depth
}

// 22 comprehensive anatomical body regions
export const ANATOMICAL_REGIONS: AnatomicalRegionDef[] = [
  {id: 'head', label: 'Cranium / Head', aliases: ['head_back', 'cranium'], type: 'sphere', position: [0, 1.62, 0], params: [0.11, 24, 24]},
  {id: 'neck', label: 'Cervical Spine / Neck', aliases: ['neck_back', 'cervical'], type: 'cylinder', position: [0, 1.47, 0], params: [0.05, 0.05, 0.08, 16]},
  {id: 'left_shoulder', label: 'Left Shoulder', aliases: ['shoulder_l'], type: 'sphere', position: [0.20, 1.37, 0], params: [0.07, 16, 16]},
  {id: 'right_shoulder', label: 'Right Shoulder', aliases: ['shoulder_r'], type: 'sphere', position: [-0.20, 1.37, 0], params: [0.07, 16, 16]},
  {id: 'chest', label: 'Thorax / Chest', aliases: ['thorax'], type: 'box', position: [0, 1.28, 0.02], params: [0.26, 0.20, 0.16]},
  {id: 'upper_back', label: 'Upper Back / Thoracic Spine', aliases: ['thoracic_spine'], type: 'box', position: [0, 1.28, -0.05], params: [0.26, 0.20, 0.12]},
  {id: 'abdomen', label: 'Abdomen', aliases: ['upper_abdomen', 'lower_abdomen'], type: 'box', position: [0, 1.05, 0.02], params: [0.24, 0.18, 0.15]},
  {id: 'lumbar_spine', label: 'Lumbar Spine (L1-S1)', aliases: ['lumbar'], type: 'box', position: [0, 1.05, -0.05], params: [0.18, 0.18, 0.12]},
  {id: 'pelvis', label: 'Pelvis / Hips', aliases: ['pelvis_back', 'sacrum'], type: 'box', position: [0, 0.88, 0], params: [0.28, 0.16, 0.18]},
  {id: 'left_arm', label: 'Left Upper Arm', aliases: ['arm_l'], type: 'cylinder', position: [0.25, 1.18, 0], rotation: [0, 0, -0.15], params: [0.05, 0.045, 0.22, 16]},
  {id: 'right_arm', label: 'Right Upper Arm', aliases: ['arm_r'], type: 'cylinder', position: [-0.25, 1.18, 0], rotation: [0, 0, 0.15], params: [0.05, 0.045, 0.22, 16]},
  {id: 'left_forearm', label: 'Left Forearm', aliases: ['forearm_l'], type: 'cylinder', position: [0.29, 0.94, 0], rotation: [0, 0, -0.1], params: [0.042, 0.038, 0.22, 16]},
  {id: 'right_forearm', label: 'Right Forearm', aliases: ['forearm_r'], type: 'cylinder', position: [-0.29, 0.94, 0], rotation: [0, 0, 0.1], params: [0.042, 0.038, 0.22, 16]},
  {id: 'left_hand', label: 'Left Hand / Wrist', aliases: ['hand_l'], type: 'box', position: [0.32, 0.76, 0], params: [0.05, 0.10, 0.03]},
  {id: 'right_hand', label: 'Right Hand / Wrist', aliases: ['hand_r'], type: 'box', position: [-0.32, 0.76, 0], params: [0.05, 0.10, 0.03]},
  {id: 'left_thigh', label: 'Left Thigh', aliases: ['left_thigh_back', 'thigh_l'], type: 'cylinder', position: [0.10, 0.65, 0], rotation: [0, 0, -0.05], params: [0.075, 0.065, 0.32, 16]},
  {id: 'right_thigh', label: 'Right Thigh', aliases: ['right_thigh_back', 'thigh_r'], type: 'cylinder', position: [-0.10, 0.65, 0], rotation: [0, 0, 0.05], params: [0.075, 0.065, 0.32, 16]},
  {id: 'left_knee', label: 'Left Knee', aliases: ['knee_l'], type: 'sphere', position: [0.10, 0.46, 0.01], params: [0.055, 16, 16]},
  {id: 'right_knee', label: 'Right Knee', aliases: ['knee_r'], type: 'sphere', position: [-0.10, 0.46, 0.01], params: [0.055, 16, 16]},
  {id: 'left_leg', label: 'Left Knee / Shin / Calf', aliases: ['left_calf', 'shin_l'], type: 'cylinder', position: [0.10, 0.27, 0], params: [0.055, 0.045, 0.30, 16]},
  {id: 'right_leg', label: 'Right Knee / Shin / Calf', aliases: ['right_calf', 'shin_r'], type: 'cylinder', position: [-0.10, 0.27, 0], params: [0.055, 0.045, 0.30, 16]},
  {id: 'left_foot', label: 'Left Foot / Ankle', aliases: ['foot_l'], type: 'box', position: [0.10, 0.04, 0.05], params: [0.08, 0.06, 0.18]},
  {id: 'right_foot', label: 'Right Foot / Ankle', aliases: ['foot_r'], type: 'box', position: [-0.10, 0.04, 0.05], params: [0.08, 0.06, 0.18]},
];

export interface BodyMap3DProps {
  selectedRegionId?: string;
  onSelectRegion?: (regionId: string) => void;
  activeAreas?: PainArea[];
  readOnly?: boolean;
  className?: string;
  onFallback2D?: () => void;
}

// Check WebGL availability
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

// Color resolver based on pain severity
function getRegionColor(severity: number, layer: BodyLayer): string {
  if (severity >= 7) return '#e2704a'; // Mars high pain
  if (severity >= 4) return '#e0b03a'; // Amber mid pain
  if (severity > 0) return '#6fb6ff';  // Earth low pain

  switch (layer) {
    case 'skeleton':
      return '#c8b6a6'; // Bone
    case 'muscles':
      return '#6b291e'; // Muscle red
    case 'surface':
    default:
      return '#221612'; // Obsidian / bronze skin
  }
}

// Camera controller helper
interface CameraControllerProps {
  cameraPreset: 'front' | 'back' | 'left' | 'right' | 'reset';
  controlsRef: React.RefObject<any>;
}

function CameraController({cameraPreset, controlsRef}: CameraControllerProps) {
  const {camera, invalidate} = useThree();

  useEffect(() => {
    const targetY = 0.9;
    const distance = 2.5;

    let posX = 0;
    let posY = targetY;
    let posZ = distance;

    switch (cameraPreset) {
      case 'front':
      case 'reset':
        posX = 0;
        posY = targetY;
        posZ = distance;
        break;
      case 'back':
        posX = 0;
        posY = targetY;
        posZ = -distance;
        break;
      case 'left':
        posX = distance;
        posY = targetY;
        posZ = 0;
        break;
      case 'right':
        posX = -distance;
        posY = targetY;
        posZ = 0;
        break;
    }

    camera.position.set(posX, posY, posZ);
    camera.lookAt(0, targetY, 0);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, targetY, 0);
      controlsRef.current.update();
    }
    invalidate();
  }, [cameraPreset, camera, controlsRef, invalidate]);

  return null;
}

// Procedural Mesh Primitive Component
interface ProceduralRegionMeshProps {
  region: AnatomicalRegionDef;
  layer: BodyLayer;
  severity: number;
  isSelected: boolean;
  isHovered: boolean;
  onPointerOver: (e: any) => void;
  onPointerOut: (e: any) => void;
  onClick: (e: any) => void;
}

function ProceduralRegionMesh({
  region,
  layer,
  severity,
  isSelected,
  isHovered,
  onPointerOver,
  onPointerOut,
  onClick,
}: ProceduralRegionMeshProps) {
  const baseColor = useMemo(() => getRegionColor(severity, layer), [severity, layer]);
  const isPainted = severity > 0;

  // Scale slightly for layer differentiation
  const layerScale = layer === 'skeleton' ? 0.86 : layer === 'muscles' ? 0.93 : 1.0;

  return (
    <group
      position={region.position}
      rotation={region.rotation ? new THREE.Euler(...region.rotation) : undefined}
      scale={[layerScale, layerScale, layerScale]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      {region.type === 'sphere' && (
        <mesh>
          <sphereGeometry args={[region.params[0], region.params[1], region.params[2]]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={isSelected ? '#6fb6ff' : isHovered ? '#ffffff' : '#000000'}
            emissiveIntensity={isSelected ? 0.45 : isHovered ? 0.25 : 0}
            roughness={layer === 'skeleton' ? 0.6 : 0.4}
            metalness={0.1}
            wireframe={isSelected}
          />
        </mesh>
      )}

      {region.type === 'cylinder' && (
        <mesh>
          <cylinderGeometry
            args={[region.params[0], region.params[1], region.params[2], region.params[3]]}
          />
          <meshStandardMaterial
            color={baseColor}
            emissive={isSelected ? '#6fb6ff' : isHovered ? '#ffffff' : '#000000'}
            emissiveIntensity={isSelected ? 0.45 : isHovered ? 0.25 : 0}
            roughness={layer === 'skeleton' ? 0.6 : 0.4}
            metalness={0.1}
            wireframe={isSelected}
          />
        </mesh>
      )}

      {region.type === 'box' && (
        <mesh>
          <boxGeometry args={[region.params[0], region.params[1], region.params[2]]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={isSelected ? '#6fb6ff' : isHovered ? '#ffffff' : '#000000'}
            emissiveIntensity={isSelected ? 0.45 : isHovered ? 0.25 : 0}
            roughness={layer === 'skeleton' ? 0.6 : 0.4}
            metalness={0.1}
            wireframe={isSelected}
          />
        </mesh>
      )}

      {/* Selected highlight wireframe indicator */}
      {isSelected && (
        <mesh scale={[1.08, 1.08, 1.08]}>
          {region.type === 'sphere' && (
            <sphereGeometry args={[region.params[0], 12, 12]} />
          )}
          {region.type === 'cylinder' && (
            <cylinderGeometry
              args={[region.params[0], region.params[1], region.params[2], 12]}
            />
          )}
          {region.type === 'box' && (
            <boxGeometry args={[region.params[0], region.params[1], region.params[2]]} />
          )}
          <meshBasicMaterial color="#6fb6ff" wireframe />
        </mesh>
      )}

      {/* Severity badge ring for high pain */}
      {isPainted && severity >= 7 && (
        <mesh scale={[1.14, 1.14, 1.14]}>
          {region.type === 'sphere' && (
            <sphereGeometry args={[region.params[0], 8, 8]} />
          )}
          {region.type === 'cylinder' && (
            <cylinderGeometry
              args={[region.params[0], region.params[1], region.params[2], 8]}
            />
          )}
          {region.type === 'box' && (
            <boxGeometry args={[region.params[0], region.params[1], region.params[2]]} />
          )}
          <meshBasicMaterial color="#e2704a" wireframe transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

// GLB Anatomy Model Renderer with fallback to procedural body
interface AnatomyModelRendererProps {
  modelUrl: string;
  layer: BodyLayer;
  activeAreas: PainArea[];
  selectedRegionId: string;
  hoveredRegionId: string | null;
  onHoverRegion: (id: string | null) => void;
  onSelectRegion: (id: string) => void;
  onModelLoaded: (success: boolean) => void;
}

function AnatomyModelRenderer({
  modelUrl,
  layer,
  activeAreas,
  selectedRegionId,
  hoveredRegionId,
  onHoverRegion,
  onSelectRegion,
  onModelLoaded,
}: AnatomyModelRendererProps) {
  const [gltfScene, setGltfScene] = useState<THREE.Group | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const {invalidate} = useThree();

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();

    loader.load(
      modelUrl,
      (gltf) => {
        if (!active) return;
        setGltfScene(gltf.scene);
        onModelLoaded(true);
        invalidate();
      },
      undefined,
      () => {
        if (!active) return;
        // Model 404 or failed: fall back to procedural body
        setLoadFailed(true);
        onModelLoaded(false);
        invalidate();
      }
    );

    return () => {
      active = false;
    };
  }, [modelUrl, onModelLoaded, invalidate]);

  // Clean disposal on unmount
  useEffect(() => {
    return () => {
      if (gltfScene) {
        gltfScene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              mesh.material?.dispose();
            }
          }
        });
      }
    };
  }, [gltfScene]);

  // Map active area severity
  const severityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of activeAreas) {
      map.set(a.regionId, a.severity);
      // Also map aliases
      const def = ANATOMICAL_REGIONS.find((r) => r.id === a.regionId);
      if (def) {
        def.aliases.forEach((alias) => map.set(alias, a.severity));
      }
    }
    return map;
  }, [activeAreas]);

  // If real GLB is loaded successfully
  if (gltfScene && !loadFailed) {
    return (
      <primitive
        object={gltfScene}
        onPointerOver={(e: any) => {
          e.stopPropagation();
          const nodeName = e.object?.name || '';
          const match = nodeName.match(/^r:([^:]+)/);
          if (match) {
            onHoverRegion(match[1]);
          }
        }}
        onPointerOut={() => onHoverRegion(null)}
        onClick={(e: any) => {
          e.stopPropagation();
          const nodeName = e.object?.name || '';
          const match = nodeName.match(/^r:([^:]+)/);
          if (match) {
            onSelectRegion(match[1]);
          }
        }}
      />
    );
  }

  // Fallback Procedural 3D Human Anatomy Body
  return (
    <group>
      {ANATOMICAL_REGIONS.map((region) => {
        const sev = severityMap.get(region.id) ?? 0;
        const isSelected = selectedRegionId === region.id || region.aliases.includes(selectedRegionId);
        const isHovered = hoveredRegionId === region.id || region.aliases.includes(hoveredRegionId || '');

        return (
          <ProceduralRegionMesh
            key={region.id}
            region={region}
            layer={layer}
            severity={sev}
            isSelected={isSelected}
            isHovered={isHovered}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHoverRegion(region.id);
              invalidate();
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              onHoverRegion(null);
              invalidate();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectRegion(region.id);
              invalidate();
            }}
          />
        );
      })}
    </group>
  );
}

// Loading Skeleton with Progress Bar
function LoadingProgressFallback() {
  const {progress} = useProgress();
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-void-2/80 backdrop-blur-sm font-mono text-xs text-regolith">
      <div className="w-48 space-y-2">
        <div className="flex justify-between text-[11px] text-regolith/70 uppercase">
          <span>Loading 3D Anatomy</span>
          <span className="text-earth font-bold">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full rounded bg-void overflow-hidden border border-white/10">
          <div
            className="h-full bg-earth transition-all duration-300 ease-out"
            style={{width: `${Math.max(5, progress)}%`}}
          />
        </div>
        <p className="text-[10px] text-regolith/50 text-center">Parsing mesh layers & coordinates...</p>
      </div>
    </div>
  );
}

export function BodyMapProcedural({
  selectedRegionId = 'lumbar_spine',
  onSelectRegion,
  activeAreas = [],
  readOnly = false,
  className = '',
  onFallback2D,
}: BodyMap3DProps) {
  const reducedMotion = useReducedMotion();
  const addToast = useStore((s) => s.addToast);
  const [layer, setLayer] = useState<BodyLayer>('surface');
  const [cameraPreset, setCameraPreset] = useState<'front' | 'back' | 'left' | 'right' | 'reset'>('front');
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [webglValid, setWebglValid] = useState<boolean>(true);
  const [isModelGlb, setIsModelGlb] = useState<boolean>(false);
  const controlsRef = useRef<any>(null);

  const modelUrl = import.meta.env.VITE_ANATOMY_MODEL_URL || '/models/anatomy.glb';

  // Check WebGL support on mount
  useEffect(() => {
    if (!isWebGLSupported()) {
      setWebglValid(false);
      addToast('WebGL unavailable in this browser — switched to 2D Body Map', 'warn');
      onFallback2D?.();
    }
  }, [addToast, onFallback2D]);

  // Aria label describing painted regions in words
  const ariaDescription = useMemo(() => {
    if (activeAreas.length === 0) {
      return '3D Human Body Map with no active pain regions marked nominal. Use mouse or touch to rotate, or choose a region from the list.';
    }
    const regionNames = activeAreas.map((a) => `${a.label} severity ${a.severity} of 10`).join(', ');
    return `3D Human Body Map. Active pain regions: ${regionNames}. Use mouse or touch to rotate, or choose a region from the list.`;
  }, [activeAreas]);

  const handleRegionClick = useCallback(
    (id: string) => {
      if (readOnly) return;
      onSelectRegion?.(id);
    },
    [readOnly, onSelectRegion]
  );

  const activeHoverLabel = useMemo(() => {
    if (!hoveredRegionId) return null;
    const def = ANATOMICAL_REGIONS.find((r) => r.id === hoveredRegionId || r.aliases.includes(hoveredRegionId));
    return def ? def.label : hoveredRegionId;
  }, [hoveredRegionId]);

  if (!webglValid) {
    return null;
  }

  return (
    <div className={`space-y-3 font-mono text-xs ${className}`}>
      {/* Top Toolbar: View Presets & Layer Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        {/* Camera Preset Buttons */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-regolith/50 uppercase mr-1 hidden sm:inline">View:</span>
          {(['front', 'back', 'left', 'right', 'reset'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setCameraPreset(view)}
              className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase transition-colors border ${
                cameraPreset === view && view !== 'reset'
                  ? 'bg-earth text-void border-earth'
                  : 'bg-void text-regolith/70 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Layer Toggles (Surface, Muscles, Skeleton) */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-regolith/50 uppercase mr-1 hidden sm:inline">Layer:</span>
          {(['surface', 'muscles', 'skeleton'] as BodyLayer[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayer(l)}
              className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase transition-colors border ${
                layer === l
                  ? 'bg-earth text-void border-earth'
                  : 'bg-void text-regolith/70 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3D Canvas Box */}
      <div
        role="img"
        aria-label={ariaDescription}
        className="relative mx-auto flex flex-col justify-center bg-void rounded-xl border border-white/10 overflow-hidden h-[360px] lg:h-[520px] w-full"
      >
        {/* Live Hover Region Tooltip */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1">
          <div className="rounded bg-void-2/90 border border-white/10 px-2.5 py-1 text-[11px] text-white flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-earth animate-pulse" />
            <span className="font-bold">
              {activeHoverLabel || 'Orbit with mouse / touch to inspect'}
            </span>
          </div>
          {isModelGlb ? (
            <span className="text-[10px] text-regolith/50 ml-1">Loaded Z-Anatomy mesh asset</span>
          ) : (
            <span className="text-[10px] text-regolith/50 ml-1">Anatomical digital twin (Procedural)</span>
          )}
        </div>

        {/* 3D WebGL Canvas */}
        <Canvas
          frameloop="demand"
          dpr={[1, Math.min(window.devicePixelRatio || 1, 2)]}
          camera={{position: [0, 0.9, 2.5], fov: 45}}
          style={{width: '100%', height: '100%', touchAction: 'none'}}
          onCreated={({gl}) => {
            // Listen for context loss
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              addToast('WebGL context lost — switching to 2D Body Map', 'warn');
              onFallback2D?.();
            });
          }}
        >
          {/* Plain lights only (strictly offline, no CDN / no Drei environment) */}
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} />
          <directionalLight position={[-3, 2, -4]} intensity={0.5} />

          <CameraController cameraPreset={cameraPreset} controlsRef={controlsRef} />

          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minPolarAngle={Math.PI / 8}
            maxPolarAngle={Math.PI * 7 / 8}
            minDistance={1.0}
            maxDistance={4.2}
            enableDamping={!reducedMotion}
            autoRotate={false}
            makeDefault
          />

          <Suspense fallback={null}>
            <AnatomyModelRenderer
              modelUrl={modelUrl}
              layer={layer}
              activeAreas={activeAreas}
              selectedRegionId={selectedRegionId}
              hoveredRegionId={hoveredRegionId}
              onHoverRegion={setHoveredRegionId}
              onSelectRegion={handleRegionClick}
              onModelLoaded={setIsModelGlb}
            />
          </Suspense>
        </Canvas>

        {/* Subtle loading fallback */}
        <Suspense fallback={<LoadingProgressFallback />}>
          <div />
        </Suspense>
      </div>

      {/* Accessible Region Listbox for Keyboard Users */}
      <div className="pt-2 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-regolith/70">
          <span className="uppercase font-bold">Select Region via Keyboard / List:</span>
          <span>{ANATOMICAL_REGIONS.length} Regions</span>
        </div>
        <div
          role="listbox"
          aria-label="Anatomical Body Regions"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 rounded bg-void-2 border border-white/5"
        >
          {ANATOMICAL_REGIONS.map((r) => {
            const isSelected = selectedRegionId === r.id;
            const area = activeAreas.find((a) => a.regionId === r.id || r.aliases.includes(a.regionId));
            const sev = area?.severity ?? 0;

            let badgeColor = 'bg-white/10 text-regolith/50';
            if (sev >= 7) badgeColor = 'bg-mars/20 text-mars border border-mars/40 font-bold';
            else if (sev >= 4) badgeColor = 'bg-[#e0b03a]/20 text-[#e0b03a] border border-[#e0b03a]/40 font-bold';
            else if (sev > 0) badgeColor = 'bg-earth/20 text-earth border border-earth/40 font-bold';

            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={readOnly}
                onClick={() => handleRegionClick(r.id)}
                className={`flex items-center justify-between rounded px-2 py-1 text-left text-[11px] transition-colors border ${
                  isSelected
                    ? 'border-earth bg-earth/10 text-white font-bold'
                    : 'border-transparent text-regolith/75 hover:bg-white/5 hover:text-white'
                } focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none`}
              >
                <span className="truncate mr-1">{r.label}</span>
                {sev > 0 ? (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] shrink-0 ${badgeColor}`}>
                    {sev}
                  </span>
                ) : (
                  <span className="text-[10px] text-regolith/40 shrink-0">·</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mandatory Attribution Credits Line */}
      <div className="pt-2 text-center text-[11px] text-regolith/50">
        3D model: Z-Anatomy and BodyParts3D, CC BY-SA. Modified.
      </div>
    </div>
  );
}

export default BodyMapProcedural;
