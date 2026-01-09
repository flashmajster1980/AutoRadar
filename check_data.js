const { dbAsync } = require('./database');

async function checkListing() {
    const row = await dbAsync.get("SELECT id, title, transmission, drive, description FROM listings WHERE id = '186789320'");
    console.log(row);
}
checkListing();
