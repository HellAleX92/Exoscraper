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
        return productId;
    } catch (error) {
        console.error(`Failed to extract ProductID from StoreLink: ${storeLink}`);
        return null;
    }
}

async function fetchProductData(productId) {
    const apiUrl = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${productId}&market=de&languages=de-de`;
    try {
        console.log(`Fetching product data for ProductID: ${productId} from API...`);
        const response = await fetch(apiUrl);

        if (!response.ok) {
            console.warn(`API returned an error for ProductID ${productId}: ${response.status}`);
            return { productId, status: "error", MSRP: "-", ListPrice: "-", TitleID: "-" };
        }

        const data = await response.json();
        const product = data?.Products?.[0];

        if (!product) {
            console.error(`No product data available for ProductID: ${productId}`);
            return { productId, status: "not listed", MSRP: "-", ListPrice: "-", TitleID: "-" };
        }

        const availability = product.DisplaySkuAvailabilities?.[0]?.Availabilities?.[0];
        if (!availability) {
            console.error(`No valid availability data found for ProductID ${productId}`);
            return { productId, status: "not listed", MSRP: "-", ListPrice: "-", TitleID: "-" };
        }

        const actions = availability.Actions || [];
        const preOrderReleaseDate = availability?.Properties?.PreOrderReleaseDate;
        const isPreOrder = preOrderReleaseDate ? new Date(preOrderReleaseDate) > new Date() : false;

        const msrp = availability.OrderManagementData?.Price?.MSRP || 0;
        const listPrice = availability.OrderManagementData?.Price?.ListPrice || msrp;
        const wholesalePrice = availability.OrderManagementData?.Price?.WholesalePrice || 0;
        const wholesaleCurrencyCode = availability.OrderManagementData?.Price?.WholesaleCurrencyCode || "";
        const titleID = product.AlternateIds?.find(id => id.IdType === "XboxTitleId")?.Value || "-";

        let status, salePrice = "-";

        if (isPreOrder) {
            status = "pre order";
        } else if (actions.length === 2 && actions.includes("Details") && actions.includes("Redeem")) {
            status = "delisted";
        } else if (
            msrp === 0 &&
            listPrice === 0 &&
            (wholesaleCurrencyCode === "")
        ) {
            if (
                actions.length === 5 &&
                actions.includes("Details") &&
                actions.includes("Browse") &&
                actions.includes("Curate") &&
                actions.includes("Fulfill") &&
                actions.includes("Redeem")
            ) {
                status = "not available yet";
            }
        } else if (
            msrp === 0 &&
            listPrice === 0 &&
            wholesalePrice === 0 &&
            (wholesaleCurrencyCode === "" || wholesaleCurrencyCode === "EUR")
        ) {
            if (
                actions.length === 3 &&
                actions.includes("Details") &&
                actions.includes("Fulfill") &&
                actions.includes("Redeem")
            ) {
                status = "free";
            } else if (
                actions.length === 4 &&
                actions.includes("Details") &&
                actions.includes("Fulfill") &&
                actions.includes("Redeem") &&
                actions.includes("Purchase")
            ) {
                status = "free";
            } else if (
                actions.length === 6 &&
                actions.includes("Details") &&
                actions.includes("Fulfill") &&
                actions.includes("Redeem") &&
                actions.includes("Purchase") &&
                actions.includes("Browse") &&
                actions.includes("Curate")
            ) {
                status = "free";
            }
        } else if (msrp !== listPrice) {
            status = "sale";
            salePrice = listPrice;
        } else {
            status = "regular";
        }

        console.log(`[DEBUG] ProductID: ${productId}, TitleID: ${titleID}, MSRP: ${msrp}, ListPrice: ${listPrice}, Status: ${status}`);
        return { productId, status, MSRP: msrp, ListPrice: listPrice, SalePrice: salePrice, TitleID: titleID };
    } catch (error) {
        console.error(`Error fetching product data for ProductID ${productId}: ${error.message}`);
        return { productId, status: "error", MSRP: "-", ListPrice: "-", TitleID: "-" };
    }
}

async function scrapeStoreData(page, achievementLink) {
    try {
        const storeLink = await scrapeStoreLink(page, achievementLink);
        if (!storeLink) {
            return { storeLink: null, status: "error", MSRP: "-", ListPrice: "-", WholesalePrice: "-", IsPreOrder: false, TitleID: "-" };
        }

        const productId = extractProductID(storeLink);
        if (!productId) {
            return { storeLink, status: "error", MSRP: "-", ListPrice: "-", WholesalePrice: "-", IsPreOrder: false, TitleID: "-" };
        }

        const productData = await fetchProductData(productId);

        return {
            storeLink,
            status: productData.status,
            MSRP: productData.MSRP,
            ListPrice: productData.ListPrice,
            WholesalePrice: productData.WholesalePrice,
            IsPreOrder: productData.IsPreOrder,
            TitleID: productData.TitleID,
        };
    } catch (error) {
        console.error(`Error during scrapeStoreData for AchievementLink: ${achievementLink} -> ${error.message}`);
        return { storeLink: null, status: "error", MSRP: "-", ListPrice: "-", WholesalePrice: "-", IsPreOrder: false, TitleID: "-" };
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
            '--disable-extensions-except=c:/users/alex/downloads/uBlock0.chromium',
            '--load-extension=c:/users/alex/downloads/uBlock0.chromium',
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
                titleID: storeData.TitleID || "-",
                status: storeData.status,
                price: storeData.MSRP,
                salePrice: storeData.ListPrice,
            });

        } catch (error) {
            console.error(`Error processing game ${title}: ${error.message}`);
            allData.push({
                title,
                platforms,
                totalAwards,
                totalPoints,
                storeLink: null,
                titleID: "-",
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
        "Title,Platforms,Total Achievements,Total Gamerscore,Microsoft Store Link,TitleID,Status,Price,Sale Price\n" +
        allData
            .map((data) => {
                const title = data.title || "";
                const platforms = data.platforms ? data.platforms.join(", ") : "";
                const totalAwards = data.totalAwards || 0;
                const totalPoints = data.totalPoints || 0;
                const storeLink = data.storeLink || "";
                const titleID = data.titleID || "-";
                const status = data.status || "";
                const price = data.price || "-";
                const salePrice = data.salePrice || "-";
                return `"${title}","${platforms}","${totalAwards}","${totalPoints}","${storeLink}","${titleID}","${status}","${price}","${salePrice}"`;
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
