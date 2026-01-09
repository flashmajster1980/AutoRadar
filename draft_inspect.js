const puppeteer = require('puppeteer');

async function inspectPage() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = 'https://www.autobazar.eu/detail/bmw-x5-m-m60i-xdrive-390kw-a/Am84si1_wK-t/';
    // Wait, the previous ID was eu_9mhfpkryi but I need the URL. 
    // From check_data.js output earlier, the title was "BMW X5 M M60i XDRIVE 390kw A".
    // I don't have the URL in the check_data output.
    // I should get the URL first.

    // Actually, let's fetch the URL from DB first script-wise.
    await page.close();
    await browser.close();
}
