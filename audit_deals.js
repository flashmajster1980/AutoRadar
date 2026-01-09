const db = require('./database');

async function audit() {
    console.log('🕵️‍♂️ Auditing GOLDEN DEALS...\n');

    const rows = await db.dbAsync.all(`
        SELECT id, title, price, corrected_median, km, year, make, model, fuel, transmission 
        FROM listings 
        WHERE deal_type = 'GOLDEN DEAL'
        ORDER BY deal_score DESC
    `);

    console.log(`Found ${rows.length} Golden Deals.\n`);

    console.log('ID | Model | Year | KM | Price | Market Value | Discount | Flag');
    console.log('-'.repeat(100));

    for (const r of rows) {
        let flag = '';
        if (!r.km) flag += ' ⚠️ NULL KM ';
        if (!r.corrected_median || r.corrected_median < 1000) flag += ' ⚠️ LOW MARKET VAL ';

        // Check for massive discrepancies
        const ratio = r.corrected_median / r.price;
        if (ratio > 2.0) flag += ' 🚨 >2x VALUE ';
        if (ratio < 1.15) flag += ' 📉 LOW MARGIN ';

        console.log(`${r.id.padEnd(10)} | ${r.make} ${r.model} | ${r.year} | ${r.km ? r.km : 'NULL'} | ${r.price}€ | ${r.corrected_median}€ | ${Math.round((r.corrected_median - r.price) / r.corrected_median * 100)}% | ${flag}`);
    }
}

audit();
