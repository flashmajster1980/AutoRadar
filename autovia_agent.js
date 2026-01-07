const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    BASE_URL: 'https://www.autovia.sk/',
    LISTINGS_FILE: path.join(__dirname, 'listings.json'),
    MAX_PAGES: 3,
    SEARCH_CONFIGS_FILE: path.join(__dirname, 'search_configs.json'),
};

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8'
};

async function scrapeAutovia(searchConfig = null) {
    const queryName = searchConfig ? searchConfig.name : 'Latest Cars';
    console.log(`\n🚀 [Autovia.sk] Starting scrape for: ${queryName}...`);

    let allNewListings = [];

    for (let pageNum = 1; pageNum <= CONFIG.MAX_PAGES; pageNum++) {
        let searchUrl = `${CONFIG.BASE_URL}vysledky/osobne-vozidla/`;
        if (searchConfig && searchConfig.query) {
            const q = searchConfig.query.toLowerCase();
            // Map common brands to their Autovia path
            if (q.includes('tesla')) searchUrl += 'tesla/model-3/';
            else if (q.includes('skoda')) searchUrl += 'skoda/octavia/';
            else if (q.includes('volkswagen')) searchUrl += 'volkswagen/tiguan/';
            else if (q.includes('bmw')) searchUrl += 'bmw/x5/';
        }

        if (pageNum > 1) {
            searchUrl += `${searchUrl.endsWith('/') ? '' : '/'}?page=${pageNum}`;
        }

        console.log(`🌐 [Page ${pageNum}] Fetching: ${searchUrl}`);

        try {
            const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);
            const items = $('a.block.no-underline');

            console.log(`📊 Found ${items.length} potential listings.`);

            if (items.length === 0) break;

            items.each((i, el) => {
                try {
                    const item = $(el);
                    const title = item.find('h2').text().trim();
                    if (!title) return;

                    const url = new URL(item.attr('href'), CONFIG.BASE_URL).href;
                    const id = 'autovia_' + url.split('/').filter(Boolean).pop();

                    const priceText = item.find('div.text-2xl.font-semibold').text();
                    const price = parseInt(priceText.replace(/\s/g, '').replace('€', '').replace(/\D/g, '')) || null;

                    const yearText = item.find('span[aria-label*="Rok výroby"]').text();
                    const yearMatch = yearText.match(/\d{4}/);
                    const year = yearMatch ? parseInt(yearMatch[0]) : null;

                    const kmText = item.find('span[aria-label*="Najazdené km"]').text();
                    const km = parseInt(kmText.replace(/\s/g, '').replace('km', '').replace(/\D/g, '')) || null;

                    const fuel = item.find('span[aria-label*="Palivo"]').text().trim() || null;
                    const transmission = item.find('span[aria-label*="Prevodovka"]').text().trim() || null;

                    // Extract location (usually the last or second to last span in the list)
                    const infoSpans = item.find('div.flex.flex-wrap span');
                    let location = null;
                    infoSpans.each((j, span) => {
                        const t = $(span).text().trim();
                        if (t.includes('kraj') || t.includes('okres')) {
                            location = t;
                        }
                    });

                    allNewListings.push({
                        id,
                        title,
                        price,
                        year,
                        km,
                        location,
                        url,
                        fuel,
                        transmission,
                        portal: 'Autovia.sk',
                        scrapedAt: new Date().toISOString()
                    });
                } catch (e) { }
            });

        } catch (error) {
            console.error(`❌ Error fetching page ${pageNum}:`, error.message);
            break;
        }

        await new Promise(r => setTimeout(r, 1000));
    }

    if (allNewListings.length > 0) {
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
        console.log(`💾 Saved ${newCount} new listings. Total in DB: ${existingData.length}`);
    }
}

async function run() {
    console.log('🤖 Autovia.sk Agent (Cheerio) - STARTED');
    let configs = [null];
    if (fs.existsSync(CONFIG.SEARCH_CONFIGS_FILE)) {
        try {
            configs = [null, ...JSON.parse(fs.readFileSync(CONFIG.SEARCH_CONFIGS_FILE, 'utf-8'))];
        } catch (e) { }
    }
    for (const config of configs) {
        await scrapeAutovia(config);
    }
    console.log('✅ Autovia.sk Agent - COMPLETED');
}

run();
