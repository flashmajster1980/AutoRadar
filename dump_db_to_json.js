const { dbAsync } = require('./database');
const fs = require('fs');
const path = require('path');

async function dump() {
    console.log('📦 Dumping listings from DB to listings.json...');
    const listings = await dbAsync.all("SELECT * FROM listings");

    // Ensure numeric types are correct
    const sanitized = listings.map(l => ({
        ...l,
        price: l.price ? parseFloat(l.price) : null,
        year: l.year ? parseInt(l.year) : null,
        km: l.km ? parseInt(l.km) : null
    }));

    fs.writeFileSync(path.join(__dirname, 'listings.json'), JSON.stringify(sanitized, null, 2));
    console.log(`✅ Dumped ${listings.length} listings.`);
}

dump();
