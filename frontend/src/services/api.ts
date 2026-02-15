/**
 * API Service for CBCT Platform
 * Handles all communication with the backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface CBCTMetadata {
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  data_type: string;
  min_value: number;
  max_value: number;
}

export interface CBCTUploadResponse {
  scan_id: string;
  filename: string;
  metadata: CBCTMetadata;
  message: string;
}

export interface SegmentInfo {
  name: string;
  label: number;
  color: string;
  visible: boolean;
  voxel_count?: number;
}

export interface SegmentationResponse {
  scan_id: string;
  segmentation_id: string;
  segments: SegmentInfo[];
  processing_time: number;
  message: string;
}

export interface MeshData {
  segment_name: string;
  vertices: number[][];
  faces: number[][];
  normals: number[][];
}

// CBCT Operations
export const uploadCBCT = async (file: File): Promise<CBCTUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/api/cbct/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const getCBCTMetadata = async (scanId: string): Promise<CBCTMetadata> => {
  const response = await api.get(`/api/cbct/${scanId}/metadata`);
  return response.data;
};

export const getVolumeData = async (scanId: string, quality: string = 'low') => {
  const response = await api.get(`/api/cbct/${scanId}/volume`, {
    params: { quality }
  });
  return response.data;
};

export const getSlice = async (scanId: string, axis: string, index: number) => {
  const response = await api.get(`/api/cbct/${scanId}/slice/${axis}/${index}`);
  return response.data;
};

// Segmentation Operations
export const performSegmentation = async (
  scanId: string,
  modelType: string = 'nnunet'
): Promise<SegmentationResponse> => {
  const response = await api.post(`/api/segmentation/${scanId}/segment`, {
    model_type: modelType,
  });
  return response.data;
};

export const getSegments = async (scanId: string) => {
  const response = await api.get(`/api/segmentation/${scanId}/segments`);
  return response.data;
};

export const getSegmentData = async (scanId: string, segmentName: string) => {
  const response = await api.get(`/api/segmentation/${scanId}/segment/${segmentName}`);
  return response.data;
};

export const getSegmentMesh = async (scanId: string, segmentName: string): Promise<MeshData> => {
  const response = await api.get(`/api/segmentation/${scanId}/segment/${segmentName}/mesh`);
  return response.data;
};

export const toggleSegmentVisibility = async (
  scanId: string,
  segmentName: string,
  visible: boolean
) => {
  const response = await api.post(`/api/segmentation/${scanId}/toggle-segment`, null, {
    params: { segment_name: segmentName, visible },
  });
  return response.data;
};

// Visualization Operations
export const getColorMap = async (scanId: string) => {
  const response = await api.get(`/api/visualization/${scanId}/color-map`);
  return response.data;
};

export const getRenderingPresets = async () => {
  const response = await api.get('/api/visualization/presets');
  return response.data;
};

export default api;
