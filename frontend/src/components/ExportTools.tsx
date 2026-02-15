/**
 * ExportTools Component  
 * Export capabilities for screenshots, meshes, and reports
 */

import React, { useState } from 'react';
import { getSegmentMesh } from '../services/api';

interface ExportToolsProps {
  scanId: string;
  segments: string[];
}

const ExportTools: React.FC<ExportToolsProps> = ({ scanId, segments }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');

  const handleScreenshot = () => {
    console.log('📸 Screenshot requested');
    
    // Wait for next animation frame to ensure scene is rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        console.log('Canvas found:', canvas !== null);
        
        if (!canvas) {
          console.error('No canvas element found in DOM');
          setExportStatus('No 3D viewer found.');
          setTimeout(() => setExportStatus(''), 3000);
          return;
        }

        try {
          console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
          
          // Get canvas context to check if it has content
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (gl) {
            console.log('WebGL context found');
          }
          
          // Create a high-quality image with maximum quality
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          console.log('DataURL created, length:', dataUrl.length);
          console.log('DataURL prefix:', dataUrl.substring(0, 50));
          
          if (dataUrl === 'data:,' || dataUrl.length < 100) {
            console.error('Canvas is empty or tainted, dataURL:', dataUrl.substring(0, 100));
            setExportStatus('Screenshot failed: Canvas is empty');
            setTimeout(() => setExportStatus(''), 3000);
            return;
          }
          
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `cbct-scan-${scanId}-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          console.log('✅ Screenshot saved successfully!');
          setExportStatus('Screenshot saved successfully!');
          setTimeout(() => setExportStatus(''), 3000);
        } catch (error) {
          console.error('Screenshot failed:', error);
          setExportStatus(`Failed to capture screenshot: ${error}`);
          setTimeout(() => setExportStatus(''), 3000);
        }
      });
    });
  };

  const handleExportSTL = async () => {
    if (segments.length === 0) {
      setExportStatus('No segments to export.');
      setTimeout(() => setExportStatus(''), 3000);
      return;
    }

    setIsExporting(true);
    setExportStatus('Exporting STL files...');

    try {
      // Export each segment as a separate STL file
      for (const segmentName of segments) {
        const meshData = await getSegmentMesh(scanId, segmentName);
        const stlContent = convertMeshToSTL(meshData);
        
        // Create download
        const blob = new Blob([stlContent], { type: 'application/sla' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${scanId}-${segmentName}.stl`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      setExportStatus(`Successfully exported ${segments.length} STL file(s)!`);
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      console.error('STL export failed:', error);
      setExportStatus('Failed to export STL files.');
      setTimeout(() => setExportStatus(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportReport = () => {
    try {
      // Generate HTML report
      const reportHTML = generateHTMLReport(scanId, segments);
      
      // Create blob and download
      const blob = new Blob([reportHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cbct-report-${scanId}-${Date.now()}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportStatus('Report exported successfully!');
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      console.error('Report export failed:', error);
      setExportStatus('Failed to export report.');
      setTimeout(() => setExportStatus(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
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
        <button
          onClick={handleScreenshot}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center shadow-md"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Screenshot
        </button>
        
        <button
          onClick={handleExportSTL}
          disabled={isExporting || segments.length === 0}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          {isExporting ? 'Exporting...' : 'Export STL (3D Print)'}
        </button>
        
        <button
          onClick={handleExportReport}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center shadow-md"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Clinical Report (HTML)
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          📤 {segments.length} segment{segments.length !== 1 ? 's' : ''} ready for export
        </p>
      </div>
    </div>
  );
};

// Helper function to convert mesh data to STL format (ASCII)
function convertMeshToSTL(meshData: any): string {
  let stl = 'solid mesh\n';
  
  const vertices = meshData.vertices;
  const faces = meshData.faces;
  
  // Process each face (triangle)
  for (const face of faces) {
    const v1 = vertices[face[0]];
    const v2 = vertices[face[1]];
    const v3 = vertices[face[2]];
    
    // Calculate normal (simple cross product)
    const u = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
    const v = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
    const normal = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0]
    ];
    
    // Normalize
    const length = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
    if (length > 0) {
      normal[0] /= length;
      normal[1] /= length;
      normal[2] /= length;
    }
    
    stl += `  facet normal ${normal[0]} ${normal[1]} ${normal[2]}\n`;
    stl += '    outer loop\n';
    stl += `      vertex ${v1[0]} ${v1[1]} ${v1[2]}\n`;
    stl += `      vertex ${v2[0]} ${v2[1]} ${v2[2]}\n`;
    stl += `      vertex ${v3[0]} ${v3[1]} ${v3[2]}\n`;
    stl += '    endloop\n';
    stl += '  endfacet\n';
  }
  
  stl += 'endsolid mesh\n';
  return stl;
}

// Helper function to generate HTML report
function generateHTMLReport(scanId: string, segments: string[]): string {
  const now = new Date().toLocaleString();
  
  return` <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CBCT Clinical Report - ${scanId}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
      color: #333;
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      color: #2563eb;
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
      color: #1e40af;
      border-bottom: 2px solid #ddd;
      padding-bottom: 10px;
    }
    .segment-list {
      list-style: none;
      padding: 0;
    }
    .segment-list li {
      padding: 8px;
      background: #f3f4f6;
      margin-bottom: 5px;
      border-left: 4px solid #2563eb;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CBCT Clinical Report</h1>
    <div class="meta">
      <strong>Scan ID:</strong> ${scanId}<br>
      <strong>Report Generated:</strong> ${now}
    </div>
  </div>

  <div class="section">
    <h2>Segmentation Results</h2>
    <p><strong>Total Segments Identified:</strong> ${segments.length}</p>
    <ul class="segment-list">
      ${segments.map(seg => `<li>${seg.replace(/_/g, ' ').toUpperCase()}</li>`).join('\n      ')}
    </ul>
  </div>

  <div class="section">
    <h2>Clinical Notes</h2>
    <p>This is an automated segmentation report generated by the CBCT Segmentation Platform. 
    The segmentation was performed using deep learning-based models (nnU-Net/DHU-Net).</p>
    <p><strong>Important:</strong> Please review all segmentations for clinical accuracy before making treatment decisions.</p>
  </div>

  <div class="footer">
    <p>CBCT Segmentation Platform | University of Coimbra<br>
    Co-advised by Prof. Ana Messias</p>
  </div>
</body>
</html>`;
}

export default ExportTools;

