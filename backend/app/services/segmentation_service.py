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
from typing import Dict, Optional, List
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
            "pulp_root_canal": {"label": 3, "color": "#FF6B6B", "description": "Pulp Chamber & Root Canal"},
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
        Adaptive processing based on volume size and complexity
        """
        print("🦷 Starting enhanced dental segmentation...")
        
        try:
            # Initialize segmentation array
            segmentation = np.zeros_like(volume, dtype=np.uint8)
            
            # Normalize volume to 0-1 for consistent processing
            volume_norm = (volume - volume.min()) / (volume.max() - volume.min() + 1e-8)
            
            # === ADAPTIVE PARAMETERS BASED ON VOLUME SIZE ===
            volume_size = volume.size
            volume_shape = volume.shape
            
            # Adaptive smoothing: moderate smoothing to reduce noise without destroying fine structures
            if volume_size > 100_000_000:  # Very large scans (>100M voxels)
                sigma = 0.35
                min_object_scale = 50
                ball_size = 2
            elif volume_size > 20_000_000:  # Large scans (20-100M voxels)
                sigma = 0.3
                min_object_scale = 30
                ball_size = 1
            elif volume_size > 5_000_000:  # Medium scans (5-20M voxels)
                sigma = 0.25
                min_object_scale = 20
                ball_size = 1
            else:  # Small scans (<5M voxels)
                sigma = 0.2
                min_object_scale = 10
                ball_size = 1
            
            print(f"  📊 Volume: {volume_shape}, {volume_size:,} voxels")
            print(f"  ⚙️  Adaptive params: σ={sigma}, min_scale={min_object_scale}, ball={ball_size}")
            
            # Apply adaptive Gaussian smoothing
            volume_smooth = filters.gaussian(volume_norm, sigma=sigma)
            
            # === DENTAL ARCH REGION DETECTION ===
            # Identify where teeth are actually located to separate them from skull/jaw bones
            dental_arch_mask = self._detect_dental_arch_region(volume_smooth, volume_shape)
            
            # === ADAPTIVE THRESHOLD CALCULATION ===
            # Use percentiles for more adaptive detection instead of hardcoded thresholds
            print("  📊 Calculating adaptive thresholds from data...")
            high_density_threshold = np.percentile(volume_smooth[volume_smooth > 0.3], 88)  # Top 12% (was 10%) - more lenient
            medium_density_threshold = np.percentile(volume_smooth[volume_smooth > 0.2], 65)  # 65th percentile (was 70%) - more lenient
            print(f"    High-density threshold (enamel): {high_density_threshold:.3f}")
            print(f"    Medium-density threshold (dentin): {medium_density_threshold:.3f}")
            
            # === HARD TISSUE SEGMENTATION ===
            
            # 1. Enamel (highest density structures) - ONLY in dental arch region
            enamel_mask = volume_smooth > max(high_density_threshold, 0.58)
            enamel_mask = enamel_mask & dental_arch_mask
            enamel_mask = morphology.remove_small_objects(enamel_mask, min_size=min_object_scale)
            enamel_mask = morphology.binary_closing(enamel_mask, morphology.ball(ball_size))
            segmentation[enamel_mask] = 1
            print(f"    Enamel detected: {np.sum(enamel_mask):,} voxels")
            
            # 2. Dentin (medium-high density) - ONLY in dental arch region
            dentin_mask = (volume_smooth > max(medium_density_threshold, 0.42)) & (volume_smooth <= max(high_density_threshold, 0.58))
            dentin_mask = dentin_mask & dental_arch_mask
            dentin_mask = morphology.remove_small_objects(dentin_mask, min_size=min_object_scale)
            dentin_mask = morphology.binary_closing(dentin_mask, morphology.ball(ball_size))
            segmentation[dentin_mask] = 2
            print(f"    Dentin detected: {np.sum(dentin_mask):,} voxels")
            
            # === SOFT TISSUE IN TEETH ===
            
            # 3. Pulp/Root Canal (soft tissue INSIDE tooth) - STRICTLY limited to inside teeth ONLY
            tooth_mask = enamel_mask | dentin_mask
            
            # CRITICAL: Only detect pulp if we actually found teeth first!
            if np.any(tooth_mask):
                # Pulp is low-medium density tissue ENCLOSED by hard tooth structure
                pulp_candidates = (volume_smooth > 0.15) & (volume_smooth <= max(medium_density_threshold, 0.48))
                pulp_candidates = morphology.remove_small_objects(pulp_candidates, min_size=max(3, min_object_scale // 4))
                
                # Pulp MUST be INSIDE tooth structures - use erosion + closing to find interior
                # Fill the tooth to find what's enclosed inside it
                tooth_filled = morphology.binary_closing(tooth_mask, morphology.ball(max(2, ball_size * 2)))
                tooth_interior = tooth_filled & ~tooth_mask  # The holes/interior of teeth
                
                # Also include a thin erosion layer as interior
                tooth_eroded = morphology.binary_erosion(tooth_mask, morphology.ball(max(1, ball_size)))
                if np.any(tooth_eroded):
                    tooth_interior = tooth_interior | tooth_eroded
                
                # Expand interior slightly to capture the full pulp chamber
                tooth_interior_expanded = morphology.binary_dilation(tooth_interior, morphology.ball(max(1, ball_size)))
                
                # Pulp must be in interior AND in dental arch AND correct density
                pulp_mask = pulp_candidates & tooth_interior_expanded & dental_arch_mask
                
                # Safety cap: pulp should be at most ~25% of total tooth hard tissue (anatomically ~10-20%)
                max_pulp_voxels = int(np.sum(tooth_mask) * 0.25)
                if np.sum(pulp_mask) > max_pulp_voxels:
                    # Keep only the most interior voxels by distance from tooth surface
                    from scipy import ndimage
                    dist_from_tooth = ndimage.distance_transform_edt(~tooth_mask)
                    pulp_distances = dist_from_tooth[pulp_mask]
                    if len(pulp_distances) > 0:
                        # Keep voxels closest to interior (smallest distance from tooth)
                        cutoff_dist = np.percentile(pulp_distances, 100 * max_pulp_voxels / np.sum(pulp_mask))
                        pulp_mask = pulp_mask & (dist_from_tooth <= cutoff_dist)
                    print(f"    Pulp capped to {np.sum(pulp_mask):,} voxels (max {max_pulp_voxels:,})")
                
                segmentation[pulp_mask] = 3
                print(f"    Pulp/Root Canal detected: {np.sum(pulp_mask):,} voxels (inside {np.sum(tooth_mask):,} tooth voxels)")
            else:
                print("    No teeth detected - skipping pulp detection")
            
            # === TOOTH ROOT STRUCTURES ===
            
            # 4. Cementum (thin layer coating tooth roots, similar density to dentin but on outer root surface)
            if np.any(tooth_mask):
                # Cementum has medium density, slightly lower than dentin
                # Wider density range to capture the full layer
                cementum_low = max(medium_density_threshold * 0.70, 0.32)
                cementum_high = max(medium_density_threshold * 1.05, 0.52)
                cementum_mask = (volume_smooth > cementum_low) & (volume_smooth <= cementum_high)
                
                # Cementum is a thin shell AROUND tooth roots — use a 2-voxel shell
                # to capture the actual thin layer that wraps the root surface
                shell_radius = max(2, ball_size + 1)
                tooth_outer_shell = morphology.binary_dilation(tooth_mask, morphology.ball(shell_radius)) & ~tooth_mask
                cementum_mask = cementum_mask & tooth_outer_shell & dental_arch_mask
                cementum_mask = cementum_mask & (segmentation == 0)  # Don't overwrite existing
                cementum_mask = morphology.remove_small_objects(cementum_mask, min_size=max(3, min_object_scale // 4))
                segmentation[cementum_mask] = 4
                print(f"    Cementum detected: {np.sum(cementum_mask):,} voxels")
            
            # === BONE STRUCTURES (GLOBAL - includes jaw, skull, all bone) ===
            
            # Calculate adaptive bone thresholds
            bone_threshold_high = np.percentile(volume_smooth[volume_smooth > 0.25], 65)
            bone_threshold_low = np.percentile(volume_smooth[volume_smooth > 0.15], 50)
            print(f"    Bone thresholds - High: {bone_threshold_high:.3f}, Low: {bone_threshold_low:.3f}")
            
            # 5. Cortical Bone (dense outer bone) - GLOBAL (jaw + skull)
            cortical_mask = (volume_smooth > max(bone_threshold_high, 0.40)) & (volume_smooth <= max(high_density_threshold, 0.65))
            cortical_mask = cortical_mask & (segmentation == 0)  # Don't override tooth structures
            cortical_mask = morphology.remove_small_objects(cortical_mask, min_size=min_object_scale * 2)
            segmentation[cortical_mask] = 5
            
            # 6. Trabecular Bone (spongy bone) - GLOBAL (jaw + skull)
            trabecular_mask = (volume_smooth > max(bone_threshold_low, 0.25)) & (volume_smooth <= max(bone_threshold_high, 0.40))
            trabecular_mask = trabecular_mask & (segmentation == 0)
            trabecular_mask = morphology.remove_small_objects(trabecular_mask, min_size=min_object_scale)
            segmentation[trabecular_mask] = 6
            
            # 7. Alveolar Bone (bone immediately around teeth)
            if np.any(tooth_mask):
                tooth_vicinity = morphology.binary_dilation(tooth_mask, morphology.ball(ball_size * 3))
                bone_mask = (segmentation == 5) | (segmentation == 6)
                alveolar_mask = bone_mask & tooth_vicinity & ~tooth_mask & dental_arch_mask
                segmentation[alveolar_mask] = 7
                print(f"    Alveolar bone detected: {np.sum(alveolar_mask):,} voxels")
            
            # === NEURAL STRUCTURES ===
            
            # 8. Nerve Canal (inferior alveolar canal) - runs through mandibular bone
            # Pass existing bone mask so nerve detection can use bone proximity
            existing_bone = (segmentation == 5) | (segmentation == 6) | (segmentation == 7)
            nerve_mask = self._detect_nerve_canal(volume_smooth, min_object_scale, bone_mask=existing_bone)
            
            # Constrain nerve to near dental arch region (generous dilation)
            if dental_arch_mask is not None:
                 # Dilate dental arch mask very generously to include deep jaw bone
                 jaw_area = morphology.binary_dilation(dental_arch_mask, morphology.ball(max(ball_size * 8, 8)))
                 nerve_mask = nerve_mask & jaw_area
            
            # NOTE: No fixed z-cutoff — the jaw_area constraint from the arch mask
            # handles spatial restriction without assuming axis orientation
            
            # Don't overwrite existing tooth/bone structures
            nerve_mask = nerve_mask & (segmentation == 0)
            
            segmentation[nerve_mask] = 8
            print(f"    Nerve canal detected: {np.sum(nerve_mask):,} voxels")
            
            # === PERIODONTAL STRUCTURES ===
            
            # 9. PDL Space (periodontal ligament) - ONLY in dental arch region
            if np.any(tooth_mask):
                pdl_mask = self._detect_pdl_space(volume_smooth, tooth_mask, ball_size, min_object_scale, dental_arch_mask)
                segmentation[pdl_mask] = 9
            
            # === SOFT TISSUES ===
            
            # 10. General Soft Tissue - GLOBAL
            soft_tissue_threshold = max(bone_threshold_low * 0.5, 0.10)
            soft_tissue_mask = (volume_smooth > soft_tissue_threshold) & (volume_smooth <= max(bone_threshold_low, 0.28))
            soft_tissue_mask = soft_tissue_mask & (segmentation == 0)
            soft_tissue_mask = morphology.remove_small_objects(soft_tissue_mask, min_size=min_object_scale * 3)
            segmentation[soft_tissue_mask] = 10
            
            # 11. Gingiva (gums - soft tissue adjacent to teeth) - DENTAL ARCH ONLY
            if np.any(tooth_mask):
                tooth_boundary = morphology.binary_dilation(tooth_mask, morphology.ball(ball_size * 2))
                gingiva_mask = soft_tissue_mask & tooth_boundary & ~tooth_mask & dental_arch_mask
                segmentation[gingiva_mask] = 11
                print(f"    Gingiva detected: {np.sum(gingiva_mask):,} voxels")
            
            # === PATHOLOGY DETECTION ===
            
            # 12. Caries (tooth decay) - DENTAL ARCH ONLY (must be in/on teeth)
            if np.sum(enamel_mask) > min_object_scale * 20 or np.sum(dentin_mask) > min_object_scale * 20:
                caries_mask = self._detect_caries(volume_smooth, enamel_mask, dentin_mask, min_object_scale, dental_arch_mask)
                caries_mask = caries_mask & (segmentation == 0)
                segmentation[caries_mask] = 12
                print(f"    Caries detected: {np.sum(caries_mask):,} voxels")
            
            # 13. Periapical Lesions (infections at tooth root apex) - DENTAL ARCH ONLY
            if np.sum(tooth_mask) > min_object_scale * 40:
                lesion_mask = self._detect_periapical_lesions(volume_smooth, tooth_mask, ball_size, min_object_scale)
                
                # Constrain strictly to dental arch region
                if dental_arch_mask is not None:
                     root_area = morphology.binary_dilation(dental_arch_mask, morphology.ball(ball_size * 2))
                     lesion_mask = lesion_mask & root_area
                
                lesion_mask = lesion_mask & (segmentation == 0)
                segmentation[lesion_mask] = 13
                print(f"    Periapical lesion detected: {np.sum(lesion_mask):,} voxels")
            
            # === POST-PROCESSING: CLEANUP ===
            print("  🔧 Final cleanup...")
            
            # Pass 1: Remove oversized components (skull contamination) from dental structures
            for tooth_label, tooth_name in [(1, "enamel"), (2, "dentin"), (3, "pulp_root_canal")]:
                tooth_segment = segmentation == tooth_label
                if np.any(tooth_segment):
                    labeled_tooth = measure.label(tooth_segment)
                    regions = measure.regionprops(labeled_tooth)
                    
                    if tooth_label == 1:
                        max_component_size = int(volume.size * 0.025)
                    elif tooth_label == 2:
                        max_component_size = int(volume.size * 0.035)
                    else:
                        max_component_size = int(volume.size * 0.015)
                    
                    removed_count = 0
                    for region in regions:
                        if region.area > max_component_size:
                            tooth_segment[labeled_tooth == region.label] = False
                            removed_count += 1
                    
                    if removed_count > 0:
                        print(f"    Removed {removed_count} oversized {tooth_name} component(s)")
                        segmentation[segmentation == tooth_label] = 0
                        segmentation[tooth_segment] = tooth_label
            
            # Pass 2: Remove tiny isolated noise clusters per segment
            for label_val in range(1, 14):
                segment = segmentation == label_val
                voxel_count = int(np.sum(segment))
                if voxel_count > 0:
                    # Minimum cluster size varies by structure type
                    if label_val in [1, 2, 5, 6]:  # Major: enamel, dentin, cortical/trabecular bone
                        min_cluster = max(15, min_object_scale)
                    elif label_val in [3, 4, 7, 8, 9]:  # Medium: pulp, cementum, alveolar, nerve, PDL
                        min_cluster = max(8, min_object_scale // 2)
                    else:  # Small/thin: soft tissue, gingiva, caries, lesions
                        min_cluster = max(5, min_object_scale // 4)
                    
                    cleaned = morphology.remove_small_objects(segment, min_size=min_cluster)
                    removed = voxel_count - int(np.sum(cleaned))
                    if removed > 0 and np.sum(cleaned) > 0:
                        segmentation[segmentation == label_val] = 0
                        segmentation[cleaned] = label_val
                        if removed > 50:
                            print(f"    Noise cleanup: removed {removed:,} isolated voxels from label {label_val}")
            
            print(f"✓ Complete segmentation finished. Found {len(np.unique(segmentation)) - 1} tissue types")
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
    
    def _detect_dental_arch_region(self, volume: np.ndarray, volume_shape: tuple) -> np.ndarray:
        """
        Detect the dental arch region using enamel seed-based approach.
        Enamel is the DENSEST biological tissue, so ultra-high density voxels
        reliably mark tooth positions regardless of scan orientation.
        Does NOT assume any particular axis orientation.
        """
        try:
            print("  🦷 Detecting dental arch region (seed-based)...")
            
            depth, height, width = volume_shape
            
            # Step 1: Find ultra-high density voxels (enamel seeds)
            # Enamel is denser than any bone — use a STRICT threshold
            # so we don't accidentally seed on cortical jawbone
            enamel_seed_threshold = np.percentile(volume[volume > 0.5], 88)
            enamel_seed_threshold = max(enamel_seed_threshold, 0.65)
            seeds = volume > enamel_seed_threshold
            print(f"    Enamel seed threshold: {enamel_seed_threshold:.3f}, total seeds: {np.sum(seeds):,}")
            
            if np.sum(seeds) == 0:
                # Try a slightly lower threshold
                enamel_seed_threshold = max(np.percentile(volume[volume > 0.4], 85), 0.58)
                seeds = volume > enamel_seed_threshold
                print(f"    Relaxed enamel seed threshold: {enamel_seed_threshold:.3f}, seeds: {np.sum(seeds):,}")
            
            if np.sum(seeds) == 0:
                print("    ⚠️ No enamel seeds found - using full volume")
                return np.ones(volume_shape, dtype=bool)
            
            # Step 2: Connected component analysis on seeds
            labeled_seeds = measure.label(seeds)
            seed_regions = measure.regionprops(labeled_seeds)
            
            # Step 3: Filter for tooth-sized seed components
            # Individual tooth enamel: small-to-medium, COMPACT shape (not elongated jawbone ridge)
            seed_min = max(10, int(volume.size * 0.000002))  # Tiny min for small incisors
            seed_max = int(volume.size * 0.008)  # 0.8% max per tooth (tighter than 1.5%)
            
            tooth_seeds = []
            for r in seed_regions:
                if seed_min < r.area < seed_max:
                    # Strict compactness: teeth are compact blobs, jawbone is elongated
                    bbox = r.bbox
                    dims = [bbox[3]-bbox[0], bbox[4]-bbox[1], bbox[5]-bbox[2]]
                    max_dim = max(dims)
                    min_dim = max(min(dims), 1)
                    if max_dim / min_dim < 6:  # Stricter: teeth are compact, not thin ridges
                        tooth_seeds.append({
                            'label': r.label,
                            'centroid': r.centroid,  # (z, y, x)
                            'area': r.area
                        })
            
            print(f"    Tooth-sized seed components: {len(tooth_seeds)} (range {seed_min:,}-{seed_max:,})")
            
            if len(tooth_seeds) == 0:
                # Fallback: relax aspect ratio but keep size filter
                print("    Relaxing shape filter...")
                for r in seed_regions:
                    if seed_min < r.area < seed_max * 2:
                        tooth_seeds.append({
                            'label': r.label,
                            'centroid': r.centroid,
                            'area': r.area
                        })
            
            if len(tooth_seeds) == 0:
                print("    ⚠️ No seed components found - using full volume")
                return np.ones(volume_shape, dtype=bool)
            
            # Step 4: Cluster seeds by Z-level to find jaw plane
            # Teeth are roughly coplanar in the jaw
            z_positions = np.array([s['centroid'][0] for s in tooth_seeds])
            jaw_z = np.median(z_positions)
            z_tolerance = depth * 0.30  # Generous: 30% of depth above/below median
            
            # Keep seeds near the jaw level
            jaw_seeds = [s for s in tooth_seeds 
                        if abs(s['centroid'][0] - jaw_z) < z_tolerance]
            if len(jaw_seeds) < 2:
                jaw_seeds = tooth_seeds  # Fallback: use all
            
            print(f"    Seeds near jaw level (z={jaw_z:.0f} ± {z_tolerance:.0f}): {len(jaw_seeds)}")
            
            # Step 5: Create arch mask from selected seeds
            arch_mask = np.zeros(volume_shape, dtype=bool)
            for s in jaw_seeds:
                arch_mask[labeled_seeds == s['label']] = True
            
            print(f"    Arch seed voxels: {np.sum(arch_mask):,}")
            
            # Step 6: Expand to include full teeth (crown + roots)
            # Tooth roots extend significantly beyond the enamel crown,
            # so we need generous expansion. The strict seed threshold (0.65)
            # ensures we start from actual enamel, not jawbone.
            expansion = max(6, min(10, min(depth, height, width) // 15))
            arch_mask = morphology.binary_dilation(arch_mask, morphology.ball(expansion))
            # Close gaps between adjacent teeth to form a continuous arch
            close_radius = max(4, expansion - 2)
            arch_mask = morphology.binary_closing(arch_mask, morphology.ball(close_radius))
            
            arch_volume = np.sum(arch_mask)
            total_volume = volume.size
            print(f"    Final dental arch region: {arch_volume:,} voxels ({100*arch_volume/total_volume:.1f}% of volume)")
            
            return arch_mask
            
        except Exception as e:
            print(f"  ⚠️  Dental arch detection failed: {str(e)}")
            print("     Using full volume (may include non-dental structures)")
            return np.ones_like(volume, dtype=bool)
    
    def _detect_nerve_canal(self, volume: np.ndarray, min_object_scale: int, 
                             bone_mask: np.ndarray = None) -> np.ndarray:
        """
        Detect inferior alveolar nerve canal (linear low-density tubular structure)
        The nerve canal is a low-density tubular channel running WITHIN the mandibular bone.
        Adaptive based on volume size.
        """
        try:
            print("  🔍 Detecting nerve canal...")
            
            # Nerve canal: low-to-medium density structure within bone
            # Wider intensity range to catch the canal reliably
            nerve_candidates = (volume > 0.05) & (volume < 0.30)
            print(f"    Initial nerve candidates (0.05-0.30): {np.sum(nerve_candidates):,} voxels")
            
            # If we have bone context, require nerve to be near/within bone
            # This is the strongest spatial constraint and most anatomically accurate
            if bone_mask is not None and np.any(bone_mask):
                # The nerve canal runs INSIDE bone - look for low density near bone
                bone_vicinity = morphology.binary_dilation(bone_mask, morphology.ball(3))
                nerve_candidates = nerve_candidates & bone_vicinity
                print(f"    After bone proximity filter: {np.sum(nerve_candidates):,} voxels")
            
            # Light morphological cleanup
            nerve_candidates = morphology.binary_opening(nerve_candidates, morphology.ball(1))
            
            # Connect nearby fragments into continuous canal using closing
            nerve_candidates = morphology.binary_closing(nerve_candidates, morphology.ball(2))
            
            # Remove small scattered dots — the nerve canal is a large connected structure
            # Minimum size should be substantial (not tiny dots)
            nerve_min_size = max(100, min_object_scale * 10)
            nerve_candidates = morphology.remove_small_objects(nerve_candidates, min_size=nerve_min_size)
            
            # Filter out very large blobs (likely background or soft tissue masses)
            max_size = min_object_scale * 5000
            labeled = measure.label(nerve_candidates)
            regions = measure.regionprops(labeled)
            
            # Keep only the largest few components (the canal is typically 1-2 connected pieces)
            if len(regions) > 0:
                regions_sorted = sorted(regions, key=lambda r: r.area, reverse=True)
                # Keep at most the top 3 largest components
                keep_labels = set(r.label for r in regions_sorted[:3])
                for region in regions:
                    if region.label not in keep_labels or region.area > max_size:
                        nerve_candidates[labeled == region.label] = False
            
            print(f"    Final nerve canal candidates: {np.sum(nerve_candidates):,} voxels")
            return nerve_candidates
        except Exception as e:
            print(f"  ⚠️  Nerve canal detection failed: {str(e)}")
            return np.zeros_like(volume, dtype=bool)
    
    def _detect_pdl_space(self, volume: np.ndarray, tooth_mask: np.ndarray, 
                          ball_size: int, min_object_scale: int, dental_arch_mask: np.ndarray = None) -> np.ndarray:
        """
        Detect periodontal ligament space (thin radiolucent line around tooth root)
        Adaptive based on volume size
        """
        try:
            if not np.any(tooth_mask):
                return np.zeros_like(volume, dtype=bool)
            
            # PDL is low density space around tooth roots
            pdl_candidates = (volume > 0.05) & (volume < 0.20)
            
            # Limit to dental arch region if provided
            if dental_arch_mask is not None:
                pdl_candidates = pdl_candidates & dental_arch_mask
            
            # Should be immediately adjacent to tooth
            tooth_boundary = morphology.binary_dilation(tooth_mask, morphology.ball(ball_size * 2)) & ~tooth_mask
            pdl_mask = pdl_candidates & tooth_boundary
            pdl_mask = morphology.remove_small_objects(pdl_mask, min_size=max(3, min_object_scale // 2))
            
            return pdl_mask
        except Exception as e:
            print(f"  ⚠️  PDL detection failed: {str(e)}")
            return np.zeros_like(volume, dtype=bool)
    
    def _detect_caries(self, volume: np.ndarray, enamel_mask: np.ndarray, 
                       dentin_mask: np.ndarray, min_object_scale: int, dental_arch_mask: np.ndarray = None) -> np.ndarray:
        """
        Detect dental caries (demineralized tooth areas with reduced density)
        Adaptive based on volume size
        """
        try:
            tooth_mask = enamel_mask | dentin_mask
            if not np.any(tooth_mask):
                return np.zeros_like(volume, dtype=bool)
            
            # Caries: lower density within tooth structure (already limited by tooth_mask)
            caries_candidates = (volume > 0.35) & (volume < 0.50) & tooth_mask
            
            # Extra safety: limit to dental arch region if provided
            if dental_arch_mask is not None:
                caries_candidates = caries_candidates & dental_arch_mask
            
            caries_candidates = morphology.remove_small_objects(caries_candidates, min_size=max(3, min_object_scale // 4))
            
            # Remove very large regions
            max_caries_size = min_object_scale * 15  # Adaptive max size
            labeled = measure.label(caries_candidates)
            for region in measure.regionprops(labeled):
                if region.area > max_caries_size:
                    caries_candidates[labeled == region.label] = False
            
            return caries_candidates
        except Exception as e:
            print(f"  ⚠️  Caries detection failed: {str(e)}")
            return np.zeros_like(volume, dtype=bool)
    
    def _detect_periapical_lesions(self, volume: np.ndarray, tooth_mask: np.ndarray,
                                    ball_size: int, min_object_scale: int) -> np.ndarray:
        """
        Detect periapical lesions (radiolucent areas at tooth root apex)
        Adaptive based on volume size
        """
        try:
            if not np.any(tooth_mask):
                return np.zeros_like(volume, dtype=bool)
            
            # Lesions: low density near tooth roots
            lesion_candidates = (volume > 0.10) & (volume < 0.28)
            tooth_proximity = morphology.binary_dilation(tooth_mask, morphology.ball(ball_size * 3)) & ~tooth_mask
            lesion_candidates = lesion_candidates & tooth_proximity
            lesion_candidates = morphology.remove_small_objects(lesion_candidates, min_size=min_object_scale)
            
            # Size filtering
            max_lesion_size = min_object_scale * 75  # Adaptive max size
            labeled = measure.label(lesion_candidates)
            for region in measure.regionprops(labeled):
                if region.area > max_lesion_size:
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
        Adaptive step size based on volume dimensions for optimal performance
        """
        segment_data = await self.get_segment_data(scan_id, segment_name)
        
        if segment_data is None:
            return None
        
        try:
            # Adaptive step size based on volume size
            volume_size = segment_data.size
            
            if volume_size > 100_000_000:  # Very large (>100M voxels)
                step_size = 4
            elif volume_size > 20_000_000:  # Large (20-100M voxels)
                step_size = 3
            elif volume_size > 5_000_000:  # Medium (5-20M voxels)
                step_size = 2
            else:  # Small (<5M voxels)
                step_size = 1
            
            # Use marching cubes to generate mesh
            verts, faces, normals, _ = measure.marching_cubes(
                segment_data, 
                level=0.5,
                step_size=step_size
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
