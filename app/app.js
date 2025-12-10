/* app/app.js */
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'user5806',
    password: process.env.DB_PASSWORD || 'password5806',
    database: process.env.DB_NAME || 'life_expectancy',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- MAIN ROUTE ---
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'Life Expectancy Dashboard',
        studentId: 'm11405806'
    });
});

// --- FEATURE 1 ROUTES ---

// 1. Get the Form View
app.get('/features/1', async (req, res) => {
    try {
        const [countries] = await pool.query("SELECT id, name FROM Countries ORDER BY name ASC");
        res.render('partials/feature1_form', { layout: false, countries: countries });
    } catch (err) { res.send('Error loading feature'); }
});

// 2. Get the Result Data
app.get('/api/feature1/result', async (req, res) => {
    const countryId = req.query.country_id;
    if (!countryId) return res.send('');
    try {
        const query = `
            SELECT o.year, o.value 
            FROM Observations o
            WHERE o.country_id = ?
            ORDER BY o.year DESC
        `;
        const [rows] = await pool.query(query, [countryId]);
        res.render('partials/feature1_result', { layout: false, observations: rows });
    } catch (err) { res.send('Error fetching data'); }
});

// --- FEATURE 2 ROUTES ---

// 1. Get the Form View (Load Dropdowns)
app.get('/features/2', async (req, res) => {
    try {
        // Fetch SubRegions and Years in parallel
        const [subRegions] = await pool.query("SELECT id, name FROM SubRegions ORDER BY name ASC");
        const [years] = await pool.query("SELECT year FROM Years ORDER BY year DESC");
        
        res.render('partials/feature2_form', { 
            layout: false, 
            subRegions: subRegions, 
            years: years 
        });
    } catch (err) {
        console.error(err);
        res.send('Error loading feature options');
    }
});

// 2. Get the Result Data
app.get('/api/feature2/result', async (req, res) => {
    const { sub_region_id, year } = req.query;

    if (!sub_region_id || !year) {
        return res.send('<div class="alert alert-warning">Please select both a Sub-Region and a Year.</div>');
    }

    try {
        const query = `
            SELECT c.name as country_name, o.value as life_expectancy
            FROM Countries c
            JOIN Observations o ON c.id = o.country_id
            WHERE c.sub_region_id = ? AND o.year = ?
            ORDER BY o.value ASC
        `;
        const [rows] = await pool.query(query, [sub_region_id, year]);
        const rankedRows = rows.map((row, index) => ({
            rank: index + 1, // 1, 2, 3...
            country_name: row.country_name,
            life_expectancy: row.life_expectancy
        }));

        res.render('partials/feature2_result', { 
            layout: false, 
            data: rankedRows, // Send the modified array
            selectedYear: year
        });
    } catch (err) {
        console.error(err);
        res.send('Error processing request');
    }
});

// --- FEATURE 3 ROUTES ---

// 1. Get the Form View
app.get('/features/3', async (req, res) => {
    try {
        // Fetch Regions and Years for dropdowns
        const [regions] = await pool.query("SELECT id, name FROM Regions ORDER BY name ASC");
        const [years] = await pool.query("SELECT year FROM Years ORDER BY year DESC");
        
        res.render('partials/feature3_form', { 
            layout: false, 
            regions: regions, 
            years: years 
        });
    } catch (err) {
        console.error(err);
        res.send('Error loading feature options');
    }
});

// 2. Get the Result Data (Average Calculation)
app.get('/api/feature3/result', async (req, res) => {
    const { region_id, year } = req.query;

    if (!region_id || !year) {
        return res.send('<div class="alert alert-warning">Please select both a Region and a Year.</div>');
    }

    try {
        // Query: Join Region -> SubRegion -> Country -> Observation
        // Calculate Average Value grouped by SubRegion
        const query = `
            SELECT sr.name AS sub_region_name, AVG(o.value) AS average_le
            FROM Regions r
            JOIN SubRegions sr ON r.id = sr.region_id
            JOIN Countries c ON sr.id = c.sub_region_id
            JOIN Observations o ON c.id = o.country_id
            WHERE r.id = ? AND o.year = ?
            GROUP BY sr.id, sr.name
            ORDER BY r.name ASC, average_le ASC
        `;
        
        const [rows] = await pool.query(query, [region_id, year]);

        // Format average to 2 decimal places
        const formattedRows = rows.map(row => ({
            sub_region_name: row.sub_region_name,
            average_le: parseFloat(row.average_le).toFixed(2)
        }));

        res.render('partials/feature3_result', { 
            layout: false, 
            data: formattedRows,
            selectedYear: year
        });
    } catch (err) {
        console.error(err);
        res.send('Error calculating statistics');
    }
});

// --- FEATURE 4 ROUTES ---

// 1. Get the Form View
app.get('/features/4', (req, res) => {
    res.render('partials/feature4_form', { layout: false });
});

// 2. Get the Search Results
app.get('/api/feature4/result', async (req, res) => {
    const keyword = req.query.keyword || ''; // Handle empty search

    if (!keyword) {
        return res.send('<p class="text-muted">Type above to begin searching...</p>');
    }
    
    try {
        // Query Logic:
        // 1. Filter Countries by name (LIKE %keyword%)
        // 2. Join Observations
        // 3. Filter Observation to be ONLY the latest year for that specific country
        const query = `
            SELECT c.name AS country_name, o.year, o.value
            FROM Countries c
            JOIN Observations o ON c.id = o.country_id
            WHERE c.name LIKE ? 
            AND o.year = (
                SELECT MAX(year) 
                FROM Observations 
                WHERE country_id = c.id
            )
            ORDER BY c.name ASC
        `;

        // Add wildcards for partial match
        const searchTerm = `%${keyword}%`;
        const [rows] = await pool.query(query, [searchTerm]);

        res.render('partials/feature4_result', { 
            layout: false, 
            data: rows,
            keyword: keyword
        });
    } catch (err) {
        console.error(err);
        res.send('Error searching countries');
    }
});

// START SERVER
app.listen(port, () => {
    console.log(`Server running on port 5806`);
});