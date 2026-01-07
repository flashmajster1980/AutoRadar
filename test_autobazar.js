const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testScrape() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('Opening Autobazar.eu...');
    try {
        await page.goto('https://www.autobazar.eu/vysledky/?keyword=Tesla+Model+3', { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.log('Page load timeout, trying to proceed anyway...');
    }

    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: 'autobazar_test.png' });

    // Handle cookie banner specifically
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const accept = buttons.find(b => b.innerText.toLowerCase().includes('prijať všetko') || b.innerText.toLowerCase().includes('prijat vsetko'));
        if (accept) accept.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Extract data
    const listings = await page.evaluate(() => {
        const results = [];
        const h2s = Array.from(document.querySelectorAll('h2'));

        h2s.forEach(h2 => {
            try {
                let container = h2.parentElement;
                // Go up until we find a container that has both price and km, or we hit body
                while (container && container.tagName !== 'BODY' &&
                    (!container.innerText.includes('€') || !container.innerText.includes('km'))) {
                    container = container.parentElement;
                }

                if (!container || container.tagName === 'BODY') return;

                const title = h2.innerText.trim();
                const linkElem = container.querySelector('a[href*="/detail/"]');
                const url = linkElem ? linkElem.href : null;

                let price = null;
                const priceElem = Array.from(container.querySelectorAll('span')).find(s => s.innerText.includes('€'));
                if (priceElem) {
                    price = parseInt(priceElem.innerText.replace(/\s/g, '').replace('€', '').replace(/\D/g, ''));
                }

                const allInfoSpans = Array.from(container.querySelectorAll('span, a')).map(el => el.innerText.trim());
                const containerText = allInfoSpans.join(' | ') + ' ' + container.innerText;
                if (title.includes('Standard Range Plus')) {
                    console.log("DEBUG [Standard Range Plus] TEXT:", containerText);
                }
                const yearMatch = containerText.match(/\b(20\d{2}|19\d{2})\b/);
                const year = yearMatch ? yearMatch[1] : 'N/A';

                const kmMatch = containerText.match(/(\d[\d\s]*)\s*km/);
                const km = kmMatch ? kmMatch[1].replace(/\s/g, '') : 'N/A';

                let fuel = 'N/A';
                if (/Diesel/i.test(containerText)) fuel = 'Diesel';
                else if (/Benzín|Benzin/i.test(containerText)) fuel = 'Benzín';
                else if (/Elektro|Electric|Elektromotor/i.test(containerText)) fuel = 'Elektro';
                else if (/Hybrid/i.test(containerText)) fuel = 'Hybrid';

                results.push({ title, url, price, specs: `${year} | ${km} km | ${fuel}` });
            } catch (e) { }
        });
        return results;
    });

    console.log(`Found ${listings.length} listings.`);
    listings.slice(0, 5).forEach((l, i) => {
        console.log(`${i + 1}. ${l.title} - €${l.price}`);
        console.log(`   Specs: ${l.specs.substring(0, 100)}`);
        console.log(`   Link: ${l.url}`);
    });

    await browser.close();
}

testScrape();
