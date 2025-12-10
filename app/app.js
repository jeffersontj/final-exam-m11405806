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

// START SERVER
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});