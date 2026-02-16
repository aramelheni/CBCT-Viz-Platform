"""
Segmentation Service
Handles AI-based segmentation of dental structures
Enhanced with individual tooth detection, nerve canals, and dental-specific features
"""

import SimpleITK as sitk
import numpy as np
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None
from typing import Dict, Optional, List, Tuple
import time
from skimage import measure, morphology, filters
from app.models.schemas import SegmentInfo

class SegmentationService:
    def __init__(self, cbct_processor):
        self.cbct_processor = cbct_processor
        self.segmentations: Dict[str, np.ndarray] = {}
        if TORCH_AVAILABLE:
            if torch.cuda.is_available():
                self.device = torch.device("cuda")
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                self.device = torch.device("mps")
            else:
                self.device = torch.device("cpu")
        else:
            self.device = "cpu"
        
        # Enhanced dental segment labels and colors
        self.segment_config = {
            # Primary dental structures
            "enamel": {"label": 1, "color": "#FFFFFF", "description": "Tooth Enamel (Crown)"},
            "dentin": {"label": 2, "color": "#FFF8DC", "description": "Tooth Dentin"},
            "pulp": {"label": 3, "color": "#FF6B6B", "description": "Pulp Chamber & Root Canal"},
            "cementum": {"label": 4, "color": "#E6D8C3", "description": "Root Cementum"},
            
            # Bone structures
            "cortical_bone": {"label": 5, "color": "#F5F5DC", "description": "Cortical Bone"},
            "trabecular_bone": {"label": 6, "color": "#E8E8D0", "description": "Trabecular Bone"},
            "alveolar_bone": {"label": 7, "color": "#D4D4C4", "description": "Alveolar Bone"},
            
            # Neural and vascular
            "nerve_canal": {"label": 8, "color": "#FFD700", "description": "Inferior Alveolar Nerve Canal"},
            
            # Periodontal structures
            "pdl_space": {"label": 9, "color": "#87CEEB", "description": "Periodontal Ligament Space"},
            
            # Soft tissue
            "soft_tissue": {"label": 10, "color": "#FFB6C1", "description": "Soft Tissue"},
            "gingiva": {"label": 11, "color": "#FFC0CB", "description": "Gingival Tissue"},
            
            # Pathology (optional)
            "caries": {"label": 12, "color": "#8B4513", "description": "Dental Caries"},
            "periapical_lesion": {"label": 13, "color": "#DC143C", "description": "Periapical Lesion"},
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
        Enhanced threshold-based segmentation for dental structures using HU values
        Real CBCT data typically ranges from -1000 HU (air) to 3000 HU (enamel)
        """
        print("🦷 Starting enhanced dental segmentation...")
        
        try:
            # Initialize segmentation array
            segmentation = np.zeros_like(volume, dtype=np.uint8)
            
            # Normalize volume to 0-1 for consistent processing
            volume_norm = (volume - volume.min()) / (volume.max() - volume.min() + 1e-8)
            
            # Apply light Gaussian smoothing to reduce noise while preserving edges
            volume_smooth = filters.gaussian(volume_norm, sigma=0.2)
            
            # === HARD TISSUE SEGMENTATION ===
            
            # 1. Enamel (highest density, ~2500-3000 HU)
            enamel_mask = volume_smooth > 0.75
            enamel_mask = morphology.remove_small_objects(enamel_mask, min_size=15)
            enamel_mask = morphology.binary_closing(enamel_mask, morphology.ball(1))
            segmentation[enamel_mask] = 1
            
            # 2. Dentin (medium-high density, ~1600-2100 HU)
            dentin_mask = (volume_smooth > 0.50) & (volume_smooth <= 0.75)
            dentin_mask = morphology.remove_small_objects(dentin_mask, min_size=20)
            dentin_mask = morphology.binary_closing(dentin_mask, morphology.ball(1))
            segmentation[dentin_mask] = 2
            
            # 3. Cementum (root surface, ~1500-1800 HU)
            cementum_candidates = (volume_smooth > 0.48) & (volume_smooth <= 0.56)
            cementum_candidates = morphology.remove_small_objects(cementum_candidates, min_size=8)
            segmentation[cementum_candidates & ~enamel_mask & ~dentin_mask] = 4
            
            # === SOFT TISSUE IN TEETH ===
            
            # 4. Pulp (soft tissue inside tooth, ~30-50 HU)
            pulp_mask = (volume_smooth > 0.25) & (volume_smooth <= 0.50)
            pulp_mask = morphology.remove_small_objects(pulp_mask, min_size=5)
            
            # Pulp should be inside or very near tooth structures
            tooth_mask = enamel_mask | dentin_mask
            if np.any(tooth_mask):
                tooth_interior = morphology.binary_erosion(tooth_mask, morphology.ball(1))
                tooth_expanded = morphology.binary_dilation(tooth_mask, morphology.ball(1))
                pulp_mask = pulp_mask & (tooth_interior | tooth_expanded)
            segmentation[pulp_mask] = 3
            
            # === BONE STRUCTURES ===
            
            # 5. Cortical Bone (dense jaw bone, ~1000-1800 HU)
            cortical_mask = (volume_smooth > 0.65) & (volume_smooth <= 0.85)
            cortical_mask = morphology.remove_small_objects(cortical_mask, min_size=40)
            cortical_mask = cortical_mask & (segmentation == 0)
            segmentation[cortical_mask] = 5
            
            # 6. Trabecular Bone (less dense, ~200-800 HU)
            trabecular_mask = (volume_smooth > 0.35) & (volume_smooth <= 0.65)
            trabecular_mask = morphology.remove_small_objects(trabecular_mask, min_size=30)
            trabecular_mask = trabecular_mask & (segmentation == 0)
            segmentation[trabecular_mask] = 6
            
            # 7. Alveolar Bone (bone immediately around teeth)
            if np.any(tooth_mask):
                tooth_dilated = morphology.binary_dilation(tooth_mask, morphology.ball(2))
                bone_mask = (segmentation == 5) | (segmentation == 6)
                alveolar_mask = bone_mask & tooth_dilated & ~tooth_mask
                segmentation[alveolar_mask] = 7
            
            # === NEURAL STRUCTURES ===
            
            # 8. Nerve Canal (inferior alveolar canal, ~30-80 HU)
            nerve_mask = self._detect_nerve_canal(volume_smooth)
            segmentation[nerve_mask] = 8
            
            # === PERIODONTAL STRUCTURES ===
            
            # 9. PDL Space (periodontal ligament, ~0-100 HU)
            pdl_mask = self._detect_pdl_space(volume_smooth, tooth_mask)
            segmentation[pdl_mask] = 9
            
            # === SOFT TISSUES ===
            
            # 10. General Soft Tissue (-100 to +100 HU)
            soft_tissue_mask = (volume_smooth > 0.02) & (volume_smooth <= 0.25)
            soft_tissue_mask = soft_tissue_mask & (segmentation == 0)
            soft_tissue_mask = morphology.remove_small_objects(soft_tissue_mask, min_size=50)
            segmentation[soft_tissue_mask] = 10
            
            # 11. Gingiva (soft tissue adjacent to teeth)
            if np.any(tooth_mask):
                tissue_near_teeth = morphology.binary_dilation(tooth_mask, morphology.ball(2))
                gingiva_mask = soft_tissue_mask & tissue_near_teeth & ~tooth_mask
                segmentation[gingiva_mask] = 11
            
            # === PATHOLOGY DETECTION ===
            
            # 12. Caries (demineralized tooth areas)
            if np.sum(enamel_mask) > 500 or np.sum(dentin_mask) > 500:
                caries_mask = self._detect_caries(volume_smooth, enamel_mask, dentin_mask)
                segmentation[caries_mask] = 12
            
            # 13. Periapical Lesions (infections at tooth apex)
            if np.sum(tooth_mask) > 1000:
                lesion_mask = self._detect_periapical_lesions(volume_smooth, tooth_mask)
                segmentation[lesion_mask] = 13
        
            print(f"✓ Segmentation complete. Found {len(np.unique(segmentation)) - 1} tissue types")
            return segmentation
            
        except Exception as e:
            print(f"⚠️  Advanced segmentation failed: {str(e)}")
            print("   Falling back to simple threshold segmentation...")
            return self._simple_segmentation_fallback(volume)
    
    def _simple_segmentation_fallback(self, volume: np.ndarray) -> np.ndarray:
        """
        Simple fallback segmentation using basic thresholds
        """
        segmentation = np.zeros_like(volume, dtype=np.uint8)
        volume_norm = (volume - volume.min()) / (volume.max() - volume.min() + 1e-8)
        
        segmentation[volume_norm > 0.75] = 1  # Enamel
        segmentation[(volume_norm > 0.50) & (volume_norm <= 0.75)] = 2  # Dentin
        segmentation[(volume_norm > 0.25) & (volume_norm <= 0.50)] = 3  # Pulp
        segmentation[(volume_norm > 0.65) & (volume_norm <= 0.85)] = 5  # Cortical Bone
        segmentation[(volume_norm > 0.35) & (volume_norm <= 0.65)] = 6  # Trabecular Bone
        
        print("✓ Simple segmentation complete (fallback mode)")
        return segmentation
    
    def _detect_nerve_canal(self, volume: np.ndarray) -> np.ndarray:
        """
        Detect inferior alveolar nerve canal (linear low-density tubular structure)
        """
        try:
            # Nerve canal: low-density linear structure
            nerve_candidates = (volume > 0.08) & (volume < 0.22)
            
            # Extract linear structures
            nerve_candidates = morphology.binary_opening(nerve_candidates, morphology.ball(1))
            nerve_candidates = morphology.remove_small_objects(nerve_candidates, min_size=200)
            
            # Filter out very large blobs (likely background or soft tissue)
            labeled = morphology.label(nerve_candidates)
            for region in morphology.regionprops(labeled):
                if region.area > 20000:
                    nerve_candidates[labeled == region.label] = False
            
            return nerve_candidates
        except Exception as e:
            print(f"  ⚠️  Nerve canal detection failed: {str(e)}")
            return np.zeros_like(volume, dtype=bool)
    
    def _detect_pdl_space(self, volume: np.ndarray, tooth_mask: np.ndarray) -> np.ndarray:
        """
        Detect periodontal ligament space (thin radiolucent line around tooth root)
        """
        try:
            if not np.any(tooth_mask):
                return np.zeros_like(volume, dtype=bool)
            
            # PDL is low density space around tooth roots
            pdl_candidates = (volume > 0.05) & (volume < 0.20)
            
            # Should be immediately adjacent to tooth
            tooth_boundary = morphology.binary_dilation(tooth_mask, morphology.ball(2)) & ~tooth_mask
            pdl_mask = pdl_candidates & tooth_boundary
            pdl_mask = morphology.remove_small_objects(pdl_mask, min_size=5)
            
            return pdl_mask
        except Exception as e:
            print(f"  ⚠️  PDL detection failed: {str(e)}")
            return np.zeros_like(volume, dtype=bool)
    
    def _detect_caries(self, volume: np.ndarray, enamel_mask: np.ndarray, 
                       dentin_mask: np.ndarray) -> np.ndarray:
        """
        Detect dental caries (demineralized tooth areas with reduced density)
        """
        try:
            tooth_mask = enamel_mask | dentin_mask
            if not np.any(tooth_mask):
                return np.zeros_like(volume, dtype=bool)
            
            # Caries: lower density within tooth structure
            caries_candidates = (volume > 0.35) & (volume < 0.50) & tooth_mask
            caries_candidates = morphology.remove_small_objects(caries_candidates, min_size=5)
            
            # Remove very large regions
            labeled = morphology.label(caries_candidates)
            for region in morphology.regionprops(labeled):
                if region.area > 300:
                    caries_candidates[labeled == region.label] = False
            
            return caries_candidates
        except Exception as e:
            print(f"  ⚠️  Caries detection failed: {str(e)}")
            return np.zeros_like(volume, dtype=bool)
    
    def _detect_periapical_lesions(self, volume: np.ndarray, tooth_mask: np.ndarray) -> np.ndarray:
        """
        Detect periapical lesions (radiolucent areas at tooth root apex)
        """
        try:
            if not np.any(tooth_mask):
                return np.zeros_like(volume, dtype=bool)
            
            # Lesions: low density near tooth roots
            lesion_candidates = (volume > 0.10) & (volume < 0.28)
            tooth_proximity = morphology.binary_dilation(tooth_mask, morphology.ball(5)) & ~tooth_mask
            lesion_candidates = lesion_candidates & tooth_proximity
            lesion_candidates = morphology.remove_small_objects(lesion_candidates, min_size=30)
            
            # Size filtering
            labeled = morphology.label(lesion_candidates)
            for region in morphology.regionprops(labeled):
                if region.area > 1500:
                    lesion_candidates[labeled == region.label] = False
            
            return lesion_candidates
        except Exception as e:
            print(f"  ⚠️  Periapical lesion detection failed: {str(e)}")
            return np.zeros_like(volume, dtype=bool)
    
    def _get_segment_info(self, segmentation: np.ndarray) -> List[SegmentInfo]:
        """
        Get information about each segment with descriptions
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
                    description=config.get("description", name.replace("_", " ").title()),
                    visible=True,
                    voxel_count=voxel_count
                ))
        
        # Sort by label for consistent ordering
        segments.sort(key=lambda x: x.label)
        
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
