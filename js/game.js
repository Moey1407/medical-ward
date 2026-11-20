/* Ward Round — game layer: menus, choosing your doctor, XP, achievements, ward prompts */
'use strict';
let DOC = {name: 'Dr Thandi Mokoena', preset: 0};
const PROG = {
  get() { try { return JSON.parse(localStorage.getItem('wardround.prog')) || {xp: 0, ach: {}, doc: null}; } catch (e) { return {xp: 0, ach: {}, doc: null}; } },
  put(d) { try { localStorage.setItem('wardround.prog', JSON.stringify(d)); } catch (e) {} },
};
const ACH = {first: 'First patient seen', perfect: 'Top of the class: 90% or more on a patient', clean: 'First, do no harm: a case with no harmful orders', fast: 'Quick hands: finished a patient in under 10 real minutes', saved: 'Saved them: treated an unstable patient before they crashed', shift: 'Survived a shift', marathon: 'Marathon: 5 patients in one shift', integ: 'Integrated thinker: 70%+ on a patient with a comorbidity'};
const levelOf = xp => Math.floor(Math.sqrt(xp / 120)) + 1;
const xpFor = lv => (lv - 1) * (lv - 1) * 120;
const TQ = []; let tBusy = false;
function toast(html) { TQ.push(html); if (!tBusy) nextToast(); }
function nextToast() { const html = TQ.shift(); if (!html) { tBusy = false; return; } tBusy = true; const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('#toasts').appendChild(t); setTimeout(() => { t.remove(); nextToast(); }, 2600); }
function unlock(id, label) { const pr = PROG.get(); if (pr.ach[id]) return; pr.ach[id] = Date.now(); PROG.put(pr); toast(`🏆 <b>Achievement</b> · ${esc(label || ACH[id])}`); }
function hudXP() {
  const pr = PROG.get(), lv = levelOf(pr.xp), a = xpFor(lv), b = xpFor(lv + 1);
  $('#hudLv').textContent = lv; $('#hudName').textContent = DOC.name; $('#hudXp').style.width = Math.round(100 * (pr.xp - a) / (b - a)) + '%';
}
function awardXP(sc) {
  const pr = PROG.get(); const before = levelOf(pr.xp);
  const gains = [['Patient seen', 50], ['Score', Math.round(sc * 1.5)]];
  const treated = P.given.length > 0, gotMust = (P.pts.orders || 0) > 0;
  if (!P.harms && !P.crashed && treated) gains.push(['No harm', 30]);
  if (!P.crashed && P.def.crit && gotMust) gains.push(['Kept them stable', 40]);
  const xp = gains.reduce((a, [, v]) => a + v, 0); pr.xp += xp; PROG.put(pr); SHIFT.xp += xp;
  const host = $('#xpGain'); if (host) host.innerHTML = gains.map(([k, v]) => `<span>+${v} ${k}</span>`).join('');
  unlock('first'); if (sc >= 90) unlock('perfect'); if (!P.harms && !P.crashed && treated && sc >= 50) unlock('clean'); if (Date.now() - P.realStart < 600000 && sc >= 60) unlock('fast');
  if (P.def.crit && !P.crashed && gotMust) unlock('saved'); if (P.p.overlay && sc >= 70) unlock('integ');
  if (levelOf(pr.xp) > before) toast(`⭐ <b>Level ${levelOf(pr.xp)}</b> — nice work, doctor`);
  hudXP();
}

/* ---------- screens ---------- */
function show(id) { ['menu', 'how', 'ach', 'charsel', 'start'].forEach(s => $('#' + s).classList.toggle('hide', s !== id)); }
document.addEventListener('DOMContentLoaded', () => {
  World.init($('#world'));
  const pr = PROG.get();
  if (pr.doc) DOC = pr.doc;
  World.setDoctor(Object.assign({}, World.PRESETS[DOC.preset], {name: DOC.name}));
  // a few demo patients so the ward isn't empty behind the menu
  const r = mkRng(Date.now() & 0xffff);
  [{sex: 'F', age: 58, skin: 4, build: 'overweight', signs: []}, {sex: 'M', age: 34, skin: 2, build: 'normal', signs: ['sweaty'], attach: ['prongs']}, null, {sex: 'M', age: 71, skin: 1, build: 'thin', signs: ['pallor'], attach: ['iv']}, {sex: 'F', age: 9, skin: 5, build: 'thin', signs: []}, {sex: 'F', age: 27, skin: 3, build: 'normal', preg: 30, signs: []}]
    .forEach((s, i) => World.setBedPatient(i, s && Object.assign({name: 'demo' + i + r.int(0, 999), v: {hr: r.int(70, 110), sbp: r.int(100, 140), dbp: 70, rr: 18, sat: 97}}, s)));
  World.setMode('menu');
  $('#mStats').textContent = pr.xp ? `${DOC.name} · level ${levelOf(pr.xp)} · ${pr.xp} XP` : (document.documentElement.classList.contains('mobile') ? 'Hold your phone upright · tap to play' : 'Point, click and type: no keyboard moving needed');
  $('#mBegin').onclick = () => { show('charsel'); World.setMode('select'); drawSel(); };
  $('#mHow').onclick = () => show('how');
  $('#mAch').onclick = () => { const a = PROG.get().ach; $('#achList').innerHTML = Object.entries(ACH).map(([k, v]) => `<div class="find" style="grid-template-columns:40px 1fr;opacity:${a[k] ? 1 : .45}"><span style="font-size:24px">${a[k] ? '🏆' : '🔒'}</span><div>${esc(v)}</div></div>`).join(''); show('ach'); };
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { show('menu'); World.setMode('menu'); });
  // character select
  let idx = DOC.preset || 0;
  const drawSel = () => { const ps = World.PRESETS[idx]; $('#csName').textContent = ps.name; const mine = idx === DOC.preset && DOC.name && DOC.name !== ps.name; $('#csInput').value = mine ? DOC.name : ''; $('#csInput').placeholder = 'Type your name'; World.setDoctor(Object.assign({}, ps)); World.setMode('select'); };
  $('#csPrev').onclick = () => { idx = (idx + World.PRESETS.length - 1) % World.PRESETS.length; drawSel(); };
  $('#csNext').onclick = () => { idx = (idx + 1) % World.PRESETS.length; drawSel(); };
  $('#csGo').onclick = () => { DOC = {preset: idx, name: ($('#csInput').value.trim() || World.PRESETS[idx].name).slice(0, 28)}; const p2 = PROG.get(); p2.doc = DOC; PROG.put(p2); World.setDoctor(Object.assign({}, World.PRESETS[idx], {name: DOC.name})); show('start'); World.setMode('menu'); };
  // ward prompts
  World.onNear = b => {
    const el = $('#prompt');
    if (!b || !b.spec || !SHIFT) { el.classList.add('hide'); return; }
    el.innerHTML = `<span>Next: bed ${b.i + 1} · ${esc(b.spec.name)}</span><button class="btn warn" id="seeBtn">See patient</button>`;
    el.classList.remove('hide'); $('#seeBtn').onclick = () => World.goToBed(b.i);
  };
  World.onFrame = () => {
    const bub = $('#bubble'); if (bub.classList.contains('hide') || $('#hud').classList.contains('hide')) return;
    const p = World.screenPos(World.nurse.userData.head, -0.45); bub.style.left = p.x + 'px'; bub.style.top = p.y + 'px';
  };
  addEventListener('keydown', e => { if (e.key === 'Escape') { $('#drawer').classList.add('hide'); $('#folder').classList.remove('open'); } });
});

/* phones: give the case panel more room (tap the handle, or swipe it up/down) */
(() => {
  const root = document.documentElement, grab = document.getElementById('grab'), tx = document.getElementById('grabTx');
  if (!grab) return;
  const set = on => { root.classList.toggle('tall', on); tx.textContent = on ? 'Tap or swipe down to see the patient' : 'Swipe up or tap for more room'; try { localStorage.setItem('wardround.tall', on ? '1' : ''); } catch (e) {} setTimeout(() => dispatchEvent(new Event('resize')), 320); };
  try { if (localStorage.getItem('wardround.tall')) set(true); } catch (e) {}
  grab.onclick = () => set(!root.classList.contains('tall'));
  let y0 = null;
  grab.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, {passive: true});
  grab.addEventListener('touchend', e => { if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; if (Math.abs(dy) > 25) { e.preventDefault(); set(dy < 0); } });
})();
