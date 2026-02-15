"""
Segmentation Service
Handles AI-based segmentation of dental structures
"""

import SimpleITK as sitk
import numpy as np
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None
from typing import Dict, Optional, List
import time
from skimage import measure
from app.models.schemas import SegmentInfo

class SegmentationService:
    def __init__(self, cbct_processor):
        self.cbct_processor = cbct_processor
        self.segmentations: Dict[str, np.ndarray] = {}
        if TORCH_AVAILABLE:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = "cpu"
        
        # Segment labels and colors
        self.segment_config = {
            "enamel": {"label": 1, "color": "#E8F4F8"},
            "dentin": {"label": 2, "color": "#FFF8DC"},
            "pulp": {"label": 3, "color": "#FF6B6B"},
            "bone": {"label": 4, "color": "#F5F5DC"},
            "soft_tissue": {"label": 5, "color": "#FFB6C1"},
        }
    
    async def segment(self, scan_id: str, model_type: str = "nnunet") -> Dict:
        """
        Perform segmentation on CBCT scan
        """
        start_time = time.time()
        
        try:
            # Get volume from storage
            volume = self.cbct_processor.get_volume(scan_id)
            if volume is None:
                raise ValueError(f"CBCT scan {scan_id} not found")
            
            # Convert to numpy array
            volume_array = sitk.GetArrayFromImage(volume)
            
            # Perform segmentation based on model type
            if model_type == "nnunet":
                segmentation = await self._segment_nnunet(volume_array)
            elif model_type == "dhunet":
                segmentation = await self._segment_dhunet(volume_array)
            else:
                # Fallback to rule-based segmentation (for demo)
                segmentation = await self._segment_threshold_based(volume_array)
            
            # Store segmentation
            segmentation_id = f"{scan_id}_seg"
            self.segmentations[segmentation_id] = segmentation
            
            # Get segment information
            segments = self._get_segment_info(segmentation)
            
            processing_time = time.time() - start_time
            
            return {
                "segmentation_id": segmentation_id,
                "segments": segments,
                "processing_time": processing_time
            }
        
        except Exception as e:
            raise Exception(f"Segmentation failed: {str(e)}")
    
    async def _segment_nnunet(self, volume: np.ndarray) -> np.ndarray:
        """
        Segment using nnU-Net model
        Note: In production, this would load a trained model
        """
        # Placeholder for nnU-Net inference
        # For now, use threshold-based segmentation as demo
        return await self._segment_threshold_based(volume)
    
    async def _segment_dhunet(self, volume: np.ndarray) -> np.ndarray:
        """
        Segment using DHU-Net model
        """
        # Placeholder for DHU-Net inference
        return await self._segment_threshold_based(volume)
    
    async def _segment_threshold_based(self, volume: np.ndarray) -> np.ndarray:
        """
        Simple threshold-based segmentation for demonstration
        """
        # Initialize segmentation array
        segmentation = np.zeros_like(volume, dtype=np.uint8)
        
        # Normalize volume to 0-1
        volume_norm = (volume - volume.min()) / (volume.max() - volume.min() + 1e-8)
        
        # Simple thresholding (this is simplified; real segmentation uses deep learning)
        # Enamel (highest density)
        segmentation[volume_norm > 0.8] = 1
        
        # Dentin (medium-high density)
        segmentation[(volume_norm > 0.5) & (volume_norm <= 0.8)] = 2
        
        # Pulp (low density, central)
        segmentation[(volume_norm > 0.2) & (volume_norm <= 0.5)] = 3
        
        # Bone (medium density)
        segmentation[(volume_norm > 0.6) & (volume_norm <= 0.75)] = 4
        
        # Soft tissue (very low density)
        segmentation[(volume_norm > 0.1) & (volume_norm <= 0.3)] = 5
        
        return segmentation
    
    def _get_segment_info(self, segmentation: np.ndarray) -> List[SegmentInfo]:
        """
        Get information about each segment
        """
        segments = []
        
        for name, config in self.segment_config.items():
            label = config["label"]
            voxel_count = int(np.sum(segmentation == label))
            
            if voxel_count > 0:
                segments.append(SegmentInfo(
                    name=name,
                    label=label,
                    color=config["color"],
                    visible=True,
                    voxel_count=voxel_count
                ))
        
        return segments
    
    async def get_segments(self, scan_id: str) -> Optional[Dict]:
        """
        Get all segments for a scan
        """
        segmentation_id = f"{scan_id}_seg"
        
        if segmentation_id not in self.segmentations:
            return None
        
        segmentation = self.segmentations[segmentation_id]
        segments = self._get_segment_info(segmentation)
        
        return {
            "segmentation_id": segmentation_id,
            "segments": [seg.dict() for seg in segments]
        }
    
    async def get_segment_data(self, scan_id: str, segment_name: str) -> Optional[np.ndarray]:
        """
        Get data for a specific segment
        """
        segmentation_id = f"{scan_id}_seg"
        
        if segmentation_id not in self.segmentations:
            return None
        
        if segment_name not in self.segment_config:
            return None
        
        segmentation = self.segmentations[segmentation_id]
        label = self.segment_config[segment_name]["label"]
        
        # Create binary mask for this segment
        segment_mask = (segmentation == label).astype(np.uint8)
        
        return segment_mask
    
    async def get_segment_mesh(self, scan_id: str, segment_name: str) -> Optional[Dict]:
        """
        Generate 3D mesh from segment using marching cubes
        """
        segment_data = await self.get_segment_data(scan_id, segment_name)
        
        if segment_data is None:
            return None
        
        try:
            # Use marching cubes to generate mesh
            verts, faces, normals, _ = measure.marching_cubes(
                segment_data, 
                level=0.5,
                step_size=2  # Downsample for performance
            )
            
            return {
                "vertices": verts.tolist(),
                "faces": faces.tolist(),
                "normals": normals.tolist()
            }
        
        except Exception as e:
            print(f"Error generating mesh: {str(e)}")
            return None
    
    async def toggle_segment(self, scan_id: str, segment_name: str, visible: bool) -> Dict:
        """
        Toggle segment visibility
        """
        # In a full implementation, this would update a database
        return {
            "segment_name": segment_name,
            "visible": visible
        }
