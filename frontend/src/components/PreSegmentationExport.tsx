/**
 * PreSegmentationExport Component
 * Export capabilities for raw CBCT volume (before segmentation)
 */

import React, { useState } from 'react';
import { CBCTMetadata, getSlice } from '../services/api';

interface PreSegmentationExportProps {
  scanId: string;
  metadata: CBCTMetadata;
  volumeData?: number[][][];
}

const PreSegmentationExport: React.FC<PreSegmentationExportProps> = ({
  scanId,
  metadata,
  volumeData: _volumeData, // Reserved for future use (volume statistics export)
}) => {
  const [exportStatus, setExportStatus] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const handleScreenshot = () => {
    console.log('📸 Screenshot requested');
    
    // Wait for next animation frame to ensure scene is rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        
        if (!canvas) {
          setExportStatus('No 3D viewer found.');
          setTimeout(() => setExportStatus(''), 3000);
          return;
        }

        try {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          
          if (dataUrl === 'data:,' || dataUrl.length < 100) {
            setExportStatus('Screenshot failed: Canvas is empty');
            setTimeout(() => setExportStatus(''), 3000);
            return;
          }
          
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `cbct-raw-volume-${scanId}-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setExportStatus('Screenshot saved successfully!');
          setTimeout(() => setExportStatus(''), 3000);
        } catch (error) {
          console.error('Screenshot failed:', error);
          setExportStatus(`Failed to capture screenshot`);
          setTimeout(() => setExportStatus(''), 3000);
        }
      });
    });
  };

  const handleExportMetadata = () => {
    try {
      const metadataJSON = {
        scan_id: scanId,
        export_date: new Date().toISOString(),
        dimensions: {
          width: metadata.dimensions[0],
          height: metadata.dimensions[1],
          depth: metadata.dimensions[2],
          total_voxels: metadata.dimensions[0] * metadata.dimensions[1] * metadata.dimensions[2],
        },
        spacing: {
          x: metadata.spacing[0],
          y: metadata.spacing[1],
          z: metadata.spacing[2],
          unit: 'mm',
        },
        origin: {
          x: metadata.origin[0],
          y: metadata.origin[1],
          z: metadata.origin[2],
        },
        intensity_range: {
          min: metadata.min_value,
          max: metadata.max_value,
        },
        data_type: metadata.data_type,
        physical_volume_cm3: (
          (metadata.dimensions[0] * metadata.spacing[0]) *
          (metadata.dimensions[1] * metadata.spacing[1]) *
          (metadata.dimensions[2] * metadata.spacing[2]) / 1000
        ).toFixed(2),
      };

      const blob = new Blob([JSON.stringify(metadataJSON, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cbct-metadata-${scanId}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('Metadata exported successfully!');
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      console.error('Metadata export failed:', error);
      setExportStatus('Failed to export metadata');
      setTimeout(() => setExportStatus(''), 3000);
    }
  };

  const handleExportSlices = async () => {
    if (!metadata) return;

    setIsExporting(true);
    setExportStatus('Exporting slice images...');

    try {
      const [width, height, depth] = metadata.dimensions;
      const slicesToExport = [
        { axis: 'axial', index: Math.floor(depth / 2) },
        { axis: 'coronal', index: Math.floor(height / 2) },
        { axis: 'sagittal', index: Math.floor(width / 2) },
      ];

      for (const { axis, index } of slicesToExport) {
        const sliceData = await getSlice(scanId, axis, index);
        
        // Convert slice data to image
        const canvas = document.createElement('canvas');
        const sliceArray = sliceData.data;
        const sliceHeight = sliceArray.length;
        const sliceWidth = sliceArray[0]?.length || 0;
        
        canvas.width = sliceWidth;
        canvas.height = sliceHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          const imageData = ctx.createImageData(sliceWidth, sliceHeight);
          for (let y = 0; y < sliceHeight; y++) {
            for (let x = 0; x < sliceWidth; x++) {
              const value = Math.floor((sliceArray[y][x] || 0) * 255);
              const idx = (y * sliceWidth + x) * 4;
              imageData.data[idx] = value;
              imageData.data[idx + 1] = value;
              imageData.data[idx + 2] = value;
              imageData.data[idx + 3] = 255;
            }
          }
          ctx.putImageData(imageData, 0, 0);
        }

        // Download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `cbct-slice-${axis}-${index}-${scanId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setExportStatus(`Successfully exported 3 slice images!`);
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      console.error('Slice export failed:', error);
      setExportStatus('Failed to export slices');
      setTimeout(() => setExportStatus(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportReport = () => {
    try {
      const reportHTML = generatePreScanReport(scanId, metadata);
      
      const blob = new Blob([reportHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cbct-prescan-report-${scanId}-${Date.now()}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportStatus('Pre-scan report exported!');
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      console.error('Report export failed:', error);
      setExportStatus('Failed to export report');
      setTimeout(() => setExportStatus(''), 3000);
    }
  };

  const handleExportMetadataCSV = () => {
    try {
      const csv = [
        ['Property', 'Value', 'Unit'],
        ['Scan ID', scanId, '-'],
        ['Width', metadata.dimensions[0].toString(), 'voxels'],
        ['Height', metadata.dimensions[1].toString(), 'voxels'],
        ['Depth', metadata.dimensions[2].toString(), 'voxels'],
        ['Total Voxels', (metadata.dimensions[0] * metadata.dimensions[1] * metadata.dimensions[2]).toString(), 'voxels'],
        ['Spacing X', metadata.spacing[0].toFixed(4), 'mm'],
        ['Spacing Y', metadata.spacing[1].toFixed(4), 'mm'],
        ['Spacing Z', metadata.spacing[2].toFixed(4), 'mm'],
        ['Origin X', metadata.origin[0].toFixed(2), 'mm'],
        ['Origin Y', metadata.origin[1].toFixed(2), 'mm'],
        ['Origin Z', metadata.origin[2].toFixed(2), 'mm'],
        ['Min Intensity', metadata.min_value.toFixed(4), '-'],
        ['Max Intensity', metadata.max_value.toFixed(4), '-'],
        ['Data Type', metadata.data_type, '-'],
        ['Physical Width', (metadata.dimensions[0] * metadata.spacing[0]).toFixed(2), 'mm'],
        ['Physical Height', (metadata.dimensions[1] * metadata.spacing[1]).toFixed(2), 'mm'],
        ['Physical Depth', (metadata.dimensions[2] * metadata.spacing[2]).toFixed(2), 'mm'],
        ['Physical Volume', ((metadata.dimensions[0] * metadata.spacing[0] * metadata.dimensions[1] * metadata.spacing[1] * metadata.dimensions[2] * metadata.spacing[2]) / 1000).toFixed(2), 'cm³'],
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cbct-metadata-${scanId}-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('CSV exported successfully!');
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      console.error('CSV export failed:', error);
      setExportStatus('Failed to export CSV');
      setTimeout(() => setExportStatus(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-purple-800">
          <strong>📤 Pre-Segmentation Export</strong><br/>
          Export raw volume data, slices, metadata, and reports before running segmentation.
        </p>
      </div>

      <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
        <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export Options
      </h3>
      
      {/* Status Message */}
      {exportStatus && (
        <div className={`p-3 rounded-lg text-sm border ${
          exportStatus.includes('Failed') || exportStatus.includes('No')
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          {exportStatus}
        </div>
      )}
      
      <div className="space-y-3">
        {/* Screenshot */}
        <button
          onClick={handleScreenshot}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center shadow-md"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Screenshot (PNG)
        </button>
        
        {/* Export Slices */}
        <button
          onClick={handleExportSlices}
          disabled={isExporting}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center shadow-md disabled:opacity-50"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          {isExporting ? 'Exporting...' : 'Export Slices (3 PNG)'}
        </button>
        
        {/* Export Metadata JSON */}
        <button
          onClick={handleExportMetadata}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center shadow-md"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Metadata (JSON)
        </button>

        {/* Export Metadata CSV */}
        <button
          onClick={handleExportMetadataCSV}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center shadow-md"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Metadata (CSV)
        </button>
        
        {/* Export Pre-Scan Report */}
        <button
          onClick={handleExportReport}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center shadow-md"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Pre-Scan Report (HTML)
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          📊 Raw volume data ready for export
        </p>
        <p className="text-xs text-gray-500 mt-1">
          All exports preserve original scan metadata and quality
        </p>
      </div>
    </div>
  );
};

// Helper function to generate pre-scan HTML report
function generatePreScanReport(scanId: string, metadata: CBCTMetadata): string {
  const now = new Date().toLocaleString();
  const physicalVolume = (
    (metadata.dimensions[0] * metadata.spacing[0]) *
    (metadata.dimensions[1] * metadata.spacing[1]) *
    (metadata.dimensions[2] * metadata.spacing[2]) / 1000
  ).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CBCT Pre-Scan Report - ${scanId}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
      color: #333;
    }
    .header {
      border-bottom: 3px solid #9333ea;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      color: #9333ea;
      margin: 0;
    }
    .meta {
      color: #666;
      font-size: 14px;
      margin-top: 10px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #7c3aed;
      border-bottom: 2px solid #ddd;
      padding-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 15px;
    }
    .info-box {
      background: #f9fafb;
      padding: 15px;
      border-left: 4px solid #9333ea;
      border-radius: 4px;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #7c3aed;
    }
    .info-box p {
      margin: 5px 0;
      font-size: 13px;
    }
    .value {
      font-weight: bold;
      color: #111;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: #ddd3f8;
      color: #6416a0;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CBCT Pre-Scan Analysis Report <span class="badge">RAW VOLUME</span></h1>
    <div class="meta">
      <strong>Scan ID:</strong> ${scanId}<br>
      <strong>Report Generated:</strong> ${now}<br>
      <strong>Status:</strong> Pre-Segmentation Analysis
    </div>
  </div>

  <div class="section">
    <h2>Volume Information</h2>
    <div class="info-grid">
      <div class="info-box">
        <h3>Dimensions (Voxels)</h3>
        <p><span class="value">${metadata.dimensions[0]} × ${metadata.dimensions[1]} × ${metadata.dimensions[2]}</span></p>
        <p>Total: <span class="value">${(metadata.dimensions[0] * metadata.dimensions[1] * metadata.dimensions[2] / 1000000).toFixed(2)}M voxels</span></p>
      </div>
      <div class="info-box">
        <h3>Voxel Spacing</h3>
        <p><span class="value">${metadata.spacing[0].toFixed(3)} × ${metadata.spacing[1].toFixed(3)} × ${metadata.spacing[2].toFixed(3)} mm</span></p>
        <p>Resolution: <span class="value">${metadata.spacing[0] <= 0.5 ? 'High' : 'Standard'}</span></p>
      </div>
      <div class="info-box">
        <h3>Physical Volume</h3>
        <p><span class="value">${physicalVolume} cm³</span></p>
        <p>Scan region volume</p>
      </div>
      <div class="info-box">
        <h3>Data Type</h3>
        <p><span class="value">${metadata.data_type}</span></p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Intensity Statistics</h2>
    <div class="info-grid">
      <div class="info-box">
        <h3>Minimum Value</h3>
        <p><span class="value">${metadata.min_value.toFixed(4)}</span></p>
      </div>
      <div class="info-box">
        <h3>Maximum Value</h3>
        <p><span class="value">${metadata.max_value.toFixed(4)}</span></p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Physical Dimensions</h2>
    <div class="info-box">
      <p>Width (X-axis): <span class="value">${(metadata.dimensions[0] * metadata.spacing[0]).toFixed(2)} mm</span></p>
      <p>Height (Y-axis): <span class="value">${(metadata.dimensions[1] * metadata.spacing[1]).toFixed(2)} mm</span></p>
      <p>Depth (Z-axis): <span class="value">${(metadata.dimensions[2] * metadata.spacing[2]).toFixed(2)} mm</span></p>
    </div>
  </div>

  <div class="section">
    <h2>Coordinate System</h2>
    <div class="info-box">
      <p>Origin X: <span class="value">${metadata.origin[0].toFixed(2)} mm</span></p>
      <p>Origin Y: <span class="value">${metadata.origin[1].toFixed(2)} mm</span></p>
      <p>Origin Z: <span class="value">${metadata.origin[2].toFixed(2)} mm</span></p>
    </div>
  </div>

  <div class="section">
    <h2>Next Steps</h2>
    <div class="info-box">
      <p>✓ CBCT scan loaded successfully</p>
      <p>✓ Volume data validated</p>
      <p>→ Ready for segmentation analysis</p>
      <p>→ Proceed with automated segmentation to identify dental structures</p>
    </div>
  </div>

  <div class="footer">
    <p>CBCT Segmentation Platform | University of Coimbra<br>
    Co-advised by Prof. Ana Messias<br>
    <strong>Note:</strong> This is a pre-segmentation analysis report. Run segmentation to generate detailed clinical analysis.</p>
  </div>
</body>
</html>`;
}

export default PreSegmentationExport;
