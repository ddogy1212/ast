/** Orbit Keepsake — client-only graphics and personal image processing.
 * No photo data, text, or birthday is transmitted except the month/day NASA lookup.
 */
const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const ratios = {
  photocard: { w: 540, h: 860, label: '포토카드 · 54 × 86 mm' },
  square: { w: 640, h: 640, label: '정사각형 · 1:1' },
  portrait: { w: 600, h: 800, label: '세로형 · 3:4' },
  landscape: { w: 640, h: 480, label: '가로형 · 4:3' },
  story: { w: 540, h: 960, label: '스토리 · 9:16' }
};
const colors = ['#ffffff', '#ded1ff', '#ffcfdf', '#ffdf94', '#b6edfa', '#1c2035'];
const stickerSymbols = ['✦','☾','☆','♡','🪐','✨','🌙','💜','🎀','🦋','⭐','☁️','🌸','🧸','💫','♥'];
const state = { month: 7, day: 19, photos: [], photo: 0, bg: null, ratio: 'photocard', style: 'clean', layers: [], selected: null, tab: 'text', newColor: '#ffffff', busy: false, imageRequest: 0, mode: 'erase' };
const NASA_IMAGE_BASE = 'https://science.nasa.gov/specials/apps/what-did-hubble-see-on-your-birthday/images/';
let birthdayArchivePromise = null;
async function getBirthdayArchive() {
  if (!birthdayArchivePromise) {
    birthdayArchivePromise = (async () => {
      const response = await fetch('./hubble-data.b64');
      if (!response.ok) throw Error('허블 사진 데이터 파일을 불러오지 못했어요. GitHub에 hubble-data.b64가 있는지 확인해 주세요.');
      if (!('DecompressionStream' in window)) throw Error('현재 브라우저는 생일 사진 데이터를 읽을 수 없어요. 최신 크롬 또는 사파리를 사용해 주세요.');
      const encoded = (await response.text()).trim();
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    })().catch(e => { birthdayArchivePromise = null; throw e; });
  }
  return birthdayArchivePromise;
}
function getBirthdayPhotos(archive, month, day) {
  const rows = archive[month + '-' + day] || [];
  const scored = rows
    .map(([file,name,source,observedYear,score]) => ({
      image: NASA_IMAGE_BASE + encodeURIComponent(file),
      name: name || 'Hubble image',
      description: 'NASA 허블망원경의 실제 천체 관측 사진입니다. 자세한 내용은 NASA 원본 페이지를 참고하세요.',
      source: source || 'https://science.nasa.gov/mission/hubble/',
      observedYear,
      score: Number(score) || 0
    }))
    .filter(photo => photo.score > 0)
    .sort((a,b) => b.score - a.score);
  return scored.slice(0, 5);
}
const card = $('#card'), cutCanvas = $('#cut-canvas');
let dragId = null, painting = false, basePixels = null;
const error = (message, studio = true) => { $(studio ? '#studio-error' : '#home-error').textContent = message || ''; };
const el = (tag, attrs = {}, text) => { const node = document.createElement(tag); Object.entries(attrs).forEach(([key, value]) => { if (key === 'class') node.className = value; else node.setAttribute(key, value); }); if (text !== undefined) node.textContent = text; return node; };

function initDate() {
  const month = $('#month'), day = $('#day');
  for (let m = 1; m <= 12; m++) month.add(new Option(m + '월', String(m)));
  month.value = '7';
  const updateDays = () => {
    state.month = Number(month.value);
    const count = new Date(2024, state.month, 0).getDate();
    const old = Math.min(Number(day.value) || state.day || 1, count);
    day.replaceChildren();
    for (let d = 1; d <= count; d++) day.add(new Option(d + '일', String(d)));
    day.value = String(old); state.day = old;
  };
  month.addEventListener('change', updateDays); day.addEventListener('change', () => state.day = Number(day.value));
  updateDays(); day.value = '19'; state.day = 19;
}
async function start() {
  if (state.busy) return;
  error('', false); state.busy = true;
  $('#start').disabled = true; $('#start').textContent = 'NASA 사진 찾는 중…';
  try {
    const archive = await getBirthdayArchive();
    const photos = getBirthdayPhotos(archive, state.month, state.day);
    if (!photos.length) throw Error('선택한 날짜의 허블 자료에는 은하·성운·행성 사진이 없어요. 다른 날짜를 선택해 주세요.');
    state.photos = photos; state.photo = 0; state.layers = []; state.selected = null; state.ratio = 'photocard'; state.style = 'clean';
    $('#home').classList.add('hidden'); $('#studio').classList.remove('hidden');
    $('#birthday-label').textContent = state.month + '월 ' + state.day + '일';
    $('#clear-layers').disabled = false;
    renderRatios(); renderPhotos(); updateSelection(); choosePhoto(0); window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) { error(e.message || '연결 오류', false); }
  finally { state.busy = false; $('#start').disabled = false; $('#start').textContent = '내 생일의 우주 만나기 →'; }
}
function reset() {
  if ($('#promo-dialog').open) $('#promo-dialog').close();
  if ($('#cutout-dialog').open) $('#cutout-dialog').close();
  state.photos = []; state.layers = []; state.selected = null; state.bg = null; state.photo = 0; state.imageRequest++;
  $('#home').classList.remove('hidden'); $('#studio').classList.add('hidden');
  error(''); error('', false); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderPhotos() {
  const list = $('#photo-list'); list.replaceChildren();
  state.photos.forEach((p, i) => {
    const btn = el('button', { type: 'button', class: 'photo-option' + (state.photo === i ? ' active' : '') });
    const img = el('img', { src: p.image, loading: 'lazy', alt: p.name });
    const texts = el('span');
    texts.append(el('strong', {}, p.name), el('small', {}, p.observedYear ? '관측 ' + p.observedYear + '년' : '관측 연도 미상'));
    btn.append(img, texts); if (state.photo === i) btn.append(el('span', { class: 'check' }, '✓'));
    btn.addEventListener('click', () => choosePhoto(i)); list.append(btn);
  });
}
function choosePhoto(i) {
  state.photo = i; renderPhotos(); error('');
  const p = state.photos[i]; if (!p) return;
  const box = $('#nasa-info'); box.replaceChildren();
  const source = el('a', { href: /^https:\/\//.test(p.source) ? p.source : 'https://science.nasa.gov/mission/hubble/', target: '_blank', rel: 'noopener noreferrer' }, 'NASA 원본과 설명 보기 ↗');
  box.append(el('strong', {}, p.name), el('p', {}, p.description), source);
  const serial = ++state.imageRequest;
  state.bg = null; render();
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { if (serial === state.imageRequest) { state.bg = img; render(); } };
  img.onerror = () => { if (serial === state.imageRequest) error('이 사진을 가져오지 못했어요. 다른 사진을 선택해 주세요.'); };
  img.referrerPolicy = 'no-referrer'; img.src = p.image;
}
function renderRatios() {
  const parent = $('#ratios'); parent.replaceChildren();
  for (const [name, ratio] of Object.entries(ratios)) {
    const btn = el('button', { class: 'ratio-btn' + (name === state.ratio ? ' active' : '') });
    const symbol = el('span', { class: 'ratio-symbol' }); symbol.style.aspectRatio = ratio.w + '/' + ratio.h;
    btn.append(symbol, document.createTextNode(ratio.label.split(' · ')[0]));
    btn.onclick = () => { state.ratio = name; renderRatios(); render(); };
    parent.append(btn);
  }
}
function cardDraw(canvas, exportMode = false) {
  const { w, h } = ratios[state.ratio], factor = exportMode ? 4 : Math.max(1, Math.ceil(window.devicePixelRatio || 1));
  canvas.width = Math.round(w * factor); canvas.height = Math.round(h * factor);
  const ctx = canvas.getContext('2d'); ctx.setTransform(factor, 0, 0, factor, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#20264c'); grad.addColorStop(.55, '#161c3e'); grad.addColorStop(1, '#3d284f');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  if (state.bg?.complete && state.bg.naturalWidth) {
    const img = state.bg, s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    for (let i = 0; i < 120; i++) { ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${.17 + .1 * (i % 7)})`; ctx.arc((i * 151.17) % w, (i * 239.91) % h, i % 5 ? 1.2 : 2.2, 0, 2 * Math.PI); ctx.fill(); }
  }
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(7,12,31,.18)'); shade.addColorStop(.45, 'rgba(7,12,31,0)'); shade.addColorStop(1, 'rgba(7,12,31,.6)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  if (state.style === 'frame') {
    ctx.strokeStyle = 'rgba(255,255,255,.87)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, w - 48, h - 48);
  }
  for (const item of state.layers) {
    ctx.save(); ctx.translate(item.x * w, item.y * h); ctx.rotate(item.angle * Math.PI / 180);
    let bw = 180 * item.scale, bh = bw;
    if (item.kind === 'photo' && item.image?.naturalWidth) {
      const img = item.image, r = img.naturalWidth / img.naturalHeight;
      bw = (r >= 1 ? 225 : 225 * r) * item.scale; bh = (r >= 1 ? 225 / r : 225) * item.scale;
      ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
    } else if (item.kind === 'text') {
      const size = 46 * item.scale;
      ctx.font = '700 ' + size + 'px "Noto Sans KR", sans-serif'; ctx.fillStyle = item.color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#0009'; ctx.shadowBlur = 7; ctx.fillText(item.text || 'My universe', 0, 0, w * .83); ctx.shadowBlur = 0;
      bw = Math.min(ctx.measureText(item.text || 'My universe').width, w * .83); bh = size * 1.3;
    } else if (item.kind === 'sticker') {
      const size = 90 * item.scale; ctx.font = size + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.text || '✦', 0, 0); bw = bh = size;
    }
    if (!exportMode && state.selected === item.id) {
      ctx.strokeStyle = '#d6ceff'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 5]); ctx.strokeRect(-bw / 2 - 11, -bh / 2 - 11, bw + 22, bh + 22); ctx.setLineDash([]);
    }
    ctx.restore();
  }

}
function render() {
  cardDraw(card);
  const r = ratios[state.ratio]; card.style.aspectRatio = r.w + '/' + r.h;
  $('#ratio-label').textContent = r.label;
}
function addLayer(layer) {
  const item = { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2), x: .5, y: .56, scale: 1, angle: 0, ...layer };
  state.layers.push(item); state.selected = item.id;
  updateSelection(); render();
}
function activeLayer() { return state.layers.find((x) => x.id === state.selected) || null; }
function updateSelection() {
  const active = activeLayer();
  $('#layer-controls').classList.toggle('hidden', !active);
  $('#no-layer').classList.toggle('hidden', !!active);
  $('#delete-layer').disabled = !active;
  $('#open-cut').disabled = !active || active.kind !== 'photo';
  $('#text-edit-controls').classList.toggle('hidden', !active || active.kind !== 'text');
  if (active) {
    $('#scale').value = active.scale; $('#angle').value = active.angle;
    $('#scale-num').textContent = Math.round(active.scale * 100) + '%'; $('#angle-num').textContent = active.angle + '°';
    if (active.kind === 'text') { $('#edit-text').value = active.text || ''; paintPalette('#edit-colors', active.color, (c) => { active.color = c; updateSelection(); render(); }); }
  }
  render();
}
function pointerCoords(e, canvas = card) { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; }
card.addEventListener('pointerdown', (e) => {
  const { x, y } = pointerCoords(e), r = ratios[state.ratio];
  const hit = [...state.layers].reverse().find((layer) => {
    const dx = (x - layer.x) * r.w, dy = (y - layer.y) * r.h;
    const size = (layer.kind === 'photo' ? 150 : layer.kind === 'sticker' ? 60 : 170) * layer.scale;
    return Math.abs(dx) < size && Math.abs(dy) < size;
  });
  state.selected = hit?.id || null; dragId = hit?.id || null;
  if (dragId) card.setPointerCapture(e.pointerId);
  updateSelection();
});
card.addEventListener('pointermove', (e) => {
  if (!dragId) return;
  const item = state.layers.find((x) => x.id === dragId); if (!item) return;
  const { x, y } = pointerCoords(e);
  item.x = Math.max(0, Math.min(1, x)); item.y = Math.max(0, Math.min(1, y)); render();
});
card.addEventListener('pointerup', () => { dragId = null; });
card.addEventListener('pointercancel', () => { dragId = null; });
function paintPalette(selector, chosen, callback) {
  const node = $(selector); node.replaceChildren();
  colors.forEach((c) => {
    const button = el('button', { class: 'color-dot' + (c === chosen ? ' active' : ''), title: c, 'aria-label': '글자 색상 ' + c }); button.style.background = c;
    button.onclick = () => callback(c); node.append(button);
  });
}
function setTab(tab) {
  state.tab = tab;
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  ['text', 'photo', 'sticker'].forEach((t) => $('#tab-' + t).classList.toggle('hidden', t !== tab));
}
$$('.tabs button').forEach((button) => button.onclick = () => setTab(button.dataset.tab));
$('#add-text').onclick = () => addLayer({ kind: 'text', text: $('#text-input').value || 'My universe', color: state.newColor, scale: 1, y: .48 });
$('#stickers').replaceChildren(...stickerSymbols.map((symbol) => {
  const b = el('button', { title: symbol, 'aria-label': '스티커 ' + symbol }, symbol);
  b.onclick = () => addLayer({ kind: 'sticker', text: symbol, x: .4 + Math.random() * .2, y: .4 + Math.random() * .2 }); return b;
}));

$('#file').addEventListener('change', (e) => {
  const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12000000) { error('JPG/PNG/WEBP 12MB 이하 파일을 사용해 주세요.'); return; }
  const reader = new FileReader(); reader.onload = () => {
    const img = new Image(); img.onload = () => { error(''); addLayer({ kind: 'photo', image: img, y: .64, scale: 1.25 }); };
    img.onerror = () => error('이미지를 열 수 없어요. 다른 파일을 골라 주세요.'); img.src = String(reader.result);
  }; reader.readAsDataURL(file);
});
$('#scale').oninput = (e) => { const a = activeLayer(); if (!a) return; a.scale = Number(e.target.value); $('#scale-num').textContent = Math.round(a.scale * 100) + '%'; render(); };
$('#angle').oninput = (e) => { const a = activeLayer(); if (!a) return; a.angle = Number(e.target.value); $('#angle-num').textContent = a.angle + '°'; render(); };
$('#edit-text').oninput = (e) => { const a = activeLayer(); if (a?.kind === 'text') { a.text = e.target.value; render(); } };
$('#delete-layer').onclick = () => { state.layers = state.layers.filter((l) => l.id !== state.selected); state.selected = null; updateSelection(); };
$('#clear-select').onclick = () => { state.selected = null; updateSelection(); };
$('#clear-layers').onclick = () => { state.layers = []; state.selected = null; updateSelection(); };
$$('.style-options button').forEach((b) => b.onclick = () => { state.style = b.dataset.style; $$('.style-options button').forEach((x) => x.classList.toggle('active', x === b)); render(); });
function openCutout() {
  const item = activeLayer(); if (!item || item.kind !== 'photo' || !item.image) return;
  const image = item.image, scale = Math.min(1, 700 / Math.max(image.naturalWidth, image.naturalHeight));
  cutCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  cutCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = cutCanvas.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, cutCanvas.width, cutCanvas.height);
  context.drawImage(image, 0, 0, cutCanvas.width, cutCanvas.height);
  basePixels = context.getImageData(0, 0, cutCanvas.width, cutCanvas.height);
  setCutMode('erase'); $('#cutout-dialog').showModal();
}
function setCutMode(mode) {
  state.mode = mode;
  $('#erase-mode').className = mode === 'erase' ? 'primary' : 'secondary';
  $('#restore-mode').className = mode === 'restore' ? 'primary' : 'secondary';
}
function autoCut() {
  if (!basePixels) return;
  const ctx = cutCanvas.getContext('2d', { willReadFrequently: true });
  const im = ctx.getImageData(0, 0, cutCanvas.width, cutCanvas.height), d = im.data;
  const original = basePixels.data, w = im.width, h = im.height;
  const tolerance = Number($('#tolerance').value);
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => {
    const i = (y * w + x) * 4; return [original[i], original[i + 1], original[i + 2]];
  });
  const visited = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  function visit(index) {
    if (index < 0 || index >= w * h || visited[index]) return;
    visited[index] = 1;
    const i = index * 4;
    if (original[i + 3] < 10) return;
    const ok = corners.some(([r, g, b]) => Math.hypot(original[i] - r, original[i + 1] - g, original[i + 2] - b) < tolerance);
    if (ok) queue[tail++] = index;
  }
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1); }
  while (head < tail) {
    const at = queue[head++], x = at % w, y = (at / w) | 0;
    d[at * 4 + 3] = 0;
    if (x > 0) visit(at - 1);
    if (x < w - 1) visit(at + 1);
    if (y > 0) visit(at - w);
    if (y < h - 1) visit(at + w);
  }
  ctx.putImageData(im, 0, 0);
}
function brushAt(e) {
  if (!basePixels) return;
  const point = pointerCoords(e, cutCanvas), cx = Math.round(point.x * cutCanvas.width), cy = Math.round(point.y * cutCanvas.height);
  const radius = Number($('#brush').value), ctx = cutCanvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, cutCanvas.width, cutCanvas.height), d = image.data, original = basePixels.data;
  for (let y = Math.max(0, cy - radius); y < Math.min(cutCanvas.height, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x < Math.min(cutCanvas.width, cx + radius); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
      const index = (y * cutCanvas.width + x) * 4;
      if (state.mode === 'erase') d[index + 3] = 0;
      else { d[index] = original[index]; d[index + 1] = original[index + 1]; d[index + 2] = original[index + 2]; d[index + 3] = original[index + 3]; }
    }
  }
  ctx.putImageData(image, 0, 0);
}
cutCanvas.addEventListener('pointerdown', (e) => { painting = true; cutCanvas.setPointerCapture(e.pointerId); brushAt(e); });
cutCanvas.addEventListener('pointermove', (e) => { if (painting) brushAt(e); });
cutCanvas.addEventListener('pointerup', () => { painting = false; });
cutCanvas.addEventListener('pointercancel', () => { painting = false; });
$('#auto-cut').onclick = autoCut;
$('#erase-mode').onclick = () => setCutMode('erase');
$('#restore-mode').onclick = () => setCutMode('restore');
$('#brush').oninput = (e) => { $('#brush-label').textContent = e.target.value; };
$('#tolerance').oninput = (e) => { $('#tolerance-label').textContent = e.target.value; };
$('#reset-cut').onclick = () => { if (basePixels) cutCanvas.getContext('2d')?.putImageData(basePixels, 0, 0); };
$('#apply-cut').onclick = () => {
  const item = activeLayer(); if (!item || item.kind !== 'photo') return;
  const image = new Image();
  image.onload = () => { item.image = image; $('#cutout-dialog').close(); render(); };
  image.src = cutCanvas.toDataURL('image/png');
};
$('#open-cut').onclick = openCutout;
$('#close-cut').onclick = () => $('#cutout-dialog').close();

$('#save').onclick = async () => {
  error('');
  if (state.photos.length && !state.bg) { error('먼저 NASA 사진이 완전히 로딩됐는지 확인해 주세요.'); return; }
  try {
    await document.fonts.ready;
    const output = document.createElement('canvas'); cardDraw(output, true);
    const data = output.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = 'hubble-photocard-' + String(state.month).padStart(2, '0') + '-' + String(state.day).padStart(2, '0') + '.png';
    a.href = data; document.body.append(a); a.click(); a.remove();
    $('#promo-dialog').showModal();
  } catch (e) { error('파일 저장 실패: 외부 이미지 접근 권한 또는 브라우저 설정을 확인해 주세요.'); }
};
$('#close-promo').onclick = reset;
$('#promo-dialog').addEventListener('close', () => { if (!$('#home').classList.contains('hidden')) return; reset(); });
$('#brand').onclick = reset;
$('#change-date').onclick = reset;
$('#start').onclick = start;

function renderNewPalette() { paintPalette('#new-colors', state.newColor, (c) => { state.newColor = c; renderNewPalette(); }); }
renderNewPalette();
initDate();
