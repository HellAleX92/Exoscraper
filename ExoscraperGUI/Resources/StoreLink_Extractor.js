const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const INPUT_JSON = path.join(__dirname, "game_data_with_details.json");
const PARTIAL_FOLDER = path.join(__dirname, "partials");
const OUTPUT_CSV = path.join(__dirname, "final_output_with_store_links.csv");

const args = process.argv.slice(2);
if (args.includes("--merge-csv")) {
    console.log("Merging partial files and generating CSV...");
    mergePartialsToCSV();
    process.exit(0);
}

function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

async function scrapeStoreLink(page, achievementLink) {
    try {
        console.log(`Visiting: ${achievementLink}`);
        await page.goto(achievementLink, { waitUntil: "domcontentloaded" });

        const storeLink = await page.$eval(
            "dd > a[href*='microsoft.com/store/apps/']",
            (el) => el.href
        ).catch(() => null);

        return storeLink;
    } catch (error) {
        console.error(`Error while fetching the store link for ${achievementLink}:`, error);
        return null;
    }
}

async function processGames() {
    ensureDirectoryExists(PARTIAL_FOLDER);

    const games = JSON.parse(fs.readFileSync(INPUT_JSON, "utf-8"));

    if (!games || games.length === 0) {
        console.error("No data found in the JSON file!");
        return;
    }

    console.log("Starting processing of game data...");

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 10, height: 10 },
    });
    const page = await context.newPage();

    let allData = [];
    for (let i = 0; i < games.length; i++) {
        const { achievementLink, title, platforms, totalAwards, totalPoints } = games[i];

        try {
            const storeLink = await scrapeStoreLink(page, achievementLink);
            allData.push({ title, platforms, totalAwards, totalPoints, storeLink });
        } catch (error) {
            console.error(`Error processing ${title}:`, error);
            allData.push({ title, platforms, totalAwards, totalPoints, storeLink: null });
        }

        if ((i + 1) % 5 === 0 || i === games.length - 1) {
            const partialFile = path.join(PARTIAL_FOLDER, `partial_${Math.floor(i / 5) + 1}.json`);
            fs.writeFileSync(partialFile, JSON.stringify(allData, null, 2), "utf-8");
            console.log(`Intermediate save to file: ${partialFile}`);
            allData = [];
        }
    }

    await browser.close();

    mergePartialsToCSV();
}

function mergePartialsToCSV() {
    const partialFiles = fs.readdirSync(PARTIAL_FOLDER).filter((file) => file.endsWith(".json"));
    const allData = [];

    partialFiles.forEach((file) => {
        const partialData = JSON.parse(fs.readFileSync(path.join(PARTIAL_FOLDER, file), "utf-8"));
        allData.push(...partialData);
        fs.unlinkSync(path.join(PARTIAL_FOLDER, file));
    });

    const csvContent =
        "Title,Platforms,Total Awards,Total Points,Microsoft Store Link\n" +
        allData
            .map((data) => {
                const title = data.title || "";
                const platforms = data.platforms ? data.platforms.join(", ") : "";
                const totalAwards = data.totalAwards || 0;
                const totalPoints = data.totalPoints || 0;
                const storeLink = data.storeLink || "";
                return `"${title}","${platforms}","${totalAwards}","${totalPoints}","${storeLink}"`;
            })
            .join("\n");

    fs.writeFileSync(OUTPUT_CSV, csvContent, "utf-8");
    console.log(`Final data successfully saved to ${OUTPUT_CSV}.`);
}

if (!args.includes("--merge-csv")) {
    processGames().catch((error) => {
        console.error("An error occurred:", error);
    });
}