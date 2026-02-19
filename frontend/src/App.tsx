/**
 * Main Application Component
 * CBCT Segmentation and Visualization Platform
 */

import { useState, useCallback } from 'react';
import CBCTViewer, { MPRSlicePositions } from './components/CBCTViewer';
import FileUpload from './components/FileUpload';
import AdvancedControls, { RenderingSettings, SegmentSettings } from './components/AdvancedControls';
import VolumeControls, { VolumeSettings } from './components/VolumeControls';
import MeasurementTools from './components/MeasurementTools';
import PreSegmentationMeasurements from './components/PreSegmentationMeasurements';
import SliceViewer from './components/SliceViewer';
import ExportTools from './components/ExportTools';
import PreSegmentationExport from './components/PreSegmentationExport';
import {
  uploadCBCT,
  performSegmentation,
  getSegmentMesh,
  getVolumeData,
  CBCTUploadResponse,
  SegmentInfo,
  MeshData,
} from './services/api';
import './index.css';

interface ValidationError {
  error: string;
  message: string;
  confidence?: string;
  details?: string;
  help?: string;
}

interface AppState {
  scanId: string | null;
  filename: string | null;
  metadata: any | null;
  isUploading: boolean;
  isSegmenting: boolean;
  isLoadingVolume: boolean;
  volumeData: number[][][] | null;
  segments: SegmentInfo[];
  meshes: MeshData[];
  visibleSegments: string[];
  error: string | ValidationError | null;
}

function App() {
  const [state, setState] = useState<AppState>({
    scanId: null,
    filename: null,
    metadata: null,
    isUploading: false,
    isSegmenting: false,
    isLoadingVolume: false,
    volumeData: null,
    segments: [],
    meshes: [],
    visibleSegments: [],
    error: null,
  });

  const [renderingSettings, setRenderingSettings] = useState<RenderingSettings>({
    globalOpacity: 1.0,
    meshQuality: 'medium',
    wireframe: false,
    preset: 'default',
  });

  const [segmentSettings, setSegmentSettings] = useState<SegmentSettings>({});
  const [volumeSettings, setVolumeSettings] = useState<VolumeSettings>({
    windowCenter: 400,
    windowWidth: 1800,
    opacity: 0.6,
    brightness: 1.0,
    contrast: 1.0,
    numSlices: 20,
    quality: 'low',
  });
  const [showMPR, setShowMPR] = useState(false);
  const [viewMode, setViewMode] = useState<'raw' | 'segmented'>('raw'); // Toggle between raw volume and segmented view
  const [preSegViewMode, setPreSegViewMode] = useState<'2d' | '3d'>('2d'); // Pre-segmentation: 2D slices vs 3D volume
  const [activeTab, setActiveTab] = useState<'segments' | 'advanced' | 'measurements' | 'export'>('segments');
  const [preSegTab, setPreSegTab] = useState<'controls' | 'measurements' | 'export'>('controls'); // Pre-segmentation tabs
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  
  // Track MPR slice positions for 3D visualization
  const [mprSlices, setMprSlices] = useState<MPRSlicePositions | undefined>(undefined);

  // Handle MPR slice changes
  const handleSliceChange = useCallback((axis: 'axial' | 'coronal' | 'sagittal', index: number) => {
    if (!state.metadata?.dimensions) return;
    
    setMprSlices(prev => ({
      axial: axis === 'axial' ? index : (prev?.axial ?? Math.floor(state.metadata.dimensions[2] / 2)),
      coronal: axis === 'coronal' ? index : (prev?.coronal ?? Math.floor(state.metadata.dimensions[1] / 2)),
      sagittal: axis === 'sagittal' ? index : (prev?.sagittal ?? Math.floor(state.metadata.dimensions[0] / 2)),
      dimensions: state.metadata.dimensions,
    }));
    
    console.log(`MPR ${axis} slice changed to:`, index);
  }, [state.metadata]);

  const handleFileSelected = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      const response: CBCTUploadResponse = await uploadCBCT(file);
      
      setState(prev => ({
        ...prev,
        scanId: response.scan_id,
        filename: response.filename,
        metadata: response.metadata,
        isUploading: false,
      }));

      console.log('Upload successful:', response);
      
      // Load volume data for pre-segmentation visualization
      setState(prev => ({ ...prev, isLoadingVolume: true }));
      try {
        const volumeResponse = await getVolumeData(response.scan_id, 'low');
        setState(prev => ({
          ...prev,
          volumeData: volumeResponse.data,
          isLoadingVolume: false,
        }));
        console.log('Volume data loaded for pre-segmentation view');
      } catch (volumeError: any) {
        console.error('Failed to load volume data:', volumeError);
        setState(prev => ({ ...prev, isLoadingVolume: false }));
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      
      // Handle detailed validation error response
      let errorMessage: string | ValidationError = 'Failed to upload file';
      
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        
        // Check if it's a validation error with detailed structure
        if (typeof detail === 'object' && detail.message) {
          errorMessage = detail; // Store the structured error
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      }
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage,
      }));
    }
  }, []);

  const handleSegment = useCallback(async () => {
    if (!state.scanId) {
      setState(prev => ({ ...prev, error: 'No scan loaded' }));
      return;
    }

    setState(prev => ({ ...prev, isSegmenting: true, error: null }));

    try {
      // Perform segmentation
      const segmentationResponse = await performSegmentation(state.scanId);
      
      console.log('Segmentation successful:', segmentationResponse);

      // Load meshes for all segments
      const meshPromises = segmentationResponse.segments.map(segment =>
        getSegmentMesh(state.scanId!, segment.name)
      );

      const meshes = await Promise.all(meshPromises);

      // Set all segments visible by default
      const visibleSegments = segmentationResponse.segments.map(s => s.name);

      setState(prev => ({
        ...prev,
        segments: segmentationResponse.segments,
        meshes: meshes.filter(m => m !== null),
        visibleSegments,
        isSegmenting: false,
      }));
      
      // Switch to segmented view after segmentation completes
      setViewMode('segmented');
    } catch (error: any) {
      console.error('Segmentation failed:', error);
      setState(prev => ({
        ...prev,
        isSegmenting: false,
        error: error.response?.data?.detail || 'Segmentation failed',
      }));
    }
  }, [state.scanId]);

  const handleToggleSegment = useCallback((segmentName: string) => {
    setState(prev => ({
      ...prev,
      visibleSegments: prev.visibleSegments.includes(segmentName)
        ? prev.visibleSegments.filter(s => s !== segmentName)
        : [...prev.visibleSegments, segmentName],
    }));
  }, []);

  const handleVolumeSettingChange = useCallback(async (settings: Partial<VolumeSettings>) => {
    const newSettings = { ...volumeSettings, ...settings };
    setVolumeSettings(newSettings);
    
    // Reload volume if quality changed
    if (settings.quality && settings.quality !== volumeSettings.quality && state.scanId) {
      setState(prev => ({ ...prev, isLoadingVolume: true }));
      try {
        const volumeResponse = await getVolumeData(state.scanId, settings.quality);
        setState(prev => ({
          ...prev,
          volumeData: volumeResponse.data,
          isLoadingVolume: false,
        }));
        console.log(`Volume reloaded with quality: ${settings.quality}`);
      } catch (error) {
        console.error('Failed to reload volume:', error);
        setState(prev => ({ ...prev, isLoadingVolume: false }));
      }
    }
  }, [volumeSettings, state.scanId]);

  const handleSegmentClick = useCallback((segmentName: string) => {
    // Show only the clicked segment
    setState(prev => ({
      ...prev,
      visibleSegments: [segmentName],
    }));
  }, []);

  const handleReset = useCallback(() => {
    setState({
      scanId: null,
      filename: null,
      metadata: null,
      isUploading: false,
      isSegmenting: false,
      isLoadingVolume: false,
      volumeData: null,
      segments: [],
      meshes: [],
      visibleSegments: [],
      error: null,
    });
  }, []);

  // Get color map from segments
  const colorMap = state.segments.reduce((map, segment) => {
    map[segment.name] = segment.color;
    return map;
  }, {} as { [key: string]: string });

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Compact Header */}
      <header className="bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 shadow-xl">
        <div className="max-w-full mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Logo/Icon */}
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  CBCT DENTAL RECONSTRUCTION
                </h1>
                <p className="text-xs text-blue-200 flex items-center">
                  <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                  AI-Powered Segmentation & 3D Visualization
                </p>
              </div>
            </div>
            {state.scanId && (
              <div className="flex items-center space-x-3">
                {/* Stats */}
                {state.segments.length > 0 && (
                  <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-xs">
                    <div className="flex items-center space-x-3">
                      <div>
                        <span className="text-gray-400">Segments:</span>
                        <span className="font-bold ml-1">{state.segments.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Visible:</span>
                        <span className="font-bold ml-1">{state.visibleSegments.length}</span>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all transform hover:scale-105 font-medium shadow-lg text-sm"
                >
                  ⟳ New Scan
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {/* Error Message */}
        {state.error && (
          <div className="mx-4 mt-4 p-5 bg-red-50 border-2 border-red-300 rounded-xl shadow-lg">
            <div className="flex items-start">
              <svg
                className="w-7 h-7 text-red-600 mr-4 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                {typeof state.error === 'object' ? (
                  // Structured validation error
                  <>
                    <div className="mb-4">
                      <h3 className="text-red-900 font-bold text-lg mb-1">{state.error.error}</h3>
                      <p className="text-red-800 font-semibold text-base">{state.error.message}</p>
                      {state.error.confidence && (
                        <span className="inline-block mt-2 px-3 py-1 bg-red-200 text-red-900 rounded-full text-xs font-medium">
                          Confidence: {state.error.confidence}
                        </span>
                      )}
                    </div>
                    
                    {state.error.details && (
                      <div className="mb-4 p-4 bg-white rounded-lg border border-red-200">
                        <h4 className="text-red-800 font-semibold text-sm mb-2">Validation Details:</h4>
                        <div className="text-red-700 text-sm space-y-1 font-mono">
                          {state.error.details.split('\n').map((line, i) => (
                            <div key={i} className={line.startsWith('✓') ? 'text-green-700' : line.startsWith('✗') ? 'text-red-700' : 'text-gray-700'}>
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {state.error.help && (
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-300 rounded-lg">
                        <h4 className="text-blue-900 font-semibold text-sm mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          How to Fix:
                        </h4>
                        <div className="text-blue-800 text-sm space-y-1">
                          {state.error.help.split('\n').map((line, i) => {
                            if (line.startsWith('•')) {
                              return (
                                <div key={i} className="flex items-start ml-2">
                                  <span className="mr-2">•</span>
                                  <span>{line.substring(1).trim()}</span>
                                </div>
                              );
                            }
                            return <div key={i} className={line.trim() ? '' : 'h-2'}>{line}</div>;
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Try Again Button */}
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={() => setState(prev => ({ ...prev, error: null }))}
                        className="px-6 py-2.5 bg-cbct-primary text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Try Again - Upload Different File
                      </button>
                    </div>
                  </>
                ) : (
                  // Simple string error
                  <>
                    <h3 className="text-red-900 font-bold text-lg mb-2">Upload Error</h3>
                    <p className="text-red-700 text-sm mb-4">{state.error}</p>
                    
                    {/* Try Again Button */}
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={() => setState(prev => ({ ...prev, error: null }))}
                        className="px-6 py-2.5 bg-cbct-primary text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Try Again
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        {!state.scanId && (
          <div className="max-w-2xl mx-auto mt-12">
            <FileUpload
              onFileSelected={handleFileSelected}
              isUploading={state.isUploading}
            />
          </div>
        )}

        {/* Viewer Section */}
        {state.scanId && (
          <div className="h-full flex p-4 relative">
            {/* Sidebar */}
            <div className={`flex-shrink-0 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${
              sidePanelCollapsed ? 'w-0 -ml-4 opacity-0' : 'w-80 mr-4 opacity-100'
            }`}>
                {/* Scan Info - Fixed at top */}
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">
                    Scan Information
                  </h3>
                  <div className="space-y-1 text-xs">
                    <div>
                      <span className="font-medium text-gray-600">File:</span>
                      <p className="text-gray-800 break-all truncate">{state.filename}</p>
                    </div>
                    {state.metadata && (
                      <>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600">Dimensions:</span>
                          <span className="text-gray-800">
                            {state.metadata.dimensions.join(' × ')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600">Spacing:</span>
                          <span className="text-gray-800">
                            {state.metadata.spacing.map((s: number) => s.toFixed(2)).join(' × ')} mm
                          </span>
                        </div>
                        {state.metadata.downsampled && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
                            <p className="text-yellow-800">
                              <strong>⚠️ Optimized</strong><br/>
                              Original: {state.metadata.original_dimensions?.join(' × ')}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Segment Button */}
                  {state.segments.length === 0 && (
                    <button
                      onClick={handleSegment}
                      disabled={state.isSegmenting}
                      className="mt-3 w-full px-4 py-2 bg-cbct-primary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      {state.isSegmenting ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Segmenting...
                        </span>
                      ) : (
                        'Segment Scan'
                      )}
                    </button>
                  )}
                </div>

                {/* Pre-Segmentation Tabs - Show when volume loaded but not segmented yet */}
                {state.volumeData && state.segments.length === 0 && !state.isLoadingVolume && (
                  <>
                    <div className="flex border-b bg-gray-50">
                      <button
                        onClick={() => setPreSegTab('controls')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          preSegTab === 'controls'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Controls
                      </button>
                      <button
                        onClick={() => setPreSegTab('measurements')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          preSegTab === 'measurements'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Measure
                      </button>
                      <button
                        onClick={() => setPreSegTab('export')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          preSegTab === 'export'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Export
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {preSegTab === 'controls' && (
                        <>
                          {preSegViewMode === '2d' ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                                📋 2D Slice Controls
                              </h3>
                              <p className="text-sm text-gray-700 mb-3">
                                Use the controls directly on each slice view:
                              </p>
                              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                                <li><strong>Scroll:</strong> Navigate through slices</li>
                                <li><strong>Window/Level:</strong> Use the sliders on each view</li>
                                <li><strong>View Toggle:</strong> Switch to 3D Volume for advanced controls</li>
                              </ul>
                              <div className="mt-4 pt-3 border-t border-blue-200">
                                <button
                                  onClick={() => setPreSegViewMode('3d')}
                                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors font-medium"
                                >
                                  🧊 Switch to 3D Volume View
                                </button>
                              </div>
                            </div>
                          ) : (
                            <VolumeControls
                              settings={volumeSettings}
                              onChange={handleVolumeSettingChange}
                            />
                          )}
                        </>
                      )}

                      {preSegTab === 'measurements' && state.metadata && (
                        <PreSegmentationMeasurements
                          metadata={state.metadata}
                          volumeData={state.volumeData}
                        />
                      )}

                      {preSegTab === 'export' && state.scanId && state.metadata && (
                        <PreSegmentationExport
                          scanId={state.scanId}
                          metadata={state.metadata}
                          volumeData={state.volumeData}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Tabs */}
                {state.segments.length > 0 && (
                  <>
                    <div className="flex border-b bg-gray-50">
                      <button
                        onClick={() => setActiveTab('segments')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          activeTab === 'segments'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Segments
                      </button>
                      <button
                        onClick={() => setActiveTab('advanced')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          activeTab === 'advanced'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Advanced
                      </button>
                      <button
                        onClick={() => setActiveTab('measurements')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          activeTab === 'measurements'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Measure
                      </button>
                      <button
                        onClick={() => setActiveTab('export')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          activeTab === 'export'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Export
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {activeTab === 'segments' && (
                        <div className="space-y-2">
                          {/* Show All / Hide All Buttons */}
                          <div className="flex gap-2 mb-4">
                            <button
                              onClick={() => setState(prev => ({
                                ...prev,
                                visibleSegments: state.segments.map(s => s.name)
                              }))}
                              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors font-medium"
                            >
                              👁️ Show All
                            </button>
                            <button
                              onClick={() => setState(prev => ({
                                ...prev,
                                visibleSegments: []
                              }))}
                              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors font-medium"
                            >
                              👁️‍🗨️ Hide All
                            </button>
                          </div>

                          {state.segments.map((segment) => {
                            const isVisible = state.visibleSegments.includes(segment.name);
                            const formatSegmentName = (name: string) =>
                              name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                            const formatVoxelCount = (count?: number) => {
                              if (!count) return 'N/A';
                              if (count > 1000000) return `${(count / 1000000).toFixed(2)}M`;
                              if (count > 1000) return `${(count / 1000).toFixed(2)}K`;
                              return count.toString();
                            };

                            return (
                              <div
                                key={segment.name}
                                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  isVisible ? 'border-cbct-primary bg-blue-50' : 'border-gray-200 bg-white'
                                } hover:shadow-md`}
                                onClick={() => handleSegmentClick(segment.name)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 flex-1">
                                    <div
                                      className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0"
                                      style={{ backgroundColor: segment.color }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-gray-800 text-xs truncate">
                                        {formatSegmentName(segment.name)}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {formatVoxelCount(segment.voxel_count)} voxels
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSegment(segment.name);
                                    }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                      isVisible ? 'bg-cbct-primary' : 'bg-gray-200'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                        isVisible ? 'translate-x-5' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {activeTab === 'advanced' && (
                        <AdvancedControls
                          renderingSettings={renderingSettings}
                          onRenderingChange={(settings) => setRenderingSettings({...renderingSettings, ...settings})}
                          segmentSettings={segmentSettings}
                          onSegmentSettingChange={(name, setting, value) => {
                            setSegmentSettings({
                              ...segmentSettings,
                              [name]: { ...segmentSettings[name], [setting]: value }
                            });
                          }}
                          segments={state.segments.map(s => s.name)}
                        />
                      )}

                      {activeTab === 'measurements' && state.metadata && (
                        <MeasurementTools
                          segments={state.segments}
                          spacing={state.metadata.spacing}
                        />
                      )}

                      {activeTab === 'export' && state.scanId && (
                        <ExportTools
                          scanId={state.scanId}
                          segments={state.segments.map(s => s.name)}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

            {/* Toggle Sidebar Button - Show when there are segments or volume controls */}
            {(state.segments.length > 0 || state.volumeData) && (
              <button
                onClick={() => {
                  console.log('Toggle clicked, current state:', sidePanelCollapsed);
                  setSidePanelCollapsed(!sidePanelCollapsed);
                }}
                className={`absolute top-24 z-50 w-10 h-12 bg-gray-800 hover:bg-gray-700 text-white shadow-xl flex items-center justify-center transition-all duration-300 rounded-lg ${
                  sidePanelCollapsed ? 'left-4' : 'left-[336px]'
                }`}
                style={{
                  transition: 'left 300ms ease-in-out'
                }}
                title={sidePanelCollapsed ? 'Show Controls' : 'Hide Controls'}
              >
                <svg
                  className={`w-5 h-5 transition-transform duration-300 ${sidePanelCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* 3D Viewer */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex-1 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg shadow-2xl overflow-hidden relative">
                {/* Pre-segmentation 2D Slice View */}
                {state.volumeData && state.segments.length === 0 && preSegViewMode === '2d' && state.scanId && state.metadata ? (
                  <div className="h-full bg-gray-900 flex flex-col">
                    {/* Header bar for 2D mode - no overlaps */}
                    <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h3 className="text-xs font-bold tracking-wide text-white">CBCT VIEWER</h3>
                        <span className="text-xs text-green-300">✓ Multi-planar views</span>
                        {state.metadata?.downsampled && (
                          <span className="bg-yellow-600 rounded px-2 py-0.5 text-white text-xs font-medium">Optimized</span>
                        )}
                      </div>
                      <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
                        <button
                          onClick={() => setPreSegViewMode('2d')}
                          className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white font-medium"
                        >
                          📋 2D
                        </button>
                        <button
                          onClick={() => setPreSegViewMode('3d')}
                          className="px-3 py-1 text-xs rounded-md text-gray-300 hover:text-white hover:bg-gray-700 font-medium transition-colors"
                          title="Switch to 3D volume rendering"
                        >
                          🧊 3D
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 flex-1 p-4">
                      <div className="flex flex-col">
                        <h5 className="text-sm font-medium text-gray-300 mb-2 text-center">Axial</h5>
                        <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
                          <SliceViewer
                            scanId={state.scanId}
                            dimensions={state.metadata.dimensions}
                            axis="axial"
                            onSliceChange={handleSliceChange}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <h5 className="text-sm font-medium text-gray-300 mb-2 text-center">Coronal</h5>
                        <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
                          <SliceViewer
                            scanId={state.scanId}
                            dimensions={state.metadata.dimensions}
                            axis="coronal"
                            onSliceChange={handleSliceChange}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <h5 className="text-sm font-medium text-gray-300 mb-2 text-center">Sagittal</h5>
                        <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
                          <SliceViewer
                            scanId={state.scanId}
                            dimensions={state.metadata.dimensions}
                            axis="sagittal"
                            onSliceChange={handleSliceChange}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 3D Volume/Segment View */
                  <CBCTViewer
                    volumeData={viewMode === 'raw' ? (state.volumeData || undefined) : undefined}
                    segments={viewMode === 'segmented' ? state.meshes : []}
                    visibleSegments={viewMode === 'segmented' ? state.visibleSegments : []}
                    colorMap={colorMap}
                    renderingSettings={renderingSettings}
                    segmentSettings={segmentSettings}
                    volumeSettings={volumeSettings}
                    mprSlices={showMPR ? mprSlices : undefined}
                  />
                )}
                {/* Title overlay - only show in 3D mode */}
                {!(state.volumeData && state.segments.length === 0 && preSegViewMode === '2d') && (
                  <div className="absolute top-3 left-3 bg-gray-900 bg-opacity-80 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
                  <h3 className="text-xs font-bold tracking-wide">
                    {state.volumeData && state.segments.length === 0 && preSegViewMode === '2d' 
                      ? 'CBCT VIEWER' 
                      : 'CBCT DENTAL RECONSTRUCTION'}
                  </h3>
                  {state.isLoadingVolume && (
                    <p className="text-xs text-blue-300 mt-0.5 flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-300"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Loading...
                    </p>
                  )}
                  {!state.isLoadingVolume && state.volumeData && state.segments.length === 0 && preSegViewMode === '2d' && (
                    <p className="text-xs text-green-300 mt-0.5">
                      ✓ Multi-planar views
                    </p>
                  )}
                  {!state.isLoadingVolume && state.volumeData && state.segments.length === 0 && preSegViewMode === '3d' && (
                    <p className="text-xs text-green-300 mt-0.5">
                      ✓ 3D volume
                    </p>
                  )}
                  {state.segments.length > 0 && viewMode === 'segmented' && (
                    <p className="text-xs text-gray-300 mt-0.5">
                      🎯 {state.visibleSegments.length}/{state.segments.length} segments
                    </p>
                  )}
                  {state.segments.length > 0 && viewMode === 'raw' && state.volumeData && (
                    <p className="text-xs text-purple-300 mt-0.5">
                      📊 Raw volume
                    </p>
                  )}
                  </div>
                )}

                {/* Top Right Controls - only show in 3D mode */}
                {!(state.volumeData && state.segments.length === 0 && preSegViewMode === '2d') && (
                  <div className="absolute top-3 right-3 flex gap-2">
                  {/* Quality Badge */}
                  {state.metadata?.downsampled && (
                    <div className="bg-yellow-600 bg-opacity-90 backdrop-blur-sm rounded-lg px-3 py-1 text-white text-xs font-medium">
                      Optimized Quality
                    </div>
                  )}
                  
                  {/* Pre-Segmentation: 2D/3D Toggle */}
                  {state.volumeData && state.segments.length === 0 && (
                    <div className="flex gap-1 bg-gray-900 bg-opacity-90 backdrop-blur-sm rounded-lg p-1">
                      <button
                        onClick={() => setPreSegViewMode('2d')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
                          preSegViewMode === '2d'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:text-white hover:bg-gray-700'
                        }`}
                        title="Multi-planar 2D slice viewer"
                      >
                        📋 2D
                      </button>
                      <button
                        onClick={() => setPreSegViewMode('3d')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
                          preSegViewMode === '3d'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:text-white hover:bg-gray-700'
                        }`}
                        title="3D volume rendering"
                      >
                        🧊 3D
                      </button>
                    </div>
                  )}
                  </div>
                )}

                {/* Controls Info - Hide in 2D pre-segmentation mode */}
                {!(state.volumeData && state.segments.length === 0 && preSegViewMode === '2d') && (
                  <div className="absolute bottom-3 left-3 right-3 bg-gray-900 bg-opacity-80 backdrop-blur-sm rounded-lg p-3 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 text-xs">
                        <div>
                          <span className="font-semibold text-blue-400">Rotate:</span>
                          <span className="text-gray-300 ml-1">Left Click</span>
                        </div>
                        <div>
                          <span className="font-semibold text-blue-400">Pan:</span>
                          <span className="text-gray-300 ml-1">Right Click</span>
                        </div>
                        <div>
                          <span className="font-semibold text-blue-400">Zoom:</span>
                          <span className="text-gray-300 ml-1">Scroll</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* View Mode Toggle - show only when both volume and segments are available */}
                        {state.volumeData && state.segments.length > 0 && (
                          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                            <button
                              onClick={() => setViewMode('raw')}
                              className={`px-3 py-1 text-sm rounded-md transition-colors font-medium ${
                                viewMode === 'raw'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
                              }`}
                            >
                              📊 Raw
                            </button>
                            <button
                              onClick={() => setViewMode('segmented')}
                              className={`px-3 py-1 text-sm rounded-md transition-colors font-medium ${
                                viewMode === 'segmented'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
                              }`}
                            >
                              🎯 Segments
                            </button>
                          </div>
                        )}
                        {state.metadata && state.segments.length > 0 && (
                          <button
                            onClick={() => setShowMPR(!showMPR)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors font-medium shadow-md"
                          >
                            {showMPR ? '🔼 Hide' : '🔽 2D Slices'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-Planar Reconstruction (MPR) View */}
              {showMPR && state.scanId && state.metadata && (
                <div className="bg-white rounded-lg shadow-lg p-3">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">
                    Multi-Planar Reconstruction (MPR)
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-48">
                      <h5 className="text-xs font-medium text-gray-600 mb-1">Axial</h5>
                      <SliceViewer
                        scanId={state.scanId}
                        dimensions={state.metadata.dimensions}
                        axis="axial"
                        onSliceChange={handleSliceChange}
                      />
                    </div>
                    <div className="h-48">
                      <h5 className="text-xs font-medium text-gray-600 mb-1">Coronal</h5>
                      <SliceViewer
                        scanId={state.scanId}
                        dimensions={state.metadata.dimensions}
                        axis="coronal"
                        onSliceChange={handleSliceChange}
                      />
                    </div>
                    <div className="h-48">
                      <h5 className="text-xs font-medium text-gray-600 mb-1">Sagittal</h5>
                      <SliceViewer
                        scanId={state.scanId}
                        dimensions={state.metadata.dimensions}
                        axis="sagittal"
                        onSliceChange={handleSliceChange}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-600">
            CBCT Segmentation Platform | Co-advised by Prof. Ana Messias | University of Coimbra
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
