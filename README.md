# BookMyShow Ticket Monitor 🎟️🤖

A headless browser automation tool built with **Node.js** and **Playwright**. This project runs continuously on a Linux cloud server, acting as a personal Telegram bot. You can command it via Telegram to monitor specific BookMyShow event links and seat coordinates. The moment your desired seat opens up, the bot instantly sends a Telegram alert with a direct link to the Pay screen.

> **Disclaimer:** This project is intended for educational purposes and personal use to explore headless browser automation, virtual framebuffers (`Xvfb`), and bot evasion techniques. Please respect BookMyShow's Terms of Service regarding automated scraping.

---

## ✨ Features

- **Interactive Telegram Interface** — Control the scraper dynamically from your phone (Start, Stop, and Check Status).
- **Bot Detection Evasion** — Uses `puppeteer-extra-plugin-stealth` and specific Chromium launch arguments to bypass standard anti-bot protections.
- **Headless-in-Headed Mode** — Runs an official Google Chrome GUI completely hidden inside a Linux virtual display (`Xvfb`) to ensure all UI elements load properly.
- **Process Management** — Fully daemonized using PM2 to ensure 24/7 uptime.

---

## 🧠 How the "Headless-in-Headed" Architecture Works

From the browser's perspective, this project does **not** run headlessly. The code explicitly sets `headless: false`, forcing Google Chrome to launch its full graphical user interface. This is a crucial bot-evasion tactic, as modern anti-bot systems (like BookMyShow's) instantly flag missing graphical components or unrendered window canvases typical of standard headless scripts.

To achieve this on a headless cloud server (which has no physical monitor):

- **Virtual Framebuffer (`Xvfb`)** — Creates a digital illusion by allocating a fake, invisible 1280x800 monitor directly inside the server's RAM.
- **Playwright/Chrome** — Renders the full visual site directly onto that fake memory screen.

The website thinks a real human is looking at a physical monitor, while the server keeps the process entirely invisible in the cloud.

---

## 📋 Prerequisites

Before deploying this, you will need:

1. **A Linux Server** — Ubuntu 22.04 LTS is highly recommended. (A Google Cloud `e2-medium` Spot VM works perfectly and provides the 4GB of RAM needed for heavy browser canvas rendering.)
2. **A Telegram Account** — To create your personal bot and receive alerts.

---

## 🚀 Step 1: Telegram Bot Setup

You need to generate your own Bot Token and find your personal Chat ID so the bot knows who to talk to.

1. **Get the Bot Token**
   - Open Telegram and search for `@BotFather`.
   - Send `/newbot` and follow the prompts to name your bot.
   - Copy the **HTTP API Token** it gives you.
2. **Get your Chat ID**
   - Search for `@userinfobot` on Telegram and click Start.
   - Copy the `Id` number it replies with.

---

## 🛠️ Step 2: Server Installation

Log into your Ubuntu server terminal and run the following commands sequentially to set up the environment.

**1. Update system & install core tools**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl xvfb git nano
```

**2. Install Node.js & PM2**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

**3. Clone this repository**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

**4. Install project dependencies & browsers**

```bash
npm install
npx playwright install chrome
sudo npx playwright install-deps
```

---

## ⚙️ Step 3: Configuration

Create a `.env` file in the root of your project folder to securely store your Telegram credentials:

```bash
nano .env
```

Paste your bot token and chat ID inside:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_numeric_chat_id_here
```

*(Save and exit: press `Ctrl+O`, `Enter`, then `Ctrl+X`)*

---

## 🏃 Step 4: Deployment

Because Playwright requires a visual display to bypass anti-bot systems, we must wrap our Node process in Xvfb (X Virtual Framebuffer).

**1. Create the shell wrapper**

Run this command to create a startup script that binds the virtual monitor directly to the execution:

```bash
echo 'xvfb-run --auto-servernum --server-args="-screen 0 1280x800x24" node monitor.js' > start.sh
chmod +x start.sh
```

**2. Start the background monitor**

Launch the bot using PM2 so it stays online permanently:

```bash
pm2 start ./start.sh --name "bms-bot"
```

You can view the live console logs at any time by running:

```bash
pm2 logs bms-bot
```

---

## 📱 Usage & Telegram Commands

Once the server is running, open Telegram and send a message to the bot you created with `@BotFather`.

Because your Chat ID is hardcoded in the `.env` file, the bot will completely ignore commands from anyone else, keeping your server secure.

| Command | Description |
|---|---|
| `/status` | Checks if the bot is currently idling or actively monitoring a target. |
| `/monitor <url> <seat> <x> <y>` | Starts the hunt. Pass the exact BookMyShow event URL, a label for the seat, and its X/Y pixel coordinates on your screen. |
| `/stop` | Immediately pauses background monitoring. |

**Example monitor command:**

```
/monitor https://in.bookmyshow.com/events/sample-event N42 299 495
```

When the bot successfully registers a "Pay" button on those exact coordinates, it will text you immediately with the link and put itself into standby mode!
