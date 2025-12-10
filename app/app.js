const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware for Hogan (.hjs)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Database Connection
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'life_expectancy',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Routes
app.get('/', (req, res) => {
    // Render index.hjs
    res.render('index', { 
        studentId: 'm11405806',
        message: 'Database connection established.' 
    });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});