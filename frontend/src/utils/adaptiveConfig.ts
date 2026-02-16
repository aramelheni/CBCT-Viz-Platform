/**
 * Adaptive Configuration Utility
 * Calculates optimal rendering parameters based on scan dimensions and system performance
 */

export interface ScanDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface AdaptiveViewConfig {
  cameraPosition: [number, number, number];
  cameraFOV: number;
  gridSize: number;
  gridCellSize: number;
  minCameraDistance: number;
  maxCameraDistance: number;
  lightingIntensity: {
    ambient: number;
    directional: number;
    point: number;
  };
  lightPositions: {
    directional1: [number, number, number];
    directional2: [number, number, number];
    directional3: [number, number, number];
    point1: [number, number, number];
    point2: [number, number, number];
  };
  materialDefaults: {
    envMapIntensity: number;
    roughnessBase: number;
    roughnessFactor: number;
  };
}

export interface AdaptiveSegmentationConfig {
  meshQuality: 'low' | 'medium' | 'high';
  recommendedOpacity: number;
  smoothness: number;
}

/**
 * Calculate optimal camera position based on scan dimensions
 */
export function calculateCameraPosition(dimensions: ScanDimensions): [number, number, number] {
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth);
  const scaleFactor = maxDim / 128; // Normalize to typical 128³ scan
  
  const baseDistance = 100;
  const distance = baseDistance * scaleFactor;
  
  return [distance, distance, distance];
}

/**
 * Calculate optimal field of view
 */
export function calculateFOV(dimensions: ScanDimensions): number {
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth);
  
  if (maxDim > 512) return 60; // Wide FOV for large scans
  if (maxDim > 256) return 55;
  if (maxDim > 128) return 50;
  return 45; // Narrow FOV for small scans
}

/**
 * Calculate grid parameters
 */
export function calculateGridConfig(dimensions: ScanDimensions): { size: number; cellSize: number } {
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth);
  const scaleFactor = maxDim / 128;
  
  return {
    size: Math.ceil(150 * scaleFactor),
    cellSize: Math.max(1, scaleFactor)
  };
}

/**
 * Calculate camera distance limits
 */
export function calculateCameraLimits(dimensions: ScanDimensions): { min: number; max: number } {
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth);
  const scaleFactor = maxDim / 128;
  
  return {
    min: Math.max(5, 10 * scaleFactor),
    max: Math.min(500, 200 * scaleFactor)
  };
}

/**
 * Calculate optimal lighting intensity based on scan size
 */
export function calculateLightingIntensity(dimensions: ScanDimensions): AdaptiveViewConfig['lightingIntensity'] {
  const voxelCount = dimensions.width * dimensions.height * dimensions.depth;
  
  // Larger scans need more lighting to illuminate complex structures
  if (voxelCount > 100_000_000) {
    return { ambient: 0.5, directional: 1.4, point: 0.7 };
  } else if (voxelCount > 20_000_000) {
    return { ambient: 0.4, directional: 1.2, point: 0.6 };
  } else {
    return { ambient: 0.3, directional: 1.0, point: 0.5 };
  }
}

/**
 * Calculate adaptive light positions based on scan dimensions
 */
export function calculateLightPositions(dimensions: ScanDimensions): AdaptiveViewConfig['lightPositions'] {
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth);
  const scaleFactor = maxDim / 128;
  
  // Scale all light positions proportionally to scan size
  const baseDirectionalDist = 10 * scaleFactor;
  const basePointDist = 50 * scaleFactor;
  
  return {
    directional1: [baseDirectionalDist, baseDirectionalDist, baseDirectionalDist],
    directional2: [-baseDirectionalDist, baseDirectionalDist, -baseDirectionalDist * 0.5],
    directional3: [0, -baseDirectionalDist, baseDirectionalDist * 0.5],
    point1: [basePointDist, basePointDist, basePointDist],
    point2: [-basePointDist, basePointDist, -basePointDist]
  };
}

/**
 * Calculate material defaults based on scan characteristics
 */
export function calculateMaterialDefaults(dimensions: ScanDimensions): AdaptiveViewConfig['materialDefaults'] {
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth);
  
  // Adjust environment map intensity based on scan size
  const envMapIntensity = maxDim > 256 ? 0.6 : maxDim > 128 ? 0.5 : 0.4;
  
  return {
    envMapIntensity,
    roughnessBase: 0.3,
    roughnessFactor: 200 // Used in smoothness calculation
  };
}

/**
 * Get complete adaptive view configuration
 */
export function getAdaptiveViewConfig(dimensions: ScanDimensions): AdaptiveViewConfig {
  const cameraLimits = calculateCameraLimits(dimensions);
  const gridConfig = calculateGridConfig(dimensions);
  
  return {
    cameraPosition: calculateCameraPosition(dimensions),
    cameraFOV: calculateFOV(dimensions),
    gridSize: gridConfig.size,
    gridCellSize: gridConfig.cellSize,
    minCameraDistance: cameraLimits.min,
    maxCameraDistance: cameraLimits.max,
    lightingIntensity: calculateLightingIntensity(dimensions),
    lightPositions: calculateLightPositions(dimensions),
    materialDefaults: calculateMaterialDefaults(dimensions)
  };
}

/**
 * Recommend mesh quality based on voxel count and estimated system performance
 */
export function recommendMeshQuality(voxelCount: number): 'low' | 'medium' | 'high' {
  // Estimate based on available memory
  const memory = (performance as any).memory?.jsHeapSizeLimit || 2_000_000_000; // Default 2GB
  
  // Consider both voxel count and available memory
  if (voxelCount > 50_000_000 || memory < 1_500_000_000) {
    return 'low'; // Large scans or low memory: prioritize performance
  } else if (voxelCount > 10_000_000 || memory < 3_000_000_000) {
    return 'medium'; // Medium scans or medium memory: balanced
  } else {
    return 'high'; // Small scans with good memory: max quality
  }
}

/**
 * Calculate window/level presets based on actual data range
 */
export function calculateWindowPresets(minHU: number, maxHU: number): {
  default: { center: number; width: number };
  bone: { center: number; width: number };
  soft_tissue: { center: number; width: number };
} {
  const range = maxHU - minHU;
  const midpoint = minHU + range / 2;
  
  return {
    default: {
      center: Math.round(midpoint),
      width: Math.round(range * 0.8)
    },
    bone: {
      center: Math.round(Math.max(400, midpoint + range * 0.2)),
      width: Math.round(Math.max(1500, range * 0.6))
    },
    soft_tissue: {
      center: Math.round(Math.min(100, midpoint - range * 0.3)),
      width: Math.round(Math.max(300, range * 0.3))
    }
  };
}
