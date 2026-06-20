#!/usr/bin/env node

/**
 * Generate app icon from SVG
 * Requirements:
 * - Sharp package (npm install sharp)
 * - Outputs: icon.png and adaptive-icon.png (1024x1024px each)
 */

const fs = require("fs");
const path = require("path");

// Icon configuration - extracted from HomeScreen styles
const ICON_CONFIG = {
  size: 1024,
  bgColor: "#FFFFFF",
  sColor: "#24A1DE", // Connected blue from UI
  fontFamily: "sans-serif", // System default font (Roboto/SF)
  fontWeight: 900, // Black weight from connectLetter style
  fontSize: 600, // Scaled from 56 to 1024px ratio
};

// Generate SVG with "S" letter
function generateSvg() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${ICON_CONFIG.size}" height="${ICON_CONFIG.size}" viewBox="0 0 ${ICON_CONFIG.size} ${ICON_CONFIG.size}" xmlns="http://www.w3.org/2000/svg">
  <!-- White background -->
  <rect width="${ICON_CONFIG.size}" height="${ICON_CONFIG.size}" fill="${ICON_CONFIG.bgColor}"/>
  
  <!-- Centered "S" letter -->
  <text
    x="50%"
    y="50%"
    font-family="${ICON_CONFIG.fontFamily}"
    font-size="${ICON_CONFIG.fontSize}"
    font-weight="${ICON_CONFIG.fontWeight}"
    fill="${ICON_CONFIG.sColor}"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="8"
  >S</text>
</svg>`;

  return svg;
}

// Save SVG to file
function saveSvg(svgContent, outputPath) {
  fs.writeFileSync(outputPath, svgContent, "utf-8");
  console.log(`✓ SVG saved to: ${outputPath}`);
  return outputPath;
}

// Try to convert SVG to PNG using Sharp (if available)
async function convertSvgToPng(svgPath, pngPath) {
  try {
    // Try local sharp first
    let sharp = null;
    try {
      sharp = require("sharp");
    } catch {
      // Try global sharp
      const globalPath = require("path").join(
        require("os").homedir(),
        "AppData",
        "Roaming",
        "npm",
        "node_modules",
        "sharp"
      );
      try {
        sharp = require(globalPath);
      } catch {
        throw new Error("Sharp not found in local or global node_modules");
      }
    }

    await sharp(svgPath)
      .png()
      .toFile(pngPath);
    console.log(`✓ PNG generated: ${pngPath}`);
    return true;
  } catch (err) {
    console.log(`⚠ Sharp not installed or conversion failed: ${err.message}`);
    console.log("  Install with: npm install sharp");
    return false;
  }
}

// Fallback: Save SVG as PNG using a simple canvas mock (if available)
function saveSvgAsPngFallback(svgContent, pngPath) {
  try {
    const { createCanvas } = require("canvas");
    const canvas = createCanvas(ICON_CONFIG.size, ICON_CONFIG.size);
    const ctx = canvas.getContext("2d");

    // Draw white background
    ctx.fillStyle = ICON_CONFIG.bgColor;
    ctx.fillRect(0, 0, ICON_CONFIG.size, ICON_CONFIG.size);

    // Draw "S" text
    ctx.fillStyle = ICON_CONFIG.sColor;
    ctx.font = `${ICON_CONFIG.fontWeight} ${ICON_CONFIG.fontSize}px ${ICON_CONFIG.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", ICON_CONFIG.size / 2, ICON_CONFIG.size / 2);

    // Save as PNG
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(pngPath, buffer);
    console.log(`✓ PNG generated (canvas): ${pngPath}`);
    return true;
  } catch (err) {
    console.log(`⚠ Canvas fallback failed: ${err.message}`);
    return false;
  }
}

// Main execution
async function main() {
  const assetsDir = path.join(__dirname, "..", "assets", "images");
  
  // Ensure assets directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log(`✓ Created directory: ${assetsDir}`);
  }

  const svgPath = path.join(assetsDir, "icon.svg");
  const iconPngPath = path.join(assetsDir, "icon.png");
  const adaptiveIconPngPath = path.join(assetsDir, "adaptive-icon.png");

  // Generate SVG
  console.log("Generating icon SVG...");
  const svgContent = generateSvg();
  saveSvg(svgContent, svgPath);

  // Convert to PNG
  console.log("Converting to PNG...");
  let converted = await convertSvgToPng(svgPath, iconPngPath);

  if (!converted) {
    console.log("Trying canvas fallback...");
    converted = saveSvgAsPngFallback(svgContent, iconPngPath);
  }

  if (converted) {
    // Create adaptive icon (same for now)
    fs.copyFileSync(iconPngPath, adaptiveIconPngPath);
    console.log(`✓ Adaptive icon created: ${adaptiveIconPngPath}`);
    
    console.log("\n✅ Icon generation complete!");
    console.log(`Icon color: ${ICON_CONFIG.sColor}`);
    console.log(`Icon size: ${ICON_CONFIG.size}x${ICON_CONFIG.size}px`);
    process.exit(0);
  } else {
    console.log(
      "\n⚠ Warning: PNG conversion failed. Install Sharp or Canvas:"
    );
    console.log("  pnpm add sharp");
    console.log("  OR");
    console.log("  pnpm add canvas");
    console.log("\nSVG file created at: " + svgPath);
    console.log("Please convert to PNG manually and place at: " + iconPngPath);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
