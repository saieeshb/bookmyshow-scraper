require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function findCoords() {
    const browser = await chromium.launch({ headless: false });
    
    // FORCE strict window size so coordinates never change
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    // Inject a tracker that prints coordinates to your terminal when you click
    await page.exposeFunction('reportClick', (x, y) => {
        console.log(`👉 Coordinates for clicked seat: x: ${x}, y: ${y}`);
    });

    // Playwright's method to inject the script before the page loads
    await page.addInitScript(() => {
        document.addEventListener('mousedown', (e) => {
            window.reportClick(e.clientX, e.clientY);
        });
    });

    await page.goto(process.env.BMS_EVENT_URL, { waitUntil: 'domcontentloaded' });
    console.log("Browser open! Dismiss any popups, then click seat E12 to get its coordinates.");
}

findCoords();