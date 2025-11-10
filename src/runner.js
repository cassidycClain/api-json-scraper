onst path = require('path');
const fs = require('fs');
const { runScraper } = require('./core/json_parser');
const { ErrorHandler } = require('./core/error_handler');

function resolveSettingsPath(argPath) {
  if (!argPath) {
    return path.join(__dirname, 'config', 'settings.example.json');
  }
  if (path.isAbsolute(argPath)) {
    return argPath;
  }
  return path.join(process.cwd(), argPath);
}

function loadSettings(settingsPath) {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    ErrorHandler.handle(error, { stage: 'loadSettings', settingsPath });
    process.exitCode = 1;
    throw error;
  }
}

(async () => {
  const argPath = process.argv[2];
  const settingsPath = resolveSettingsPath(argPath);

  console.log(`[runner] Using settings from: ${settingsPath}`);

  let settings;
  try {
    settings = loadSettings(settingsPath);
  } catch {
    // Error already logged and exitCode set
    return;
  }

  try {
    const result = await runScraper(settings);
    console.log(
      `[runner] Scrape completed. Records: ${result.recordCount}, Output: ${result.outputPath}`
    );
  } catch (error) {
    ErrorHandler.handle(error, { stage: 'runScraper' });
    process.exitCode = 1;
  }
})();