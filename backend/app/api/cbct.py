"""
CBCT Upload and Processing API
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List
import os
import uuid
from app.services.cbct_processor import CBCTProcessor
from app.models.schemas import CBCTUploadResponse, CBCTMetadata

router = APIRouter()
cbct_processor = CBCTProcessor()

# Storage directory for uploaded files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Memory optimization settings
MAX_FILE_SIZE_MB = 500  # Maximum upload size in MB
MAX_VOLUME_VOXELS = 256 * 256 * 256  # Auto-downsample if larger
DEFAULT_DOWNSAMPLE_SIZE = (128, 128, 128)  # Safe size for web delivery

@router.post("/upload", response_model=CBCTUploadResponse)
async def upload_cbct(file: UploadFile = File(...)):
    """
    Upload a CBCT scan (DICOM series or NIfTI file)
    Supported formats: .dcm, .nii, .nii.gz
    """
    try:
        # Generate unique ID for this scan
        scan_id = str(uuid.uuid4())
        
        # Validate file type (handle .nii.gz properly)
        allowed_extensions = ['.dcm', '.nii', '.nii.gz', '.dicom']
        filename_lower = file.filename.lower()
        
        # Check for .nii.gz first (compound extension)
        if filename_lower.endswith('.nii.gz'):
            file_ext = '.nii.gz'
        else:
            file_ext = os.path.splitext(filename_lower)[1]
        
        if not any(filename_lower.endswith(ext) for ext in allowed_extensions):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Allowed: {allowed_extensions}"
            )
        
        # Check file size (memory optimization)
        content = await file.read()
        file_size_mb = len(content) / (1024 * 1024)
        
        if file_size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({file_size_mb:.1f}MB). Max size: {MAX_FILE_SIZE_MB}MB"
            )
        
        # Save uploaded file
        file_path = os.path.join(UPLOAD_DIR, f"{scan_id}_{file.filename}")
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Process CBCT file
        volume_data = await cbct_processor.load_cbct(file_path)
        
        # Extract metadata before potential downsampling
        metadata = cbct_processor.get_metadata(volume_data)
        
        # Auto-downsample large volumes to prevent memory issues
        volume_size = volume_data.GetSize()
        total_voxels = volume_size[0] * volume_size[1] * volume_size[2]
        
        if total_voxels > MAX_VOLUME_VOXELS:
            print(f"⚠️  Large volume detected ({total_voxels:,} voxels). Auto-downsampling...")
            volume_data = cbct_processor.downsample_volume(volume_data, DEFAULT_DOWNSAMPLE_SIZE)
            metadata.downsampled = True
            metadata.original_dimensions = (int(volume_size[0]), int(volume_size[1]), int(volume_size[2]))
        
        # Store processed data
        cbct_processor.store_volume(scan_id, volume_data)
        
        return CBCTUploadResponse(
            scan_id=scan_id,
            filename=file.filename,
            metadata=metadata,
            message="CBCT scan uploaded and processed successfully"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{scan_id}/metadata", response_model=CBCTMetadata)
async def get_cbct_metadata(scan_id: str):
    """
    Get metadata for a specific CBCT scan
    """
    try:
        volume_data = cbct_processor.get_volume(scan_id)
        if volume_data is None:
            raise HTTPException(status_code=404, detail="CBCT scan not found")
        
        metadata = cbct_processor.get_metadata(volume_data)
        return metadata
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{scan_id}/slice/{axis}/{index}")
async def get_slice(scan_id: str, axis: str, index: int):
    """
    Get a 2D slice from the CBCT volume
    axis: 'axial', 'coronal', or 'sagittal'
    """
    try:
        volume_data = cbct_processor.get_volume(scan_id)
        if volume_data is None:
            raise HTTPException(status_code=404, detail="CBCT scan not found")
        
        slice_data = cbct_processor.get_slice(volume_data, axis, index)
        
        return JSONResponse(content={
            "axis": axis,
            "index": index,
            "data": slice_data.tolist()
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{scan_id}/volume")
async def get_volume_data(scan_id: str, quality: str = "low"):
    """
    Get the full 3D volume data for visualization
    Quality levels: 'low' (64³), 'medium' (96³), 'high' (128³)
    Using 'low' by default to prevent browser crashes
    """
    try:
        volume_data = cbct_processor.get_volume(scan_id)
        if volume_data is None:
            raise HTTPException(status_code=404, detail="CBCT scan not found")
        
        # Quality settings for safe rendering
        quality_settings = {
            "low": (64, 64, 64),      # ~262K voxels - safest
            "medium": (96, 96, 96),   # ~884K voxels - balanced  
            "high": (128, 128, 128)   # ~2M voxels - detailed
        }
        
        target_size = quality_settings.get(quality, quality_settings["low"])
        
        # Downsample for web delivery
        downsampled = cbct_processor.downsample_for_web(volume_data, target_size)
        
        return JSONResponse(content={
            "scan_id": scan_id,
            "shape": downsampled.shape,
            "quality": quality,
            "data": downsampled.tolist()
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{scan_id}")
async def delete_cbct(scan_id: str):
    """
    Delete a CBCT scan and its associated data
    """
    try:
        success = cbct_processor.delete_volume(scan_id)
        if not success:
            raise HTTPException(status_code=404, detail="CBCT scan not found")
        
        return {"message": "CBCT scan deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
