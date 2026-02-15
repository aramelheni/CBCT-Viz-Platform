"""
CBCT Segmentation Platform - Main Application
FastAPI backend for CBCT processing and segmentation
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import cbct, segmentation, visualization
import uvicorn

app = FastAPI(
    title="CBCT Segmentation Platform",
    description="Backend API for dental CBCT visualization and segmentation",
    version="1.0.0"
)

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(cbct.router, prefix="/api/cbct", tags=["CBCT"])
app.include_router(segmentation.router, prefix="/api/segmentation", tags=["Segmentation"])
app.include_router(visualization.router, prefix="/api/visualization", tags=["Visualization"])

@app.get("/")
async def root():
    return {
        "message": "CBCT Segmentation Platform API",
        "version": "1.0.0",
        "endpoints": {
            "cbct": "/api/cbct",
            "segmentation": "/api/segmentation",
            "visualization": "/api/visualization"
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
