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
const fontOptions = [
  {id:'sans',name:'깔끔체',family:'Noto Sans KR',weight:700},
  {id:'round',name:'둥근체',family:'Jua',weight:400},
  {id:'soft',name:'감성체',family:'Gowun Dodum',weight:400},
  {id:'hand',name:'손글씨',family:'Nanum Pen Script',weight:400},
  {id:'serif',name:'명조체',family:'Noto Serif KR',weight:600},
  {id:'bold',name:'포스터체',family:'Black Han Sans',weight:400},
  {id:'cute',name:'귀여운 글씨',family:'Gamja Flower',weight:400}
];
function getFont(id){return fontOptions.find(x=>x.id===id)||fontOptions[0];}
async function ensureFontsLoaded(){
  const fonts=[...new Set(state.layers.filter(l=>l.kind==='text').map(l=>l.font||'sans'))];
  await Promise.all(fonts.map(id=>{
    const f=getFont(id);
    return document.fonts.load(f.weight+' 46px "'+f.family+'"','김나예 사랑해 123 ABC').catch(()=>[]);
  }));
  render();
}
const stickerSymbols = ['✦','☾','☆','♡','🪐','✨','🌙','💜','🎀','🦋','⭐','☁️','🌸','🧸','💫','♥'];
const state = { month: 2, day: 12, photos: [], photo: 0, bg: null, ratio: 'photocard', style: 'clean', layers: [], selected: null, tab: 'text', newColor: '#ffffff', newFont: 'sans', busy: false, imageRequest: 0, mode: 'erase' };
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
let dragSession = null, alignmentGuides = null, painting = false, basePixels = null, cutBusy = false;
let undoStack = [], redoStack = [];
const MAX_HISTORY = 35;
function checkpoint() {
  undoStack.push({
    layers: state.layers.map(l => ({...l})), selected: state.selected,
    style: state.style, ratio: state.ratio
  });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}
function present() { return {layers:state.layers.map(l=>({...l})),selected:state.selected,style:state.style,ratio:state.ratio}; }
function restore(s) {
  state.layers=s.layers.map(l=>({...l}));state.selected=s.selected;
  state.style=s.style;state.ratio=s.ratio;
  alignmentGuides=null;dragSession=null;
  renderRatios();syncFrameButtons();updateSelection();
}
function undo() {
  if(!undoStack.length)return;
  redoStack.push(present());restore(undoStack.pop());updateHistoryButtons();showStatus('한 단계 되돌렸어요');
}
function redo() {
  if(!redoStack.length)return;
  undoStack.push(present());restore(redoStack.pop());updateHistoryButtons();showStatus('다시 적용했어요');
}
function updateHistoryButtons(){
  $('#history-undo').disabled=undoStack.length===0;
  $('#history-redo').disabled=redoStack.length===0;
}
function showStatus(text) {
  const status=$('#edit-status');if(status)status.textContent=text;
}
const error = (message, studio = true) => { $(studio ? '#studio-error' : '#home-error').textContent = message || ''; };
const el = (tag, attrs = {}, text) => { const node = document.createElement(tag); Object.entries(attrs).forEach(([key, value]) => { if (key === 'class') node.className = value; else node.setAttribute(key, value); }); if (text !== undefined) node.textContent = text; return node; };

function initDate() {
  const month = $('#month'), day = $('#day');
  for (let m = 1; m <= 12; m++) month.add(new Option(m + '월', String(m)));
  month.value = '2';
  const updateDays = () => {
    state.month = Number(month.value);
    const count = new Date(2024, state.month, 0).getDate();
    const old = Math.min(Number(day.value) || state.day || 1, count);
    day.replaceChildren();
    for (let d = 1; d <= count; d++) day.add(new Option(d + '일', String(d)));
    day.value = String(old); state.day = old;
  };
  month.addEventListener('change', updateDays); day.addEventListener('change', () => state.day = Number(day.value));
  updateDays(); day.value = '12'; state.day = 12;
}
async function start() {
  if (state.busy) return;
  error('', false); state.busy = true;
  $('#start').disabled = true; $('#start').textContent = 'NASA 사진 찾는 중…';
  try {
    const archive = await getBirthdayArchive();
    const photos = getBirthdayPhotos(archive, state.month, state.day);
    if (!photos.length) throw Error('선택한 날짜의 허블 자료에는 은하·성운·행성 사진이 없어요. 다른 날짜를 선택해 주세요.');
    state.photos = photos; state.photo = 0; state.layers = []; state.selected = null; state.ratio = 'photocard'; state.style = 'clean'; undoStack=[]; redoStack=[]; updateHistoryButtons();
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
  state.photos = []; state.layers = []; state.selected = null; state.bg = null; state.photo = 0; state.imageRequest++; undoStack=[];redoStack=[];alignmentGuides=null;dragSession=null;updateHistoryButtons();
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
  const strip=$('#mobile-photos');
  if(strip){
    strip.replaceChildren();
    state.photos.forEach((photo,i)=>{
      const b=el('button',{type:'button',class:'mobile-photo-btn'+(i===state.photo?' active':''),'aria-label':'배경 사진: '+photo.name,'aria-pressed':String(i===state.photo),title:photo.name});
      b.append(el('img',{src:photo.image,alt:photo.name,loading:'lazy'}));
      b.onclick=()=>choosePhoto(i);
      strip.append(b);
    });
  }
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
    btn.onclick = () => { if(state.ratio!==name){checkpoint();state.ratio=name;renderRatios();render();} };
    parent.append(btn);
  }
}
function cardDraw(canvas, exportMode = false, exportScale = 4) {
  const { w, h } = ratios[state.ratio], factor = exportMode ? exportScale : Math.max(1, Math.ceil(window.devicePixelRatio || 1));
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
      const chosenFont=getFont(item.font||'sans');
      ctx.font = chosenFont.weight+' '+size+'px "'+chosenFont.family+'", "Noto Sans KR", sans-serif'; ctx.fillStyle = item.color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#0009'; ctx.shadowBlur = 7; ctx.fillText(item.text || 'My universe', 0, 0, w * .83); ctx.shadowBlur = 0;
      bw = Math.min(ctx.measureText(item.text || 'My universe').width, w * .83); bh = size * 1.3;
    } else if (item.kind === 'sticker') {
      const size = 90 * item.scale; ctx.font = size + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.text || '✦', 0, 0); bw = bh = size;
    }
    if (!exportMode && state.selected === item.id) {
      const sx=-bw/2-12, sy=-bh/2-12, sw=bw+24, sh=bh+24;
      ctx.shadowBlur=0;ctx.strokeStyle='#ffffff';ctx.lineWidth=3;
      ctx.strokeRect(sx,sy,sw,sh);ctx.strokeStyle='#958dff';ctx.lineWidth=2;
      ctx.strokeRect(sx-2,sy-2,sw+4,sh+4);
      ctx.fillStyle='#fff';ctx.strokeStyle='#847dff';ctx.lineWidth=2;
      for(const [hx,hy] of [[sx,sy],[sx+sw,sy],[sx,sy+sh],[sx+sw,sy+sh]]){
        ctx.beginPath();ctx.arc(hx,hy,7,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (!exportMode && alignmentGuides) {
    ctx.save();ctx.setLineDash([10,7]);ctx.lineWidth=2;
    ctx.strokeStyle='#7ef7e4';ctx.shadowColor='#3cfff3';ctx.shadowBlur=8;
    if(alignmentGuides.x!==null){const x=alignmentGuides.x*w;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    if(alignmentGuides.y!==null){const y=alignmentGuides.y*h;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    ctx.restore();
  }
}
function render() {
  cardDraw(card);
  const r = ratios[state.ratio]; card.style.aspectRatio = r.w + '/' + r.h;
  $('#ratio-label').textContent = r.label;
}
function layerName(l) {
  return l.kind==='photo'?'📷 업로드한 사진':l.kind==='sticker'?'✦ 스티커 '+(l.text||''): 'T '+(l.text||'텍스트').slice(0,23);
}
function updateLayerList(){ /* 레이어 목록 대신 카드에서 바로 선택 */ }
function syncFrameButtons(){
  $$('.style-options button').forEach(b=>b.classList.toggle('active',b.dataset.style===state.style));
}
function updateSelection(){
  const active=activeLayer(),yes=!!active;
  $('#layer-controls').classList.toggle('hidden',!yes);
  $('#no-layer').classList.toggle('hidden',yes);
  $('#quick-actions').classList.toggle('hidden',!yes);
  $('#open-cut').disabled=!yes||active.kind!=='photo';
  $('#selected-name').textContent=yes?layerName(active):'요소를 선택해 주세요';
  if(active){
    $('#scale').value=active.scale;$('#angle').value=active.angle;
    $('#scale-num').textContent=Math.round(active.scale*100)+'%';
    $('#angle-num').textContent=active.angle+'°';
    if(active.kind==='text'){
      setTab('text');
      state.newColor=active.color||'#ffffff';
      state.newFont=active.font||'sans';
      $('#text-input').value=active.text||'';
    }else if(active.kind==='photo')setTab('photo');
    renderTextStyleControls();
  }else{
    renderTextStyleControls();
  }
  updateLayerList();updateHistoryButtons();render();
}
function activeLayer(){return state.layers.find(x=>x.id===state.selected)||null;}
function addLayer(layer) {
  checkpoint();
  const item={id:String(Date.now())+'-'+Math.random().toString(36).slice(2),x:.5,y:.5,scale:1,angle:0,...layer};
  state.layers.push(item);state.selected=item.id;updateSelection();
  showStatus('추가했어요! 카드를 드래그해 위치를 바꿔보세요.');
}
function removeSelected(){
  if(!activeLayer())return;
  checkpoint();state.layers=state.layers.filter(l=>l.id!==state.selected);
  state.selected=null;updateSelection();showStatus('삭제했어요 · ↶ 버튼으로 되돌릴 수 있어요');
}
function duplicateSelected(){
  const item=activeLayer();if(!item)return;
  checkpoint();const copy={...item,id:String(Date.now())+'-copy',x:Math.min(.95,item.x+.05),y:Math.min(.95,item.y+.05)};
  state.layers.push(copy);state.selected=copy.id;updateSelection();showStatus('복제했어요');
}
function centerSelected(axis='both'){
  const item=activeLayer();if(!item)return;
  checkpoint();if(axis==='both'||axis==='x')item.x=.5;
  if(axis==='both'||axis==='y')item.y=.5;
  updateSelection();showStatus('카드 중앙에 정렬했어요');
}
function shiftSelected(dx,dy){
  const item=activeLayer();if(!item)return;
  checkpoint();const size=ratios[state.ratio];
  item.x=Math.max(.01,Math.min(.99,item.x+dx/size.w));
  item.y=Math.max(.01,Math.min(.99,item.y+dy/size.h));
  render();
}
function reorderSelected(dir){
  const ix=state.layers.findIndex(l=>l.id===state.selected);
  if(ix<0||ix+dir<0||ix+dir>=state.layers.length)return;
  checkpoint();const [a]=state.layers.splice(ix,1);state.layers.splice(ix+dir,0,a);
  updateSelection();showStatus(dir>0?'앞으로 가져왔어요':'뒤로 보냈어요');
}
function pointerCoords(e,element=card){
  const b=element.getBoundingClientRect();return {x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height};
}
function hitTest(item, x, y){
  const r=ratios[state.ratio];let w=190*item.scale,h=70*item.scale;
  if(item.kind==='photo'&&item.image?.naturalWidth){
    const aspect=item.image.naturalWidth/item.image.naturalHeight;
    w=(aspect>=1?225:225*aspect)*item.scale;h=(aspect>=1?225/aspect:225)*item.scale;
  } else if(item.kind==='sticker'){w=h=90*item.scale;}
  else if(item.kind==='text'){w=Math.min(r.w*.83,(item.text||'텍스트').length*25*item.scale+30);h=58*item.scale;}
  const a=-item.angle*Math.PI/180,dx=(x-item.x)*r.w,dy=(y-item.y)*r.h;
  const rotatedX=dx*Math.cos(a)-dy*Math.sin(a),rotatedY=dx*Math.sin(a)+dy*Math.cos(a);
  return Math.abs(rotatedX)<w/2+15 && Math.abs(rotatedY)<h/2+15;
}
function snapValue(value,positions,threshold) {
  let best=value,snap=null,dist=threshold;
  for(const position of positions){let d=Math.abs(value-position);if(d<=dist){best=position;snap=position;dist=d;}}
  return {value:best, guide:snap};
}
function getSnappedPoint(item, x, y) {
  const b=card.getBoundingClientRect();
  x=Math.max(0.01,Math.min(.99,x));y=Math.max(.01,Math.min(.99,y));
  const other=state.layers.filter(l=>l.id!==item.id);
  const tx=[.5,.15,.85,...other.map(l=>l.x)];
  const ty=[.5,.15,.85,...other.map(l=>l.y)];
  const sx=snapValue(x,tx,12/b.width),sy=snapValue(y,ty,12/b.height);
  return {x:sx.value,y:sy.value,guides:{x:sx.guide,y:sy.guide}};
}
card.addEventListener('pointerdown',e=>{
  const pos=pointerCoords(e);
  const hit=[...state.layers].reverse().find(l=>hitTest(l,pos.x,pos.y));
  state.selected=hit?.id||null;
  if(hit){
    dragSession={id:hit.id,originalX:hit.x,originalY:hit.y,offsetX:pos.x-hit.x,offsetY:pos.y-hit.y,started:false,pointerId:e.pointerId};
    card.setPointerCapture(e.pointerId);
    card.focus();
  }
  updateSelection();
});
card.addEventListener('pointermove',e=>{
  if(!dragSession||dragSession.pointerId!==e.pointerId)return;
  const item=activeLayer();if(!item||item.id!==dragSession.id)return;
  const p=pointerCoords(e), proposedX=p.x-dragSession.offsetX,proposedY=p.y-dragSession.offsetY;
  const dx=(proposedX-dragSession.originalX)*card.getBoundingClientRect().width;
  const dy=(proposedY-dragSession.originalY)*card.getBoundingClientRect().height;
  if(!dragSession.started){
    if(Math.hypot(dx,dy)<3)return;
    checkpoint();dragSession.started=true;
  }
  const value=getSnappedPoint(item,proposedX,proposedY);
  item.x=value.x;item.y=value.y;alignmentGuides=value.guides;
  render();
});
function finishDrag(){
  if(!dragSession)return;
  const moved=dragSession.started;dragSession=null;alignmentGuides=null;
  render();if(moved)showStatus('위치를 옮겼어요 · ↶ 되돌리기 가능');
}
card.addEventListener('pointerup',finishDrag);
card.addEventListener('pointercancel',finishDrag);
card.addEventListener('lostpointercapture',finishDrag);
card.addEventListener('dblclick',()=>{
 const l=activeLayer();if(l?.kind==='text'){$('#text-input').focus();$('#text-input').select();}
});
function paintPalette(selector,chosen,callback){
  const node=$(selector);node.replaceChildren();
  colors.forEach(c=>{
    const b=el('button',{type:'button',class:'color-dot'+(c===chosen?' active':''),'aria-label':'글자 색상 '+c,'aria-pressed':String(c===chosen),title:c});
    b.style.background=c;b.onclick=()=>callback(c);node.append(b);
  });
}
function renderFontChoices(){
  const node=$('#font-list');node.replaceChildren();
  fontOptions.forEach(f=>{
    const b=el('button',{type:'button',class:'font-choice'+(state.newFont===f.id?' active':''),'aria-label':f.name+' 글꼴','aria-pressed':String(state.newFont===f.id)});
    b.style.fontFamily='"'+f.family+'", "Noto Sans KR", sans-serif';
    b.append(el('strong',{},'가나다'),el('small',{},f.name));
    b.onclick=()=>{
      const a=activeLayer();
      if(a?.kind==='text'){if(a.font!==f.id){checkpoint();a.font=f.id;}}
      state.newFont=f.id;renderTextStyleControls();render();
      document.fonts.load(f.weight+' 46px "'+f.family+'"','한글 가나다 ABC').then(()=>render()).catch(()=>{});
    };
    node.append(b);
  });
}
function renderTextStyleControls(){
  const active=activeLayer(),editing=active?.kind==='text';
  $('#text-mode-note').textContent=editing?'선택한 글자를 바로 수정하고 있어요':'새 글자에 적용할 스타일을 골라주세요';
  $('#add-text').textContent=editing?'＋ 새 글자 추가':'＋ 글자 추가';
  $('#new-custom-color').value=state.newColor;
  paintPalette('#new-colors',state.newColor,c=>{
    const a=activeLayer();
    if(a?.kind==='text'){checkpoint();a.color=c;}
    state.newColor=c;renderTextStyleControls();render();
  });
  renderFontChoices();
}
function setTab(tab){
  state.tab=tab;
  $$('.tabs button').forEach(b=>{
    const is=b.dataset.tab===tab;
    b.classList.toggle('active',is);b.setAttribute('aria-selected',String(is));
  });
  ['text','photo','sticker'].forEach(t=>$('#tab-'+t).classList.toggle('hidden',t!==tab));
}
$$('.tabs button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$('#text-input').addEventListener('focus',()=>{
  if(activeLayer()?.kind==='text')checkpoint();
});
$('#text-input').addEventListener('input',e=>{
  const a=activeLayer();
  if(a?.kind==='text'){a.text=e.target.value;render();}
});
$('#add-text').onclick=()=>{
  addLayer({kind:'text',text:$('#text-input').value||'My universe',color:state.newColor,font:state.newFont,scale:1,y:.35});
  showStatus('글자가 추가됐어요. 움직이려면 카드 위 글자를 드래그하세요.');
};
$('#stickers').replaceChildren(...stickerSymbols.map(symbol=>{
  const b=el('button',{title:symbol,'aria-label':'스티커 '+symbol},symbol);
  b.onclick=()=>addLayer({kind:'sticker',text:symbol,x:.5,y:.5});
  return b;
}));
$('#file').addEventListener('change',e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12000000){error('JPG/PNG/WEBP 12MB 이하 파일을 사용해 주세요.');return;}
  const reader=new FileReader();reader.onload=()=>{
    const img=new Image();img.onload=()=>{
      error('');addLayer({kind:'photo',image:img,y:.57,scale:1.25});
      showStatus('사진이 추가됐어요 · 누끼가 필요하면 오른쪽 버튼을 눌러보세요.');
    };img.onerror=()=>error('이미지를 열 수 없어요. 다른 파일을 골라 주세요.');
    img.src=String(reader.result);
  };reader.readAsDataURL(file);
});
$('#scale').addEventListener('pointerdown',()=>{if(activeLayer())checkpoint();});
$('#angle').addEventListener('pointerdown',()=>{if(activeLayer())checkpoint();});
$('#scale').addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key))checkpoint();});
$('#angle').addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key))checkpoint();});
$('#scale').oninput=e=>{const l=activeLayer();if(!l)return;l.scale=Number(e.target.value);$('#scale-num').textContent=Math.round(l.scale*100)+'%';render();};
$('#angle').oninput=e=>{const l=activeLayer();if(!l)return;l.angle=Number(e.target.value);$('#angle-num').textContent=l.angle+'°';render();};
$('#new-custom-color').addEventListener('input',e=>{
  const a=activeLayer();
  if(a?.kind==='text')a.color=e.target.value;
  state.newColor=e.target.value;
  renderTextStyleControls();render();
});
$('#new-custom-color').addEventListener('change',()=>{
  const a=activeLayer();if(a?.kind==='text')showStatus('글자 색을 변경했어요');
});
$('#history-undo').onclick=undo;$('#history-redo').onclick=redo;
$('#delete-quick').onclick=removeSelected;
$('#duplicate-quick').onclick=duplicateSelected;
$('#center-quick').onclick=()=>centerSelected('both');









$('#clear-select').onclick=()=>{state.selected=null;updateSelection();};
$('#clear-layers').onclick=()=>{
 if(!state.layers.length)return;
 if(!confirm('꾸민 요소를 모두 삭제할까요? (되돌릴 수 있어요)'))return;
 checkpoint();state.layers=[];state.selected=null;updateSelection();
};
$$('.style-options button').forEach(b=>b.onclick=()=>{
 if(state.style===b.dataset.style)return;
 checkpoint();state.style=b.dataset.style;syncFrameButtons();render();
});
document.addEventListener('keydown',e=>{
 const tag=document.activeElement?.tagName?.toLowerCase();
 const isEditing=tag==='input'||tag==='textarea'||tag==='select'||document.activeElement?.isContentEditable;
 if(!isEditing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
 if(!isEditing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
 if($('#studio').classList.contains('hidden')||isEditing)return;
 if(e.key==='Escape'&&state.selected){state.selected=null;updateSelection();return;}
 if((e.key==='Delete'||e.key==='Backspace')&&state.selected){e.preventDefault();removeSelected();return;}
 const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(directions[e.key]&&activeLayer()){e.preventDefault();let [dx,dy]=directions[e.key];shiftSelected(dx*(e.shiftKey?10:1),dy*(e.shiftKey?10:1));}
});
function openCutout() {
  const item = activeLayer(); if (!item || item.kind !== 'photo' || !item.image) return;
  const image = item.image, scale = Math.min(1, 1700 / Math.max(image.naturalWidth, image.naturalHeight));
  cutCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  cutCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = cutCanvas.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, cutCanvas.width, cutCanvas.height);
  context.drawImage(image, 0, 0, cutCanvas.width, cutCanvas.height);
  basePixels = context.getImageData(0, 0, cutCanvas.width, cutCanvas.height);
  cutBusy=false;setCutMode('erase');$('#auto-cut').textContent='✨ AI 자동 누끼';$('#cut-status').textContent='✨ AI 누끼를 누르면 사람·사물의 윤곽을 인식해 배경을 제거해요.';$('#cutout-dialog').showModal();
}
function setCutMode(mode) {
  state.mode = mode;
  $('#erase-mode').className = mode === 'erase' ? 'primary' : 'secondary';
  $('#restore-mode').className = mode === 'restore' ? 'primary' : 'secondary';
}
async function autoCut() {
  if(!basePixels||cutBusy)return;
  cutBusy=true;
  const startId=state.selected;
  const button=$('#auto-cut'),status=$('#cut-status');
  button.disabled=true;button.textContent='⏳ AI 누끼 처리 중…';
  $('#apply-cut').disabled=true;
  status.textContent='AI 모델 준비 중… 처음 실행 시 큰 모델 파일을 받아 시간이 걸릴 수 있어요.';
  try {
    const canvas=document.createElement('canvas');
    canvas.width=cutCanvas.width;canvas.height=cutCanvas.height;
    canvas.getContext('2d',{willReadFrequently:true}).putImageData(basePixels,0,0);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('이미지 인코딩 실패')),'image/png'));
    // IMG.LY IS-Net (AGPL-3.0): 실제 이미지 전경 분할 모델. 모든 처리는 브라우저에서 실행.
    const mod=await import('https://esm.sh/@imgly/background-removal@1.7.0?bundle&target=es2022');
    const removeBackground=mod.default||mod.removeBackground;
    if(typeof removeBackground!=='function')throw new Error('AI 엔진을 불러오지 못했어요.');
    let last='';
    const foreground=await removeBackground(blob,{
      model:'isnet_fp16',device:'cpu',
      output:{format:'image/png',type:'foreground'},
      progress:(key,current,total)=>{
        const progress=total>0?' '+Math.round(current/total*100)+'%':'';
        const message=key.startsWith('fetch')?'AI 모델 다운로드':key.startsWith('compute')?'인물·사물 윤곽 처리':'AI 누끼 준비';
        const value=message+progress;
        if(value!==last){last=value;status.textContent=value+' · 사진은 기기 밖으로 업로드되지 않아요.';}
      }
    });
    if(state.selected!==startId||!$('#cutout-dialog').open)throw new Error('편집 중인 사진이 변경되었어요.');
    const bitmap=await createImageBitmap(foreground);
    const context=cutCanvas.getContext('2d',{willReadFrequently:true});
    context.clearRect(0,0,cutCanvas.width,cutCanvas.height);
    context.drawImage(bitmap,0,0,cutCanvas.width,cutCanvas.height);
    bitmap.close?.();
    status.textContent='✅ AI 누끼 완료! 가장자리를 지우개·복원으로 다듬은 후 적용해 주세요.';
  }catch(err){
    status.textContent='⚠️ AI 누끼를 완료하지 못했어요. 인터넷 연결과 브라우저를 확인하거나 수동 지우개를 사용해 주세요. ('+(err instanceof Error?err.message:'모델 오류')+')';
    console.error('AI cutout error',err);
  }finally{
    cutBusy=false;button.disabled=false;button.textContent='✨ AI 자동 누끼 다시 실행';
    $('#apply-cut').disabled=false;
  }
}
function brushAt(e) {
  if (!basePixels||cutBusy) return;
  const point = pointerCoords(e, cutCanvas), cx = Math.round(point.x * cutCanvas.width), cy = Math.round(point.y * cutCanvas.height);
  const radius = Number($('#brush').value), ctx = cutCanvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, cutCanvas.width, cutCanvas.height), d = image.data, original = basePixels.data;
  for (let y = Math.max(0, cy - radius); y < Math.min(cutCanvas.height, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x < Math.min(cutCanvas.width, cx + radius); x++) {
      const distance=Math.hypot(x-cx,y-cy);if(distance>radius)continue;
      const softness=Math.max(0,Math.min(1,(radius-distance)/Math.max(3,radius*.20)));
      const strength=softness*.9;
      const index=(y*cutCanvas.width+x)*4;
      if(state.mode==='erase')d[index+3]=Math.round(d[index+3]*(1-strength));
      else {
        d[index]=original[index];d[index+1]=original[index+1];d[index+2]=original[index+2];
        d[index+3]=Math.min(255,Math.round(d[index+3]+(original[index+3]-d[index+3])*strength));
      }
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

$('#reset-cut').onclick = () => { if (basePixels) cutCanvas.getContext('2d')?.putImageData(basePixels, 0, 0); };
$('#apply-cut').onclick = () => {
  const item = activeLayer(); if (!item || item.kind !== 'photo' || cutBusy) return;
  const image = new Image();
  image.onload = () => { checkpoint(); item.image = image; $('#cutout-dialog').close(); render(); };
  image.src = cutCanvas.toDataURL('image/png');
};
$('#open-cut').onclick = openCutout;
$('#close-cut').onclick = () => {if(!cutBusy)$('#cutout-dialog').close();};


function cardFileName(suffix=''){
  const month=String(state.month).padStart(2,'0');
  const day=String(state.day).padStart(2,'0');
  const safeSuffix=String(suffix).replace(/[^0-9a-zA-Z가-힣_-]/g,'-').slice(0,50);
  return 'hubble-photocard-'+month+'-'+day+(safeSuffix?'-'+safeSuffix:'')+'.png';
}
function clickToDownload(url,filename){
  const a=document.createElement('a');
  a.download=filename;a.href=url;
  document.body.append(a);a.click();a.remove();
}
async function exportCardBlob(scale=2){
  if(state.photos.length&&!state.bg)throw Error('먼저 NASA 사진이 완전히 로딩됐는지 확인해 주세요.');
  await ensureFontsLoaded();
  await document.fonts.ready;
  const canvas=document.createElement('canvas');
  cardDraw(canvas,true,scale);
  return new Promise((resolve,reject)=>
    canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 이미지 생성에 실패했어요.')),'image/png'));
}
$('#save').onclick=async()=>{
  const button=$('#save');button.disabled=true;
  error('');
  try{
    const blob=await exportCardBlob(4);
    const link=URL.createObjectURL(blob);
    clickToDownload(link,cardFileName());
    setTimeout(()=>URL.revokeObjectURL(link),30000);
    $('#promo-dialog').showModal();
  }catch(e){error('사진 저장 실패: '+(e instanceof Error?e.message:'브라우저 권한을 확인해 주세요.'))}
  finally{button.disabled=false;}
};
// Submissions are confirmed only after both private Storage upload and validated RPC succeed.
// The participant gets the same completed PNG downloaded locally after the request succeeds.
let printerClient=null,printBusy=false,printDownloadUrl=null,printDownloadName='';
async function getPrintClient(){
  const c=window.PRINT_CONFIG||{};
  if(!c.supabaseUrl||!c.supabaseAnonKey)throw Error('인쇄 접수 서버가 연결되지 않았어요.');
  if(!printerClient){
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.58.0');
    printerClient=createClient(c.supabaseUrl,c.supabaseAnonKey,{
      auth:{storageKey:'orbit-print-participant',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
  }
  return printerClient;
}
function printMessage(msg,isError=false){
  const el=$('#print-msg');
  el.textContent=msg;
  el.classList.toggle('err',isError);
}
$('#request-print').onclick=()=>{
  printMessage('');
  $('#print-fields').hidden=false;
  $('#print-success').hidden=true;
  $('#print-dialog').showModal();
  if(!window.PRINT_CONFIG?.supabaseUrl||!window.PRINT_CONFIG?.supabaseAnonKey)
    printMessage('현재 인쇄 접수 서버가 연결되지 않았어요.',true);
};
$('#print-cancel').onclick=()=>{
  if(!printBusy)$('#print-dialog').close();
};
$('#print-dialog').addEventListener('cancel',e=>{if(printBusy)e.preventDefault()});
$('#print-dialog').addEventListener('close',()=>{
  if(printDownloadUrl){URL.revokeObjectURL(printDownloadUrl);printDownloadUrl=null;}
});
$('#print-download-again').onclick=()=>{
  if(printDownloadUrl)clickToDownload(printDownloadUrl,printDownloadName);
};
$('#print-finish').onclick=()=>{
  $('#print-dialog').close();
  $('#promo-dialog').showModal();
};
$('#print-send').onclick=async()=>{
  if(printBusy)return;
  const studentNumber=$('#print-student-number').value.trim();
  const studentName=$('#print-student-name').value.trim();
  if(!/^[0-9]{4,8}$/.test(studentNumber)){
    printMessage('학번을 숫자 4~8자리로 입력해 주세요. (예: 20313)',true);
    return;
  }
  if(studentName.length<1||studentName.length>24){
    printMessage('이름을 1~24자로 입력해 주세요.',true);
    return;
  }
  if(!$('#print-agree').checked){
    printMessage('학번·이름·포토카드 전송 안내에 동의해 주세요.',true);
    return;
  }
  if(!state.bg||!state.photos.length){
    printMessage('먼저 허블 사진이 완전히 로딩되어야 해요.',true);
    return;
  }
  const button=$('#print-send');
  printBusy=true;button.disabled=true;$('#print-cancel').disabled=true;
  let submitted=false;
  try{
    printMessage('포토카드를 준비하는 중…');
    const sb=await getPrintClient();
    const {data:{user:existing},error:userError}=await sb.auth.getUser();
    let uid=!userError&&existing?.is_anonymous===true?existing.id:null;
    if(!uid){
      printMessage('비공개 접수 연결 중…');
      const {data,error}=await sb.auth.signInAnonymously();
      if(error)throw error;
      uid=data?.user?.id;
    }
    if(!uid)throw Error('인쇄 접수 세션을 만들지 못했어요.');
    const png=await exportCardBlob(2); // 1080 x 1720 px for basic 54 x 86 mm card
    if(png.size>10485760)throw Error('인쇄 이미지가 10MB를 초과했어요. 사진 크기를 줄여주세요.');
    if(png.size<1024)throw Error('PNG 데이터가 비어 있어요.');
    const path=uid+'/'+crypto.randomUUID()+'.png';
    printMessage('사진을 인쇄 담당자에게 전송 중…');
    const {error:uploadError}=await sb.storage.from('print-cards').upload(path,png,{
      contentType:'image/png',upsert:false,cacheControl:'0'
    });
    if(uploadError)throw uploadError;
    printMessage('학번·이름과 인쇄 접수를 등록하는 중…');
    const {data:orderId,error:orderError}=await sb.rpc('submit_print_order_with_student',{
      p_file_path:path,
      p_student_number:studentNumber,
      p_student_name:studentName,
      p_month:state.month,
      p_day:state.day,
      p_ratio:state.ratio
    });
    if(orderError)throw orderError;
    if(!orderId)throw Error('접수 번호를 받지 못했어요.');
    submitted=true;
    $('#print-fields').hidden=true;
    $('#print-success').hidden=false;
    $('#print-receipt').textContent='학번 '+studentNumber+' · 이름 '+studentName+' · 접수번호 '+String(orderId).slice(0,8);
    $('#print-agree').checked=false;
    $('#print-student-number').value='';
    $('#print-student-name').value='';
    if(printDownloadUrl)URL.revokeObjectURL(printDownloadUrl);
    printDownloadUrl=URL.createObjectURL(png);
    printDownloadName=cardFileName(studentNumber+'-'+studentName);
    try{
      clickToDownload(printDownloadUrl,printDownloadName);
      $('#print-success-note').textContent='인쇄 요청이 접수됐고, 포토카드 PNG 저장을 시작했어요. 다운로드가 보이지 않으면 아래 버튼을 눌러 주세요.';
    }catch(e){
      $('#print-success-note').textContent='인쇄 접수는 완료됐어요. 아래 PNG 저장 버튼을 눌러 사진도 저장해 주세요.';
    }
  }catch(e){
    if(!submitted)printMessage('인쇄 접수 실패: '+(e instanceof Error?e.message:'연결 오류')+'\n접수 완료 화면이 나타나지 않았다면 다시 확인해 주세요.',true);
  }finally{
    printBusy=false;button.disabled=false;$('#print-cancel').disabled=false;
  }
};

$('#close-promo').onclick = reset;
$('#promo-dialog').addEventListener('close', () => { if (!$('#home').classList.contains('hidden')) return; reset(); });
$('#brand').onclick = reset;
$('#change-date').onclick = reset;
$('#start').onclick = start;

renderTextStyleControls();
updateHistoryButtons();
initDate();
