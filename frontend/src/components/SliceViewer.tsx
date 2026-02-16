/**
 * SliceViewer Component
 * Multi-planar reconstruction (MPR) - 2D slice visualization
 */

import React, { useState, useEffect, useRef } from 'react';

interface SliceViewerProps {
  scanId: string;
  dimensions: [number, number, number];
  axis: 'axial' | 'coronal' | 'sagittal';
  onSliceChange?: (axis: 'axial' | 'coronal' | 'sagittal', index: number) => void;
}

const SliceViewer: React.FC<SliceViewerProps> = ({
  scanId,
  dimensions,
  axis,
  onSliceChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sliceIndex, setSliceIndex] = useState(Math.floor(dimensions[0] / 2));
  const [windowCenter, setWindowCenter] = useState(500);
  const [windowWidth, setWindowWidth] = useState(2000);
  const [sliceData, setSliceData] = useState<number[][] | null>(null);
  const [dataRange, setDataRange] = useState<[number, number] | null>(null);

  const maxSliceIndex = axis === 'axial' ? dimensions[2] - 1 :
                        axis === 'coronal' ? dimensions[1] - 1 :
                        dimensions[0] - 1;

  useEffect(() => {
    setSliceIndex(Math.floor(maxSliceIndex / 2));
  }, [maxSliceIndex]);

  useEffect(() => {
    // Fetch slice data from backend
    const fetchSlice = async () => {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        const url = `${API_BASE_URL}/api/cbct/${scanId}/slice/${axis}/${sliceIndex}`;
        console.log('🔍 Fetching slice from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('❌ HTTP error! status:', response.status);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Slice data received:', {
          axis,
          sliceIndex,
          dataShape: data.data ? [data.data.length, data.data[0]?.length] : 'null',
          dataRange: data.min_value !== undefined ? [data.min_value, data.max_value] : 'unknown',
          sampleValue: data.data?.[0]?.[0],
          dataExists: !!data.data
        });
        
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
          console.error('❌ Invalid or empty slice data received');
          setSliceData(null);
          return;
        }
        
        // Store data range for debugging
        if (data.min_value !== undefined && data.max_value !== undefined) {
          setDataRange([data.min_value, data.max_value]);
        }
        
        setSliceData(data.data);
      } catch (error) {
        console.error('❌ Failed to fetch slice:', error);
        setSliceData(null);
      }
    };

    fetchSlice();
    onSliceChange?.(axis, sliceIndex);
  }, [scanId, axis, sliceIndex, onSliceChange]);

  useEffect(() => {
    if (!sliceData || !canvasRef.current) {
      console.log('⏸️  Skipping render - no data or canvas:', { hasData: !!sliceData, hasCanvas: !!canvasRef.current });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Failed to get 2D context');
      return;
    }

    const height = sliceData.length;
    const width = sliceData[0]?.length || 0;
    
    if (width === 0 || height === 0) {
      console.error('❌ Invalid slice dimensions:', { width, height });
      return;
    }

    // Set canvas size (this clears the canvas)
    canvas.width = width;
    canvas.height = height;

    // Sample some values to debug
    const centerValue = sliceData[Math.floor(height/2)]?.[Math.floor(width/2)] || 0;
    const minVal = Math.min(...sliceData.flat());
    const maxVal = Math.max(...sliceData.flat());
    
    console.log('🎨 Rendering MPR slice:', {
      axis,
      sliceIndex,
      dimensions: [width, height],
      windowCenter,
      windowWidth,
      dataRange: [minVal.toFixed(2), maxVal.toFixed(2)],
      centerPixel: centerValue.toFixed(2),
      windowRange: [(windowCenter - windowWidth/2).toFixed(0), (windowCenter + windowWidth/2).toFixed(0)]
    });

    const imageData = ctx.createImageData(width, height);

    // Apply windowing and render
    let renderedPixels = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = sliceData[y][x];
        
        // Apply window/level transformation
        const minWindow = windowCenter - windowWidth / 2;
        let intensity = ((value - minWindow) / windowWidth) * 255;
        intensity = Math.max(0, Math.min(255, intensity));

        const index = (y * width + x) * 4;
        imageData.data[index] = intensity;
        imageData.data[index + 1] = intensity;
        imageData.data[index + 2] = intensity;
        imageData.data[index + 3] = 255;
        
        if (intensity > 10 && intensity < 245) renderedPixels++;
      }
    }

    console.log(`✅ Rendered ${renderedPixels} mid-range pixels (${((renderedPixels/(width*height))*100).toFixed(1)}%)`);

    ctx.putImageData(imageData, 0, 0);
  }, [sliceData, windowCenter, windowWidth, axis, sliceIndex]);

  const axisLabel = axis.charAt(0).toUpperCase() + axis.slice(1);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 px-3 py-1.5 flex items-center justify-between">
        <h4 className="text-white font-semibold text-xs">{axisLabel}</h4>
        <span className="text-gray-400 text-xs">
          {sliceIndex + 1}/{maxSliceIndex + 1}
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-black">
        {sliceData ? (
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full border border-gray-700"
            style={{ imageRendering: 'auto' }}
          />
        ) : (
          <div className="text-gray-500 text-xs text-center p-4">
            <div className="text-2xl mb-2">📊</div>
            <div>Loading slice data...</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-3 py-2 space-y-2">
        {/* Slice slider */}
        <div>
          <input
            type="range"
            min="0"
            max={maxSliceIndex}
            value={sliceIndex}
            onChange={(e) => {
              const newIndex = parseInt(e.target.value);
              setSliceIndex(newIndex);
            }}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            style={{
              accentColor: '#3b82f6',
            }}
          />
        </div>

        {/* Window/Level controls */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-gray-400 block mb-0.5 text-xs">
              C: {windowCenter}
            </label>
            <input
              type="range"
              min="0"
              max="1000"
              value={windowCenter}
              onChange={(e) => {
                const newCenter = parseInt(e.target.value);
                setWindowCenter(newCenter);
              }}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              style={{
                accentColor: '#10b981',
              }}
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-0.5 text-xs">
              W: {windowWidth}
            </label>
            <input
              type="range"
              min="100"
              max="3000"
              value={windowWidth}
              onChange={(e) => {
                const newWidth = parseInt(e.target.value);
                setWindowWidth(newWidth);
              }}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              style={{
                accentColor: '#f59e0b',
              }}
            />
          </div>
        </div>

        {/* Preset buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setWindowCenter(500);
              setWindowWidth(2000);
            }}
            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors font-medium"
          >
            Default
          </button>
          <button
            onClick={() => {
              setWindowCenter(600);
              setWindowWidth(2500);
            }}
            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors font-medium"
          >
            Bone
          </button>
          <button
            onClick={() => {
              setWindowCenter(50);
              setWindowWidth(400);
            }}
            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors font-medium"
          >
            Soft
          </button>
        </div>
        
        {/* Data range info for debugging */}
        {dataRange && (
          <div className="text-xs text-gray-500 text-center pt-1 border-t border-gray-700">
            Data: [{dataRange[0].toFixed(0)}, {dataRange[1].toFixed(0)}]
          </div>
        )}
      </div>
    </div>
  );
};

export default SliceViewer;
