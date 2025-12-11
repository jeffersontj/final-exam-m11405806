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

// --- ROOT ROUTE (Main Dashboard) ---
app.get('/', async (req, res) => {
    try {
        // 1. Get Global Stats
        const [countCountries] = await pool.query("SELECT COUNT(*) as c FROM Countries");
        const [countObs] = await pool.query("SELECT COUNT(*) as c FROM Observations");
        const [globalAvg] = await pool.query("SELECT AVG(value) as a FROM Observations");
        
        // 2. Get Country List for the Dropdown
        const [countries] = await pool.query("SELECT id, name FROM Countries ORDER BY name ASC");

        res.render('index', { 
            title: 'Life Expectancy Dashboard',
            studentId: 'm11405806',
            // Pass statistics directly to index.hjs
            stat_countries: countCountries[0].c,
            stat_records: countObs[0].c,
            stat_avg: parseFloat(globalAvg[0].a).toFixed(2),
            countries: countries,
            // Flag to identify we are on home
            isHome: true 
        });
    } catch (err) {
        console.error(err);
        res.send("Database Connection Error");
    }
});

// --- KEEP THIS: Route for Sidebar "Home" Button (HTMX Partial) ---
// If user goes to Feature 1 and wants to come back to Home without refreshing page
app.get('/features/welcome', async (req, res) => {
    // Exact same logic as above, but renders only the partial
    const [countCountries] = await pool.query("SELECT COUNT(*) as c FROM Countries");
    const [countObs] = await pool.query("SELECT COUNT(*) as c FROM Observations");
    const [globalAvg] = await pool.query("SELECT AVG(value) as a FROM Observations");
    const [countries] = await pool.query("SELECT id, name FROM Countries ORDER BY name ASC");

    res.render('partials/dashboard_home', { 
        layout: false,
        stat_countries: countCountries[0].c,
        stat_records: countObs[0].c,
        stat_avg: parseFloat(globalAvg[0].a).toFixed(2),
        countries: countries
    });
});

// --- KEEP THIS: Chart Data API ---
app.get('/api/dashboard/chart', async (req, res) => {
    const { country_id } = req.query;
    if (!country_id) return res.send('<div class="alert alert-info">Select a country to view the trendline.</div>');

    try {
        const query = `SELECT year, value FROM Observations WHERE country_id = ? ORDER BY year ASC`;
        const [rows] = await pool.query(query, [country_id]);
        const [countryInfo] = await pool.query("SELECT name FROM Countries WHERE id = ?", [country_id]);

        if (rows.length === 0) return res.send('<div class="alert alert-warning">No data available.</div>');

        const labels = rows.map(r => r.year);
        const data = rows.map(r => r.value);

        res.render('partials/dashboard_chart', { 
            layout: false, 
            country_name: countryInfo[0].name,
            labels: JSON.stringify(labels),
            data: JSON.stringify(data)
        });
    } catch (err) { res.send("Error loading chart"); }
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

// --- FEATURE 5 ROUTES ---

// 1. Get the Main Form
app.get('/features/5', async (req, res) => {
    try {
        const [countries] = await pool.query("SELECT id, name FROM Countries ORDER BY name ASC");
        res.render('partials/feature5_form', { layout: false, countries: countries });
    } catch (err) { res.send('Error loading form'); }
});

// 2. Prepare Input (Calculate Next Year)
app.get('/api/feature5/prepare', async (req, res) => {
    const countryId = req.query.country_id;
    if (!countryId) return res.send('');

    try {
        // Find the latest year for this country
        const query = `SELECT MAX(year) as max_year FROM Observations WHERE country_id = ?`;
        const [rows] = await pool.query(query, [countryId]);
        
        let prevYear = rows[0].max_year;
        let nextYear;
        let message = '';

        if (prevYear) {
            // Data exists
            nextYear = prevYear + 1;
            message = `Latest data found: <strong>${prevYear}</strong>.`;
        } else {
            // No data exists -> Set default to Current Year (2025)
            prevYear = "Not Found";
            nextYear = 2025; 
            message = `No previous data found - Next data input as current year (2025)`;
        }

        res.render('partials/feature5_input', { 
            layout: false, 
            country_id: countryId,
            next_year: nextYear,
            message: message 
        });
    } catch (err) {
        console.error(err);
        res.send('<div class="alert alert-danger">Error retrieving year data.</div>');
    }
});

// 3. Add the Record (POST)
app.post('/api/feature5/add', async (req, res) => {
    const { country_id, year, value } = req.body;
    if (!value || isNaN(value)) return res.send('<div class="alert alert-danger">Invalid value.</div>');

    try {
        await pool.query("INSERT IGNORE INTO Years (year) VALUES (?)", [year]);
        
        const insertQuery = `INSERT INTO Observations (country_id, year, indicator_id, value) VALUES (?, ?, 1, ?)`;
        await pool.query(insertQuery, [country_id, year, value]);

        // [AUDIT LOGGING]
        await pool.query(
            `INSERT INTO AuditLogs (country_id, action_type, new_value, details) VALUES (?, 'INSERT', ?, ?)`,
            [country_id, value, `Added record for Year ${year}`]
        );

        res.render('partials/feature5_result', { layout: false, year, value });
    } catch (err) {
        console.error(err);
        res.send('<div class="alert alert-danger">Error saving record.</div>');
    }
});

// --- FEATURE 6 ROUTES ---

// 1. Initial View (Country List)
app.get('/features/6', async (req, res) => {
    try {
        const [countries] = await pool.query("SELECT id, name FROM Countries ORDER BY name ASC");
        res.render('partials/feature6_form', { layout: false, countries });
    } catch (err) { res.send('Error loading feature'); }
});

// 2. Load Years for Selected Country
app.get('/api/feature6/years', async (req, res) => {
    const countryId = req.query.country_id;
    if (!countryId) return res.send(''); // Clear if no country selected

    try {
        // Only fetch years that actually have data (Observations)
        const query = `SELECT year FROM Observations WHERE country_id = ? ORDER BY year DESC`;
        const [years] = await pool.query(query, [countryId]);
        
        res.render('partials/feature6_years', { 
            layout: false, 
            years: years, 
            country_id: countryId 
        });
    } catch (err) { res.send('Error loading years'); }
});

// 3. Load Current Value for Editing
app.get('/api/feature6/value', async (req, res) => {
    const { country_id, year } = req.query;
    if (!year) return res.send('');

    try {
        const query = `SELECT value FROM Observations WHERE country_id = ? AND year = ?`;
        const [rows] = await pool.query(query, [country_id, year]);

        if (rows.length > 0) {
            res.render('partials/feature6_input', { 
                layout: false, 
                country_id: country_id, 
                year: year, 
                current_value: rows[0].value 
            });
        } else {
            res.send('<div class="alert alert-warning">No record found.</div>');
        }
    } catch (err) { res.send('Error loading value'); }
});

// 4. Process Update
app.post('/api/feature6/update', async (req, res) => {
    const { country_id, year, value } = req.body;

    try {
        // 1. Fetch OLD value for the log
        const [rows] = await pool.query("SELECT value FROM Observations WHERE country_id = ? AND year = ?", [country_id, year]);
        const oldValue = rows.length > 0 ? rows[0].value : null;

        // 2. Perform Update
        const query = `UPDATE Observations SET value = ? WHERE country_id = ? AND year = ?`;
        await pool.query(query, [value, country_id, year]);

        // 3. [AUDIT LOGGING]
        await pool.query(
            `INSERT INTO AuditLogs (country_id, action_type, old_value, new_value, details) VALUES (?, 'UPDATE', ?, ?, ?)`,
            [country_id, oldValue, value, `Updated Year ${year}`]
        );

        res.render('partials/feature6_result', { layout: false, year, value });
    } catch (err) {
        console.error(err);
        res.send('<div class="alert alert-danger">Update failed.</div>');
    }
});

// --- FEATURE 7 ROUTES ---

// 1. Initial View (Country List)
app.get('/features/7', async (req, res) => {
    try {
        const [countries] = await pool.query("SELECT id, name FROM Countries ORDER BY name ASC");
        res.render('partials/feature7_form', { layout: false, countries });
    } catch (err) { res.send('Error loading feature'); }
});

// 2. Load Start Years (All available years for country)
app.get('/api/feature7/start_years', async (req, res) => {
    const countryId = req.query.country_id;
    if (!countryId) return res.send('');

    try {
        const query = `SELECT year FROM Observations WHERE country_id = ? ORDER BY year ASC`;
        const [years] = await pool.query(query, [countryId]);
        
        res.render('partials/feature7_start_years', { 
            layout: false, 
            years: years, 
            country_id: countryId 
        });
    } catch (err) { res.send('Error loading start years'); }
});

// 3. Load End Years (Must be >= Start Year)
app.get('/api/feature7/end_years', async (req, res) => {
    const { country_id, start_year } = req.query;
    if (!start_year) return res.send('');

    try {
        const query = `SELECT year FROM Observations WHERE country_id = ? AND year >= ? ORDER BY year ASC`;
        const [years] = await pool.query(query, [country_id, start_year]);

        res.render('partials/feature7_end_years', { 
            layout: false, 
            years: years 
        });
    } catch (err) { res.send('Error loading end years'); }
});

// 4. Process Delete
app.post('/api/feature7/delete', async (req, res) => {
    const { country_id, start_year, end_year } = req.body;

    try {
        const query = `DELETE FROM Observations WHERE country_id = ? AND year BETWEEN ? AND ?`;
        const [result] = await pool.query(query, [country_id, start_year, end_year]);

        // [AUDIT LOGGING]
        // For range deletes, we log the count and range details
        if (result.affectedRows > 0) {
            await pool.query(
                `INSERT INTO AuditLogs (country_id, action_type, details) VALUES (?, 'DELETE', ?)`,
                [country_id, `Deleted ${result.affectedRows} records from ${start_year} to ${end_year}`]
            );
        }

        res.render('partials/feature7_result', { 
            layout: false, 
            deleted_count: result.affectedRows, 
            start: start_year, 
            end: end_year 
        });
    } catch (err) {
        console.error(err);
        res.send('<div class="alert alert-danger">Delete failed.</div>');
    }
});

// --- FEATURE 8 ROUTES ---

// 1. Initial View: Load Country List
app.get('/features/8', async (req, res) => {
    try {
        const [countries] = await pool.query("SELECT id, name FROM Countries ORDER BY name ASC");
        res.render('partials/feature8_form', { layout: false, countries });
    } catch (err) { res.send('Error loading feature'); }
});

// 2. Process Country Profile
app.get('/api/feature8/result', async (req, res) => {
    const { country_id } = req.query;
    if (!country_id) return res.send('');

    try {
        // We use LEFT JOIN for ALL geography tables. 
        // This ensures Countries like Antarctica (which have no region) still appear.
        const detailsQuery = `
            SELECT 
                c.name, c.iso_alpha2, c.iso_alpha3, c.country_code,
                r.name AS region, 
                sr.name AS sub_region, 
                ir.name AS intermediate_region
            FROM Countries c
            LEFT JOIN SubRegions sr ON c.sub_region_id = sr.id
            LEFT JOIN Regions r ON sr.region_id = r.id
            LEFT JOIN IntermediateRegions ir ON c.intermediate_region_id = ir.id
            WHERE c.id = ?
        `;

        const statsQuery = `
            SELECT 
                MIN(year) AS start_year,
                MAX(year) AS end_year,
                MIN(value) AS min_val,
                MAX(value) AS max_val,
                AVG(value) AS avg_val,
                COUNT(*) AS total_records
            FROM Observations
            WHERE country_id = ?
        `;

        const latestQuery = `
            SELECT year, value 
            FROM Observations 
            WHERE country_id = ? 
            ORDER BY year DESC 
            LIMIT 1
        `;

        const [detailsRows] = await pool.query(detailsQuery, [country_id]);
        const [statsRows] = await pool.query(statsQuery, [country_id]);
        const [latestRows] = await pool.query(latestQuery, [country_id]);

        const country = detailsRows[0];
        const stats = statsRows[0];
        const latest = latestRows[0];

        // If geography info is missing, replace it with "-"
        country.region = country.region || '-';
        country.sub_region = country.sub_region || '-';
        country.intermediate_region = country.intermediate_region || '-';

        const hasData = stats.total_records > 0;

        res.render('partials/feature8_result', { 
            layout: false, 
            country: country,
            hasData: hasData, 
            stats: hasData ? {
                ...stats,
                avg_val: parseFloat(stats.avg_val || 0).toFixed(2),
                span: (stats.end_year - stats.start_year)
            } : null,
            latest: latest
        });

    } catch (err) {
        console.error(err);
        res.send('Error retrieving profile');
    }
});

// --- FEATURE 9 ROUTES (AI PREDICTOR) ---

// 1. Initial View
app.get('/features/9', async (req, res) => {
    try {
        const [countries] = await pool.query("SELECT id, name FROM Countries ORDER BY name ASC");
        res.render('partials/feature9_form', { layout: false, countries });
    } catch (err) { res.send('Error loading feature'); }
});

// 2. Process Prediction
app.get('/api/feature9/predict', async (req, res) => {
    const { country_id } = req.query;
    if (!country_id) return res.send('');

    try {
        // Fetch all historical data sorted by year
        const query = `
            SELECT year, value 
            FROM Observations 
            WHERE country_id = ? 
            ORDER BY year ASC
        `;
        const [rows] = await pool.query(query, [country_id]);

        // We are trying to predict 2026. If 2026, 2027, etc. already exists, stop.
        const targetYear = 2026;
        const hasFutureData = rows.some(row => row.year >= targetYear);

        if (hasFutureData) {
            return res.render('partials/feature9_result', { 
                layout: false, 
                error: `Data for year ${targetYear} (or later) already exists in the database. The event has already occurred, so prediction is not applicable.` 
            });
        }

        if (rows.length < 2) {
            return res.render('partials/feature9_result', { 
                layout: false, 
                error: "Not enough historical data to generate a prediction (Need at least 2 years of history)." 
            });
        }

        // --- LINEAR REGRESSION ALGORITHM ---
        let n = rows.length;
        let sumX = 0;   // Sum of Years
        let sumY = 0;   // Sum of Values
        let sumXY = 0;  // Sum of Year * Value
        let sumXX = 0;  // Sum of Year^2

        rows.forEach(row => {
            let x = row.year;
            let y = parseFloat(row.value);
            sumX += x;
            sumY += y;
            sumXY += (x * y);
            sumXX += (x * x);
        });

        // Calculate Slope (m) and Intercept (b)
        let slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        let intercept = (sumY - slope * sumX) / n;

        // Predict for Target Year (2026)
        let predictedValue = (slope * targetYear) + intercept;

        // Determine Trend
        let trend = slope > 0 ? "Improving 📈" : "Declining 📉";

        res.render('partials/feature9_result', {
            layout: false,
            country_name: "Selected Country",
            target_year: targetYear,
            prediction: predictedValue.toFixed(2),
            trend: trend,
            slope: slope.toFixed(4),
            last_recorded: rows[rows.length - 1].value,
            last_year: rows[rows.length - 1].year
        });

    } catch (err) {
        console.error(err);
        res.send('Error generating prediction');
    }
});

/// --- FEATURE 10 ROUTES (AUDIT LOGS) ---

// 1. Initial View
app.get('/features/10', (req, res) => {
    res.render('partials/feature10_form', { layout: false });
});

// 2. Fetch Logs (With Taiwan Time Conversion)
app.get('/api/feature10/result', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.id, 
                c.name as country_name, 
                a.action_type, 
                a.old_value, 
                a.new_value, 
                a.details,
                -- Convert UTC to Taiwan Time (+08:00) and format
                DATE_FORMAT(CONVERT_TZ(a.log_time, '+00:00', '+08:00'), '%Y-%m-%d %H:%i:%s') as formatted_time
            FROM AuditLogs a
            JOIN Countries c ON a.country_id = c.id
            ORDER BY a.log_time DESC
            LIMIT 50
        `;
        const [rows] = await pool.query(query);

        res.render('partials/feature10_result', { 
            layout: false, 
            logs: rows 
        });
    } catch (err) {
        console.error(err);
        res.send('Error loading audit logs');
    }
});

// --- 404 ERROR HANDLER (MUST BE THE LAST ROUTE) ---
app.use((req, res, next) => {
    res.status(404).render('404', { layout: false });
});

// START SERVER
app.listen(port, () => {
    console.log(`Server running on port 5806`);
});