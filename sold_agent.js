const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const CONFIG = {
    LISTINGS_FILE: path.join(__dirname, 'listings.json'),
    SCORED_FILE: path.join(__dirname, 'scored_listings.json'),
    CHECK_LIMIT: 50, // Check max 50 listings per run to save time
};

async function checkListing(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

        // Bazos specific "not found" indicators
        const isNotFound = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            // Check for typical Bazos "removed" messages
            return bodyText.includes('Inzerát bol odstránený') ||
                bodyText.includes('Inzerát nenalezen') ||
                document.title.includes('Bazoš - chyba') ||
                window.location.href === 'https://auto.bazos.sk/' ||
                document.querySelectorAll('.inzeratydetail').length === 0;
        });

        return !isNotFound;
    } catch (e) {
        console.log(`⚠️ Error checking ${url}: ${e.message}`);
        return true; // Assume it exists if error (to be safe)
    }
}

async function run() {
    console.log('🤖 Sold Detection Agent - STARTED\n');
    const { dbAsync } = require('./database');

    // Filter listings from DB that are NOT already marked as sold
    const toCheck = await dbAsync.all(`
        SELECT * FROM listings 
        WHERE is_sold = 0 
        ORDER BY last_checked ASC 
        LIMIT ?
    `, [CONFIG.CHECK_LIMIT]);

    if (toCheck.length === 0) {
        console.log('✅ No active listings to check.');
        return;
    }

    let scoredListings = fs.existsSync(CONFIG.SCORED_FILE) ? JSON.parse(fs.readFileSync(CONFIG.SCORED_FILE, 'utf-8')) : [];

    console.log(`🔍 Checking ${toCheck.length} listings for availability...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let soldCount = 0;
    for (const listing of toCheck) {
        process.stdout.write(`⏳ Checking [${listing.id}]... `);
        const exists = await checkListing(page, listing.url);

        const now = new Date().toISOString();

        if (!exists) {
            console.log('🔴 SOLD');
            await dbAsync.run(
                'UPDATE listings SET is_sold = 1, sold_at = ?, last_checked = ? WHERE id = ?',
                [now, now, listing.id]
            );
            soldCount++;

            // Update in scored listings too (for dashboard compatibility)
            const scoredIdx = scoredListings.findIndex(sl => sl.id === listing.id);
            if (scoredIdx !== -1) {
                scoredListings[scoredIdx].isSold = true;
                scoredListings[scoredIdx].soldAt = now;
            }
        } else {
            console.log('🟢 ACTIVE');
            await dbAsync.run(
                'UPDATE listings SET last_checked = ? WHERE id = ?',
                [now, listing.id]
            );
        }

        // Small delay to be nice
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    }

    await browser.close();

    // Save back to JSON only for scoredListings (dashboard)
    if (scoredListings.length > 0) {
        fs.writeFileSync(CONFIG.SCORED_FILE, JSON.stringify(scoredListings, null, 2));
    }

    console.log(`\n✅ Sold Detection Agent - COMPLETED`);
    console.log(`📊 Result: ${soldCount} listings marked as SOLD.`);
}

run();
