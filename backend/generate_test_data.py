"""
Generate sample CBCT data for testing
Creates a synthetic NIfTI file with dental-like structures
"""

import numpy as np
import nibabel as nib
import os

def create_synthetic_cbct(output_path: str, size=(128, 128, 128)):
    """
    Create a synthetic CBCT scan with dental-like structures
    """
    print("Generating synthetic CBCT data...")
    
    # Create empty volume
    volume = np.zeros(size, dtype=np.float32)
    
    # Add jaw bone structure (outer shell)
    z_center = size[2] // 2
    for z in range(size[2]):
        x_center, y_center = size[0] // 2, size[1] // 2
        radius = 50 - abs(z - z_center) * 0.3
        
        for x in range(size[0]):
            for y in range(size[1]):
                dist = np.sqrt((x - x_center)**2 + (y - y_center)**2)
                if dist < radius and dist > radius - 10:
                    volume[x, y, z] = 0.7 + np.random.normal(0, 0.05)
    
    # Add tooth structures
    tooth_positions = [
        (40, 64, 64),  # Upper left
        (88, 64, 64),  # Upper right
        (40, 64, 48),  # Lower left
        (88, 64, 48),  # Lower right
    ]
    
    for tx, ty, tz in tooth_positions:
        # Enamel (outer layer)
        for x in range(tx-8, tx+8):
            for y in range(ty-8, ty+8):
                for z in range(tz-12, tz+12):
                    if 0 <= x < size[0] and 0 <= y < size[1] and 0 <= z < size[2]:
                        dist = np.sqrt((x-tx)**2 + (y-ty)**2*0.5 + (z-tz)**2*0.3)
                        if dist < 8:
                            if dist < 4:
                                # Pulp (center)
                                volume[x, y, z] = 0.3 + np.random.normal(0, 0.02)
                            elif dist < 6:
                                # Dentin (middle layer)
                                volume[x, y, z] = 0.6 + np.random.normal(0, 0.03)
                            else:
                                # Enamel (outer layer)
                                volume[x, y, z] = 0.9 + np.random.normal(0, 0.02)
    
    # Add noise
    volume += np.random.normal(0, 0.01, size)
    volume = np.clip(volume, 0, 1)
    
    # Convert to NIfTI
    affine = np.eye(4)
    affine[0, 0] = 0.5  # Spacing in x
    affine[1, 1] = 0.5  # Spacing in y
    affine[2, 2] = 0.5  # Spacing in z
    
    nifti_img = nib.Nifti1Image(volume, affine)
    
    # Save
    nib.save(nifti_img, output_path)
    print(f"✓ Saved synthetic CBCT to: {output_path}")
    print(f"  Shape: {size}")
    print(f"  File size: {os.path.getsize(output_path) / 1024:.2f} KB")

if __name__ == "__main__":
    # Create test data directory
    os.makedirs("test_data", exist_ok=True)
    
    # Generate sample file
    create_synthetic_cbct("test_data/sample_cbct.nii.gz")
    
    print("\n✓ Test data generated successfully!")
    print("Upload 'test_data/sample_cbct.nii.gz' to test the platform.")
