onst fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { ErrorHandler } = require('./error_handler');
const { transformData } = require('../utils/filter_map');
const { fetchAllPages, fetchJsonOnce } = require('../utils/paginator');

/**
* Extracts items from an array of responses using an optional responsePath.
* If the target is an array, it is spread, otherwise it is treated as a single item.
*/
function extractItemsFromResponses(responses, responsePath) {
const items = [];

for (const resp of responses) {
const target = responsePath ? _.get(resp, responsePath) : resp;
if (Array.isArray(target)) {
items.push(...target);
} else if (target && typeof target === 'object') {
items.push(target);
}
}

return items;
}

function ensureDirectoryExists(filePath) {
const dir = path.dirname(filePath);
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true });
}
}

function escapeCsvValue(value) {
if (value === null || value === undefined) return '';
const str = String(value);
if (/[",\n]/.test(str)) {
return `"${str.replace(/"/g, '""')}"`;
}
return str;
}

function buildCsv(data) {
if (!Array.isArray(data) || data.length === 0) {
return '';
}

const headers = Array.from(
data.reduce((set, row) => {
Object.keys(row).forEach((k) => set.add(k));
return set;
}, new Set())
);

const lines = [];
lines.push(headers.join(','));

for (const row of data) {
const line = headers
.map((h) => escapeCsvValue(row[h]))
.join(',');
lines.push(line);
}

return lines.join('\n');
}

function buildJson(data) {
return JSON.stringify(data, null, 2);
}

function buildXml(data, rootName = 'items', itemName = 'item') {
const escape = (str) =>
String(str)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&apos;');

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>`;

for (const item of data) {
xml += `\n  <${itemName}>`;
for (const [key, value] of Object.entries(item)) {
xml += `\n    <${key}>${escape(value == null ? '' : value)}</${key}>`;
}
xml += `\n  </${itemName}>`;
}

xml += `\n</${rootName}>\n`;
return xml;
}

function buildHtmlTable(data, title = 'Scraped Data') {
if (!Array.isArray(data) || data.length === 0) {
return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
</head>
<body>
<h1>${title}</h1>
<p>No data available.</p>
</body>
</html>`;
}

const headers = Array.from(
data.reduce((set, row) => {
Object.keys(row).forEach((k) => set.add(k));
return set;
}, new Set())
);

const headerRow = headers.map((h) => `<th>${h}</th>`).join('');

const bodyRows = data
.map((row) => {
const cells = headers
.map((h) => `<td>${row[h] == null ? '' : row[h]}</td>`)
.join('');
return `<tr>${cells}</tr>`;
})
.join('\n      ');

return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 4px 8px; font-family: Arial, sans-serif; font-size: 13px; }
th { background-color: #f4f4f4; }
caption { font-weight: bold; margin-bottom: 8px; }
</style>
</head>
<body>
<table>
<caption>${title}</caption>
<thead>
<tr>${headerRow}</tr>
</thead>
<tbody>
${bodyRows}
</tbody>
</table>
</body>
</html>`;
}

/**
* Writes output data to a file in the requested format.
*/
function writeOutput(data, outputConfig = {}) {
const format = (outputConfig.format || 'csv').toLowerCase();
const filePath =
outputConfig.filePath || path.join(process.cwd(), 'data', `output.${format}`);

ensureDirectoryExists(filePath);

let content;
switch (format) {
case 'json':
content = buildJson(data);
break;
case 'xml':
content = buildXml(data);
break;
case 'html':
content = buildHtmlTable(data);
break;
case 'csv':
default:
content = buildCsv(data);
break;
}

fs.writeFileSync(filePath, content, 'utf8');
return { filePath, format };
}

/**
* Main entry for the scraper. Accepts a settings object or a path to a JSON file.
*/
async function runScraper(settingsOrPath) {
let settings = settingsOrPath;

if (typeof settingsOrPath === 'string') {
try {
const raw = fs.readFileSync(settingsOrPath, 'utf8');
settings = JSON.parse(raw);
} catch (error) {
ErrorHandler.handle(error, { stage: 'parseSettings', settingsPath: settingsOrPath });
throw error;
}
}

const request = settings.request || {
url: settings.url,
method: settings.method,
headers: settings.headers,
payload: settings.payload
};

if (!request || !request.url) {
const error = new Error('Missing request.url in settings.');
ErrorHandler.handle(error, { stage: 'validateSettings' });
throw error;
}

const pagination = settings.pagination || { enabled: false };
const mapping = settings.mapping || [];
const filters = settings.filters || [];
const responsePath = settings.responsePath || null;

let responses;
try {
if (pagination.enabled) {
responses = await fetchAllPages(request, pagination);
} else {
const singleResponse = await fetchJsonOnce(request);
responses = [singleResponse];
}
} catch (error) {
ErrorHandler.handle(error, { stage: 'fetch', url: request.url });
throw error;
}

const rawItems = extractItemsFromResponses(responses, responsePath);
const transformed = transformData(rawItems, mapping, filters);

let output;
try {
output = writeOutput(transformed, settings.output);
} catch (error) {
ErrorHandler.handle(error, { stage: 'writeOutput', outputConfig: settings.output });
throw error;
}

return {
recordCount: transformed.length,
outputPath: output.filePath,
format: output.format
};
}

module.exports = {
runScraper,
extractItemsFromResponses,
buildCsv,
buildJson,
buildXml,
buildHtmlTable,
writeOutput
};