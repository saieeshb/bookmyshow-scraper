require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const url = process.env.BMS_EVENT_URL;

// Replace x and y with your exact coordinates for J24
const targetSeats = [
    { name: 'J24', x: 772, y: 329 } 
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
    
    // THE UNDERGROUND LAUNCH:
    // We switch to a persistent context and drop all default automation parameters.
    // This removes the "Chrome is being controlled by automated software" banner entirely.
    const context = await chromium.launchPersistentContext('', {
        headless: false,
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
        ignoreDefaultArgs: ['--enable-automation'], // Removes the primary bot flag
        args: [
            '--disable-blink-features=AutomationControlled', // Erases navigator.webdriver
            '--no-sandbox',
            '--disable-infobars'
        ]
    });
    
    // Grab the initial page created by the persistent context
    const page = context.pages()[0] || await context.newPage();

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

        await page.waitForTimeout(4000); 

        let foundOpenSeat = false;

        for (let seat of targetSeats) {
            console.log(`Testing click on ${seat.name} at pixels (${seat.x}, ${seat.y})...`);
            
           
            // Move mouse naturally
        await page.mouse.move(seat.x, seat.y);
        await page.waitForTimeout(200);
        await page.mouse.down();
        await page.waitForTimeout(100); 
        await page.mouse.up(); // <-- THIS WAS MISSING
        await page.waitForTimeout(2000); // Give the interface plenty of time...
            
            await page.waitForTimeout(2000); // Give the interface plenty of time to respond
            
            const screenText = await page.evaluate(() => document.body.innerText.toLowerCase());
            
            if (screenText.includes('pay ₹') || screenText.includes('pay rs') || screenText.includes('pay ')) {
                foundOpenSeat = true;
                break; 
            }
        }

        if (foundOpenSeat) {
            console.log("SUCCESS: Click registered an open seat!");
            await sendTelegramAlert(`🚨 Target seats are live! The Pay button appeared. Go check: ${url}`);
            
            // FIX: Close the browser and kill the monitor completely
            await context.close(); 
            process.exit(0); 
        } else {
            console.log("Clicks did not trigger a Pay button. Seats are blocked. Checking again later.");
            await context.close();
        }
    } catch (error) {
        console.error("Error checking page:", error.message);
        await context.close();
    }
}

// Run every 5 minutes
setInterval(checkTickets, 300000);
checkTickets();