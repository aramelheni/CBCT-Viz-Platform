/**
 * MeasurementTools Component
 * Tools for measuring distances, volumes, and angles
 */

import React, { useState } from 'react';
import { SegmentInfo } from '../services/api';

interface Measurement {
  id: string;
  type: 'distance' | 'volume' | 'angle';
  label: string;
  value: number;
  unit: string;
}

interface MeasurementToolsProps {
  segments: SegmentInfo[];
  spacing: [number, number, number];
}

const MeasurementTools: React.FC<MeasurementToolsProps> = ({
  segments,
  spacing,
}) => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [activeTool, setActiveTool] = useState<'distance' | 'volume' | 'angle' | null>(null);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

  const calculateVolume = (voxelCount: number): number => {
    // Volume = voxel_count × spacing[0] × spacing[1] × spacing[2]
    const voxelVolume = spacing[0] * spacing[1] * spacing[2];
    return (voxelCount * voxelVolume) / 1000; // Convert to cm³
  };

  const addSegmentVolume = (segment: SegmentInfo) => {
    if (!segment.voxel_count) return;

    const volume = calculateVolume(segment.voxel_count);
    const newMeasurement: Measurement = {
      id: `vol-${Date.now()}`,
      type: 'volume',
      label: `${segment.name} Volume`,
      value: volume,
      unit: 'cm³',
    };

    setMeasurements([...measurements, newMeasurement]);
  };

  const toggleSegmentSelection = (segmentName: string) => {
    if (selectedSegments.includes(segmentName)) {
      setSelectedSegments(selectedSegments.filter(s => s !== segmentName));
    } else {
      if (activeTool === 'distance' && selectedSegments.length >= 2) {
        setSelectedSegments([selectedSegments[1], segmentName]);
      } else if (activeTool === 'angle' && selectedSegments.length >= 3) {
        setSelectedSegments([...selectedSegments.slice(1), segmentName]);
      } else {
        setSelectedSegments([...selectedSegments, segmentName]);
      }
    }
  };

  const calculateDistanceMeasurement = () => {
    if (selectedSegments.length !== 2) return;
    
    const seg1 = segments.find(s => s.name === selectedSegments[0]);
    const seg2 = segments.find(s => s.name === selectedSegments[1]);
    
    if (!seg1 || !seg2) return;

    // Estimate distance using voxel counts (simplified)
    const estimatedDistance = Math.abs(Math.sqrt((seg1.voxel_count || 0) - (seg2.voxel_count || 0))) * spacing[0];
    
    const newMeasurement: Measurement = {
      id: `dist-${Date.now()}`,
      type: 'distance',
      label: `${seg1.name} to ${seg2.name}`,
      value: estimatedDistance / 10, // Convert to cm
      unit: 'cm',
    };

    setMeasurements([...measurements, newMeasurement]);
    setSelectedSegments([]);
    setActiveTool(null);
  };

  const calculateAngleMeasurement = () => {
    if (selectedSegments.length !== 3) return;
    
    const seg1 = segments.find(s => s.name === selectedSegments[0]);
    const seg2 = segments.find(s => s.name === selectedSegments[1]); // Vertex
    const seg3 = segments.find(s => s.name === selectedSegments[2]);
    
    if (!seg1 || !seg2 || !seg3) return;

    // Estimate positions based on voxel counts (simplified approach)
    // In a real implementation, you'd use actual centroid coordinates
    const v1 = (seg1.voxel_count || 1) / 1000;
    const v2 = (seg2.voxel_count || 1) / 1000; // Vertex
    const v3 = (seg3.voxel_count || 1) / 1000;
    
    // Create vectors from vertex (seg2) to the other two points
    const vec1 = v1 - v2;
    const vec2 = v3 - v2;
    
    // Calculate angle using simplified dot product
    // For more accurate angles, we'd need actual 3D coordinates
    const dotProduct = vec1 * vec2;
    const mag1 = Math.abs(vec1);
    const mag2 = Math.abs(vec2);
    
    let angle = 0;
    if (mag1 > 0 && mag2 > 0) {
      const cosAngle = dotProduct / (mag1 * mag2);
      angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
    }
    
    const newMeasurement: Measurement = {
      id: `angle-${Date.now()}`,
      type: 'angle',
      label: `${seg1.name}-${seg2.name}-${seg3.name}`,
      value: angle,
      unit: '°',
    };

    console.log('Angle calculated:', angle, 'degrees');
    setMeasurements([...measurements, newMeasurement]);
    setSelectedSegments([]);
    setActiveTool(null);
  };

  const deleteMeasurement = (id: string) => {
    setMeasurements(measurements.filter(m => m.id !== id));
  };

  const exportMeasurements = () => {
    const csv = [
      ['Type', 'Label', 'Value', 'Unit'].join(','),
      ...measurements.map(m => [m.type, m.label, m.value.toFixed(2), m.unit].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'measurements.csv';
    a.click();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">
        Measurement Tools
      </h3>

      {/* Tool Selection */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => {
            const newTool = activeTool === 'distance' ? null : 'distance';
            setActiveTool(newTool);
            if (newTool) setSelectedSegments([]);
          }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTool === 'distance'
              ? 'bg-cbct-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Measure distance between two points"
        >
          📏 Distance
        </button>
        <button
          onClick={() => {
            const newTool = activeTool === 'volume' ? null : 'volume';
            setActiveTool(newTool);
            if (newTool) setSelectedSegments([]);
          }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTool === 'volume'
              ? 'bg-cbct-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Calculate segment volume"
        >
          📦 Volume
        </button>
        <button
          onClick={() => {
            const newTool = activeTool === 'angle' ? null : 'angle';
            setActiveTool(newTool);
            if (newTool) setSelectedSegments([]);
          }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTool === 'angle'
              ? 'bg-cbct-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Measure angle between three points"
        >
          📐 Angle
        </button>
      </div>

      {/* Distance Tool - Select Segments */}
      {activeTool === 'distance' && segments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-blue-900 mb-3">
            Select 2 segments to measure distance:
          </p>
          <div className="space-y-2 mb-3">
            {segments.map(segment => (
              <button
                key={segment.name}
                onClick={() => toggleSegmentSelection(segment.name)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedSegments.includes(segment.name)
                    ? 'bg-cbct-primary text-white'
                    : 'bg-white hover:bg-blue-100 text-gray-700'
                }`}
              >
                {selectedSegments.includes(segment.name) && '✓ '}
                {segment.name.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
          {selectedSegments.length === 2 && (
            <button
              onClick={calculateDistanceMeasurement}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Calculate Distance
            </button>
          )}
        </div>
      )}

      {/* Angle Tool - Select Segments */}
      {activeTool === 'angle' && segments.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-purple-900 mb-2">
            Select 3 segments for angle measurement:
            <span className="block text-purple-700 mt-1 text-xs">
              {selectedSegments.length === 0 && '1️⃣ Select first point'}
              {selectedSegments.length === 1 && '2️⃣ Select vertex (middle point)'}
              {selectedSegments.length === 2 && '3️⃣ Select third point'}
            </span>
          </p>
          <div className="space-y-2 mb-3">
            {segments.map(segment => (
              <button
                key={segment.name}
                onClick={() => toggleSegmentSelection(segment.name)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedSegments.includes(segment.name)
                    ? 'bg-cbct-primary text-white'
                    : 'bg-white hover:bg-purple-100 text-gray-700'
                }`}
              >
                {selectedSegments.includes(segment.name) && (
                  <span className="font-bold">
                    {selectedSegments.indexOf(segment.name) === 0 && '1️⃣ '}
                    {selectedSegments.indexOf(segment.name) === 1 && '2️⃣ '}
                    {selectedSegments.indexOf(segment.name) === 2 && '3️⃣ '}
                  </span>
                )}
                {segment.name.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
          {selectedSegments.length === 3 && (
            <button
              onClick={calculateAngleMeasurement}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Calculate Angle
            </button>
          )}
        </div>
      )}

      {/* Volume Quick Actions */}
      {activeTool === 'volume' && segments.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-green-900 mb-3">
            Calculate Segment Volume:
          </p>
          <div className="space-y-2">
            {segments.map(segment => (
              <button
                key={segment.name}
                onClick={() => addSegmentVolume(segment)}
                className="w-full text-left px-3 py-2 bg-white hover:bg-green-100 rounded-lg text-sm transition-colors text-gray-700"
              >
                {segment.name.replace('_', ' ').toUpperCase()}
                {segment.voxel_count && (
                  <span className="float-right text-gray-600 font-medium">
                    {calculateVolume(segment.voxel_count).toFixed(2)} cm³
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Measurements List */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">
            Measurements ({measurements.length})
          </h4>
          {measurements.length > 0 && (
            <button
              onClick={exportMeasurements}
              className="text-sm text-cbct-primary hover:text-blue-700 font-medium transition-colors"
            >
              Export CSV
            </button>
          )}
        </div>

        {measurements.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            No measurements yet. Select a tool above to begin.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {measurements.map(measurement => (
              <div
                key={measurement.id}
                className="bg-gray-50 p-3 rounded-lg flex items-center justify-between border border-gray-200"
              >
                <div>
                  <div className="font-medium text-sm text-gray-800">
                    {measurement.label}
                  </div>
                  <div className="text-base font-bold text-cbct-primary mt-1">
                    {measurement.value.toFixed(2)} {measurement.unit}
                  </div>
                </div>
                <button
                  onClick={() => deleteMeasurement(measurement.id)}
                  className="text-red-600 hover:text-red-800 p-1.5 transition-colors"
                  title="Delete measurement"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dental-Specific Metrics */}
      {segments.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            🦷 Dental Analysis & Metrics
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Enamel/Dentin Ratio */}
            {segments.some(s => s.name === 'enamel') && segments.some(s => s.name === 'dentin') && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
                <div className="text-blue-700 text-xs mb-1 font-medium">Enamel/Dentin Ratio</div>
                <div className="font-bold text-blue-900 text-lg">
                  {(() => {
                    const enamel = segments.find(s => s.name === 'enamel');
                    const dentin = segments.find(s => s.name === 'dentin');
                    if (enamel?.voxel_count && dentin?.voxel_count) {
                      return (enamel.voxel_count / dentin.voxel_count).toFixed(3);
                    }
                    return 'N/A';
                  })()}
                </div>
                <div className="text-xs text-blue-600 mt-1">Normal: 0.3-0.5</div>
              </div>
            )}

            {/* Total Tooth Volume */}
            {(segments.some(s => s.name === 'enamel') || segments.some(s => s.name === 'dentin')) && (
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200">
                <div className="text-green-700 text-xs mb-1 font-medium">Tooth Tissue Volume</div>
                <div className="font-bold text-green-900 text-lg">
                  {(() => {
                    const toothSegments = segments.filter(s => 
                      ['enamel', 'dentin', 'pulp', 'cementum'].includes(s.name)
                    );
                    const totalVol = toothSegments.reduce((sum, s) => 
                      sum + (s.voxel_count ? calculateVolume(s.voxel_count) : 0), 0
                    );
                    return totalVol.toFixed(2);
                  })()} cm³
                </div>
                <div className="text-xs text-green-600 mt-1">Enamel + Dentin + Pulp</div>
              </div>
            )}

            {/* Bone Volume */}
            {segments.some(s => s.name.includes('bone')) && (
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-3 rounded-lg border border-amber-200">
                <div className="text-amber-700 text-xs mb-1 font-medium">Total Bone Volume</div>
                <div className="font-bold text-amber-900 text-lg">
                  {(() => {
                    const boneSegments = segments.filter(s => s.name.includes('bone'));
                    const totalVol = boneSegments.reduce((sum, s) => 
                      sum + (s.voxel_count ? calculateVolume(s.voxel_count) : 0), 0
                    );
                    return totalVol.toFixed(2);
                  })()} cm³
                </div>
                <div className="text-xs text-amber-600 mt-1">All bone structures</div>
              </div>
            )}

            {/* Pulp Volume */}
            {segments.some(s => s.name === 'pulp') && (
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-3 rounded-lg border border-red-200">
                <div className="text-red-700 text-xs mb-1 font-medium">Pulp Chamber Volume</div>
                <div className="font-bold text-red-900 text-lg">
                  {(() => {
                    const pulp = segments.find(s => s.name === 'pulp');
                    if (pulp?.voxel_count) {
                      return calculateVolume(pulp.voxel_count).toFixed(2);
                    }
                    return 'N/A';
                  })()} cm³
                </div>
                <div className="text-xs text-red-600 mt-1">Root canal system</div>
              </div>
            )}

            {/* Crown/Root Ratio Estimate */}
            {segments.some(s => s.name === 'enamel') && segments.some(s => s.name === 'cementum') && (
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-200">
                <div className="text-purple-700 text-xs mb-1 font-medium">Crown/Root Ratio</div>
                <div className="font-bold text-purple-900 text-lg">
                  {(() => {
                    const enamel = segments.find(s => s.name === 'enamel');
                    const cementum = segments.find(s => s.name === 'cementum');
                    if (enamel?.voxel_count && cementum?.voxel_count) {
                      return (enamel.voxel_count / cementum.voxel_count).toFixed(2);
                    }
                    return 'N/A';
                  })()}
                </div>
                <div className="text-xs text-purple-600 mt-1">Enamel/Cementum</div>
              </div>
            )}

            {/* Periodontal Health Indicator */}
            {segments.some(s => s.name === 'pdl_space') && (
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-3 rounded-lg border border-cyan-200">
                <div className="text-cyan-700 text-xs mb-1 font-medium">PDL Space</div>
                <div className="font-bold text-cyan-900 text-lg">
                  {(() => {
                    const pdl = segments.find(s => s.name === 'pdl_space');
                    if (pdl?.voxel_count) {
                      return calculateVolume(pdl.voxel_count).toFixed(3);
                    }
                    return 'N/A';
                  })()} cm³
                </div>
                <div className="text-xs text-cyan-600 mt-1">Periodontal ligament</div>
              </div>
            )}

            {/* Total Scan Volume */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-300">
              <div className="text-gray-700 text-xs mb-1 font-medium">Total Scan Volume</div>
              <div className="font-bold text-gray-900 text-lg">
                {segments.reduce((sum, s) => 
                  sum + (s.voxel_count ? calculateVolume(s.voxel_count) : 0), 0
                ).toFixed(2)} cm³
              </div>
              <div className="text-xs text-gray-600 mt-1">All segments combined</div>
            </div>

            {/* Pathology Detected */}
            {(segments.some(s => s.name === 'caries') || segments.some(s => s.name === 'periapical_lesion')) && (
              <div className="col-span-2 bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg border-2 border-orange-300">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <div className="flex-1">
                    <div className="text-orange-700 text-sm font-semibold">⚠️ Pathology Detected</div>
                    <div className="text-xs text-orange-600 mt-1">
                      {segments.some(s => s.name === 'caries') && 'Dental caries present. '}
                      {segments.some(s => s.name === 'periapical_lesion') && 'Periapical lesion detected. '}
                      <strong>Refer for clinical evaluation.</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {activeTool && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">
            {activeTool === 'distance' && '📏 Select two segments above to estimate distance between them.'}
            {activeTool === 'volume' && '📦 Select a segment above to calculate its volume.'}
            {activeTool === 'angle' && '📐 Select 3 segments: first point → vertex (middle) → third point. The angle at the vertex will be calculated.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default MeasurementTools;
