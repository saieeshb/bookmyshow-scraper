require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

async function testTelegramAlert() {
    console.log("Attempting to send test alert...");
    
    if (!token || !chatId) {
        console.error("❌ Error: Missing Telegram token or chat ID in your .env file.");
        return;
    }

    const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    
    try {
        const response = await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                text: "🔔 TEST ALERT! Your BookMyShow monitor is successfully connected to Telegram." 
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            console.log("✅ Success! Check your Telegram app for the message.");
        } else {
            console.error("❌ Telegram API Error:", data.description);
        }
    } catch (err) {
        console.error("❌ Failed to reach Telegram:", err.message);
    }
}

testTelegramAlert();