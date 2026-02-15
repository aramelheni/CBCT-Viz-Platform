/**
 * FileUpload Component
 * Handles CBCT file upload with drag-and-drop support
 */

import React, { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isUploading?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected, isUploading = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [sizeWarning, setSizeWarning] = useState<string>('');

  const MAX_FILE_SIZE_MB = 500;

  const validateFile = (file: File): boolean => {
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setSizeWarning(`File is too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return false;
    }
    
    if (fileSizeMB > 100) {
      setSizeWarning(`⚠️ Large file (${fileSizeMB.toFixed(1)}MB). It will be auto-downsampled to prevent crashes.`);
    } else {
      setSizeWarning('');
    }
    
    return true;
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (validateFile(file)) {
          setSelectedFileName(file.name);
          onFileSelected(file);
        }
      }
    },
    [onFileSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (validateFile(file)) {
          setSelectedFileName(file.name);
          onFileSelected(file);
        }
      }
    },
    [onFileSelected]
  );

  return (
    <div className="w-full">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center
          transition-all duration-200
          ${isDragging ? 'border-cbct-primary bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".dcm,.dicom,.nii,.nii.gz"
          onChange={handleFileInput}
          disabled={isUploading}
        />
        
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center space-y-4">
            {/* Upload Icon */}
            <svg
              className={`w-16 h-16 ${isDragging ? 'text-cbct-primary' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>

            {/* Text */}
            <div>
              <p className="text-lg font-medium text-gray-700">
                {isUploading ? 'Uploading...' : 'Drop CBCT file here or click to browse'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supported formats: DICOM (.dcm), NIfTI (.nii, .nii.gz)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                ⚠️ Max file size: 500MB. Large scans will be auto-downsampled to prevent crashes.
              </p>
            </div>

            {/* Selected file name */}
            {selectedFileName && !isUploading && (
              <div className="mt-4 p-3 bg-green-50 rounded-md">
                <p className="text-sm text-green-700">
                  <span className="font-medium">Selected:</span> {selectedFileName}
                </p>
              </div>
            )}

            {/* Size warning */}
            {sizeWarning && (
              <div className={`mt-3 p-3 rounded-md ${sizeWarning.includes('too large') ? 'bg-red-50' : 'bg-yellow-50'}`}>
                <p className={`text-sm ${sizeWarning.includes('too large') ? 'text-red-700' : 'text-yellow-700'}`}>
                  {sizeWarning}
                </p>
              </div>
            )}

            {/* Upload button */}
            <button
              type="button"
              className="mt-4 px-6 py-2 bg-cbct-primary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isUploading}
            >
              {isUploading ? 'Processing...' : 'Select File'}
            </button>
          </div>
        </label>

        {/* Loading spinner */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cbct-primary"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
