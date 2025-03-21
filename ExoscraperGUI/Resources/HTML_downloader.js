const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// Verzeichnis für gespeicherte Seiten
const PAGES_FOLDER = path.join(__dirname, "saved_pages");
if (!fs.existsSync(PAGES_FOLDER)) {
    fs.mkdirSync(PAGES_FOLDER);
}

// Funktion zum Speichern der Seite
async function savePageContent(page, pageNumber) {
    const content = await page.content();
    const filePath = path.join(PAGES_FOLDER, `page_${pageNumber}.html`);
    fs.writeFileSync(filePath, content);
    console.log(`Page ${pageNumber} saved: ${filePath}`);
}

// Hauptfunktion
(async () => {
    const pageLimitArg = process.argv[2];
    const pageLimit = pageLimitArg === "all" ? Infinity : parseInt(pageLimitArg, 10);

    let browser;
    let isSuccessful = true; // Erfolgsflag

    try {
        browser = await chromium.launch({ headless: false });
        const context = await browser.newContext({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            viewport: { width: 10, height: 10 },
        });

        const page = await context.newPage();

        const baseUrl = "https://www.exophase.com/platform/xbox/";
        const urlParams = "?q=&sort=added";

        await page.goto(`${baseUrl}${urlParams}`, { waitUntil: "load" });

        const totalPages = await page.evaluate(() => {
            const paginationLinks = Array.from(
                document.querySelectorAll(".pagination a.page-link.page-numbers")
            );
            const pageNumbers = paginationLinks
                .map((link) => parseInt(link.getAttribute("data-page")))
                .filter((num) => !isNaN(num));
            return Math.max(...pageNumbers);
        });

        console.log(`Total Pages: ${totalPages}`);

        for (let currentPage = 1; currentPage <= Math.min(totalPages, pageLimit); currentPage++) {
            const pageUrl =
                currentPage === 1
                    ? `${baseUrl}${urlParams}`
                    : `${baseUrl}page/${currentPage}/${urlParams}`;
            console.log(`Downloading Page ${currentPage}: ${pageUrl}`);

            await page.goto(pageUrl, { waitUntil: "load" });

            await page.mouse.move(200, 200);
            await page.waitForTimeout(500);
            await page.mouse.move(400, 400);

            const isValid = await page.locator("li.row.xbox").count();
            if (isValid > 0) {
                await savePageContent(page, currentPage);
            } else {
                console.warn(`Warning: No content found on page ${currentPage}.`);
            }
        }
    } catch (error) {
        isSuccessful = false;
        console.error("An error occurred:", error);
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log("Browser closed.");
            } catch (browserError) {
                console.error("Failed to close the browser:", browserError);
            }
        }

        // Erfolg oder Fehler melden
        if (isSuccessful) {
            console.log("Process completed successfully! All pages were downloaded as expected.");
        } else {
            console.log("Process completed with errors. Check the logs for details.");
        }
    }
})();
