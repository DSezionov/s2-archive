/* =========================================================
   ДОС'Є ЗОНИ — логіка сайту
   Нічого тут міняти НЕ потрібно для наповнення контентом —
   увесь контент редагується у файлах всередині cards/NN/.
   Цей файл можна редагувати, тільки якщо треба змінити саму
   поведінку сайту (наприклад кількість карток).
   ========================================================= */

// TODO(config): якщо карток стане більше/менше 48 — поміняйте тут.
const CARD_COUNT = 48;

// Іконки категорій (SVG). Ключ має співпадати зі значенням "category" у meta.json.
const ICONS = {
  event: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--event)" stroke-width="1.6"><path d="M5 3v18M5 4h13l-3 4 3 4H5"/></svg>`,
  character: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--character)" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>`,
  faction: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--faction)" stroke-width="1.6"><path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5l8-3z"/></svg>`,
  research: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--research)" stroke-width="1.6"><circle cx="12" cy="12" r="2.4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2L19 19M19 5l-2.8 2.8M7.8 16.2L5 19"/></svg>`,
  // якщо category досі "TODO" (не заповнено) — покажемо нейтральну іконку-заглушку
  TODO: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--bone-dim)" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`
};
const CAT_LABELS = {
  event:'Подія', character:'Персонаж', faction:'Фракція', research:'Дослідження', TODO:'Без категорії'
};

function pad(n){ return String(n).padStart(2,'0'); }
function cardFolder(n){ return `cards/${pad(n)}/`; }

const grid = document.getElementById('grid');
const cardsCache = {}; // n -> meta object, щоб не тягнути meta.json повторно при відкритті модалки

async function loadMeta(n){
  if(cardsCache[n]) return cardsCache[n];
  try{
    const res = await fetch(cardFolder(n) + 'meta.json');
    const meta = await res.json();
    cardsCache[n] = meta;
    return meta;
  }catch(e){
    // якщо meta.json ще не заповнено/відсутній — не ламаємо сторінку
    const fallback = {title:'TODO: назва картки', category:'TODO', audio1_label:'TODO', audio2_label:'TODO'};
    cardsCache[n] = fallback;
    return fallback;
  }
}

async function buildGrid(){
  // рендеримо одразу всі 48 плиток із картинкою (вона завжди є),
  // а назву/категорію підвантажуємо і підставляємо, коли прийде meta.json
  for(let n=1; n<=CARD_COUNT; n++){
    const el = document.createElement('div');
    el.className = 'card-tile';
    el.dataset.num = n;
    el.innerHTML = `
      <img src="${cardFolder(n)}card.webp" alt="Картка №${pad(n)}" loading="lazy">
      <div class="tile-foot">
        <span class="tile-num">№${pad(n)}</span>
        <span class="tile-cat-icon" data-icon>${ICONS.TODO}</span>
      </div>`;
    el.addEventListener('click', () => openModal(n));
    grid.appendChild(el);

    loadMeta(n).then(meta=>{
      const icon = el.querySelector('[data-icon]');
      icon.innerHTML = ICONS[meta.category] || ICONS.TODO;
      el.title = meta.title && !meta.title.startsWith('TODO') ? meta.title : `Картка №${pad(n)}`;
    });
  }
}
buildGrid();

/* ---------- MODAL ---------- */
const overlay = document.getElementById('overlay');
const modalImg = document.getElementById('modalImg');
const modalCatIcon = document.getElementById('modalCatIcon');
const modalCatText = document.getElementById('modalCatText');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.getElementById('closeBtn');

// два незалежні аудіо-плеєри всередині попапа
const players = [1,2].map(i => ({
  idx:i,
  audio: new Audio(),
  playBtn: document.getElementById(`playBtn${i}`),
  wave: document.getElementById(`wave${i}`),
  time: document.getElementById(`time${i}`),
  noAudio: document.getElementById(`noAudio${i}`),
  titleEl: document.getElementById(`log${i}title`),
  textEl: document.getElementById(`log${i}text`),
}));

function fmtTime(s){
  if(!isFinite(s)) return '--:--';
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function buildBars(container){
  container.innerHTML = '';
  const BARS = 56;
  for(let i=0;i<BARS;i++){
    const s = document.createElement('span');
    // псевдо-хвиля для візуального ефекту (не є реальною амплітудою файлу)
    const h = 18 + Math.round(Math.sin(i*0.6)*8 + Math.abs(Math.sin(i*1.7))*22);
    s.style.height = Math.max(6,h) + '%';
    container.appendChild(s);
  }
}

function resetPlayer(p){
  p.audio.pause();
  p.audio.currentTime = 0;
  p.playBtn.textContent = '▶';
  p.playBtn.disabled = true;
  p.time.textContent = '00:00 / --:--';
  buildBars(p.wave);
  [...p.wave.children].forEach(b=>b.classList.remove('played'));
}

function wirePlayer(p, src){
  resetPlayer(p);
  p.noAudio.style.display = 'none';

  p.audio.src = src;
  p.audio.preload = 'metadata';

  p.audio.onloadedmetadata = () => {
    p.playBtn.disabled = false;
    p.time.textContent = `00:00 / ${fmtTime(p.audio.duration)}`;
  };
  p.audio.onerror = () => {
    // TODO: коли ви завантажите audio1.mp3 / audio2.mp3 у папку картки — ця помилка зникне сама,
    // плеєр стане активним без жодних правок коду.
    p.playBtn.disabled = true;
    p.noAudio.style.display = 'inline-block';
  };
  p.audio.ontimeupdate = () => {
    p.time.textContent = `${fmtTime(p.audio.currentTime)} / ${fmtTime(p.audio.duration)}`;
    const ratio = p.audio.currentTime / (p.audio.duration || 1);
    const bars = [...p.wave.children];
    const activeCount = Math.floor(bars.length * ratio);
    bars.forEach((b,i)=> b.classList.toggle('played', i < activeCount));
  };
  p.audio.onended = () => { p.playBtn.textContent = '▶'; };

  p.playBtn.onclick = () => {
    if(p.audio.paused){
      p.audio.play().catch(()=>{});
      p.playBtn.textContent = '❚❚';
    }else{
      p.audio.pause();
      p.playBtn.textContent = '▶';
    }
  };

  // одразу пробуємо завантажити, щоб дізнатись, чи файл існує
  p.audio.load();
}

async function loadTranscript(n, i, textEl){
  textEl.textContent = 'Завантаження…';
  textEl.classList.add('placeholder');
  try{
    const res = await fetch(`${cardFolder(n)}text${i}.txt`);
    if(!res.ok) throw new Error();
    const txt = await res.text();
    textEl.textContent = txt;
    textEl.classList.remove('placeholder');
  }catch(e){
    textEl.textContent = '[ транскрипцію ще не додано ]';
    textEl.classList.add('placeholder');
  }
}

async function openModal(n){
  const meta = await loadMeta(n);
  modalImg.src = cardFolder(n) + 'card.webp';
  modalImg.alt = meta.title || `Картка №${pad(n)}`;

  const cat = ICONS[meta.category] ? meta.category : 'TODO';
  modalCatIcon.innerHTML = ICONS[cat];
  modalCatText.textContent = CAT_LABELS[cat];

  modalTitle.textContent = (meta.title && !meta.title.startsWith('TODO'))
    ? meta.title
    : `Картка №${pad(n)}`;

  players.forEach((p, idx)=>{
    const i = idx+1;
    const label = meta[`audio${i}_label`];
    p.titleEl.textContent = (label && !label.startsWith('TODO')) ? label : `[ назва запису ${i} — плейсхолдер ]`;
    p.titleEl.classList.toggle('placeholder', !label || label.startsWith('TODO'));
    wirePlayer(p, `${cardFolder(n)}audio${i}.mp3`);
    loadTranscript(n, i, p.textEl);
  });

  overlay.classList.add('open');
}

function closeModal(){
  overlay.classList.remove('open');
  players.forEach(resetPlayer);
}
closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e=>{ if(e.target === overlay) closeModal(); });
document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeModal(); });
