const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const CONFIG = {
    BASE_URL: 'https://www.autobazar.sk/',
    LISTINGS_FILE: path.join(__dirname, 'listings.json'),
    MAX_PAGES: 3,
    SEARCH_CONFIGS_FILE: path.join(__dirname, 'search_configs.json'),
};

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

async function scrapeAutobazarSK(searchConfig = null) {
    const queryName = searchConfig ? searchConfig.name : 'Latest Ads';
    console.log(`\n🚀 [Autobazar.sk] Starting scrape for: ${queryName}...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);

        // Block images
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (req.resourceType() === 'image') req.abort();
            else req.continue();
        });

        let allNewListings = [];

        for (let pageNum = 1; pageNum <= CONFIG.MAX_PAGES; pageNum++) {
            let searchUrl = '';
            if (searchConfig && searchConfig.query) {
                // Formatting query for their subdomained or keyword search
                // For simplicity, let's use the keyword search URL
                searchUrl = `https://www.autobazar.sk/vyhladavanie/?q=${encodeURIComponent(searchConfig.query)}`;
                if (pageNum > 1) searchUrl += `&p[page]=${pageNum}`;
            } else {
                searchUrl = `https://www.autobazar.sk/osobne-vozidla/`;
                if (pageNum > 1) searchUrl += `?p[page]=${pageNum}`;
            }

            console.log(`🌐 [Page ${pageNum}/${CONFIG.MAX_PAGES}] Navigating to: ${searchUrl}`);

            try {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch (e) {
                console.log(`⚠️ Navigation timeout, attempting to continue...`);
            }

            await new Promise(r => setTimeout(r, 5000));

            // Handle cookie banner
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, a, span'));
                const accept = buttons.find(b => b.innerText && b.innerText.includes('Prijať všetko'));
                if (accept) {
                    if (accept.tagName === 'BUTTON') accept.click();
                    else accept.parentElement.click();
                }
            });
            await new Promise(r => setTimeout(r, 2000));

            const extracted = await page.evaluate(() => {
                const results = [];
                // More specific selector for listings
                const cards = Array.from(document.querySelectorAll('.item, [class*="ListingItem"]'));

                cards.forEach(card => {
                    try {
                        const titleLink = card.querySelector('.item-heading a, h2 a');
                        if (!titleLink) return;

                        const title = titleLink.innerText.trim();
                        const url = titleLink.href;

                        // ID extraction from URL
                        const idMatch = url.match(/-id(\d+)\.html/) || url.match(/\/(\d+)\/$/);
                        const id = 'sk_' + (idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 9));

                        // Price - FIX: Extract only the first price found
                        const priceElem = card.querySelector('.price, [class*="Price"]');
                        let price = null;
                        if (priceElem) {
                            const priceText = priceElem.innerText.replace(/\s/g, '').replace('€', '');
                            const match = priceText.match(/^\d+/); // Just the first sequence of digits
                            price = match ? parseInt(match[0]) : null;
                        }
                        if (!price || price < 500 || price > 500000) return;

                        // Metadata from text content
                        const teaserText = card.innerText;

                        // Year
                        const yearMatch = teaserText.match(/r\.\s*(20\d{2}|19\d{2})/);
                        const year = yearMatch ? parseInt(yearMatch[1]) : null;

                        // KM
                        const kmMatch = teaserText.match(/(\d[\d\s]*)\s*km/);
                        const km = kmMatch ? parseInt(kmMatch[1].replace(/\s/g, '')) : null;

                        // Location
                        const locMatch = teaserText.match(/([A-ZŽŠČŤŽ]{2})\s*kraj/i);
                        const location = locMatch ? locMatch[0] : null;

                        // Fuel
                        let fuel = null;
                        if (teaserText.match(/Diesel/i)) fuel = 'Diesel';
                        else if (teaserText.match(/Benzín|Benzin/i)) fuel = 'Benzín';
                        else if (teaserText.match(/Elektro|Electric/i)) fuel = 'Elektro';
                        else if (teaserText.match(/Hybrid/i)) fuel = 'Hybrid';

                        results.push({
                            id,
                            title,
                            price,
                            year,
                            km,
                            url,
                            fuel,
                            location,
                            portal: 'Autobazar.sk',
                            scrapedAt: new Date().toISOString()
                        });
                    } catch (e) { }
                });
                return results;
            });

            console.log(`✅ Found ${extracted.length} listings.`);
            allNewListings.push(...extracted);

            if (extracted.length === 0) break;

            await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
        }

        const existingData = fs.existsSync(CONFIG.LISTINGS_FILE) ? JSON.parse(fs.readFileSync(CONFIG.LISTINGS_FILE, 'utf-8')) : [];
        const existingIds = new Set(existingData.map(l => l.id));

        let newCount = 0;
        allNewListings.forEach(l => {
            if (!existingIds.has(l.id)) {
                existingData.push(l);
                existingIds.add(l.id);
                newCount++;
            }
        });

        fs.writeFileSync(CONFIG.LISTINGS_FILE, JSON.stringify(existingData, null, 2));
        console.log(`💾 Saved ${newCount} new listings from Autobazar.sk. Total items in DB: ${existingData.length}`);

    } catch (error) {
        console.error('❌ Error during Autobazar.sk scraping:', error.message);
    } finally {
        await browser.close();
    }
}

async function run() {
    console.log('🤖 Autobazar.sk Agent - STARTED');

    let configs = [null];
    if (fs.existsSync(CONFIG.SEARCH_CONFIGS_FILE)) {
        try {
            configs = [null, ...JSON.parse(fs.readFileSync(CONFIG.SEARCH_CONFIGS_FILE, 'utf-8'))];
        } catch (e) { }
    }

    for (const config of configs) {
        await scrapeAutobazarSK(config);
        await new Promise(r => setTimeout(r, 8000));
    }

    console.log('\n✅ Autobazar.sk Agent - COMPLETED');
}

run();
