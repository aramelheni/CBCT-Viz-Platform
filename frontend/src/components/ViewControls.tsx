/**
 * ViewControls Component
 * Quick view presets and camera controls similar to spine platform
 */

import React from 'react';

interface ViewControlsProps {
  onViewChange: (view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom') => void;
  onResetView: () => void;
}

const ViewControls: React.FC<ViewControlsProps> = ({ onViewChange, onResetView }) => {
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-lg shadow-lg p-3">
      <div className="flex items-center space-x-2">
        {/* View Preset Buttons */}
        <div className="flex space-x-1">
          <button
            onClick={() => onViewChange('front')}
            className="px-3 py-2 bg-gray-700 hover:bg-blue-600 text-white text-xs rounded transition-colors"
            title="Front View"
          >
            Front
          </button>
          <button
            onClick={() => onViewChange('right')}
            className="px-3 py-2 bg-gray-700 hover:bg-blue-600 text-white text-xs rounded transition-colors"
            title="Right View"
          >
            Right
          </button>
          <button
            onClick={() => onViewChange('top')}
            className="px-3 py-2 bg-gray-700 hover:bg-blue-600 text-white text-xs rounded transition-colors"
            title="Top View"
          >
            Top
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-600"></div>

        {/* Reset Button */}
        <button
          onClick={onResetView}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors font-medium"
          title="Reset Camera"
        >
          Reset View
        </button>

        {/* Info Icons */}
        <div className="flex items-center space-x-2 ml-2 text-gray-400 text-xs">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            Rotate
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            Zoom
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewControls;
