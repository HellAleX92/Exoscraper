const fs = require("fs");
const path = require("path");
const { parse } = require("node-html-parser");

const PAGES_FOLDER = path.join(__dirname, "saved_pages");

const OUTPUT_JSON = path.join(__dirname, "game_data_with_details.json");

function extractGameData(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const root = parse(content);

    const achievementElements = root.querySelectorAll("a[href*='/game/'][href*='/achievements/']");
    const achievementData = achievementElements.map((anchor) => {
        let relativeLink = anchor.getAttribute("href");

        if (relativeLink && relativeLink.startsWith("https://www.exophase.comhttps")) {
            relativeLink = relativeLink.replace("https://www.exophase.comhttps", "https://www.exophase.com");
        }

        const achievementLink = relativeLink.startsWith("https://www.exophase.com")
            ? relativeLink
            : `https://www.exophase.com${relativeLink}`;

        const titleElement = anchor.closest("li")?.querySelector("h3 a");
        const title = titleElement ? titleElement.text.trim() : "Unknown Title";

        const platformsElement = anchor.closest("li")?.querySelector(".platforms");
        const platforms = platformsElement
            ? Array.from(platformsElement.querySelectorAll("span")).map((span) => span.text.trim())
            : [];

        const awardsElement = anchor.closest("li")?.querySelector(".inline-counters span:nth-of-type(1) span");
        const totalAwards = awardsElement
            ? parseInt(awardsElement.textContent.trim().replace(/[^\d]/g, ""), 10)
            : 0;

        const pointsElement = anchor.closest("li")?.querySelector(".col.text-center.align-self-end.inline-counters:nth-of-type(3) span span");
        const totalPoints = pointsElement
            ? parseInt(pointsElement.textContent.trim().replace(/[^\d]/g, ""), 10)
            : 0;

        return {
            achievementLink,
            title,
            platforms,
            totalAwards,
            totalPoints,
        };
    });

    return achievementData.filter((data) => data.achievementLink !== null);
}

async function processHtmlFiles() {
    const files = fs.readdirSync(PAGES_FOLDER).filter((file) => file.endsWith(".html"));

    console.log("Starting file processing...");

    let allData = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(PAGES_FOLDER, file);

        try {
            console.log(`(${i + 1}/${files.length}) Processing file: ${filePath}`);
            const gameData = extractGameData(filePath);
            allData = allData.concat(gameData);

            await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Error while processing the file ${file}:`, error);
        }
    }

    const uniqueData = allData.filter(
        (game, index, self) =>
            index === self.findIndex((g) => g.achievementLink === game.achievementLink)
    );

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(uniqueData, null, 2), "utf-8");

    console.log("Processing complete.");
    console.log(`Total number of unique entries: ${uniqueData.length}`);
}

processHtmlFiles().catch((error) => {
    console.error("An error occurred:", error);
});
