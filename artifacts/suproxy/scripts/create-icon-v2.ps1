# Create PNG icon using .NET System.Drawing
Add-Type -AssemblyName System.Drawing

$svgPath = "C:\Users\Tuncay\Desktop\suproxy-main\artifacts\suproxy\assets\images\icon-geometric.svg"
$pngPath = "C:\Users\Tuncay\Desktop\suproxy-main\artifacts\suproxy\assets\images\icon.png"
$adaptivePath = "C:\Users\Tuncay\Desktop\suproxy-main\artifacts\suproxy\assets\images\adaptive-icon.png"

Write-Host "Creating PNG icon using System.Drawing..."

try {
    # Create bitmap with white background
    $bitmap = New-Object System.Drawing.Bitmap(1024, 1024)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Clear with white
    $graphics.Clear([System.Drawing.Color]::White)
    
    # Create brush for text (blue color #24A1DE)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(36, 161, 222))
    
    # Create font (Arial, size 750, bold)
    $font = New-Object System.Drawing.Font("Arial", 750, [System.Drawing.FontStyle]::Bold)
    
    # Measure text size
    $sf = [System.Drawing.StringFormat]::GenericDefault
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    # Draw text "S" centered
    $rect = New-Object System.Drawing.RectangleF(0, 0, 1024, 1024)
    $graphics.DrawString("S", $font, $brush, $rect, $sf)
    
    # Save as PNG
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "- PNG saved: $pngPath"
    
    # Copy for adaptive icon
    Copy-Item $pngPath $adaptivePath
    Write-Host "- Adaptive icon created: $adaptivePath"
    
    # Cleanup
    $graphics.Dispose()
    $bitmap.Dispose()
    $font.Dispose()
    $brush.Dispose()
    
    Write-Host ""
    Write-Host "Icon creation complete!"
    
} catch {
    Write-Host "Error creating icon"
    exit 1
}
