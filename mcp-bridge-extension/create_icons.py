#!/usr/bin/env python3
import os

# Create minimal valid PNG files as placeholders
# PNG signature + IHDR chunk with size + minimal IDAT + IEND
def create_png(size, filename):
    # PNG signature
    png_data = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr = b'IHDR' + size.to_bytes(4, 'big') + size.to_bytes(4, 'big')
    ihdr += b'\x08\x06\x00\x00\x00'  # 8-bit RGBA
    
    # Calculate CRC (simplified - just using zeros for placeholder)
    png_data += b'\x00\x00\x00\r' + ihdr + b'\x00\x00\x00\x00'
    
    # Minimal IDAT chunk (compressed empty data)
    png_data += b'\x00\x00\x00\x0cIDATx\x9cc\x00\x00\x00\x02\x00\x01\xe5\'\xde\xfc'
    
    # IEND chunk
    png_data += b'\x00\x00\x00\x00IEND\xaeB`\x82'
    
    with open(filename, 'wb') as f:
        f.write(png_data)
    print(f"Created {filename}")

# Create icons
os.makedirs('icons', exist_ok=True)
create_png(16, 'icons/icon-16.png')
create_png(48, 'icons/icon-48.png')
create_png(128, 'icons/icon-128.png')
print("✅ Icon files created!")