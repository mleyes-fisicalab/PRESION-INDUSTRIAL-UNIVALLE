
/* ====================================================================
   Motor del libro: BOOK_DATA + goToPage
   ==================================================================== */
const PAGES = $$('.page');
const BOOK_DATA = PAGES.map((el, i) => ({ i, id: el.id, title: el.dataset.title, sec: el.dataset.sec, el }));
const MOUNT = {};
let cur = -1;
const mounted = new Set(), typed = new Set();
let mjChain = Promise.resolve();
function typeset(el) {
  if (typed.has(el.id) || !(window.MathJax && MathJax.typesetPromise)) return;
  typed.add(el.id);
  mjChain = mjChain.then(() => MathJax.typesetPromise([el])).catch(err => console.warn('MathJax', err));
}
window.__onMathJax = () => { if (cur >= 0) typeset(BOOK_DATA[cur].el); };

function buildToc() {
  const toc = $('#toc'); let last = '';
  BOOK_DATA.forEach(p => {
    if (p.sec !== last) { const h = document.createElement('h4'); h.textContent = p.sec; toc.appendChild(h); last = p.sec; }
    const b = document.createElement('button'); b.dataset.i = p.i;
    b.innerHTML = `<span>${String(p.i + 1).padStart(2, '0')}</span>${p.title}`;
    b.onclick = () => goToPage(p.i); toc.appendChild(b);
  });
  const route = $('#route'), seen = new Set();
  BOOK_DATA.forEach(p => { if (seen.has(p.sec) || p.i === 0) return; seen.add(p.sec);
    const b = document.createElement('button'); b.innerHTML = `<small>${p.sec}</small>${p.title}`; b.onclick = () => goToPage(p.i); route.appendChild(b); });
}
function goToPage(i, push = true) {
  i = clamp(i, 0, BOOK_DATA.length - 1); const p = BOOK_DATA[i];
  BOOK_DATA.forEach(q => q.el.hidden = q.i !== i);
  cur = i;
  $('#secName').textContent = p.sec; $('#pageName').textContent = p.title;
  $('#count').textContent = `${i + 1} / ${BOOK_DATA.length}`;
  $('#prog').style.width = ((i + 1) / BOOK_DATA.length * 100) + '%';
  $$('#toc button').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  const on = $('#toc button.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  $('#prevBtn').disabled = i === 0; $('#nextBtn').disabled = i === BOOK_DATA.length - 1;
  const pv = BOOK_DATA[i - 1], nx = BOOK_DATA[i + 1];
  $('#pager').innerHTML = (pv ? `<button class="pv" data-go="${i - 1}"><small>Anterior</small><span>${pv.title}</span></button>` : '') + (nx ? `<button class="nx" data-go="${i + 1}"><small>Siguiente</small><span>${nx.title}</span></button>` : '');
  store.set('page', i);
  if (push) try { history.replaceState(null, '', '#' + p.id); } catch (e) {}
  window.scrollTo(0, 0);
  if (!mounted.has(p.id)) { mounted.add(p.id); try { MOUNT[p.id] && MOUNT[p.id](p.el); } catch (err) { console.error(p.id, err); } }
  typeset(p.el);
  closeDrawer();
}
function openDrawer() { $('#side').classList.add('open'); $('#scrim').hidden = false; }
function closeDrawer() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }

function initTheme() {
  const t = store.get('theme', null); if (t) document.documentElement.setAttribute('data-theme', t);
  $('#themeBtn').onclick = () => {
    const now = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = now === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', nx); store.set('theme', nx); redrawAll();
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redrawAll);
}

/* ---------- utilidades de interfaz ---------- */
function seg(id, cb) { const el = $(id); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v ?? b.dataset.t); }); return () => $('button.on', el)?.dataset.v; }
const nc = s => String(s).replace(/([\u0370-\u03ffµ]+)/g, '<span class="nc">$1</span>');
function kpis(el, items) { el.innerHTML = items.map(k => `<div class="kpi ${k.c || ''}"><small>${nc(k.l)}</small><b>${k.v}${k.u ? `<i>${k.u}</i>` : ''}</b></div>`).join(''); }
function bindOut(inp, out, f) { const u = () => $(out).textContent = f(+$(inp).value); $(inp).addEventListener('input', u); u(); }


function makeLab(o) {
  let rows = store.get('lab:' + o.key, []), Tb = null, until = 0, last = null, lastSp = null, dir = 'asc';
  const el = $('#' + o.key);
  const P = o.p, spEl = $('#' + P + '-sp');
  const settle = () => { const v = +spEl.value; if (lastSp != null) { if (v > lastSp) dir = 'asc'; else if (v < lastSp) dir = 'desc'; } lastSp = v; Tb = v + noise(o.bathSd); until = Date.now() + 1600; };
  bindOut('#' + P + '-sp', '#' + P + '-spo', o.fmt || (v => v + ' °C'));
  spEl.addEventListener('input', settle); settle(); until = Date.now() + 700;
  const tick = () => {
    if (el.hidden) return; const b = getBench();
    if (!b) { $('#' + P + '-st').textContent = 'Sin banco asignado'; o.d.forEach(d => $('#' + d).textContent = '—'); return; }
    const settling = Date.now() < until; $('#' + P + '-st').textContent = settling ? 'Estabilizando…' : 'Estable · listo para registrar';
    const T = settling ? Tb + (Math.random() - .5) * (o.jit ?? 3) * (until - Date.now()) / 1600 : Tb;
    last = o.read(b, T, dir); if (o.dirEl) $(o.dirEl).textContent = dir === 'asc' ? 'Carga ascendente ↑' : 'Carga descendente ↓'; o.disp(last).forEach((s, i) => $('#' + o.d[i]).textContent = s);
  };
  setInterval(tick, 420); tick();
  const render = () => {
    $('#' + P + '-tb').innerHTML = rows.length ? rows.map((r, i) => `<tr><td class="num">${i + 1}</td>${o.cells(r).map(c => `<td class="num">${c}</td>`).join('')}<td><button class="btn sm" data-del="${i}" aria-label="Borrar lectura ${i + 1}">Quitar</button></td></tr>`).join('')
      : `<tr><td colspan="${o.ncol + 2}" class="muted">Aún no hay lecturas. Necesitas al menos ${o.min}.</td></tr>`;
  };
  $('#' + P + '-tb').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; rows.splice(+b.dataset.del, 1); store.set('lab:' + o.key, rows); render(); });
  $('#' + P + '-rec').onclick = () => {
    if (!getBench()) { toast('Primero asigna tu banco en «Ingreso al laboratorio».'); return; }
    if (Date.now() < until) { toast(o.waitMsg || 'Espera a que la lectura se estabilice.'); return; } tick();
    rows.push({ ...last }); if (o.sort !== false) rows.sort(o.sort || ((a, b) => a.T - b.T)); store.set('lab:' + o.key, rows); render();
  };
  $('#' + P + '-clr').onclick = () => { if (!rows.length) return; const b = $('#' + P + '-clr'); if (b.dataset.sure) { rows = []; store.set('lab:' + o.key, rows); render(); $('#' + P + '-res').innerHTML = ''; b.textContent = 'Borrar tabla'; delete b.dataset.sure; } else { b.dataset.sure = 1; b.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { b.textContent = 'Borrar tabla'; delete b.dataset.sure; }, 3000); } };
  $('#' + P + '-an').onclick = () => {
    if (rows.length < o.min) { toast(`Necesitas al menos ${o.min} lecturas; llevas ${rows.length}.`); return; }
    if (o.check) { const msg = o.check(rows); if (msg) { toast(msg); return; } }
    const A = o.analyze(rows), box = $('#' + P + '-res');
    box.innerHTML = `<h3>Resultados del análisis</h3><div class="kpis">${A.kpis.map(k => `<div class="kpi ${k.c || ''}"><small>${nc(k.l)}</small><b>${k.v}${k.u ? `<i>${k.u}</i>` : ''}</b></div>`).join('')}</div>
      <div class="tbl"><table><thead><tr>${A.head.map(h => `<th class="num">${nc(h)}</th>`).join('')}</tr></thead><tbody>${A.body.map(r => `<tr>${r.map(c => `<td class="num">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${A.plots.map((_, i) => `<div id="${P}-pl${i}" style="margin-top:14px"></div>`).join('')}`;
    A.plots.forEach((pc, i) => { const pl = new Plane($(`#${P}-pl${i}`), pc.o); pl.set(pc.layers); });
  };
  const ta = $('#' + P + '-txt'); ta.value = store.get('txt:' + o.key, ''); ta.addEventListener('input', () => store.set('txt:' + o.key, ta.value));
  render();
  if (rows.length >= o.min && !(o.check && o.check(rows))) $('#' + P + '-an').click();
}



/* ====================================================================
   Dibujos dinámicos: carátula, tanque, manómetro en U, referencias, diafragma
   ==================================================================== */
const rad = d => d * Math.PI / 180;
function dialSVG(o) {
  const cx = 150, cy = 150, R = 124, A = v => rad(-135 + 270 * clamp(v, -0.04 * o.max, 1.04 * o.max) / o.max);
  const pt = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const arc = (r, v1, v2) => { const [x1, y1] = pt(r, A(v1)), [x2, y2] = pt(r, A(v2)), big = (A(v2) - A(v1)) > Math.PI ? 1 : 0; return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${big} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  let s = `<svg viewBox="0 0 300 290" role="img" aria-label="${o.aria || 'Carátula del manómetro'}">`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R + 12}" fill="var(--panel-solid)" stroke="var(--line-strong)" stroke-width="3"/>`;
  (o.zones || []).forEach(z => { s += `<path d="${arc(R - 6, z.from, z.to)}" fill="none" stroke="${z.color}" stroke-width="9" opacity=".85"/>`; });
  for (let v = 0; v <= o.max + 1e-9; v += o.minor) { const maj = Math.abs(v / o.step - Math.round(v / o.step)) < 1e-6, [x1, y1] = pt(R - (maj ? 18 : 12), A(v)), [x2, y2] = pt(R - 2, A(v));
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--fg)" stroke-width="${maj ? 2 : 1}"/>`;
    if (maj) { const [tx, ty] = pt(R - 34, A(v)); s += `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" class="svgtxt" style="font-size:12px;fill:var(--fg)">${fmt(v, o.dec || 0)}</text>`; } }
  s += `<text x="${cx}" y="${cy + 46}" text-anchor="middle" class="svglab">${o.unit}</text>`;
  if (o.sub) s += `<text x="${cx}" y="${cy + 60}" text-anchor="middle" class="svgtxt">${o.sub}</text>`;
  const [nx, ny] = pt(R - 16, A(o.value)), [bx, by] = pt(-22, A(o.value));
  s += `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--gold)" stroke-width="3.4" stroke-linecap="round"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="9" fill="var(--gold)"/><circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--panel-solid)"/>`;
  if (o.readout) s += `<text x="${cx}" y="276" text-anchor="middle" class="svglab" style="font-family:var(--f-mono)">${o.readout}</text>`;
  return s + '</svg>';
}

function tankSVG(o) {
  // o: {H (m, nivel), Hmax, yPoint (profundidad), label, gas (kPa), color, tx: {d, wet, Hw}, column}
  const W = 440, Hs = 300, x0 = o.column ? 170 : 110, tw = o.column ? 70 : 190, top = 30, bot = 250, hp = bot - top;
  const sc = hp / o.Hmax, lvl = bot - o.H * sc;
  let s = `<svg viewBox="0 0 ${W} ${Hs}" role="img" aria-label="${o.aria || 'Tanque'}">`;
  s += `<rect x="${x0}" y="${top}" width="${tw}" height="${hp}" fill="var(--glass)" stroke="var(--fg-2)" stroke-width="2.5"/>`;
  if (o.gas > 0) s += `<rect x="${x0 + 1}" y="${top + 1}" width="${tw - 2}" height="${Math.max(0, lvl - top - 1)}" fill="var(--c-ref)" opacity=".12"/><text x="${x0 + tw / 2}" y="${top + 18}" text-anchor="middle" class="svgtxt">gas a ${fmt(o.gas, 0)} kPa</text>`;
  s += `<rect x="${x0 + 1.5}" y="${lvl}" width="${tw - 3}" height="${bot - lvl}" fill="${o.color || 'var(--c-a)'}" opacity=".32"/>`;
  s += `<line x1="${x0 + 1.5}" y1="${lvl}" x2="${x0 + tw - 1.5}" y2="${lvl}" stroke="${o.color || 'var(--c-a)'}" stroke-width="2"/>`;
  // regla
  const step = o.Hmax <= 1.5 ? 0.1 : o.Hmax <= 4 ? 0.5 : 1;
  for (let v = 0; v <= o.Hmax + 1e-9; v += step) { const y = bot - v * sc; s += `<line x1="${x0 - 10}" y1="${y}" x2="${x0}" y2="${y}" stroke="var(--fg-2)"/><text x="${x0 - 14}" y="${y + 4}" text-anchor="end" class="svgtxt">${fmt(v, step < 1 ? 1 : 0)}</text>`; }
  s += `<text x="${x0 - 14}" y="${top - 10}" text-anchor="end" class="svgtxt">m</text>`;
  s += `<text x="${x0 + tw + 10}" y="${lvl + 4}" class="svglab">h = ${fmt(o.H, o.Hmax <= 1.5 ? 3 : 2)} m</text>`;
  if (o.yPoint != null) { const yp = lvl + o.yPoint * sc; s += `<circle cx="${x0 + tw / 2}" cy="${yp}" r="6" fill="var(--gold)"/><line x1="${x0 + tw / 2 + 8}" y1="${yp}" x2="${x0 + tw + 8}" y2="${yp}" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${x0 + tw + 12}" y="${yp + 18}" class="svglab" style="fill:var(--gold)">${o.label || ''}</text>`; }
  if (o.tx) { // transmisor de nivel bajo el tanque
    const d = o.tx.d * sc, ty = bot + Math.min(d, 40), tx = x0 + tw + 40;
    s += `<path d="M${x0 + tw} ${bot - 8}H${tx}V${ty}" fill="none" stroke="${o.color || 'var(--c-a)'}" stroke-width="5" opacity=".55"/>`;
    s += `<rect x="${tx - 22}" y="${ty - 2}" width="44" height="22" rx="4" fill="var(--panel-solid)" stroke="var(--gold)" stroke-width="2"/><text x="${tx}" y="${ty + 13}" text-anchor="middle" class="svgtxt" style="fill:var(--gold);font-weight:700">LT</text>`;
    if (o.tx.wet) { s += `<path d="M${tx + 22} ${ty + 9}H${tx + 46}V${top + 6}H${x0 + tw}" fill="none" stroke="${o.color || 'var(--c-a)'}" stroke-width="5" opacity=".55"/><text x="${tx + 52}" y="${top + 40}" class="svgtxt">pierna</text><text x="${tx + 52}" y="${top + 54}" class="svgtxt">húmeda</text>`; }
    else s += `<text x="${tx + 28}" y="${ty + 13}" class="svgtxt">baja: atm.</text>`;
    if (o.tx.d > 0) s += `<text x="${tx - 30}" y="${bot + 16}" text-anchor="end" class="svgtxt">d</text>`;
  }
  return s + '</svg>';
}

function uTubeSVG(o) {
  // o: {h (mm), L (mm), theta (°), color}
  const W = 440, H = 300, y0 = 170, lx = 90, sc = 120 / Math.max(10, o.theta >= 89.5 ? o.h : o.L);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Manómetro en U">`;
  const col = o.color || 'var(--c-a)';
  if (o.theta >= 89.5) {
    const rx = 200, hp = o.h * sc;
    s += `<path d="M${lx} 30V240a55 55 0 0 0 110 0V30" fill="none" stroke="var(--fg-2)" stroke-width="20"/><path d="M${lx} 30V240a55 55 0 0 0 110 0V30" fill="none" stroke="var(--panel-solid)" stroke-width="15"/>`;
    s += `<path d="M${lx} ${y0 + hp / 2}V240a55 55 0 0 0 110 0V${y0 - hp / 2}" fill="none" stroke="${col}" stroke-width="15" opacity=".7"/>`;
    s += `<line x1="${lx - 30}" y1="${y0}" x2="${rx + 40}" y2="${y0}" stroke="var(--tick)" stroke-dasharray="4 4"/><text x="${rx + 44}" y="${y0 + 4}" class="svgtxt">cero</text>`;
    s += `<line x1="${rx + 24}" y1="${y0 + hp / 2}" x2="${rx + 24}" y2="${y0 - hp / 2}" stroke="var(--gold)" stroke-width="2"/><text x="${rx + 32}" y="${y0 - 8}" class="svglab" style="fill:var(--gold)">Δh = ${fmt(o.h, 1)} mm</text>`;
  } else {
    const a = rad(o.theta), Lp = o.L * sc, x1 = lx + 60, y1 = 240, Lt = 300;
    s += `<rect x="${lx - 40}" y="90" width="80" height="150" rx="6" fill="none" stroke="var(--fg-2)" stroke-width="3"/><rect x="${lx - 38}" y="${y0}" width="76" height="${238 - y0}" fill="${col}" opacity=".45"/>`;
    s += `<path d="M${lx + 40} ${y1 - 6}H${x1}" stroke="${col}" stroke-width="8" opacity=".6"/>`;
    const ex = x1 + Lt * Math.cos(a), ey = y1 - Lt * Math.sin(a);
    s += `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="var(--fg-2)" stroke-width="12" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="var(--panel-solid)" stroke-width="7" stroke-linecap="round"/>`;
    const L0 = (y1 - y0) / Math.sin(a), Lend = Math.min(Lt, L0 + Lp);
    s += `<line x1="${x1}" y1="${y1}" x2="${x1 + Lend * Math.cos(a)}" y2="${y1 - Lend * Math.sin(a)}" stroke="${col}" stroke-width="7" stroke-linecap="round" opacity=".75"/>`;
    s += `<text x="${x1 + 20}" y="${y1 + 22}" class="svgtxt">θ = ${o.theta}°</text>`;
    s += `<text x="${Math.min(W - 120, x1 + Lend * Math.cos(a))}" y="${y1 - Lend * Math.sin(a) - 14}" class="svglab" style="fill:var(--gold)">L = ${fmt(o.L, 1)} mm</text>`;
    s += `<text x="${lx}" y="80" text-anchor="middle" class="svgtxt">depósito</text>`;
  }
  return s + `<text x="20" y="${H - 10}" class="svgtxt">escala del dibujo: ${fmt(sc, sc < 1 ? 2 : 1)} px/mm</text></svg>`;
}

function refSVG(o) {
  // o: {patm, pabs} en kPa
  const W = 440, H = 300, base = 260, top = 24, max = Math.max(o.patm * 1.5, o.pabs * 1.12), Y = v => base - (base - top) * v / max;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Referencias de presión">`;
  s += `<rect x="150" y="${Y(o.patm)}" width="150" height="${base - Y(o.patm)}" fill="var(--c-a)" opacity=".10"/>`;
  s += `<line x1="40" y1="${base}" x2="400" y2="${base}" stroke="var(--fg)" stroke-width="2.4"/><text x="400" y="${base + 20}" text-anchor="end" class="svglab">0 kPa absolutos</text>`;
  s += `<line x1="40" y1="${Y(o.patm)}" x2="400" y2="${Y(o.patm)}" stroke="var(--gold)" stroke-width="2" stroke-dasharray="7 5"/><text x="400" y="${Y(o.patm) - 6}" text-anchor="end" class="svglab" style="fill:var(--gold)">P atm = ${fmt(o.patm, 2)} kPa</text>`;
  const yp = Y(Math.max(0, o.pabs)), man = o.pabs - o.patm;
  s += `<line x1="110" y1="${base}" x2="110" y2="${yp + 6}" stroke="var(--fg)" stroke-width="2"/><text x="102" y="${(base + yp) / 2}" text-anchor="end" class="svgtxt">abs</text><text x="102" y="${(base + yp) / 2 + 14}" text-anchor="end" class="svgtxt">${fmt(o.pabs, 2)}</text>`;
  s += `<line x1="225" y1="${Y(o.patm)}" x2="225" y2="${yp}" stroke="${man >= 0 ? 'var(--c-a)' : 'var(--c-c)'}" stroke-width="2.4"/><text x="234" y="${(Y(o.patm) + yp) / 2 + 4}" class="svgtxt" style="fill:${man >= 0 ? 'var(--c-a)' : 'var(--c-c)'}">${man >= 0 ? 'manométrica' : 'vacío'} ${fmt(Math.abs(man), 2)}</text>`;
  s += `<circle cx="225" cy="${yp}" r="7" fill="var(--gold)"/>`;
  return s + '</svg>';
}

function diafSVG(o) {
  // o: {w0, t, a} en m; dibuja corte exagerado
  const W = 520, H = 190, cx = 260, R = 190, ty = 70, th = Math.max(5, Math.min(22, o.t / o.a * 260)), amp = o.w0 > 0 ? Math.min(60, 12 + 480 * o.w0 / o.t) : 0, pts = [];
  for (let i = 0; i <= 60; i++) { const x = -R + 2 * R * i / 60, r = x / R, w = amp * Math.pow(1 - r * r, 2); pts.push([cx + x, ty + w]); }
  const top = pts.map(p => p.join(',')).join(' '), bot = pts.slice().reverse().map(p => `${p[0]},${p[1] + th}`).join(' ');
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Deflexión del diafragma">`;
  s += `<rect x="20" y="${ty - 20}" width="${cx - R - 20}" height="${th + 40}" fill="var(--tick)" opacity=".5"/><rect x="${cx + R}" y="${ty - 20}" width="${W - 20 - cx - R}" height="${th + 40}" fill="var(--tick)" opacity=".5"/>`;
  s += `<polygon points="${top} ${bot}" fill="var(--c-ref)" opacity=".28" stroke="var(--fg-2)" stroke-width="1.2"/>`;
  s += `<line x1="${cx - R}" y1="${ty}" x2="${cx + R}" y2="${ty}" stroke="var(--tick)" stroke-dasharray="4 4"/>`;
  s += `<rect x="${cx - 22}" y="${ty + amp + th - 2}" width="44" height="6" rx="2" fill="var(--c-b)"/><rect x="${cx - R + 6}" y="${ty + th - 1}" width="36" height="6" rx="2" fill="var(--c-a)"/><rect x="${cx + R - 42}" y="${ty + th - 1}" width="36" height="6" rx="2" fill="var(--c-a)"/>`;
  s += `<text x="${cx}" y="${ty + amp + th + 24}" text-anchor="middle" class="svgtxt" style="fill:var(--c-b)">centro: +ε (R1, R3)</text><text x="${cx - R + 6}" y="${ty + th + 22}" class="svgtxt" style="fill:var(--c-a)">borde: −2ε (R2, R4)</text><text x="${cx}" y="${ty - 8}" text-anchor="middle" class="svgtxt">↓ presión</text>`;
  s += `<text x="${cx}" y="22" text-anchor="middle" class="svgtxt">deflexión dibujada exagerada · w₀ = ${fmt(o.w0 * 1e6, 2)} µm</text>`;
  return s + '</svg>';
}

/* ====================================================================
   I · Cadena de medición y selección de rango
   ==================================================================== */
MOUNT.cadena = () => {
  const desc = [
    'El proceso: vapor en una línea de distribución. La presión manométrica es la variable de proceso (PV) que se quiere conocer y controlar.',
    'Elemento primario PE: el diafragma se deforma y las galgas en puente completo dan 2 mV por voltio de excitación a 1000 kPa.',
    'Con 10 V de excitación el puente entrega de 0 a 20 mV; un amplificador de instrumentación con ganancia 250 lleva la señal a 0–5 V.',
    'El transmisor PT escala la medición calibrada de 0 a 1000 kPa a 4–20 mA. La corriente no se degrada con la resistencia del cable.',
    'El indicador-controlador PIC recibe la corriente, la convierte a kPa y a bar, la muestra y la compara con el punto de consigna.'
  ];
  const up = () => {
    const p = +$('#ch-T').value, vo = 2 * 10 * p / 1000, va = vo * 250 / 1000, I = 4 + 16 * p / 1000;
    $('#ch-To').textContent = fmt(p, 0) + ' kPa';
    $('#ch-v0').innerHTML = `${fmt(p, 0)}<i> kPa</i>`;
    $('#ch-v1').innerHTML = `${fmt(vo / 10, 3)}<i> mV/V</i>`;
    $('#ch-v2').innerHTML = `${fmt(vo, 2)}<i> mV</i> → ${fmt(va, 2)}<i> V</i>`;
    $('#ch-v3').innerHTML = `${fmt(I, 2)}<i> mA</i>`;
    $('#ch-v4').innerHTML = `${fmt((I - 4) / 16 * 1000, 0)}<i> kPa</i> · ${fmt((I - 4) / 16 * 10, 2)}<i> bar</i>`;
  };
  const show = i => { $$('#chain .node').forEach((n, k) => n.classList.toggle('on', k === i)); $('#ch-desc').textContent = desc[i]; };
  $('#chain').addEventListener('click', e => { const n = e.target.closest('.node'); if (n) show(+n.dataset.i); });
  $('#ch-T').addEventListener('input', up); up(); show(0);
};

MOUNT.caract = () => {
  const STEPS = { 1: [0.2, 0.05], 1.6: [0.2, 0.05], 2.5: [0.5, 0.1], 4: [0.5, 0.1], 6: [1, 0.2], 10: [1, 0.2], 16: [2, 0.5], 25: [5, 1], 40: [5, 1] };
  const up = () => {
    const p = +$('#se-p').value, r = +$('#se-r').value, c = +$('#se-c').value, pul = $('#se-pul').checked, lim = pul ? 2 / 3 : 3 / 4;
    $('#se-po').textContent = fmt(p, 1) + ' bar';
    const frac = p / r, err = c / 100 * r * 100, rel = err / (p * 100) * 100;
    let st, cl, msg;
    if (frac > 1) { st = 'Fuera de escala'; cl = 'bad'; msg = 'La presión de trabajo supera el rango: el manómetro se daña. Elige un rango mayor.'; }
    else if (frac > lim) { st = 'Rango pequeño'; cl = 'bad'; msg = `Trabaja al ${fmt(frac * 100, 0)} % de la escala; con carga ${pul ? 'pulsante' : 'estable'} el límite es ${pul ? '66' : '75'} %. El tubo se fatiga.`; }
    else if (frac < 0.25) { st = 'Rango grande'; cl = 'warn'; msg = `Trabaja al ${fmt(frac * 100, 0)} % de la escala. El error relativo en la lectura sube a ${fmt(rel, 1)} %.`; }
    else { st = 'Selección adecuada'; cl = 'ok'; msg = `Trabaja al ${fmt(frac * 100, 0)} % de la escala, dentro de la zona recomendada.`; }
    kpis($('#se-k'), [{ l: '% de la escala', v: fmt(frac * 100, 0), u: '%' }, { l: 'Error admisible', v: '±' + fmt(err, err < 10 ? 1 : 0), u: 'kPa' }, { l: 'Error relativo', v: '±' + fmt(rel, 2), u: '%' }, { l: 'Evaluación', v: st, c: cl }]);
    const [step, minor] = STEPS[r];
    $('#se-dial').innerHTML = dialSVG({ max: r, step, minor, unit: 'bar', sub: `clase ${fmt(c, 1)}`, value: p, dec: step < 1 ? 1 : 0,
      zones: [{ from: 0.25 * r, to: lim * r, color: 'var(--ok)' }, { from: lim * r, to: r, color: 'var(--bad)' }], readout: fmt(p, 2) + ' bar' });
    $('#se-msg').textContent = msg;
  };
  ['#se-p', '#se-r', '#se-c', '#se-pul'].forEach(s => $(s).addEventListener('input', up)); $('#se-pul').addEventListener('change', up); up();
};

/* ====================================================================
   II · Conversor y referencias
   ==================================================================== */
MOUNT.simtipos = () => {
  let ref = 'man';
  $('#u-u').innerHTML = UNITS.map(u => `<option value="${u.k}" ${u.k === 'kPa' ? 'selected' : ''}>${u.k}</option>`).join('');
  $('#u-cities').innerHTML = CIUDADES.map(([c, h]) => `<button class="btn sm" data-h="${h}">${c}</button>`).join('');
  const pl = new Plane($('#u-plot'), { xmin: -150, xmax: 3400, ymin: 62, ymax: 106, xlabel: 'altitud (m)', ylabel: 'P atm (kPa)', title: 'Atmósfera estándar ISA', xd: 0, yd: 2 });
  const up = () => {
    const h = +$('#u-h').value, patm = patmAlt(h) / 1000, uk = $('#u-u').value, v = num($('#u-v').value);
    $('#u-ho').textContent = fmt(h, 0) + ' m';
    if (!isFinite(v)) { kpis($('#u-k'), [{ l: 'Lectura', v: 'Escribe un número', c: 'bad' }]); return; }
    const kPa = v * unitF(uk) / 1000, pabs = ref === 'man' ? patm + kPa : ref === 'abs' ? kPa : patm - kPa, man = pabs - patm;
    const bad = pabs < 0;
    kpis($('#u-k'), [{ l: 'P atm local', v: fmt(patm, 2), u: 'kPa' }, { l: 'Absoluta', v: bad ? 'imposible' : fmt(pabs, 2), u: bad ? '' : 'kPa', c: bad ? 'bad' : '' },
      { l: man >= 0 ? 'Manométrica' : 'Vacío', v: fmt(Math.abs(man), 2), u: 'kPa' }, { l: man >= 0 ? 'Sobre la atmósfera' : 'Del vacío perfecto', v: fmt(man >= 0 ? man / patm * 100 : (1 - pabs / patm) * 100, 1), u: '%' }]);
    if (bad) { $('#u-ref-svg').innerHTML = '<div class="empty">La presión absoluta no puede ser negativa: revisa la lectura y la referencia.</div>'; $('#u-tab').innerHTML = ''; }
    else {
      $('#u-ref-svg').innerHTML = refSVG({ patm, pabs });
      $('#u-tab').innerHTML = UNITS.map(u => `<tr><td><strong>${u.k}</strong></td><td>${u.n}</td><td class="num">${fmt(pabs * 1000 / u.f, u.d)}</td><td class="num">${fmt(man * 1000 / u.f, u.d)}</td></tr>`).join('');
    }
    pl.set([
      { id: 'isa', type: 'fn', label: 'P atm (ISA)', color: 'var(--c-a)', width: 2.6, fn: x => patmAlt(x) / 1000, dom: [0, 5000] },
      { id: 'c', type: 'scatter', label: 'Ciudades', color: 'var(--c-ref)', pts: CIUDADES.map(([, hh]) => [hh, patmAlt(hh) / 1000]) },
      { id: 'p', type: 'point', x: h, y: patm, color: 'var(--gold)', tag: `${fmt(patm, 2)} kPa` }
    ]);
  };
  seg('#u-ref', v => { ref = v; up(); });
  ['#u-v', '#u-h'].forEach(s => $(s).addEventListener('input', up)); $('#u-u').addEventListener('change', up);
  $('#u-cities').addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) { $('#u-h').value = b.dataset.h; up(); } });
  up();
};

/* ====================================================================
   III · Hidrostática
   ==================================================================== */
const USO = { agua: 'Calderas, tratamiento de aguas', aceite: 'Sistemas hidráulicos', etilenglicol: 'Refrigerantes, anticongelantes', salmuera: 'Refrigeración industrial, alimentos', glicerina: 'Cosmética, farmacéutica', mercurio: 'Manómetros y barómetros de laboratorio', rojo: 'Manómetros de tiro y ventilación' };
MOUNT.hidro = () => {
  $('#h-dens').innerHTML = ['aceite', 'rojo', 'agua', 'etilenglicol', 'salmuera', 'glicerina', 'mercurio'].map(k => `<tr><td>${FLUIDOS[k].n}</td><td class="num">${fmt(FLUIDOS[k].rho, 1)}</td><td class="num">${fmt(FLUIDOS[k].rho * G_LOCAL / 1000, 3)}</td><td>${USO[k]}</td></tr>`).join('');
};
const LIQ_COL = { aceite: 'var(--c-b)', agua: 'var(--c-a)', etilenglicol: 'var(--c-c)', salmuera: 'var(--c-ref)', glicerina: 'var(--gold)', mercurio: 'var(--tick)' };
MOUNT.simhidro = () => {
  const opts = ['agua', 'aceite', 'etilenglicol', 'salmuera', 'glicerina', 'mercurio'];
  $('#hd-f').innerHTML = opts.map(k => `<option value="${k}">${FLUIDOS[k].n} · ${fmt(FLUIDOS[k].rho, 0)} kg/m³</option>`).join('');
  const pl = new Plane($('#hd-plot'), { xmin: -0.4, xmax: 10.5, ymin: -5, ymax: 130, xlabel: 'profundidad (m)', ylabel: 'P man (kPa)', title: 'Presión frente a la profundidad', xd: 2, yd: 2 });
  const patm = patmAlt(917) / 1000;
  let lastF = null;
  const up = () => {
    const f = $('#hd-f').value, rho = FLUIDOS[f].rho, H = +$('#hd-H').value, y = H * $('#hd-y').value / 100, p0 = +$('#hd-p0').value;
    $('#hd-Ho').textContent = fmt(H, 2) + ' m'; $('#hd-yo').textContent = fmt(y, 2) + ' m'; $('#hd-p0o').textContent = p0 ? fmt(p0, 0) + ' kPa' : 'tanque abierto';
    const P = p0 + rho * G_LOCAL * y / 1000, Pf = p0 + rho * G_LOCAL * H / 1000;
    kpis($('#hd-k'), [{ l: 'P man en el punto', v: fmt(P, 2), u: 'kPa' }, { l: 'P abs en el punto', v: fmt(P + patm, 2), u: 'kPa' }, { l: 'P man en el fondo', v: fmt(Pf, 2), u: 'kPa' },
      { l: 'Columna equivalente', v: fmt(P * 1000 / (998.2 * G_LOCAL), 2), u: 'm H₂O' }, { l: 'En mercurio', v: fmt(P * 1000 / (13546 * G_LOCAL) * 1000, 0), u: 'mm Hg' }, { l: 'Gradiente', v: fmt(rho * G_LOCAL / 1000, 3), u: 'kPa/m' }]);
    $('#hd-tank').innerHTML = tankSVG({ H, Hmax: 10, yPoint: y, label: fmt(P, 1) + ' kPa', gas: p0, color: LIQ_COL[f], aria: 'Tanque con líquido' });
    if (f !== lastF) { lastF = f; const mx = Math.max(130, p0 + rho * G_LOCAL * 10 / 1000 * 1.05); pl.setHome({ xmin: -0.4, xmax: 10.5, ymin: -mx * 0.04, ymax: mx }); }
    const L = opts.filter(k => k !== 'mercurio' || f === 'mercurio').map(k => ({ id: k, type: 'fn', label: FLUIDOS[k].n, color: LIQ_COL[k], width: k === f ? 2.8 : 1.4, dash: k === f ? 'solid' : 'dash', fn: d => p0 + FLUIDOS[k].rho * G_LOCAL * d / 1000, dom: [0, H] }));
    L.push({ id: 'pt', type: 'point', x: y, y: P, color: 'var(--gold)', tag: fmt(P, 2) + ' kPa' });
    pl.set(L);
  };
  ['#hd-H', '#hd-y', '#hd-p0'].forEach(s => $(s).addEventListener('input', up)); $('#hd-f').addEventListener('change', up); up();
  // ---- manómetro en U ----
  let mf = 'aire';
  const uu = () => {
    const rm = FLUIDOS[$('#mu-m').value].rho, rf = FLUIDOS[mf].rho, dp = +$('#mu-dp').value, th = +$('#mu-th').value;
    $('#mu-dpo').textContent = fmt(dp, 0) + ' Pa'; $('#mu-tho').textContent = th >= 90 ? '90° (tubo en U)' : th + '°';
    if (rm <= rf) { kpis($('#mu-k'), [{ l: 'Configuración', v: 'El líquido manométrico debe ser más denso que el fluido', c: 'bad' }]); $('#mu-svg').innerHTML = ''; return; }
    const h = dp / ((rm - rf) * G_LOCAL) * 1000, L = h / Math.sin(rad(th));
    kpis($('#mu-k'), [{ l: 'Desnivel vertical Δh', v: fmt(h, 2), u: 'mm' }, { l: 'Longitud leída L', v: fmt(L, 2), u: 'mm' }, { l: 'Amplificación', v: fmt(1 / Math.sin(rad(th)), 2), u: '×' }, { l: 'Sensibilidad', v: fmt(L / Math.max(dp, 1), 4), u: 'mm/Pa' }]);
    $('#mu-svg').innerHTML = uTubeSVG({ h, L, theta: th, color: $('#mu-m').value === 'rojo' ? 'var(--bad)' : $('#mu-m').value === 'mercurio' ? 'var(--tick)' : 'var(--c-a)' });
  };
  seg('#mu-f', v => { mf = v; uu(); }); ['#mu-dp', '#mu-th'].forEach(s => $(s).addEventListener('input', uu)); $('#mu-m').addEventListener('change', uu); uu();
};


/* ====================================================================
   IV · Transductores
   ==================================================================== */
MOUNT.simdiaf = () => {
  $('#df-m').innerHTML = Object.entries(MATERIALES).map(([k, m]) => `<option value="${k}">${m.n} · E = ${fmt(m.E / 1e9, 0)} GPa</option>`).join('');
  const pl = new Plane($('#df-plot'), { xmin: -150, xmax: 5200, ymin: -2, ymax: 30, xlabel: 'P (kPa)', ylabel: 'Vo (mV)', title: 'Salida del puente', xd: 0, yd: 3 });
  const up = () => {
    const P = +$('#df-P').value * 1000, mat = MATERIALES[$('#df-m').value], a = +$('#df-a').value / 1000, t = +$('#df-t').value / 1000, GF = +$('#df-gf').value, V = +$('#df-v').value;
    $('#df-Po').textContent = fmt(P / 1000, 0) + ' kPa'; $('#df-ao').textContent = fmt(a * 1000, 1) + ' mm'; $('#df-to').textContent = fmt(t * 1000, 2) + ' mm'; $('#df-gfo').textContent = fmt(GF, 2); $('#df-vo').textContent = fmt(V, 1) + ' V';
    const D = diafragma(P, a, t, mat, GF, V), u = diafragma(1000, a, t, mat, GF, V);
    const Plin = (t / 4) / u.w0 * 1000 / 1000, Plim = (2 / 3) * mat.sy * 4 * t * t / (3 * a * a) / 1000, wt = D.w0 / t * 100, fsy = mat.sy / Math.max(D.sigE, 1);
    kpis($('#df-k'), [{ l: 'ε centro', v: fmt(D.epsC * 1e6, 1), u: 'µε' }, { l: 'ε borde', v: fmt(D.epsE * 1e6, 1), u: 'µε' }, { l: 'Deflexión w₀', v: fmt(D.w0 * 1e6, 2), u: 'µm' },
      { l: 'w₀ / t', v: fmt(wt, 1), u: '%', c: wt > 25 ? 'bad' : wt > 15 ? 'warn' : 'ok' }, { l: 'Esfuerzo en el borde', v: fmt(D.sigE / 1e6, 0), u: 'MPa' },
      { l: 'Factor de seguridad', v: fmt(fsy, 2), c: fsy < 1.5 ? 'bad' : 'ok' }, { l: 'Salida Vo', v: fmt(D.Vo * 1000, 3), u: 'mV' }, { l: 'Sensibilidad', v: fmt(D.mVV, 3), u: 'mV/V' }]);
    $('#df-svg').innerHTML = diafSVG({ w0: D.w0, t, a });
    const Vk = p => diafragma(p * 1000, a, t, mat, GF, V).Vo * 1000, ymax = Math.max(1, Vk(5000) * 1.08);
    pl.setHome({ xmin: -150, xmax: 5200, ymin: -ymax * 0.05, ymax });
    const L = [{ id: 'vo', type: 'fn', label: 'Vo lineal (placa delgada)', color: 'var(--c-a)', width: 2.6, fn: Vk, dom: [0, 5000] }];
    if (Plin < 5000) L.push({ id: 'lin', type: 'vline', x: Plin, color: 'var(--warn)', tag: 'w₀ = t/4', label: 'Límite de linealidad', noLegend: true });
    if (Plim < 5000) L.push({ id: 'lim', type: 'vline', x: Plim, color: 'var(--bad)', tag: 'σ = ⅔ σy', label: 'Límite de esfuerzo', noLegend: true });
    L.push({ id: 'p', type: 'point', x: P / 1000, y: D.Vo * 1000, color: 'var(--gold)', tag: fmt(D.Vo * 1000, 2) + ' mV' });
    pl.set(L);
  };
  ['#df-P', '#df-a', '#df-t', '#df-gf', '#df-v'].forEach(s => $(s).addEventListener('input', up)); $('#df-m').addEventListener('change', up); up();
};

MOUNT.simpiezo = () => {
  let sk = '5700AP', ref = 'rat';
  const pl = new Plane($('#pz-plot'), { xmin: -20, xmax: 740, ymin: -0.2, ymax: 5.4, xlabel: 'P (kPa)', ylabel: 'Vout (V)', title: 'Salida del sensor', xd: 1, yd: 4 });
  const setRange = () => { const s = MPX[sk], el = $('#pz-P'); el.min = s.lo; el.max = s.hi; el.step = sk === '5700AP' ? 1 : 0.05; el.value = (s.lo + s.hi) / 2;
    const span = s.hi - s.lo; pl.setHome({ xmin: s.lo - span * 0.04, xmax: s.hi + span * 0.06, ymin: -0.2, ymax: 5.4 }); };
  const up = () => {
    const s = MPX[sk], P = +$('#pz-P').value, Vs = +$('#pz-vs').value, bits = +$('#pz-b').value, full = Math.pow(2, bits) - 1, Vref = ref === 'rat' ? Vs : 5.0;
    $('#pz-Po').textContent = fmt(P, sk === '5700AP' ? 0 : 2) + ' kPa'; $('#pz-vso').textContent = fmt(Vs, 2) + ' V';
    const V = mpxV(s, P, Vs), N = clamp(Math.round(V / Vref * full), 0, full), Vr = N / full * 5.0, Pr = mpxP(s, Vr, 5.0), e = Pr - P;
    const VFSS = 5 * s.k * (s.hi - s.lo), band = s.acc * VFSS / (5 * s.k), res = 1 / (full * s.k);
    kpis($('#pz-k'), [{ l: 'Vout', v: fmt(V, 4), u: 'V' }, { l: 'Cuenta ADC', v: N.toLocaleString('es-CO') }, { l: 'P calculada', v: fmt(Pr, sk === '5700AP' ? 1 : 3), u: 'kPa' },
      { l: 'Error por la fuente', v: (e >= 0 ? '+' : '') + fmt(e, sk === '5700AP' ? 1 : 3), u: 'kPa', c: Math.abs(e) > band ? 'bad' : Math.abs(e) > res * 2 ? 'warn' : 'ok' },
      { l: 'Resolución', v: fmt(res, sk === '5700AP' ? 3 : 4), u: 'kPa/LSB' }, { l: 'Exactitud del sensor', v: '±' + fmt(band, sk === '5700AP' ? 1 : 2), u: 'kPa' }]);
    pl.set([
      { id: 'band', type: 'band', label: `Tolerancia ±${fmt(s.acc * 100, 1)} % VFSS`, color: 'var(--ok)', alpha: .16, fn: p => mpxV(s, p, Vs) + s.acc * VFSS, fn2: p => mpxV(s, p, Vs) - s.acc * VFSS, dom: [s.lo, s.hi] },
      { id: 'ds', type: 'fn', label: `Hoja de datos, Vs = ${fmt(Vs, 2)} V`, color: 'var(--c-a)', width: 2.6, fn: p => mpxV(s, p, Vs), dom: [s.lo, s.hi] },
      { id: 'n5', type: 'fn', label: 'Supuesta por el firmware (5,00 V)', color: 'var(--c-ref)', dash: 'dash', width: 1.6, fn: p => mpxV(s, p, 5), dom: [s.lo, s.hi] },
      { id: 'p', type: 'point', x: P, y: V, color: 'var(--gold)', tag: fmt(V, 3) + ' V' }
    ]);
  };
  seg('#pz-s', v => { sk = v; setRange(); up(); }); seg('#pz-ref', v => { ref = v; up(); });
  ['#pz-P', '#pz-vs'].forEach(s => $(s).addEventListener('input', up)); $('#pz-b').addEventListener('change', up);
  setRange(); $('#pz-P').value = 350; up();
};

/* ====================================================================
   V · Transmisor de nivel y selección
   ==================================================================== */
MOUNT.acond = () => {
  let low = 'seco';
  $('#lv-f').innerHTML = LIQ_LAB.map(k => `<option value="${k}" ${k === 'agua' ? 'selected' : ''}>${FLUIDOS[k].n} · ${fmt(FLUIDOS[k].rho, 0)} kg/m³</option>`).join('');
  const pl = new Plane($('#lv-plot'), { xmin: -0.2, xmax: 3.3, ymin: 0, ymax: 24, xlabel: 'nivel (m)', ylabel: 'I (mA)', title: 'Corriente del transmisor frente al nivel', xd: 2, yd: 2 });
  const up = (rehome) => {
    const k = $('#lv-f').value, rho = FLUIDOS[k].rho, H = +$('#lv-H').value, h = H * $('#lv-h').value / 100, d = +$('#lv-d').value, Hw = +$('#lv-hw').value, brk = $('#lv-brk').checked, wet = low === 'humedo';
    $('#lv-Ho').textContent = fmt(H, 1) + ' m'; $('#lv-ho').textContent = fmt(h, 2) + ' m'; $('#lv-do').textContent = fmt(d, 2) + ' m'; $('#lv-hwo').textContent = fmt(Hw, 1) + ' m';
    $('#lv-hw').disabled = !wet; $('#lv-hw').closest('.ctrl').style.opacity = wet ? 1 : .45;
    const dP = x => rho * G_LOCAL * (x + d) / 1000 - (wet ? rho * G_LOCAL * Hw / 1000 : 0);
    const LRV = dP(0), URV = dP(H), cur = x => clamp(4 + 16 * (dP(x) - LRV) / (URV - LRV), 3.8, 20.5);
    let I = cur(h), st = 'Normal', c = 'ok';
    if (brk) { I = 3.6; st = 'Falla (≤ 3,6 mA)'; c = 'bad'; }
    const tipo = Math.abs(LRV) < 0.005 ? 'Cero normal' : LRV > 0 ? 'Supresión de cero' : 'Elevación de cero';
    kpis($('#lv-k'), [{ l: 'ΔP actual', v: fmt(dP(h), 2), u: 'kPa' }, { l: 'LRV', v: fmt(LRV, 2), u: 'kPa' }, { l: 'URV', v: fmt(URV, 2), u: 'kPa' }, { l: 'Calibración', v: tipo },
      { l: 'Corriente', v: fmt(I, 2), u: 'mA', c }, { l: 'Estado', v: wet && Hw < H ? 'La pierna húmeda debe llegar a la toma superior' : st, c: wet && Hw < H ? 'warn' : c }]);
    $('#lv-svg').innerHTML = tankSVG({ H: h, Hmax: Math.max(H, 0.5), color: LIQ_COL[k], tx: { d, wet }, aria: 'Tanque con transmisor de nivel' });
    if (rehome) pl.setHome({ xmin: -H * 0.06, xmax: H * 1.1, ymin: 0, ymax: 24 });
    pl.set([
      { id: 'i', type: 'fn', label: 'Corriente I(h)', color: 'var(--gold)', width: 2.6, fn: cur, dom: [0, H] },
      { id: 'h4', type: 'hline', y: 4, color: 'var(--tick)', tag: '4 mA · LRV' }, { id: 'h20', type: 'hline', y: 20, color: 'var(--tick)', tag: '20 mA · URV' },
      { id: 'f1', type: 'hline', y: 3.6, color: 'var(--bad)', label: 'Límites de falla NAMUR (3,6 y 21 mA)' }, { id: 'f2', type: 'hline', y: 21, color: 'var(--bad)' },
      { id: 'p', type: 'point', x: h, y: I, color: brk ? 'var(--bad)' : 'var(--c-a)', tag: fmt(I, 2) + ' mA' }
    ]);
  };
  seg('#lv-low', v => { low = v; up(false); });
  $('#lv-h').addEventListener('input', () => up(false)); ['#lv-d', '#lv-hw'].forEach(s => $(s).addEventListener('input', () => up(false)));
  $('#lv-H').addEventListener('input', () => up(true)); $('#lv-f').addEventListener('change', () => up(false)); $('#lv-brk').addEventListener('change', () => up(false));
  up(true);
};

MOUNT.compara = () => {
  const O = ['Bourdon', 'Diafragma con galgas', 'Piezorresistivo', 'Capacitivo', 'Piezoeléctrico'];
  const S = [
    { q: 'Indicación local de la presión de descarga de una bomba de agua de 6 bar, en un lugar sin energía eléctrica.', a: 'Bourdon', why: 'No necesita energía y es económico. Conviene un rango de 0–10 bar y carátula llena de glicerina para amortiguar las pulsaciones de la bomba.' },
    { q: 'Registrar la presión dentro del cilindro de un motor diésel en cada ciclo de combustión.', a: 'Piezoeléctrico', why: 'Solo el piezoeléctrico sigue cambios de presión de miles de ciclos por segundo y soporta la temperatura de la cámara. Aquí no interesa la presión estática.' },
    { q: 'Medir caudal de vapor con una placa de orificio: ΔP de 0 a 25 kPa, exactitud de 0,1 % y comunicación HART.', a: 'Capacitivo', why: 'Los transmisores capacitivos de presión diferencial son el estándar para caudal y nivel: exactos, estables y con salida 4–20 mA y HART.' },
    { q: 'Prototipo con Arduino para vigilar la red de aire comprimido de un taller (hasta 7 bar), con presupuesto bajo.', a: 'Piezorresistivo', why: 'Un sensor integrado como el MPX5700 cuesta poco, entrega 0,2–4,7 V y se conecta directo al ADC.' }
  ];
  $('#scen').innerHTML = S.map((s, i) => `<div class="card"><p style="margin:0">${s.q}</p><div class="opts">${O.map(o => `<button class="btn sm" data-i="${i}" data-o="${o}">${o}</button>`).join('')}</div><p class="fb" hidden></p></div>`).join('');
  $('#scen').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const s = S[+b.dataset.i], card = b.closest('.card'), fb = $('.fb', card), ok = b.dataset.o === s.a;
    fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'bad'); fb.style.marginTop = '10px'; fb.textContent = (ok ? 'Correcto. ' : `Mejor opción: ${s.a}. `) + s.why; });
};

/* ====================================================================
   VI · Laboratorio virtual
   ==================================================================== */
const getId = () => store.get('id', {});
const getBench = () => { const id = getId(); return id.code ? bench(id.code) : null; };
MOUNT.labid = () => {
  const id = getId(), f = ['name', 'code', 'mates', 'group', 'date'];
  f.forEach(k => { const el = $('#id-' + k); el.value = id[k] || (k === 'date' ? new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : ''); el.addEventListener('input', () => { const o = getId(); if (k !== 'code') { o[k] = el.value; store.set('id', o); } }); });
  const show = () => { const b = getBench(), o = getId(); if (!b) return;
    $('#id-bench').className = ''; $('#id-bench').innerHTML = `<div class="row" style="margin-bottom:10px"><span class="pill ok">Banco ${b.id} asignado</span><span class="tag">código ${esc(o.code)}</span></div>
      <ul style="margin:0"><li>Balanza de pesos muertos y manómetro Bourdon de 0–10 bar, clase 1,0.</li><li>Columna de 1,2 m con un líquido desconocido, manómetro digital y manómetro en U de mercurio.</li><li>Sensor MPX5700AP con calibrador de presión y Arduino UNO (ADC de 10 bits).</li></ul>`; };
  $('#id-go').onclick = () => {
    const code = $('#id-code').value.trim(); if (!code) { toast('Escribe tu código estudiantil.'); return; }
    const o = getId(); if (o.code && o.code !== code) ['lab1', 'lab2', 'lab3'].forEach(k => store.set('lab:' + k, []));
    f.forEach(k => o[k] = $('#id-' + k).value.trim()); store.set('id', o); show(); toast('Banco asignado. Ya puedes ir a la práctica 1.');
  };
  show();
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* --- análisis de cada práctica (también los usa el informe) --- */
function an1(rows) {
  const ms = [...new Set(rows.map(r => r.m))].sort((a, b) => a - b), avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
  const det = ms.map(m => { const P = dwtP(m), A = rows.filter(r => r.m === m && r.dir === 'asc').map(r => r.R), D = rows.filter(r => r.m === m && r.dir === 'desc').map(r => r.R);
    const ra = avg(A), rd = avg(D); return { m, P, ra, rd, ea: ra - P, ed: rd - P, hy: (isFinite(ra) && isFinite(rd)) ? Math.abs(rd - ra) : NaN }; });
  const errs = rows.map(r => r.R - r.P), emax = Math.max(...errs.map(Math.abs)), hys = det.map(d => d.hy).filter(isFinite), hmax = hys.length ? Math.max(...hys) : NaN;
  const f = linfit(rows.map(r => r.P), rows.map(r => r.R)), tol = BD.cls / 100 * BD.fs;
  const ok = emax <= tol && (!isFinite(hmax) || hmax <= tol);
  return { det, emax, ep: emax / BD.fs * 100, hmax, f, zero: f.b, spanErr: (f.m - 1) * BD.fs, tol, ok };
}
function an2(rows) {
  const f = linfit(rows.map(r => r.h), rows.map(r => r.P)), rho = f.m * 1000 / G_LOCAL;
  const near = LIQ_LAB.map(k => ({ k, d: (rho - FLUIDOS[k].rho) / FLUIDOS[k].rho * 100 })).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0];
  const det = rows.map(r => { const PU = r.dh / 1000 * 13546 * G_LOCAL / 1000; return { ...r, PU, dU: PU - r.P, Pabs: r.pa + r.P }; });
  const pam = rows.reduce((s, r) => s + r.pa, 0) / rows.length, hmax = Math.max(...rows.map(r => r.h)), Pbot = f.m * hmax + f.b;
  return { f, rho, near, det, pam, hmax, PabsMax: pam + Pbot, dUmax: Math.max(...det.map(d => Math.abs(d.dU))), dBog: (patmAlt(2640) - patmAlt(917)) / 1000 };
}
function an3(rows) {
  const s = MPX['5700AP'], Vs = rows.reduce((t, r) => t + r.Vs, 0) / rows.length, f = linfit(rows.map(r => r.Pa), rows.map(r => r.V)), fn = linfit(rows.map(r => r.Pa), rows.map(r => r.N));
  const VFSS = Vs * s.k * (s.hi - s.lo), det = rows.map(r => { const Vd = mpxV(s, r.Pa, r.Vs), eV = r.V - Vd; return { ...r, Vd, eV, eP: eV / (r.Vs * s.k), I: 4 + 16 * r.pm / 600 }; });
  const eVmax = Math.max(...det.map(d => Math.abs(d.eV)));
  return { s, Vs, f, fn, S: f.m * 1000, Sds: Vs * s.k * 1000, off: f.b, offds: Vs * s.off, VFSS, det, eVmax, ePmax: eVmax / (Vs * s.k), epct: eVmax / VFSS * 100, ok: eVmax <= s.acc * VFSS, res: 1 / fn.m };
}

const LAB1 = { key: 'lab1', p: 'l1', min: 10, ncol: 4, bathSd: 0, jit: 0.6, sort: false, dirEl: '#l1-dir', d: ['l1-d1', 'l1-d2', 'l1-d3'],
  fmt: v => `${fmt(v, 1)} kg · ${fmt(dwtP(v), 1)} kPa`, waitMsg: 'Espera a que el pistón deje de oscilar.',
  check: rows => (!rows.some(r => r.dir === 'asc') || !rows.some(r => r.dir === 'desc')) ? 'Toma lecturas subiendo y bajando la masa para medir la histéresis.' : '',
  read: (b, m, dir) => { const mm = clamp(Math.round(m * 2) / 2, 0, 10), P = dwtP(m), R = Math.round(b.bd.read(clamp(P, 0, 1100), dir) + noise(0.5)); return { T: mm, m: mm, P: dwtP(mm), R, dir }; },
  disp: r => { const dl = $('#l1-dial'); if (dl) dl.innerHTML = dialSVG({ max: 10, step: 1, minor: 0.2, unit: 'bar', sub: 'clase 1,0', value: r.R / 100, aria: 'Manómetro Bourdon del banco' }); return [fmt(r.P, 2) + ' kPa', fmt(r.R, 0) + ' kPa', fmt(r.R / 100, 2) + ' bar']; },
  cells: r => [fmt(r.m, 1), fmt(r.P, 2), fmt(r.R, 0), r.dir === 'asc' ? '↑ asc.' : '↓ desc.'],
  analyze: rows => { const a = an1(rows), P = a.det.map(d => d.P);
    return { kpis: [{ l: 'Error máximo', v: fmt(a.emax, 1), u: 'kPa', c: a.emax <= a.tol ? 'ok' : 'bad' }, { l: 'Error máximo', v: fmt(a.ep, 2), u: '% span' },
        { l: 'Histéresis máxima', v: fmt(a.hmax, 1), u: 'kPa', c: a.hmax <= a.tol ? 'ok' : 'bad' }, { l: 'Error de cero', v: fmt(a.zero, 2), u: 'kPa' }, { l: 'Error de alcance', v: fmt(a.spanErr, 2), u: 'kPa' },
        { l: 'R² lectura–patrón', v: fmt(a.f.r2, 6) }, { l: 'Clase 1,0', v: a.ok ? 'Cumple' : 'No cumple', c: a.ok ? 'ok' : 'bad' }],
      head: ['Masa (kg)', 'P patrón (kPa)', 'Lectura ↑ (kPa)', 'Lectura ↓ (kPa)', 'Error ↑ (kPa)', 'Error ↓ (kPa)', 'Histéresis (kPa)'],
      body: a.det.map(d => [fmt(d.m, 1), fmt(d.P, 2), fmt(d.ra, 0), fmt(d.rd, 0), fmt(d.ea, 1), fmt(d.ed, 1), fmt(d.hy, 1)]),
      plots: [
        { o: { xmin: -40, xmax: 1060, ymin: -Math.max(15, a.emax * 1.4), ymax: Math.max(15, a.emax * 1.4), xlabel: 'P patrón (kPa)', ylabel: 'Error (kPa)', title: 'Curva de error del manómetro', xd: 1, yd: 2 }, layers: [
          { id: 'tol', type: 'band', label: 'Tolerancia clase 1,0', color: 'var(--ok)', alpha: .16, fn: () => a.tol, fn2: () => -a.tol, dom: [0, 1000] },
          { id: 'la', type: 'line', label: 'Carga ascendente', color: 'var(--c-a)', width: 2, pts: a.det.filter(d => isFinite(d.ea)).map(d => [d.P, d.ea]) },
          { id: 'ld', type: 'line', label: 'Carga descendente', color: 'var(--c-b)', width: 2, pts: a.det.filter(d => isFinite(d.ed)).map(d => [d.P, d.ed]) },
          { id: 'sa', type: 'scatter', color: 'var(--c-a)', pts: a.det.filter(d => isFinite(d.ea)).map(d => [d.P, d.ea]) },
          { id: 'sd', type: 'scatter', color: 'var(--c-b)', pts: a.det.filter(d => isFinite(d.ed)).map(d => [d.P, d.ed]) }] },
        { o: { xmin: -40, xmax: 1060, ymin: -40, ymax: 1060, xlabel: 'P patrón (kPa)', ylabel: 'Lectura (kPa)', title: 'Lectura frente a la presión patrón', xd: 1, yd: 1 }, layers: [
          { id: 'id', type: 'fn', label: 'Ideal', color: 'var(--tick)', dash: 'dot', width: 1.5, fn: x => x, dom: [0, 1000] },
          { id: 'fit', type: 'fn', label: `Ajuste: L = ${fmt(a.f.m, 4)}·P ${a.f.b >= 0 ? '+' : '−'} ${fmt(Math.abs(a.f.b), 2)}`, color: 'var(--gold)', width: 2.2, fn: x => a.f.m * x + a.f.b, dom: [0, 1000] },
          { id: 'd', type: 'scatter', label: 'Lecturas', color: 'var(--c-a)', pts: rows.map(r => [r.P, r.R]) }] }] }; } };

const LAB2 = { key: 'lab2', p: 'l2', min: 8, ncol: 4, bathSd: 0.002, jit: 0.04, d: ['l2-d1', 'l2-d2', 'l2-d3', 'l2-d4'], fmt: v => fmt(v, 2) + ' m', waitMsg: 'Espera a que el nivel se estabilice.',
  read: (b, h) => { h = Math.max(0, h); const P = b.hi.P(h) + noise(0.006), dh = Math.round(P * 1e6 / (13546 * G_LOCAL) * 2) / 2; return { T: h, h: Math.round(h * 1000) / 1000, P: Math.round(P * 100) / 100, dh, pa: Math.round((b.hi.patm + noise(0.006)) * 100) / 100 }; },
  disp: r => { const t = $('#l2-tank'); if (t) t.innerHTML = tankSVG({ H: r.h, Hmax: 1.2, color: 'var(--c-c)', column: true, aria: 'Columna con líquido desconocido' }); return [fmt(r.h, 3) + ' m', fmt(r.P, 2) + ' kPa', fmt(r.dh, 1) + ' mm', fmt(r.pa, 2) + ' kPa']; },
  cells: r => [fmt(r.h, 3), fmt(r.P, 2), fmt(r.dh, 1), fmt(r.pa, 2)],
  analyze: rows => { const a = an2(rows);
    return { kpis: [{ l: 'Pendiente ρg', v: fmt(a.f.m, 4), u: 'kPa/m' }, { l: 'Intercepto', v: fmt(a.f.b, 3), u: 'kPa' }, { l: 'R² del ajuste', v: fmt(a.f.r2, 6) },
        { l: 'Densidad ρ', v: fmt(a.rho, 1), u: 'kg/m³' }, { l: 'Líquido identificado', v: FLUIDOS[a.near.k].n, c: Math.abs(a.near.d) < 2 ? 'ok' : 'warn' }, { l: 'Diferencia con la tabla', v: fmt(a.near.d, 2), u: '%' },
        { l: 'P abs en el fondo (lleno)', v: fmt(a.PabsMax, 2), u: 'kPa' }, { l: 'Máx. diferencia U − digital', v: fmt(a.dUmax, 3), u: 'kPa' }],
      head: ['h (m)', 'P digital (kPa)', 'P por U (kPa)', 'U − digital (kPa)', 'P abs (kPa)'],
      body: a.det.map(d => [fmt(d.h, 3), fmt(d.P, 2), fmt(d.PU, 3), fmt(d.dU, 3), fmt(d.Pabs, 2)]),
      plots: [{ o: { xmin: -0.05, xmax: 1.28, ymin: -0.8, ymax: 16.5, xlabel: 'h (m)', ylabel: 'P man (kPa)', title: 'Presión en el fondo frente al nivel', xd: 3, yd: 3 }, layers: [
        { id: 'fit', type: 'fn', label: `Ajuste: P = ${fmt(a.f.m, 3)}·h ${a.f.b >= 0 ? '+' : '−'} ${fmt(Math.abs(a.f.b), 3)}`, color: 'var(--gold)', width: 2.2, fn: x => a.f.m * x + a.f.b, dom: [0, 1.25] },
        { id: 'w', type: 'fn', label: 'Agua (referencia)', color: 'var(--c-a)', dash: 'dash', width: 1.5, fn: x => 998.2 * G_LOCAL * x / 1000, dom: [0, 1.25] },
        { id: 'u', type: 'scatter', label: 'Por manómetro en U', color: 'var(--c-ref)', r: 3.5, pts: a.det.map(d => [d.h, d.PU]) },
        { id: 'd', type: 'scatter', label: 'Manómetro digital', color: 'var(--c-c)', pts: rows.map(r => [r.h, r.P]) }] }] }; } };

const LAB3 = { key: 'lab3', p: 'l3', min: 7, ncol: 5, bathSd: 0.3, jit: 8, d: ['l3-d1', 'l3-d2', 'l3-d3', 'l3-d4'], fmt: v => fmt(v, 0) + ' kPa', waitMsg: 'Espera a que la presión del calibrador se estabilice.',
  read: (b, pm) => { pm = Math.max(0, pm); const Pa = b.hi.patm + pm + noise(0.05), V = b.mpx.V(Pa) + noise(0.002), N = clamp(Math.round(V / b.mpx.Vs * 1023), 0, 1023);
    return { T: pm, pm: Math.round(pm * 10) / 10, Pa: Math.round(Pa * 100) / 100, V: Math.round(V * 10000) / 10000, N, Vs: Math.round((b.mpx.Vs + noise(0.0008)) * 1000) / 1000 }; },
  disp: r => [fmt(r.Pa, 2) + ' kPa', fmt(r.V, 4) + ' V', String(r.N), fmt(r.Vs, 3) + ' V'],
  cells: r => [fmt(r.pm, 1), fmt(r.Pa, 2), fmt(r.V, 4), String(r.N), fmt(r.Vs, 3)],
  analyze: rows => { const a = an3(rows);
    return { kpis: [{ l: 'Sensibilidad', v: fmt(a.S, 4), u: 'mV/kPa' }, { l: 'Hoja de datos', v: fmt(a.Sds, 4), u: 'mV/kPa' }, { l: 'Offset ajustado', v: fmt(a.off, 4), u: 'V' }, { l: 'Offset hoja de datos', v: fmt(a.offds, 4), u: 'V' },
        { l: 'R² del ajuste', v: fmt(a.f.r2, 6) }, { l: 'Error máx. vs hoja', v: fmt(a.ePmax, 1), u: 'kPa', c: a.ok ? 'ok' : 'bad' }, { l: 'Error máx.', v: fmt(a.epct, 2), u: '% VFSS', c: a.ok ? 'ok' : 'bad' }, { l: 'Resolución ADC', v: fmt(a.res, 3), u: 'kPa/LSB' }],
      head: ['P abs (kPa)', 'V medida (V)', 'V hoja (V)', 'Error (mV)', 'Error (kPa)', 'I 0–600 kPa (mA)'],
      body: a.det.map(d => [fmt(d.Pa, 2), fmt(d.V, 4), fmt(d.Vd, 4), fmt(d.eV * 1000, 1), fmt(d.eP, 2), fmt(d.I, 2)]),
      plots: [
        { o: { xmin: 40, xmax: 740, ymin: 0, ymax: 5.2, xlabel: 'P abs (kPa)', ylabel: 'Vout (V)', title: 'Característica del MPX5700AP', xd: 1, yd: 4 }, layers: [
          { id: 'band', type: 'band', label: 'Tolerancia ±2,5 % VFSS', color: 'var(--ok)', alpha: .16, fn: p => mpxV(a.s, p, a.Vs) + a.s.acc * a.VFSS, fn2: p => mpxV(a.s, p, a.Vs) - a.s.acc * a.VFSS, dom: [15, 700] },
          { id: 'ds', type: 'fn', label: 'Hoja de datos', color: 'var(--c-a)', dash: 'dash', width: 1.8, fn: p => mpxV(a.s, p, a.Vs), dom: [15, 700] },
          { id: 'fit', type: 'fn', label: `Ajuste: V = ${fmt(a.off, 4)} + ${fmt(a.S / 1000, 6)}·P`, color: 'var(--gold)', width: 2.2, fn: p => a.f.b + a.f.m * p, dom: [15, 700] },
          { id: 'd', type: 'scatter', label: 'Lecturas', color: 'var(--c-b)', pts: rows.map(r => [r.Pa, r.V]) }] },
        { o: { xmin: 40, xmax: 740, ymin: -25, ymax: 25, xlabel: 'P abs (kPa)', ylabel: 'Error (kPa)', title: 'Error frente a la hoja de datos', xd: 1, yd: 2, h: 260 }, layers: [
          { id: 'tb', type: 'band', label: 'Tolerancia', color: 'var(--ok)', alpha: .16, fn: () => a.s.acc * (a.s.hi - a.s.lo), fn2: () => -a.s.acc * (a.s.hi - a.s.lo), dom: [15, 700] },
          { id: 'e', type: 'line', label: 'Error en kPa', color: 'var(--c-b)', width: 2, pts: a.det.map(d => [d.Pa, d.eP]) },
          { id: 'es', type: 'scatter', color: 'var(--c-b)', pts: a.det.map(d => [d.Pa, d.eP]) }] }] }; } };

MOUNT.lab1 = () => makeLab(LAB1);
MOUNT.lab2 = () => makeLab(LAB2);
MOUNT.lab3 = () => makeLab(LAB3);

MOUNT.ejer = el => {
  $$('.ans', el).forEach(s => { const a = ANS[s.dataset.k]; s.textContent = fmt(a[0], a[1]); });
  let st = store.get('ex', {});
  const score = () => { const n = EX_KEYS.filter(k => st[k] && st[k].ok).length; $('#ex-score').textContent = `${n} / ${EX_KEYS.length} correctos`; $('#ex-score').className = 'pill' + (n === EX_KEYS.length ? ' ok' : ''); };
  const paint = (box, k) => { const s = st[k], fb = $('.fb', box); box.classList.remove('ok', 'bad'); fb.className = 'fb'; fb.textContent = '';
    if (!s) return; box.classList.add(s.ok ? 'ok' : 'bad'); fb.classList.add(s.ok ? 'ok' : 'bad'); fb.textContent = s.ok ? 'Correcto' : 'Revisa tu cálculo'; };
  $$('.ex', el).forEach(box => {
    const k = box.dataset.k, tol = +box.dataset.tol, inp = $('input', box);
    if (st[k]) inp.value = st[k].v;
    const check = () => { const v = num(inp.value); if (!isFinite(v)) { toast('Escribe un número.'); return; } st[k] = { v: inp.value, ok: Math.abs(v - ANS[k][0]) <= tol }; store.set('ex', st); paint(box, k); score(); };
    $('button', box).onclick = check; inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    paint(box, k);
  });
  $('#ex-reset').onclick = () => { st = {}; store.set('ex', st); $$('.ex', el).forEach(b => { $('input', b).value = ''; paint(b, b.dataset.k); }); score(); };
  score();
};


/* ====================================================================
   Informe en PDF (jsPDF + AutoTable)
   ==================================================================== */
const PDFMAP = [[/Ω/g, 'ohm'], [/α/g, 'alfa'], [/β/g, 'beta'], [/τ/g, 'tau'], [/δ/g, 'delta'], [/₂₅/g, '25'], [/₀/g, '0'], [/₂/g, '2'], [/ₕ/g, 'h'],
  [/⁻¹/g, '^-1'], [/⁻³/g, '^-3'], [/⁻⁷/g, '^-7'], [/⁻/g, '-'], [/≈/g, '~'], [/²/g, '^2'], [/³/g, '^3'], [/µ/g, 'u'], [/≤/g, '<='], [/≥/g, '>='], [/→/g, '->'], [/−/g, '-'], [/[^\x00-\xff–—‘’“”•…]/g, '']];
const pdfTxt = s => PDFMAP.reduce((t, [r, v]) => t.replace(r, v), String(s ?? ''));
function chartImage(pc) {
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px'; document.body.appendChild(host);
  const pl = new Plane(host, { ...pc.o, fixed: true, h: 430, scale: 2 }); pl.resize(); pl.set(pc.layers);
  const url = pl.cv.toDataURL('image/png'), ratio = pl.H / pl.W; pl.ro.disconnect(); LIVE.delete(pl); host.remove(); return { url, ratio };
}


/* ====================================================================
   VII · Ejercicios
   ==================================================================== */
const ANS = (() => {
  const g = 9.81;
  return { e1: [250 / 6.894757, 2], e2: [30 * 6.894757, 2], e3: [90.8 + 350, 1], e4: [73.4 - 25, 1], e5: [998 * g * 4.5 / 1000, 2], e6: [25000 / (870 * g), 3],
    e7: [(13546 - 998) * g * 0.12 / 1000, 2], e8: [827 * g * 0.08 * Math.sin(Math.PI / 6), 1], e9: [12 * 9.78 / 0.5e-4 / 1000, 1], e10: [10 * 2.1 / 4 * 4 * 250e-6 * 1000, 2],
    e11: [5 * (0.0012858 * 400 + 0.04), 4], e12: [4 + 16 * 450 / 600, 2], e13: [998 * g * 0.5 / 1000, 3] };
})();
const EX_KEYS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'e13'];
const EX_TEMA = ['Unidades', 'Unidades', 'Tipos de presión', 'Tipos de presión', 'Hidrostática', 'Hidrostática', 'Manómetro en U', 'Manómetro inclinado', 'Pesos muertos', 'Galgas', 'Piezorresistivo', 'Transmisión', 'Nivel por ΔP'];

/* ====================================================================
   VIII · Informe (texto, CSV y vista previa)
   ==================================================================== */
const TITULO = 'Medición de presión: tipos y unidades, principio hidrostático y transductores';
const OBJ = 'Medir la presión como variable de proceso, relacionar sus tipos y unidades, verificar experimentalmente el principio hidrostático y caracterizar un transductor piezorresistivo, comparando los resultados con las normas EN 837 y la hoja de datos del fabricante.';
const PROC = ['Práctica 1: un manómetro Bourdon de 0–10 bar, clase 1,0, se calibró contra una balanza de pesos muertos de 1,0000 cm² con g = 9,7778 m/s², en carga ascendente y descendente.',
  'Práctica 2: una columna de 1,2 m con un líquido desconocido se llenó por etapas; en el fondo se midió la presión con un manómetro digital y con un manómetro en U de mercurio, y se registró la presión barométrica.',
  'Práctica 3: un sensor MPX5700AP se conectó a un calibrador de presión entre 0 y 600 kPa manométricos; su salida se midió con un multímetro y con el ADC de 10 bits de un Arduino UNO.'];
const REFS = ['EN 837-1:1996. Pressure gauges. Part 1: Bourdon tube pressure gauges.', 'EN 837-2:1997. Pressure gauges. Part 2: Selection and installation recommendations.', 'NXP Semiconductors. MPX5700 Integrated Silicon Pressure Sensor. Hoja de datos.', 'NOAA, NASA y USAF (1976). U.S. Standard Atmosphere, 1976.', 'Creus Solé, A. (2010). Instrumentación industrial (8.ª ed.). Marcombo.', 'Pallás Areny, R. (2003). Sensores y acondicionadores de señal (4.ª ed.). Marcombo.'];
function reportData() {
  const id = getId(), b = getBench(), L = k => store.get('lab:' + k, []);
  const r1 = L('lab1'), r2 = L('lab2'), r3 = L('lab3'), ex = store.get('ex', {});
  const ok1 = r1.length >= 10 && r1.some(r => r.dir === 'asc') && r1.some(r => r.dir === 'desc');
  return { id, b, r1, r2, r3, a1: ok1 ? an1(r1) : null, a2: r2.length >= 8 ? an2(r2) : null, a3: r3.length >= 7 ? an3(r3) : null,
    t1: store.get('txt:lab1', ''), t2: store.get('txt:lab2', ''), t3: store.get('txt:lab3', ''), res: store.get('txt:res', ''), con: store.get('txt:con', ''),
    ex, nex: EX_KEYS.filter(k => ex[k] && ex[k].ok).length };
}
function resumen1(a) { return `Error máximo: ${fmt(a.emax, 1)} kPa (${fmt(a.ep, 2)} % del alcance); histéresis máxima: ${fmt(a.hmax, 1)} kPa. Ajuste lectura–patrón: L = ${fmt(a.f.m, 4)}·P ${a.f.b >= 0 ? '+' : '−'} ${fmt(Math.abs(a.f.b), 2)} kPa (R² = ${fmt(a.f.r2, 6)}); error de cero ${fmt(a.zero, 2)} kPa y error de alcance ${fmt(a.spanErr, 2)} kPa. Clase 1,0 (±${fmt(a.tol, 0)} kPa): ${a.ok ? 'cumple' : 'no cumple'}.`; }
function resumen2(a) { return `Ajuste P = ${fmt(a.f.m, 4)}·h ${a.f.b >= 0 ? '+' : '−'} ${fmt(Math.abs(a.f.b), 3)} kPa (R² = ${fmt(a.f.r2, 6)}). Densidad: ρ = ${fmt(a.rho, 1)} kg/m³, compatible con ${FLUIDOS[a.near.k].n} (${fmt(a.near.d, 2)} % respecto a la tabla). Presión absoluta en el fondo con la columna llena: ${fmt(a.PabsMax, 2)} kPa, con presión barométrica media de ${fmt(a.pam, 2)} kPa. Diferencia máxima entre el manómetro en U y el digital: ${fmt(a.dUmax, 3)} kPa.`; }
function resumen3(a) { return `Ajuste V = ${fmt(a.off, 4)} V + ${fmt(a.S, 4)} mV/kPa · P con R² = ${fmt(a.f.r2, 6)}. Hoja de datos a Vs = ${fmt(a.Vs, 3)} V: ${fmt(a.Sds, 4)} mV/kPa y ${fmt(a.offds, 4)} V. Error máximo frente a la hoja de datos: ${fmt(a.ePmax, 1)} kPa (${fmt(a.epct, 2)} % VFSS); tolerancia ±2,5 % VFSS: ${a.ok ? 'cumple' : 'no cumple'}. Resolución del ADC: ${fmt(a.res, 3)} kPa por bit; ecuación del firmware: P = (N − ${fmt(a.fn.b, 2)}) / ${fmt(a.fn.m, 5)} kPa.`; }
function buildReport() {
  const D = reportData(), ph = s => `<span class="pm">[${s}]</span>`, para = (t, p) => t.trim() ? t.trim().split(/\n+/).map(x => `<p>${esc(x)}</p>`).join('') : `<p>${ph(p)}</p>`;
  const tbl = (head, rows) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th class="num">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td class="num">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const T = [], line = s => T.push(s), ttab = (head, rows) => { line(head.join('\t')); rows.forEach(r => line(r.join('\t'))); line(''); };
  const id = D.id;
  let h = `<div class="cover"><p class="pm" style="margin:0 0 6px;max-width:none">Universidad del Valle · Sede Cartago · Tecnología en Electrónica</p><h1>Informe de laboratorio. ${TITULO}</h1><p class="pm" style="margin:6px 0 0;max-width:none">Instrumentación Industrial · Docente: Dra. María Elena Leyes</p>
    <div class="meta"><div><b>Estudiante:</b> ${esc(id.name) || ph('nombre')}</div><div><b>Código:</b> ${esc(id.code) || ph('código')}</div><div><b>Compañeros:</b> ${esc(id.mates) || '—'}</div><div><b>Grupo:</b> ${esc(id.group) || ph('grupo')}</div><div><b>Fecha:</b> ${esc(id.date) || ph('fecha')}</div><div><b>Banco:</b> ${D.b ? D.b.id : ph('sin asignar')}</div></div></div>`;
  line('UNIVERSIDAD DEL VALLE · SEDE CARTAGO · TECNOLOGÍA EN ELECTRÓNICA'); line('INFORME DE LABORATORIO: ' + TITULO.toUpperCase()); line('Instrumentación Industrial · Docente: Dra. María Elena Leyes');
  line(`Estudiante: ${id.name || ''}\tCódigo: ${id.code || ''}\tGrupo: ${id.group || ''}`); line(`Compañeros: ${id.mates || '—'}\tFecha: ${id.date || ''}\tBanco: ${D.b ? D.b.id : ''}`); line('');
  h += `<h2>1. Resumen</h2>${para(D.res, 'Escribe el resumen en el generador')}`; line('1. RESUMEN'); line(D.res || '[Escribe el resumen]'); line('');
  h += `<h2>2. Objetivos</h2><p>${OBJ}</p>`; line('2. OBJETIVOS'); line(OBJ); line('');
  h += `<h2>3. Marco teórico</h2><p>${ph('Presenta los tipos de presión y sus unidades, el principio hidrostático, la balanza de pesos muertos y los transductores, con citas')}</p>`; line('3. MARCO TEÓRICO'); line('[Tipos de presión y unidades, principio hidrostático, balanza de pesos muertos, transductores, con citas]'); line('');
  h += `<h2>4. Montaje y procedimiento</h2>${PROC.map(p => `<p>${p}</p>`).join('')}<p>${ph('Inserta el diagrama del montaje con simbología ISA-5.1')}</p>`; line('4. MONTAJE Y PROCEDIMIENTO'); PROC.forEach(line); line('');
  h += `<h2>5. Resultados</h2>`; line('5. RESULTADOS');
  h += `<h3>5.1 Calibración del manómetro Bourdon</h3>`; line('5.1 Calibración del manómetro Bourdon');
  if (D.r1.length) { const hd = ['Masa (kg)', 'P patrón (kPa)', 'Lectura (kPa)', 'Sentido'], rw = D.r1.map(r => [fmtc(r.m, 1), fmtc(r.P, 2), String(r.R), r.dir === 'asc' ? 'Ascendente' : 'Descendente']); h += tbl(hd, rw); ttab(hd, rw); }
  if (D.a1) { const s = resumen1(D.a1); h += `<p>${s}</p>`; line(s); } else { h += `<p>${ph('Faltan lecturas: se requieren al menos 10, subiendo y bajando')}</p>`; line('[Faltan lecturas de la práctica 1]'); }
  line(''); h += `<h3>5.2 Principio hidrostático</h3>`; line('5.2 Principio hidrostático');
  if (D.r2.length) { const hd = ['h (m)', 'P man (kPa)', 'Δh Hg (mm)', 'P atm (kPa)'], rw = D.r2.map(r => [fmtc(r.h, 3), fmtc(r.P, 2), fmtc(r.dh, 1), fmtc(r.pa, 2)]); h += tbl(hd, rw); ttab(hd, rw); }
  if (D.a2) { const s = resumen2(D.a2); h += `<p>${s}</p>`; line(s); } else { h += `<p>${ph('Faltan lecturas: se requieren al menos 8')}</p>`; line('[Faltan lecturas de la práctica 2]'); }
  line(''); h += `<h3>5.3 Transductor piezorresistivo</h3>`; line('5.3 Transductor piezorresistivo');
  if (D.r3.length) { const hd = ['P man (kPa)', 'P abs (kPa)', 'Vout (V)', 'N ADC', 'Vs (V)'], rw = D.r3.map(r => [fmtc(r.pm, 1), fmtc(r.Pa, 2), fmtc(r.V, 4), r.N, fmtc(r.Vs, 3)]); h += tbl(hd, rw); ttab(hd, rw); }
  if (D.a3) { const s = resumen3(D.a3); h += `<p>${s}</p>`; line(s); } else { h += `<p>${ph('Faltan lecturas: se requieren al menos 7')}</p>`; line('[Faltan lecturas de la práctica 3]'); }
  line(''); h += `<p>${ph('El PDF incluye las gráficas de cada práctica con ejes rotulados y figuras numeradas')}</p>`;
  h += `<h2>6. Análisis de resultados</h2><h3>6.1 Manómetro Bourdon</h3>${para(D.t1, 'Escribe el análisis en la página de la práctica 1')}<h3>6.2 Principio hidrostático</h3>${para(D.t2, 'Escribe el análisis en la página de la práctica 2')}<h3>6.3 Transductor piezorresistivo</h3>${para(D.t3, 'Escribe el análisis en la página de la práctica 3')}`;
  line('6. ANÁLISIS DE RESULTADOS'); line('6.1 Manómetro Bourdon'); line(D.t1 || '[Análisis práctica 1]'); line('6.2 Principio hidrostático'); line(D.t2 || '[Análisis práctica 2]'); line('6.3 Transductor piezorresistivo'); line(D.t3 || '[Análisis práctica 3]'); line('');
  const exr = EX_KEYS.map((k, i) => [String(i + 1), EX_TEMA[i], D.ex[k] ? esc(D.ex[k].v) : '—', D.ex[k] ? (D.ex[k].ok ? 'Correcto' : 'Incorrecto') : 'Sin responder']);
  h += `<h2>7. Ejercicios</h2><p>Puntaje: <b>${D.nex} de ${EX_KEYS.length}</b> ejercicios correctos.</p>${tbl(['Ejercicio', 'Tema', 'Respuesta', 'Estado'], exr)}`;
  line('7. EJERCICIOS'); line(`Puntaje: ${D.nex} de ${EX_KEYS.length} correctos`); ttab(['Ejercicio', 'Tema', 'Respuesta', 'Estado'], exr);
  h += `<h2>8. Conclusiones</h2>${para(D.con, 'Escribe las conclusiones en el generador')}`; line('8. CONCLUSIONES'); line(D.con || '[Conclusiones]'); line('');
  h += `<h2>9. Referencias</h2><ol>${REFS.map(r => `<li>${r}</li>`).join('')}</ol>`; line('9. REFERENCIAS'); REFS.forEach((r, i) => line(`[${i + 1}] ${r}`));
  $('#paper').innerHTML = h;
  return T.join('\n');
}
function buildCSV() {
  const D = reportData(), o = [];
  o.push('Practica 1 - Manometro Bourdon'); o.push('Masa_kg;P_patron_kPa;Lectura_kPa;Sentido'); D.r1.forEach(r => o.push([fmtc(r.m, 1), fmtc(r.P, 2), r.R, r.dir === 'asc' ? 'ascendente' : 'descendente'].join(';'))); o.push('');
  o.push('Practica 2 - Principio hidrostatico'); o.push('h_m;P_man_kPa;dh_Hg_mm;P_atm_kPa'); D.r2.forEach(r => o.push([fmtc(r.h, 3), fmtc(r.P, 2), fmtc(r.dh, 1), fmtc(r.pa, 2)].join(';'))); o.push('');
  o.push('Practica 3 - MPX5700AP'); o.push('P_man_kPa;P_abs_kPa;Vout_V;N_ADC;Vs_V'); D.r3.forEach(r => o.push([fmtc(r.pm, 1), fmtc(r.Pa, 2), fmtc(r.V, 4), r.N, fmtc(r.Vs, 3)].join(';')));
  return o.join('\n');
}
MOUNT.informe = () => {
  [['#inf-res', 'txt:res'], ['#inf-con', 'txt:con']].forEach(([s, k]) => { const t = $(s); t.value = store.get(k, ''); t.addEventListener('input', () => store.set(k, t.value)); });
  DL_PROMISE = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  $('#inf-pdf').onclick = e => savePDF(e.currentTarget);
  let txt = buildReport();
  $('#inf-gen').onclick = () => { txt = buildReport(); toast('Borrador actualizado.'); };
  $('#inf-copy').onclick = () => { txt = buildReport(); copyText(txt, 'Informe copiado. Pégalo en tu procesador de texto.'); };
  $('#inf-csv').onclick = () => copyText(buildCSV(), 'Datos copiados en formato CSV con separador «;».');
};

/* ====================================================================
   Informe en PDF
   ==================================================================== */
PDFMAP.unshift([/ρ/g, 'rho'], [/Δ/g, 'Delta '], [/θ/g, 'theta'], [/ε/g, 'eps'], [/σ/g, 'sigma'], [/↑/g, '(asc.)'], [/↓/g, '(desc.)'], [/₁/g, '1'], [/H₂O/g, 'H2O']);
function buildPDF() {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const D = reportData(), id = D.id, PW = 215.9, PH = 279.4, M = 20, CW = PW - 2 * M, RED = [181, 18, 27], INK = [29, 26, 31], MUTE = [94, 90, 99];
  let y = 22, fig = 0, tab = 0;
  const need = h => { if (y + h > PH - 20) { doc.addPage(); y = 24; } };
  const H2 = t => { need(42); y += 3; doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...RED); doc.text(pdfTxt(t), M, y); y += 2; doc.setDrawColor(...RED); doc.setLineWidth(.4); doc.line(M, y, PW - M, y); y += 6.5; };
  const H3 = t => { need(32); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(pdfTxt(t), M, y); y += 5.5; };
  const P = (t, it = false, color = INK) => { doc.setFont('helvetica', it ? 'italic' : 'normal'); doc.setFontSize(10); doc.setTextColor(...color);
    String(t).split(/\n+/).filter(x => x.trim()).forEach(par => { doc.splitTextToSize(pdfTxt(par.trim()), CW).forEach(l => { need(5); doc.text(l, M, y); y += 4.8; }); y += 1.8; }); };
  const PH_ = t => P('[' + t + ']', true, MUTE), TXT = (t, p) => t && t.trim() ? P(t) : PH_(p);
  const T = (cap, head, body) => { tab++; need(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text(pdfTxt(`Tabla ${tab}. ${cap}`), M, y); y += 2;
    doc.autoTable({ startY: y, head: [head.map(pdfTxt)], body: body.map(r => r.map(c => pdfTxt(c))), margin: { left: M, right: M, top: 24, bottom: 22 }, theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, halign: 'right', lineColor: [221, 214, 216], lineWidth: .2, textColor: INK },
      headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold', halign: 'center' }, alternateRowStyles: { fillColor: [250, 245, 246] } });
    y = doc.lastAutoTable.finalY + 7; };
  const F = (pc, cap) => { const im = chartImage(pc), h = CW * im.ratio; fig++; need(h + 12); doc.addImage(im.url, 'PNG', M, y, CW, h); doc.setDrawColor(221, 214, 216); doc.setLineWidth(.2); doc.rect(M, y, CW, h); y += h + 4.5;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MUTE); doc.splitTextToSize(pdfTxt(`Figura ${fig}. ${cap}`), CW).forEach(l => { doc.text(l, M, y); y += 4.3; }); y += 4; };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RED); doc.text('INFORME DE LABORATORIO', M, y); y += 7;
  doc.setFontSize(17); doc.setTextColor(...INK); doc.splitTextToSize(pdfTxt(TITULO), CW).forEach(l => { doc.text(l, M, y); y += 7.4; });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...MUTE); doc.text(pdfTxt('Instrumentación Industrial · Tecnología en Electrónica · Universidad del Valle, sede Cartago'), M, y); y += 5;
  doc.autoTable({ startY: y, theme: 'plain', margin: { left: M, right: M }, styles: { font: 'helvetica', fontSize: 10, cellPadding: { top: 1.4, bottom: 1.4, left: 0, right: 2 }, textColor: INK },
    columnStyles: { 0: { fontStyle: 'bold', textColor: RED, cellWidth: 34 } },
    body: [['Estudiante', id.name || '—'], ['Código', id.code || '—'], ['Compañeros', id.mates || '—'], ['Grupo', id.group || '—'], ['Fecha', id.date || '—'], ['Banco', D.b ? D.b.id : '—'], ['Docente', 'Dra. María Elena Leyes']].map(r => r.map(pdfTxt)) });
  y = doc.lastAutoTable.finalY + 4; doc.setDrawColor(...RED); doc.setLineWidth(.8); doc.line(M, y, PW - M, y); y += 8;

  H2('1. Resumen'); TXT(D.res, 'Escribe el resumen en el generador del informe');
  H2('2. Objetivos'); P(OBJ);
  H2('3. Marco teórico'); PH_('Presenta los tipos de presión y sus unidades, el principio hidrostático, la balanza de pesos muertos y los transductores, con citas');
  H2('4. Montaje y procedimiento'); PROC.forEach(p => P(p));

  H2('5. Resultados');
  H3('5.1 Calibración del manómetro Bourdon');
  if (D.r1.length) T('Lecturas del manómetro frente a la balanza de pesos muertos.', ['Masa (kg)', 'P patrón (kPa)', 'Lectura (kPa)', 'Sentido'], D.r1.map(r => [fmt(r.m, 1), fmt(r.P, 2), String(r.R), r.dir === 'asc' ? 'Ascendente' : 'Descendente']));
  if (D.a1) { const a = D.a1, A = LAB1.analyze(D.r1);
    P(resumen1(a));
    T('Error e histéresis por punto de calibración.', ['Masa (kg)', 'P patrón (kPa)', 'Lect. asc. (kPa)', 'Lect. desc. (kPa)', 'Error asc. (kPa)', 'Error desc. (kPa)', 'Histéresis (kPa)'], a.det.map(d => [fmt(d.m, 1), fmt(d.P, 2), fmt(d.ra, 0), fmt(d.rd, 0), fmt(d.ea, 1), fmt(d.ed, 1), fmt(d.hy, 1)]));
    F(A.plots[0], 'Curva de error del manómetro en carga ascendente y descendente, con la tolerancia de la clase 1,0.');
    F(A.plots[1], 'Lectura del manómetro frente a la presión patrón y recta de ajuste.');
  } else PH_('Faltan lecturas de la práctica 1: se requieren al menos 10, subiendo y bajando la masa');
  H3('5.2 Principio hidrostático');
  if (D.r2.length) T('Lecturas de presión en el fondo de la columna.', ['h (m)', 'P man (kPa)', 'Delta h Hg (mm)', 'P atm (kPa)'], D.r2.map(r => [fmt(r.h, 3), fmt(r.P, 2), fmt(r.dh, 1), fmt(r.pa, 2)]));
  if (D.a2) { const a = D.a2; P(resumen2(a));
    T('Comparación entre el manómetro digital y el manómetro en U.', ['h (m)', 'P digital (kPa)', 'P por U (kPa)', 'U - digital (kPa)', 'P abs (kPa)'], a.det.map(d => [fmt(d.h, 3), fmt(d.P, 2), fmt(d.PU, 3), fmt(d.dU, 3), fmt(d.Pabs, 2)]));
    F(LAB2.analyze(D.r2).plots[0], 'Presión manométrica en el fondo frente al nivel, recta de ajuste y referencia del agua.');
  } else PH_('Faltan lecturas de la práctica 2: se requieren al menos 8');
  H3('5.3 Transductor piezorresistivo MPX5700AP');
  if (D.r3.length) T('Lecturas del sensor MPX5700AP.', ['P man (kPa)', 'P abs (kPa)', 'Vout (V)', 'N ADC', 'Vs (V)'], D.r3.map(r => [fmt(r.pm, 1), fmt(r.Pa, 2), fmt(r.V, 4), String(r.N), fmt(r.Vs, 3)]));
  if (D.a3) { const a = D.a3, A = LAB3.analyze(D.r3); P(resumen3(a));
    T('Error frente a la hoja de datos y corriente equivalente de un transmisor de 0–600 kPa.', ['P abs (kPa)', 'V medida (V)', 'V hoja (V)', 'Error (mV)', 'Error (kPa)', 'I (mA)'], a.det.map(d => [fmt(d.Pa, 2), fmt(d.V, 4), fmt(d.Vd, 4), fmt(d.eV * 1000, 1), fmt(d.eP, 2), fmt(d.I, 2)]));
    F(A.plots[0], 'Característica del MPX5700AP: lecturas, recta de ajuste y hoja de datos con su tolerancia.'); F(A.plots[1], 'Error del sensor frente a la hoja de datos.');
  } else PH_('Faltan lecturas de la práctica 3: se requieren al menos 7');

  H2('6. Análisis de resultados');
  H3('6.1 Manómetro Bourdon'); TXT(D.t1, 'Escribe el análisis en la página de la práctica 1');
  H3('6.2 Principio hidrostático'); TXT(D.t2, 'Escribe el análisis en la página de la práctica 2');
  H3('6.3 Transductor piezorresistivo'); TXT(D.t3, 'Escribe el análisis en la página de la práctica 3');
  H2('7. Ejercicios'); P(`Puntaje: ${D.nex} de ${EX_KEYS.length} ejercicios correctos.`);
  T('Respuestas a los ejercicios de verificación.', ['Ejercicio', 'Tema', 'Respuesta', 'Estado'], EX_KEYS.map((k, i) => [String(i + 1), EX_TEMA[i], D.ex[k] ? D.ex[k].v : '—', D.ex[k] ? (D.ex[k].ok ? 'Correcto' : 'Incorrecto') : 'Sin responder']));
  H2('8. Conclusiones'); TXT(D.con, 'Escribe las conclusiones en el generador del informe');
  H2('9. Referencias'); REFS.forEach((r, i) => P(`[${i + 1}] ${r}`));

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFillColor(...RED); doc.rect(0, 0, PW, 12, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('UNIVERSIDAD DEL VALLE · SEDE CARTAGO', M, 7.6);
    doc.setFont('helvetica', 'normal'); doc.text(pdfTxt('Instrumentación Industrial · Tecnología en Electrónica'), PW - M, 7.6, { align: 'right' });
    doc.setDrawColor(221, 214, 216); doc.setLineWidth(.3); doc.line(M, PH - 13, PW - M, PH - 13);
    doc.setFontSize(8); doc.setTextColor(...MUTE); doc.text(pdfTxt(`Informe de laboratorio · ${id.name || 'Estudiante'} · ${id.code || ''}`), M, PH - 8.5);
    doc.text(`Página ${i} de ${n}`, PW - M, PH - 8.5, { align: 'right' });
  }
  return doc;
}

let DL_PROMISE = null;
async function savePDF(btn) {
  if (!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable)) { toast('El generador de PDF aún está cargando. Intenta de nuevo en unos segundos.'); return; }
  btn.disabled = true; const label = btn.textContent; btn.textContent = 'Generando PDF…';
  try {
    await new Promise(r => setTimeout(r, 30));
    const id = getId(), doc = buildPDF(), blob = doc.output('blob');
    const fn = `Informe_Presion_${String(id.code || 'estudiante').replace(/[^\w-]/g, '')}.pdf`;
    const dl = await (DL_PROMISE || Promise.resolve(null));
    if (dl) {
      try { await dl.save({ filename: fn, data: blob }); toast('Informe guardado en PDF.'); }
      catch (e) { toast(e && e.code === 'declined' ? 'Descarga cancelada.' : e && e.code === 'rate_limited' ? 'Ya hay una descarga pendiente; espera un momento.' : 'No fue posible guardar el PDF en esta vista.'); }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); toast('Informe descargado en PDF.');
    }
  } catch (err) { console.error(err); toast('No se pudo generar el PDF.'); }
  finally { btn.disabled = false; btn.textContent = label; }
}

/* ====================================================================
   Arranque
   ==================================================================== */
buildToc(); initTheme();
$('#prevBtn').onclick = () => goToPage(cur - 1); $('#nextBtn').onclick = () => goToPage(cur + 1);
$('#pager').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goToPage(+b.dataset.go); });
$('#menuBtn').onclick = openDrawer; $('#scrim').onclick = closeDrawer;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'ArrowRight' && !e.altKey) goToPage(cur + 1); if (e.key === 'ArrowLeft' && !e.altKey) goToPage(cur - 1);
});
(function start() {
  const h = (location.hash || '').slice(1), k = BOOK_DATA.findIndex(p => p.id === h);
  goToPage(k >= 0 ? k : clamp(store.get('page', 0), 0, BOOK_DATA.length - 1), k < 0);
})();
