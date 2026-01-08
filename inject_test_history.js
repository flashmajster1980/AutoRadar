const { dbAsync } = require('./database');

async function injectDummyHistory() {
    console.log('💉 Injecting dummy price history for testing...');

    // Get some golden deals or any listings
    const listings = await dbAsync.all('SELECT id, price FROM listings LIMIT 5');

    for (const l of listings) {
        // Add a price from 2 days ago (higher price)
        const oldPrice = Math.round(l.price * 1.1);
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];

        await dbAsync.run('INSERT INTO price_history (listing_id, price, checked_at) VALUES (?, ?, ?)', [l.id, oldPrice + 500, fourDaysAgo]);
        await dbAsync.run('INSERT INTO price_history (listing_id, price, checked_at) VALUES (?, ?, ?)', [l.id, oldPrice, twoDaysAgo]);

        console.log(`✅ Added 2 history points for ${l.id}`);
    }

    console.log('🚀 Done! Now run scoring_agent.js and push to Git.');
    process.exit(0);
}

injectDummyHistory();
