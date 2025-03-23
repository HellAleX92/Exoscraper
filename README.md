non-multilingual. german website support only as for now (no button translation implemented)

for using dev options (and therefore ad blocker) you got to launch chromium in persistent mode undder processGames.

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            '--disable-extensions-except=path/to/extension',
            '--load-extension=path/to/extension',


.NET 8 minimum required, node.js integrated.
