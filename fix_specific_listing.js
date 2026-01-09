const puppeteer = require('puppeteer');
const { dbAsync } = require('./database');

async function fixListing() {
    console.log('Starting specific enrichment...');
    const row = await dbAsync.get("SELECT * FROM listings WHERE id = 'eu_9mhfpkryi'");
    if (!row) return console.log('Listing not found');

    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`Navigating to ${row.url}...`);
    await page.goto(row.url, { waitUntil: 'domcontentloaded' });

    const detailData = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        let damageInfo = '';
        if (bodyText.match(/havarovan(é|e|ý)|poškoden(é|e|ý)|búran(é|e|ý)|po nehode/i)) {
            damageInfo = ' STAV: HAVAROVANÉ / POŠKODENÉ';
        }
        return { damageDetail: damageInfo };
    });

    console.log('Enrichment Result:', detailData);

    if (detailData.damageDetail) {
        const newDesc = (row.description || '') + detailData.damageDetail;
        await dbAsync.run("UPDATE listings SET description = ? WHERE id = ?", [newDesc, row.id]);
        console.log('✅ Database updated with damage info.');
    } else {
        console.log('⚠️ No damage info detected on page.');
    }

    await browser.close();
}

fixListing();
