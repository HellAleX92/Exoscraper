const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const INPUT_JSON = path.join(__dirname, "game_data_with_details.json");
const PARTIAL_FOLDER = path.join(__dirname, "partials");
const OUTPUT_CSV = path.join(__dirname, "final_output_with_store_links_and_pricing.csv");

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
        console.log(`Navigating to ${achievementLink} to fetch store link...`);
        await page.goto(achievementLink, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);

        const storeLink = await page.$eval(
            "dd > a[href*='microsoft.com/store/apps/']",
            (el) => el.href
        ).catch(() => null);

        if (!storeLink) {
            console.warn(`Store link missing for ${achievementLink}. Retrying...`);
            return { storeLink: null, status: "delisted", price: "-", salePrice: "-" };
        }

        return storeLink;
    } catch (error) {
        console.error(`Error while fetching the store link for ${achievementLink}: ${error}`);
        return { storeLink: null, status: "error", price: "-", salePrice: "-" };
    }
}

async function scrapeStoreData(page, achievementLink) {
    try {
        const storeLink = await scrapeStoreLink(page, achievementLink);
        if (!storeLink) {
            return { storeLink: null, status: "delisted", price: "-", salePrice: "-" };
        }
        console.log(`Navigating to store link ${storeLink} to fetch store data...`);
        await page.goto(storeLink, { waitUntil: "domcontentloaded" });

        try {
            await page.waitForSelector("button[aria-label*='kaufen'], button[aria-label*='Kostenlos'], button[aria-label*='Vorbestellen'], button[aria-label*='Verkauf für'], button[aria-disabled='true']", { timeout: 10000 });
            console.log("Button found.");
        } catch (error) {
            if (error.name === "TimeoutError") {
                console.error(`Timeout waiting for button: ${storeLink}`);
                return { storeLink, status: "timeout", price: "-", salePrice: "-" };
            } else {
                throw error;
            }
        }

        const buttons = await page.locator("button").elementHandles();
        let status = null, price = "-", salePrice = "-";

        for (const button of buttons) {
            const ariaLabel = await button.getAttribute("aria-label");
            const buttonText = await button.innerText();
            const isDisabled = await button.getAttribute("aria-disabled");

            // 1. NICHT SEPARAT VERFÜGBAR -> delisted
            if ((buttonText?.includes("NICHT SEPARAT VERFÜGBAR") || isDisabled === "true")) {
                status = "delisted";
                console.log(`Status set to "delisted" -> Store-Link: ${storeLink}`);
            }
            // 2 Installieren -> delisted
            else if (buttonText?.includes("Installieren") || ariaLabel?.includes("Installieren")) {
                status = "delisted";
                console.log(`Status set to "delisted" -> Store-Link: ${storeLink}`);
            }
            // 3. Vorbestellen -> pre-order
            else if (buttonText?.includes("Vorbestellen") || ariaLabel?.includes("Vorbestellen")) {
                status = "pre-order";
                price = ariaLabel?.match(/\d+,\d+/)?.[0] || buttonText?.match(/\d+,\d+/)?.[0] || "-";
                console.log(`Status set to "pre-order" -> Store-Link: ${storeLink}`);
            }
            // 4. Kostenlos -> free
            else if (ariaLabel?.includes("Kostenlos") || ariaLabel?.includes("Kostenlos+")) {
                status = "free";
                price = "0,00 €";
                console.log(`Status set to "free" -> Store-Link: ${storeLink}`);
            }
            // 5. Verkauf (Sale) -> sale
            else if (ariaLabel?.includes("Verkauf für")) {
                status = "sale";
                const parts = ariaLabel.split(" ");
                price = parts[parts.indexOf("Originalpreis") + 1]; // Originalpreis
                salePrice = parts[parts.indexOf("Verkauf") + 2]; // Rabattierter Preis
                console.log(`Status set to "sale" -> Store-Link: ${storeLink}`);
            }
            // 6. Kaufen mit Preis -> regular
            else if (ariaLabel?.includes("kaufen") && /\d+,\d+/.test(ariaLabel)) {
                status = "regular";
                price = ariaLabel.match(/\d+,\d+/)?.[0] || "-";
                console.log(`Status set to "regular" -> Store-Link: ${storeLink}`);
            }
        }

        return { storeLink, status, price, salePrice };

    } catch (error) {
        if (error.message.includes("ERR:NET:")) {
            console.error(`Networkerror while scraping Store-Data -> ${achievementLink}: ${error}`);
        } else {
            console.error(`Unexpected error while scraping Store-Data -> ${achievementLink}: ${error}`);
        }
        return { storeLink: null, status: "error", price: "-", salePrice: "-" };
    }
}

async function processGames() {
    ensureDirectoryExists(PARTIAL_FOLDER);

    const games = JSON.parse(fs.readFileSync(INPUT_JSON, "utf-8"));
    if (!games || games.length === 0) {
        console.error("No data found in the JSON file!");
        return;
    }

    console.log("Starting processing of List...");
    const userDataDir = './user-data';
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            '--disable-extensions-except=path/to/extension',
            '--load-extension=path/to/extension',
        ],
        viewport: { width: 200, height: 200 },
    });

    const page = await context.newPage();

    let allData = [];
    for (let i = 0; i < games.length; i++) {
        const { achievementLink, title, platforms, totalAwards, totalPoints } = games[i];

        try {
            await page.goto(achievementLink, { waitUntil: "domcontentloaded" });
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(5000);

            const storeData = await scrapeStoreData(page, achievementLink);
            allData.push({
                title,
                platforms,
                totalAwards,
                totalPoints,
                storeLink: storeData.storeLink,
                status: storeData.status,
                price: storeData.price,
                salePrice: storeData.salePrice,
            });

        } catch (error) {
            console.error(`Fehler bei der Verarbeitung von ${title}: ${error.message}`);
            allData.push({
                title,
                platforms,
                totalAwards,
                totalPoints,
                storeLink: null,
                status: "error",
                price: "-",
                salePrice: "-",
            });
        }

        if ((i + 1) % 500 === 0 || i === games.length - 1) {
            const partialFile = path.join(PARTIAL_FOLDER, `partial_${Math.floor(i / 500) + 1}.json`);
            fs.writeFileSync(partialFile, JSON.stringify(allData, null, 2), "utf-8");
            console.log(`Intermediate save to file: ${partialFile}`);
            allData = [];
        }
    }

    await context.close();

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
        "Title,Platforms,Total Achievements,Total Gamerscore,Microsoft Store Link,Status,Price,Sale Price\n" +
        allData
            .map((data) => {
                const title = data.title || "";
                const platforms = data.platforms ? data.platforms.join(", ") : "";
                const totalAwards = data.totalAwards || 0;
                const totalPoints = data.totalPoints || 0;
                const storeLink = data.storeLink || "";
                const status = data.status || "";
                const price = data.price || "-";
                const salePrice = data.salePrice || "-";
                return `"${title}","${platforms}","${totalAwards}","${totalPoints}","${storeLink}","${status}","${price}","${salePrice}"`;
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
