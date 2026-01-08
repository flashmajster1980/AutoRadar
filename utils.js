const BRAND_ALIASES = {
    'vw': 'Volkswagen', 'škoda': 'Škoda', 'skoda': 'Škoda',
    'mercedes-benz': 'Mercedes-Benz', 'mercedes': 'Mercedes-Benz',
    'bmw': 'BMW', 'audi': 'Audi', 'seat': 'Seat', 'tesla': 'Tesla',
    'hyundai': 'Hyundai', 'ford': 'Ford', 'opel': 'Opel',
    'peugeot': 'Peugeot', 'renault': 'Renault', 'toyota': 'Toyota',
    'honda': 'Honda', 'mazda': 'Mazda', 'nissan': 'Nissan',
    'kia': 'Kia', 'volvo': 'Volvo', 'fiat': 'Fiat',
};

const KNOWN_MODELS = {
    'Volkswagen': ['Golf', 'Passat', 'Tiguan', 'Polo', 'T-Roc', 'T-Cross', 'Touareg', 'Arteon', 'Caddy', 'Transporter', 'ID.3', 'ID.4', 'ID.5'],
    'Škoda': ['Octavia', 'Fabia', 'Superb', 'Kodiaq', 'Karoq', 'Kamiq', 'Scala', 'Rapid', 'Enyaq'],
    'BMW': ['Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4', 'i3', 'i4', 'iX'],
    'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q4', 'Q5', 'Q7', 'Q8', 'TT', 'e-tron'],
    'Tesla': ['Model S', 'Model 3', 'Model X', 'Model Y'],
};

function extractMakeModel(title) {
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

    if (make && KNOWN_MODELS[make]) {
        for (const knownModel of KNOWN_MODELS[make]) {
            const regex = new RegExp(`\\b${knownModel.toLowerCase()}\\b`, 'i');
            if (titleLower.match(regex)) {
                model = knownModel;
                break;
            }
        }
    }

    if (!model) {
        const words = title.split(' ');
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

    return { make, model };
}

module.exports = {
    extractMakeModel
};
