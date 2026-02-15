/**
 * SegmentControls Component
 * Panel for controlling visibility of individual dental segments
 */

import React from 'react';
import { SegmentInfo } from '../services/api';

interface SegmentControlsProps {
  segments: SegmentInfo[];
  visibleSegments: string[];
  onToggleSegment: (segmentName: string) => void;
  onSegmentClick?: (segmentName: string) => void;
}

const SegmentControls: React.FC<SegmentControlsProps> = ({
  segments,
  visibleSegments,
  onToggleSegment,
  onSegmentClick,
}) => {
  const formatVoxelCount = (count?: number) => {
    if (!count) return 'N/A';
    if (count > 1000000) return `${(count / 1000000).toFixed(2)}M`;
    if (count > 1000) return `${(count / 1000).toFixed(2)}K`;
    return count.toString();
  };

  const formatSegmentName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 control-panel">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Dental Segments
      </h3>

      {segments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>No segments available</p>
          <p className="text-sm mt-1">Click "Segment" to analyze the CBCT scan</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {segments.map((segment) => {
            const isVisible = visibleSegments.includes(segment.name);

            return (
              <div
                key={segment.name}
                className={`
                  segment-item p-3 rounded-lg border-2 cursor-pointer
                  ${isVisible ? 'border-cbct-primary bg-blue-50' : 'border-gray-200 bg-white'}
                  hover:shadow-md transition-all
                `}
                onClick={() => onSegmentClick && onSegmentClick(segment.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    {/* Color indicator */}
                    <div
                      className="w-6 h-6 rounded border-2 border-gray-300"
                      style={{ backgroundColor: segment.color }}
                    />

                    {/* Segment info */}
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">
                        {formatSegmentName(segment.name)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatVoxelCount(segment.voxel_count)} voxels
                      </div>
                    </div>
                  </div>

                  {/* Toggle button */}
                  <button
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full
                      transition-colors focus:outline-none focus:ring-2 focus:ring-cbct-primary focus:ring-offset-2
                      ${isVisible ? 'bg-cbct-primary' : 'bg-gray-200'}
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSegment(segment.name);
                    }}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${isVisible ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Control buttons */}
      {segments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
          <button
            className="w-full px-4 py-2 bg-cbct-primary text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            onClick={() => segments.forEach(seg => {
              if (!visibleSegments.includes(seg.name)) {
                onToggleSegment(seg.name);
              }
            })}
          >
            Show All
          </button>
          <button
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
            onClick={() => segments.forEach(seg => {
              if (visibleSegments.includes(seg.name)) {
                onToggleSegment(seg.name);
              }
            })}
          >
            Hide All
          </button>
        </div>
      )}
    </div>
  );
};

export default SegmentControls;
