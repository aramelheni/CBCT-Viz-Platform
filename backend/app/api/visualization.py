"""
Visualization API for 3D rendering configuration
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from app.models.schemas import RenderingSettings

router = APIRouter()

@router.post("/{scan_id}/rendering-settings")
async def update_rendering_settings(scan_id: str, settings: RenderingSettings):
    """
    Update rendering settings for 3D visualization
    """
    try:
        # Store rendering preferences
        # In production, this would be stored in a database
        return JSONResponse(content={
            "scan_id": scan_id,
            "settings": settings.dict(),
            "message": "Rendering settings updated"
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{scan_id}/color-map")
async def get_color_map(scan_id: str):
    """
    Get color mapping for different segments
    """
    color_map = {
        "enamel": "#E8F4F8",      # Light blue-white
        "dentin": "#FFF8DC",       # Cornsilk (yellowish)
        "pulp_root_canal": "#FF6B6B",         # Red
        "bone": "#F5F5DC",         # Beige
        "soft_tissue": "#FFB6C1",  # Light pink
        "nerve": "#FFD700",        # Gold
        "background": "#000000"    # Black
    }
    
    return JSONResponse(content=color_map)

@router.get("/presets")
async def get_rendering_presets():
    """
    Get predefined rendering presets for different visualization modes
    """
    presets = {
        "default": {
            "window_center": 400,
            "window_width": 1800,
            "opacity": 1.0,
            "brightness": 1.0,
            "contrast": 1.0
        },
        "bone": {
            "window_center": 500,
            "window_width": 2000,
            "opacity": 1.0,
            "brightness": 1.2,
            "contrast": 1.3
        },
        "soft_tissue": {
            "window_center": 50,
            "window_width": 400,
            "opacity": 0.8,
            "brightness": 0.9,
            "contrast": 1.1
        },
        "high_contrast": {
            "window_center": 400,
            "window_width": 1000,
            "opacity": 1.0,
            "brightness": 1.0,
            "contrast": 1.5
        }
    }
    
    return JSONResponse(content=presets)
