/**
 * AdvancedControls Component
 * Advanced 3D visualization controls: opacity, smoothness, quality, presets
 */

import React from 'react';

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

interface AdvancedControlsProps {
  renderingSettings: RenderingSettings;
  onRenderingChange: (settings: Partial<RenderingSettings>) => void;
  segmentSettings: SegmentSettings;
  onSegmentSettingChange: (segmentName: string, setting: string, value: number) => void;
  segments: string[];
}

const AdvancedControls: React.FC<AdvancedControlsProps> = ({
  renderingSettings,
  onRenderingChange,
  segmentSettings,
  onSegmentSettingChange,
  segments,
}) => {
  return (
    <div className="space-y-4">
      {/* Rendering Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🦷 Dental Visualization Preset
        </label>
        <select
          value={renderingSettings.preset}
          onChange={(e) => onRenderingChange({ preset: e.target.value as any })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cbct-primary focus:border-transparent transition-colors"
        >
          <optgroup label="General Presets">
            <option value="default">Default View</option>
            <option value="bone">Bone Emphasis</option>
            <option value="soft_tissue">Soft Tissue</option>
            <option value="transparent">Transparent</option>
          </optgroup>
          <optgroup label="Dental Presets">
            <option value="dental_structures">🦷 All Dental Structures</option>
            <option value="enamel_focus">💎 Enamel & Crown Focus</option>
            <option value="root_canal">🔴 Root Canal & Pulp</option>
            <option value="pathology">⚠️ Pathology Detection</option>
          </optgroup>
        </select>
      </div>

      {/* Global Opacity */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            Global Opacity
          </label>
          <span className="text-sm text-gray-600 font-medium">
            {Math.round(renderingSettings.globalOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={renderingSettings.globalOpacity * 100}
          onChange={(e) => onRenderingChange({ globalOpacity: parseInt(e.target.value) / 100 })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Mesh Quality */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mesh Quality
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['low', 'medium', 'high'] as const).map((quality) => (
            <button
              key={quality}
              onClick={() => onRenderingChange({ meshQuality: quality })}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                renderingSettings.meshQuality === quality
                  ? 'bg-cbct-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {quality.charAt(0).toUpperCase() + quality.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Wireframe Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Wireframe Mode
        </label>
        <button
          onClick={() => onRenderingChange({ wireframe: !renderingSettings.wireframe })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            renderingSettings.wireframe ? 'bg-cbct-primary' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              renderingSettings.wireframe ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Per-Segment Controls */}
      {segments.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">
            Per-Segment Controls
          </h4>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {segments.map((segmentName) => {
              const settings = segmentSettings[segmentName] || { opacity: 0.85, smoothness: 50, visible: true };
              const opacity = settings.opacity ?? 0.85;
              const smoothness = settings.smoothness ?? 50;
              
              return (
                <div key={segmentName} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="font-medium text-sm text-gray-800 mb-3 capitalize">
                    {segmentName.replace('_', ' ')}
                  </div>
                  
                  {/* Opacity */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Opacity</label>
                      <span className="text-xs text-gray-600 font-medium">
                        {Math.round(opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(opacity * 100)}
                      onChange={(e) => onSegmentSettingChange(
                        segmentName,
                        'opacity',
                        parseInt(e.target.value) / 100
                      )}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Smoothness */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Smoothness</label>
                      <span className="text-xs text-gray-600 font-medium">
                        {Math.round(smoothness)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(smoothness)}
                      onChange={(e) => onSegmentSettingChange(
                        segmentName,
                        'smoothness',
                        parseInt(e.target.value)
                      )}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Adjust individual segment opacity and smoothness for better visualization of specific structures.
        </p>
      </div>
    </div>
  );
};

export default AdvancedControls;
