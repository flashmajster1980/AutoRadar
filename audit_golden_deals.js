const { dbAsync } = require('./database');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------
// COPIED LOGIC FROM UPDATED SCORING_AGENT.JS
// ---------------------------------------------------------
function extractMakeModel(title) {
    const BRAND_ALIASES = {
        'vw': 'Volkswagen', 'škoda': 'Škoda', 'skoda': 'Škoda',
        'mercedes-benz': 'Mercedes-Benz', 'mercedes': 'Mercedes-Benz',
        'bmw': 'BMW', 'audi': 'Audi', 'seat': 'Seat', 'tesla': 'Tesla',
        'hyundai': 'Hyundai', 'ford': 'Ford', 'opel': 'Opel',
        'peugeot': 'Peugeot', 'renault': 'Renault', 'toyota': 'Toyota',
    };

    const titleLower = title.toLowerCase();
    let make = null;
    let model = null;

    for (const [alias, fullName] of Object.entries(BRAND_ALIASES)) {
        if (titleLower.startsWith(alias + ' ') || titleLower.includes(' ' + alias + ' ')) {
            make = fullName;
            break;
        }
    }

    if (!make) {
        const firstWord = title.split(' ')[0];
        if (firstWord && firstWord.length > 2) {
            make = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
            const normalized = BRAND_ALIASES[firstWord.toLowerCase()];
            if (normalized) make = normalized;
        }
    }

    if (make) {
        const words = title.split(' ');

        // --- BMW SPECIAL HANDLING ---
        if (make === 'BMW') {
            const lowerTitle = title.toLowerCase();
            const seriesMatch = lowerTitle.match(/\b(rad|series)\s?(\d)\b/);
            const tourerMatch = lowerTitle.match(/\b(gran|active)\s?tourer\b/);

            if (seriesMatch) {
                model = `Rad ${seriesMatch[2]}`;
                if (tourerMatch) model += ' ' + (tourerMatch[1] === 'gran' ? 'Gran' : 'Active') + ' Tourer';
            }
            else if (tourerMatch) {
                model = `Rad 2 ${tourerMatch[1] === 'gran' ? 'Gran' : 'Active'} Tourer`;
            }
            else if (lowerTitle.match(/\bx[1-7]\b/)) {
                const xMatch = lowerTitle.match(/\b(x[1-7])\b/);
                model = xMatch[1].toUpperCase();
            }
            else if (lowerTitle.match(/\bi[384x]\b/)) {
                const iMatch = lowerTitle.match(/\b(i[384x])\b/);
                model = iMatch[1].toLowerCase();
            }
            else if (words.length >= 2 && words[1].length > 1) {
                model = words[1];
            }
        }
        // --- STANDARD LOGIC ---
        else {
            if (words.length >= 2) {
                if (words[1] && words[2]) {
                    const twoWords = words[1] + ' ' + words[2];
                    if (twoWords.match(/model [a-z0-9]/i) || twoWords.match(/[a-z] trieda/i)) {
                        model = twoWords;
                    }
                }
                if (!model && words[1] && words[1].length > 1) {
                    model = words[1];
                }
            }
        }
    }

    return { make, model };
}

// ---------------------------------------------------------
// AUDIT LOGIC
// ---------------------------------------------------------
async function auditGoldenDeals() {
    console.log('🕵️  Auditing Current Golden Deals...\n');

    // Fetch listings that look like deals (Score > 80 OR Discount > 15)
    // We re-calculate everything, so we fetch mainly by deal_score or just recent ones.
    // Let's fetch all "High Score" ones.
    const listings = await dbAsync.all('SELECT * FROM listings WHERE deal_score >= 80 ORDER BY discount DESC LIMIT 50');

    console.log(`Analyzing ${listings.length} high-scoring listings...\n`);

    const marketValuesFile = path.join(__dirname, 'market_values.json');
    const marketValues = JSON.parse(fs.readFileSync(marketValuesFile, 'utf-8'));

    let suspiciousCount = 0;
    let validCount = 0;

    for (const l of listings) {
        const { make, model } = extractMakeModel(l.title);

        let kmSegmentKey = 'mid';
        if (l.km < 100000) kmSegmentKey = 'low';
        else if (l.km < 200000) kmSegmentKey = 'mid';
        else if (l.km < 250000) kmSegmentKey = 'high1';
        else if (l.km < 300000) kmSegmentKey = 'high2';
        else if (l.km < 400000) kmSegmentKey = 'level300';
        else if (l.km < 500000) kmSegmentKey = 'level400';
        else kmSegmentKey = 'zombie';

        // Valuation
        let medianPrice = null;
        let method = 'None';
        let note = '';

        const broadMatch = marketValues.broad?.[make]?.[model]?.[l.year]?.[kmSegmentKey];
        if (broadMatch) {
            medianPrice = broadMatch.medianPrice;
            method = 'Exact Tier';
        } else {
            // Fallback Check
            if (['level300', 'level400', 'zombie'].includes(kmSegmentKey)) {
                method = 'Skipped (High KM)'; // Correct behavior now
            } else {
                const anyYearData = marketValues.broad?.[make]?.[model]?.[l.year];
                if (anyYearData) {
                    medianPrice = Object.values(anyYearData)[0].medianPrice;
                    method = 'Fallback Tier';
                    note = '⚠️ Using different km tier';
                }
            }
        }

        if (!medianPrice) {
            console.log(`[SKIPPED/INVALID] ${l.id} | ${l.title} | ${l.year} | ${l.km}km | ${method}`);
            continue;
        }

        const discount = ((medianPrice - l.price) / medianPrice) * 100;

        // Log interesting ones
        if (discount > 10) {
            const isSuspicious = (method === 'Fallback Tier' && discount > 30) || (make === 'BMW' && model === 'Rad');

            const logColor = isSuspicious ? '\x1b[31m' : '\x1b[32m'; // Red vs Green
            const reset = '\x1b[0m';

            console.log(`${logColor}[${Math.round(discount)}% OFF] ${l.title}${reset}`);
            console.log(`   Price: ${l.price} vs Market: ${medianPrice} (${method})`);
            console.log(`   Model: ${make} ${model} | Segment: ${kmSegmentKey}`);
            if (note) console.log(`   Note: ${note}`);
            console.log('------------------------------------------------');

            if (isSuspicious) suspiciousCount++;
            else validCount++;
        }
    }

    console.log(`\nAudit Complete.`);
    console.log(`✅ Valid Deals: ${validCount}`);
    console.log(`⚠️ Suspicious/Retained Fallback: ${suspiciousCount}`);
}

auditGoldenDeals();
