"""
Pydantic models for API request/response schemas
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class CBCTMetadata(BaseModel):
    """Metadata for CBCT scan"""
    dimensions: tuple[int, int, int]
    spacing: tuple[float, float, float]
    origin: tuple[float, float, float]
    data_type: str
    min_value: float
    max_value: float
    file_size: Optional[int] = None
    downsampled: Optional[bool] = False
    original_dimensions: Optional[tuple[int, int, int]] = None

class CBCTUploadResponse(BaseModel):
    """Response after CBCT upload"""
    scan_id: str
    filename: str
    metadata: CBCTMetadata
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)

class SegmentInfo(BaseModel):
    """Information about a segment"""
    name: str
    label: int
    color: str
    visible: bool = True
    voxel_count: Optional[int] = None
    description: Optional[str] = None

class SegmentationRequest(BaseModel):
    """Request for segmentation"""
    model_type: str = "nnunet"  # or "dhunet"
    segments: Optional[List[str]] = None

class SegmentationResponse(BaseModel):
    """Response after segmentation"""
    scan_id: str
    segmentation_id: str
    segments: List[SegmentInfo]
    processing_time: float
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)

class RenderingSettings(BaseModel):
    """Settings for 3D rendering"""
    window_center: Optional[int] = 400
    window_width: Optional[int] = 1800
    opacity: Optional[float] = 1.0
    brightness: Optional[float] = 1.0
    contrast: Optional[float] = 1.0
    preset: Optional[str] = "default"

class SliceRequest(BaseModel):
    """Request for 2D slice"""
    axis: str  # 'axial', 'coronal', 'sagittal'
    index: int
    window_center: Optional[int] = 400
    window_width: Optional[int] = 1800
