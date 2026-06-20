# Create perfectly centered app icon with safe-zone padding
# Font: Arial Black, Weight 900, Color: #24A1DE (36, 161, 222)
# Size: 1024x1024px with 60-65% text coverage

Add-Type -AssemblyName System.Drawing

# Configuration
$size = 1024
$padding = 180  # Safe-zone padding (creates ~60-65% text coverage)
$bgColor = [System.Drawing.Color]::White
$sColor = [System.Drawing.Color]::FromArgb(36, 161, 222)  # #24A1DE

# Create image
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Enable high quality rendering
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

# Fill background with white
$graphics.Clear($bgColor)

# Create font (Arial Black, weight 900)
$font = New-Object System.Drawing.Font("Arial", 650, [System.Drawing.FontStyle]::Bold)

# Create brush for text
$brush = New-Object System.Drawing.SolidBrush($sColor)

# String format for perfect centering
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

# Calculate text bounds (with safe-zone padding)
$left = $padding
$top = $padding
$width = $size - (2 * $padding)
$height = $size - (2 * $padding)
$rect = New-Object System.Drawing.RectangleF($left, $top, $width, $height)

# Draw "S" letter centered
$graphics.DrawString("S", $font, $brush, $rect, $sf)

# Save as PNG
$iconPath = "C:\Users\Tuncay\Desktop\suproxy-main\artifacts\suproxy\assets\images\icon.png"
$adaptivePath = "C:\Users\Tuncay\Desktop\suproxy-main\artifacts\suproxy\assets\images\adaptive-icon.png"

$bitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "OK - icon.png saved"

# Copy for adaptive icon
Copy-Item $iconPath $adaptivePath -Force
Write-Host "OK - adaptive-icon.png saved"

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$font.Dispose()
$brush.Dispose()

Write-Host ""
Write-Host "Icon generation complete"
Write-Host "- Size: 1024x1024px"
Write-Host "- Text: Arial Black, 650pt, weight 900"
Write-Host "- Color: #24A1DE (36, 161, 222)"
Write-Host "- Background: #FFFFFF"
Write-Host "- Centering: Perfect center alignment"
Write-Host "- Safe-zone: $($padding)px padding all sides"
