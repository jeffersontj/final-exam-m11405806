-- ==========================================
-- 1. DATABASE PREPARATION
-- ==========================================
USE life_expectancy;

-- ==========================================
-- 2. CREATE NORMALIZED TABLES (DDL)
-- ==========================================
CREATE TABLE IF NOT EXISTS Regions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS SubRegions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    region_id INT,
    FOREIGN KEY (region_id) REFERENCES Regions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS IntermediateRegions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    sub_region_id INT,
    FOREIGN KEY (sub_region_id) REFERENCES SubRegions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Countries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    iso_alpha2 VARCHAR(5),
    iso_alpha3 VARCHAR(5),
    country_code INT,
    sub_region_id INT,
    intermediate_region_id INT NULL,
    FOREIGN KEY (sub_region_id) REFERENCES SubRegions(id),
    FOREIGN KEY (intermediate_region_id) REFERENCES IntermediateRegions(id)
);

CREATE TABLE IF NOT EXISTS Years (
    year INT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS Indicators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Observations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT,
    year INT,
    indicator_id INT,
    value DECIMAL(10, 4),
    FOREIGN KEY (country_id) REFERENCES Countries(id) ON DELETE CASCADE,
    FOREIGN KEY (year) REFERENCES Years(year),
    FOREIGN KEY (indicator_id) REFERENCES Indicators(id),
    CONSTRAINT unique_observation UNIQUE (country_id, year, indicator_id)
);

CREATE TABLE IF NOT EXISTS AuditLogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT,
    action_type VARCHAR(20),
    old_value DECIMAL(10, 4) NULL,
    new_value DECIMAL(10, 4) NULL,
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details VARCHAR(255)
);

-- ==========================================
-- 3. ETL PROCESS
-- ==========================================
CREATE TABLE IF NOT EXISTS staging_facts (
    Entity VARCHAR(255),
    Code VARCHAR(10),
    Year INT,
    LifeExpectancy DECIMAL(10, 4)
);

CREATE TABLE IF NOT EXISTS staging_locations (
    name VARCHAR(255),
    alpha_2 VARCHAR(10),
    alpha_3 VARCHAR(10),
    country_code VARCHAR(10),
    iso_3166_2 VARCHAR(50),
    region VARCHAR(100),
    sub_region VARCHAR(100),
    intermediate_region VARCHAR(100),
    region_code VARCHAR(10),
    sub_region_code VARCHAR(10),
    intermediate_region_code VARCHAR(10)
);

-- LOAD DATA (Handling \n and \r\n line endings)
LOAD DATA INFILE '/var/lib/mysql-files/data1.csv'
INTO TABLE staging_facts
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;

LOAD DATA INFILE '/var/lib/mysql-files/data2.csv'
INTO TABLE staging_locations
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'
IGNORE 1 ROWS;

-- TRANSFORM & LOAD
INSERT IGNORE INTO Regions (name)
SELECT DISTINCT region FROM staging_locations WHERE region > '';

INSERT IGNORE INTO SubRegions (name, region_id)
SELECT DISTINCT sl.sub_region, r.id
FROM staging_locations sl JOIN Regions r ON sl.region = r.name
WHERE sl.sub_region > '';

INSERT IGNORE INTO IntermediateRegions (name, sub_region_id)
SELECT DISTINCT sl.intermediate_region, sr.id
FROM staging_locations sl JOIN SubRegions sr ON sl.sub_region = sr.name
WHERE sl.intermediate_region > '';

INSERT IGNORE INTO Countries (name, iso_alpha2, iso_alpha3, country_code, sub_region_id, intermediate_region_id)
SELECT DISTINCT sl.name, sl.alpha_2, sl.alpha_3, sl.country_code, sr.id, ir.id
FROM staging_locations sl
LEFT JOIN SubRegions sr ON sl.sub_region = sr.name
LEFT JOIN IntermediateRegions ir ON sl.intermediate_region = ir.name
WHERE sl.name IS NOT NULL AND sl.alpha_3 IS NOT NULL;

INSERT IGNORE INTO Years (year) SELECT DISTINCT Year FROM staging_facts;

INSERT INTO Indicators (name, unit) VALUES ('Life Expectancy at Birth', 'Years');

INSERT IGNORE INTO Observations (country_id, year, indicator_id, value)
SELECT c.id, sf.Year, 1, sf.LifeExpectancy
FROM staging_facts sf JOIN Countries c ON sf.Code = c.iso_alpha3
WHERE sf.LifeExpectancy IS NOT NULL;

-- CLEANUP
DROP TABLE staging_facts;
DROP TABLE staging_locations;