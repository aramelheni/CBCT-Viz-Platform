/**
 * VolumeControls Component
 * Controls for raw CBCT volume visualization (pre-segmentation)
 */

import React, { useEffect, useState } from 'react';
import { getRenderingPresets } from '../services/api';

export interface VolumeSettings {
  windowCenter: number;
  windowWidth: number;
  opacity: number;
  brightness: number;
  contrast: number;
  numSlices: number;
  quality: 'low' | 'medium' | 'high';
}

interface VolumeControlsProps {
  settings: VolumeSettings;
  onChange: (settings: Partial<VolumeSettings>) => void;
}

const VolumeControls: React.FC<VolumeControlsProps> = ({ settings, onChange }) => {
  const [presets, setPresets] = useState<any>(null);

  useEffect(() => {
    // Load presets from API
    getRenderingPresets()
      .then(setPresets)
      .catch(err => console.error('Failed to load presets:', err));
  }, []);

  const applyPreset = (presetName: string) => {
    if (!presets || !presets[presetName]) return;
    
    const preset = presets[presetName];
    onChange({
      windowCenter: preset.window_center,
      windowWidth: preset.window_width,
      opacity: preset.opacity,
      brightness: preset.brightness,
      contrast: preset.contrast,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-blue-800">
          <strong>📊 Raw Volume Mode</strong><br/>
          Adjust windowing and visualization settings to inspect the CBCT scan before segmentation.
        </p>
      </div>

      {/* Windowing Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🔍 Visualization Preset
        </label>
        <select
          onChange={(e) => applyPreset(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cbct-primary focus:border-transparent transition-colors"
          defaultValue=""
        >
          <option value="" disabled>Select a preset...</option>
          <option value="default">Default View</option>
          <option value="bone">🦴 Bone Emphasis</option>
          <option value="soft_tissue">🫁 Soft Tissue</option>
          <option value="high_contrast">⚡ High Contrast</option>
        </select>
      </div>

      {/* Window Center (Level) */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            Window Level (Center)
          </label>
          <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded">
            {settings.windowCenter}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1000"
          step="10"
          value={settings.windowCenter}
          onChange={(e) => onChange({ windowCenter: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0</span>
          <span>1000</span>
        </div>
      </div>

      {/* Window Width */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            Window Width (Contrast)
          </label>
          <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded">
            {settings.windowWidth}
          </span>
        </div>
        <input
          type="range"
          min="100"
          max="3000"
          step="50"
          value={settings.windowWidth}
          onChange={(e) => onChange({ windowWidth: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>100</span>
          <span>3000</span>
        </div>
      </div>

      {/* Volume Opacity */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            Volume Opacity
          </label>
          <span className="text-sm text-gray-600 font-medium">
            {Math.round(settings.opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.opacity * 100}
          onChange={(e) => onChange({ opacity: parseInt(e.target.value) / 100 })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Brightness */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            Brightness
          </label>
          <span className="text-sm text-gray-600 font-medium">
            {settings.brightness.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          value={settings.brightness * 100}
          onChange={(e) => onChange({ brightness: parseInt(e.target.value) / 100 })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Contrast */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            Contrast
          </label>
          <span className="text-sm text-gray-600 font-medium">
            {settings.contrast.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          value={settings.contrast * 100}
          onChange={(e) => onChange({ contrast: parseInt(e.target.value) / 100 })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Number of Slices */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            Number of Slices
          </label>
          <span className="text-sm text-gray-600 font-medium">
            {settings.numSlices}
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="50"
          step="5"
          value={settings.numSlices}
          onChange={(e) => onChange({ numSlices: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>5 (Faster)</span>
          <span>50 (Detailed)</span>
        </div>
      </div>

      {/* Volume Quality */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Volume Quality
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['low', 'medium', 'high'] as const).map((quality) => (
            <button
              key={quality}
              onClick={() => onChange({ quality })}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.quality === quality
                  ? 'bg-cbct-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {quality.charAt(0).toUpperCase() + quality.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {settings.quality === 'low' && '64³ voxels - Fast rendering'}
          {settings.quality === 'medium' && '96³ voxels - Balanced'}
          {settings.quality === 'high' && '128³ voxels - Best detail'}
        </p>
      </div>

      {/* Reset Button */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => onChange({
            windowCenter: 400,
            windowWidth: 1800,
            opacity: 0.6,
            brightness: 1.0,
            contrast: 1.0,
            numSlices: 20,
            quality: 'low',
          })}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium text-sm"
        >
          🔄 Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default VolumeControls;
