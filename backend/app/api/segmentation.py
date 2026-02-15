"""
Segmentation API for CBCT dental structures
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from app.services.segmentation_service import SegmentationService
from app.models.schemas import SegmentationRequest, SegmentationResponse
from app.api.cbct import cbct_processor
from typing import List

router = APIRouter()
segmentation_service = SegmentationService(cbct_processor)

@router.post("/{scan_id}/segment", response_model=SegmentationResponse)
async def segment_cbct(scan_id: str, request: SegmentationRequest = None):
    """
    Perform automated segmentation on a CBCT scan
    Segments: enamel, dentin, pulp, bone, soft tissue
    """
    try:
        # Perform segmentation
        segmentation_result = await segmentation_service.segment(
            scan_id=scan_id,
            model_type=request.model_type if request else "nnunet"
        )
        
        return SegmentationResponse(
            scan_id=scan_id,
            segmentation_id=segmentation_result["segmentation_id"],
            segments=segmentation_result["segments"],
            processing_time=segmentation_result["processing_time"],
            message="Segmentation completed successfully"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{scan_id}/segments")
async def get_segments(scan_id: str):
    """
    Get all available segments for a CBCT scan
    """
    try:
        segments = await segmentation_service.get_segments(scan_id)
        
        if segments is None:
            raise HTTPException(status_code=404, detail="No segmentation found for this scan")
        
        return JSONResponse(content=segments)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{scan_id}/segment/{segment_name}")
async def get_individual_segment(scan_id: str, segment_name: str):
    """
    Get data for a specific segment (e.g., 'enamel', 'dentin', 'pulp')
    """
    try:
        segment_data = await segmentation_service.get_segment_data(scan_id, segment_name)
        
        if segment_data is None:
            raise HTTPException(status_code=404, detail=f"Segment '{segment_name}' not found")
        
        return JSONResponse(content={
            "segment_name": segment_name,
            "data": segment_data.tolist(),
            "shape": segment_data.shape
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{scan_id}/segment/{segment_name}/mesh")
async def get_segment_mesh(scan_id: str, segment_name: str):
    """
    Get 3D mesh representation of a segment for visualization
    """
    try:
        mesh_data = await segmentation_service.get_segment_mesh(scan_id, segment_name)
        
        if mesh_data is None:
            raise HTTPException(status_code=404, detail=f"Mesh for '{segment_name}' not found")
        
        return JSONResponse(content={
            "segment_name": segment_name,
            "vertices": mesh_data["vertices"],
            "faces": mesh_data["faces"],
            "normals": mesh_data.get("normals", [])
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{scan_id}/toggle-segment")
async def toggle_segment_visibility(scan_id: str, segment_name: str, visible: bool):
    """
    Toggle visibility of a specific segment
    """
    try:
        result = await segmentation_service.toggle_segment(scan_id, segment_name, visible)
        
        return JSONResponse(content={
            "segment_name": segment_name,
            "visible": visible,
            "message": f"Segment '{segment_name}' visibility updated"
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
