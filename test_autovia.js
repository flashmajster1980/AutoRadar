const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testAutovia() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1000 });

        console.log('Navigating to Autovia...');
        const url = 'https://www.autovia.sk/vysledky/osobne-vozidla/tesla/model-3/';

        // Try without waitUntil
        await page.goto(url, { timeout: 20000 });
        console.log('Navigation call finished, waiting 5s...');
        await new Promise(r => setTimeout(r, 5000));

        await page.screenshot({ path: 'autovia_test.png' });
        console.log('Screenshot taken.');

        const data = await page.evaluate(() => {
            return {
                title: document.title,
                html: document.body.innerText.substring(0, 200),
                h2Count: document.querySelectorAll('h2').length
            };
        });
        console.log('Data:', data);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
}

testAutovia();
