onst { ErrorHandler } = require('../core/error_handler');

/**
* Resolves a fetch implementation. Uses global fetch when available.
*/
function getFetchImpl(fetchImpl) {
if (fetchImpl) return fetchImpl;
if (typeof fetch === 'function') return fetch;
throw new Error(
'No fetch implementation available. Use Node 18+ or provide a custom fetch implementation.'
);
}

/**
* Executes a single HTTP request and returns parsed JSON with retry logic.
* requestConfig: { url, method, headers, payload }
*/
async function fetchJsonOnce(
requestConfig,
fetchImpl,
retryConfig = { maxAttempts: 3, delayMs: 500 }
) {
const impl = getFetchImpl(fetchImpl);
const maxAttempts = retryConfig.maxAttempts || 3;
const delayMs = retryConfig.delayMs || 500;

let attempt = 0;

while (true) {
attempt += 1;
try {
const { url, method = 'GET', headers = {}, payload } = requestConfig;
const options = {
method,
headers
};

if (payload != null) {
if (
typeof payload === 'object' &&
!Buffer.isBuffer(payload)
) {
options.body = JSON.stringify(payload);
if (!options.headers['Content-Type']) {
options.headers['Content-Type'] = 'application/json';
}
} else {
options.body = payload;
}
}

const response = await impl(url, options);

const status = response.status;
if (status < 200 || status >= 300) {
const error = new Error(
`HTTP ${status} while requesting ${url}`
);
error.status = status;
throw error;
}

const json = await response.json();
return json;
} catch (error) {
ErrorHandler.handle(error, {
stage: 'fetchJsonOnce',
attempt,
url: requestConfig && requestConfig.url
});

if (!ErrorHandler.shouldRetry(error, attempt, maxAttempts)) {
throw error;
}

await ErrorHandler.delay(delayMs * attempt);
}
}
}

/**
* Adds or replaces a query parameter on a URL.
*/
function withQueryParam(url, key, value) {
const u = new URL(url);
u.searchParams.set(key, String(value));
return u.toString();
}

/**
* Fetches all pages for a given request using a simple page-based strategy.
* paginationConfig:
* {
*   enabled: true,
*   param: 'page',
*   start: 1,
*   maxPages: 10,
*   stopWhenEmpty: true
* }
*/
async function fetchAllPages(requestConfig, paginationConfig = {}, fetchImpl) {
if (!paginationConfig.enabled) {
const single = await fetchJsonOnce(requestConfig, fetchImpl);
return [single];
}

const param = paginationConfig.param || 'page';
const start = paginationConfig.start == null ? 1 : paginationConfig.start;
const maxPages =
paginationConfig.maxPages == null ? 50 : paginationConfig.maxPages;
const stopWhenEmpty =
paginationConfig.stopWhenEmpty == null
? true
: !!paginationConfig.stopWhenEmpty;

const pages = [];
let page = start;

while (page <= maxPages) {
const pageUrl = withQueryParam(requestConfig.url, param, page);
const pageRequest = { ...requestConfig, url: pageUrl };

const json = await fetchJsonOnce(pageRequest, fetchImpl);
pages.push(json);

if (stopWhenEmpty) {
const isEmpty =
json == null ||
(Array.isArray(json) && json.length === 0) ||
(typeof json === 'object' &&
!Array.isArray(json) &&
Object.keys(json).length === 0);

if (isEmpty) {
break;
}
}

page += 1;
}

return pages;
}

module.exports = {
fetchJsonOnce,
fetchAllPages,
withQueryParam,
getFetchImpl
};