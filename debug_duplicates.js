const { dbAsync } = require('./database');

async function checkDuplicates() {
    console.log('🔍 Checking for BMW X5 duplicates...');
    try {
        const rows = await dbAsync.all('SELECT * FROM listings WHERE title LIKE "%BMW X5%M60i%"');

        console.log(`Found ${rows.length} listings:`);
        rows.forEach(r => {
            console.log(`\nID: ${r.id}`);
            console.log(`Title: ${r.title}`);
            console.log(`Price: ${r.price}`);
            console.log(`KM: ${r.km}`);
            console.log(`Year: ${r.year}`);
            console.log(`Location: ${r.location}`);
            console.log(`VIN: ${r.vin}`);
            console.log(`URL: ${r.url}`);
        });

    } catch (err) {
        console.error(err);
    }
}

checkDuplicates();
