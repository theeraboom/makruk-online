// Development-only social card renderer. Production serves the committed PNG.
// Requires Playwright + Chrome. PLAYWRIGHT_MODULE_PATH can point to an existing
// Playwright installation; no browser package is required by the web server.
const path = require('node:path');
const fs = require('node:fs/promises');
const {pathToFileURL} = require('node:url');
const sharp = require('sharp');
async function main() {
  let chromium;
  try { ({chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')); }
  catch { throw new Error('Install Playwright in your development environment, or set PLAYWRIGHT_MODULE_PATH to its module directory.'); }
  const browser = await chromium.launch({channel:process.env.PLAYMAKRUK_BROWSER_CHANNEL || 'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
    await page.goto(pathToFileURL(path.join(__dirname,'share-card.html')).href);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));if(!document.fonts.check('600 53px Prompt'))throw Error('Prompt font did not load; leaving the existing social card unchanged.');});
    const image=await page.screenshot();
    const output=path.join(__dirname,'..','public','og-image.png');
    const data=await sharp(image).png({compressionLevel:9}).toBuffer();
    await fs.writeFile(output,data);
    console.log(`Social card: 1200 × 630, ${Math.round(data.length/1024)} KB`);
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
