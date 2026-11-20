/* Ward Round — renderers: patient avatar (SVG), 12-lead ECG (SVG), chest X-ray + bone X-ray (canvas) */
'use strict';

/* =========================================================
   PATIENT AVATAR
   spec: {sex, age, build, skin(1-5), signs:[], attach:[], preg (weeks), parent:bool}
   ========================================================= */
const SKIN = ['#F2D3BA', '#DDAA82', '#B97D52', '#8A5634', '#5B3622'];
function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map(h => parseInt(h, 16)), pb = b.match(/\w\w/g).map(h => parseInt(h, 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function avatarSVG(s) {
  const sg = new Set(s.signs || []), at = new Set(s.attach || []);
  const child = s.age < 13, infant = s.age < 2, old = s.age >= 65;
  let skin = SKIN[(s.skin || 3) - 1];
  if (sg.has('pallor')) skin = mix(skin, '#E9E2DA', s.skin >= 4 ? 0.28 : 0.4);
  if (sg.has('jaundice')) skin = mix(skin, '#E8C640', s.skin >= 4 ? 0.22 : 0.38);
  if (sg.has('flushed')) skin = mix(skin, '#D9534F', 0.12);
  const shade = mix(skin, '#000000', 0.18);
  const bw = {cachectic: 0.72, thin: 0.84, normal: 1, overweight: 1.17, obese: 1.42}[s.build] || 1;
  const sc = infant ? 0.5 : child ? 0.68 : 1;              // overall body scale
  const cx = 110, top = infant ? 120 : child ? 78 : 26;
  const headR = (child ? 26 : 23) * (infant ? 0.95 : 1) * (sg.has('moonface') ? 1.12 : 1);
  const faceW = headR * (s.build === 'obese' ? 1.08 : s.build === 'cachectic' ? 0.9 : 1) * (sg.has('moonface') ? 1.12 : 1);
  const hy = top + headR;
  const neckY = hy + headR - 2;
  const sh = 44 * bw * sc + 10, waist = 36 * bw * sc * (s.sex === 'F' && !child ? 0.92 : 1) + 8;
  const torsoTop = neckY + 8 * sc, torsoH = 92 * sc, hipY = torsoTop + torsoH;
  const belly = (s.build === 'obese' ? 16 : s.build === 'overweight' ? 8 : 0) + (sg.has('ascites') ? 22 : 0) + (s.preg ? Math.min(26, 6 + s.preg * 0.7) : 0);
  const gown = sg.has('noGown') ? skin : 'var(--ground)';
  const gownDot = child ? '#7FB0A6' : '#8BAAC4';
  const legLen = 82 * sc, legW = 15 * Math.sqrt(bw) * sc;
  let o = `<svg viewBox="0 0 220 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Patient illustration" data-lm="${(hy - headR).toFixed(1)}|${neckY.toFixed(1)}|${torsoTop.toFixed(1)}|${hipY.toFixed(1)}|${cx}|${sc}|${bw}">`;
  o += `<defs><pattern id="gp" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="${gownDot}"/></pattern>
  <radialGradient id="mist"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><g class="pt" stroke="var(--hi)" stroke-width=".9" stroke-linejoin="round">`;
  // parent behind child
  if (s.parent) o += `<g opacity=".5"><circle cx="160" cy="62" r="22" fill="${mix(SKIN[(s.skin || 3) - 1], '#888888', 0.3)}"/><path d="M118 300 C120 150 200 140 205 300Z" fill="#B9A98C"/><path d="M138 52 q22 -30 46 0 q-6 -22 -23 -22 q-17 0 -23 22Z" fill="#2b2420"/></g>`;
  // IV pole
  if (at.has('iv')) o += `<g><line x1="200" y1="20" x2="200" y2="290" stroke="#9aa3ab" stroke-width="3"/><rect x="188" y="26" width="22" height="34" rx="5" fill="#dfeef6" stroke="#9aa3ab"/><rect x="191" y="38" width="16" height="18" rx="3" fill="#cfe6f2"/><path d="M199 60 C199 120 170 140 ${cx + sh + 6} ${torsoTop + 70}" stroke="#b9c8d2" stroke-width="1.6" fill="none"/></g>`;
  // legs
  const lx1 = cx - 13 * bw * sc - 2, lx2 = cx + 13 * bw * sc + 2, ly = hipY - 6;
  const ankle = (sg.has('oedema') ? legW * 1.25 : legW * 0.62);
  [lx1, lx2].forEach((lx, i) => {
    const deformed = sg.has('legDeform') && i === (s.side === 'left' ? 1 : 0);
    const len = deformed ? legLen * 0.9 : legLen;
    const rot = deformed ? (i === 0 ? 14 : -14) : 0;
    o += `<g transform="rotate(${rot} ${lx} ${ly})"><path d="M${lx - legW / 2} ${ly} L${lx - ankle / 2} ${ly + len} L${lx + ankle / 2} ${ly + len} L${lx + legW / 2} ${ly}Z" fill="${skin}"/>`;
    o += `<ellipse cx="${lx + (i ? 4 : -4) * (deformed ? 2 : 1)}" cy="${ly + len + 4}" rx="${ankle * 0.75 + 4}" ry="5" fill="${shade}"/>`;
    if (sg.has('swollenKnee') && i === (s.side === 'left' ? 1 : 0)) o += `<ellipse cx="${lx}" cy="${ly + len * 0.45}" rx="${legW * 0.75}" ry="${legW * 0.7}" fill="${mix(skin, '#D9534F', 0.35)}"/>`;
    if (sg.has('redToe') && i === (s.side === 'left' ? 1 : 0)) o += `<circle cx="${lx + (i ? 7 : -7)}" cy="${ly + len + 4}" r="4.5" fill="#C9433F"/>`;
    if (sg.has('ks')) o += `<circle cx="${lx - 2}" cy="${ly + len * 0.7}" r="3" fill="#6B2A55"/><circle cx="${lx + 3}" cy="${ly + len * 0.82}" r="2.3" fill="#7A3363"/>`;
    if (sg.has('bruise') || sg.has('petechiae')) o += `<ellipse cx="${lx + 2}" cy="${ly + len * 0.35}" rx="${sg.has('bruise') ? 5 : 1.4}" ry="${sg.has('bruise') ? 4 : 1.4}" fill="#5D3B6E" opacity=".75"/><circle cx="${lx - 3}" cy="${ly + len * 0.6}" r="1.3" fill="#7a2a3a"/><circle cx="${lx + 4}" cy="${ly + len * 0.66}" r="1.1" fill="#7a2a3a"/>`;
    o += `</g>`;
  });
  // gown hem / shorts
  o += `<path d="M${cx - waist - belly * 0.3} ${hipY - 30} L${cx - waist - 6} ${hipY + 14} L${cx + waist + 6} ${hipY + 14} L${cx + waist + belly * 0.3} ${hipY - 30}Z" fill="${gown}"/><path d="M${cx - waist - belly * 0.3} ${hipY - 30} L${cx - waist - 6} ${hipY + 14} L${cx + waist + 6} ${hipY + 14} L${cx + waist + belly * 0.3} ${hipY - 30}Z" fill="none"/>`;
  // arms
  const armW = 11 * Math.sqrt(bw) * sc + 2;
  const armL = 86 * sc;
  [[-1, cx - sh], [1, cx + sh]].forEach(([d, ax]) => {
    const handX = ax + d * (10 + 6 * bw) * sc, handY = torsoTop + armL;
    o += `<path d="M${ax} ${torsoTop + 6} Q${ax + d * (armW + 4)} ${torsoTop + armL * 0.5} ${handX} ${handY}" stroke="${skin}" stroke-width="${armW}" stroke-linecap="round" fill="none"/>`;
    o += `<circle cx="${handX}" cy="${handY + 2}" r="${armW * 0.6}" fill="${skin}"/>`;
    if (sg.has('urticaria')) for (let k = 0; k < 4; k++) o += `<ellipse cx="${ax + d * (6 + k * 2)}" cy="${torsoTop + 22 + k * 15}" rx="4" ry="2.6" fill="#E8A1A0" opacity=".85"/>`;
    if (at.has('iv') && d === 1) o += `<rect x="${handX - 8}" y="${handY - 22}" width="12" height="7" rx="2" fill="#fff" stroke="#9aa3ab"/>`;
    if (sg.has('sling') && d === (s.side === 'left' ? 1 : -1)) o += `<path d="M${cx - sh * 0.4} ${torsoTop} L${handX} ${torsoTop + armL * 0.62} L${cx + d * 4} ${torsoTop + armL * 0.66}Z" fill="#e8e2d0" stroke="#cfc6ae"/>`;
  });
  // torso (gown)
  const tw = sh, bw2 = waist + belly * 0.5;
  o += `<path d="M${cx - tw} ${torsoTop + 8} Q${cx - tw - 4} ${torsoTop} ${cx - 12} ${torsoTop - 2} L${cx + 12} ${torsoTop - 2} Q${cx + tw + 4} ${torsoTop} ${cx + tw} ${torsoTop + 8}
    C${cx + tw + 2} ${torsoTop + torsoH * 0.45} ${cx + bw2 + belly} ${torsoTop + torsoH * 0.62} ${cx + bw2} ${hipY - 14}
    L${cx - bw2} ${hipY - 14} C${cx - bw2 - belly * 0.4} ${torsoTop + torsoH * 0.62} ${cx - tw - 2} ${torsoTop + torsoH * 0.45} ${cx - tw} ${torsoTop + 8}Z" fill="${gown}"/>`;
  o += `<path d="M${cx - tw} ${torsoTop + 8} Q${cx - tw - 4} ${torsoTop} ${cx - 12} ${torsoTop - 2} L${cx + 12} ${torsoTop - 2} Q${cx + tw + 4} ${torsoTop} ${cx + tw} ${torsoTop + 8}
    C${cx + tw + 2} ${torsoTop + torsoH * 0.45} ${cx + bw2 + belly} ${torsoTop + torsoH * 0.62} ${cx + bw2} ${hipY - 14}
    L${cx - bw2} ${hipY - 14} C${cx - bw2 - belly * 0.4} ${torsoTop + torsoH * 0.62} ${cx - tw - 2} ${torsoTop + torsoH * 0.45} ${cx - tw} ${torsoTop + 8}Z" fill="none"/>`;
  if (s.sex === 'F' && !child) o += `<path d="M${cx - tw * 0.7} ${torsoTop + 30 * sc} q${tw * 0.35} ${14} ${tw * 0.68} 0 M${cx + 2} ${torsoTop + 30 * sc} q${tw * 0.35} ${14} ${tw * 0.68} 0" stroke="${mix(gown, '#000000', 0.15)}" stroke-width="1.3" fill="none"/>`;
  if (sg.has('ascites')) o += `<path d="M${cx - 10} ${torsoTop + torsoH * 0.55} q-8 10 -2 20 M${cx + 9} ${torsoTop + torsoH * 0.55} q8 10 2 20" stroke="${mix(gown, '#3355aa', 0.4)}" stroke-width="1.3" fill="none"/>`;
  if (at.has('leads')) [[-0.55, 0.18], [0.55, 0.18], [-0.4, 0.62], [0.45, 0.62]].forEach(([a, b]) => { o += `<circle cx="${cx + a * tw}" cy="${torsoTop + b * torsoH}" r="3.2" fill="#f5f5f5" stroke="#7a8590"/>`; });
  if (at.has('collar')) o += `<rect x="${cx - 18 * sc}" y="${neckY - 6}" width="${36 * sc}" height="16" rx="5" fill="#d9d4c7" stroke="#b6ad98"/>`;
  // neck
  else o += `<rect x="${cx - 9 * sc * Math.sqrt(bw)}" y="${neckY - 6}" width="${18 * sc * Math.sqrt(bw)}" height="${14 * sc}" fill="${shade}"/>`;
  if (sg.has('jvp')) o += `<path d="M${cx + 6} ${neckY - 4} q3 6 0 12" stroke="${mix(skin, '#33264a', 0.5)}" stroke-width="2" fill="none"/>`;
  // head
  o += `<ellipse cx="${cx}" cy="${hy}" rx="${faceW}" ry="${headR * 1.06}" fill="${skin}"/>`;
  if (s.build === 'obese' && !child) o += `<path d="M${cx - faceW * 0.7} ${hy + headR * 0.75} q${faceW * 0.7} ${headR * 0.45} ${faceW * 1.4} 0" fill="${skin}" stroke="${shade}" stroke-width=".8"/>`;
  // hair
  const hair = old ? '#C9C6C0' : s.age > 50 ? '#5a5550' : ['#3a2a1e', '#1f1a17', '#2b211c', '#151212', '#121010'][(s.skin || 3) - 1];
  if (infant) o += `<path d="M${cx - 10} ${hy - headR + 3} q10 -8 20 0" stroke="${hair}" stroke-width="2" fill="none"/>`;
  else if (s.sex === 'F') o += `<path d="M${cx - faceW - 3} ${hy + headR * 0.9} C${cx - faceW - 10} ${hy - headR * 1.2} ${cx + faceW + 10} ${hy - headR * 1.2} ${cx + faceW + 3} ${hy + headR * 0.9} L${cx + faceW - 3} ${hy} Q${cx} ${hy - headR * 1.2} ${cx - faceW + 3} ${hy}Z" fill="${hair}"/>`;
  else o += `<path d="M${cx - faceW + 1} ${hy - 2} C${cx - faceW} ${hy - headR * 1.25} ${cx + faceW} ${hy - headR * 1.25} ${cx + faceW - 1} ${hy - 2} Q${cx} ${hy - headR * 0.85} ${cx - faceW + 1} ${hy - 2}Z" fill="${hair}"/>`;
  // face features
  const ey = hy - headR * 0.08, ex = faceW * 0.38;
  const sclera = sg.has('jaundice') ? '#F2DB6B' : '#ffffff';
  [-1, 1].forEach(d => {
    o += `<ellipse cx="${cx + d * ex}" cy="${ey}" rx="4.3" ry="${sg.has('drowsy') ? 1.2 : 3}" fill="${sclera}"/><circle cx="${cx + d * ex}" cy="${ey + 0.3}" r="${sg.has('drowsy') ? 1 : 1.9}" fill="#2a1d16"/>`;
    const brow = sg.has('pain') || sg.has('distress') ? (d === -1 ? `M${cx + d * ex - 5} ${ey - 5} L${cx + d * ex + 4} ${ey - 8}` : `M${cx + d * ex + 5} ${ey - 5} L${cx + d * ex - 4} ${ey - 8}`) : `M${cx + d * ex - 5} ${ey - 7} q5 -3 10 0`;
    o += `<path d="${brow}" stroke="${hair === '#C9C6C0' ? '#8d8a84' : '#2a1d16'}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    if (sg.has('cachectic') || s.build === 'cachectic') o += `<path d="M${cx + d * faceW * 0.62} ${hy + 2} q${-d * 3} 7 0 13" stroke="${shade}" stroke-width="2" fill="none"/>`;
    if (sg.has('flushed') || sg.has('fever')) o += `<ellipse cx="${cx + d * faceW * 0.55}" cy="${hy + headR * 0.28}" rx="6" ry="3.5" fill="#E26B5E" opacity=".45"/>`;
    if (sg.has('malar')) o += `<path d="M${cx + d * 3} ${hy + headR * 0.12} q${d * 10} -4 ${d * 17} 6 q${-d * 8} 5 ${-d * 17} -1Z" fill="#D9574F" opacity=".6"/>`;
    if (old) o += `<path d="M${cx + d * (ex + 6)} ${ey + 2} l${d * 4} 2" stroke="${shade}" stroke-width=".9"/>`;
  });
  if (sg.has('palpebral')) {}
  o += `<path d="M${cx} ${ey + 3} q-2 7 1 9" stroke="${shade}" stroke-width="1.4" fill="none"/>`;
  if (sg.has('nasalFlare') || sg.has('distress')) o += `<path d="M${cx - 4} ${ey + 12} q-2 -2 0 -4 M${cx + 5} ${ey + 12} q2 -2 0 -4" stroke="${shade}" stroke-width="1.2" fill="none"/>`;
  const lipC = sg.has('cyanosis') ? '#5C6FA8' : sg.has('pallor') ? mix(skin, '#c98b86', 0.25) : mix(skin, '#9b4a45', 0.45);
  const my = hy + headR * 0.5;
  if (sg.has('lipSwelling')) o += `<ellipse cx="${cx}" cy="${my}" rx="10" ry="5.5" fill="${mix(lipC, '#d77', 0.3)}"/>`;
  else if (sg.has('distress') || sg.has('breathless')) o += `<ellipse cx="${cx}" cy="${my}" rx="5" ry="3.8" fill="${lipC}"/><ellipse cx="${cx}" cy="${my}" rx="3" ry="2.2" fill="#3a1f1c"/>`;
  else if (sg.has('pain')) o += `<path d="M${cx - 7} ${my + 2} q7 -4 14 0" stroke="${lipC}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  else o += `<path d="M${cx - 7} ${my - 1} q7 4 14 0" stroke="${lipC}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  if (sg.has('ks')) o += `<circle cx="${cx + 1}" cy="${ey + 10}" r="2.6" fill="#6B2A55"/><circle cx="${cx - faceW * 0.5}" cy="${hy + 8}" r="2.1" fill="#7A3363"/>`;
  if (sg.has('sweaty')) [[-0.7, -0.5], [0.6, -0.6], [0.8, 0.1], [-0.2, -0.85]].forEach(([a, b]) => { o += `<path d="M${cx + a * faceW} ${hy + b * headR} q-2 4 0 5 q2 -1 0 -5Z" fill="#bfe3f5" stroke="#8fc3dc" stroke-width=".5"/>`; });
  if (sg.has('urticaria')) o += `<ellipse cx="${cx + faceW * 0.5}" cy="${hy + headR * 0.75}" rx="4" ry="2.4" fill="#E8A1A0" opacity=".85"/>`;
  if (sg.has('thalFacies')) o += `<path d="M${cx - faceW * 0.8} ${hy - headR * 0.6} q${faceW * 0.8} -10 ${faceW * 1.6} 0" stroke="${shade}" stroke-width="2.5" fill="none"/>`;
  // airway devices
  if (at.has('prongs')) o += `<path d="M${cx - faceW - 2} ${ey + 6} Q${cx} ${ey + 16} ${cx + faceW + 2} ${ey + 6}" stroke="#a9d2e6" stroke-width="2" fill="none"/>`;
  if (at.has('mask') || at.has('nrb') || at.has('neb') || at.has('venturi')) {
    o += `<path d="M${cx - 13} ${ey + 6} Q${cx} ${ey - 2} ${cx + 13} ${ey + 6} L${cx + 11} ${my + 9} Q${cx} ${my + 15} ${cx - 11} ${my + 9}Z" fill="#e7f3f9" fill-opacity=".72" stroke="#9fc3d6" stroke-width="1.3"/>`;
    o += `<path d="M${cx - 13} ${ey + 7} L${cx - faceW - 2} ${ey} M${cx + 13} ${ey + 7} L${cx + faceW + 2} ${ey}" stroke="#9fc3d6" stroke-width="1"/>`;
    if (at.has('nrb')) o += `<ellipse cx="${cx}" cy="${my + 28}" rx="11" ry="9" fill="#d8ecf5" stroke="#9fc3d6"/>`;
    if (at.has('neb')) o += `<rect x="${cx - 5}" y="${my + 13}" width="10" height="14" rx="3" fill="#dbe7ee" stroke="#9fc3d6"/><circle cx="${cx + 14}" cy="${my + 4}" r="9" fill="url(#mist)"/>`;
    if (at.has('venturi')) o += `<rect x="${cx - 4}" y="${my + 13}" width="8" height="8" rx="2" fill="#5b8ed6"/>`;
  }
  if (at.has('tube')) o += `<path d="M${cx} ${my} L${cx + 26} ${my + 22}" stroke="#d8e4ea" stroke-width="5"/>`;
  // signs on body
  if (sg.has('kyphosis')) {}
  o += `</g></svg>`;
  return o;
}

/* =========================================================
   ECG — synthetic 12-lead tuned per patient
   e = {rhythm:'sinus'|'af'|'flutter'|'svt'|'vt'|'vf'|'chb'|'1avb'|'mobitz2'|'asystole', rate, stemi:'inferior'|'anterior'|'lateral', nstemi, K, lvh, rbbb, lbbb, s1q3t3, lowVolt, alternans, qwaves, twi:[leads], seed}
   ========================================================= */
const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const BASE = { // P, Q, R, S, T (mm)
  I: [0.8, -0.4, 7, -1, 2], II: [1.5, -0.5, 10, -1.5, 3], III: [0.7, -0.3, 4, -2, 1], aVR: [-1, 0, 1, -7, -2], aVL: [0.3, -0.4, 4, -2, 1], aVF: [1, -0.3, 7, -1.5, 2],
  V1: [0.6, 0, 2, -9, 0.3], V2: [0.7, 0, 4, -12, 3.5], V3: [0.7, 0, 7, -8, 4], V4: [0.7, -0.3, 12, -5, 4], V5: [0.7, -0.6, 13, -2, 3], V6: [0.7, -0.6, 10, -1, 2.5],
};
const STEMI = {
  inferior: {II: 2.5, III: 3.5, aVF: 2.8, I: -1, aVL: -2, V2: -0.8},
  anterior: {V1: 1.5, V2: 3.5, V3: 4, V4: 3, V5: 1.5, III: -1, aVF: -0.8},
  lateral: {I: 2, aVL: 2.5, V5: 2, V6: 2, III: -1.8, aVF: -1},
};
function ecgSVG(e) {
  const R = mkRng(e.seed || 7);
  const px = 4;           // px per mm
  const W = 250 * px, rowH = 30 * px, H = rowH * 4 + 12;
  const rate = e.rate || 75;
  const K = e.K || 4.2;
  const wide = e.lbbb || e.rbbb || K >= 7.2 || e.rhythm === 'vt' || (e.rhythm === 'chb' && e.wideEscape);
  // beat times (s) over 10 s
  const beats = [], ps = [];
  const rr = 60 / rate;
  if (e.rhythm === 'af') { let t = 0.2; while (t < 10.2) { beats.push(t); t += rr * (0.62 + R.raw() * 0.76); } }
  else if (e.rhythm === 'chb') { let t = 0.5; const vr = 60 / (e.vrate || 36); while (t < 10.2) { beats.push(t); t += vr; } let pt = 0.1; while (pt < 10.2) { ps.push(pt); pt += 60 / (e.arate || 85); } }
  else if (e.rhythm === 'vf' || e.rhythm === 'asystole') {}
  else { let t = 0.3 + R.raw() * 0.2; while (t < 10.2) { beats.push(t); t += rr * (e.rhythm === 'sinus' ? (0.97 + R.raw() * 0.06) : 1); } }
  const g = (t, mu, sd) => Math.exp(-((t - mu) ** 2) / (2 * sd * sd));
  const pr = e.rhythm === '1avb' ? 0.3 : 0.16;
  const qtScale = Math.min(1, Math.max(0.75, Math.sqrt(rr)));
  function v(lead, t) {
    let [P, Q, Rr, S, T] = BASE[lead].slice();
    let st = 0;
    if (e.stemi && STEMI[e.stemi][lead] !== undefined) { st = STEMI[e.stemi][lead]; if (st > 0) T += st * 0.7; if (e.qwaves && st > 0) { Q = -Rr * 0.35; Rr *= 0.55; } }
    if (e.nstemi && ['I', 'aVL', 'V4', 'V5', 'V6'].includes(lead)) { st = -1.3; T = -1.5; }
    if (e.twi && e.twi.includes(lead)) T = -Math.abs(T) - 1;
    if (e.lvh) { if (['V5', 'V6', 'I', 'aVL'].includes(lead)) { Rr *= 2.1; st = -0.8; T = -1.6; } if (['V1', 'V2'].includes(lead)) S *= 2; }
    if (e.s1q3t3) { if (lead === 'I') S = -4; if (lead === 'III') { Q = -2.5; T = -1.5; } if (['V1', 'V2', 'V3'].includes(lead)) T = -1.2; }
    if (e.rbbb && lead === 'V1') { Rr = 3; S = -2; }
    if (e.lbbb) { if (['V1', 'V2', 'V3'].includes(lead)) { Rr = 0.5; S = -16; T = 3; } if (['I', 'aVL', 'V5', 'V6'].includes(lead)) { Q = 0; S = 0; Rr = 12; T = -3; } }
    if (K >= 5.6) { T = Math.max(Math.abs(T), 2) * (1 + (K - 5.5) * 1.0) * (T < 0 && !['aVR'].includes(lead) ? 1 : Math.sign(T) || 1); if (K >= 6.5) P *= 0.35; if (K >= 7.5) P = 0; }
    if (K < 3.2) { T *= 0.35; st -= 0.5; }
    let amp = e.lowVolt ? 0.35 : 1;
    if (e.alternans && lead.startsWith('V')) amp *= (Math.floor(t / rr) % 2 ? 0.75 : 1.15);
    const qw = wide ? 2.4 : 1, tw = K >= 5.6 ? 0.65 : 1;
    let y = 0;
    // baseline wander + noise
    y += 0.25 * Math.sin(t * 1.3 + lead.length) + (R.raw() - 0.5) * 0.12;
    if (e.rhythm === 'af') y += 0.35 * Math.sin(t * 37 + lead.length * 2) + 0.25 * Math.sin(t * 53);
    if (e.rhythm === 'flutter' && ['II', 'III', 'aVF', 'V1'].includes(lead)) y += 2.2 * (((t * 5) % 1) - 0.5) * -1;
    if (e.rhythm === 'vf') return 4 * Math.sin(t * 28 + Math.sin(t * 3) * 3) * (0.6 + 0.4 * Math.sin(t * 1.7)) + (R.raw() - 0.5);
    if (e.rhythm === 'asystole') return y * 0.6;
    const pList = e.rhythm === 'chb' ? ps : (['af', 'flutter', 'svt', 'vt'].includes(e.rhythm) ? [] : beats.map(b => b - pr));
    for (const pt of pList) if (Math.abs(t - pt) < 0.15) y += P * g(t, pt, 0.022) * amp;
    for (const b of beats) {
      const d = t - b;
      if (d < -0.12 || d > 0.6) continue;
      if (e.rhythm === 'vt') { y += 9 * amp * (g(d, 0, 0.05) - 0.8 * g(d, 0.12, 0.07)) * (lead === 'aVR' ? -1 : (['V1', 'V2'].includes(lead) ? 1 : 1)); continue; }
      y += amp * (Q * g(d, -0.028 * qw, 0.008 * qw) + Rr * g(d, 0, 0.011 * qw) + S * g(d, 0.028 * qw, 0.01 * qw));
      if (e.rbbb && ['V1', 'V2'].includes(lead)) y += amp * 6 * g(d, 0.07, 0.014);
      if (e.rbbb && ['I', 'V6'].includes(lead)) y += amp * -2.5 * g(d, 0.07, 0.02);
      // ST segment + T
      const jEnd = 0.045 * qw, tPeak = (0.27 + (wide ? 0.04 : 0)) * qtScale;
      if (d > jEnd && d < tPeak + 0.12) y += amp * st * Math.min(1, (d - jEnd) / 0.02) * Math.max(0, 1 - Math.max(0, d - tPeak) / 0.12);
      y += amp * T * g(d, tPeak, 0.045 * qtScale * tw);
      if (K < 3.2) y += amp * 1.2 * g(d, tPeak + 0.16, 0.04);
    }
    return y;
  }
  let o = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="ecg" role="img" aria-label="12-lead ECG">`;
  o += `<defs><pattern id="sm" width="${px}" height="${px}" patternUnits="userSpaceOnUse"><path d="M${px} 0V${px}H0" fill="none" stroke="#F3B9C3" stroke-width=".5"/></pattern><pattern id="lg" width="${px * 5}" height="${px * 5}" patternUnits="userSpaceOnUse"><rect width="${px * 5}" height="${px * 5}" fill="url(#sm)"/><path d="M${px * 5} 0V${px * 5}H0" fill="none" stroke="#E88A9B" stroke-width="1"/></pattern></defs>`;
  o += `<rect width="${W}" height="${H}" fill="#FDF3F4"/><rect width="${W}" height="${H}" fill="url(#lg)"/>`;
  const layout = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];
  const segW = W / 4;
  const path = (lead, t0, t1, x0, y0) => {
    let d = '';
    for (let t = t0, i = 0; t <= t1; t += 0.004, i++) { const x = x0 + (t - t0) * 25 * px; const y = y0 - v(lead, t) * px; d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
    return `<path d="${d}" fill="none" stroke="#1d1d1f" stroke-width="1.15" stroke-linejoin="round"/>`;
  };
  layout.forEach((row, ri) => row.forEach((lead, ci) => {
    const y0 = ri * rowH + rowH * 0.55, x0 = ci * segW;
    o += path(lead, ci * 2.5, ci * 2.5 + 2.48, x0 + 2, y0);
    o += `<text x="${x0 + 6}" y="${ri * rowH + 14}" font-size="12" font-family="ui-monospace, Menlo, monospace" fill="#333">${lead}</text>`;
    if (ci) o += `<line x1="${x0}" y1="${y0 - 14}" x2="${x0}" y2="${y0 + 6}" stroke="#222" stroke-width="1"/>`;
  }));
  o += path('II', 0, 9.98, 2, 3 * rowH + rowH * 0.55);
  o += `<text x="6" y="${3 * rowH + 14}" font-size="12" font-family="ui-monospace, Menlo, monospace" fill="#333">II (rhythm)</text>`;
  o += `<text x="${W - 230}" y="${H - 4}" font-size="11" font-family="ui-monospace, Menlo, monospace" fill="#555">25 mm/s · 10 mm/mV · 0.05–150 Hz</text></svg>`;
  return o;
}

/* =========================================================
   CHEST X-RAY — procedural, per patient
   x = {sex, age, build, ctr, hyperinfl, consol:[{lobe, dens}], effusion:{side,size}, ptx:{side,size,tension}, cavity:{side}, miliary, oedema, kerley, bronchiectasis, nodules:n, freeAir, globular, hilar, fibrosis:{side}, seed, label}
   ========================================================= */
function drawCXR(canvas, x) {
  const R = mkRng(x.seed || 11);
  const W = 520, H = 620; canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const child = x.age < 12;
  const bw = {cachectic: 0.86, thin: 0.92, normal: 1, overweight: 1.06, obese: 1.13}[x.build] || 1;
  const rot = (R.raw() - 0.5) * 0.03;
  c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H / 2); c.rotate(rot); c.translate(-W / 2, -H / 2);
  const cx = W / 2 + (R.raw() - 0.5) * 10;
  const thx = 205 * Math.min(bw, 1.04);        // thorax half-width
  const top = 70, inspire = x.hyperinfl ? 1.12 : (0.94 + R.raw() * 0.08);
  const diaR = (430 + (x.hyperinfl ? 60 : 0)) * inspire * (child ? 0.97 : 1), diaL = diaR + 16;
  const shiftMed = x.ptx && x.ptx.tension ? (x.ptx.side === 'right' ? 34 : -34) : (x.effusion && x.effusion.size === 'massive' ? (x.effusion.side === 'right' ? 26 : -26) : 0);
  // soft tissue body
  let gr = c.createRadialGradient(cx, H * 0.55, 60, cx, H * 0.55, 330 * bw);
  const soft = x.build === 'obese' ? 112 : x.build === 'overweight' ? 92 : x.build === 'cachectic' ? 58 : 76;
  gr.addColorStop(0, `rgb(${soft},${soft},${soft})`); gr.addColorStop(0.75, `rgb(${soft * 0.8},${soft * 0.8},${soft * 0.8})`); gr.addColorStop(1, 'rgb(12,12,12)');
  c.fillStyle = gr;
  c.beginPath(); c.ellipse(cx, H * 0.6, 248 * bw, 360, 0, 0, Math.PI * 2); c.fill();
  // arms
  c.fillStyle = `rgba(${soft},${soft},${soft},.7)`; c.fillRect(cx - 262 * bw, 120, 30, 520); c.fillRect(cx + 232 * bw, 120, 30, 520);
  // neck
  c.fillStyle = `rgb(${soft + 10},${soft + 10},${soft + 10})`; c.fillRect(cx - 50, 0, 100, 90);
  // abdomen below diaphragm (bright)
  const ab = c.createLinearGradient(0, diaR - 40, 0, H); ab.addColorStop(0, 'rgb(170,170,170)'); ab.addColorStop(1, 'rgb(120,120,120)'); c.fillStyle = ab; c.filter = 'blur(2px)';
  c.beginPath(); c.moveTo(cx - thx - 30, H); c.lineTo(cx - thx - 10, diaR + 40);
  c.quadraticCurveTo(cx - thx * 0.5, diaR - 52 * (x.hyperinfl ? 0.35 : 1), cx - 10, diaR + 10);
  c.quadraticCurveTo(cx + thx * 0.5, diaL - 52 * (x.hyperinfl ? 0.35 : 1), cx + thx + 10, diaL + 40);
  c.lineTo(cx + thx + 30, H); c.closePath(); c.fill(); c.filter = 'none';
  // lungs (clip region)
  const lungPath = (side) => {
    const s = side === 'right' ? -1 : 1, base = side === 'right' ? diaR : diaL;
    const p = new Path2D();
    const mx = cx + s * 22 + shiftMed * (side === (shiftMed > 0 ? 'left' : 'right') ? 0 : 0);
    p.moveTo(mx + s * 8, top + 30);
    p.quadraticCurveTo(cx + s * 70, top - 5, cx + s * (thx * 0.62), top + 30);
    p.quadraticCurveTo(cx + s * thx * 1.02, top + 160, cx + s * thx * 0.98, base + 30);   // lateral wall → CP angle
    p.quadraticCurveTo(cx + s * thx * 0.55, base - 55 * (x.hyperinfl ? 0.35 : 1), cx + s * 40, base);
    p.lineTo(mx + s * 10, base - 10);
    p.closePath();
    return p;
  };
  const LR = lungPath('right'), LL = lungPath('left');
  const ptxSide = x.ptx ? x.ptx.side : null;
  const lungDark = x.hyperinfl ? 18 : x.build === 'obese' ? 46 : 30;
  [['right', LR], ['left', LL]].forEach(([side, p]) => {
    c.save(); c.clip(p);
    const g2 = c.createLinearGradient(cx, top, cx + (side === 'right' ? -thx : thx), top);
    g2.addColorStop(0, `rgb(${lungDark + 26},${lungDark + 26},${lungDark + 26})`); g2.addColorStop(1, `rgb(${lungDark},${lungDark},${lungDark})`);
    c.fillStyle = g2; c.fill(p);
    // vascular markings from hilum
    const hx = cx + (side === 'right' ? -62 : 62) + shiftMed * 0.6, hy = top + 210;
    const branch = (x0, y0, ang, len, w, depth) => {
      if (depth > 5 || len < 6) return;
      if (ptxSide === side && Math.abs(x0 - cx) > thx * (1 - (x.ptx.size === 'large' ? 0.55 : 0.25))) return;
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      c.strokeStyle = `rgba(190,190,190,${0.12 + w * 0.05})`; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      branch(x1, y1, ang + (R.raw() - 0.3) * 0.6, len * 0.72, w * 0.68, depth + 1);
      branch(x1, y1, ang - (R.raw() - 0.3) * 0.6, len * 0.66, w * 0.62, depth + 1);
    };
    const dir = side === 'right' ? Math.PI : 0;
    const upper = x.oedema ? 1.6 : 1;
    for (let k = 0; k < 7; k++) { const a = dir + (side === 'right' ? 1 : -1) * (-1.1 + k * 0.36); branch(hx, hy, a, 42 * (k < 3 ? upper : 1), (k < 3 ? 3.2 * upper : 3.4), 0); }
    // hilum
    c.fillStyle = 'rgba(190,190,190,.55)'; c.beginPath(); c.ellipse(hx, hy, x.hilar ? 26 : 14, x.hilar ? 34 : 24, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  });
  // pathology inside lungs
  const zone = (lobe) => ({RUL: ['right', 0.55, 0.22], RML: ['right', 0.35, 0.6], RLL: ['right', 0.55, 0.83], LUL: ['left', 0.55, 0.25], LING: ['left', 0.38, 0.58], LLL: ['left', 0.5, 0.85]}[lobe]);
  const lungY = (f, side) => top + f * ((side === 'right' ? diaR : diaL) - top);
  const blob = (side, fx, fy, rx, ry, a) => {
    const px2 = cx + (side === 'right' ? -1 : 1) * thx * fx, py = lungY(fy, side);
    c.save(); c.clip(side === 'right' ? LR : LL);
    for (let i = 0; i < 26; i++) {
      const ox = (R.raw() - 0.5) * rx * 1.3, oy = (R.raw() - 0.5) * ry * 1.3;
      const gg = c.createRadialGradient(px2 + ox, py + oy, 2, px2 + ox, py + oy, rx * 0.7);
      gg.addColorStop(0, `rgba(215,215,215,${a * 0.22})`); gg.addColorStop(1, 'rgba(215,215,215,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(px2 + ox, py + oy, rx * 0.7, 0, Math.PI * 2); c.fill();
    }
    c.restore(); return [px2, py];
  };
  (x.consol || []).forEach(cs => {
    const [side, fx, fy] = zone(cs.lobe); const [bx, by] = blob(side, fx, fy, 95, 78, cs.dens || 1);
    // air bronchograms
    c.save(); c.clip(side === 'right' ? LR : LL); c.strokeStyle = 'rgba(40,40,40,.55)'; c.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(bx + (R.raw() - 0.5) * 30, by - 20); c.quadraticCurveTo(bx + (R.raw() - 0.5) * 60, by, bx + (R.raw() - 0.5) * 70, by + 30); c.stroke(); }
    c.restore();
  });
  if (x.oedema) ['right', 'left'].forEach(side => { blob(side, 0.3, 0.52, 120, 120, 1.1); blob(side, 0.42, 0.62, 90, 90, 0.7); });
  if (x.kerley) ['right', 'left'].forEach(side => { c.strokeStyle = 'rgba(220,220,220,.5)'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const yy = lungY(0.78 + i * 0.025, side), xx = cx + (side === 'right' ? -1 : 1) * thx * 0.93; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + (side === 'right' ? 1 : -1) * 16, yy); c.stroke(); } });
  if (x.miliary) [['right', LR], ['left', LL]].forEach(([side, p]) => { c.save(); c.clip(p); c.fillStyle = 'rgba(225,225,225,.5)'; for (let i = 0; i < 520; i++) { const xx = cx + (side === 'right' ? -1 : 1) * (30 + R.raw() * thx), yy = top + 20 + R.raw() * ((side === 'right' ? diaR : diaL) - top); c.beginPath(); c.arc(xx, yy, 1.4 + R.raw() * 1.1, 0, Math.PI * 2); c.fill(); } c.restore(); });
  if (x.cavity) { const side = x.cavity.side; const [bx, by] = blob(side, 0.48, 0.2, 80, 70, 1.1); c.save(); c.clip(side === 'right' ? LR : LL); c.strokeStyle = 'rgba(225,225,225,.85)'; c.lineWidth = 6; c.beginPath(); c.arc(bx, by + 6, 22, 0, Math.PI * 2); c.stroke(); c.fillStyle = 'rgba(15,15,15,.9)'; c.beginPath(); c.arc(bx, by + 6, 19, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(200,200,200,.6)'; c.fillRect(bx - 19, by + 14, 38, 11); c.restore();
    if (x.cavity.both) blob(side === 'right' ? 'left' : 'right', 0.45, 0.22, 60, 50, 0.7);
    c.strokeStyle = 'rgba(210,210,210,.35)'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(cx + (side === 'right' ? -60 : 60), top + 200); c.lineTo(bx + (R.raw() - 0.5) * 60, top + 60 + R.raw() * 50); c.stroke(); } }
  if (x.fibrosis) { const side = x.fibrosis.side || 'right'; c.save(); c.clip(side === 'right' ? LR : LL); c.strokeStyle = 'rgba(210,210,210,.4)'; c.lineWidth = 1.5; for (let i = 0; i < 90; i++) { const xx = cx + (side === 'right' ? -1 : 1) * (40 + R.raw() * thx * 0.9), yy = top + R.raw() * 260; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + (R.raw() - 0.5) * 22, yy + (R.raw() - 0.5) * 22); c.stroke(); } c.restore(); }
  if (x.bronchiectasis) ['right', 'left'].forEach(side => { c.save(); c.clip(side === 'right' ? LR : LL); c.strokeStyle = 'rgba(215,215,215,.55)'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { const xx = cx + (side === 'right' ? -1 : 1) * (60 + R.raw() * 110), yy = lungY(0.62 + R.raw() * 0.3, side); if (R.raw() < 0.5) { c.beginPath(); c.arc(xx, yy, 6 + R.raw() * 4, 0, Math.PI * 2); c.stroke(); } else { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 26, yy + 18); c.moveTo(xx + 6, yy - 6); c.lineTo(xx + 32, yy + 12); c.stroke(); } } c.restore(); });
  for (let i = 0; i < (x.nodules || 0); i++) { const side = R.raw() < 0.5 ? 'right' : 'left'; blob(side, 0.3 + R.raw() * 0.5, 0.25 + R.raw() * 0.65, 34, 34, 1.3); }
  // pleural effusion
  if (x.effusion) {
    const {side, size} = x.effusion; const s = side === 'right' ? -1 : 1, base = side === 'right' ? diaR : diaL;
    const lvl = {small: 0.88, moderate: 0.68, large: 0.45, massive: 0.12}[size] || 0.8;
    const yTop = top + lvl * (base - top);
    c.save(); c.clip(side === 'right' ? LR : LL);
    const eg = c.createLinearGradient(0, yTop - 20, 0, yTop + 40); eg.addColorStop(0, 'rgba(195,195,195,0)'); eg.addColorStop(1, 'rgba(195,195,195,.96)');
    c.fillStyle = eg; c.beginPath(); c.moveTo(cx + s * 20, yTop + 30); c.quadraticCurveTo(cx + s * thx * 0.6, yTop + 18, cx + s * thx * 1.05, yTop - 22); c.lineTo(cx + s * thx * 1.1, H); c.lineTo(cx + s * 10, H); c.closePath(); c.fill();
    c.restore();
  }
  // mediastinum: spine, heart, aorta, trachea
  const spg = c.createLinearGradient(cx - 30, 0, cx + 30, 0); spg.addColorStop(0, 'rgba(150,150,150,0)'); spg.addColorStop(0.25, 'rgba(165,165,165,.55)'); spg.addColorStop(0.75, 'rgba(165,165,165,.55)'); spg.addColorStop(1, 'rgba(150,150,150,0)');
  c.fillStyle = spg; c.fillRect(cx - 30 + shiftMed * 0.3, 60, 60, H);                         // spine column
  for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(220,220,220,.12)'; c.fillRect(cx - 18 + shiftMed * 0.3, 40 + i * 42, 36, 30); }
  const trg = c.createLinearGradient(cx - 12, 0, cx + 12, 0); trg.addColorStop(0, 'rgba(30,30,30,0)'); trg.addColorStop(0.5, 'rgba(30,30,30,.75)'); trg.addColorStop(1, 'rgba(30,30,30,0)');
  c.fillStyle = trg; c.fillRect(cx - 12 + shiftMed * 0.5, 0, 24, top + 150);     // trachea air column
  const ctr = x.ctr || (child ? 0.55 : 0.45);
  const heartW = ctr * thx * 1.85, hR = cx - heartW * 0.3 + shiftMed, hL = cx + heartW * 0.7 + shiftMed;
  const hTop = top + 185 + (x.hyperinfl ? 30 : 0), hBot = diaR + 6;
  const hg = c.createRadialGradient(cx + heartW * 0.15 + shiftMed, hBot - 60, 20, cx + heartW * 0.15 + shiftMed, hBot - 60, heartW * 0.75); hg.addColorStop(0, 'rgba(190,190,190,.97)'); hg.addColorStop(1, 'rgba(160,160,160,.92)');
  c.fillStyle = hg; c.filter = 'blur(2.5px)';
  c.beginPath(); c.moveTo(cx - 30 + shiftMed, top + 120);
  c.lineTo(cx - 34 + shiftMed, hTop);
  if (x.globular) { c.bezierCurveTo(hR - 40, hTop + 30, hR - 50, hBot - 20, cx + shiftMed, hBot + 8); c.bezierCurveTo(hL + 50, hBot - 20, hL + 40, hTop + 30, cx + 40 + shiftMed, hTop); }
  else { c.bezierCurveTo(hR - 4, hTop + 20, hR - 6, hBot - 50, hR + 16, hBot); c.lineTo(hL - 30, hBot + 4); c.bezierCurveTo(hL + 6, hBot - 10, hL + 4, hTop + 70, cx + 40 + shiftMed, hTop - 10); }
  c.quadraticCurveTo(cx + 66 + shiftMed, top + 112, cx + 48 + shiftMed, top + 98);    // aortic knob
  c.closePath(); c.fill(); c.filter = 'none';
  // RML / lingula silhouette when consolidated: blur heart border
  // diaphragm crisp edge
  // ribs
  c.lineCap = 'round';
  const nRib = x.hyperinfl ? 11 : 10;
  for (let i = 0; i < nRib; i++) {
    const y = top + 26 + i * ((diaR - top) / (nRib - 1.5)) * 0.92;
    [-1, 1].forEach(s => {
      c.strokeStyle = `rgba(225,225,225,${0.16 + R.raw() * 0.06})`; c.lineWidth = (child ? 5 : 7) + R.raw();
      c.beginPath(); c.moveTo(cx + s * 28, y - 10); c.bezierCurveTo(cx + s * thx * 0.55, y - 36, cx + s * thx * 0.98, y - 6, cx + s * thx * 1.04, y + 34); c.stroke();
      c.strokeStyle = 'rgba(225,225,225,.07)'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(cx + s * thx * 1.0, y + 10); c.quadraticCurveTo(cx + s * thx * 0.6, y + 52, cx + s * 70, y + 96); c.stroke();
    });
  }
  // clavicles + scapulae
  c.strokeStyle = 'rgba(225,225,225,.5)'; c.lineWidth = 11;
  [-1, 1].forEach(s => { c.beginPath(); c.moveTo(cx + s * 30, top + 18); c.quadraticCurveTo(cx + s * 120, top - 4, cx + s * thx * 1.08, top + 2); c.stroke(); });
  // breast shadows
  if (x.sex === 'F' && !child && x.age > 14) [-1, 1].forEach(s => { const bg = c.createRadialGradient(cx + s * thx * 0.55, diaR - 30, 10, cx + s * thx * 0.55, diaR - 30, 110 * bw); bg.addColorStop(0, 'rgba(160,160,160,.28)'); bg.addColorStop(1, 'rgba(160,160,160,0)'); c.fillStyle = bg; c.beginPath(); c.arc(cx + s * thx * 0.55, diaR - 30, 110 * bw, 0, Math.PI * 2); c.fill(); });
  // gastric bubble + free air
  c.fillStyle = 'rgba(20,20,20,.8)'; c.beginPath(); c.ellipse(cx + thx * 0.45, diaL + 34, 36, 20, 0, 0, Math.PI * 2); c.fill();
  if (x.freeAir) { c.fillStyle = 'rgba(8,8,8,.95)'; c.beginPath(); c.moveTo(cx - thx * 0.85, diaR + 26); c.quadraticCurveTo(cx - thx * 0.45, diaR - 30, cx - 30, diaR + 22); c.quadraticCurveTo(cx - thx * 0.45, diaR + 2, cx - thx * 0.85, diaR + 26); c.fill(); c.strokeStyle = 'rgba(230,230,230,.9)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx - thx * 0.85, diaR + 22); c.quadraticCurveTo(cx - thx * 0.45, diaR - 36, cx - 30, diaR + 18); c.stroke(); }
  // pneumothorax: pleural line
  if (x.ptx) { const s = x.ptx.side === 'right' ? -1 : 1; const f = x.ptx.size === 'large' || x.ptx.tension ? 0.5 : 0.78; c.strokeStyle = 'rgba(230,230,230,.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx + s * 70, top + 20); c.bezierCurveTo(cx + s * thx * f, top + 40, cx + s * thx * f * 1.05, top + 260, cx + s * thx * f * 0.9, (s < 0 ? diaR : diaL) - 30); c.stroke(); }
  c.restore();
  // film effects: grain + under-penetration for obese
  const img = c.getImageData(0, 0, W, H), dta = img.data;
  const noise = x.build === 'obese' ? 26 : 14;
  const lift = x.build === 'obese' ? 18 : 0;
  for (let i = 0; i < dta.length; i += 4) { const n = (R.raw() - 0.5) * noise; const v = Math.min(255, Math.max(0, dta[i] + n + lift)); dta[i] = dta[i + 1] = dta[i + 2] = v; }
  c.putImageData(img, 0, 0);
  c.filter = 'blur(1.1px)'; c.drawImage(canvas, 0, 0); c.filter = 'none';
  const vg = c.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 420); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = 'bold 26px ui-monospace, Menlo, monospace'; c.fillText('R', 22, 44);
  c.font = '13px ui-monospace, Menlo, monospace'; c.fillText(x.label || 'PA ERECT', W - 120, 30);
}

/* =========================================================
   BONE X-RAY — procedural: shaft fracture, NOF fracture, knee OA, osteosarcoma, gout toe
   b = {region:'femur'|'tibia'|'forearm'|'hip'|'knee'|'foot', frac:'transverse'|'oblique'|'spiral'|'comminuted', displaced, angulated, oa, osteosarcoma, ewing, gout, osteopenia, seed, side}
   ========================================================= */
function drawBone(canvas, b) {
  const R = mkRng(b.seed || 3);
  const W = 440, H = 620; canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  c.fillStyle = '#060606'; c.fillRect(0, 0, W, H);
  const cx = W / 2 + (R.raw() - 0.5) * 20;
  const boneCol = b.osteopenia ? 'rgba(200,200,200,.62)' : 'rgba(225,225,225,.88)';
  const soft = (x0, w) => { const g = c.createLinearGradient(x0 - w, 0, x0 + w, 0); g.addColorStop(0, 'rgba(60,60,60,0)'); g.addColorStop(0.2, 'rgba(70,70,70,.9)'); g.addColorStop(0.8, 'rgba(70,70,70,.9)'); g.addColorStop(1, 'rgba(60,60,60,0)'); c.fillStyle = g; c.fillRect(x0 - w, 0, w * 2, H); };
  const shaft = (x0, y0, y1, w, cortex) => { c.fillStyle = boneCol; c.fillRect(x0 - w, y0, w * 2, y1 - y0); c.fillStyle = 'rgba(95,95,95,.85)'; c.fillRect(x0 - w + cortex, y0, w * 2 - cortex * 2, y1 - y0); };
  if (b.region === 'knee') {
    soft(cx, 150);
    const jy = 300 - (b.oa ? 10 : 0), gap = b.oa ? 4 : 14;
    // femur
    c.fillStyle = boneCol; c.beginPath(); c.moveTo(cx - 52, 0); c.lineTo(cx - 54, jy - 120); c.quadraticCurveTo(cx - 118, jy - 70, cx - 108, jy - 12); c.quadraticCurveTo(cx - 60, jy + 8, cx - 4, jy - 14); c.quadraticCurveTo(cx + 60, jy + 8, cx + 108, jy - 12); c.quadraticCurveTo(cx + 118, jy - 70, cx + 54, jy - 120); c.lineTo(cx + 52, 0); c.fill();
    c.fillStyle = 'rgba(110,110,110,.7)'; c.fillRect(cx - 36, 0, 72, jy - 140);
    // tibia
    const ty = jy + gap;
    c.fillStyle = boneCol; c.beginPath(); c.moveTo(cx - 112, ty); c.quadraticCurveTo(cx, ty - 10, cx + 112, ty); c.quadraticCurveTo(cx + 100, ty + 70, cx + 48, ty + 130); c.lineTo(cx + 46, H); c.lineTo(cx - 46, H); c.lineTo(cx - 48, ty + 130); c.quadraticCurveTo(cx - 100, ty + 70, cx - 112, ty); c.fill();
    c.fillStyle = 'rgba(110,110,110,.7)'; c.fillRect(cx - 30, ty + 150, 60, H);
    // fibula
    c.fillStyle = 'rgba(200,200,200,.75)'; c.fillRect(cx + 92, ty + 40, 22, H);
    if (b.oa) { // osteophytes, sclerosis, asymmetric medial narrowing
      c.fillStyle = 'rgba(240,240,240,.95)';
      [[-112, jy - 10], [112, jy - 10], [-114, ty + 4], [114, ty + 4]].forEach(([dx, y]) => { c.beginPath(); c.moveTo(cx + dx, y - 8); c.lineTo(cx + dx + Math.sign(dx) * 16, y); c.lineTo(cx + dx, y + 8); c.fill(); });
      c.fillStyle = 'rgba(250,250,250,.45)'; c.fillRect(cx - 104, ty, 90, 16); c.fillRect(cx - 104, jy - 22, 90, 14);
      c.fillStyle = 'rgba(30,30,30,.9)'; c.beginPath(); c.arc(cx - 62, ty + 22, 6, 0, Math.PI * 2); c.fill();
    }
  } else if (b.region === 'hip') {
    soft(cx, 200);
    // pelvis + femoral head/neck
    c.fillStyle = boneCol; c.beginPath(); c.arc(cx - 40, 160, 46, 0, Math.PI * 2); c.fill();     // head
    c.fillStyle = 'rgba(200,200,200,.6)'; c.beginPath(); c.arc(cx - 52, 150, 62, Math.PI * 0.9, Math.PI * 1.95); c.lineWidth = 16; c.strokeStyle = 'rgba(210,210,210,.7)'; c.stroke();
    c.save(); c.translate(cx - 10, 190); c.rotate(0.62); c.fillStyle = boneCol; c.fillRect(-28, -20, 120, 56); c.restore();   // neck
    c.fillStyle = boneCol; c.beginPath(); c.moveTo(cx + 40, 200); c.lineTo(cx + 110, 210); c.lineTo(cx + 90, 300); c.lineTo(cx + 60, H); c.lineTo(cx - 10, H); c.lineTo(cx, 300); c.fill();
    c.fillStyle = 'rgba(100,100,100,.7)'; c.fillRect(cx + 14, 330, 36, H);
    if (b.frac) { c.strokeStyle = 'rgba(15,15,15,1)'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx - 12, 166); c.lineTo(cx + 10, 222); c.stroke(); if (b.displaced) { c.fillStyle = 'rgba(245,245,245,.6)'; c.fillRect(cx - 6, 180, 14, 30); } }
  } else if (b.region === 'foot') {
    soft(cx, 170);
    for (let i = 0; i < 5; i++) { const x0 = cx - 110 + i * 52; c.fillStyle = boneCol; c.fillRect(x0, 240, i === 0 ? 34 : 24, 190); c.fillRect(x0 + 2, 150, i === 0 ? 30 : 20, 80); c.fillRect(x0 + 2, 70, i === 0 ? 28 : 18, 70); }
    c.fillStyle = 'rgba(205,205,205,.8)'; c.fillRect(cx - 120, 440, 240, 180);
    if (b.gout) { c.fillStyle = 'rgba(20,20,20,.95)'; c.beginPath(); c.arc(cx - 92, 236, 9, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(cx - 80, 154, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(150,150,150,.55)'; c.beginPath(); c.ellipse(cx - 125, 230, 28, 40, 0, 0, Math.PI * 2); c.fill(); }
  } else {
    // long bone shaft (femur/tibia/forearm)
    const w = b.region === 'forearm' ? 20 : b.region === 'tibia' ? 30 : 38;
    soft(cx, b.region === 'forearm' ? 90 : 150);
    const fy = 250 + R.int(-40, 60);
    if (b.region === 'forearm') { shaft(cx - 38, 0, H, 16, 6); shaft(cx + 30, 0, H, 18, 6); }
    if (!b.frac && !b.osteosarcoma && !b.ewing) shaft(cx, 0, H, w, 11);
    if (b.frac) {
      const dx = b.displaced ? w * 0.9 : 0, ang = b.angulated ? 0.16 : 0;
      c.save(); shaft(cx, 0, fy, w, 11); c.restore();
      c.save(); c.translate(cx + dx, fy); c.rotate(ang); shaft(0, 6, H, w, 11); c.restore();
      c.strokeStyle = 'rgba(10,10,10,1)'; c.lineWidth = 4;
      c.beginPath();
      if (b.frac === 'transverse') { c.moveTo(cx - w - 4, fy); c.lineTo(cx + w + 4, fy + 3); }
      else if (b.frac === 'oblique') { c.moveTo(cx - w - 4, fy - 30); c.lineTo(cx + w + 4, fy + 24); }
      else if (b.frac === 'spiral') { c.moveTo(cx - w - 2, fy - 40); c.bezierCurveTo(cx, fy - 10, cx + 10, fy + 10, cx + w + 2, fy + 36); }
      else { c.moveTo(cx - w, fy - 18); c.lineTo(cx, fy + 10); c.lineTo(cx + w, fy - 12); c.moveTo(cx - 10, fy + 10); c.lineTo(cx - 2, fy + 40); c.fillStyle = boneCol; c.fillRect(cx + w - 2, fy - 4, 18, 10); }
      c.stroke();
    }
    if (b.osteosarcoma) { // distal metaphysis lesion with sunburst + Codman
      shaft(cx, 0, H, w, 11);
      const ly = 430; c.fillStyle = 'rgba(240,240,240,.55)'; c.beginPath(); c.ellipse(cx, ly, w + 24, 70, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(30,30,30,.7)'; c.beginPath(); c.ellipse(cx - 8, ly + 10, 16, 24, 0.3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(235,235,235,.6)'; c.lineWidth = 1.6; for (let i = 0; i < 26; i++) { const a = -Math.PI / 2 + (i - 13) * 0.11; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(cx + s * (w + 6), ly + (i - 13) * 4); c.lineTo(cx + s * (w + 36 + R.raw() * 18), ly + (i - 13) * 5); c.stroke(); }); }
      c.strokeStyle = 'rgba(245,245,245,.9)'; c.lineWidth = 3; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(cx + s * w, ly - 92); c.lineTo(cx + s * (w + 16), ly - 64); c.stroke(); });
      c.fillStyle = 'rgba(220,220,220,.9)'; c.beginPath(); c.ellipse(cx, H - 40, w + 60, 50, 0, 0, Math.PI * 2); c.fill();
    }
    if (b.ewing) { shaft(cx, 0, H, w, 11); c.strokeStyle = 'rgba(230,230,230,.55)'; c.lineWidth = 2; for (let i = 1; i <= 4; i++) [-1, 1].forEach(s => { c.beginPath(); c.moveTo(cx + s * (w + i * 5), 230); c.lineTo(cx + s * (w + i * 5), 380); c.stroke(); }); c.fillStyle = 'rgba(30,30,30,.4)'; c.fillRect(cx - w + 8, 240, 2 * w - 16, 130); }
  }
  const img = c.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R.raw() - 0.5) * 16; const v = Math.min(255, Math.max(0, d[i] + n)); d[i] = d[i + 1] = d[i + 2] = v; }
  c.putImageData(img, 0, 0); c.filter = 'blur(0.9px)'; c.drawImage(canvas, 0, 0); c.filter = 'none';
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = 'bold 24px ui-monospace, Menlo, monospace'; c.fillText((b.side || 'right') === 'left' ? 'L' : 'R', 20, 40);
  c.font = '13px ui-monospace, Menlo, monospace'; c.fillText(b.label || 'AP', W - 70, 30);
}
