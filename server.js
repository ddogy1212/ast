/** Orbit Keepsake — standalone Node server (Node.js 18+, no dependencies).
 * The NASA archive is fetched server-side because its CSV may not allow browser CORS.
 * Users' uploaded personal photos never leave the browser.
 */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const PORT = Number(process.env.PORT) || 3000;
const BASE = 'https://science.nasa.gov/specials/apps/what-did-hubble-see-on-your-birthday/';
const CSV = BASE + 'data/data.csv?v=2026-06-22_B';
const ROOT = __dirname;
let cache = null;
let cacheUntil = 0;
const pageImageCache = new Map();

function parseCsv(raw) {
  const result = [], row = [];
  let cell = '', quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && raw[i + 1] === '\n') i++;
      row.push(cell);
      if (row.length > 3) result.push([...row]);
      row.length = 0; cell = '';
    } else cell += c;
  }
  if (row.length) { row.push(cell); result.push(row); }
  return result;
}

async function loadArchive() {
  if (cache && Date.now() < cacheUntil) return cache;
  const r = await fetch(CSV, { headers: { Accept: 'text/csv,text/plain,*/*' }, signal: AbortSignal.timeout(18000) });
  if (!r.ok) throw Error('NASA server returned HTTP ' + r.status);
  const data = await r.text();
  if (!data.startsWith('Date,Total_Images')) throw Error('NASA CSV format has changed');
  const byDay = new Map(); let key = '';
  for (const c of parseCsv(data).slice(1)) {
    if (c[0]) {
      const date = c[0].match(/^(\d{1,2})\/(\d{1,2})\//);
      if (date) key = Number(date[1]) + '-' + Number(date[2]);
    }
    const file = (c[3] || '').trim();
    if (!key || !/^[\w.-]+\.(?:jpe?g|png|webp)$/i.test(file)) continue;
    const item = {
      shareImage: BASE + 'share_images/' + encodeURIComponent(file),
      image: BASE + 'share_images/' + encodeURIComponent(file),
      name: c[4] || 'Hubble image', description: c[5] || '',
      source: c[6] || BASE, observedYear: c[7] || ''
    };
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item);
  }
  if (byDay.size < 360) throw Error('Unexpectedly few dates returned by NASA');
  cache = byDay; cacheUntil = Date.now() + 24 * 3600 * 1000;
  return byDay;
}

function classifyPhoto(item) {
  const text = `${item.name} ${item.description}`.toLowerCase();
  const strong = [
    'galaxy','spiral','milky way','nebula','planet','jupiter','saturn','mars','neptune','uranus','pluto',
    'supernova','interstellar','star-forming','star cluster','globular','cluster'
  ];
  const weak = ['comet','asteroid','moon'];
  let score = 0;
  for (const k of strong) if (text.includes(k)) score += 2;
  for (const k of weak) if (text.includes(k)) score += 1;
  if (/person|spacecraft|astronaut|poster|timeline|infographic|illustration/.test(text)) score -= 5;
  return score;
}

async function findRawImageFromSource(sourceUrl) {
  if (!/^https:\/\//.test(sourceUrl)) return null;
  if (pageImageCache.has(sourceUrl)) return pageImageCache.get(sourceUrl);
  try {
    const r = await fetch(sourceUrl, { signal: AbortSignal.timeout(18000), headers: { 'User-Agent': 'OrbitKeepsake/1.0' } });
    if (!r.ok) throw Error('source page HTTP ' + r.status);
    const html = await r.text();
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
    ];
    let raw = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) { raw = match[1]; break; }
    }
    if (!raw) {
      const match = html.match(/https:\/\/assets\.science\.nasa\.gov\/[^"'\s>]+(?:jpe?g|png|webp)/i);
      if (match?.[0]) raw = match[0];
    }
    pageImageCache.set(sourceUrl, raw || null);
    return raw || null;
  } catch {
    pageImageCache.set(sourceUrl, null);
    return null;
  }
}

async function enrichItems(items) {
  const sorted = [...items].sort((a, b) => classifyPhoto(b) - classifyPhoto(a));
  const preferred = sorted.filter((item) => classifyPhoto(item) > 0);
  const chosen = (preferred.length ? preferred : sorted).slice(0, 5);
  const result = [];
  for (const item of chosen) {
    const raw = await findRawImageFromSource(item.source);
    result.push({
      ...item,
      image: raw ? `/api/image?src=${encodeURIComponent(raw)}` : item.image,
      rawImage: raw || item.shareImage
    });
  }
  return result;
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
const mimetypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET only' });
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/hubble') {
    const u = new URL(req.url, 'http://localhost');
    const month = Number(u.searchParams.get('month')), day = Number(u.searchParams.get('day'));
    if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > new Date(2024, month, 0).getDate()) return json(res, 400, { error: '올바른 월과 일을 선택해 주세요.' });
    try {
      const items = (await loadArchive()).get(month + '-' + day) || [];
      return json(res, 200, { photos: await enrichItems(items), source: BASE });
    }
    catch (error) { return json(res, 502, { error: 'NASA 아카이브 연결 실패: ' + error.message }); }
  }
  if (pathname === '/api/image') {
    const u = new URL(req.url, 'http://localhost');
    const src = u.searchParams.get('src') || '';
    if (!/^https:\/\//.test(src)) return json(res, 400, { error: '잘못된 이미지 주소예요.' });
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(18000), headers: { 'User-Agent': 'OrbitKeepsake/1.0' } });
      if (!r.ok) return json(res, 502, { error: '이미지 프록시 실패: HTTP ' + r.status });
      const type = r.headers.get('content-type') || 'image/jpeg';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public,max-age=86400' });
      const buffer = Buffer.from(await r.arrayBuffer());
      return res.end(buffer);
    } catch (error) {
      return json(res, 502, { error: '이미지를 가져오지 못했어요.' });
    }
  }
  const allowed = new Set(['/', '/index.html', '/app.js', '/styles.css', '/assets/promo.svg']);
  if (!allowed.has(pathname)) return json(res, 404, { error: 'Not found' });
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  try {
    const bytes = await fs.readFile(path.resolve(ROOT, relative));
    res.writeHead(200, { 'Content-Type': (mimetypes[path.extname(relative)] || 'application/octet-stream') + (['.html', '.js', '.css'].includes(path.extname(relative)) ? '; charset=utf-8' : ''), 'Cache-Control': 'public,max-age=60' });
    res.end(bytes);
  } catch { json(res, 404, { error: 'File not found' }); }
});
if (require.main === module) server.listen(PORT, '0.0.0.0', () => console.log('Orbit Keepsake at http://localhost:' + PORT));
module.exports = { server, parseCsv };
