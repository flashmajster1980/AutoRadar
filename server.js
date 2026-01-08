require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { dbAsync } = require('./database');
const path = require('path');
const session = require('express-session');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // User must provide this in .env

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Session Configuration
app.use(session({
    secret: 'autoradar_secret_key_12345', // In production, use a secure env var
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// ========================================
// AUTHENTICATION ROUTES
// ========================================

// Mock Registration for demo (or real simple one)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        await dbAsync.run(
            'INSERT INTO users (username, password, subscription_status) VALUES (?, ?, ?)',
            [username, password, 'basic']
        );
        res.json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(400).json({ error: 'Username already exists' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await dbAsync.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (user) {
            req.session.user = { id: user.id, username: user.username, subscription: user.subscription_status };
            res.json({ message: 'Login successful', user: req.session.user });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// ========================================
// STRIPE PAYMENT ROUTES
// ========================================

app.post('/api/create-checkout-session', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Please login first' });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'AutoRadar Premium',
                        description: 'Unlock Golden Deals & Instant Alerts',
                    },
                    unit_amount: 1499, // 14.99 EUR
                },
                quantity: 1,
            }],
            mode: 'payment', // Or 'subscription' if you have a recurring price ID
            success_url: `${req.protocol}://${req.get('host')}/?success=true`,
            cancel_url: `${req.protocol}://${req.get('host')}/?canceled=true`,
            metadata: {
                userId: req.session.user.id
            }
        });

        // For demo simplicity: Upgrade user immediately upon link generation (in production, use Webhooks!)
        // In a real app, you MUST wait for the webhook.
        if (process.env.DEMO_MODE === 'true') {
            await dbAsync.run('UPDATE users SET subscription_status = ? WHERE id = ?', ['premium', req.session.user.id]);
            req.session.user.subscription = 'premium';
        }

        res.json({ url: session.url });
    } catch (err) {
        console.error('Stripe Error:', err.message);

        // Fallback for user without Stripe key
        if (err.message.includes('api_key')) {
            // Simulujeme úspešný upgrade pre testovanie
            await dbAsync.run('UPDATE users SET subscription_status = ? WHERE id = ?', ['premium', req.session.user.id]);
            req.session.user.subscription = 'premium';
            return res.json({ url: '/?success=true&demo=true' });
        }

        res.status(500).json({ error: err.message });
    }
});

// ========================================
// LISTINGS API (WITH PAYWALL)
// ========================================

app.get('/api/listings', async (req, res) => {
    try {
        const {
            page = 1, limit = 24, search, make, fuel, trans, drive,
            minYear, maxYear, minPrice, maxPrice, onlyGolden, sort = 'best'
        } = req.query;

        // AUTH CHECK
        const user = req.session.user;
        const isPremium = user && user.subscription === 'premium';

        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM listings WHERE is_sold = 0';
        const params = [];

        if (search) { query += ' AND (title LIKE ? OR location LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        if (make && make !== 'all') { query += ' AND make = ?'; params.push(make); }
        if (fuel && fuel !== 'all') { query += ' AND fuel LIKE ?'; params.push(`%${fuel}%`); }
        if (trans && trans !== 'all') { query += ' AND transmission LIKE ?'; params.push(`%${trans === 'Automat' ? 'Auto' : 'Man'}%`); }
        if (drive && drive !== 'all') { query += ' AND (drive LIKE ? OR features LIKE ?)'; params.push(`%${drive}%`, `%${drive}%`); }
        if (minYear) { query += ' AND year >= ?'; params.push(parseInt(minYear)); }
        if (maxYear) { query += ' AND year <= ?'; params.push(parseInt(maxYear)); }
        if (minPrice) { query += ' AND price >= ?'; params.push(parseInt(minPrice)); }
        if (maxPrice) { query += ' AND price <= ?'; params.push(parseInt(maxPrice)); }
        if (onlyGolden === 'true') { query += " AND deal_type = 'GOLDEN DEAL'"; }

        let orderBy = 'ORDER BY scraped_at DESC';
        if (sort === 'price-asc') orderBy = 'ORDER BY price ASC';
        else if (sort === 'year-desc') orderBy = 'ORDER BY year DESC';
        else if (sort === 'km-asc') orderBy = 'ORDER BY km ASC';
        else if (sort === 'discount') orderBy = 'ORDER BY discount DESC';

        const data = await dbAsync.all(`${query} ${orderBy} LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
        const total = await dbAsync.get(`SELECT COUNT(*) as count FROM (${query})`, params);

        // PAYWALL LOGIC: Mask data for non-premium users
        const processedData = data.map(listing => {
            const isGolden = listing.deal_type === 'GOLDEN DEAL';
            const isHotLiquidity = listing.liquidity_score >= 80;

            const isLocked = (isGolden || isHotLiquidity) && !isPremium;

            if (isLocked) {
                return {
                    ...listing,
                    url: null, // REMOVE URL
                    seller_name: 'Premium Member Only', // MASK SELLER
                    phone: null, // MASK PHONE
                    dealReason: '🔒 Tento deal vidia iba Premium členovia',
                    description: listing.description ? listing.description.substring(0, 50) + '...' : '',
                    location: 'Slovensko (Premium)',
                    isLocked: true // Frontend Flag
                };
            }
            return { ...listing, isLocked: false };
        });

        res.json({
            listings: processedData,
            total: total.count,
            page: parseInt(page),
            pages: Math.ceil(total.count / limit),
            user: user // Send user info to frontend for UI state
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/listings/:id/history', async (req, res) => {
    try {
        const history = await dbAsync.all(
            'SELECT price, checked_at as date FROM price_history WHERE listing_id = ? ORDER BY checked_at ASC',
            [req.params.id]
        );
        res.json(history || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 AutoRadar Server running at http://localhost:${PORT}`);
});
