const db = require('./database');

async function inspect() {
    console.log('🕵️‍♂️ Inspecting BMW X5 2019 Market Data...\n');

    // Fetch all 2019 X5s
    const rows = await db.dbAsync.all(`
        SELECT id, title, price, km, fuel, engine, equip_level 
        FROM listings 
        WHERE make = 'BMW' AND model = 'X5' AND year = 2019 
        ORDER BY km ASC
    `);

    console.log(`Found ${rows.length} listings for 2019 X5.`);
    console.log('-'.repeat(80));

    const segments = {
        low: [],   // < 100k
        mid: [],   // 100k - 200k
        high1: [], // 200k - 250k
        high2: [], // 250k - 300k
        other: []
    };

    for (const r of rows) {
        let seg = 'other';
        if (!r.km) seg = 'missing'; // Should be handled
        else if (r.km < 100000) seg = 'low';
        else if (r.km < 200000) seg = 'mid';
        else if (r.km < 250000) seg = 'high1';
        else if (r.km < 300000) seg = 'high2';
        else if (r.km < 400000) seg = 'level300';

        if (segments[seg] !== undefined) segments[seg].push(r.price);
        else segments.other.push(r.price);

        console.log(`[${seg.padEnd(7)}] ${r.km}km | ${r.price}€ | ${r.title.substring(0, 40)}...`);
    }

    console.log('\n--- SEGMENT MEDIANS ---');
    for (const [key, prices] of Object.entries(segments)) {
        if (prices.length === 0) {
            console.log(`${key}: No data`);
            continue;
        }

        prices.sort((a, b) => a - b);
        const mid = Math.floor(prices.length / 2);
        const median = prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;

        console.log(`${key.toUpperCase()}: ${prices.length} cars | Median: ${median}€ | Min: ${prices[0]} | Max: ${prices[prices.length - 1]}`);
    }
}

inspect();
