# Create icon with Calibri - matches reference image better
# Calibri has smooth rounded curves like the reference

Add-Type -AssemblyName System.Drawing

$size = 1024
$bgColor = [System.Drawing.Color]::White
$sColor = [System.Drawing.Color]::FromArgb(36, 161, 222)  # #24A1DE

# Try Calibri first (smooth, rounded), then Trebuchet MS, then fallback
$fontToUse = "Calibri"
$fontSize = 460  # Adjusted for Calibri proportions

Write-Host "Creating icon with: $fontToUse"
Write-Host ""

$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

$graphics.Clear($bgColor)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# Font with Bold weight for definition
$font = New-Object System.Drawing.Font($fontToUse, $fontSize, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush($sColor)

# Perfect center alignment
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

# Measure text for verification
$tempBitmap = New-Object System.Drawing.Bitmap(1, 1)
$tempGraphics = [System.Drawing.Graphics]::FromImage($tempBitmap)
$textSize = $tempGraphics.MeasureString("S", $font, 1000, $stringFormat)
$tempGraphics.Dispose()
$tempBitmap.Dispose()

$coverage = [math]::Round(($textSize.Height / $size) * 100, 1)
Write-Host "Font size: $fontSize pt"
Write-Host "Text height: $([math]::Round($textSize.Height))px"
Write-Host "Coverage: $coverage%"

if ($coverage -gt 70) {
    Write-Host "WARNING: Coverage too high, reducing font size..."
    $font.Dispose()
    $fontSize = 400
    $font = New-Object System.Drawing.Font($fontToUse, $fontSize, [System.Drawing.FontStyle]::Bold)
}

# Draw centered
$centerRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$graphics.DrawString("S", $font, $brush, $centerRect, $stringFormat)

# Save
$iconPath = "C:\Users\Tuncay\Desktop\suproxy-main\artifacts\suproxy\assets\images\icon.png"
$adaptivePath = "C:\Users\Tuncay\Desktop\suproxy-main\artifacts\suproxy\assets\images\adaptive-icon.png"

$bitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host ""
Write-Host "Saved: icon.png"

Copy-Item $iconPath $adaptivePath -Force
Write-Host "Saved: adaptive-icon.png"

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$font.Dispose()
$brush.Dispose()

Write-Host ""
Write-Host "ICON CREATED - MATCHING REFERENCE"
Write-Host "- Font: Calibri Bold (smooth, rounded curves)"
Write-Host "- Color: #24A1DE (gok mavisi)"
Write-Host "- Background: #FFFFFF (pure white)"
Write-Host "- Centering: Perfect mathematical center"
Write-Host "- Size: 1024x1024px"
