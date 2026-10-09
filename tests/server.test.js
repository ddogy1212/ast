const test = require('node:test');
const assert = require('node:assert/strict');
const { server, parseCsv } = require('../server');

test('CSV parser handles commas and multiline quoted fields', () => {
  const csv = 'Date,Total_Images,Image_Number,Image_File,Name,Description,URL,Year\r\n' +
    '1/1/2019,5,1,a.jpg,Nebula,"A comma, and\na newline",https://example.com,2001\r\n';
  const parsed = parseCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1][5], 'A comma, and\na newline');
});

test('GET static pages and reject invalid dates', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const root = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(root + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Orbit Keepsake/);
    const pngOrSvg = await fetch(root + '/assets/promo.svg');
    assert.equal(pngOrSvg.status, 200);
    assert.match(await pngOrSvg.text(), /<svg/);
    const invalid = await fetch(root + '/api/hubble?month=2&day=30');
    assert.equal(invalid.status, 400);
    const invalidMonth = await fetch(root + '/api/hubble?month=13&day=1');
    assert.equal(invalidMonth.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
