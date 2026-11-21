/* Ward Round — game engine */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const val = (x, p) => typeof x === 'function' ? x(p) : x;

/* ---------- settings & persistence ---------- */
const S = Object.assign({cats: new Set(['CVS', 'Resp']), n: 3, mode: 'practice', integ: true, pick: '', clerk: 'quick', wait: 'instant', die: false},
  (() => { try { const o = JSON.parse(localStorage.getItem('wardround.opts') || '{}'); return {clerk: o.clerk || 'quick', wait: o.wait || 'instant', die: !!o.die}; } catch (e) { return {}; } })());
const saveOpts = () => { try { localStorage.setItem('wardround.opts', JSON.stringify({clerk: S.clerk, wait: S.wait, die: S.die})); } catch (e) {} };
const store = {
  get() { try { return JSON.parse(localStorage.getItem('wardround.v1')) || {played: {}}; } catch (e) { return {played: {}}; } },
  put(d) { try { localStorage.setItem('wardround.v1', JSON.stringify(d)); } catch (e) {} },
};
const AI = null;     // everything is marked locally: no Claude, no tokens

/* ---------- start screen ---------- */
function initStart() {
  const cats = $('#cats');
  CATS.forEach(c => {
    const n = CASES.filter(k => k.cat[0] === c.id).length;
    const b = document.createElement('button');
    b.className = 'cat'; b.setAttribute('aria-pressed', S.cats.has(c.id));
    b.innerHTML = `<b>${c.name}</b><small>${c.sub} · ${n} cases</small>`;
    b.onclick = () => { S.cats.has(c.id) ? S.cats.delete(c.id) : S.cats.add(c.id); b.setAttribute('aria-pressed', S.cats.has(c.id)); refreshPick(); };
    cats.appendChild(b);
  });
  seg('#segN', [['1', 1], ['3', 3], ['5', 5], ['8', 8]], v => S.n = v, S.n);
  seg('#segMode', [['Practice', 'practice'], ['Timed 10 min', 't10'], ['Timed 15 min', 't15'], ['Timed 20 min', 't20']], v => S.mode = v, S.mode);
  seg('#segInt', [['On', true], ['Off', false]], v => S.integ = v, S.integ);
  seg('#segClerk', [['Quick: skip to the findings', 'quick'], ['Full clerking (OSCE practice)', 'full']], v => { S.clerk = v; saveOpts(); }, S.clerk);
  seg('#segWait', [['Instant, with real turnaround times', 'instant'], ['Real time (1 min = 1 s)', 'real']], v => { S.wait = v; saveOpts(); }, S.wait);
  seg('#segDie', [['Forgiving: your senior steps in', false], ['Patients can die: level failed', true]], v => { S.die = v; saveOpts(); }, S.die);
  $('#pickCase').onchange = e => S.pick = e.target.value;
  refreshPick();
  // coverage
  const played = store.get().played;
  $('#cover').innerHTML = `<details><summary>Every condition covered (${CASES.reduce((a, c) => a + c.covers.length, 0)} conditions in ${CASES.length} cases)</summary>${CATS.map(c => `<p style="margin:10px 0 0"><b>${c.name}</b></p><ul>${CASES.filter(k => k.cat[0] === c.id).map(k => `<li>${esc(k.covers.join(', '))}${played[k.id] ? ` — best ${played[k.id].best}%` : ''}</li>`).join('')}</ul>`).join('')}</details>`;
  $('#goBtn').onclick = startShift;
  initAI();
}
function seg(sel, opts, set, cur) {
  const el = $(sel);
  opts.forEach(([lab, v]) => {
    const b = document.createElement('button'); b.textContent = lab; b.setAttribute('aria-pressed', v === cur);
    b.onclick = () => { set(v); [...el.children].forEach(x => x.setAttribute('aria-pressed', x === b)); };
    el.appendChild(b);
  });
}
function refreshPick() {
  const sel = $('#pickCase'); const cur = sel.value;
  sel.innerHTML = '<option value="">Random from the blocks above</option>' + CATS.filter(c => S.cats.has(c.id)).map(c => `<optgroup label="${c.name}">${CASES.filter(k => k.cat[0] === c.id).map(k => `<option value="${k.id}">${esc(k.title)}</option>`).join('')}</optgroup>`).join('');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
  S.pick = sel.value;
  $('#goBtn').disabled = S.cats.size === 0;
}
const BR = () => typeof Brain !== 'undefined' && Brain.ready;
function initAI() {
  const st = $('#aiStatus');
  const base = 'Marking runs <b>entirely on your device</b>: no account, no AI service, no usage costs.';
  if (typeof Brain === 'undefined' || !window.ort) { st.innerHTML = base + ' Answers are checked against the key points from your notes.'; return; }
  st.innerHTML = base + ' <span class="thinking">Loading the examiner model (about 34 MB, first time only)…</span>';
  Brain.load().then(ok => {
    st.innerHTML = base + (ok ? ' <b>Examiner ready:</b> a small language model on your device reads your answers for meaning, so you can use your own words.' : ' The examiner model could not load here, so answers are checked by key words from your notes.');
  });
}

/* frame the patient beside (desktop) or above (phone) the panel */
function focusView() {
  if (!SHIFT || !P) return;
  const r = $('#panel').getBoundingClientRect();
  if (document.documentElement.classList.contains('mobile')) World.focusBed(SHIFT.bedOf[SHIFT.idx], 0, innerHeight - r.top + 8);
  else World.focusBed(SHIFT.bedOf[SHIFT.idx], r.width + 24, 0);
}
addEventListener('resize', () => { if (P && !$('#game').classList.contains('hide') && World.mode() === 'encounter') setTimeout(focusView, 120); });

/* "patients can die" mode */
function levelFailed() {
  const cr = P.def.crit || {}, fix = (cr.stop || []).map(k => DRUG[k] ? DRUG[k].name : k).slice(0, 4);
  const ov = document.createElement('div'); ov.className = 'failov'; ov.setAttribute('role', 'alertdialog');
  ov.innerHTML = `<div class="failcard"><div class="fl">Level failed</div><h2>${esc(P.p.name)} died at T+${P.t} min</h2>
  <p>${esc(cr.msg || 'They deteriorated while definitive treatment was delayed.')}</p>
  ${fix.length ? `<p class="setting">What would have saved them: <b>${fix.map(esc).join(', ')}</b>, given early. Sick patients don't wait for the clerking: use <b>Orders · treat now</b>.</p>` : ''}
  <div class="row"><button class="btn warn" id="failRetry">Try again with a new patient</button><button class="btn sec" id="failDeb">See the debrief</button></div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  $('#failDeb').onclick = () => { close(); $('#drawer').classList.add('hide'); go('debrief'); };
  $('#failRetry').onclick = () => { close(); $('#drawer').classList.add('hide'); go('debrief'); setTimeout(() => { const a = $('#again'); if (a) a.click(); }, 50); };
}

/* ---------- shift + patient construction ---------- */
/* small memory of recent conditions and patients, so nobody comes back twice */
const MEM = {
  get: k => { try { return JSON.parse(localStorage.getItem('wardround.' + k) || '[]'); } catch (e) { return []; } },
  push: (k, items, max) => { try { const l = items.concat(MEM.get(k).filter(x => !items.includes(x))).slice(0, max); localStorage.setItem('wardround.' + k, JSON.stringify(l)); } catch (e) {} },
};
function freshPatient(def, seed) {
  const seen = new Set(MEM.get('people'));
  let p, tries = 0;
  do { p = buildPatient(def, (seed + tries * 104729) & 0x7fffffff, S.integ, S.cats); tries++; }
  while (tries < 8 && (seen.has(p.name) || seen.has(`${def.id}|${p.age}|${p.sex}|${p.overlay ? p.overlay.id : ''}`)));
  MEM.push('people', [p.name, `${def.id}|${p.age}|${p.sex}|${p.overlay ? p.overlay.id : ''}`], 200);
  return p;
}
let SHIFT = null, P = null, TIMER = null;
function specOf(p, extra) { return Object.assign({name: p.name, first: p.first, sex: p.sex, age: p.age, skin: p.skin, build: p.build, signs: p.signs.slice(), attach: (p.attach || []).slice(), preg: p.preg, v: p.v}, extra || {}); }
function startShift() {
  const pool = CASES.filter(k => k.cat.some(c => S.cats.has(c)));
  let list = [];
  if (S.pick) list = Array(S.n).fill(CASES.find(k => k.id === S.pick));
  else {
    // conditions you haven't seen lately come first; the same condition comes back as a different person
    const recent = MEM.get('recent'), age = id => { const i = recent.indexOf(id); return i < 0 ? 1e9 : i; };
    const sh = mkRng((Date.now() ^ (Math.random() * 1e9)) & 0x7fffffff).shuffle(pool).sort((a, b) => age(b.id) - age(a.id));
    for (let i = 0; i < S.n; i++) list.push(sh[i % sh.length]);
  }
  const t0 = Date.now();
  SHIFT = {list, idx: 0, scores: [], xp: 0, started: t0, pts: list.map((def, i) => freshPatient(def, (t0 ^ (i * 7919)) & 0x7fffffff)), bedOf: []};
  MEM.push('recent', list.map(d => d.id), 40);
  const nb = World.bedCount();
  SHIFT.bedOf = list.map((_, i) => i < nb ? i : -1);
  for (let i = 0; i < nb; i++) World.setBedPatient(i, i < list.length ? specOf(SHIFT.pts[i]) : null);
  $('#start').classList.add('hide'); $('#hud').classList.remove('hide');
  $('#quitBtn').onclick = () => { if (P && P.stage !== 'debrief' && !$('#game').classList.contains('hide')) { finishCase(true); } else endShift(); };
  $('#notesBtn').onclick = () => { $('#drawer').classList.add('hide'); $('#folder').classList.toggle('open'); };
  $('#folder').onclick = e => { if (e.target.closest('#folderClose')) $('#folder').classList.remove('open'); };
  $('#ordersBtn').onclick = () => { $('#folder').classList.remove('open'); if (P && !['manage', 'debrief'].includes(P.stage)) openDrawer(); else if (P && P.stage === 'manage') { const m = $('#mgc'); if (m) { m.scrollIntoView({block: 'start', behavior: 'smooth'}); const i = m.querySelector('input'); if (i) i.focus({preventScroll: true}); } } };
  World.onVisit = bed => { if (SHIFT.bedOf[SHIFT.idx] === bed) loadCase(); };
  toWard();
}
/* back on the floor: mark the next bed, nurse hands over */
function toWard() {
  $('#game').classList.add('hide'); $('#hud').classList.remove('hide'); $('#folder').classList.remove('open');
  if (World.mode() === 'encounter') World.release(); else World.setMode('walk');
  const bed = SHIFT.bedOf[SHIFT.idx]; World.markBed(bed);
  const p = SHIFT.pts[SHIFT.idx];
  $('#hdrPt').innerHTML = `Patient <b>${SHIFT.idx + 1}</b> / ${SHIFT.list.length}`;
  $('#hdrScore2').innerHTML = `Shift XP <b>${SHIFT.xp}</b>`;
  nurseSays(`<b>Sister Dlamini:</b> Bed ${bed + 1} — ${esc(p.name)}, ${p.age < 2 ? Math.round(p.age * 12) + ' months' : p.age}. ${esc(p.brief)} ${p.v.sbp < 90 || p.v.sat < 92 || p.v.gcs < 14 ? 'She looks unwell — go now!'.replace('She', p.sex === 'F' ? 'She' : 'He') : 'Can you see them?'}`);
  hudXP();
}
let bubbleTimer = null;
function nurseSays(html) {
  const b = $('#bubble'); b.innerHTML = html; b.classList.remove('hide');
  clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.add('hide'), 14000);
}
function endShift() {
  clearInterval(TIMER);
  const n = SHIFT.scores.filter(x => x !== undefined).length;
  const avg = n ? Math.round(SHIFT.scores.reduce((a, b) => a + (b || 0), 0) / n) : 0;
  if (n) unlock('shift', 'Survived a shift');
  if (n >= 5) unlock('marathon', 'Marathon: 5 patients in one shift');
  $('#hud').classList.add('hide'); $('#game').classList.remove('hide'); World.setMode('menu');
  $('#stepsHost').innerHTML = ''; $('#wrist').innerHTML = `<div style="flex:1"><div class="nm">Shift report</div><div class="meta">${esc(DOC.name)}</div></div>`;
  $('#main').innerHTML = `<div class="stage"><h2>Shift over</h2><p class="lead">You saw ${n} patient${n === 1 ? '' : 's'} and earned <b>${SHIFT.xp} XP</b>. Average score ${avg}%.</p><div class="card"><div class="bars">${SHIFT.list.slice(0, n).map((k, i) => `<div class="bar"><span>${esc(k.title)}</span><div class="track"><div class="fill" style="width:${SHIFT.scores[i] || 0}%"></div></div><b>${SHIFT.scores[i] || 0}%</b></div>`).join('')}</div></div></div>`;
  actBar('New shift', () => location.reload(), 'Thanks for your shift, doctor.');
}

function egfr(cr, age, sex, ht) {
  if (age < 16) return Math.round(36.5 * (ht || 120) / cr);
  const s = cr / 88.4, k = sex === 'F' ? 0.7 : 0.9, a = sex === 'F' ? -0.241 : -0.302;
  return Math.round(142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(0.9938, age) * (sex === 'F' ? 1.012 : 1));
}
function rangeFor(k, p) {
  const d = LAB[k]; if (!d) return [0, 0]; const alt = d[5] || {};
  if (p.age < 13 && alt.C) return alt.C; if (p.sex === 'F' && alt.F) return alt.F; return [d[2], d[3]];
}
const LOWISH = new Set(['CRP', 'PCT', 'TnT', 'DD', 'VL', 'UPCR', 'UACR', 'bhcg', 'PSA', 'CEA', 'CA125', 'CA153', 'ASOT', 'AntiDNase', 'NTproBNP', 'Eos', 'TG', 'Chol', 'LDL', 'ESR', 'CBil', 'Lact', 'INR']);
function makeLabs(p, r) {
  const L = {};
  for (const k of Object.keys(LAB)) {
    const [lo, hi] = rangeFor(k, p);
    L[k] = LOWISH.has(k) ? lo + (hi - lo) * r.raw() * 0.5 : lo + (hi - lo) * (0.2 + r.raw() * 0.6);
  }
  L.CD4 = r.int(560, 1150); L.VL = 0; L.SaO2 = p.v.sat; L.Gluc = r.f(4.4, 6.6);
  for (const [k, v] of Object.entries(p.lab || {})) L[k] = Array.isArray(v) ? r.f(v[0], v[1], LAB[k] ? LAB[k][4] : 1) : v;
  for (const [k, v] of Object.entries(p.labAdj || {})) L[k] = (L[k] || 0) + v;
  for (const [k, v] of Object.entries(p.labSet || {})) L[k] = v;
  P_derive(L, p);
  return L;
}
function P_derive(L, p) {
  L.Cr = Math.max(15, L.Cr);
  L.eGFR = egfr(L.Cr, p.age, p.sex, p.ht);
  L.AG = L.Na - L.Cl - L.HCO3;
  L.cCa = +(L.Ca + 0.02 * (40 - L.Alb)).toFixed(2);
  if (!p.lab || p.lab.pH === undefined) L.pH = +(6.1 + Math.log10(L.HCO3 / (0.0307 * L.pCO2 * 7.5))).toFixed(2);
  if (L.INR) L.PT = +(11.5 * L.INR).toFixed(1);
}
function buildPatient(def, seed, integ, cats) {
  const r = mkRng(seed);
  const g = def.gen(r);
  const p = Object.assign({flags: {}, meds: [], allergies: [], signs: [], prof: [], hx: [], ex: [], res: {}, lab: {}, labAdj: {}, labSet: {}, attach: [], ecg: {}, cxr: null, xr: null}, g);
  ['flags', 'res', 'lab', 'labAdj', 'labSet', 'ecg'].forEach(k => p[k] = Object.assign({}, p[k]));
  ['meds', 'allergies', 'signs', 'prof', 'hx', 'ex'].forEach(k => p[k] = (p[k] || []).slice());
  p.eth = p.eth || (p.skin >= 4 ? 'african' : r.eth());
  p.skin = p.skin || r.pick(SKIN_FOR[p.eth]); p.build = p.build || r.build();
  p.name = p.name || r.name(p.sex, p.age, p.eth);
  p.first = p.name.replace(/^(Mr|Mrs|Ms) /, '').split(' ')[0];
  const F = p.sex === 'F';
  const PR = {'he/she': F ? 'she' : 'he', 'she/he': F ? 'she' : 'he', 'He/she': F ? 'She' : 'He', 'She/he': F ? 'She' : 'He', 'him/her': F ? 'her' : 'him', 'her/him': F ? 'her' : 'him', 'his/her': F ? 'her' : 'his', 'her/his': F ? 'her' : 'his', 'Her/his': F ? 'Her' : 'His', 'His/her': F ? 'Her' : 'His', '{he}': F ? 'she' : 'he', '{He}': F ? 'She' : 'He', '{his}': F ? 'her' : 'his', '{His}': F ? 'Her' : 'His', '{him}': F ? 'her' : 'him', 'son/daughter': F ? 'daughter' : 'son', 'boy/girl': F ? 'girl' : 'boy', 'husband/wife': F ? 'husband' : 'wife'};
  const fix = s => typeof s === 'string' ? s.replace(/he\/she|she\/he|He\/she|She\/he|him\/her|her\/him|his\/her|her\/his|Her\/his|His\/her|\{he\}|\{He\}|\{his\}|\{His\}|\{him\}|son\/daughter|boy\/girl|husband\/wife/g, m => PR[m]) : s;
  ['pc', 'brief', 'parentName'].forEach(k => p[k] = fix(p[k]));
  p.hx = p.hx.map(h => h.map(fix)); p.ex = p.ex.map(h => h.map(fix)); p.prof = p.prof.map(h => h.map(fix));
  p.v = Object.assign({hr: 78, sbp: 124, dbp: 78, rr: 16, sat: 98, t: 36.7, gcs: 15}, p.v);
  Object.assign(p, anthropometry(r, p));
  p.overlay = null;
  if (integ && !def.noOverlay && r.chance(0.8)) {
    const others = [...cats].filter(c => c !== def.cat[0]);
    let opts = OVERLAYS.filter(o => o.fits(p) && !(def.avoid || []).includes(o.id) && (others.length ? others.includes(o.cat) : true));
    if (!opts.length) opts = OVERLAYS.filter(o => o.fits(p) && !(def.avoid || []).includes(o.id));
    if (opts.length) {
      const o = r.pick(opts); const nHx = p.hx.length, nProf = p.prof.length; o.apply(p, r); p.overlay = o;
      // the overlay's facts replace any base facts on the same topic (no contradictions)
      const added = p.hx.slice(nHx), addedProf = p.prof.slice(nProf);
      const topicKey = t => norm(t).trim().split(' ')[0];
      const keys = new Set(added.map(h => topicKey(h[0])));
      p.hx = p.hx.filter((h, i) => i >= nHx || !keys.has(topicKey(h[0])));
      const words = new Set(added.concat(addedProf.map(x => [x[0]])).flatMap(h => norm(h[0]).trim().split(' ')).filter(w => /^(hiv|pregnan|asthma|diabet|ckd|kidney|warfarin|gout|alcohol|penicillin|ulcer)/.test(w)).map(w => w.slice(0, 5)));
      p.prof = p.prof.filter((x, i) => i >= nProf || !norm(x[0]).trim().split(' ').some(w => words.has(w.slice(0, 5))));
    }
  }
  // standard history items the patient can always answer
  const has = lab => p.hx.some(h => h[0].toLowerCase().includes(lab));
  if (!has('medic') && !has('pills') && !has('treatment')) p.hx.push(['Medication', p.meds.length ? `I take ${p.meds.map(m => { const n = DRUG[m] ? DRUG[m].name.split(' (')[0] : m; return /^[A-Z0-9-]{2,}$/.test(n.split(' ')[0]) ? n : n.toLowerCase(); }).join(', ')}.` : (p.age < 13 ? 'No regular medicine.' : 'No, I don\'t take any regular medicine.'), 0]);
  if (!has('allerg')) p.hx.push(['Allergies', p.allergies.length ? `Yes — ${p.allergies.join(', ')}.` : 'No allergies that I know of.', 0]);
  p.L = makeLabs(p, r);
  p.r = r;
  // everyday detail that changes who walks in, never the medicine
  { const q = mkRng((seed ^ 0x5bd1e995) & 0x7fffffff);
    p.home = p.home || q.pick(['Soweto', 'Tembisa', 'Alexandra', 'Benoni', 'Daveyton', 'Katlehong', 'Diepsloot', 'Hillbrow', 'Mamelodi', 'Lenasia', 'Orange Farm', 'Randburg', 'Germiston', 'Mayfair', 'Kempton Park', 'Vosloorus', 'Ivory Park', 'Roodepoort', 'Eldorado Park', 'Midrand']);
    p.arrival = p.arrival || (def.crit ? q.pick(['by ambulance', 'by private car, driven by family', 'carried in by a neighbour', 'by taxi with a friend']) : q.pick(['referred from the local clinic', 'walked into casualty', 'referred by a GP', 'sent from the outpatient clinic', 'brought by family', 'transferred from a district hospital']));
  }
  return p;
}

/* ---------- case lifecycle ---------- */
const STAGES = [['arrive', 'Arrival'], ['history', 'History'], ['exam', 'Examination'], ['reason', 'Mechanisms'], ['inv', 'Investigations'], ['manage', 'Management'], ['pharm', 'Pharmacology'], ['debrief', 'Debrief']];
const QSTAGES = [['arrive', 'Arrival'], ['clerk', 'History & exam'], ['reason', 'Mechanisms'], ['inv', 'Investigations'], ['manage', 'Management'], ['pharm', 'Pharmacology'], ['debrief', 'Debrief']];
const stages = () => (P && P.quick ? QSTAGES : STAGES);
function loadCase() {
  clearInterval(TIMER);
  const def = SHIFT.list[SHIFT.idx];
  const p = SHIFT.pts[SHIFT.idx];
  P = {def, p, t: 0, stage: 'arrive', pts: {}, max: {}, log: [], given: [], ordered: {}, asked: new Set(), examined: new Set(), flags: new Set(), notes: [], harms: 0, crashed: false, quick: S.clerk === 'quick', chat: [], profPicked: new Set(), qdone: {}, reveal: []};
  P.mustGiven = new Set();
  $('#hdrCase').textContent = '';
  $('#hud').classList.add('hide'); $('#game').classList.remove('hide'); $('#bubble').classList.add('hide');
  focusView();
  P.realStart = Date.now();
  if (S.mode !== 'practice') {
    const mins = +S.mode.slice(1); P.deadline = Date.now() + mins * 60000; $('#hdrTimer').classList.remove('hide');
    TIMER = setInterval(() => {
      const left = Math.max(0, P.deadline - Date.now());
      $('#hdrTimer').textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} left`;
      $('#hdrTimer').classList.toggle('warn', left < 60000);
      if (left <= 0 && P.stage !== 'debrief') { clearInterval(TIMER); event_('harm', 'Time is up', 'Your registrar has taken over the patient. Anything you hadn\'t done scores zero.'); finishCase(true); }
    }, 1000);
  } else $('#hdrTimer').classList.add('hide');
  $('#drawer').classList.add('hide');
  renderBed(); renderFolder(); go('arrive');
}
function go(stage) { P.stage = stage; actBar(null); $('#ordersBtn').classList.toggle('hide', ['manage', 'debrief'].includes(stage)); renderSteps(); ({arrive: stArrive, clerk: stClerk, history: stHistory, exam: stExam, reason: stReason, inv: stInv, manage: stManage, pharm: stPharm, debrief: stDebrief})[stage](); $('#main').scrollTop = 0; $('#main').focus({preventScroll: true}); updScore(); }
function renderSteps() {
  const ST = stages(), i = ST.findIndex(s => s[0] === P.stage);
  const html = `<nav class="steps" aria-label="Case stages">${ST.map((s, k) => `<button disabled class="${k < i ? 'done' : k === i ? 'cur' : ''}"><i>${k < i ? '✓' : k + 1}</i>${s[1]}</button>`).join('')}</nav>`;
  const h = $('#stepsHost'); if (h) { h.innerHTML = html; const c = h.querySelector('.cur'); if (c) c.scrollIntoView({inline: 'center', block: 'nearest'}); }
  return '';
}
function setMain(html) { renderSteps(); $('#main').innerHTML = `<div class="stage">${html}</div>`; }
/* the one obvious way forward: the big button at the bottom of the panel */
function actBar(label, fn, hint) {
  const b = $('#nextAct'), h = $('#actHint');
  if (!label) { b.disabled = true; b.classList.remove('ready'); b.textContent = 'Continue'; h.textContent = 'Finish the questions above to continue.'; b.onclick = null; return b; }
  b.disabled = false; b.classList.add('ready'); b.textContent = label + ' →'; h.textContent = hint || 'Done here — move on when you\'re ready.';
  b.onclick = () => { b.disabled = true; b.classList.remove('ready'); fn(); };
  return b;
}
function award(key, got, max) { P.pts[key] = (P.pts[key] || 0) + got; P.max[key] = (P.max[key] || 0) + max; updScore(); }
function pct() { const g = Object.values(P.pts).reduce((a, b) => a + b, 0), m = Object.values(P.max).reduce((a, b) => a + b, 0); return m ? Math.max(0, Math.round(100 * g / m)) : 0; }
function updScore() { $('#hdrScore').innerHTML = `Score <b>${pct()}%</b>`; $('#hdrClock').innerHTML = `🕑 <b>T+${P.t}</b> min`; }

/* ---------- bedside panel ---------- */
function attachments() {
  const a = new Set(P.p.attach);
  const g = new Set(P.given);
  if (g.has('oxygen_nrb')) a.add('nrb'); else if (g.has('oxygen_venturi')) a.add('venturi'); else if (g.has('oxygen_fm')) a.add('mask'); else if (g.has('oxygen_np')) a.add('prongs');
  if (P.nebUntil && P.t < P.nebUntil) a.add('neb');
  if (P.given.some(k => /iv|fluid|blood|platelets|ffp|f8|f9|artesunate|ceftri|hydrocort|methylpred|vanco|genta|meropen|piptaz|cefaz|cagluc|insdex|noradren|dobutamine|morphine|enox|ufh|streptok|alteplase|txa|terlipressin|octreotide|albumin|ampho|benzpen|ppi/.test(k))) a.add('iv');
  if (P.ordered.ECG) a.add('leads');
  if (g.has('proc_spine')) a.add('collar');
  if (g.has('proc_intub')) { a.add('tube'); a.delete('nrb'); a.delete('mask'); }
  return [...a];
}
function renderBed() {
  const p = P.p, v = p.v;
  const al = p.allergies.length;
  $('#wrist').className = 'wrist' + (al ? ' allergy' : '');
  $('#wrist').innerHTML = `<div style="flex:1"><div class="nm">${esc(p.name)}</div><div class="meta">${p.age < 2 ? Math.round(p.age * 12) + ' months' : p.age + ' y'} · ${p.sex === 'F' ? 'Female' : 'Male'} · Folder ${String(Math.round(40000 + (p.age * 731 + p.ht * 13) % 60000)).padStart(6, '0')}</div></div>${al ? `<span class="al">ALLERGY: ${esc(p.allergies.join(', '))}</span>` : ''}`;
  const signs = p.signs.slice().concat(P.extraSigns || []);
  if (SHIFT && SHIFT.bedOf[SHIFT.idx] >= 0) World.updatePatient(SHIFT.bedOf[SHIFT.idx], specOf(p, {signs, attach: attachments(), v: v}));
  { const bl = p.build === 'cachectic' ? 'wasted' : p.build, tone = /obese|wasted|thin/.test(bl) ? 'bad' : /overweight/.test(bl) ? 'mid' : 'ok';
    $('#anth').innerHTML = $('#anthM').innerHTML = `<div class="an"><small>Weight</small><b>${p.wt}<i> kg</i></b></div><div class="an"><small>Height</small><b>${p.ht}<i> cm</i></b></div>${p.bmi ? `<div class="an bmi"><small>BMI</small><b>${p.bmi}</b></div>` : ''}<div class="an tone-${tone}"><small>Build</small><b>${esc(bl)}</b></div>`; }
  const a = p.age, [hrHi, hrLo, rrHi, sbpLo] = a < 1 ? [180, 100, 60, 65] : a < 6 ? [150, 80, 40, 70 + 2 * a] : a < 13 ? [130, 70, 30, 70 + 2 * a] : [120, 50, 25, 90];
  const alarm = {hr: v.hr > hrHi || v.hr < hrLo, bp: v.sbp < sbpLo || v.sbp > 180, sat: v.sat < 92, rr: v.rr > rrHi || v.rr < 10, t: v.t >= 38.5 || v.t < 35.5, gcs: v.gcs < 13};
  const o2 = attachments().find(x => ['prongs', 'mask', 'nrb', 'venturi', 'tube'].includes(x));
  $('#monitor').innerHTML = `<div class="m ${alarm.hr ? 'alarm' : ''}"><small>HR /min</small><b>${Math.round(v.hr)}</b></div><div class="m bp ${alarm.bp ? 'alarm' : ''}"><small>BP mmHg</small><b>${Math.round(v.sbp)}/${Math.round(v.dbp)}</b></div><div class="m sat ${alarm.sat ? 'alarm' : ''}"><small>SpO₂ ${o2 ? '(on O₂)' : 'room air'}</small><b>${Math.round(v.sat)}%</b></div><div class="m rr ${alarm.rr ? 'alarm' : ''}"><small>RR /min</small><b>${Math.round(v.rr)}</b></div><div class="m t ${alarm.t ? 'alarm' : ''}"><small>Temp °C</small><b>${(+v.t).toFixed(1)}</b></div><div class="m ${alarm.gcs ? 'alarm' : ''}"><small>GCS</small><b>${Math.round(v.gcs)}</b></div>`;
  $('#setting').textContent = p.setting || '';
}
function clampV(v) { v.hr = Math.max(0, Math.min(220, v.hr)); v.sbp = Math.max(30, Math.min(260, v.sbp)); v.dbp = Math.max(15, Math.min(150, Math.min(v.dbp, v.sbp - 15))); v.sat = Math.max(50, Math.min(100, v.sat)); v.rr = Math.max(4, Math.min(60, v.rr)); v.gcs = Math.max(3, Math.min(15, v.gcs)); }
function applyFx(fx) {
  if (!fx) return;
  const v = P.p.v, L = P.p.L;
  for (const [k, d] of Object.entries(fx.v || {})) { v[k] += d; if (k === 'sbp') v.dbp += d * 0.6; }
  for (const [k, d] of Object.entries(fx.set || {})) v[k] = d;
  for (const [k, d] of Object.entries(fx.lab || {})) { L[k] = +(L[k] + d).toFixed(LAB[k] ? LAB[k][4] : 1); }
  for (const [k, d] of Object.entries(fx.labSet || {})) L[k] = d;
  if (fx.lab && fx.lab.K) P.kChanged = true;
  P_derive(L, P.p);
  if (fx.sign) { P.extraSigns = (P.extraSigns || []).concat(fx.sign); }
  if (fx.unsign) { P.p.signs = P.p.signs.filter(s => !fx.unsign.includes(s)); P.extraSigns = (P.extraSigns || []).filter(s => !fx.unsign.includes(s)); }
  if (fx.flags) Object.assign(P.p.flags, fx.flags);
  if (fx.ecg) Object.assign(P.p.ecg, fx.ecg);
  clampV(v); renderBed();
}
/* time + deterioration */
function advance(min) {
  const cr = P.def.crit;
  for (let i = 0; i < min; i += 5) {
    P.t += Math.min(5, min - i);
    if (cr && !P.stabilised && (!cr.when || cr.when(P.p)) && P.t >= (cr.after || 0)) {
      const stopped = (cr.stop || []).some(k => P.given.includes(k) || P.given.some(g => DRUG[g] && DRUG[g].cls.includes(k)));
      if (stopped) { P.stabilised = true; continue; }
      if (P.t % (cr.every || 10) < 5) {
        applyFx({v: cr.fx});
        const v = P.p.v;
        if (!P.crashed && (v.sbp < (cr.crashSbp || 60) || v.sat < 75 || v.gcs < 7)) {
          P.crashed = true; P.stabilised = true;
          if (S.die && !P.died) {
            P.died = true; award('safety', -30, 0); shake(1);
            applyFx({set: {hr: 0, sbp: 0, dbp: 0, sat: 0, rr: 0, gcs: 3}});
            event_('harm', 'Cardiac arrest — the patient died', cr.msg || 'Definitive treatment came too late.');
            setTimeout(levelFailed, 700);
            return;
          }
          event_('harm', 'Peri-arrest — your senior took over', cr.msg || 'The patient deteriorated while definitive treatment was delayed.');
          award('safety', -15, 0); shake(1);
          (cr.stop || []).slice(0, 1).forEach(k => { if (DRUG[k]) P.given.push(k); });
          applyFx({v: cr.rescue || {sbp: +35, hr: -25, sat: +8, gcs: +4}});
        }
      }
    }
  }
  updScore(); renderBed();
}
function shake(level) {
  const el = $('#panel'); if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate([{transform: 'translateX(0)'}, {transform: `translateX(${-6 * level}px)`}, {transform: `translateX(${6 * level}px)`}, {transform: `translateX(${-3 * level}px)`}, {transform: 'translateX(0)'}], {duration: 380});
}

/* ---------- clerking folder ---------- */
function note(sec, text, key, id) { P.notes.push({sec, text, key: !!key, id}); renderFolder(); }
function renderFolder() {
  const secs = ['Profile', 'History', 'Exam', 'Investigations', 'Orders', 'Events'];
  const nn = P.notes.length; const nb = $('#notesBtn'); if (nb) nb.innerHTML = `Notes${nn ? ` <span class="cnt">${nn}</span>` : ''}`;
  $('#folder').innerHTML = `<div class="fhd"><h3>Clerking notes · ${esc(P.p.name.split(' ').slice(-1)[0])}</h3><button class="btn sec" id="folderClose">Close notes</button></div><div class="sheet">${secs.map(s => { const n = P.notes.filter(x => x.sec === s); return n.length ? `<div class="sec">${s}</div>` + n.map(x => `<div class="ln ${P.flags.has(x.id) ? 'key' : ''}"><span class="k">${P.flags.has(x.id) ? '★ ' : '· '}${esc(x.text)}</span></div>`).join('') : ''; }).join('') || '<span style="opacity:.6">Your notes build up here as you clerk.</span>'}</div>`;
}
function event_(sev, title, msg) {
  P.log.push({t: P.t, sev, title, msg});
  note('Events', `T+${P.t}: ${title}`, sev === 'harm');
  document.querySelectorAll('.feed').forEach(f => f.insertAdjacentHTML('beforeend', evHTML(P.log[P.log.length - 1])));
}

/* ---------- grading ---------- */
function norm(s) { return ' ' + String(s).toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9α-ωµ⁺+\-\/ ]+/g, ' ').replace(/\s+/g, ' ') + ' '; }
function kwScore(ans, kw) {
  if (!kw || !kw.length) return {score: ans.trim().length > 20 ? 0.5 : 0, hit: [], miss: []};
  const a = norm(ans); const hit = [], miss = [];
  kw.forEach(g => { const alts = g.split('|'); (alts.some(x => a.includes(norm(x).trim())) ? hit : miss).push(alts[0]); });
  return {score: hit.length / kw.length, hit, miss};
}
function parseJSON(t) { const m = String(t).match(/\{[\s\S]*\}/); if (!m) throw new Error('no json'); return JSON.parse(m[0]); }
function caseContext() {
  const p = P.p;
  return `Patient: ${p.age}-year-old ${p.sex === 'F' ? 'female' : 'male'}${p.preg ? `, ${p.preg} weeks pregnant` : ''}. Working diagnosis (hidden from student): ${P.def.dx}. ${p.overlay ? 'Comorbidity: ' + p.overlay.label + '.' : ''} Setting: South African public hospital, GEMP 1 integrated exam (Wits).`;
}
/* ---------- is this a real answer? (blocks keyboard-mash and random letters) ---------- */
let VOCAB = null;
const COMMON = ('a an the and or but if of to in on at by for with from as is are was were be been it its this that these those he she they we you i his her their our my your me him them us not no yes do does did done have has had will would can could should may might must because so then than when where why how what which who whom whose there here very more most less least much many some any all each both few other such only own same just also again further once about above below over under between into through during before after up down out off on again too because due cause causes caused leads lead leading result results resulting increase increased decrease decreased high low raised reduced normal abnormal give gives given take stop start treat treatment manage management first line patient patients blood heart lung lungs kidney liver brain pain fever cough body cell cells disease drug drugs dose risk sign signs symptom symptoms test tests make makes made get gets ask check look listen feel examine').split(' ');
function buildVocab() {
  VOCAB = new Set(COMMON.map(w => w.slice(0, 5)));
  const add = t => String(t).toLowerCase().replace(/[^a-z0-9α-ω ]+/g, ' ').split(/\s+/).forEach(w => { if (w.length >= 2) VOCAB.add(w.slice(0, 5)); });
  CASES.forEach(c => { add(JSON.stringify([c.dx, c.syn, c.dxKw, c.dxWhy, c.susp, c.suspKw, c.Q, c.summary, c.covers, c.title, c.must])); try { const g = c.gen(mkRng(7)); add(JSON.stringify([g.hx, g.ex, g.prof, g.pc, g.brief])); } catch (e) {} });
  if (typeof FORMULARY_SRC === 'string') add(FORMULARY_SRC);
  Object.values(INV).forEach(d => add(d[0]));
}
function isJunk(ans) {
  if (!VOCAB) buildVocab();
  const words = String(ans).toLowerCase().replace(/[^a-z0-9α-ω ]+/g, ' ').split(/\s+/).filter(w => w.length >= 2);
  if (!words.length) return true;
  const real = words.filter(w => VOCAB.has(w.slice(0, 5)) || /^\d+(\.\d+)?$/.test(w));
  return real.length < 1 || real.length / words.length < 0.5;
}
/* turn a long model answer into short, scannable lines */
function fmt(text) {
  const parts = String(text).split(/(?<=[.;])\s+(?=[A-Z0-9(“"])/).map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) return `<p>${hl(esc(text))}</p>`;
  return `<ul class="pts">${parts.map(x => `<li>${hl(esc(x))}</li>`).join('')}</ul>`;
}
function hl(h) { return h.replace(/^([^:<]{2,48}):\s/, '<b>$1:</b> ').replace(/(→)/g, '<span class="arr">→</span>'); }
const JUNK_MSG = 'That doesn\'t read as an answer, so it scores 0. Write what you actually think, even if you\'re unsure. Guessing in real words is fine.';

/* Render a typed question; resolves with points earned */
function askQ(host, q, opts = {}) {
  return new Promise(resolve => {
    const id = 'q' + Math.random().toString(36).slice(2, 8);
    const text = val(q.q, P.p), model = val(q.a, P.p);
    const n = (P.qn = (P.qn || 0) + 1);
    const box = document.createElement('div'); box.className = 'q'; box.id = id;
    box.innerHTML = `<div class="qn">Question ${n} · ${opts.label || 'Short answer'} · ${opts.max || 10} marks</div><p class="qt">${esc(text)}</p><label class="sr" for="${id}a">Your answer</label><textarea id="${id}a" placeholder="Type your answer…"></textarea><div class="row"><button class="btn" id="${id}s">Submit answer</button><button class="btn sec" id="${id}h">Hint</button><button class="btn sec" id="${id}k">I don't know</button></div><div class="hint hide" id="${id}hint"></div><div id="${id}r"></div>`;
    host.appendChild(box);
    const ta = box.querySelector('textarea'); ta.focus({preventScroll: true});
    setTimeout(() => { const m = $('#main'), r = box.getBoundingClientRect(), mr = m.getBoundingClientRect(); if (r.top > mr.bottom - 120) box.scrollIntoView({behavior: 'smooth', block: 'nearest'}); }, 350);
    const out = box.querySelector(`#${id}r`);
    const max = opts.max || 10;
    box.querySelector(`#${id}h`).onclick = e => { const h = box.querySelector(`#${id}hint`); h.innerHTML = hintFor(text, opts.label || '', model, q.kw || []); h.classList.remove('hide'); e.target.disabled = true; P.hints = (P.hints || 0) + 1; ta.focus({preventScroll: true}); };
    const submit = async (dontKnow) => {
      const ans = dontKnow ? '' : ta.value.trim();
      if (!dontKnow && !ans) { ta.focus(); return; }
      box.querySelectorAll('button').forEach(b => b.disabled = true); ta.readOnly = true;
      out.innerHTML = '<p class="thinking">Marking…</p>';
      let g;
      if (dontKnow) g = {score: 0, verdict: 'incorrect', feedback: 'No problem — study the explanation below.', missing: []};
      else if (isJunk(ans)) g = {score: 0, verdict: 'incorrect', feedback: JUNK_MSG, missing: [], junk: true};
      else {
        const k = kwScore(ans, q.kw);
        if (opts.synonyms && opts.synonyms.some(s => norm(ans).includes(norm(s).trim()))) k.score = Math.max(k.score, 0.8);
        let miss = k.miss;
        if (BR()) {
          try {
            const c = await Brain.cover(ans, model, 0.5);
            const sem = Math.min(1, c.score * 1.3);
            if (sem > k.score) { k.score = sem; miss = c.miss.slice(0, 4); }
            else if (k.score < 1 && c.hit.length) miss = k.miss.filter(m => !c.hit.some(h => norm(h).includes(norm(m).trim())));
          } catch (e) {}
        }
        if (!g) g = {score: k.score, verdict: k.score >= 0.75 ? 'correct' : k.score >= 0.4 ? 'partial' : 'incorrect', feedback: miss.length ? `Points you didn't mention: ${miss.join('; ')}.` : 'You covered the key points.', missing: miss, why: ''};
      }
      const got = Math.round(g.score * max);
      award(opts.key || 'q', got, max);
      const label = g.verdict === 'correct' ? 'Correct' : g.verdict === 'partial' ? 'Partly right' : 'Not quite';
      out.innerHTML = `<div class="verdict ${g.verdict}"><h4>${label} — ${got}/${max}</h4><div>${esc(g.feedback)}</div></div>`;
      if (g.score >= 0.5) {
        const why = g.why || q.why || 'Why? Explain the mechanism behind your answer.';
        out.insertAdjacentHTML('beforeend', `<div class="q" style="margin-top:12px;border-style:dashed"><div class="qn">follow-up · why? · 5 marks</div><p class="qt">${esc(why)}</p><textarea id="${id}w" placeholder="Explain why…"></textarea><div class="row"><button class="btn" id="${id}ws">Submit</button><button class="btn sec" id="${id}wk">I don't know why</button></div><div id="${id}wr"></div></div>`);
        const wta = out.querySelector(`#${id}w`); wta.focus({preventScroll: true});
        const wsub = async (dk) => {
          const wans = dk ? '' : wta.value.trim(); if (!dk && !wans) return;
          out.querySelectorAll(`#${id}ws,#${id}wk`).forEach(b => b.disabled = true); wta.readOnly = true;
          const wr = out.querySelector(`#${id}wr`); wr.innerHTML = '<p class="thinking">Marking…</p>';
          let w = null;
          if (!dk && isJunk(wans)) w = {score: 0, feedback: JUNK_MSG, explanation: model};
          else if (dk) w = {score: 0, feedback: 'No problem: read the explanation.', explanation: model};
          else if (BR()) {
            try {
              const c = await Brain.cover(wans, model, 0.5); const kk = kwScore(wans, q.kw);
              const sc = Math.max(Math.min(1, c.score * 1.5), kk.score >= 0.6 ? 0.4 : 0);
              w = {score: sc, feedback: c.hit.length ? `You explained: ${c.hit.slice(0, 3).join('; ')}.${c.miss.length ? ` Still missing: ${c.miss.slice(0, 3).join('; ')}.` : ''}` : 'Your explanation didn\'t match the mechanism in the notes.', explanation: model};
            } catch (e) {}
          }

          if (w) {
            const wg = Math.round(Math.max(0, Math.min(1, +w.score || 0)) * 5); award(opts.key || 'q', wg, 5);
            wr.innerHTML = `<div class="verdict ${wg >= 4 ? 'correct' : wg >= 2 ? 'partial' : 'incorrect'}"><h4>${wg}/5</h4>${esc(w.feedback)}</div><div class="explain"><h5>Why — explained</h5>${fmt(w.explanation)}</div><details class="explain"><summary>Model answer (from the notes)</summary>${fmt(model)}</details>`;
            finish();
          } else {
            const kk = isJunk(wans) ? {score: 0} : kwScore(wans, q.kw);
            wr.innerHTML = `<div class="explain"><h5>Model answer (from the notes)</h5>${fmt(model)}</div><div class="row"><span>Did your explanation match?</span><button class="btn sec" data-s="5">Yes</button><button class="btn sec" data-s="2">Partly</button><button class="btn sec" data-s="0">No</button></div>`;
            wr.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { award(opts.key || 'q', dk ? 0 : Math.max(+b.dataset.s, kk.score >= 0.6 ? 2 : 0), 5); wr.querySelectorAll('[data-s]').forEach(x => x.disabled = true); finish(); });
          }
        };
        out.querySelector(`#${id}ws`).onclick = () => wsub(false); out.querySelector(`#${id}wk`).onclick = () => wsub(true);
      } else {
        out.insertAdjacentHTML('beforeend', `${g.missing && g.missing.length ? `<div class="explain miss"><h5>What you missed</h5><ul class="pts">${g.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}<div class="explain"><h5>Study this — model answer from the notes</h5>${fmt(model)}</div>`);
        award(opts.key || 'q', 0, 5);
        finish();
      }
      function finish() { P.qdone[id] = true; resolve(got); }
    };
    box.querySelector(`#${id}s`).onclick = () => submit(false);
    box.querySelector(`#${id}k`).onclick = () => submit(true);
  });
}
function nextBtn(host, label, fn) { return actBar(label, fn); }
/* what is this question really asking? (never gives the answer away) */
function hintFor(text, label, model, kw) {
  const t = text.toLowerCase(), out = [];
  if (/mechanism|pathophys|how does|how do|why does|why do|explain why|lead to|cause the|causes the|produce/.test(t)) out.push('They want a <b>chain of cause and effect</b>: the trigger, what changes in the cells or organ, and how that change produces the symptoms or signs. Write it as steps: A leads to B leads to C.');
  else if (/interpret|result|abg|ecg|x-ray|film|what do the|what does the/.test(t)) out.push('Go result by result: say <b>what is abnormal</b>, what it means, then pull it together into one conclusion.');
  else if (/manag|treat|what would you do|next step|initial/.test(t)) out.push('Give the steps <b>in order</b>: what you do right now (ABC, the first drug with dose and route), then definitive treatment, then monitoring and follow-up.');
  else if (/complication|go wrong|risk of|danger/.test(t)) out.push('Think <b>early vs late</b> complications, and complications of the treatment itself. Say why each happens.');
  else if (/differential|diagnos|suspect/.test(t)) out.push('Name your <b>main diagnosis first</b>, back it with 2–3 features from this patient, then give 1–2 differentials and what makes them less likely.');
  else if (/drug|pharmac|side effect|adverse|class|act\b|acts|interaction|contraindic/.test(t)) out.push('Cover <b>class → mechanism of action → key side effects / interactions</b>, linked to this patient where it matters.');
  else if (/risk factor|why this patient|profile|predispos/.test(t)) out.push('Link <b>this patient\'s</b> details (age, sex, habits, other illnesses, medicines) to the condition, and say why each matters.');
  else if (/patholog|histolog|gross|microscop|morpholog/.test(t)) out.push('Describe what the tissue looks like: <b>gross</b> (to the eye) and <b>microscopic</b>, and tie it to the disease process.');
  else out.push('Answer in short, specific points rather than a general paragraph. Use the patient in front of you.');
  if (/\bdescribe\b/.test(t)) out.push('"Describe" means full sentences that explain, not a one-word list.');
  if (/\blist\b|\bname\b/.test(t)) out.push('"List / name" means short points are fine.');
  if (/\bwhy\b/.test(t)) out.push('Every "why" needs a <b>because</b>.');
  const n = Math.max(kw.length, Math.min(6, (model.match(/[.;]/g) || []).length));
  if (n) out.push(`The marking looks for about <b>${n} key point${n > 1 ? 's' : ''}</b>.`);
  const pick = kw.length ? kw[(P.qn || 0) % kw.length] : '';
  const word = pick ? pick.split('|').sort((a, b) => b.length - a.length)[0].replace(/[^a-z0-9 ]/gi, '').trim() : '';
  if (word.length > 4 && !/diagnos|suspect/.test(t)) out.push(`One of them starts with <b>"${esc(word.slice(0, 3))}…"</b>`);
  return `<b>Hint</b><ul>${out.map(x => `<li>${x}</li>`).join('')}</ul>`;
}

/* ---------- free-text matching (offline fallback for typed/spoken answers) ---------- */
const STOPW = new Set(('the and with for that this have has had was were are been from your you not but any all can his her him she they them their there then than when what which who will would about into over under after before some more most very just also only does did done being such each other our out off per via its use used get got yes doctor tell told since years year month months week weeks days day hours hour times time every always never little really think feel feels felt like know said says one two three lot bit much many make made going went come came take took give gave has patient patients mother father child baby '
).split(' '));
function stems(s) { return norm(s).trim().split(' ').filter(w => (w.length >= 3 || /\d/.test(w)) && !STOPW.has(w)).map(w => w.slice(0, 5)); }
/* returns indices of items whose content the answer mentions */
function matchItems(ans, items) {
  const A = new Set(stems(ans));
  const out = [];
  items.forEach((t, i) => {
    const T = [...new Set(stems(t))]; if (!T.length) return;
    const m = T.filter(w => A.has(w));
    if (m.length >= 2 || (m.length === 1 && (T.length <= 3 || m[0].length >= 5))) out.push(i);
  });
  return out;
}
async function whichMentioned(ans, items, task) {
  const ids = new Set(matchItems(ans, items));
  if (BR()) { try { (await Brain.match(ans, items, 0.55)).ids.forEach(i => ids.add(i)); } catch (e) {} }
  return [...ids].sort((a, b) => a - b);
}
/* a typed (or spoken) input row: returns {el, input} */
function inputRow(id, ph, btn, multi) {
  return `<div class="ask${multi ? ' multi' : ''}"><label class="sr" for="${id}">${esc(ph)}</label>${multi ? `<textarea id="${id}" placeholder="${esc(ph)}"></textarea>` : `<input id="${id}" placeholder="${esc(ph)}" autocomplete="off">`}<button class="btn mic hide" data-mic="${id}" aria-label="Speak instead of typing" title="Speak">speak</button><button class="btn" id="${id}Go">${esc(btn)}</button></div>`;
}
function wireMic(scope) { if (window.wireVoice) window.wireVoice(scope || document); }

/* ---------- STAGE 1: arrival ---------- */
function profileLetter(p) {
  const r = mkRng((p.wt * 31) | 0);
  const lines = r.shuffle(p.prof.map(x => x[0]));
  const ethName = {african: 'Black African', coloured: 'Coloured', white: 'White', indian: 'Indian', muslim: 'Indian (Muslim)'}[p.eth] || '';
  return `<div class="letter"><div class="lt-hd"><span>${esc(p.setting || 'Ward')}</span><span>T+${P.t} min</span></div>
  <p><b>${esc(p.name)}</b>, ${p.age < 2 ? Math.round(p.age * 12) + ' months' : p.age + ' years'}, ${p.sex === 'F' ? 'female' : 'male'}${ethName ? ', ' + ethName : ''}${p.job ? ' · ' + esc(p.job) : ''}${p.age < 13 ? ` · brought by ${esc(p.parentName || 'mother')}` : ''}</p>${p.home ? `<p class="setting" style="margin:-4px 0 6px">From ${esc(p.home)} · came ${esc(p.arrival)}</p>` : ''}
  <p class="lt-brief">${esc(p.brief)}</p>
  <div class="facts">${lines.map(l => `<span>${esc(l)}</span>`).join('')}</div></div>`;
}
function stArrive() {
  const p = P.p, v = p.v;
  setMain(`<h2>${p.age < 13 ? 'A child is brought in' : 'A patient comes in'}</h2><p class="lead">If the patient looks unstable, press <b>Orders · treat now</b> (beside the monitor) and treat — sick patients won't wait for the full clerking.</p>
  <div class="plate"><div class="tag">triage</div><div class="triage"><div><small>hr</small><b>${v.hr}</b></div><div><small>bp</small><b>${v.sbp}/${v.dbp}</b></div><div><small>rr</small><b>${v.rr}</b></div><div><small>spo₂</small><b>${v.sat}%</b></div><div><small>temp</small><b>${v.t}</b></div><div><small>gcs</small><b>${v.gcs}</b></div><div><small>kg</small><b>${p.wt}</b></div></div></div>
  <blockquote class="quote">${esc(p.pc)}</blockquote>
  ${profileLetter(p)}
  <div class="q"><div class="qn">profile · 10 marks</div><p class="qt">Which parts of this patient's profile are significant, and why? Write them down — who they are matters for what you suspect.</p>${inputRow('profIn', 'e.g. 58-year-old male smoker with diabetes — high cardiovascular risk…', 'Submit', true)}<div id="profOut"></div></div><div id="arriveQ"></div>`);
  wireMic($('#main'));
  $('#profInGo').onclick = async () => {
    const ans = $('#profIn').value.trim(); if (!ans) { $('#profIn').focus(); return; }
    $('#profInGo').disabled = true; $('#profIn').readOnly = true; $('#profOut').innerHTML = '<p class="thinking">Marking…</p>';
    const junk = isJunk(ans);
    const ids = new Set(junk ? [] : await whichMentioned(ans, p.prof.map(x => x[0]), 'Which of these patient-profile features did the student identify as significant?'));
    let hit = 0, tot = 0, wrong = 0; const why = [];
    p.prof.forEach(([lab, sig, w], i) => {
      const on = ids.has(i); if (sig) tot++;
      if (sig && on) hit++; else if (!sig && on) wrong++;
      if (sig || on) why.push(`<li class="${sig && on ? 'hit' : sig ? 'miss' : 'wrong'}"><span class="mk">${sig && on ? 'got' : sig ? 'missed' : 'not key'}</span> <b>${esc(lab)}</b> — ${sig ? esc(w || 'significant') : 'not especially relevant here' + (w && w !== '—' ? ': ' + esc(w) : '')}</li>`);
      if (on) { note('Profile', lab, sig); if (sig) P.flags.add('p' + i); }
    });
    const got = Math.max(0, Math.round(10 * (hit - 0.5 * wrong) / Math.max(1, tot))); award('profile', got, 10);
    $('#profOut').innerHTML = `<div class="verdict ${got >= 8 ? 'correct' : got >= 4 ? 'partial' : 'incorrect'}"><h4>${hit}/${tot} significant features${wrong ? `, ${wrong} not relevant` : ''} — ${got}/10</h4>${junk ? JUNK_MSG : ''}</div><ul class="whylist marks">${why.join('')}</ul>`;
    advance(2);
    const host = $('#arriveQ');
    if (P.quick) nextBtn(host, 'See the history & exam', () => go('clerk'));
    else nextBtn(host, 'Take a history', () => go('history'));
  };
}

/* ---------- quick revision: history + exam handed to you, then the diagnosis ---------- */
function stClerk() {
  const p = P.p, v = p.v;
  const who = p.age < 13 ? `${esc(p.parentName || 'The mother')} (collateral)` : esc(p.first);
  const hx = p.hx.map((h, i) => { P.asked.add(i); note('History', `${h[0]}: ${h[1]}`, 0, 'h' + i); return `<li><b>${esc(h[0])}</b>${esc(h[1])}</li>`; }).join('');
  const sys = [...new Set(p.ex.map(e => e[0]))];
  const ex = sys.map(sy => { P.examined.add(sy); const t = p.ex.filter(e => e[0] === sy).map(e => e[1]).join(' '); note('Exam', `${sy}: ${t}`); return `<li><b>${esc(sy)}</b>${esc(t)}</li>`; }).join('');
  advance(20);
  setMain(`<h2>History & examination</h2><p class="lead">Here's what the clerking found. Read it like the case stem in a test, then commit to a diagnosis. Want to practise taking it yourself? Switch to <b>Full clerking</b> when you start a shift.</p>
  <div class="plate"><div class="tag">history · from ${who}</div><ul class="clerk">${hx}</ul></div>
  <div class="plate"><div class="tag">examination</div><ul class="clerk"><li><b>Vitals</b>HR ${Math.round(v.hr)}/min, BP ${Math.round(v.sbp)}/${Math.round(v.dbp)} mmHg, RR ${Math.round(v.rr)}/min, SpO₂ ${Math.round(v.sat)}%, T ${v.t} °C, GCS ${Math.round(v.gcs)}/15. ${p.wt} kg, ${p.ht} cm${p.bmi ? `, BMI ${p.bmi}` : ''}.</li>${ex}<li><b>Other systems</b>No abnormality detected.</li></ul></div>
  <div id="clerkQ"></div>`);
  const host = $('#clerkQ');
  askQ(host, {q: 'What is your working diagnosis? Which features in this history and exam support it, and what are your main differentials?', a: `${P.def.dx}. ${val(P.def.dxWhy || '', p)}`, kw: P.def.dxKw || P.def.syn.map(s => s)}, {label: 'Working diagnosis', key: 'dx', max: 15, synonyms: P.def.syn}).then(() => {
    $('#hdrCase').textContent = P.def.title;
    nextBtn(host, 'Explain the mechanisms', () => go('reason'));
  });
}

/* ---------- STAGE 2: history (typed or spoken only) ---------- */
function stHistory() {
  const p = P.p;
  const who = p.age < 13 ? (p.parentName || 'Mother') : p.first;
  setMain(`<h2>History</h2><p class="lead">${p.age < 13 ? `${esc(p.parentName || 'The mother')} gives the history (collateral).` : `Talk to ${esc(p.first)}.`} Ask your own questions. <span class="desk-only">Speaking? Use the speak button, or hold your Handy shortcut and talk — hands-free sends it for you.</span><span class="mob-only">Tap <b>speak</b> to ask out loud.</span> Nothing is listed for you: think SOCRATES, systems enquiry, PMH, drugs and allergies, family and social history.</p>
  <div class="chat" id="chat"></div>
  ${inputRow('askIn', 'e.g. When did the pain start? Does it go anywhere? Do you smoke?', 'Ask')}
  <div class="q" id="hxSum" style="margin-top:18px"><div class="qn">history summary · 10 marks</div><p class="qt">When you've finished: summarise the key points of the history (positives and important negatives).</p>${inputRow('hxIn', 'e.g. 2 h of central crushing chest pain radiating to the left arm, sweating; smoker, diabetic…', 'Finish history', true)}<div id="hxOut"></div></div>`);
  wireMic($('#main'));
  $('#main .lead').insertAdjacentHTML('afterend', `<div class="skipbar"><span>Short on time?</span><button class="btn sec" id="skipClerk">Skip history & exam: show me the findings</button></div>`);
  $('#skipClerk').onclick = () => { P.quick = true; go('clerk'); };
  
  const chat = $('#chat');
  const addMsg = (me, txt) => {
    const d = document.createElement('div'); d.className = 'msg ' + (me ? 'me' : 'pt');
    d.innerHTML = me ? esc(txt) : `<div class="who">${esc(who)}</div>${esc(txt)}`;
    chat.appendChild(d); d.scrollIntoView({block: 'nearest'});
    if (!me && window.speakPatient) window.speakPatient(txt, p);
  };
  P.chat.forEach(m => addMsg(m.me, m.t));
  const record = (i) => { if (!P.asked.has(i)) { P.asked.add(i); note('History', `${p.hx[i][0]}: ${p.hx[i][1]}`, 0, 'h' + i); } };
  const askFree = async () => {
    const inp = $('#askIn'); const q = inp.value.trim(); if (!q) return; inp.value = '';
    addMsg(true, q); P.chat.push({me: true, t: q});
    // offline matcher: best-matching fact(s); question intents widen the words
    const INTENT = [[/when|start|began|how long|since|onset|duration/, 'onset duration started began timing'], [/smok|cigar|tobacco|zol/, 'smoking smoker cigarettes tobacco'], [/drink|alcohol|beer|booze|wine/, 'alcohol drinking'], [/medic|tablet|pill|drug|treatment|taking anything|meds/, 'medicines medication tablets drugs treatment'], [/allerg/, 'allergy allergies'], [/family|parents|mother|father|sibling|runs in/, 'family'], [/fever|hot|temperature|sweat|chills|rigor/, 'fever rigors sweats'], [/weight|thin|appetite/, 'weight appetite'], [/pain|hurt|sore|ache/, 'pain'], [/breath|wind|puff/, 'breathless breathing dyspnoea'], [/cough|sputum|phlegm/, 'cough sputum'], [/urine|pee|wee|water/, 'urine'], [/stool|poo|bowel|diarr|constip/, 'stools bowel diarrhoea'], [/work|job|occupation/, 'work occupation job'], [/hiv|tested|status/, 'hiv'], [/travel|been anywhere|trip/, 'travel'], [/contact|anyone else|sick people/, 'contacts contact'], [/pregnan|period|menstru/, 'pregnant periods'], [/vaccin|immunis|jab/, 'vaccination vaccines immunisation'], [/eat|food|diet|meal/, 'diet food meal'], [/sleep|night/, 'night sleep'], [/better|worse|relie|aggrav/, 'relieving aggravating worse better'], [/where|radiat|spread|go anywhere/, 'radiation site where']];
    const qn = norm(q); const extra = INTENT.filter(([re]) => re.test(qn)).map(([, w]) => w).join(' ');
    const words = norm(q + ' ' + extra).split(' ').filter(w => w.length > 2 && !STOPW.has(w)).map(w => w.slice(0, 5));
    const scored = p.hx.map((h, i) => { const top = norm(h[0]), hay = norm(h[0] + ' ' + (h[3] || '') + ' ' + h[1].replace(/\([^)]*\)/g, '')); let s = 0; words.forEach(w => { if (top.includes(w)) s += 2; else if (hay.includes(w)) s += 0.6; }); return [s, i]; }).sort((a, b) => b[0] - a[0]);
    let best = scored.filter(([s]) => s >= 1.2).slice(0, 2).filter(([s], k) => k === 0 || s >= scored[0][0] - 0.4);
    if (BR() && !best.length) {
      try {
        const b = await Brain.best(q, p.hx.map(h => `${h[0]}: ${h[1].replace(/\([^)]*\)/g, '')}`));
        const second = Math.max(-1, ...b.sims.filter((_, i) => i !== b.i));
        if (!best.length && b.sim >= 0.45 && (b.sim - second >= 0.06 || b.sim >= 0.55)) best = [[b.sim, b.i]];
      } catch (e) {}
    }
    if (best.length) { const t = best.map(([, i]) => p.hx[i][1]).join(' '); addMsg(false, t); P.chat.push({me: false, t, i: best[0][1]}); best.forEach(([, i]) => record(i)); }
    else if ((() => { const pr = p.prof.find(([lab]) => matchItems(q + ' ' + extra, [lab]).length && !/years old|^\d/.test(lab)); if (!pr) return false; const t = 'Yes — ' + pr[0].replace(/^Smokes/, 'I smoke').replace(/^Drinks/, 'I drink').replace(/^Works/, 'I work').replace(/^Lives/, 'I live').replace(/^Has /, 'I have ').replace(/^Takes/, 'I take').replace(/^Had /, 'I had ').replace(/^On /, "I'm on ").replace(/^Is /, "I'm ").replace(/^Was /, 'I was ') + '.'; addMsg(false, t); P.chat.push({me: false, t}); return true; })()) { /* answered from profile */ }
    else { const NEG = [[/family|runs in/, 'Nobody in the family has anything like this, that I know of.'], [/allerg/, p.allergies.length ? `Yes — I\'m allergic to ${p.allergies.join(', ')}.` : 'No allergies that I know of.'], [/medic|tablet|pill|drug|meds/, p.meds.length ? 'Just my usual tablets.' : 'No, I don\'t take anything regularly.'], [/smok|cigar/, 'No, I don\'t smoke.'], [/drink|alcohol/, 'Just socially, not much.'], [/travel/, 'No, I haven\'t been anywhere.'], [/operat|surgery|hospital/, 'No operations, no admissions.']];
      const SYM = ['rash', 'fever', 'cough', 'vomit', 'nausea', 'diarrhoea', 'diarrhea', 'headache', 'chest pain', 'blood', 'swelling', 'weight loss', 'night sweats', 'itch', 'dizz', 'faint', 'palpitation', 'short of breath', 'breathless', 'wheez', 'urine', 'burning', 'joint', 'back pain', 'numb', 'weak', 'confus', 'fits', 'seizure', 'yellow', 'jaundice', 'bleed', 'bruis', 'stiff neck', 'sore throat', 'runny nose', 'abdominal pain', 'stomach pain', 'tummy'];
      const sym = SYM.find(w => qn.includes(w));
      if (sym && !NEG.some(([re]) => re.test(qn))) NEG.unshift([/./, p.r.pick([`No, no ${sym.replace(/(vomit|dizz|itch|wheez|confus|bruis)$/, m => ({vomit: 'vomiting', dizz: 'dizziness', itch: 'itching', wheez: 'wheezing', confus: 'confusion', bruis: 'bruising'})[m])} that I've noticed.`, 'No, not that.', 'No, I don\'t think so.'])]);
      const hitNeg = NEG.find(([re]) => re.test(qn));
      const t = hitNeg ? hitNeg[1] : p.r.pick(['Hmm, no… not that I\'ve noticed, doctor.', 'No, nothing like that.', 'I don\'t think so.', 'Sorry doctor, what do you mean?']); addMsg(false, t); P.chat.push({me: false, t}); }
    advance(1);
  };
  $('#askInGo').onclick = askFree; $('#askIn').onkeydown = e => { if (e.key === 'Enter') askFree(); };
  $('#hxInGo').onclick = async () => {
    const ans = $('#hxIn').value.trim(); if (!ans) { $('#hxIn').focus(); return; }
    $('#hxInGo').disabled = true; $('#hxIn').readOnly = true; $('#askIn').disabled = true; $('#askInGo').disabled = true;
    $('#hxOut').innerHTML = '<p class="thinking">Marking…</p>';
    const keys = p.hx.map((h, i) => [h, i]).filter(([h]) => h[2]);
    const junk = isJunk(ans);
    const sumIds = new Set(junk ? [] : (await whichMentioned(ans, keys.map(([h]) => `${h[0]}: ${h[1]}`), 'Which of these key history points did the student include in their summary?')).map(k => keys[k][1]));
    sumIds.forEach(i => P.flags.add('h' + i));
    const asked = keys.filter(([, i]) => P.asked.has(i)), summed = keys.filter(([, i]) => sumIds.has(i) && P.asked.has(i));
    const got = junk ? 0 : Math.max(0, Math.round(10 * (asked.length * 0.6 + summed.length * 0.4) / Math.max(1, keys.length))); award('history', got, 10);
    const missed = keys.filter(([, i]) => !P.asked.has(i));
    const unsummed = keys.filter(([, i]) => P.asked.has(i) && !sumIds.has(i));
    $('#hxOut').innerHTML = `<div class="verdict ${got >= 8 ? 'correct' : got >= 4 ? 'partial' : 'incorrect'}"><h4>History — ${got}/10</h4>${junk ? JUNK_MSG : `You uncovered ${asked.length}/${keys.length} key points and put ${summed.length} in your summary.`}</div>
    ${missed.length ? `<p class="tag">never asked</p><ul class="whylist marks">${missed.map(([h]) => `<li class="miss"><b>${esc(h[0])}:</b> "${esc(h[1])}"${h[3] ? ' — ' + esc(h[3]) : ''}</li>`).join('')}</ul>` : ''}
    ${unsummed.length ? `<p class="tag">asked, but left out of your summary</p><ul class="whylist marks">${unsummed.map(([h]) => `<li class="miss"><b>${esc(h[0])}:</b> ${esc(h[1])}${h[3] ? ' — ' + esc(h[3]) : ''}</li>`).join('')}</ul>` : ''}`;
    missed.forEach(([, i]) => record(i));
    nextBtn($('#hxOut'), 'Examine the patient', () => go('exam'));
  };
}

/* ---------- STAGE 3: examination (typed or spoken commands) ---------- */
const SYSTEMS = ['General (end of bed)', 'Hands', 'Head & neck', 'Cardiovascular', 'Respiratory', 'Abdomen', 'Neurological', 'Musculoskeletal', 'Skin'];
const EXMAP = [
  ['Vitals', /vital|\bobs\b|observation|blood pressure|\bbp\b|temperature|\btemp\b|\bsats?\b|saturation|resp(iratory)? rate|heart rate|weigh|bmi|height/],
  ['General (end of bed)', /general|end of (the )?bed|inspect(ion)?( of)? (the )?(patient|whole)|look at (the )?patient|appearance|distress|hydration|nutrition|built?\b|habitus/],
  ['Hands', /hand|nail|palm|finger|clubbing|asterixis|flap|koilonych/],
  ['Head & neck', /head|neck(?! stiff)|eye|conjunctiv|sclera|mouth|tongue|lymph|node|thyroid|jvp|jugular|face|facies|\bear|throat|pharyn|tonsil|nose|nasal|fund(us|i)|gum|teeth|parotid|supraclav/],
  ['Cardiovascular', /heart|cardi|\bcvs\b|precordi|apex|murmur|heave|thrill|pulse(s)?(?! ox)|radial|carotid|oedema|edema/],
  ['Respiratory', /chest|lung|resp|breath|trachea|expansion|percuss(ion)? (of )?(the )?(chest|lung)|wheez|crackle|air entry|vocal|fremitus/],
  ['Abdomen', /abdo|tummy|belly|stomach|liver|spleen|kidney|renal angle|ballot|bowel sound|shifting|fluid thrill|murphy|hernia|epigastr|iliac fossa|bladder|palpate/],
  ['Abdomen (DRE)', /\bdre\b|rectal|\bpr\b|per rectum|digital rectal|prostate/],
  ['Neurological', /neuro|power|reflex|tone|sensation|sensory|\bgcs\b|pupil|cranial|plantar|babinski|gait|meningism|neck stiff|kernig|brudzinski|cerebell|coordination|mental state|conscious|speech|tetany|chvostek|trousseau/],
  ['Musculoskeletal', /\bmsk\b|musculo|joint|knee|hip|ankle|wrist|elbow|shoulder|back|spine|spinal|limb|leg|\barm|bone|lachman|drawer|pivot|mcmurray|gals|foot|feet|toe|thigh|shin|calf|swelling|deform|range of (motion|movement)|cast|wound/],
  ['Skin', /skin|rash|lesion|bruis|petechi|purpur|derm|pressure (sore|area)|nodule|tophus|ulcer/],
  ['Breast', /breast|axilla/],
  ['Pelvic', /pelvic|speculum|vagin|\bpv\b|cervix|bimanual|gyn/],
  ['Peripheral vascular', /peripheral (vascular|pulses)|pedal|dorsalis|femoral|popliteal|capillary refill|\bcrt\b|perfusion|cold periph/],
];
function parseExam(cmd, avail) {
  const c = norm(cmd);
  const hit = EXMAP.filter(([, re]) => re.test(c)).map(([s]) => s);
  if (/full exam|examine everything|head to toe|complete exam/.test(c)) return ['Vitals', ...SYSTEMS];
  return [...new Set(hit)].filter(s => s === 'Vitals' || SYSTEMS.includes(s) || avail.includes(s) || ['Breast', 'Pelvic', 'Peripheral vascular', 'Abdomen (DRE)'].includes(s));
}
function normalExam(sys, p) {
  const ob = p.build === 'obese';
  return ({
    'General (end of bed)': `${p.build === 'cachectic' ? 'Wasted' : ob ? 'Obese' : 'Well-nourished'}, alert, comfortable at rest. No pallor, jaundice, cyanosis, clubbing, lymphadenopathy or oedema.`,
    'Hands': 'Warm, well perfused, capillary refill < 2 s. No clubbing, splinter haemorrhages, koilonychia or palmar erythema.',
    'Head & neck': 'Pink conjunctivae, anicteric sclerae. Moist mucosa, no oral thrush or lesions. No lymphadenopathy. JVP not raised. Thyroid normal.',
    'Cardiovascular': `Pulse regular. Apex beat ${ob ? 'not palpable (body habitus)' : 'undisplaced, 5th ICS MCL'}. Heart sounds S1 S2 ${ob ? 'soft' : 'normal'}, no murmurs, rubs or gallops. Peripheral pulses present.`,
    'Respiratory': 'Trachea central. Chest expansion symmetrical. Resonant to percussion. Vesicular breath sounds, no added sounds.',
    'Abdomen': `${ob ? 'Obese, organs difficult to palpate.' : 'Soft, non-tender.'} No organomegaly or masses. Bowel sounds normal. No shifting dullness.`,
    'Abdomen (DRE)': 'Normal anal tone, no masses, brown stool on glove, no blood.',
    'Neurological': 'GCS 15. Pupils equal and reactive. Normal tone, power 5/5, reflexes 2+, sensation intact. No neck stiffness.',
    'Musculoskeletal': 'No joint swelling, warmth or deformity. Full range of motion. Spine non-tender. GALS screen normal.',
    'Skin': 'No rash, bruising, petechiae or lesions.',
    'Breast': 'Breasts symmetrical, no masses, skin changes or nipple discharge; axillae clear.',
    'Pelvic': 'Normal external genitalia; speculum: healthy cervix, no discharge or bleeding.',
    'Peripheral vascular': 'Peripheries warm, capillary refill < 2 s, all peripheral pulses palpable.',
  })[sys] || 'No abnormality detected.';
}
function stExam() {
  const p = P.p;
  const avail = [...new Set(p.ex.map(e => e[0]))];
  setMain(`<h2>Examination</h2><p class="lead">Say or type what you examine — "check the vitals", "look at the hands", "listen to the chest", "palpate the abdomen", "DRE", "examine the right knee". Each system takes a couple of minutes.</p>
  ${inputRow('exIn', 'What do you examine?', 'Examine')}<p class="setting" id="exHint"></p>
  <div id="finds"></div>
  <div class="q" style="margin-top:18px"><div class="qn">examination summary · 10 marks</div><p class="qt">When you've finished: summarise the key examination findings.</p>${inputRow('exSum', 'e.g. Tachycardic, febrile; dull right base with bronchial breathing…', 'Finish examination', true)}<div id="exQ"></div></div>`);
  wireMic($('#main'));
  const finds = $('#finds');
  const vitals = () => { const v = p.v; return `HR ${Math.round(v.hr)}/min, BP ${Math.round(v.sbp)}/${Math.round(v.dbp)} mmHg, RR ${Math.round(v.rr)}/min, SpO₂ ${Math.round(v.sat)}%, T ${v.t} °C, GCS ${Math.round(v.gcs)}/15. Weight ${p.wt} kg, height ${p.ht} cm${p.bmi ? `, BMI ${p.bmi}` : ''}.`; };
  const show = (sys, again) => {
    if (P.examined.has(sys) && !again) return false; P.examined.add(sys); advance(sys === 'Vitals' ? 1 : 2);
    let items = sys === 'Vitals' ? [[sys, vitals(), 0]] : p.ex.filter(e => e[0] === sys);
    if (!items.length) items = [[sys, normalExam(sys, p), 0]];
    items.forEach(e => {
      const idx = p.ex.indexOf(e); const fid = idx >= 0 ? 'e' + idx : 'n' + sys;
      const d = document.createElement('div'); d.className = 'find';
      d.innerHTML = `<span class="tag">${esc(sys.toLowerCase())}</span><div class="t">${esc(e[1])}</div>`;
      finds.appendChild(d); d.scrollIntoView({block: 'nearest'});
      note('Exam', `${sys}: ${e[1]}`, 0, fid);
    });
    return true;
  };
  const doExam = () => {
    const inp = $('#exIn'); const cmd = inp.value.trim(); if (!cmd) return; inp.value = '';
    const sys = parseExam(cmd, avail);
    if (!sys.length) { $('#exHint').textContent = `Not sure what to examine from "${cmd}". Name a system or body part — e.g. "auscultate the heart", "inspect the skin", "neuro exam of the legs".`; return; }
    const fresh = sys.filter(s => show(s));
    $('#exHint').textContent = fresh.length ? '' : `Already examined: ${sys.join(', ').toLowerCase()}.`;
  };
  $('#exInGo').onclick = doExam; $('#exIn').onkeydown = e => { if (e.key === 'Enter') doExam(); };
  $('#exSumGo').onclick = async () => {
    const ans = $('#exSum').value.trim(); if (!ans) { $('#exSum').focus(); return; }
    $('#exSumGo').disabled = true; $('#exSum').readOnly = true; $('#exIn').disabled = true; $('#exInGo').disabled = true;
    const host = $('#exQ'); host.innerHTML = '<p class="thinking">Marking…</p>';
    const keyEx = p.ex.map((e, i) => [e, i]).filter(([e]) => e[2]);
    const junk = isJunk(ans);
    const sumIds = new Set(junk ? [] : (await whichMentioned(ans, keyEx.map(([e]) => `${e[0]}: ${e[1]}`), 'Which of these key examination findings did the student include in their summary?')).map(k => keyEx[k][1]));
    sumIds.forEach(i => P.flags.add('e' + i));
    const found = keyEx.filter(([e]) => P.examined.has(e[0])), summed = keyEx.filter(([e, i]) => P.examined.has(e[0]) && sumIds.has(i));
    const got = junk ? 0 : Math.round(10 * (found.length * 0.6 + summed.length * 0.4) / Math.max(1, keyEx.length)); award('exam', got, 10);
    const miss = keyEx.filter(([e]) => !P.examined.has(e[0]));
    host.innerHTML = `<div class="verdict ${got >= 8 ? 'correct' : got >= 4 ? 'partial' : 'incorrect'}"><h4>Examination — ${got}/10</h4>${junk ? JUNK_MSG : `Found ${found.length}/${keyEx.length} key signs; ${summed.length} in your summary.`}</div>${miss.length ? `<p class="tag">systems you didn't examine</p><ul class="whylist marks">${miss.map(([e]) => `<li class="miss"><b>${esc(e[0])}</b> — ${esc(e[1])}</li>`).join('')}</ul>` : ''}`;
    miss.forEach(([e, i]) => note('Exam', `${e[0]}: ${e[1]}`, 0, 'e' + i));
    const keyHx = p.hx.filter(h => h[2]).map(h => h[0]);
    host.insertAdjacentHTML('beforeend', `<div class="plate"><div class="tag">the features that matter in this patient</div><ul class="whylist">${keyHx.map(k => `<li>History · ${esc(k)}</li>`).join('')}${keyEx.map(([e]) => `<li>Exam · ${esc(e[0])} — ${esc(e[1])}</li>`).join('')}</ul></div>`);
    await askQ(host, {q: 'What is your working diagnosis? List the key features that support it, and your main differentials.', a: `${P.def.dx}. ${val(P.def.dxWhy || '', p)}`, kw: P.def.dxKw || P.def.syn.map(s => s)}, {label: 'Working diagnosis', key: 'dx', max: 15, synonyms: P.def.syn});
    $('#hdrCase').textContent = P.def.title;
    nextBtn(host, 'Explain the mechanisms', () => go('reason'));
  };
}

/* ---------- STAGE 4: mechanisms ---------- */
async function runQs(host, list, key) { for (const q of list) await askQ(host, q, {label: q.label || ({cause: 'Causes & risk factors', mech: 'Mechanism / pathophysiology', path: 'Pathology', comp: 'Complications', inv: 'Data interpretation', mgmt: 'Management', pharm: 'Pharmacology', integ: 'Integrated patient', micro: 'Microbiology', theme: 'Themes: ethics & public health'}[q.s] || 'Short answer'), key}); }
async function stReason() {
  setMain(`<h2>Mechanisms</h2><p class="lead">Explain what's going on underneath — causes, pathophysiology and what it can lead to.</p><div id="rq"></div>`);
  const host = $('#rq');
  await runQs(host, P.def.Q.filter(q => ['cause', 'mech', 'path', 'comp', 'micro'].includes(q.s)), 'reason');
  nextBtn(host, 'Order investigations', () => go('inv'));
}

/* ---------- STAGE 5: investigations ---------- */
function stInv() {
  const groups = {};
  Object.entries(INV).forEach(([id, d]) => { (groups[d[1]] = groups[d[1]] || []).push([id, d]); });
  setMain(`<h2>Investigations</h2><p class="lead">Tick what you need and send. ${S.wait === 'instant' ? 'Results come back straight away, each labelled with <b>how long it really takes</b>: a bedside test (dipstick, glucose, ECG) is minutes, bloods about an hour, cultures and histology days. That difference is exam material.' : 'Results arrive while you carry on (<b>1 minute of hospital time = 1 second of real time</b>): an ECG is instant, a chest X-ray about 20 s, bloods about a minute. Cultures and histology take days — the lab phones you later.'} Unnecessary tests cost time and get flagged.</p>
  <div id="results"></div><details class="plate" id="igWrap" open><summary class="tag" style="cursor:pointer;font-size:16px">Order tests — tick, then send</summary><div class="invgroups" id="ig">${Object.entries(groups).map(([g, list]) => `<fieldset><legend>${g}</legend>${list.map(([id, d]) => `<label><input type="checkbox" value="${id}" ${P.ordered[id] ? 'checked disabled' : ''}> <span>${esc(d[0])} <small>${d[2] < 60 ? d[2] + ' min' : d[2] < 1440 ? Math.round(d[2] / 60) + ' h' : Math.round(d[2] / 1440) + ' d'}</small></span></label>`).join('')}</fieldset>`).join('')}</div>
  <div class="row" style="margin:12px 0"><button class="btn" id="sendInv">Send orders</button></div></details><button class="hide" id="invDone"></button>
  <div id="invQ"></div>`);
  drawResults();
  actBar('I have my results — interpret them', () => $('#invDone').click(), 'Send your orders. Results land live; continue once you have what you need.');
  $('#sendInv').onclick = () => {
    const ids = [...document.querySelectorAll('#ig input:checked:not(:disabled)')].map(i => i.value);
    if (!ids.length) return;
    const now = Date.now();
    if (S.wait === 'instant') {
      // results now; the clock only moves for tests you'd realistically have back in this sitting (≤ 4 h)
      const wait = Math.max(0, ...ids.map(id => INV[id][2]).filter(t => t <= 240));
      advance(2 + wait);
      ids.forEach(id => { P.ordered[id] = {at: P.t, ready: P.t, tat: INV[id][2], instant: true}; note('Investigations', INV[id][0]); document.querySelector(`#ig input[value="${id}"]`).disabled = true; });
      drawResults(); renderBed();
    } else {
    ids.forEach(id => { P.ordered[id] = {at: P.t, ready: P.t + INV[id][2], realReady: now + INV[id][2] * 1000}; note('Investigations', INV[id][0]); document.querySelector(`#ig input[value="${id}"]`).disabled = true; });
    advance(2); drawResults(); renderBed(); startResultClock();
    } $('#igWrap').open = false; $('#results').scrollIntoView({behavior: 'smooth', block: 'start'});
  };
  $('#invDone').onclick = async () => {
    $('#invDone').disabled = true;
    const key = P.def.keyInv || [];
    const ordered = Object.keys(P.ordered);
    const hit = key.filter(k => ordered.includes(k)), miss = key.filter(k => !ordered.includes(k));
    const extra = ordered.filter(k => !key.includes(k) && !(P.def.okInv || []).includes(k) && !['Bedside'].includes(INV[k][1]) && !['PANEL_FBC', 'PANEL_UE', 'PANEL_CRP'].includes(k));
    const got = Math.max(0, Math.round(10 * hit.length / Math.max(1, key.length) - extra.length * 0.7)); award('inv', got, 10);
    // reveal ready results for anything still pending (≤ 4 h) so they can interpret
    Object.values(P.ordered).forEach(o => { if (INV_TAT(o) <= 240 && o.ready > P.t) o.ready = P.t; });
    drawResults();
    const host = $('#invQ');
    host.innerHTML = `<div class="verdict ${got >= 8 ? 'correct' : got >= 4 ? 'partial' : 'incorrect'}" style="margin:12px 0"><h4>Test selection — ${got}/10</h4>${hit.length}/${key.length} key investigations ordered.${miss.length ? `<br><b>Missed:</b> ${miss.map(k => esc(INV[k][0])).join(', ')}` : ''}${extra.length ? `<br><b>Probably not needed here:</b> ${extra.map(k => esc(INV[k][0])).join(', ')}` : ''}</div>`;
    if (miss.length) { miss.forEach(k => { P.ordered[k] = {at: P.t, ready: P.t, tat: INV[k][2], auto: true}; }); host.insertAdjacentHTML('beforeend', '<p class="setting">The missed key tests have been added to your results so you can interpret them.</p>'); drawResults(); }
    setTimeout(() => host.scrollIntoView({behavior: 'smooth', block: 'start'}), 150);
    await runQs(host, P.def.Q.filter(q => q.s === 'inv'), 'invq');
    nextBtn(host, 'Manage the patient', () => go('manage'));
  };
}
function INV_TAT(o) { return o.tat !== undefined ? o.tat : o.ready - o.at; }
/* how long a test really takes, and what that means for you */
function tatLabel(id) {
  const t = INV[id][2], g = INV[id][1], kind = /imag|radio|scan/i.test(g) || /x-ray|ct |mri|ultrasound|scan|echo|dexa/i.test(INV[id][0]) ? 'imaging' : 'lab';
  if (g === 'Bedside' && t <= 15) return `bedside test · ${t <= 5 ? 'minutes' : '~' + t + ' min'}: act on it straight away`;
  if (t <= 90) return `${kind} · ~${t >= 60 ? (t / 60).toFixed(t % 60 ? 1 : 0) + ' h' : t + ' min'}`;
  if (t <= 240) return `${kind} · ~${Math.round(t / 60)} h: start treatment while you wait`;
  if (t < 1440) return `${kind} · ~${Math.round(t / 60)} h`;
  return `in real life ~${Math.round(t / 1440)} day${t >= 2880 ? 's' : ''}${g === 'Micro' ? ': start treatment before it\'s back' : ''}`;
}
/* results arrive in real time: 1 in-game minute = 1 real second; when one lands, hospital time catches up to it */
let resultTimer = null;
function startResultClock() {
  if (resultTimer) return;
  resultTimer = setInterval(() => {
    if (!P || !P.ordered) return;
    const now = Date.now(); let catchUp = 0, live = false;
    Object.values(P.ordered).forEach(o => {
      if (INV_TAT(o) > 240 || P.t >= o.ready || !o.realReady) return;
      if (now >= o.realReady) catchUp = Math.max(catchUp, o.ready - P.t); else live = true;
    });
    if (catchUp > 0) { advance(catchUp); drawResults(); }
    document.querySelectorAll('[data-cd]').forEach(el => { const o = P.ordered[el.dataset.cd]; if (o && o.realReady) el.textContent = `arrives in ${Math.max(0, Math.ceil((o.realReady - now) / 1000))} s`; });
    if (!live && !catchUp) { clearInterval(resultTimer); resultTimer = null; }
  }, 500);
}
function labTable(keys, title) {
  const p = P.p, L = p.L;
  const sect = keys.some(k => ['Hb', 'WCC', 'Plt', 'Retic', 'INR'].includes(k)) ? 'Haematology' : keys.some(k => ['TSH', 'Ferr', 'Fe', 'Vit25', 'Cort'].includes(k)) ? 'Endocrinology' : keys.some(k => ['CD4', 'VL'].includes(k)) ? 'Immunology / Virology' : 'Biochemistry';
  const diff = new Set(['Neut', 'Lymph', 'Eos']);
  const rows = keys.map(k => {
    const d = LAB[k]; if (!d) return ''; const v = L[k]; const [lo, hi] = rangeFor(k, p);
    let shown = v === undefined ? '—' : (+v).toFixed(d[4]);
    if (k === 'eGFR' && v >= 90) shown = '> 89';
    if (k === 'VL' && v < 50) shown = '< 50 (LDL)';
    const fl = v > hi && k !== 'eGFR' ? 'H' : v < lo ? 'L' : '';
    const pctCol = diff.has(k) && L.WCC ? `${(100 * v / L.WCC).toFixed(1)}%` : '';
    const rng = k === 'eGFR' ? '> 89' : lo === 0 ? `< ${hi}` : `${lo} – ${hi}`;
    return `<tr class="${fl}"><td>${diff.has(k) ? '&nbsp;&nbsp;' : ''}${d[0]}</td><td class="rng">${pctCol}</td><td class="f">${fl}</td><td class="v">${shown}</td><td>${d[1]}</td><td class="rng">${rng}</td></tr>`;
  }).join('');
  return `<div class="lancet"><div class="lhd"><span>Lab ref ${(P.p.ht * 7919 + P.t) % 900000000 + 100000000}</span><span>Collected T+${P.t} min</span></div><div class="lsec">${sect}</div><table class="lab">${rows}</table></div>`;
}
function resultHTML(id) {
  const p = P.p, d = INV[id], r = p.res[id];
  if (d[3] === 'panel') return labTable(PANELS[d[4]].keys) + (typeof r === 'string' ? `<p class="lcom"><b>COMMENT:</b> ${esc(r)}</p>` : '');
  if (d[3] === 'ecg') {
    const e = Object.assign({rhythm: 'sinus', seed: p.r ? 17 : 3}, p.ecg, {rate: Math.round(p.ecg.rate || p.v.hr), K: p.L.K});
    if (e.rhythm === 'sinus') e.rate = Math.round(p.v.hr);
    return `<div class="ecgwrap">${ecgSVG(e)}</div>`;
  }
  if (d[3] === 'cxr') return `<canvas data-cxr="${id}" aria-label="Chest X-ray"></canvas>${p.cxrNote ? `<p class="setting">${esc(p.cxrNote)}</p>` : ''}`;
  if (d[3] === 'xr' && p.xr) return `<canvas data-xr="${id}" aria-label="X-ray"></canvas>${p.xr.note ? `<p class="setting">${esc(p.xr.note)}</p>` : ''}`;
  if (d[3] === 'xr' && !r) return '<p>No bony abnormality detected.</p>';
  if (r && typeof r === 'object') return `<p>${esc(r.text)}</p>${r.img ? `<div class="refimg"><figure><img src="img/${r.img}.jpg" alt="${esc(r.cap || d[0])}"><figcaption>${esc(r.cap || '')}</figcaption></figure></div>` : ''}`;
  return `<p>${esc(r !== undefined && r !== null ? r : d[4])}</p>`;
}
function drawResults() {
  const host = document.querySelector('#results'); if (!host) return;
  const ids = Object.keys(P.ordered);
  host.innerHTML = ids.map(id => {
    const o = P.ordered[id], d = INV[id], ready = P.t >= o.ready, long = INV_TAT(o) > 240;
    if (o.instant || o.auto) return `<div class="res"><h4><span>${esc(d[0])}</span><small class="tat ${INV[id][2] >= 1440 ? 'slow' : INV[id][2] <= 15 ? 'fast' : ''}">${esc(tatLabel(id))}</small></h4><div class="body">${resultHTML(id)}</div></div>`;
    return `<div class="res"><h4><span>${esc(d[0])}</span><small>${ready ? `reported T+${o.ready} min` : long ? 'at the lab — ' + (INV_TAT(o) >= 1440 ? Math.round(INV_TAT(o) / 1440) + ' days' : Math.round(INV_TAT(o) / 60) + ' h') + ' (you will be phoned)' : `<span data-cd="${id}">arrives in ${Math.max(0, Math.ceil(((o.realReady || 0) - Date.now()) / 1000))} s</span>`}</small></h4><div class="body">${ready ? resultHTML(id) : `<div class="pending"><span class="spin"></span>${long ? 'Sent to the lab' : 'Processing…'}</div>`}</div></div>`;
  }).join('');
  host.querySelectorAll('canvas[data-cxr]').forEach(c => drawCXR(c, Object.assign({sex: P.p.sex, age: P.p.age, build: P.p.build, seed: (P.p.wt * 13) | 0}, P.p.cxr || {})));
  host.querySelectorAll('canvas[data-xr]').forEach(c => drawBone(c, Object.assign({seed: (P.p.ht * 7) | 0, side: P.p.side}, P.p.xr)));
}

/* ---------- STAGE 6: management ---------- */
function consoleHTML(id) {
  return `<div class="orderbox"><label class="sr" for="${id}In">Prescribe or order</label><input id="${id}In" placeholder="e.g. aspirin, oxygen, ceftriaxone, fluid bolus, PCI, salbutamol neb…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="${id}Sg"><div class="sugg hide" id="${id}Sg" role="listbox"></div></div>
  <div class="row" style="margin-top:10px"><button class="btn sec" data-act="recheck">Re-check obs (5 min)</button><button class="btn sec" data-act="replab">Repeat U&E + ECG</button></div><div class="repeat"></div><div class="feed"></div>`;
}
function wireConsole(root, id) {
  const p = P.p;
  const inp = root.querySelector('#' + id + 'In'), sug = root.querySelector('#' + id + 'Sg');
  let act = 0, list = [];
  const drawS = () => { sug.innerHTML = list.map((d, i) => `<button role="option" class="${i === act ? 'act' : ''}" data-k="${d.key}">${esc(d.name)}</button>`).join(''); sug.classList.toggle('hide', !list.length); inp.setAttribute('aria-expanded', !!list.length); sug.querySelectorAll('button').forEach(b => b.onclick = () => { order(DRUG[b.dataset.k]); inp.value = ''; list = []; drawS(); inp.focus(); }); };
  inp.oninput = () => { list = searchFormulary(inp.value); act = 0; drawS(); };
  inp.onkeydown = e => { if (e.key === 'ArrowDown') { act = Math.min(list.length - 1, act + 1); drawS(); e.preventDefault(); } else if (e.key === 'ArrowUp') { act = Math.max(0, act - 1); drawS(); e.preventDefault(); } else if (e.key === 'Enter' && list[act]) { order(list[act]); inp.value = ''; list = []; drawS(); } else if (e.key === 'Escape') { list = []; drawS(); } };
  root.querySelector('[data-act="recheck"]').onclick = () => { advance(5); event_('', 'Observations', `HR ${Math.round(p.v.hr)}, BP ${Math.round(p.v.sbp)}/${Math.round(p.v.dbp)}, RR ${Math.round(p.v.rr)}, SpO₂ ${Math.round(p.v.sat)}%, T ${p.v.t}, GCS ${Math.round(p.v.gcs)}.`); };
  root.querySelector('[data-act="replab"]').onclick = () => { advance(60); const L = p.L; event_('', 'Repeat U&E', `Na ${Math.round(L.Na)}, K ${L.K.toFixed(1)}, urea ${L.Urea.toFixed(1)}, creatinine ${Math.round(L.Cr)}, eGFR ${L.eGFR >= 90 ? '> 89' : L.eGFR}.`); root.querySelector('.repeat').innerHTML = `<div class="res" style="margin-top:12px"><h4><span>Repeat ECG</span><small>T+${P.t} min · K⁺ ${L.K.toFixed(1)}</small></h4><div class="body ecgwrap">${ecgSVG(Object.assign({rhythm: 'sinus', seed: 21}, p.ecg, {rate: Math.round(p.v.hr), K: L.K}))}</div></div>`; };
  // replay existing log
  root.querySelector('.feed').innerHTML = P.log.map(evHTML).join('');
}
function evHTML(l) { return `<div class="ev ${l.sev}"><b>${esc(l.title)}</b>${esc(l.msg)}<br><small>T+${l.t} min</small></div>`; }
function openDrawer() {
  const d = $('#drawer'); d.classList.remove('hide');
  d.innerHTML = `<div class="drawer-in"><div class="row" style="justify-content:space-between;margin:0 0 8px"><b>Orders — treat now</b><button class="btn sec" id="drClose">Close orders</button></div><p class="setting" style="margin:0 0 8px">Unstable patients won't wait for the history. Anything you order here counts toward management.</p>${consoleHTML('dr')}</div>`;
  wireConsole(d, 'dr'); $('#drClose').onclick = () => d.classList.add('hide'); d.querySelector('input').focus();
}
function stManage() {
  const p = P.p;
  $('#drawer').classList.add('hide');
  setMain(`<h2>Management</h2><p class="lead">Treat the patient. Type a drug, fluid, oxygen or procedure — the order goes in and the patient responds. Watch the monitor.</p>
  <div class="card" id="mgc">${consoleHTML('mg')}<button class="hide" id="mgDone"></button></div><div id="mgQ"></div>`);
  // lab calls for long-turnaround tests
  Object.entries(P.ordered).forEach(([id, o]) => { if (INV_TAT(o) > 240 && !o.called) { o.called = true; o.ready = P.t; event_('good', `Lab call: ${INV[id][0]}`, typeof p.res[id] === 'object' && p.res[id] ? p.res[id].text : (p.res[id] || INV[id][4] || 'Reported.')); } });
  wireConsole($('#mgc'), 'mg');
  actBar('Done treating — write up my plan', () => $('#mgDone').click(), 'Give all the treatment this patient needs, then continue.');
  $('#mgDone').onclick = async () => {
    $('#mgDone').disabled = true;
    const must = (P.def.must || []).filter(m => !m.when || m.when(P.p));
    const g = new Set(P.given), cls = new Set(P.given.flatMap(k => DRUG[k] ? DRUG[k].cls : []));
    const hit = must.filter(m => m.k.split('|').some(x => g.has(x) || cls.has(x)));
    const miss = must.filter(m => !hit.includes(m));
    const got = Math.round(15 * hit.length / Math.max(1, must.length)); award('orders', got, 15);
    const host = $('#mgQ');
    host.innerHTML = `<div class="verdict ${got >= 12 ? 'correct' : got >= 6 ? 'partial' : 'incorrect'}" style="margin:12px 0"><h4>Treatment given — ${got}/15</h4>${hit.length}/${must.length} essential treatments given.</div>${miss.length ? `<div class="card"><b>What this patient also needed</b><ul class="whylist">${miss.map(m => `<li><b>${esc(m.n)}</b> — ${esc(m.why)}</li>`).join('')}</ul></div>` : ''}`;
    await runQs(host, P.def.Q.filter(q => q.s === 'mgmt'), 'plan');
    nextBtn(host, 'Pharmacology questions', () => go('pharm'));
  };
}
function order(d) {
  if (!d) return;
  const p = P.p;
  const homeCls = p.meds.flatMap(m => DRUG[m] ? DRUG[m].cls : []);
  const cls = new Set(P.given.flatMap(k => DRUG[k] ? DRUG[k].cls : []).concat(homeCls));
  const ctx = {p, d, given: new Set(P.given), cls, v: p.v, lab: p.L};
  P.given.push(d.key); d.cls.forEach(c => cls.add(c));
  note('Orders', `T+${P.t} ${d.name}`);
  if (d.cls.includes('saba') || d.cls.includes('sama')) P.nebUntil = P.t + 20;
  if (d.key === 'proc_stop') { const held = p.meds.map(m => DRUG[m] ? DRUG[m].name : m); p.meds = []; advance(2); event_('good', 'Regular medicines held', held.length ? `Held: ${held.join(', ')}. Restart when eating, drinking and renal function has recovered.` : 'No regular medicines to hold.'); renderBed(); return; }
  advance(5);
  let any = false;
  RULES.forEach(rule => { try { if (rule.when(ctx)) { any = true; const fx = typeof rule.fx === 'function' ? rule.fx(ctx) : rule.fx; applyFx(fx); event_(rule.sev, `${d.name}: ${rule.title}`, rule.msg(ctx)); P.harms += rule.sev === 'harm' ? 1 : 0; award('safety', rule.sev === 'harm' ? -8 : -3, 0); if (rule.sev === 'harm') shake(1); } } catch (e) { console.warn(e); } });
  // case-specific harms and benefits
  const match = (k) => k.split('|').some(x => x === d.key || d.cls.includes(x));
  Object.entries(P.def.bad || {}).forEach(([k, b]) => { if (match(k) && !(b.when && !b.when(p))) { any = true; applyFx(b.fx); event_(b.sev || 'harm', `${d.name}: ${b.t}`, val(b.m, p)); award('safety', (b.sev || 'harm') === 'harm' ? -8 : -3, 0); if ((b.sev || 'harm') === 'harm') shake(1); } });
  Object.entries(P.def.good || {}).forEach(([k, b]) => { if (match(k) && !P.mustGiven.has(k) && !(b.when && !b.when(p))) { P.mustGiven.add(k); any = true; applyFx(b.fx); event_('good', `${d.name}`, val(b.m, p)); { const m = $('#monitor'); m.classList.add('pulse'); setTimeout(() => m.classList.remove('pulse'), 900); } } });
  if (!any) event_('', d.name, 'Given. No change to report yet.');
  renderBed();
}

/* ---------- STAGE 7: pharmacology ---------- */
async function stPharm() {
  setMain(`<h2>Pharmacology</h2><p class="lead">Short, exam-style: what's first line, what changes for this patient, and the side effects and no-go combinations that come up in tests. The model answer explains the mechanism.</p><div id="pq"></div>`);
  const host = $('#pq'), p = P.p, def = P.def;
  const qs = [];
  // 1. first line
  const must = def.must || [];
  if (must.length) {
    const words = n => n.toLowerCase().replace(/\([^)]*\)/g, '').split(/[^a-z0-9₂-]+/).filter(w => w.length >= 5 && !/^(target|first|their|other|where|unless|start|treat|treatment|according|severity|daily|before|after|every|order|dose|doses|route)$/.test(w));
    qs.push({q: `${p.first} has ${def.dx.split(/[(—–,]/)[0].trim().toLowerCase()}. What is the first-line treatment? Name the drug(s), with dose and route if you know them.`,
      a: must.map(m => `${m.n.replace(/\.$/, '')}: ${m.why.replace(/\.$/, '')}.`).join(' '), kw: must.map(m => words(m.n).slice(0, 3).join('|')).filter(Boolean).slice(0, 5), label: 'First line'});
  }
  // 2. what changes for this patient, 3. side effects / interactions
  const sc = pharmScenarios(def, p, mkRng((p.ht * 131 + p.wt * 7 + P.t) | 0));
  const swap = sc.find(x => x.type === 'swap'), se = sc.find(x => x.type === 'se');
  if (p.overlay) qs.push(Object.assign({}, p.overlay.q, {label: 'What changes for this patient'}));
  else if (swap) qs.push({q: swap.q(p), a: swap.a, kw: swap.kw, label: 'What changes if…'});
  if (se) qs.push({q: se.q(p), a: se.a, kw: se.kw, label: 'Side effects & interactions'});
  else if (p.overlay && swap) qs.push({q: swap.q(p), a: swap.a, kw: swap.kw, label: 'What changes if…'});
  // nothing matched: fall back to the case's own pharmacology question
  if (qs.length < 2) qs.push(...def.Q.filter(q => q.s === 'pharm').slice(0, 1));
  if (!P.quick) qs.push(...def.Q.filter(q => q.s === 'theme').slice(0, 1));
  await runQs(host, qs, 'pharm');
  nextBtn(host, 'Debrief', () => finishCase(false));
}

/* ---------- STAGE 8: debrief ---------- */
function finishCase(early) {
  clearInterval(TIMER);
  if (early) { ['susp', 'dx', 'reason', 'invq', 'plan', 'pharm'].forEach(k => { if (!P.max[k]) award(k, 0, 15); }); }
  go('debrief');
}
function stDebrief() {
  const p = P.p, def = P.def, sc = pct();
  SHIFT.scores[SHIFT.idx] = sc;
  const st = store.get(); const pr = st.played[def.id] || {n: 0, best: 0}; pr.n++; pr.best = Math.max(pr.best, sc); st.played[def.id] = pr; store.put(st);
  const labels = {profile: 'Profile', susp: 'First impression', history: 'History', exam: 'Examination', dx: 'Diagnosis', reason: 'Mechanisms', inv: 'Test selection', invq: 'Interpretation', orders: 'Treatment given', plan: 'Management plan', pharm: 'Pharmacology', safety: 'Safety'};
  const bars = Object.keys(labels).filter(k => P.max[k] || P.pts[k]).map(k => { const m = P.max[k] || 0, g = P.pts[k] || 0; return `<div class="bar"><span>${labels[k]}</span><div class="track"><div class="fill" style="width:${m ? Math.max(0, 100 * g / m) : 0}%;${g < 0 ? 'background:var(--wrist)' : ''}"></div></div><b>${m ? `${g}/${m}` : g}</b></div>`; }).join('');
  const harms = P.log.filter(l => l.sev === 'harm' || l.sev === 'warn');
  const real = (def.real || []).map(x => { const [img, cap] = x.split('|'); return `<figure><img src="img/${img}.jpg" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>`; }).join('');
  setMain(`<h2>Debrief — ${esc(def.title)}</h2><p class="lead">${esc(p.name)}, ${p.age} y. ${esc(def.dx)}${p.overlay ? ` · integrated with ${esc(p.overlay.label)}` : ''}.</p>
  <div class="card" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap"><div><div class="scorebig">${sc}%</div><div class="xpgain" id="xpGain"></div><div class="setting">${P.died ? '<b style="color:var(--bad)">Level failed: the patient died.</b>' : P.crashed ? 'The patient crashed during your care.' : P.harms ? `${P.harms} harmful order${P.harms > 1 ? 's' : ''}.` : 'No harmful orders.'} T+${P.t} min.</div></div><div class="bars" style="flex:1;min-width:280px">${bars}</div></div>
  ${harms.length ? `<div class="card"><b>What went wrong with your orders</b>${harms.map(h => `<div class="ev ${h.sev}" style="margin-top:8px"><b>${esc(h.title)}</b>${esc(h.msg)}</div>`).join('')}</div>` : ''}
  <div class="card"><b>Illness script — ${esc(def.covers.join(', '))}</b><div class="explain" style="background:transparent;padding:6px 0 0">${esc(val(def.summary, p))}</div><p class="setting" style="margin-top:8px">Source: ${esc(def.src || 'IEYA study guide + illness scripts')}</p></div>
  ${real ? `<div class="card"><b>Textbook comparison — real images from your lecture notes</b><div class="refimg" style="margin-top:8px">${real}</div></div>` : ''}
  <div class="row"><button class="btn sec" id="again">Replay this condition with a new patient</button></div>`);
  const bed = SHIFT.bedOf[SHIFT.idx];
  const nextPatient = () => {
    World.setDone(bed);
    // the bed is free: admit the next patient who is still waiting for a bed
    const wait = SHIFT.bedOf.findIndex((b, i) => b < 0 && i > SHIFT.idx);
    if (wait >= 0) { SHIFT.bedOf[wait] = bed; World.setBedPatient(bed, specOf(SHIFT.pts[wait])); }
    SHIFT.idx++; toWard();
  };
  if ($('#nextPt')) $('#nextPt').onclick = nextPatient;
  if ($('#endS')) $('#endS').onclick = endShift;
  $('#again').onclick = () => {
    SHIFT.list.splice(SHIFT.idx + 1, 0, def); SHIFT.pts.splice(SHIFT.idx + 1, 0, freshPatient(def, (Date.now() * 31) & 0x7fffffff)); SHIFT.bedOf.splice(SHIFT.idx + 1, 0, bed); SHIFT.scores.splice(SHIFT.idx + 1, 0, undefined);
    World.setBedPatient(bed, specOf(SHIFT.pts[SHIFT.idx + 1])); SHIFT.idx++; toWard();
  };
  if (SHIFT.idx + 1 < SHIFT.list.length) actBar('Back to the ward', nextPatient, 'Your next patient is waiting.'); else actBar('Finish shift', endShift, 'That was your last patient.');
  awardXP(sc);
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', initStart);
