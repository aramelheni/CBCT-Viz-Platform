/**
 * CBCTViewer Component
 * 3D visualization of CBCT scans using Three.js and react-three-fiber
 * Adaptive rendering based on scan dimensions and system performance
 */

import React, { useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { MeshData } from '../services/api';
import { getAdaptiveViewConfig, ScanDimensions, AdaptiveViewConfig } from '../utils/adaptiveConfig';

export interface RenderingSettings {
  globalOpacity: number;
  meshQuality: 'low' | 'medium' | 'high';
  wireframe: boolean;
  preset: 'default' | 'bone' | 'soft_tissue' | 'transparent' | 'dental_structures' | 'enamel_focus' | 'root_canal' | 'pathology';
}

export interface SegmentSettings {
  [segmentName: string]: {
    opacity: number;
    smoothness: number;
    visible: boolean;
  };
}

export interface MPRSlicePositions {
  axial: number;
  coronal: number;
  sagittal: number;
  dimensions: [number, number, number];
}

interface VolumeRendererProps {
  volumeData?: number[][][];
  segments?: MeshData[];
  visibleSegments?: string[];
  colorMap?: { [key: string]: string };
  renderingSettings?: RenderingSettings;
  segmentSettings?: SegmentSettings;
  mprSlices?: MPRSlicePositions;
  viewConfig: AdaptiveViewConfig;
}

const VolumeRenderer: React.FC<VolumeRendererProps> = ({
  volumeData,
  segments,
  visibleSegments = [],
  colorMap = {},
  renderingSettings,
  segmentSettings,
  mprSlices,
  viewConfig,
}) => {
  useFrame(() => {
    // Optional: Add animations or updates here
  });

  useEffect(() => {
    console.log('VolumeRenderer: segments=', segments?.length, 'visible=', visibleSegments.length);
  }, [segments, visibleSegments]);

  if (!volumeData && (!segments || segments.length === 0)) {
    console.log('VolumeRenderer: No data to render');
    return null;
  }

  return (
    <group>
      {/* Render volume data if available */}
      {volumeData && (
        <VolumeSlices volumeData={volumeData} />
      )}

      {/* Render MPR slice planes */}
      {mprSlices && (
        <MPRSlicePlanes mprSlices={mprSlices} />
      )}

      {/* Render segmented meshes */}
      {segments && segments.map((mesh) => {
        const isVisible = visibleSegments.includes(mesh.segment_name);
        console.log(`Segment ${mesh.segment_name}: visible=${isVisible}`);
        return isVisible ? (
          <SegmentMesh
            key={mesh.segment_name}
            mesh={mesh}
            color={colorMap[mesh.segment_name] || '#ffffff'}
            renderingSettings={renderingSettings}
            segmentSettings={segmentSettings?.[mesh.segment_name]}
            viewConfig={viewConfig}
          />
        ) : null;
      })}
    </group>
  );
};

interface SegmentMeshProps {
  mesh: MeshData;
  color: string;
  renderingSettings?: RenderingSettings;
  segmentSettings?: {
    opacity: number;
    smoothness: number;
    visible: boolean;
  };
  viewConfig: AdaptiveViewConfig;
}

const SegmentMesh: React.FC<SegmentMeshProps> = ({ mesh, color, renderingSettings, segmentSettings, viewConfig }) => {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    
    // Convert mesh data to Three.js geometry
    const vertices = new Float32Array(mesh.vertices.flat());
    const indices = new Uint32Array(mesh.faces.flat());
    const normals = mesh.normals ? new Float32Array(mesh.normals.flat()) : undefined;
    
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    
    if (normals) {
      geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      geom.computeVertexNormals();
    }

    // Center the geometry
    geom.computeBoundingBox();
    const center = new THREE.Vector3();
    geom.boundingBox?.getCenter(center);
    geom.translate(-center.x, -center.y, -center.z);
    
    return geom;
  }, [mesh.vertices, mesh.faces, mesh.normals]);

  useEffect(() => {
    console.log(`Rendering segment: ${mesh.segment_name}, vertices: ${mesh.vertices.length}, faces: ${mesh.faces.length}`);
  }, [mesh]);

  // Calculate final opacity: segment-specific overrides global
  const segmentOpacity = segmentSettings?.opacity ?? 0.85;
  const globalOpacity = renderingSettings?.globalOpacity ?? 1.0;
  const finalOpacity = segmentOpacity * globalOpacity;

  // Apply smoothness setting
  const smoothness = segmentSettings?.smoothness ?? 50;
  const flatShading = smoothness < 30; // Use flat shading for low smoothness

  // Apply preset-based adjustments
  const getPresetAdjustments = () => {
    const baseRoughness = viewConfig.materialDefaults.roughnessBase + 
      ((100 - smoothness) / viewConfig.materialDefaults.roughnessFactor);
    
    switch (renderingSettings?.preset) {
      case 'bone':
        return { roughness: Math.min(0.9, baseRoughness + 0.5), metalness: 0.1 };
      case 'soft_tissue':
        return { roughness: Math.max(0.1, baseRoughness - 0.2), metalness: 0.0 };
      case 'transparent':
        return { roughness: Math.max(0.1, baseRoughness - 0.1), metalness: 0.1 };
      default:
        return { roughness: baseRoughness, metalness: 0.2 };
    }
  };

  const { roughness, metalness } = getPresetAdjustments();

  // Apply mesh quality (affects rendering quality, not geometry since backend provides meshes)
  const meshQuality = renderingSettings?.meshQuality || 'medium';
  const qualitySettings = {
    low: { polygonOffsetFactor: 1, polygonOffsetUnits: 1 },
    medium: { polygonOffsetFactor: 0, polygonOffsetUnits: 0 },
    high: { polygonOffsetFactor: -1, polygonOffsetUnits: -1 }
  };
  const qualityOffset = qualitySettings[meshQuality];

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        side={THREE.DoubleSide}
        transparent
        opacity={finalOpacity}
        roughness={roughness}
        metalness={metalness}
        envMapIntensity={viewConfig.materialDefaults.envMapIntensity}
        wireframe={renderingSettings?.wireframe || false}
        flatShading={flatShading}
        polygonOffset={true}
        polygonOffsetFactor={qualityOffset.polygonOffsetFactor}
        polygonOffsetUnits={qualityOffset.polygonOffsetUnits}
      />
    </mesh>
  );
};

interface VolumeSlicesProps {
  volumeData: number[][][];
}

const VolumeSlices: React.FC<VolumeSlicesProps> = ({ volumeData }) => {
  // Render a representative slice of the volume
  const [depth, height, width] = [
    volumeData.length,
    volumeData[0]?.length || 0,
    volumeData[0]?.[0]?.length || 0,
  ];

  const centerSlice = Math.floor(depth / 2);
  const sliceData = volumeData[centerSlice];

  // Create texture from slice data
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (ctx && sliceData) {
    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = Math.floor(sliceData[y][x] * 255);
        const index = (y * width + x) * 4;
        imageData.data[index] = value;
        imageData.data[index + 1] = value;
        imageData.data[index + 2] = value;
        imageData.data[index + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[width / 10, height / 10]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
};

interface MPRSlicePlanesProps {
  mprSlices: MPRSlicePositions;
}

const MPRSlicePlanes: React.FC<MPRSlicePlanesProps> = ({ mprSlices }) => {
  const { axial, coronal, sagittal, dimensions } = mprSlices;
  const [width, height, depth] = dimensions;

  // Calculate normalized positions (-50 to +50 space)
  const scale = 0.5; // Scaling factor for visualization
  const axialZ = (axial / depth - 0.5) * depth * scale;
  const coronalY = (coronal / height - 0.5) * height * scale;
  const sagittalX = (sagittal / width - 0.5) * width * scale;

  return (
    <group>
      {/* Axial plane (XY, moves in Z) - Blue */}
      <mesh position={[0, 0, axialZ]}>
        <planeGeometry args={[width * scale, height * scale]} />
        <meshBasicMaterial
          color="#3b82f6"
          opacity={0.3}
          transparent={true}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Coronal plane (XZ, moves in Y) - Green */}
      <mesh position={[0, coronalY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width * scale, depth * scale]} />
        <meshBasicMaterial
          color="#10b981"
          opacity={0.3}
          transparent={true}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Sagittal plane (YZ, moves in X) - Orange */}
      <mesh position={[sagittalX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth * scale, height * scale]} />
        <meshBasicMaterial
          color="#f59e0b"
          opacity={0.3}
          transparent={true}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

interface CBCTViewerProps {
  volumeData?: number[][][];
  segments?: MeshData[];
  visibleSegments?: string[];
  colorMap?: { [key: string]: string };
  renderingSettings?: RenderingSettings;
  segmentSettings?: SegmentSettings;
  mprSlices?: MPRSlicePositions;
}

const CBCTViewer: React.FC<CBCTViewerProps> = ({
  volumeData,
  segments,
  visibleSegments,
  colorMap,
  renderingSettings,
  segmentSettings,
  mprSlices,
}) => {
  // Calculate adaptive view configuration based on scan dimensions
  // Use stable dimensions to prevent infinite re-renders
  const scanDimensionsKey = useMemo(() => {
    if (mprSlices?.dimensions) {
      return mprSlices.dimensions.join(',');
    }
    return '128,128,128'; // Default
  }, [mprSlices?.dimensions]);

  const viewConfig = useMemo(() => {
    let scanDimensions: ScanDimensions = { width: 128, height: 128, depth: 128 }; // Default
    
    // Parse scanDimensionsKey to avoid accessing mprSlices.dimensions directly
    if (scanDimensionsKey !== '128,128,128') {
      const [depth, height, width] = scanDimensionsKey.split(',').map(Number);
      scanDimensions = { width, height, depth };
    }
    
    return getAdaptiveViewConfig(scanDimensions);
  }, [scanDimensionsKey]);

  useEffect(() => {
    if (segments && segments.length > 0) {
      console.log(`CBCTViewer: Rendering ${segments.length} segments, ${visibleSegments?.length || 0} visible`);
      console.log('Adaptive config:', viewConfig);
    }
  }, [segments, visibleSegments?.length, viewConfig]);

  return (
    <div className="w-full h-full viewer-container bg-gradient-to-b from-gray-800 to-gray-900">
      <Canvas 
        gl={{ 
          preserveDrawingBuffer: true, 
          antialias: true,
          alpha: false,
          premultipliedAlpha: false
        }}
      >
        <PerspectiveCamera 
          makeDefault 
          position={viewConfig.cameraPosition} 
          fov={viewConfig.cameraFOV} 
        />
        
        {/* Adaptive Lighting - Scales with scan size */}
        <ambientLight intensity={viewConfig.lightingIntensity.ambient} />
        <directionalLight 
          position={viewConfig.lightPositions.directional1} 
          intensity={viewConfig.lightingIntensity.directional} 
          castShadow 
        />
        <directionalLight 
          position={viewConfig.lightPositions.directional2} 
          intensity={viewConfig.lightingIntensity.directional * 0.7} 
        />
        <directionalLight 
          position={viewConfig.lightPositions.directional3} 
          intensity={viewConfig.lightingIntensity.directional * 0.3} 
        />
        <pointLight 
          position={viewConfig.lightPositions.point1} 
          intensity={viewConfig.lightingIntensity.point} 
        />
        <pointLight 
          position={viewConfig.lightPositions.point2} 
          intensity={viewConfig.lightingIntensity.point * 0.7} 
        />
        <hemisphereLight args={['#ffffff', '#444444', viewConfig.lightingIntensity.ambient * 0.8]} />
        
        {/* Adaptive Grid - Scales with scan size */}
        <Grid
          args={[viewConfig.gridSize, viewConfig.gridSize]}
          cellSize={viewConfig.gridCellSize}
          cellThickness={0.3}
          cellColor="#4a5568"
          sectionSize={Math.max(5, Math.floor(viewConfig.gridSize / 10))}
          sectionThickness={0.6}
          sectionColor="#5a67d8"
          fadeDistance={viewConfig.gridSize}
          fadeStrength={1}
          followCamera={false}
        />

        {/* Main volume/mesh renderer */}
        <VolumeRenderer
          volumeData={volumeData}
          segments={segments}
          visibleSegments={visibleSegments}
          colorMap={colorMap}
          renderingSettings={renderingSettings}
          segmentSettings={segmentSettings}
          mprSlices={mprSlices}
          viewConfig={viewConfig}
        />

        {/* Adaptive Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={viewConfig.minCameraDistance}
          maxDistance={viewConfig.maxCameraDistance}
        />
      </Canvas>
    </div>
  );
};

export default CBCTViewer;
