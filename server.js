const express = require('express');
const cors = require('cors');
const { dbAsync } = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(__dirname));

// API Endpoint for price history for a specific listing
app.get('/api/listings/:id/history', async (req, res) => {
    try {
        const history = await dbAsync.all(
            'SELECT price, checked_at as date FROM price_history WHERE listing_id = ? ORDER BY checked_at ASC',
            [req.params.id]
        );

        if (!history || history.length === 0) {
            return res.status(404).json({ message: 'History not found' });
        }

        res.json(history);
    } catch (err) {
        console.error('❌ API Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// NEW: API Endpoint for paginated and filtered listings
app.get('/api/listings', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 24,
            search,
            make,
            fuel,
            trans,
            drive,
            minYear,
            maxYear,
            minPrice,
            maxPrice,
            onlyGolden,
            sort = 'best'
        } = req.query;

        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM listings WHERE is_sold = 0';
        const params = [];

        if (search) {
            query += ' AND (title LIKE ? OR location LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (make && make !== 'all') {
            query += ' AND make = ?';
            params.push(make);
        }
        if (fuel && fuel !== 'all') {
            query += ' AND fuel LIKE ?';
            params.push(`%${fuel}%`);
        }
        if (trans && trans !== 'all') {
            query += ' AND transmission LIKE ?';
            params.push(`%${trans === 'Automat' ? 'Auto' : 'Man'}%`);
        }
        if (drive && drive !== 'all') {
            query += ' AND (drive LIKE ? OR features LIKE ?)';
            params.push(`%${drive}%`, `%${drive}%`);
        }
        if (minYear) {
            query += ' AND year >= ?';
            params.push(parseInt(minYear));
        }
        if (maxYear) {
            query += ' AND year <= ?';
            params.push(parseInt(maxYear));
        }
        if (minPrice) {
            query += ' AND price >= ?';
            params.push(parseInt(minPrice));
        }
        if (maxPrice) {
            query += ' AND price <= ?';
            params.push(parseInt(maxPrice));
        }
        if (onlyGolden === 'true') {
            query += " AND deal_type = 'GOLDEN DEAL'";
        }

        // Sorting logic
        let orderBy = 'ORDER BY scraped_at DESC';
        if (sort === 'price-asc') orderBy = 'ORDER BY price ASC';
        else if (sort === 'year-desc') orderBy = 'ORDER BY year DESC';
        else if (sort === 'km-asc') orderBy = 'ORDER BY km ASC';
        else if (sort === 'discount') orderBy = 'ORDER BY discount DESC';

        const data = await dbAsync.all(`${query} ${orderBy} LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
        const total = await dbAsync.get(`SELECT COUNT(*) as count FROM (${query})`, params);

        res.json({
            listings: data,
            total: total.count,
            page: parseInt(page),
            pages: Math.ceil(total.count / limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve the dashboard at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 AutoRadar Server running at http://localhost:${PORT}`);
    console.log(`📊 Price History API: http://localhost:${PORT}/api/listings/:id/history`);
});
