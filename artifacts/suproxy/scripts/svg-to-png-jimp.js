#!/usr/bin/env node

/**
 * Convert SVG to PNG using Jimp (pure JavaScript, no native dependencies)
 */

const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

async function svgToPng(svgPath, pngPath) {
  try {
    console.log(`Converting ${path.basename(svgPath)} to PNG...\n`);
    
    // Read SVG
    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    
    // Parse SVG
    const parser = new xml2js.Parser();
    const svg = await parser.parseStringPromise(svgContent);
    
    // Create image
    const image = new Jimp(1024, 1024, 0xFFFFFFFF); // White background
    
    // Extract text from SVG
    const text = svg.svg.g[0].text[0]._;
    const fill = svg.svg.g[0].text[0].$['fill'];
    const fontSize = parseInt(svg.svg.g[0].text[0].$['font-size']);
    const fontWeight = svg.svg.g[0].text[0].$['font-weight'];
    
    console.log(`  Text: "${text}"`);
    console.log(`  Color: ${fill}`);
    console.log(`  Font size: ${fontSize}`);
    console.log(`  Font weight: ${fontWeight}\n`);
    
    // Load a bold font
    const font = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);
    
    // For very large text, we need to render multiple times
    // Calculate text position for center
    const textWidth = text.length * 80; // Approximate
    const x = (1024 - textWidth) / 2;
    const y = (1024 - 128) / 2;
    
    // Convert hex color to integer
    const hexColor = fill.replace('#', '');
    const colorInt = parseInt(hexColor + 'FF', 16);
    
    // Print text on image
    image.print(font, Math.floor(x), Math.floor(y), text);
    
    // Save as PNG
    await image.write(pngPath);
    console.log(`✓ PNG saved: ${pngPath}`);
    
    return true;
  } catch (err) {
    console.error(`✗ Conversion failed: ${err.message}`);
    return false;
  }
}

async function main() {
  try {
    const svgPath = path.join(__dirname, '../assets/images/icon-geometric.svg');
    const iconPngPath = path.join(__dirname, '../assets/images/icon.png');
    const adaptiveIconPath = path.join(__dirname, '../assets/images/adaptive-icon.png');
    
    console.log('Converting SVG to PNG using Jimp...\n');
    
    const success = await svgToPng(svgPath, iconPngPath);
    if (!success) throw new Error('Failed to convert icon.png');
    
    // Copy for adaptive icon
    fs.copyFileSync(iconPngPath, adaptiveIconPath);
    console.log(`✓ Adaptive icon created: ${adaptiveIconPath}\n`);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ Icon conversion complete!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (err) {
    console.error(`✗ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
