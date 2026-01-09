const puppeteer = require('puppeteer');
const { dbAsync } = require('./database');

async function inspectPage() {
    const row = await dbAsync.get("SELECT url FROM listings WHERE id = 'eu_9mhfpkryi'");
    if (!row) {
        console.log('Listing not found via ID. Searching by Title...');
        const row2 = await dbAsync.get("SELECT url FROM listings WHERE title LIKE '%BMW X5 M M60i%'");
        if (row2) console.log('Found URL:', row2.url);
        else { console.log('Not found.'); return; }
        row = row2;
    }

    console.log(`Inspecting URL: ${row.url}`);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(row.url, { waitUntil: 'domcontentloaded' });

    // Try to find description interactively (Broader search)
    const description = await page.evaluate(() => {
        // Look for "Poznámka" heading
        const allo = Array.from(document.querySelectorAll('*'));
        const noteHeader = allo.find(el => el.innerText && el.innerText.trim() === 'Poznámka');

        if (noteHeader) {
            // Return following element?
            let next = noteHeader.nextElementSibling;
            while (next) {
                if (next.innerText.length > 20) return { method: 'After Poznámka', text: next.innerText, html: next.outerHTML.substring(0, 200) };
                next = next.nextElementSibling;
            }
            return { method: 'Found Header but no text', text: noteHeader.parentElement.innerText.substring(0, 500) };
        }

        return { method: 'NOT_FOUND', bodyStart: document.body.innerText.substring(0, 1000) };
    });

    console.log('Result:', description);

    await browser.close();
}

inspectPage();
