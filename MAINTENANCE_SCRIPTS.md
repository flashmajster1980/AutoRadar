# 🛠️ Maintenance & Debug Scripts

This project includes several utility scripts to manually fix data, debug scrapers, or manage listings directly in the database.

## 🔄 `auto_repair_listing.js`
**Purpose:** Automates the repair of a specific listing by re-fetching its data from the portal (Bazos.sk / Autobazar.sk) and applying the latest `NormalizationService` logic.
**Use Case:** When a listing has missing KM, Fuel, or Transmission data due to parsing errors or missing description at the time of scraping.
**Usage:**
1. Open the file.
2. Edit the `repair('ID', 'URL')` call at the bottom with the target Listing ID and URL.
3. Run:
```bash
node auto_repair_listing.js
```

## 🏷️ `mark_sold.js`
**Purpose:** Manually marks a listing as SOLD (`is_sold = 1`) in the database.
**Use Case:** When a user reports a car is sold, but the scraper hasn't caught it yet, or the url is dead.
**Usage:**
1. Edit the `id` variable in the file.
2. Run:
```bash
node mark_sold.js
```

## 🕵️‍♂️ `audit_deals.js`
**Purpose:** Summary of all current Golden Deals with their key metrics (Price, Market Price, KM, Year).
**Use Case:** Quick health check to see if any new "junk" deals are slipping through.
**Usage:**
```bash
node audit_deals.js
```

## 📊 `inspect_market_calculation.js`
**Purpose:** Deep dive into a specific model/year to see exactly how the market median is being calculated across different mileage segments.
**Use Case:** Debugging why a certain car is valued higher or lower than expected.
**Usage:**
1. Edit the Model/Year/Make in the script.
2. Run:
```bash
node inspect_market_calculation.js
```

## 🧪 `test_normalization.js`
**Purpose:** Runs a suite of regression tests against the `NormalizationService`.
**Use Case:** Verify that changes to Regex (for KM, Fuel, etc.) don't break existing logic.
**Usage:**
```bash
node test_normalization.js
```

## 🕵️ `debug_listing.js`
**Purpose:** Simple script to fetch and log the raw HTML title and description of a URL.
**Use Case:** quick debugging of selectors without running the full repair logic.
**Usage:**
1. Edit the URL in the file.
2. Run:
```bash
node debug_listing.js
```

## 🔧 `fix_fuel_km.js`
**Purpose:** Batch script to infer missing Fuel/KM from *existing* data in the database (Title/Model) without re-scraping.
**Use Case:** Retroactively fixing database rows after a logic update.
**Usage:**
```bash
node fix_fuel_km.js
```
