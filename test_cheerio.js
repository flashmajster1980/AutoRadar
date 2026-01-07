const axios = require('axios');
const cheerio = require('cheerio');

async function testCheerio() {
    try {
        const res = await axios.get('https://www.autovia.sk/vysledky/osobne-vozidla/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(res.data);
        const items = $('a.block.no-underline');
        console.log(`Found ${items.length} items with Cheerio.`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
testCheerio();
