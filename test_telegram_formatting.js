require('dotenv').config();
const axios = require('axios');

const CONFIG = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
};

function formatMessage(deal) {
    const date = new Date().toLocaleDateString('sk-SK');
    const kmText = deal.km ? `${deal.km.toLocaleString()} km` : 'Neznáme km';
    const location = deal.location || 'Slovensko';

    const titleHeader = `${deal.make || ''} ${deal.model || ''}`.trim() || deal.title;
    const discountText = Math.round(deal.discount);
    const liquidityLabel = deal.liquidity ? deal.liquidity.label : 'Neznáma';
    const isAwd = (deal.drive || '').toLowerCase().includes('4x4') || (deal.features && deal.features.includes('4x4'));

    let message = `🌟 *GOLDEN DEAL!* -${discountText}%\n\n`;
    message += `🚗 *${titleHeader}*\n`;
    message += `📅 Ročník: ${deal.year || '?'}\n`;
    message += `🛣️ Nájazd: ${kmText}\n`;
    message += `📍 Lokalita: ${location}\n\n`;

    message += `💰 Cena: *${Math.round(deal.price).toLocaleString()} €*\n`;
    message += `📈 Trhová hodnota: ${Math.round(deal.correctedMedian).toLocaleString()} €\n\n`;

    message += `⛽ Palivo: ${deal.fuel || '?'}\n`;
    message += `⚙️ Prevodovka: ${deal.transmission || '?'}\n`;

    if (isAwd) {
        message += `☸️ Pohon: 4x4\n`;
    }

    if (deal.equipLevel && deal.equipLevel !== 'Basic') {
        const features = (deal.features || []).join(', ');
        message += `✨ Výbava: ${deal.equipLevel}${features ? ` (${features})` : ''}\n`;
    }

    message += `\n🌐 Portál: ${deal.portal}\n`;

    if (deal.liquidity && deal.liquidity.score) {
        message += `🔥 Likvidita: ${liquidityLabel} (${deal.liquidity.score}%)\n`;
        message += `⏱️ Odhad predaja: ${deal.liquidity.estimate}\n`;
    }

    if (deal.negotiationScore) {
        message += `🤝 Potenciál zjednávania: ${deal.negotiationScore}%\n`;
    }

    message += `\n🔗 [OTVORIŤ INZERÁT](${deal.url})\n`;
    message += `\n⏰ Nájdené: ${date}`;

    return message;
}

async function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
        });
        return true;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

const testDeals = [
    {
        make: 'Škoda', model: 'Octavia 4x4', year: 2020, km: 125000,
        price: 18500, correctedMedian: 22000, discount: 16,
        fuel: 'Diesel', transmission: 'Automat', drive: '4x4',
        location: 'Bratislava', portal: 'Bazos.sk',
        equipLevel: 'Full', features: ['LED Matrix', 'ACC', 'Webasto', 'Koža'],
        liquidity: { label: '🔥 Horúci tovar', score: 95, color: '#f59e0b', estimate: 'do 3 dní' },
        negotiationScore: 85, url: 'https://auto.bazos.sk/inzerat/15892341/skoda-octavia-4x4-2020.php'
    },
    {
        make: 'Tesla', model: 'Model 3 Long Range', year: 2021, km: 45000,
        price: 31500, correctedMedian: 38000, discount: 17,
        fuel: 'Elektro', transmission: 'Automat', drive: 'AWD',
        location: 'Košice', portal: 'Autobazar.eu',
        equipLevel: 'Full', features: ['Autopilot', 'Panoráma', 'Prémiové audio'],
        liquidity: { label: '✅ Štandard', score: 75, color: '#10b981', estimate: 'do 2 týždňov' },
        negotiationScore: 40, url: 'https://www.autobazar.eu/sk/card.php?id=3245678'
    },
    {
        make: 'BMW', model: 'X5 xDrive30d', year: 2018, km: 185000,
        price: 34900, correctedMedian: 41500, discount: 16,
        fuel: 'Diesel', transmission: 'Automat', drive: '4x4',
        location: 'Žilina', portal: 'Autobazar.sk',
        equipLevel: 'Medium', features: ['M-Packet', 'Harma/Kardon', '360 Kamera'],
        liquidity: { label: '🔥 Horúci tovar', score: 88, color: '#f59e0b', estimate: 'do 5 dní' },
        negotiationScore: 92, url: 'https://www.autobazar.sk/detail/654321/bmw-x5-xdrive-30d-m-packet/'
    }
];

async function runTests() {
    console.log('🚀 Sending 3 test messages...');
    for (const deal of testDeals) {
        const msg = formatMessage(deal);
        await sendTelegramMessage(msg);
        console.log(`✅ Sent: ${deal.make} ${deal.model}`);
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('✨ All tests sent!');
}

runTests();
