const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch").default;
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
        await page.goto(achievementLink, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);

        const storeLink = await page.$eval(
            "dd > a[href*='microsoft.com/store/apps/']",
            (el) => el.href
        ).catch(() => null);

        if (!storeLink) {
            console.warn(`Store link missing for ${achievementLink}.`);
            return null;
        }

        console.log(`Store link fetched: ${storeLink}`);
        return storeLink;
    } catch (error) {
        console.error(`Error while fetching the store link for ${achievementLink}: ${error.message}`);
        return null;
    }
}

function extractProductID(storeLink) {
    try {
        const url = new URL(storeLink);
        const productId = url.pathname.split("/").pop();
        // console.log(`Extracted ProductID: ${productId}`);
        return productId;
    } catch (error) {
        console.error(`Failed to extract ProductID from StoreLink: ${storeLink}`);
        return null;
    }
}

function findProductAndPrices(data, targetProductID) {
    if (!data || typeof data !== "object") return null;

    if (data.ProductId === targetProductID) {
        const price = data.Price || 0; 
        const displayPrice = data.DisplayPrice || "";
        const strikethroughPrice = data.StrikethroughPrice || "-"; 

       // console.log(`[DEBUG] Found Product -> ProductID: ${data.ProductId}, Price: ${price}, DisplayPrice: ${displayPrice}, StrikethroughPrice: ${strikethroughPrice}`);
        return { price, displayPrice, strikethroughPrice, product: data };
    }

    for (const key in data) {
        if (Array.isArray(data[key])) {
            for (const item of data[key]) {
                const result = findProductAndPrices(item, targetProductID);
                if (result) return result;
            }
        } else if (typeof data[key] === "object") {
            const result = findProductAndPrices(data[key], targetProductID);
            if (result) return result;
        }
    }

    return null;
}

function cleanAndParse(value) {
    if (!value) return 0;
    const cleanedValue = value.toString().replace(/[^\d.,-]/g, "").replace(",", ".");
    return parseFloat(cleanedValue) || 0;
}

async function fetchProductData(productId) {
    const apiUrl = `https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${productId}?market=DE&locale=de-de&deviceFamily=Windows.Desktop`;
    try {
        console.log(`Fetching product data for ProductID: ${productId} from API...`);
        const response = await fetch(apiUrl);

        if (!response.ok) {
            console.warn(`API returned an error for ProductID ${productId}: ${response.status}`);
            return { productId, status: "error", price: "-", strikethroughPrice: "-" };
        }

        const data = await response.json();

        const result = findProductAndPrices(data, productId);
        if (!result) {
            console.error(`ProductID not found or no prices available for ProductID: ${productId}`);
            return { productId, status: "error", price: "-", strikethroughPrice: "-" };
        }

        const { price, displayPrice, strikethroughPrice } = result;

        const numericPrice = cleanAndParse(price);
        const numericDisplayPrice = cleanAndParse(displayPrice);
        const numericStrikethroughPrice = cleanAndParse(strikethroughPrice);

        // console.log(`[DEBUG] Cleaned Prices -> Price: ${numericPrice}, DisplayPrice: ${numericDisplayPrice}, StrikethroughPrice: ${numericStrikethroughPrice}`);

        let status;
        if (numericPrice === 0 && (displayPrice === "" || displayPrice.toLowerCase() === "installieren")) {
            status = "delisted";
        } else if (displayPrice.toLowerCase() === "kostenlos") {
            status = "free";
        } else if (numericDisplayPrice !== 0 && numericDisplayPrice === numericPrice && numericDisplayPrice !== numericStrikethroughPrice) {
            status = "sale";
        } else if (numericPrice === 0 && numericStrikethroughPrice > 0) {
            status = "regular";
        } else if (numericPrice > 0 && numericDisplayPrice > 0) {
            status = "regular";
        } else if (numericDisplayPrice !== 0 && numericDisplayPrice === numericPrice) {
            status = "regular";
        } else {
            status = "error";
        }

        const salePrice = status === "sale" ? strikethroughPrice : "-";
        const originalPrice = status === "sale" ? displayPrice : "-";

        console.log(`[DEBUG] Final Status -> ProductID: ${productId}, Status: ${status}, SalePrice: ${salePrice}, OriginalPrice: ${originalPrice}`);
        return { productId, status, price: salePrice, strikethroughPrice: originalPrice };
    } catch (error) {
        console.error(`Error fetching product data for ProductID ${productId}: ${error.message}`);
        return { productId, status: "error", price: "-", strikethroughPrice: "-" };
    }
}

async function scrapeStoreData(page, achievementLink) {
    try {
        const storeLink = await scrapeStoreLink(page, achievementLink);
        if (!storeLink) {
            return { storeLink: null, status: "delisted", price: "-", salePrice: "-" };
        }

        const productId = extractProductID(storeLink);
        if (!productId) {
            return { storeLink, status: "error", price: "-", salePrice: "-" };
        }

        const productData = await fetchProductData(productId);

        return {
            storeLink,
            status: productData.status,
            price: productData.price,
            salePrice: productData.strikethroughPrice,
        };

    } catch (error) {
        console.error(`Error during scrapeStoreData for AchievementLink: ${achievementLink} -> ${error.message}`);
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
    const context = await chromium.launchPersistentContext('./user-data', {
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
            console.log(`[PROCESSING] Game: ${title}`);

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
            console.error(`Error processing game ${title}: ${error.message}`);
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

        if ((i + 1) % 5 === 0 || i === games.length - 1) {
            const partialFile = path.join(PARTIAL_FOLDER, `partial_${Math.floor(i / 5) + 1}.json`);
            fs.writeFileSync(partialFile, JSON.stringify(allData, null, 2), "utf-8");
            console.log(`[SAVE] Intermediate save to file: ${partialFile}`);
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
    console.log(`[FINAL] CSV successfully saved to ${OUTPUT_CSV}.`);
}

if (!args.includes("--merge-csv")) {
    processGames().catch((error) => {
        console.error("An error occurred:", error);
    });
}
