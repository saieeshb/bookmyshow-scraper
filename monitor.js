require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const TelegramBot = require('node-telegram-bot-api');

chromium.use(stealth);

const token = process.env.TELEGRAM_BOT_TOKEN;
// Parse the comma-separated IDs from your .env file into a clean array
const allowedChatIds = process.env.TELEGRAM_CHAT_IDS ? process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim()) : [];

// Initialize the Bot to constantly listen for messages
const bot = new TelegramBot(token, { polling: true });

// Dynamic Bot State
let currentUrl = null;
let currentSeats = [];
let monitorIntervalId = null;
let isChecking = false; 

// --- TELEGRAM COMMAND LISTENER ---
bot.on('message', (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text || '';

    // Security check: Ignore messages from strangers not in your .env list
    if (!allowedChatIds.includes(chatId)) return; 

    // Command: /monitor <url> <seatName> <x> <y>
    if (text.startsWith('/monitor')) {
        const parts = text.split(' ');
        
        if (parts.length < 5) {
            return bot.sendMessage(chatId, "⚠️ Invalid format.\nUsage: `/monitor <URL> <SeatName> <X> <Y>`\nExample: `/monitor https://in.bookmyshow.com/... N42 299 495`", { parse_mode: 'Markdown' });
        }

        currentUrl = parts[1];
        const seatName = parts[2];
        const x = parseInt(parts[3]);
        const y = parseInt(parts[4]);

        currentSeats = [{ name: seatName, x: x, y: y }];

        bot.sendMessage(chatId, `🎯 Target acquired by user!\n\n**Seat:** ${seatName}\n**Pixels:** (${x}, ${y})\n**Link:** ${currentUrl}\n\nStarting background checks every 5 minutes...`, { parse_mode: 'Markdown' });

        // Clear any old monitor loops
        if (monitorIntervalId) clearInterval(monitorIntervalId);
        
        // Run once immediately, then start the 5-minute loop
        checkTickets(); 
        monitorIntervalId = setInterval(checkTickets, 300000); 
    } 
    
    // Command: /stop
    else if (text === '/stop') {
        if (monitorIntervalId) {
            clearInterval(monitorIntervalId);
            monitorIntervalId = null;
            bot.sendMessage(chatId, "🛑 Monitoring paused. Standing by for new commands.");
        } else {
            bot.sendMessage(chatId, "I am not currently monitoring any seats.");
        }
    }

    // Command: /status
    else if (text === '/status') {
        if (monitorIntervalId) {
            bot.sendMessage(chatId, `🟢 Currently running a check for **${currentSeats[0].name}** at coordinates (${currentSeats[0].x}, ${currentSeats[0].y}).`, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, "🔴 Currently idle.");
        }
    }
});

// --- THE PLAYWRIGHT SCRAPER ---
async function checkTickets() {
    if (!currentUrl || currentSeats.length === 0) return;
    if (isChecking) {
        console.log("A check is already in progress. Skipping this cycle.");
        return; 
    }

    isChecking = true;
    console.log(`Checking BookMyShow at ${new Date().toLocaleTimeString()}...`);
    
    const context = await chromium.launchPersistentContext('', {
        headless: false,
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-infobars'
        ]
    });
    
    const page = context.pages()[0] || await context.newPage();

    try {
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
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

        for (let seat of currentSeats) {
            console.log(`Testing click on ${seat.name} at pixels (${seat.x}, ${seat.y})...`);
            
            await page.mouse.move(seat.x, seat.y);
            await page.waitForTimeout(200);
            await page.mouse.down();
            await page.waitForTimeout(100); 
            await page.mouse.up();
            await page.waitForTimeout(2000); 
            
            // Inject visual red dot for debugging screenshots
            await page.evaluate(({x, y}) => {
                const dot = document.createElement('div');
                dot.style.position = 'absolute';
                dot.style.left = `${x}px`;
                dot.style.top = `${y}px`;
                dot.style.width = '12px';
                dot.style.height = '12px';
                dot.style.backgroundColor = 'red';
                dot.style.borderRadius = '50%';
                dot.style.zIndex = '999999';
                dot.style.transform = 'translate(-50%, -50%)'; 
                document.body.appendChild(dot);
            }, { x: seat.x, y: seat.y });

            await page.screenshot({ path: 'debug-click.png', fullPage: true });
            
            const screenText = await page.evaluate(() => document.body.innerText.toLowerCase());
            
            if (screenText.includes('pay ₹') || screenText.includes('pay rs') || screenText.includes('pay ')) {
                foundOpenSeat = true;
                break; 
            }
        }

        if (foundOpenSeat) {
            console.log("SUCCESS: Click registered an open seat!");
            
            // Broadcast to every ID in the allowedChatIds array
            for (const id of allowedChatIds) {
                bot.sendMessage(id, `🚨 **TARGET SEATS ARE LIVE!** 🚨\n\nThe Pay button appeared for ${currentSeats[0].name}. Go check immediately:\n${currentUrl}`, { parse_mode: 'Markdown' })
                   .catch(err => console.error(`Failed to send to ${id}:`, err.message));
            }
            
            await context.close(); 
            clearInterval(monitorIntervalId); // Stop the background loop
            monitorIntervalId = null;
            isChecking = false;
            
        } else {
            console.log("Seats are blocked. Checking again later.");
            await context.close();
            isChecking = false;
        }
    } catch (error) {
        console.error("Error checking page:", error.message);
        await context.close();
        isChecking = false;
    }
}

console.log("Telegram Bot is online and listening for commands...");