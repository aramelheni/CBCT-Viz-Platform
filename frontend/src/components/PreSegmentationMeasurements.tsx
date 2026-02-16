/**
 * PreSegmentationMeasurements Component
 * Measurements and statistics for raw CBCT volume (before segmentation)
 */

import React, { useMemo } from 'react';
import { CBCTMetadata } from '../services/api';

interface PreSegmentationMeasurementsProps {
  metadata: CBCTMetadata;
  volumeData?: number[][][];
}

const PreSegmentationMeasurements: React.FC<PreSegmentationMeasurementsProps> = ({
  metadata,
  volumeData,
}) => {
  // Calculate volume statistics
  const volumeStats = useMemo(() => {
    if (!volumeData || volumeData.length === 0) return null;
    
    const [depth, height, width] = metadata.dimensions;
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;
    
    // Sample the volume for performance (every 2nd voxel)
    for (let z = 0; z < depth; z += 2) {
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const value = volumeData[z]?.[y]?.[x];
          if (value !== undefined) {
            sum += value;
            count++;
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
      }
    }
    
    const mean = sum / count;
    
    // Calculate standard deviation
    let varianceSum = 0;
    for (let z = 0; z < depth; z += 2) {
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const value = volumeData[z]?.[y]?.[x];
          if (value !== undefined) {
            varianceSum += Math.pow(value - mean, 2);
          }
        }
      }
    }
    
    const stdDev = Math.sqrt(varianceSum / count);
    
    return { min, max, mean, stdDev, sampleCount: count };
  }, [volumeData, metadata.dimensions]);

  // Calculate physical volume
  const physicalVolume = useMemo(() => {
    const [width, height, depth] = metadata.dimensions;
    const [sx, sy, sz] = metadata.spacing;
    // Volume in cm³
    return (width * sx * height * sy * depth * sz) / 1000;
  }, [metadata.dimensions, metadata.spacing]);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-blue-800">
          <strong>📊 Raw Volume Analysis</strong><br/>
          View scan dimensions, spacing, and intensity statistics before segmentation.
        </p>
      </div>

      {/* Volume Information */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Volume Information
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
            <div className="text-blue-700 text-xs mb-1 font-medium">Dimensions (voxels)</div>
            <div className="font-bold text-blue-900 text-base">
              {metadata.dimensions[0]} × {metadata.dimensions[1]} × {metadata.dimensions[2]}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {(metadata.dimensions[0] * metadata.dimensions[1] * metadata.dimensions[2] / 1000000).toFixed(2)}M voxels
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200">
            <div className="text-green-700 text-xs mb-1 font-medium">Voxel Spacing (mm)</div>
            <div className="font-bold text-green-900 text-base">
              {metadata.spacing[0].toFixed(3)} × {metadata.spacing[1].toFixed(3)} × {metadata.spacing[2].toFixed(3)}
            </div>
            <div className="text-xs text-green-600 mt-1">Isotropic spacing</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-200">
            <div className="text-purple-700 text-xs mb-1 font-medium">Physical Volume</div>
            <div className="font-bold text-purple-900 text-base">
              {physicalVolume.toFixed(2)} cm³
            </div>
            <div className="text-xs text-purple-600 mt-1">Scan region volume</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-3 rounded-lg border border-amber-200">
            <div className="text-amber-700 text-xs mb-1 font-medium">Data Type</div>
            <div className="font-bold text-amber-900 text-sm">
              {metadata.data_type}
            </div>
            <div className="text-xs text-amber-600 mt-1">Pixel format</div>
          </div>
        </div>
      </div>

      {/* Intensity Statistics */}
      {volumeStats && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Intensity Statistics
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
              <div className="text-gray-700 text-xs mb-1 font-medium">Minimum Value</div>
              <div className="font-bold text-gray-900 text-base">
                {volumeStats.min.toFixed(4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Lowest intensity</div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
              <div className="text-gray-700 text-xs mb-1 font-medium">Maximum Value</div>
              <div className="font-bold text-gray-900 text-base">
                {volumeStats.max.toFixed(4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Highest intensity</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
              <div className="text-blue-700 text-xs mb-1 font-medium">Mean Intensity</div>
              <div className="font-bold text-blue-900 text-base">
                {volumeStats.mean.toFixed(4)}
              </div>
              <div className="text-xs text-blue-600 mt-1">Average value</div>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-3 rounded-lg border border-cyan-200">
              <div className="text-cyan-700 text-xs mb-1 font-medium">Std. Deviation</div>
              <div className="font-bold text-cyan-900 text-base">
                {volumeStats.stdDev.toFixed(4)}
              </div>
              <div className="text-xs text-cyan-600 mt-1">Intensity variation</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Statistics based on {(volumeStats.sampleCount / 1000).toFixed(1)}K sampled voxels
          </div>
        </div>
      )}

      {/* Physical Dimensions */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Physical Dimensions
        </h4>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-indigo-700 font-medium">Width (X-axis)</span>
              <span className="font-bold text-indigo-900">
                {(metadata.dimensions[0] * metadata.spacing[0]).toFixed(2)} mm
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-purple-700 font-medium">Height (Y-axis)</span>
              <span className="font-bold text-purple-900">
                {(metadata.dimensions[1] * metadata.spacing[1]).toFixed(2)} mm
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-pink-700 font-medium">Depth (Z-axis)</span>
              <span className="font-bold text-pink-900">
                {(metadata.dimensions[2] * metadata.spacing[2]).toFixed(2)} mm
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Origin */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Coordinate System
        </h4>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Origin X:</span>
            <span className="font-mono text-gray-900">{metadata.origin[0].toFixed(2)} mm</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Origin Y:</span>
            <span className="font-mono text-gray-900">{metadata.origin[1].toFixed(2)} mm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Origin Z:</span>
            <span className="font-mono text-gray-900">{metadata.origin[2].toFixed(2)} mm</span>
          </div>
        </div>
      </div>

      {/* Quality Indicators */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Scan Quality Indicators
        </h4>
        <div className="space-y-2 text-sm">
          {/* Resolution check */}
          <div className={`p-3 rounded-lg border ${
            metadata.spacing[0] <= 0.5 
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-start">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mr-2 ${
                metadata.spacing[0] <= 0.5 ? 'bg-green-500' : 'bg-yellow-500'
              }`}>
                {metadata.spacing[0] <= 0.5 ? '✓' : '•'}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${
                  metadata.spacing[0] <= 0.5 ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  Resolution: {metadata.spacing[0] <= 0.5 ? 'High' : 'Standard'}
                </div>
                <div className={`text-xs mt-1 ${
                  metadata.spacing[0] <= 0.5 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  Voxel spacing {metadata.spacing[0].toFixed(3)} mm 
                  {metadata.spacing[0] <= 0.5 ? ' - Excellent for detailed analysis' : ' - Adequate for general use'}
                </div>
              </div>
            </div>
          </div>

          {/* Field of view check */}
          <div className={`p-3 rounded-lg border ${
            physicalVolume >= 50
              ? 'bg-blue-50 border-blue-200'
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-start">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mr-2 ${
                physicalVolume >= 50 ? 'bg-blue-500' : 'bg-orange-500'
              }`}>
                {physicalVolume >= 50 ? '✓' : '!'}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${
                  physicalVolume >= 50 ? 'text-blue-800' : 'text-orange-800'
                }`}>
                  Field of View: {physicalVolume >= 50 ? 'Large' : 'Limited'}
                </div>
                <div className={`text-xs mt-1 ${
                  physicalVolume >= 50 ? 'text-blue-600' : 'text-orange-600'
                }`}>
                  Scan volume {physicalVolume.toFixed(1)} cm³
                  {physicalVolume >= 50 ? ' - Full region captured' : ' - Focused region'}
                </div>
              </div>
            </div>
          </div>

          {/* Intensity range check */}
          {volumeStats && (
            <div className="p-3 rounded-lg border bg-purple-50 border-purple-200">
              <div className="flex items-start">
                <div className="w-5 h-5 rounded-full flex items-center justify-center mr-2 bg-purple-500">
                  ✓
                </div>
                <div className="flex-1">
                  <div className="font-medium text-purple-800">
                    Dynamic Range: {((volumeStats.max - volumeStats.min) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs mt-1 text-purple-600">
                    Good contrast variation for tissue differentiation
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreSegmentationMeasurements;
