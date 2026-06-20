#!/usr/bin/env node

/**
 * Convert SVG to PNG using Puppeteer (headless Chrome)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function convertSvgToPng(svgPath, pngPath) {
  let browser;
  try {
    console.log(`Converting ${path.basename(svgPath)} to PNG...`);
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport to 1024x1024
    await page.setViewport({ width: 1024, height: 1024 });
    
    // Load SVG file
    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    
    await page.goto(dataUrl, { waitUntil: 'networkidle0' });
    
    // Take screenshot and save as PNG
    await page.screenshot({
      path: pngPath,
      type: 'png',
      omitBackground: false
    });
    
    console.log(`✓ PNG created: ${pngPath}`);
    
    await browser.close();
    return true;
  } catch (err) {
    console.error(`✗ Conversion failed: ${err.message}`);
    if (browser) await browser.close();
    return false;
  }
}

async function main() {
  try {
    const svgPath = path.join(__dirname, '../assets/images/icon-geometric.svg');
    const iconPngPath = path.join(__dirname, '../assets/images/icon.png');
    const adaptiveIconPath = path.join(__dirname, '../assets/images/adaptive-icon.png');
    
    console.log('Converting SVG to PNG using Puppeteer...\n');
    
    const success = await convertSvgToPng(svgPath, iconPngPath);
    if (!success) throw new Error('Failed to convert icon.png');
    
    // Copy for adaptive icon
    fs.copyFileSync(iconPngPath, adaptiveIconPath);
    console.log(`✓ Adaptive icon created: ${adaptiveIconPath}\n`);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ Conversion complete!');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (err) {
    console.error(`✗ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
