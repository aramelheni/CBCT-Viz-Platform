"""
Dental CBCT Validation Service
Validates that uploaded scans are actually dental/maxillofacial CBCT scans
and not other anatomical regions (spine, chest, etc.)
"""

import SimpleITK as sitk
import numpy as np
from typing import Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Result of dental CBCT validation"""
    is_valid: bool
    confidence: float
    reasons: list[str]
    warnings: list[str]


class DentalCBCTValidator:
    """
    Validates that CBCT scans are of the maxillofacial/dental region
    using anatomical and imaging characteristics
    """
    
    # Typical dental CBCT field of view (FOV) dimensions in mm
    # Small FOV: 40-60mm (single tooth/quadrant)
    # Medium FOV: 80-120mm (single arch/multiple teeth) 
    # Large FOV: 130-230mm (full maxillofacial)
    MIN_DENTAL_FOV_MM = 30
    MAX_DENTAL_FOV_MM = 250
    
    # Typical dental CBCT resolution
    MIN_VOXEL_SIZE_MM = 0.075  # High resolution
    MAX_VOXEL_SIZE_MM = 0.6    # Standard resolution
    
    # Hounsfield Unit (HU) ranges for dental structures
    # Enamel: 2500-3000 HU
    # Dentin: 1500-2300 HU
    # Bone: 300-2000 HU
    # Soft tissue: -100 to 100 HU
    # Air: -1000 HU
    ENAMEL_HU_MIN = 2000
    ENAMEL_HU_MAX = 3500
    BONE_HU_MIN = 300
    BONE_HU_MAX = 2500
    
    def __init__(self):
        self.validation_checks = [
            self._check_fov_dimensions,
            self._check_voxel_spacing,
            self._check_intensity_distribution,
            self._check_dental_structures,
            self._check_anatomical_features
        ]
    
    def validate_scan(self, volume: sitk.Image) -> ValidationResult:
        """
        Validate if the scan is a dental/maxillofacial CBCT
        
        Args:
            volume: SimpleITK image volume
            
        Returns:
            ValidationResult with is_valid flag and detailed reasons
        """
        reasons = []
        warnings = []
        scores = []
        
        # Run all validation checks
        for check_func in self.validation_checks:
            try:
                passed, score, message = check_func(volume)
                scores.append(score)
                
                if passed:
                    reasons.append(f"✓ {message}")
                else:
                    reasons.append(f"✗ {message}")
                    
            except Exception as e:
                warnings.append(f"Validation check failed: {str(e)}")
                scores.append(0.0)
        
        # Calculate overall confidence
        confidence = np.mean(scores) if scores else 0.0
        
        # Require at least 75% confidence to pass (strict threshold)
        is_valid = confidence >= 0.75
        
        if not is_valid:
            # Detect likely scan type for better error messaging
            scan_type = self._detect_scan_type(volume, scores)
            reasons.insert(0, f"❌ REJECTED: This appears to be a {scan_type}, NOT a dental/maxillofacial CBCT")
            reasons.insert(1, "⚠️  This system ONLY processes dental CBCT scans for dental research purposes")
        else:
            reasons.insert(0, "✓ Scan validated as dental/maxillofacial CBCT")
        
        return ValidationResult(
            is_valid=is_valid,
            confidence=confidence,
            reasons=reasons,
            warnings=warnings
        )
    
    def _check_fov_dimensions(self, volume: sitk.Image) -> Tuple[bool, float, str]:
        """
        Check if the field of view matches dental CBCT dimensions
        """
        size = volume.GetSize()
        spacing = volume.GetSpacing()
        
        # Calculate physical dimensions in mm
        fov_x = size[0] * spacing[0]
        fov_y = size[1] * spacing[1]
        fov_z = size[2] * spacing[2]
        
        # Check if any dimension is too large (indicates full body or large organ scan)
        max_fov = max(fov_x, fov_y, fov_z)
        min_fov = min(fov_x, fov_y, fov_z)
        
        # Dental scans should have relatively cubic FOV
        aspect_ratio = max_fov / min_fov if min_fov > 0 else float('inf')
        
        # Check if FOV is within dental range
        in_range = (self.MIN_DENTAL_FOV_MM <= max_fov <= self.MAX_DENTAL_FOV_MM)
        
        # Dental scans shouldn't be extremely elongated (unlike spine scans)
        not_elongated = aspect_ratio < 3.0
        
        if in_range and not_elongated:
            score = 1.0
            message = f"FOV dimensions ({fov_x:.1f}×{fov_y:.1f}×{fov_z:.1f}mm) match dental CBCT"
        elif max_fov > self.MAX_DENTAL_FOV_MM:
            score = 0.0
            message = f"FOV too large ({max_fov:.1f}mm). Typical dental CBCT: {self.MIN_DENTAL_FOV_MM}-{self.MAX_DENTAL_FOV_MM}mm. This may be a spine, chest, or abdomen scan."
        elif aspect_ratio >= 3.0:
            score = 0.0
            message = f"Scan is too elongated (aspect ratio: {aspect_ratio:.1f}). This suggests a spine or long bone scan, not dental."
        else:
            score = 0.3
            message = f"FOV ({fov_x:.1f}×{fov_y:.1f}×{fov_z:.1f}mm) is smaller than typical dental range"
        
        return in_range and not_elongated, score, message
    
    def _check_voxel_spacing(self, volume: sitk.Image) -> Tuple[bool, float, str]:
        """
        Check if voxel spacing is appropriate for dental CBCT
        """
        spacing = volume.GetSpacing()
        avg_spacing = np.mean(spacing)
        
        # Dental CBCTs have isotropic or near-isotropic voxels
        spacing_variance = np.var(spacing)
        is_isotropic = spacing_variance < 0.05
        
        in_range = (self.MIN_VOXEL_SIZE_MM <= avg_spacing <= self.MAX_VOXEL_SIZE_MM)
        
        if in_range and is_isotropic:
            score = 1.0
            message = f"Voxel spacing ({spacing[0]:.3f}×{spacing[1]:.3f}×{spacing[2]:.3f}mm) matches dental CBCT"
        elif not is_isotropic and spacing_variance > 0.5:
            score = 0.2
            message = f"Highly anisotropic voxels detected. Dental CBCTs typically have isotropic voxels."
        elif avg_spacing > self.MAX_VOXEL_SIZE_MM:
            score = 0.5
            message = f"Lower resolution ({avg_spacing:.3f}mm) than typical dental CBCT"
        else:
            score = 0.7
            message = f"Voxel spacing acceptable for dental CBCT"
        
        return in_range, score, message
    
    def _check_intensity_distribution(self, volume: sitk.Image) -> Tuple[bool, float, str]:
        """
        Check if intensity values match dental CBCT characteristics
        Dental scans should have a wide range including very high values (enamel, dentin)
        """
        array = sitk.GetArrayFromImage(volume)
        
        # Sample the volume for efficiency if very large
        if array.size > 10_000_000:
            # Sample 10% of voxels randomly
            flat = array.flatten()
            sample_size = min(1_000_000, len(flat) // 10)
            sample = np.random.choice(flat, sample_size, replace=False)
        else:
            sample = array.flatten()
        
        # Calculate intensity statistics
        min_val = float(np.min(sample))
        max_val = float(np.max(sample))
        mean_val = float(np.mean(sample))
        
        # Check for presence of high-density structures (teeth/bone)
        high_density_voxels = np.sum(sample > self.BONE_HU_MIN)
        very_high_density_voxels = np.sum(sample > self.ENAMEL_HU_MIN)
        
        high_density_percent = (high_density_voxels / len(sample)) * 100
        very_high_density_percent = (very_high_density_voxels / len(sample)) * 100
        
        # Dental scans should have:
        # 1. High maximum values (enamel)
        # 2. Significant presence of high-density structures (5-25% of volume)
        # 3. Wide intensity range (air to enamel)
        
        has_enamel_values = max_val >= self.ENAMEL_HU_MIN
        has_bone_density = self.BONE_HU_MIN <= high_density_percent <= 50
        has_air_contrast = min_val < -500  # Should have air/soft tissue contrast
        
        score = 0.0
        if has_enamel_values and has_bone_density:
            score = 1.0
            message = f"Intensity distribution matches dental anatomy (max: {max_val:.0f} HU, {high_density_percent:.1f}% bone/teeth)"
        elif has_enamel_values or very_high_density_percent > 1:
            score = 0.7
            message = f"Some dental-like structures detected ({very_high_density_percent:.1f}% enamel-density)"
        elif high_density_percent > 30:
            score = 0.3
            message = f"Bone structures present but no enamel detected. May be spine/skeletal scan."
        else:
            score = 0.0
            message = f"Intensity distribution does NOT match dental anatomy (max: {max_val:.0f} HU). Appears to be soft tissue scan."
        
        passed = has_enamel_values and (1 < high_density_percent < 50)
        return passed, score, message
    
    def _check_dental_structures(self, volume: sitk.Image) -> Tuple[bool, float, str]:
        """
        Look for structures characteristic of dental anatomy
        """
        array = sitk.GetArrayFromImage(volume)
        
        # Sample middle slices where teeth are most likely
        middle_z = array.shape[0] // 2
        z_range = max(5, array.shape[0] // 10)
        middle_region = array[middle_z - z_range:middle_z + z_range, :, :]
        
        # Look for discrete high-density objects (teeth)
        threshold = self.ENAMEL_HU_MIN
        teeth_mask = middle_region > threshold
        
        # Count connected components (potential teeth)
        from scipy import ndimage
        labeled, num_features = ndimage.label(teeth_mask)
        
        # Dental scans should have multiple discrete high-density objects (teeth)
        # Typical adult: 24-32 teeth
        # Typical pediatric: 20 primary teeth
        # Even partial scans should show 4-16 teeth
        
        if 4 <= num_features <= 40:
            score = 1.0
            message = f"Detected {num_features} tooth-like structures (discrete high-density objects)"
        elif num_features > 40:
            score = 0.3
            message = f"Too many discrete objects ({num_features}). May be noise or non-dental scan."
        elif num_features > 0:
            score = 0.5
            message = f"Only {num_features} tooth-like structures detected. May be partial dental scan."
        else:
            score = 0.0
            message = f"No tooth-like structures detected. This does not appear to be a dental scan."
        
        passed = 3 <= num_features <= 50
        return passed, score, message
    
    def _check_anatomical_features(self, volume: sitk.Image) -> Tuple[bool, float, str]:
        """
        Check for anatomical features specific to maxillofacial region
        """
        array = sitk.GetArrayFromImage(volume)
        size = volume.GetSize()
        spacing = volume.GetSpacing()
        
        # Calculate aspect ratios
        # Dental scans are typically more cubic than spine scans
        # Spine scans are highly elongated in superior-inferior direction
        
        physical_dims = [size[i] * spacing[i] for i in range(3)]
        max_dim = max(physical_dims)
        min_dim = min(physical_dims)
        aspect_ratio = max_dim / min_dim if min_dim > 0 else 0
        
        # Check for air-tissue interfaces (airways, sinuses - common in dental scans)
        low_intensity = array < -500  # Air
        high_intensity = array > 500  # Bone/teeth
        
        # Dental scans have distinct air/tissue boundaries (oral cavity, sinuses, airways)
        air_percent = (np.sum(low_intensity) / array.size) * 100
        bone_percent = (np.sum(high_intensity) / array.size) * 100
        
        # Dental scans typically have 5-30% air and 10-30% bone
        has_air_cavities = 3 < air_percent < 40
        has_bones = 5 < bone_percent < 40
        
        if aspect_ratio < 2.0 and has_air_cavities and has_bones:
            score = 1.0
            message = f"Anatomical features consistent with maxillofacial region (air: {air_percent:.1f}%, bone: {bone_percent:.1f}%)"
        elif aspect_ratio >= 3.0:
            score = 0.0
            message = f"Highly elongated scan (ratio: {aspect_ratio:.1f}). Characteristic of spine/extremity, not dental."
        elif not has_air_cavities:
            score = 0.2
            message = f"Insufficient air cavities detected ({air_percent:.1f}%). Dental scans should show oral cavity/sinuses."
        else:
            score = 0.6
            message = f"Some maxillofacial features present"
        
        passed = aspect_ratio < 2.5 and has_air_cavities
        return passed, score, message
    
    def _detect_scan_type(self, volume: sitk.Image, scores: list) -> str:
        """
        Attempt to identify what type of scan this is if not dental
        """
        size = volume.GetSize()
        spacing = volume.GetSpacing()
        array = sitk.GetArrayFromImage(volume)
        
        physical_dims = [size[i] * spacing[i] for i in range(3)]
        max_dim = max(physical_dims)
        min_dim = min(physical_dims)
        aspect_ratio = max_dim / min_dim if min_dim > 0 else 0
        
        # Sample for intensity analysis
        sample = array.flatten()[::100]  # Sample every 100th voxel
        max_val = float(np.max(sample))
        high_density_percent = (np.sum(sample > 1500) / len(sample)) * 100
        
        # Spine: highly elongated, significant bone
        if aspect_ratio > 2.5 and high_density_percent > 5:
            return "SPINE CT scan"
        
        # Chest: large FOV, lots of air
        air_percent = (np.sum(sample < -500) / len(sample)) * 100
        if max_dim > 300 and air_percent > 40:
            return "CHEST CT scan"
        
        # Abdomen: large FOV, mostly soft tissue
        if max_dim > 300 and -200 < np.mean(sample) < 50:
            return "ABDOMINAL CT scan"
        
        # Head CT: large but more cubic
        if max_dim > 250 and aspect_ratio < 2.0:
            return "HEAD/BRAIN CT scan"
        
        # Extremity: moderate size, bone present
        if 100 < max_dim < 250 and high_density_percent > 15:
            return "EXTREMITY CT scan"
        
        # No enamel detected
        if max_val < 2000:
            return "soft tissue or non-dental CT scan"
        
        return "non-dental CT/CBCT scan"


def validate_dental_scan(volume: sitk.Image) -> ValidationResult:
    """
    Convenience function to validate a dental CBCT scan
    
    Args:
        volume: SimpleITK image volume
        
    Returns:
        ValidationResult with validation status and details
    """
    validator = DentalCBCTValidator()
    return validator.validate_scan(volume)
