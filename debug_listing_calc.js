const { dbAsync } = require('./database');
const fs = require('fs');
const path = require('path');
const { extractMakeModel } = require('./scoring_agent');

async function debugListingCalc() {
    const listingId = 'eu_Amj4FaHUKzm';
    console.log(`🔍 Debugging Market Price Calculation for ID: ${listingId}`);

    const listing = await dbAsync.get('SELECT * FROM listings WHERE id = ?', [listingId]);
    if (!listing) {
        console.log('❌ Listing not found.');
        return;
    }

    console.log('\n📄 Listing Data:');
    console.log(`  Title: ${listing.title}`);
    console.log(`  Price: ${listing.price} €`);
    console.log(`  Year: ${listing.year}`);
    console.log(`  KM: ${listing.km}`);
    console.log(`  Fuel: ${listing.fuel}`);
    console.log(`  Power: ${listing.power}`);

    // Load Market Values
    const marketValuesFile = path.join(__dirname, 'market_values.json');
    const marketValues = JSON.parse(fs.readFileSync(marketValuesFile, 'utf-8'));

    // Simulation of Scoring Logic
    const { make, model } = extractMakeModel(listing.title);
    console.log(`\n🧩 Extracted Make/Model: ${make} ${model}`);

    // KM SEGMENT
    let kmSegmentKey = 'mid';
    if (listing.km < 100000) kmSegmentKey = 'low';
    else if (listing.km < 200000) kmSegmentKey = 'mid';
    else if (listing.km < 250000) kmSegmentKey = 'high1';
    else if (listing.km < 300000) kmSegmentKey = 'high2';
    else if (listing.km < 400000) kmSegmentKey = 'level300';
    else if (listing.km < 500000) kmSegmentKey = 'level400';
    else kmSegmentKey = 'zombie';

    console.log(`📊 KM Segment: ${kmSegmentKey}`);

    // FIND BASE MEDIAN
    let medianPrice = null;
    let source = 'None';

    // Check Broad Match
    const broadMatch = marketValues.broad?.[make]?.[model]?.[listing.year]?.[kmSegmentKey];
    if (broadMatch) {
        medianPrice = broadMatch.medianPrice;
        source = 'Broad Match (Model + Year + KM Segment)';
        console.log(`✅ Base Median Found (${source}): ${medianPrice} €`);
    } else {
        console.log(`❌ No Base Median found for ${make} ${model} ${listing.year} (${kmSegmentKey})`);
        // Check fallback
        const yearMatch = marketValues.broad?.[make]?.[model]?.[listing.year];
        if (yearMatch) {
            console.log('   Available segments for this year:', Object.keys(yearMatch));
        }
    }


    // Fallback Logic (Matching scoring_agent.js)
    if (!medianPrice) {
        console.log('⚠️ Primary match failed. Attempting fallback to any mileage segment for this year...');
        const anyYearData = marketValues.broad?.[make]?.[model]?.[listing.year];
        if (anyYearData) {
            const firstFoundKey = Object.keys(anyYearData)[0];
            const firstFound = anyYearData[firstFoundKey];
            medianPrice = firstFound.medianPrice;
            source = `Fallback to segment '${firstFoundKey}'`
            console.log(`✅ Fallback Median Found (${source}): ${medianPrice} €`);
        }
    }

    if (!medianPrice) {
        console.log('❌ Valuation Failed: No market data available even after fallback.');
        return;
    }

    // CORRECTIONS
    let correctedMedian = medianPrice;

    // Equipment Level (Simulated)
    // We need to re-extract equipment level as it's not stored in raw DB listing always
    const { extractEquipmentScore } = require('./scoring_agent'); // We need to mock or import this private function? 
    // Wait, extractEquipmentScore is not exported. I'll paste simplified version here.

    const text = (listing.title + ' ' + (listing.description || '')).toLowerCase();
    const EQUIPMENT_KEYWORDS = {
        'LED/Xenon': ['led', 'xenon', 'bixenon', 'matrix', 'laser'],
        'Navigácia': ['navigácia', 'navigacia', 'navi', 'gps'],
        'Koža': ['koža', 'koza', 'leather'],
        'Panoráma': ['panoráma', 'panorama', 'strešné okno', 'siber'],
        '4x4': ['4x4', '4wd', 'awd', 'quattro', '4motion', 'xdrive'],
        'ACC/Tempomat': ['acc', 'adaptívny tempomat', 'adaptivny tempomat', 'distronic'],
    };

    let equipScore = 0;
    const foundFeatures = [];
    for (const [feature, keywords] of Object.entries(EQUIPMENT_KEYWORDS)) {
        if (keywords.some(k => text.includes(k))) {
            equipScore++;
            foundFeatures.push(feature);
        }
    }

    let equipLevel = 'Basic';
    if (equipScore >= 5) equipLevel = 'Full';
    else if (equipScore >= 2) equipLevel = 'Medium';

    console.log(`\n🛠️  Equipment Analysis:`);
    console.log(`  Found Features: ${foundFeatures.join(', ')}`);
    console.log(`  Level: ${equipLevel}`);

    // Apply Modifier
    console.log(`\nStart Price: ${correctedMedian} €`);
    if (equipLevel === 'Full') {
        process.stdout.write(`  Applying FULL Equip Bonus (+12%): `);
        correctedMedian *= 1.12;
        console.log(`-> ${Math.round(correctedMedian)} €`);
    } else if (equipLevel === 'Medium') {
        process.stdout.write(`  Applying MEDIUM Equip Bonus (+5%): `);
        correctedMedian *= 1.05;
        console.log(`-> ${Math.round(correctedMedian)} €`);
    } else {
        console.log(`  No Equip Bonus (Basic)`);
    }

    // Year Sanity Check
    const nextYearData = marketValues.broad?.[make]?.[model]?.[listing.year + 1]?.[kmSegmentKey];
    if (nextYearData && correctedMedian > nextYearData.medianPrice * 1.1) {
        console.log(`⚠️ Sanity Check Triggered: Price > Next Year's model (+10%). Capping.`);
        correctedMedian = nextYearData.medianPrice * 1.05;
        console.log(`-> Capped at: ${Math.round(correctedMedian)} €`);
    }

    console.log(`\n🏁 FINAL MARKET PRICE: ${Math.round(correctedMedian)} €`);
    console.log(`   Vs Listing Price: ${listing.price} €`);

    const discount = ((correctedMedian - listing.price) / correctedMedian) * 100;
    console.log(`   Difference: ${Math.round(discount)}% ${discount > 0 ? '(Undervalued/Deal)' : '(Overpriced)'}`);
}

// Mock extract function if needed, or rely on requiring scoring_agent if it exports it.
// scoring_agent exports used functions.

debugListingCalc();
