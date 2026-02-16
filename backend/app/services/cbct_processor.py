"""
CBCT Processing Service
Handles loading, processing, and storing CBCT data
"""

import SimpleITK as sitk
import numpy as np
import pydicom
import nibabel as nib
from typing import Dict, Optional, Tuple
import os
from app.models.schemas import CBCTMetadata

class CBCTProcessor:
    def __init__(self):
        # In-memory storage for volumes (in production, use database/file storage)
        self.volumes: Dict[str, sitk.Image] = {}
    
    async def load_cbct(self, file_path: str) -> sitk.Image:
        """
        Load CBCT data from file (DICOM or NIfTI)
        Supports: .dcm, .dicom, .nii, .nii.gz
        """
        # Handle .nii.gz files (compound extension)
        if file_path.lower().endswith('.nii.gz'):
            file_ext = '.nii.gz'
        else:
            file_ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if file_ext in ['.dcm', '.dicom']:
                # Load DICOM file
                volume = sitk.ReadImage(file_path)
            elif file_ext in ['.nii', '.nii.gz', '.gz']:
                # Load NIfTI file (SimpleITK handles .nii.gz automatically)
                volume = sitk.ReadImage(file_path)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}")
            
            # Normalize intensity values
            volume = self._normalize_intensity(volume)
            
            return volume
        
        except Exception as e:
            raise Exception(f"Error loading CBCT file: {str(e)}")
    
    def _normalize_intensity(self, image: sitk.Image) -> sitk.Image:
        """
        Normalize intensity values for consistent visualization
        """
        # Convert to float
        image = sitk.Cast(image, sitk.sitkFloat32)
        
        # Get intensity statistics
        stats = sitk.StatisticsImageFilter()
        stats.Execute(image)
        
        # Normalize to 0-1 range
        min_val = stats.GetMinimum()
        max_val = stats.GetMaximum()
        
        if max_val > min_val:
            image = (image - min_val) / (max_val - min_val)
        
        return image
    
    def get_metadata(self, volume: sitk.Image) -> CBCTMetadata:
        """
        Extract metadata from CBCT volume
        """
        size = volume.GetSize()
        spacing = volume.GetSpacing()
        origin = volume.GetOrigin()
        
        # Get intensity statistics
        array = sitk.GetArrayFromImage(volume)
        
        return CBCTMetadata(
            dimensions=(int(size[0]), int(size[1]), int(size[2])),
            spacing=(float(spacing[0]), float(spacing[1]), float(spacing[2])),
            origin=(float(origin[0]), float(origin[1]), float(origin[2])),
            data_type=str(volume.GetPixelIDTypeAsString()),
            min_value=float(array.min()),
            max_value=float(array.max())
        )
    
    def store_volume(self, scan_id: str, volume: sitk.Image):
        """
        Store volume in memory
        """
        self.volumes[scan_id] = volume
    
    def get_volume(self, scan_id: str) -> Optional[sitk.Image]:
        """
        Retrieve stored volume
        """
        return self.volumes.get(scan_id)
    
    def delete_volume(self, scan_id: str) -> bool:
        """
        Delete stored volume
        """
        if scan_id in self.volumes:
            del self.volumes[scan_id]
            return True
        return False
    
    def get_slice(self, volume: sitk.Image, axis: str, index: int) -> np.ndarray:
        """
        Extract 2D slice from 3D volume with bounds checking
        """
        array = sitk.GetArrayFromImage(volume)
        
        # Get dimensions and clamp index to valid range
        if axis == 'axial':
            max_index = array.shape[0] - 1
            index = max(0, min(index, max_index))
            return array[index, :, :]
        elif axis == 'coronal':
            max_index = array.shape[1] - 1
            index = max(0, min(index, max_index))
            return array[:, index, :]
        elif axis == 'sagittal':
            max_index = array.shape[2] - 1
            index = max(0, min(index, max_index))
            return array[:, :, index]
        else:
            raise ValueError(f"Invalid axis: {axis}")
    
    def downsample_for_web(self, volume: sitk.Image, target_size: Tuple[int, int, int] = (128, 128, 128)) -> np.ndarray:
        """
        Downsample volume for efficient web delivery (returns numpy array)
        """
        downsampled_volume = self.downsample_volume(volume, target_size)
        return sitk.GetArrayFromImage(downsampled_volume)
    
    def downsample_volume(self, volume: sitk.Image, target_size: Tuple[int, int, int] = (128, 128, 128)) -> sitk.Image:
        """
        Downsample volume and return SimpleITK Image
        """
        # Resample to target size
        original_size = volume.GetSize()
        original_spacing = volume.GetSpacing()
        
        # Calculate new spacing
        new_spacing = [
            (original_size[i] * original_spacing[i]) / target_size[i]
            for i in range(3)
        ]
        
        # Resample
        resampler = sitk.ResampleImageFilter()
        resampler.SetOutputSpacing(new_spacing)
        resampler.SetSize(target_size)
        resampler.SetInterpolator(sitk.sitkLinear)
        resampler.SetOutputOrigin(volume.GetOrigin())
        resampler.SetOutputDirection(volume.GetDirection())
        
        return resampler.Execute(volume)
    
    def apply_windowing(self, array: np.ndarray, window_center: int, window_width: int) -> np.ndarray:
        """
        Apply windowing for better visualization
        """
        window_min = window_center - window_width // 2
        window_max = window_center + window_width // 2
        
        windowed = np.copy(array)
        windowed = np.clip(windowed, window_min, window_max)
        windowed = (windowed - window_min) / (window_max - window_min)
        
        return windowed
