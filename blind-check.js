
require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const url = process.env.BMS_EVENT_URL;

// Replace x and y with the numbers you got from find-coords.js
const targetSeats = [
    { name: 'E12', x: 1118, y: 464 } 
];

async function sendTelegramAlert(message) {
    const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message })
        });
        console.log("Telegram alert sent successfully.");
    } catch (err) { }
}

async function checkTickets() {
    console.log(`Checking BookMyShow at ${new Date().toLocaleTimeString()}...`);
    
    const browser = await chromium.launch({ headless: false }); 
    // MUST match the exact viewport size used when finding coordinates
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        try {
            console.log("Waiting for popup...");
            const selectSeatsBtn = page.getByRole('button', { name: /Select Seats/i });
            await selectSeatsBtn.waitFor({ state: 'visible', timeout: 8000 });
            await selectSeatsBtn.click();
            console.log("Popup dismissed.");
        } catch (e) {
            console.log("No popup appeared.");
        }

        // Wait 4 seconds for the canvas to finish rendering the seats
        await page.waitForTimeout(4000); 

        let foundOpenSeat = false;

        // Perform the blind click on our target coordinates
        for (let seat of targetSeats) {
            console.log(`Testing click on ${seat.name} at pixels (${seat.x}, ${seat.y})...`);
            await page.mouse.click(seat.x, seat.y);
            
            // Wait 1.5 seconds for the UI to react to the click
            await page.waitForTimeout(1500); 
            
            // Check if clicking triggered the Pay button to appear anywhere on the screen
            const pageText = await page.content();
            if (pageText.includes('Pay ₹') || pageText.includes('Pay Rs')) {
                foundOpenSeat = true;
                break; // Stop clicking if we found an open one
            }
        }

        if (foundOpenSeat) {
            console.log("SUCCESS: Click registered an open seat!");
            await sendTelegramAlert(`🚨 Target seats are live! The Pay button appeared. Go check: ${url}`);
            // Browser stays open so you can complete the purchase
        } else {
            console.log("Clicks did not trigger a Pay button. Seats are blocked. Checking again later.");
            await browser.close();
        }
    } catch (error) {
        console.error("Error checking page:", error.message);
        await browser.close();
    }
}

// Run every 5 minutes (300,000 ms)
setInterval(checkTickets, 300000);
checkTickets();