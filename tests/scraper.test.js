onst { expect } = require('chai');
const {
transformData,
flattenObject
} = require('../src/utils/filter_map');
const {
fetchAllPages,
withQueryParam
} = require('../src/utils/paginator');

describe('filter_map utilities', () => {
it('flattens nested objects using dot notation', () => {
const nested = { a: { b: { c: 1 } }, d: 2 };
const flat = flattenObject(nested);
expect(flat).to.deep.equal({
'a.b.c': 1,
d: 2
});
});

it('applies mapping and filters correctly', () => {
const data = [
{ id: 1, user: { name: 'Alice' }, active: true },
{ id: 2, user: { name: 'Bob' }, active: false },
{ id: 3, user: { name: 'Carol' }, active: true }
];

const mapping = [
{ from: 'id', to: 'id' },
{ from: 'user.name', to: 'name' }
];

const filters = [
{ path: 'active', op: 'eq', value: true }
];

const result = transformData(data, mapping, filters);
expect(result).to.deep.equal([
{ id: 1, name: 'Alice' },
{ id: 3, name: 'Carol' }
]);
});
});

describe('paginator utilities', () => {
it('constructs URLs with query parameters', () => {
const url = 'https://api.example.com/items';
const updated = withQueryParam(url, 'page', 2);
expect(updated).to.include('page=2');
expect(updated.startsWith(url)).to.be.true;
});

it('fetches multiple pages until empty when pagination is enabled', async () => {
const calls = [];

// Fake fetch implementation that returns data for page 1 and empty for page 2.
const fakeFetch = async (url) => {
calls.push(url);
const u = new URL(url);
const page = Number(u.searchParams.get('page') || '1');

if (page === 1) {
return {
status: 200,
async json() {
return [{ id: 1 }, [{ id: 2 }]];
}
};
}

return {
status: 200,
async json() {
return [];
}
};
};

const requestConfig = {
url: 'https://api.example.com/items',
method: 'GET',
headers: {}
};

const paginationConfig = {
enabled: true,
param: 'page',
start: 1,
maxPages: 5,
stopWhenEmpty: true
};

const pages = await fetchAllPages(requestConfig, paginationConfig, fakeFetch);
expect(pages).to.have.lengthOf(2);
expect(calls.length).to.equal(2);
});
});