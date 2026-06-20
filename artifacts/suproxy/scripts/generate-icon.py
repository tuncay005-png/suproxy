#!/usr/bin/env python3
"""
Generate app icon with geometric 'S' letter
Using PIL (Pillow) for real PNG output
"""

from PIL import Image, ImageDraw, ImageFont
import os
import sys

# Configuration
CONFIG = {
    "size": 1024,
    "bg_color": "#FFFFFF",  # White
    "s_color": "#24A1DE",   # Connected blue
    "font_size": 750,
}

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def generate_icon():
    """Generate 1024x1024 icon with geometric S letter"""
    
    # Create image with white background
    img = Image.new('RGB', (CONFIG["size"], CONFIG["size"]), color=hex_to_rgb(CONFIG["bg_color"]))
    draw = ImageDraw.Draw(img)
    
    # Try to load a geometric, bold font
    fonts_to_try = [
        "C:\\Windows\\Fonts\\arialbd.ttf",  # Arial Bold
        "C:\\Windows\\Fonts\\arial.ttf",    # Arial
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",  # Linux
        "/System/Library/Fonts/Helvetica.ttc",  # macOS
    ]
    
    font = None
    for font_path in fonts_to_try:
        if os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, size=CONFIG["font_size"])
                print(f"✓ Using font: {font_path}")
                break
            except:
                pass
    
    if not font:
        # Fallback to default font
        print("⚠ Using default font")
        font = ImageFont.load_default()
    
    # Draw "S" letter centered
    draw.text(
        (CONFIG["size"] // 2, CONFIG["size"] // 2),
        "S",
        fill=hex_to_rgb(CONFIG["s_color"]),
        font=font,
        anchor="mm"  # Center alignment
    )
    
    return img

def main():
    output_dir = os.path.join(
        os.path.dirname(__file__),
        "../assets/images"
    )
    
    # Create directory if needed
    os.makedirs(output_dir, exist_ok=True)
    
    print("Generating geometric app icon...\n")
    
    # Generate icon
    print("1. Creating icon with PIL...")
    img = generate_icon()
    
    # Save as icon.png
    icon_path = os.path.join(output_dir, "icon.png")
    img.save(icon_path, "PNG")
    print(f"   ✓ Icon saved: {icon_path}")
    
    # Save as adaptive-icon.png
    adaptive_path = os.path.join(output_dir, "adaptive-icon.png")
    img.save(adaptive_path, "PNG")
    print(f"   ✓ Adaptive icon saved: {adaptive_path}\n")
    
    print("═══════════════════════════════════════════════════════")
    print("✓ Icon generation complete!")
    print("═══════════════════════════════════════════════════════")
    print(f"  Icon PNG:         {icon_path}")
    print(f"  Adaptive PNG:     {adaptive_path}")
    print(f"  Size:             1024x1024px")
    print(f"  Color:            #24A1DE (gök mavisi)")
    print(f"  Font:             Arial / Helvetica (900 weight)")
    print("═══════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"✗ Error: {e}")
        sys.exit(1)
