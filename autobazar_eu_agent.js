const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const CONFIG = {
    BASE_URL: 'https://www.autobazar.eu/',
    LISTINGS_FILE: path.join(__dirname, 'listings.json'),
    MAX_PAGES: 3,
    SEARCH_CONFIGS_FILE: path.join(__dirname, 'search_configs.json'),
};

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

async function scrapeAutobazar(searchConfig = null) {
    const queryName = searchConfig ? searchConfig.name : 'Latest Cars';
    console.log(`\n🚀 [Autobazar.eu] Starting scrape for: ${queryName}...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);

        // Block images to save bandwidth and potentially avoid some trackers
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (req.resourceType() === 'image') req.abort();
            else req.continue();
        });

        let allNewListings = [];

        for (let pageNum = 1; pageNum <= CONFIG.MAX_PAGES; pageNum++) {
            let searchUrl = '';
            if (searchConfig && searchConfig.query) {
                searchUrl = `${CONFIG.BASE_URL}vysledky/?keyword=${encodeURIComponent(searchConfig.query)}`;
                if (pageNum > 1) searchUrl += `&page=${pageNum}`;
            } else {
                searchUrl = `${CONFIG.BASE_URL}vysledky-najnovsie/osobne-vozidla/`;
                if (pageNum > 1) searchUrl += `?page=${pageNum}`;
            }

            console.log(`🌐 [Page ${pageNum}/${CONFIG.MAX_PAGES}] Navigating to: ${searchUrl}`);

            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(r => setTimeout(r, 5000));

            // Handle cookie banner - look for "Prijať všetko"
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, a, span'));
                const accept = buttons.find(b => b.innerText && (b.innerText.includes('Prijať všetko') || b.innerText.includes('Prijat vsetko')));
                if (accept) {
                    if (accept.tagName === 'BUTTON') accept.click();
                    else accept.parentElement.click();
                }
            });
            await new Promise(r => setTimeout(r, 2000));

            const extracted = await page.evaluate(() => {
                const results = [];
                // Find all containers that have an H2 (title)
                const h2s = Array.from(document.querySelectorAll('h2'));

                h2s.forEach(h2 => {
                    try {
                        // Navigate up to the listing container
                        let container = h2.parentElement;
                        // Go up until we find a container that has both price and km, or we hit body
                        while (container && container.tagName !== 'BODY' &&
                            (!container.innerText.includes('€') || !container.innerText.includes('km'))) {
                            container = container.parentElement;
                        }

                        if (!container || container.tagName === 'BODY') return;

                        const title = h2.innerText.trim();
                        const linkElem = container.querySelector('a[href*="/detail/"]');
                        if (!linkElem) return;
                        const url = linkElem.href;

                        // ID extraction
                        const idMatch = url.match(/\/detail.*\/([a-zA-Z0-9]+)\/$/) || url.match(/\/([a-zA-Z0-9]+)\/$/);
                        const id = 'eu_' + (idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 9));

                        // Price - look for span with font-semibold and €
                        let price = null;
                        const priceElem = Array.from(container.querySelectorAll('span')).find(s => s.innerText.includes('€'));
                        if (priceElem) {
                            price = parseInt(priceElem.innerText.replace(/\s/g, '').replace('€', '').replace(/\D/g, ''));
                        }
                        if (!price || price < 500) return;

                        // Details (Year, KM, Fuel, Transmission)
                        const allInfoSpans = Array.from(container.querySelectorAll('span, a')).map(el => el.innerText.trim());
                        const containerText = allInfoSpans.join(' | ') + ' ' + container.innerText;

                        // Year - looking for 4 digits starting with 20 or 19
                        const yearMatch = containerText.match(/\b(20\d{2}|19\d{2})\b/);
                        const year = yearMatch ? parseInt(yearMatch[1]) : null;

                        // KM - looking for number followed by km
                        const kmMatch = containerText.match(/(\d[\d\s]*)\s*km/);
                        const km = kmMatch ? parseInt(kmMatch[1].replace(/\s/g, '')) : null;

                        let location = null;
                        const locMatch = containerText.match(/([A-Z][a-z]+)\s*kraj/);
                        if (locMatch) location = locMatch[0];

                        // Transmission
                        let transmission = null;
                        if (/Automat/i.test(containerText)) transmission = 'Automat';
                        else if (/Manuál|Manual/i.test(containerText)) transmission = 'Manuál';

                        // Fuel
                        let fuel = null;
                        if (/Diesel/i.test(containerText)) fuel = 'Diesel';
                        else if (/Benzín|Benzin/i.test(containerText)) fuel = 'Benzín';
                        else if (/Elektro|Electric|Elektromotor/i.test(containerText)) fuel = 'Elektro';
                        else if (/Hybrid/i.test(containerText)) fuel = 'Hybrid';

                        results.push({
                            id,
                            title,
                            price,
                            year,
                            km,
                            location,
                            url,
                            transmission,
                            fuel,
                            portal: 'Autobazar.eu',
                            scrapedAt: new Date().toISOString()
                        });
                    } catch (e) { }
                });

                // Deduplicate by URL
                const unique = [];
                const seenUrls = new Set();
                results.forEach(item => {
                    if (!seenUrls.has(item.url)) {
                        seenUrls.add(item.url);
                        unique.push(item);
                    }
                });
                return unique;
            });

            console.log(`✅ Found ${extracted.length} listings.`);
            allNewListings.push(...extracted);

            if (extracted.length === 0) break;

            await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
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
        console.log(`💾 Saved ${newCount} new listings from Autobazar.eu. Total items in DB: ${existingData.length}`);

    } catch (error) {
        console.error('❌ Error during Autobazar scraping:', error.message);
    } finally {
        await browser.close();
    }
}

async function run() {
    console.log('🤖 Autobazar.eu Agent - STARTED');

    let configs = [null];
    if (fs.existsSync(CONFIG.SEARCH_CONFIGS_FILE)) {
        try {
            configs = [null, ...JSON.parse(fs.readFileSync(CONFIG.SEARCH_CONFIGS_FILE, 'utf-8'))];
        } catch (e) { }
    }

    for (const config of configs) {
        await scrapeAutobazar(config);
        await new Promise(r => setTimeout(r, 10000));
    }

    console.log('\n✅ Autobazar.eu Agent - COMPLETED');
}

run();
