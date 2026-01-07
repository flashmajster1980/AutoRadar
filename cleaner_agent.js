const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONFIG = {
    DATA_FILE: path.join(__dirname, 'scored_listings.json'),
    CONCURRENCY: 5, // How many at once to avoid being blocked
    DELAY_MS: 300   // Delay between small batches
};

/**
 * Checks if a car listing is still active.
 * Detects redirects to homepages or search pages as "Sold".
 */
async function checkListingStatus(url) {
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: (status) => status < 400, // 404 is sold
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            }
        });

        const finalUrl = response.request.res.responseUrl || response.config.url;

        // DETECTION LOGIC PER PORTAL
        // Bazos: Redirects to home or search if deleted
        if (url.includes('bazos.sk') && (finalUrl === 'https://auto.bazos.sk/' || finalUrl.includes('?hledat='))) {
            return { active: false, reason: 'Bazos redirect (deleted)' };
        }

        // Autobazar.eu: Redirects to search or list if deleted
        if (url.includes('autobazar.eu') && finalUrl !== url && (finalUrl.includes('/vysledky/') || finalUrl.endsWith('.eu/'))) {
            return { active: false, reason: 'Autobazar redirect (deleted)' };
        }

        // Autovia.sk: Redirects to home or list
        if (url.includes('autovia.sk') && finalUrl !== url && (finalUrl.includes('/auta/') || finalUrl.length < 30)) {
            return { active: false, reason: 'Autovia redirect (deleted)' };
        }

        // Check for common "sold" strings in HTML content (fallback)
        const html = response.data.toLowerCase();
        const soldMarkers = [
            'inzerát pod týmto číslom neexistuje',
            'ľutujeme, ale inzerát už nie je',
            'ponuka bola ukončená',
            'predané',
            'inzerát nie je dostupný'
        ];

        if (soldMarkers.some(m => html.includes(m))) {
            return { active: false, reason: 'Sold markers in HTML' };
        }

        return { active: true };
    } catch (error) {
        if (error.response && (error.response.status === 404 || error.response.status === 410)) {
            return { active: false, reason: `HTTP ${error.response.status}` };
        }
        // If timeout or other error, assume it's a temp issue or just keep it for now
        return { active: true, error: error.message };
    }
}

async function runCleaner() {
    console.log('🧹 Cleaner Agent - STARTED\n');

    if (!fs.existsSync(CONFIG.DATA_FILE)) {
        console.error(`❌ Data file not found: ${CONFIG.DATA_FILE}`);
        return;
    }

    const data = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf-8'));
    console.log(`📋 Total listings in database: ${data.length}\n`);

    const updatedData = [];
    let markedSold = 0;
    let autoDeleted = 0;
    let errorCount = 0;
    const now = new Date();

    // Batch processing
    for (let i = 0; i < data.length; i += CONFIG.CONCURRENCY) {
        const batch = data.slice(i, i + CONFIG.CONCURRENCY);
        console.log(`🔍 Checking batch ${Math.floor(i / CONFIG.CONCURRENCY) + 1}/${Math.ceil(data.length / CONFIG.CONCURRENCY)}...`);

        const results = await Promise.all(batch.map(async (listing) => {
            // 1. Check for Auto-Delete (Sold more than 24h ago)
            if (listing.isSold && listing.soldAt) {
                const soldDate = new Date(listing.soldAt);
                const hoursSinceSold = (now - soldDate) / (1000 * 60 * 60);
                if (hoursSinceSold >= 24) {
                    return { listing, status: { active: false, delete: true } };
                }
                return { listing, status: { active: true, alreadySold: true } };
            }

            // 2. Verify URL status
            const status = await checkListingStatus(listing.url);
            return { listing, status };
        }));

        for (const res of results) {
            const l = res.listing;
            const s = res.status;

            if (s.delete) {
                console.log(`   🗑️ AUTO-DELETE (24h+ sold): ${l.title}`);
                autoDeleted++;
                continue; // Don't add to updatedData
            }

            if (s.alreadySold) {
                updatedData.push(l); // Keep already marked sold listings
                continue;
            }

            if (s.active) {
                updatedData.push(l);
            } else {
                console.log(`   🚀 MARKED SOLD: ${l.title} (${s.reason})`);
                l.isSold = true;
                l.soldAt = now.toISOString();

                // Calculate "Sold Time" from scoredAt
                if (l.scoredAt) {
                    const discoveredAt = new Date(l.scoredAt);
                    const diffMs = now - discoveredAt;
                    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    l.soldTimeStr = `${diffHrs}h ${diffMins}m`;
                }

                updatedData.push(l);
                markedSold++;
            }
            if (s.error) errorCount++;
        }

        if (CONFIG.DELAY_MS > 0 && i + CONFIG.CONCURRENCY < data.length) {
            await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
        }
    }

    // Save updated data
    fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(updatedData, null, 2));

    // Also update JS version for dashboard
    const jsContent = `window.scoredListingsData = ${JSON.stringify(updatedData, null, 2)};`;
    fs.writeFileSync(path.join(__dirname, 'scored_listings_data.js'), jsContent);

    console.log(`\n✨ Cleaning Summary:`);
    console.log(`   - Active / Recently Sold to keep: ${updatedData.length}`);
    console.log(`   - Newly marked as SOLD: ${markedSold}`);
    console.log(`   - Auto-deleted (expired): ${autoDeleted}`);
    console.log(`   - Errors encountered: ${errorCount}`);
    console.log(`\n✅ Cleaner Agent - COMPLETED`);
}

runCleaner();
