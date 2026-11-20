/* Ward Round — the cartoon hospital ward (Three.js r160).
   You are the doctor: click the flashing patient (or the "See patient" button) and you walk there
   yourself; the encounter opens when you arrive. Clicking the floor just strolls. */
'use strict';
const World = (() => {
  const T = window.THREE;
  let renderer, scene, camera, clock, canvas, raf;
  let mode = 'menu';                 // menu | select | walk | encounter
  let doctor = null, docSpec = null, nurse = null;
  const beds = [];                   // {i, pos, dir, group, slot, patient, marker, ring, tick, monitor:{cv,ctx,tex}, visit, spec, done}
  const blockers = [];               // xz AABBs for collision
  let target = -1, active = -1, walkGoal = null, prompt = null, walkPath = [], arriveBed = -1;
  const keys = {};
  const cam = {pos: new T.Vector3(0, 14, 16), look: new T.Vector3(0, 0, 0), goalPos: new T.Vector3(0, 14, 16), goalLook: new T.Vector3(0, 0, 0)};
  let viewShift = 0, viewShiftGoal = 0, viewShiftY = 0, viewShiftYGoal = 0, orbit = 0, live = null;
  const api = {onVisit: null, onNear: null};

  /* ---------- toon materials ---------- */
  const grad = (() => { const d = new Uint8Array([90, 170, 255]); const t = new T.DataTexture(d, 3, 1, T.RedFormat); t.needsUpdate = true; t.minFilter = t.magFilter = T.NearestFilter; return t; })();
  const matCache = {};
  const M = (hex, opts = {}) => { const k = hex + JSON.stringify(opts); if (!matCache[k] || opts.unique) { const m = new T.MeshToonMaterial(Object.assign({color: hex, gradientMap: grad}, opts)); delete m.unique; if (opts.unique) return m; matCache[k] = m; } return matCache[k]; };
  const outlineMat = new T.MeshBasicMaterial({color: 0x1d2433, side: T.BackSide});
  function mesh(geo, mat, x = 0, y = 0, z = 0, opts = {}) {
    const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.shadow !== false; m.receiveShadow = !!opts.receive;
    if (opts.outline) { const o = new T.Mesh(geo, outlineMat); o.scale.setScalar(opts.outline); m.add(o); }
    return m;
  }
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const sph = (r, ws = 20, hs = 16) => new T.SphereGeometry(r, ws, hs);
  const cyl = (rt, rb, h, s = 18) => new T.CylinderGeometry(rt, rb, h, s);
  const cap = (r, l) => new T.CapsuleGeometry(r, l, 6, 14);

  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 4; return t;
  }

  /* ---------- colour helpers ---------- */
  const SK = ['#F2D3BA', '#DDAA82', '#B97D52', '#8A5634', '#5B3622'];
  function mixHex(a, b, t) { const ca = new T.Color(a), cb = new T.Color(b); return '#' + ca.lerp(cb, t).getHexString(); }

  /* ---------- people ---------- */
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function personLook(p) {
    // deterministic hair/beard/glasses from the patient's name so they look the same everywhere
    const h = hash(p.name || p.first || 'x'); const pick = (arr, k) => arr[(h >>> k) % arr.length];
    const old = p.age >= 62, child = p.age < 13;
    const hairColor = old ? pick(['#d9d9d9', '#bdbdbd', '#efefef'], 3) : (p.skin <= 1 ? pick(['#6b4423', '#a0703c', '#2e2216', '#c9a15b'], 5) : '#1f1712');
    const hair = p.sex === 'F' ? pick(child ? ['puffs', 'braids', 'bob'] : old ? ['bun', 'short', 'headwrap'] : ['braids', 'bun', 'long', 'headwrap', 'afro', 'bob'], 7) : pick(child ? ['short', 'buzz'] : old ? ['bald', 'short', 'buzz'] : ['short', 'buzz', 'afro', 'short'], 7);
    const beard = p.sex === 'M' && !child && ((h >>> 11) % 3 === 0);
    const glasses = old && ((h >>> 13) % 2 === 0);
    return {hair, hairColor, beard, glasses, wrap: pick(['#d94f3d', '#2f8f83', '#e7a935', '#7a4fb3'], 15)};
  }
  function buildHead(spec, skin, look) {
    const g = new T.Group(); const S = M(skin);
    const signs = new Set(spec.signs || []);
    const head = mesh(sph(0.34, 28, 22), S, 0, 0, 0, {outline: 1.06});
    if (signs.has('moonface')) head.scale.set(1.14, 1.02, 1.05);
    if (signs.has('thalFacies')) head.scale.set(1.08, 1.06, 1.05);
    if (signs.has('cachectic')) head.scale.set(0.92, 1.0, 0.95);
    g.add(head);
    // ears
    if (look.hair !== 'hijab') [-1, 1].forEach(s => g.add(mesh(sph(0.075), S, s * 0.33, -0.02, 0)));
    // eyes
    const drowsy = signs.has('drowsy');
    const sclera = signs.has('jaundice') ? '#f1dd7a' : '#ffffff';
    [-1, 1].forEach(s => {
      const w = mesh(sph(0.07), M(sclera), s * 0.12, 0.03, 0.29); w.scale.set(1, drowsy ? 0.35 : 1.05, 0.6); g.add(w);
      const pu = mesh(sph(0.042), M('#1d2433'), s * 0.12, drowsy ? 0.015 : 0.03, 0.33); pu.scale.set(1, drowsy ? 0.3 : 1, 0.6); g.add(pu);
      const hl = mesh(sph(0.012), new T.MeshBasicMaterial({color: 0xffffff}), s * 0.12 + 0.015, 0.05, 0.355); if (!drowsy) g.add(hl);
      const brow = mesh(box(0.11, 0.025, 0.03), M(look.hairColor === '#efefef' ? '#9a9a9a' : '#2a1d14'), s * 0.12, signs.has('pain') || signs.has('distress') ? 0.13 : 0.12, 0.3);
      brow.rotation.z = (signs.has('pain') || signs.has('distress')) ? -s * 0.35 : s * 0.08; g.add(brow);
    });
    // nose
    g.add(mesh(sph(0.045), M(mixHex(skin, '#000000', 0.12)), 0, -0.05, 0.335));
    // mouth
    const lips = signs.has('cyanosis') ? '#5b6fb5' : mixHex(skin, '#8a2b2b', 0.45);
    if (signs.has('lipSwelling')) { const l = mesh(cap(0.045, 0.1), M('#c9575a'), 0, -0.16, 0.3); l.rotation.z = Math.PI / 2; g.add(l); }
    else if (signs.has('distress') || signs.has('breathless') || signs.has('pain')) { const m = mesh(sph(0.045), M('#5a1f22'), 0, -0.16, 0.31); m.scale.set(1.2, 0.8, 0.5); g.add(m); }
    else { const m = mesh(new T.TorusGeometry(0.055, 0.014, 6, 16, Math.PI), M(lips), 0, -0.14, 0.31); m.rotation.z = Math.PI; g.add(m); }
    // cheeks / rashes
    if (signs.has('flushed') || signs.has('fever')) [-1, 1].forEach(s => { const c = mesh(sph(0.06), M('#e86a6a', {transparent: true, opacity: 0.55}), s * 0.2, -0.06, 0.26); c.scale.set(1, 0.6, 0.4); g.add(c); });
    if (signs.has('malar')) { const c = mesh(new T.TorusGeometry(0.13, 0.04, 6, 18, Math.PI), M('#d94a4a', {transparent: true, opacity: 0.6}), 0, -0.02, 0.27); c.rotation.z = Math.PI; g.add(c); }
    if (signs.has('sweaty') || signs.has('fever')) [[-0.14, 0.2], [0.1, 0.24], [0.2, 0.12]].forEach(([x, y]) => { const d = mesh(sph(0.025), M('#9fd8ff', {transparent: true, opacity: 0.85}), x, y, 0.3); d.scale.set(0.8, 1.2, 0.6); g.add(d); });
    if (signs.has('ks')) [[0.15, -0.1], [-0.18, 0.05]].forEach(([x, y]) => g.add(mesh(sph(0.03), M('#6b2a5c'), x, y, 0.29)));
    if (signs.has('nasalFlare')) [-1, 1].forEach(s => g.add(mesh(sph(0.02), M('#5a1f22'), s * 0.03, -0.07, 0.35)));
    // beard
    if (look.beard) { const b = mesh(new T.SphereGeometry(0.3, 20, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), M(look.hairColor), 0, -0.04, 0.02); b.scale.set(1.04, 1, 1.02); g.add(b); }
    // hair
    const H = M(look.hairColor);
    const capHair = (scale = 1.04, cut = 0.5) => { const m = mesh(new T.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI * cut), H, 0, 0, -0.01); m.scale.setScalar(scale); return m; };
    switch (look.hair) {
      case 'short': g.add(capHair(1.05, 0.45)); break;
      case 'buzz': g.add(capHair(1.02, 0.42)); break;
      case 'bald': [-1, 1].forEach(s => { const m = mesh(sph(0.12), H, s * 0.28, 0.02, -0.08); m.scale.set(0.6, 1, 1.2); g.add(m); }); break;
      case 'afro': { const m = mesh(sph(0.42), H, 0, 0.12, -0.06); m.scale.set(1.05, 0.85, 1); g.add(m); break; }
      case 'bun': g.add(capHair(1.05, 0.5)); g.add(mesh(sph(0.14), H, 0, 0.32, -0.2)); break;
      case 'long': { g.add(capHair(1.06, 0.55)); const back = mesh(cap(0.3, 0.35), H, 0, -0.2, -0.12); back.scale.set(1.05, 1, 0.6); g.add(back); break; }
      case 'bob': { g.add(capHair(1.07, 0.6)); break; }
      case 'puffs': g.add(capHair(1.04, 0.45)); [-1, 1].forEach(s => g.add(mesh(sph(0.13), H, s * 0.3, 0.25, -0.05))); break;
      case 'braids': g.add(capHair(1.05, 0.5)); for (let k = 0; k < 7; k++) { const a = Math.PI * (0.15 + k * 0.12); const b = mesh(cap(0.035, 0.42), H, Math.cos(a) * 0.3, -0.18, -Math.sin(a) * 0.22 - 0.05); g.add(b); } break;
      case 'headwrap': { const w = mesh(sph(0.38), M(look.wrap), 0, 0.12, -0.04); w.scale.set(1, 0.75, 1.05); g.add(w); const k = mesh(sph(0.13), M(look.wrap), 0.06, 0.38, -0.08); g.add(k); break; }
      case 'hijab': {
        // a fitted scarf: shell round the head with an oval opening for the face, crown over the forehead, drape over the neck and shoulders
        const Wm = M(look.wrap, {side: T.DoubleSide});
        const open = 1.45;
        g.add(mesh(new T.SphereGeometry(0.372, 32, 22, Math.PI / 2 + open / 2, Math.PI * 2 - open, 0, Math.PI * 0.8), Wm, 0, 0.0, -0.005));
        g.add(mesh(new T.SphereGeometry(0.375, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.21), Wm, 0, 0.0, -0.005));
        g.add(mesh(new T.CylinderGeometry(0.25, 0.38, 0.4, 32, 1, true), Wm, 0, -0.37, -0.03));
        break;
      }
    }
    if (look.glasses) [-1, 1].forEach(s => { const r = mesh(new T.TorusGeometry(0.065, 0.012, 6, 18), M('#2b2b2b'), s * 0.12, 0.03, 0.34); g.add(r); });
    return g;
  }
  function skinFor(spec) {
    let skin = SK[(spec.skin || 3) - 1]; const s = new Set(spec.signs || []);
    if (s.has('pallor')) skin = mixHex(skin, '#E9E2DA', spec.skin >= 4 ? 0.28 : 0.42);
    if (s.has('jaundice')) skin = mixHex(skin, '#E8C640', spec.skin >= 4 ? 0.24 : 0.4);
    if (s.has('cyanosis')) skin = mixHex(skin, '#7d8fbf', 0.18);
    return skin;
  }
  /* standing person (doctor, nurse, parent) */
  function buildStanding(spec) {
    const root = new T.Group(); const look = Object.assign(personLook(spec), spec.look || {});
    const skin = skinFor(spec); const k = spec.age < 13 ? 0.72 : 1; const wide = spec.build === 'obese' ? 1.35 : spec.build === 'overweight' ? 1.15 : spec.build === 'thin' ? 0.9 : 1;
    const top = M(spec.top || '#3d7ea6'), bottom = M(spec.bottom || spec.top || '#2f5f80');
    const body = new T.Group(); root.add(body);
    const torso = mesh(cap(0.26, 0.42), top, 0, 0.98, 0, {outline: 1.05}); torso.scale.set(wide, 1, wide * 0.8); body.add(torso);
    if (spec.coat) { const coat = mesh(cyl(0.29 * wide, 0.36 * wide, 0.78), M('#fbfbfb'), 0, 0.86, 0, {outline: 1.03}); coat.scale.z = 0.8; body.add(coat); }
    if (spec.steth) { const st = mesh(new T.TorusGeometry(0.17, 0.02, 6, 20, Math.PI * 1.2), M('#27323f'), 0, 1.12, 0.17); st.rotation.set(-0.3, 0, Math.PI * 0.9); body.add(st); }
    const legs = [-1, 1].map(s => { const l = mesh(cap(0.09, 0.42), bottom, s * 0.12, 0.33, 0); body.add(l); const f = mesh(box(0.14, 0.08, 0.24), M('#2b2f3a'), 0, -0.3, 0.05); l.add(f); return l; });
    const arms = [-1, 1].map(s => { const a = new T.Group(); a.position.set(s * (0.3 * wide + 0.03), 1.22, 0); const sl = mesh(cap(0.075, 0.38), spec.coat ? M('#fbfbfb') : top, 0, -0.22, 0); a.add(sl); a.add(mesh(sph(0.075), M(skin), 0, -0.48, 0)); body.add(a); return a; });
    const neck = mesh(cyl(0.08, 0.09, 0.12), M(skin), 0, 1.38, 0); body.add(neck);
    const head = buildHead(spec, skin, look); head.position.y = 1.68; body.add(head);
    if (spec.badge) body.add(mesh(box(0.1, 0.13, 0.02), M('#ffc845'), -0.15, 1.12, 0.27));
    root.scale.setScalar(k);
    root.userData = {legs, arms, head, body, phase: 0};
    root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return root;
  }
  /* patient sitting up in bed (legs under the blanket) */
  function buildSitting(spec) {
    const root = new T.Group(); const look = personLook(spec); const skin = skinFor(spec); const S = new Set(spec.signs || []);
    const k = spec.age < 2 ? 0.5 : spec.age < 13 ? 0.72 : 1;
    const wide = spec.build === 'obese' ? 1.38 : spec.build === 'overweight' ? 1.17 : spec.build === 'cachectic' ? 0.8 : spec.build === 'thin' ? 0.9 : 1;
    const gownTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#9cc7e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#7fb0d6'; for (let y = 4; y < h; y += 12) for (let x = (y / 12 % 2) * 6 + 3; x < w; x += 12) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } }, [2, 2]);
    const gown = new T.MeshToonMaterial({map: gownTex, gradientMap: grad});
    const torso = mesh(cap(0.27, 0.4), gown, 0, 0.55, 0, {outline: 1.05}); torso.scale.set(wide, 1, wide * 0.78); root.add(torso);
    if (spec.sex === 'F' && spec.age >= 13) [-1, 1].forEach(s => { const b = mesh(sph(0.1), gown, s * 0.1 * wide, 0.68, 0.17 * wide); b.scale.set(1, 0.85, 0.7); root.add(b); });
    const neck = mesh(cyl(0.08, 0.09, 0.14), M(skin), 0, 0.93, 0); root.add(neck);
    const arms = [-1, 1].map(s => { const a = new T.Group(); a.position.set(s * (0.31 * wide + 0.02), 0.8, 0); const up = mesh(cap(0.075 * Math.max(0.85, wide * 0.9), 0.26), gown, 0, -0.15, 0); a.add(up); const fore = mesh(cap(0.065 * Math.max(0.85, wide * 0.9), 0.26), M(skin), 0, -0.36, 0.14); fore.rotation.x = -1.1; a.add(fore); a.add(mesh(sph(0.07), M(skin), 0, -0.42, 0.33)); root.add(a); return a; });
    if (S.has('urticaria') || S.has('petechiae') || S.has('bruise')) {
      const col = S.has('urticaria') ? '#e77b7b' : S.has('bruise') ? '#7a4b8f' : '#b5363d';
      arms.forEach(a => { for (let i = 0; i < 6; i++) { const d = mesh(sph(S.has('urticaria') ? 0.028 : 0.014), M(col), (Math.random() - 0.5) * 0.08, -0.32 - Math.random() * 0.1, 0.12 + Math.random() * 0.2); a.add(d); } });
    }
    const head = buildHead(spec, skin, look); head.position.y = 1.24; root.add(head);
    if (S.has('jvp')) root.add(mesh(cap(0.015, 0.1), M(mixHex(skin, '#3b4a8a', 0.35)), 0.07, 0.95, 0.07));
    root.scale.setScalar(k);
    root.userData = {head, arms, torso, k, breath: S.has('breathless') || S.has('distress') ? 2.4 : 1};
    root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return root;
  }

  /* ---------- the ward ---------- */
  function buildWard() {
    // floor
    const floorTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#d6e4ea'; g.fillRect(0, 0, w, h); g.strokeStyle = '#bccfd8'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(10, 10, 60, 6); }, [12, 8]);
    const floor = mesh(new T.PlaneGeometry(24, 16), new T.MeshToonMaterial({map: floorTex, gradientMap: grad}), 0, 0, 0, {shadow: false, receive: true}); floor.rotation.x = -Math.PI / 2; floor.name = 'floor'; scene.add(floor);
    // walls: two-tone (mint dado, cream above)
    const wall = (w, x, z, ry) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      g.add(mesh(box(w, 1.2, 0.25), M('#8fcbb8'), 0, 0.6, 0, {shadow: false, receive: true}));
      g.add(mesh(box(w, 2.1, 0.25), M('#f4ecd8'), 0, 2.25, 0, {shadow: false, receive: true}));
      g.add(mesh(box(w, 0.12, 0.3), M('#5aa891'), 0, 1.22, 0.02, {shadow: false}));
      scene.add(g); return g;
    };
    wall(24, 0, -8, 0); wall(16, -12, 0, Math.PI / 2); wall(16, 12, 0, -Math.PI / 2);
    blockers.push([-12, -8.3, 12, -7.6], [-12.5, -8, -11.7, 8], [11.7, -8, 12.5, 8]);
    // windows on the back wall
    [-7, 7].forEach(x => { const f = mesh(box(3.2, 1.5, 0.1), M('#ffffff'), x, 2.3, -7.82, {shadow: false}); scene.add(f); const glass = mesh(box(2.9, 1.25, 0.1), new T.MeshBasicMaterial({color: 0xbfe6ff}), x, 2.3, -7.78, {shadow: false}); scene.add(glass); scene.add(mesh(box(0.08, 1.25, 0.12), M('#ffffff'), x, 2.3, -7.74, {shadow: false})); });
    // posters
    const poster = (x, txt, col) => { const t = canvasTex(256, 320, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(16, 16, w - 32, h - 32); g.fillStyle = col; g.font = 'bold 34px Fredoka, Trebuchet MS, sans-serif'; g.textAlign = 'center'; txt.split('\n').forEach((l, i) => g.fillText(l, w / 2, 90 + i * 44)); g.beginPath(); g.arc(w / 2, 245, 36, 0, 7); g.fill(); }); const m = mesh(new T.PlaneGeometry(0.9, 1.12), new T.MeshBasicMaterial({map: t}), x, 2.4, -7.86, {shadow: false}); scene.add(m); };
    poster(-2.6, 'WASH\nYOUR\nHANDS', '#2f8f83'); poster(2.6, 'KNOW\nYOUR\nSTATUS', '#d94f3d');
    // nurses' station
    const st = new T.Group(); st.position.set(0, 0, -6.3);
    st.add(mesh(box(4.2, 1.05, 0.9), M('#f9f6ef'), 0, 0.52, 0, {outline: 1.01})); st.add(mesh(box(4.4, 0.08, 1.05), M('#2f8f83'), 0, 1.08, 0));
    st.add(mesh(box(0.6, 0.4, 0.06), M('#26303d'), -1.2, 1.32, -0.15)); st.add(mesh(box(0.55, 0.32, 0.02), new T.MeshBasicMaterial({color: 0x7fd4c1}), -1.2, 1.32, -0.11));
    st.add(mesh(cyl(0.1, 0.1, 0.18), M('#d94f3d'), 1.3, 1.2, 0)); st.add(mesh(box(0.35, 0.05, 0.25), M('#ffffff'), 0.6, 1.14, 0.1));
    scene.add(st); blockers.push([-2.2, -6.85, 2.2, -5.75]);
    // crash cart + sink
    const cart = new T.Group(); cart.position.set(-4.2, 0, -7.0); cart.add(mesh(box(0.8, 0.95, 0.55), M('#d94f3d'), 0, 0.55, 0, {outline: 1.02})); [0.35, 0.65].forEach(y => cart.add(mesh(box(0.82, 0.03, 0.57), M('#a7362a'), 0, y, 0))); cart.add(mesh(box(0.5, 0.25, 0.3), M('#f3f3f3'), 0, 1.15, 0)); scene.add(cart); blockers.push([-4.65, -7.35, -3.75, -6.65]);
    const sink = new T.Group(); sink.position.set(4.3, 0, -7.55); sink.add(mesh(box(0.8, 0.85, 0.45), M('#f3f3f3'), 0, 0.43, 0)); sink.add(mesh(cyl(0.03, 0.03, 0.3), M('#9aa7b3'), 0, 1.0, -0.1)); scene.add(sink); blockers.push([3.85, -7.8, 4.75, -7.3]);
    // plants by the door
    [-2.2, 2.2].forEach(x => { const p = new T.Group(); p.position.set(x, 0, 7.4); p.add(mesh(cyl(0.22, 0.17, 0.4), M('#c4683c'), 0, 0.2, 0)); p.add(mesh(sph(0.38), M('#4caf6a'), 0, 0.7, 0, {outline: 1.04})); scene.add(p); blockers.push([x - 0.3, 7.1, x + 0.3, 7.7]); });
    // door mat
    const mat = mesh(new T.PlaneGeometry(2.2, 1), M('#2f8f83'), 0, 0.01, 7.4, {shadow: false, receive: true}); mat.rotation.x = -Math.PI / 2; scene.add(mat);
    // beds: three each side
    const slots = [[-9.6, -4.4, 1], [-9.6, 0, 1], [-9.6, 4.4, 1], [9.6, -4.4, -1], [9.6, 0, -1], [9.6, 4.4, -1]];
    slots.forEach(([x, z, dir], i) => beds.push(buildBed(i, x, z, dir)));
    // curtains between bays
    const curtTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#7cc4c7'; g.fillRect(0, 0, w, h); g.fillStyle = '#5fb0b4'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h); g.fillStyle = 'rgba(255,255,255,.25)'; for (let y = 8; y < h; y += 32) for (let x = 8; x < w; x += 32) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } }, [3, 1]);
    const curtMat = new T.MeshToonMaterial({map: curtTex, gradientMap: grad, side: T.DoubleSide});
    [[-1, -2.2], [-1, 2.2], [1, -2.2], [1, 2.2]].forEach(([s, z]) => {
      const x = s * 10.3; const c = new T.Group(); c.position.set(x, 0, z);
      const panel = new T.Mesh(new T.PlaneGeometry(3.0, 2.3, 12, 1), curtMat); const pos = panel.geometry.attributes.position; for (let v = 0; v < pos.count; v++) pos.setZ(v, Math.sin(pos.getX(v) * 7) * 0.06); pos.needsUpdate = true; panel.geometry.computeVertexNormals();
      panel.position.set(0, 1.35, 0); panel.castShadow = true; c.add(panel);
      { const rail = mesh(cyl(0.025, 0.025, 3.1), M('#c8ced6'), 0, 2.52, 0); rail.rotation.z = Math.PI / 2; c.add(rail); }
      scene.add(c); blockers.push([x - 1.5, z - 0.12, x + 1.5, z + 0.12]);
    });
  }
  function buildBed(i, x, z, dir) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; // head at the wall, foot to the room
    const frame = M('#e9eef2'), steel = M('#9aa7b3');
    g.add(mesh(box(1.1, 0.12, 2.2), frame, 0, 0.55, 0, {outline: 1.01}));
    [[-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]].forEach(([a, b]) => { g.add(mesh(cyl(0.04, 0.04, 0.5), steel, a, 0.28, b)); g.add(mesh(sph(0.06), M('#333a44'), a, 0.05, b)); });
    g.add(mesh(box(1.12, 0.6, 0.08), frame, 0, 0.9, 1.08, {outline: 1.02})); // headboard (local +z = head)
    g.add(mesh(box(1.12, 0.38, 0.08), frame, 0, 0.78, -1.08, {outline: 1.02}));
    g.add(mesh(box(1.0, 0.16, 2.06), M('#ffffff'), 0, 0.68, 0));
    const pillow = mesh(cap(0.16, 0.55), M('#ffffff'), 0, 0.95, 0.82, {outline: 1.03}); pillow.rotation.set(0.55, 0, Math.PI / 2); g.add(pillow);
    const blanket = mesh(box(1.04, 0.14, 1.25), M(['#5b8fd6', '#e58f6a', '#7bb36a', '#b07ad1', '#e3b84c', '#5ab3b8'][i]), 0, 0.82, -0.42, {outline: 1.01}); g.add(blanket);
    const fold = mesh(box(1.06, 0.06, 0.22), M('#ffffff'), 0, 0.9, 0.18); g.add(fold);
    // chart at the foot
    g.add(mesh(box(0.34, 0.42, 0.03), M('#c9a15b'), 0, 0.98, -1.13)); g.add(mesh(box(0.26, 0.3, 0.01), M('#ffffff'), 0, 0.97, -1.15));
    // locker + IV pole + monitor at the head side
    const side = -0.95;
    g.add(mesh(box(0.5, 0.75, 0.5), M('#f1e3c6'), side, 0.38, 0.75, {outline: 1.02}));
    const pole = new T.Group(); pole.position.set(0.75, 0, 0.95); pole.add(mesh(cyl(0.025, 0.025, 2.0), steel, 0, 1.0, 0)); { const base = mesh(new T.TorusGeometry(0.18, 0.02, 6, 16), steel, 0, 0.04, 0); base.rotation.x = Math.PI / 2; pole.add(base); } g.add(pole);
    const bag = mesh(cap(0.08, 0.16), M('#cfe9ff', {transparent: true, opacity: 0.8}), 0, 1.75, 0.05); bag.visible = false; pole.add(bag);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 168; const ctx = cv.getContext('2d'); const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const mon = new T.Group(); mon.position.set(side, 0.75, 0.75);
    mon.add(mesh(cyl(0.03, 0.03, 0.6), steel, 0, 0.3, 0)); mon.add(mesh(box(0.62, 0.44, 0.1), M('#26303d'), 0, 0.78, 0, {outline: 1.03}));
    const screen = mesh(new T.PlaneGeometry(0.56, 0.37), new T.MeshBasicMaterial({map: tex}), 0, 0.78, 0.055, {shadow: false}); mon.add(screen);
    mon.rotation.y = Math.PI * 0.75; g.add(mon);
    // bed number sign above the head
    const sign = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#2f8f83'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 14); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 38px Fredoka, Trebuchet MS, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Bed ' + (i + 1), w / 2, h / 2 + 2); });
    const sg = new T.Mesh(new T.PlaneGeometry(0.8, 0.4), new T.MeshBasicMaterial({map: sign, transparent: true})); sg.position.set(0, 2.75, 1.2); sg.rotation.y = Math.PI; g.add(sg);
    // patient slot
    const slot = new T.Group(); slot.position.set(0, 0.62, 0.55); slot.rotation.x = 0.22; g.add(slot);
    scene.add(g);
    // collision: bed footprint in world space
    blockers.push([x - 1.15, z - 0.65, x + 1.15, z + 0.65]);
    // marker
    const mk = new T.Group(); const bub = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#ff6b5b'; c.beginPath(); c.arc(64, 60, 52, 0, 7); c.fill(); c.lineWidth = 8; c.strokeStyle = '#fff'; c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 76px Fredoka, Trebuchet MS, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 64, 64); });
    const sp = new T.Sprite(new T.SpriteMaterial({map: bub, depthTest: false})); sp.scale.set(0.9, 0.9, 1); mk.add(sp); mk.position.set(x + dir * 0.4, 3.0, z); mk.visible = false; scene.add(mk);
    const tickT = canvasTex(128, 128, (c) => { c.fillStyle = '#3fb37f'; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.fill(); c.lineWidth = 8; c.strokeStyle = '#fff'; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(38, 66); c.lineTo(57, 85); c.lineTo(92, 46); c.stroke(); });
    const tick = new T.Sprite(new T.SpriteMaterial({map: tickT, depthTest: false})); tick.scale.set(0.7, 0.7, 1); tick.position.set(x + dir * 0.4, 2.8, z); tick.visible = false; scene.add(tick);
    const ring = mesh(new T.RingGeometry(0.55, 0.75, 40), new T.MeshBasicMaterial({color: 0xff6b5b, transparent: true, opacity: 0.8, side: T.DoubleSide}), x + dir * 1.9, 0.02, z, {shadow: false}); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
    return {i, blanket, pos: new T.Vector3(x, 0, z), dir, group: g, slot, bag, mon: {cv, ctx, tex}, marker: mk, tick, ring, visit: new T.Vector3(x + dir * 1.9, 0, z), patient: null, parent: null, spec: null, done: false, v: null, phase: Math.random() * 10};
  }

  /* ---------- monitor screens ---------- */
  function drawMonitor(b, t) {
    const {ctx: g, tex} = b.mon, w = 256, h = 168, v = b.v;
    g.fillStyle = '#05080c'; g.fillRect(0, 0, w, h);
    if (!v) { g.fillStyle = '#1b2a33'; g.fillRect(8, 8, w - 16, h - 16); tex.needsUpdate = true; return; }
    const hr = Math.max(1, v.hr), beat = 60 / hr;
    // ECG trace
    g.strokeStyle = '#3cff8a'; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x < 160; x++) { const tt = t - (160 - x) / 80; const ph = ((tt % beat) + beat) % beat / beat; let y = 0; if (ph > 0.1 && ph < 0.14) y = -6; else if (ph > 0.2 && ph < 0.22) y = 4; else if (ph >= 0.22 && ph < 0.25) y = -30; else if (ph >= 0.25 && ph < 0.28) y = 10; else if (ph > 0.42 && ph < 0.52) y = -7 * Math.sin((ph - 0.42) / 0.1 * Math.PI); const yy = 40 + y; x ? g.lineTo(8 + x, yy) : g.moveTo(8 + x, yy); }
    g.stroke();
    // pleth
    g.strokeStyle = '#43d6ff'; g.beginPath(); for (let x = 0; x < 160; x++) { const tt = t - (160 - x) / 80; const ph = ((tt % beat) + beat) % beat / beat; const y = -Math.max(0, Math.sin(ph * Math.PI)) * 14 * (v.sat < 90 ? 0.6 : 1); x ? g.lineTo(8 + x, 98 + y) : g.moveTo(8 + x, 98 + y); } g.stroke();
    const al = {hr: v.hr > 120 || v.hr < 50, sat: v.sat < 92, bp: v.sbp < 90 || v.sbp > 180, rr: v.rr > 25 || v.rr < 10};
    const big = (txt, x, y, col, size, warn) => { g.fillStyle = warn && (t * 2 | 0) % 2 ? '#ff4d4d' : col; g.font = `bold ${size}px Nunito, sans-serif`; g.fillText(txt, x, y); };
    g.font = '11px Nunito, sans-serif'; g.fillStyle = '#3cff8a'; g.fillText('HR', 180, 18); big(Math.round(v.hr), 180, 50, '#3cff8a', 30, al.hr);
    g.fillStyle = '#43d6ff'; g.font = '11px Nunito, sans-serif'; g.fillText('SpO₂', 180, 72); big(Math.round(v.sat), 180, 104, '#43d6ff', 30, al.sat);
    g.fillStyle = '#ff7a7a'; g.font = '11px Nunito, sans-serif'; g.fillText('NIBP', 10, 128); big(`${Math.round(v.sbp)}/${Math.round(v.dbp)}`, 10, 158, '#ff9a9a', 26, al.bp);
    g.fillStyle = '#ffe066'; g.font = '11px Nunito, sans-serif'; g.fillText('RR', 180, 128); big(Math.round(v.rr), 180, 158, '#ffe066', 26, al.rr);
    tex.needsUpdate = true;
  }

  /* ---------- attachments on a patient ---------- */
  function dressPatient(b, spec) {
    const p = b.patient; if (!p) return;
    (p.userData.extras || []).forEach(o => o.parent && o.parent.remove(o)); p.userData.extras = [];
    const add = (o, parent = p) => { parent.add(o); p.userData.extras.push(o); };
    const at = new Set(spec.attach || []); const head = p.userData.head;
    if (at.has('prongs')) { const t = mesh(new T.TorusGeometry(0.12, 0.012, 6, 20, Math.PI), M('#cde8ff'), 0, -0.08, 0.27); t.rotation.x = Math.PI / 2; add(t, head); }
    if (at.has('mask') || at.has('nrb') || at.has('venturi') || at.has('neb')) { const m = mesh(new T.ConeGeometry(0.13, 0.16, 18, 1, true), M('#bff0d6', {transparent: true, opacity: 0.75, side: T.DoubleSide}), 0, -0.12, 0.36); m.rotation.x = -Math.PI / 2; add(m, head); if (at.has('nrb')) add(mesh(sph(0.12), M('#bff0d6', {transparent: true, opacity: 0.6}), 0, -0.36, 0.34), head); }
    if (at.has('neb')) { for (let k = 0; k < 3; k++) add(mesh(sph(0.05), new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.5}), 0.05 * k, -0.02 + 0.06 * k, 0.48), head); }
    if (at.has('collar')) add(mesh(cyl(0.13, 0.15, 0.16), M('#e8d3a8'), 0, 0.95, 0));
    if (at.has('tube')) add(mesh(cyl(0.015, 0.015, 0.3), M('#e9f4ff'), 0, -0.14, 0.42), head);
    b.bag.visible = at.has('iv');
    if (at.has('leads')) [-1, 1].forEach(s => add(mesh(sph(0.03), M('#ffffff'), s * 0.12, 0.66, 0.2)));
    // bumps under the blanket
    if (spec.preg || new Set(spec.signs || []).has('ascites')) { const bump = mesh(sph(0.3), b.blanket.material, 0, 0.82, -0.05); bump.scale.set(1.1, 0.7, 1); add(bump, b.group); }
  }

  /* ---------- public: beds & patients ---------- */
  function setBedPatient(i, spec) {
    const b = beds[i]; if (!b) return;
    if (b.patient) { b.slot.remove(b.patient); b.patient = null; }
    if (b.parent) { scene.remove(b.parent); b.parent = null; }
    b.spec = spec; b.v = spec ? Object.assign({}, spec.v) : null; b.done = false; b.tick.visible = false;
    if (!spec) { drawMonitor(b, 0); return; }
    b.patient = buildSitting(spec); b.patient.rotation.y = Math.PI; b.slot.add(b.patient); dressPatient(b, spec);
    if (spec.age < 13) { b.parent = buildStanding({sex: 'F', age: 35, skin: spec.skin, build: 'normal', top: '#e3a84c', bottom: '#5b4a7a', name: (spec.name || '') + 'mum'}); b.parent.position.set(b.pos.x + b.dir * 0.3, 0, b.pos.z - 1.05); b.parent.rotation.y = 0; scene.add(b.parent); }
    drawMonitor(b, 0);
  }
  function updatePatient(i, spec) {
    const b = beds[i]; if (!b) return; const prev = b.spec || {};
    const sameLook = JSON.stringify([prev.signs, prev.build, prev.preg]) === JSON.stringify([spec.signs, spec.build, spec.preg]);
    if (!sameLook) { const v = b.v; setBedPatient(i, spec); b.v = v; }
    else { b.spec = spec; dressPatient(b, spec); }
    if (spec.v) b.v = Object.assign({}, spec.v);
  }
  function markBed(i) { target = i; beds.forEach((b, k) => { b.marker.visible = k === i; b.ring.visible = k === i; }); }
  function setDone(i) { const b = beds[i]; if (b) { b.done = true; b.tick.visible = true; b.marker.visible = false; b.ring.visible = false; } }

  /* ---------- the doctor ---------- */
  const PRESETS = [
    {name: 'Dr Thandi Mokoena', sex: 'F', age: 27, skin: 4, top: '#2f8f83', look: {hair: 'braids', hairColor: '#1f1712'}},
    {name: 'Dr Sipho Ndlovu', sex: 'M', age: 28, skin: 5, top: '#2b4f8f', look: {hair: 'buzz', hairColor: '#1f1712', beard: true}},
    {name: 'Dr Aisha Patel', sex: 'F', age: 26, skin: 3, top: '#9c3d54', look: {hair: 'hijab', hairColor: '#1f1712', wrap: '#2e3a6b'}},
    {name: 'Dr Ruan van Wyk', sex: 'M', age: 29, skin: 1, top: '#4f9a52', look: {hair: 'short', hairColor: '#8a5a2b'}},
    {name: 'Dr Priya Naidoo', sex: 'F', age: 27, skin: 3, top: '#6d4fb3', look: {hair: 'bun', hairColor: '#1f1712', glasses: true}},
    {name: 'Dr Mo Abed', sex: 'M', age: 22, skin: 2, top: '#1f6fb8', look: {hair: 'short', hairColor: '#1f1712', beard: true}},
  ];
  function setDoctor(spec) {
    docSpec = spec; const pos = doctor ? doctor.position.clone() : new T.Vector3(0, 0, 6.5); const rot = doctor ? doctor.rotation.y : Math.PI;
    if (doctor) scene.remove(doctor);
    doctor = buildStanding(Object.assign({build: 'normal', coat: true, steth: true, badge: true, bottom: spec.top}, spec));
    doctor.position.copy(pos); doctor.rotation.y = rot; scene.add(doctor);
  }

  /* ---------- movement ---------- */
  function collides(x, z) { const r = 0.32; return blockers.some(([x0, z0, x1, z1]) => x + r > x0 && x - r < x1 && z + r > z0 && z - r < z1) || Math.abs(x) > 11.6 || z < -7.6 || z > 7.9; }
  function moveDoctor(dt) {
    if (!doctor) return;
    let dx = 0, dz = 0;
    if (!walkGoal && walkPath.length) walkGoal = walkPath.shift();
    if (walkGoal) {
      const d = walkGoal.clone().sub(doctor.position); d.y = 0;
      if (d.length() < 0.12) {
        walkGoal = null;
        if (!walkPath.length && arriveBed >= 0) { const b = arriveBed; arriveBed = -1; if (api.onVisit) setTimeout(() => api.onVisit(b), 150); }
      } else { dx = d.x; dz = d.z; }
    }
    const ud = doctor.userData; const moving = !!(dx || dz);
    if (moving) {
      const len = Math.hypot(dx, dz); dx /= len; dz /= len; const sp = (arriveBed >= 0 ? 6.5 : 4.2) * dt;
      const nx = doctor.position.x + dx * sp, nz = doctor.position.z + dz * sp;
      const bx = collides(nx, doctor.position.z), bz = collides(doctor.position.x, nz);
      if (!bx) doctor.position.x = nx; if (!bz) doctor.position.z = nz;
      if (bx && bz) { walkGoal = null; if (arriveBed >= 0) { walkPath = []; doctor.position.copy(beds[arriveBed].visit); } }
      const want = Math.atan2(dx, dz); let diff = want - doctor.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); doctor.rotation.y += diff * Math.min(1, dt * 12);
      ud.phase += dt * 11;
    } else ud.phase *= 0.85;
    const sw = Math.sin(ud.phase) * (moving ? 0.6 : 0);
    ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw; ud.arms[0].rotation.x = -sw * 0.8; ud.arms[1].rotation.x = sw * 0.8;
    ud.body.position.y = moving ? Math.abs(Math.sin(ud.phase)) * 0.05 : 0;
  }
  function nearBed() { return doctor && target >= 0 && arriveBed < 0 ? target : -1; }
  /* walk to a bed along the aisle, then open the encounter */
  function goToBed(i) {
    if (mode !== 'walk' || !doctor || !beds[i]) return;
    const b = beds[i];
    if (doctor.position.distanceTo(b.visit) < 0.5) { if (api.onVisit) api.onVisit(i); return; }
    const ax = Math.max(-8, Math.min(8, doctor.position.x));
    walkGoal = null; walkPath = [new T.Vector3(ax, 0, b.visit.z), b.visit.clone()]; arriveBed = i;
    prompt = -1; if (api.onNear) api.onNear(null);
  }

  /* ---------- camera ---------- */
  function followCam() {
    if (mode === 'menu') { orbit += 0.0015; const R = camera.aspect < 0.9 ? 24 : 15; cam.goalPos.set(Math.sin(orbit) * R, camera.aspect < 0.9 ? 16 : 10, Math.cos(orbit) * R + 2); cam.goalLook.set(0, 0.8, 0); }
    else if (mode === 'select') { cam.goalPos.set(doctor.position.x, 1.75, doctor.position.z + 3.6); cam.goalLook.set(doctor.position.x, 1.15, doctor.position.z); }
    else if (mode === 'walk' && doctor) {
      if (camera.aspect < 0.9) { const z = doctor.position.z * 0.25; cam.goalPos.set(9.5, 22, z); cam.goalLook.set(-0.6, 0, z); }
      else { const x = doctor.position.x * 0.45, z = doctor.position.z * 0.35; cam.goalPos.set(x, 14.5, z + 11.5); cam.goalLook.set(x, 0, z - 1.6); }
    }
    else if (mode === 'encounter' && active >= 0) {
      const b = beds[active]; const head = new T.Vector3(); b.patient ? b.patient.userData.head.getWorldPosition(head) : head.copy(b.pos).setY(1.4);
      const k = camera.aspect < 0.9 ? 2.1 : 1;
      cam.goalPos.set(b.pos.x + b.dir * 2.9 * k, 2.15 + (k - 1) * 0.9, b.pos.z + 1.25 * k); cam.goalLook.set(head.x + b.dir * 0.35, head.y - (k > 1 ? 0.15 : 0.3), head.z);
    }
    cam.pos.lerp(cam.goalPos, 0.06); cam.look.lerp(cam.goalLook, 0.08);
    // phones held upright: look across the ward so its long side runs up the screen, with a wider lens
    const portraitWalk = mode === 'walk' && camera.aspect < 0.9, fov = portraitWalk ? 62 : camera.aspect < 0.9 ? 50 : 42;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.up.set(portraitWalk ? -1 : 0, portraitWalk ? 0.0001 : 1, 0).normalize();
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    viewShift += (viewShiftGoal - viewShift) * 0.08; viewShiftY += (viewShiftYGoal - viewShiftY) * 0.08;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (Math.abs(viewShift) > 0.5 || Math.abs(viewShiftY) > 0.5) camera.setViewOffset(w, h, viewShift, viewShiftY, w, h); else camera.clearViewOffset();
  }

  /* ---------- loop ---------- */
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (mode === 'walk') {
      moveDoctor(dt);
      const n = nearBed();
      if (n !== prompt) { prompt = n; if (api.onNear) api.onNear(n >= 0 ? beds[n] : null); }
    } else if (mode === 'select' && doctor) { doctor.rotation.y += dt * 0.6; const ud = doctor.userData; ud.phase += dt * 2; ud.arms[1].rotation.z = Math.sin(ud.phase) * 0.15; }
    // idle life: breathing, nurse, markers
    beds.forEach(b => {
      b.phase += dt;
      if (b.patient) { const ud = b.patient.userData; ud.torso.scale.y = 1 + Math.sin(b.phase * 2 * ud.breath) * 0.02 * ud.breath; ud.head.rotation.y = Math.sin(b.phase * 0.4) * 0.15; }
      if (b.marker.visible) { b.marker.position.y = 3.0 + Math.sin(t * 3) * 0.15; b.ring.scale.setScalar(1 + (t * 0.8 % 1) * 0.3); b.ring.material.opacity = 0.8 * (1 - (t * 0.8 % 1)); }
      const live = (mode === 'encounter' && b.i === active) || b.i === target;
      if (b.v && (live ? true : (b.phase * 4 | 0) % 8 === 0)) drawMonitor(b, b.phase);
    });
    if (nurse) { nurse.userData.phase += dt; nurse.userData.head.rotation.y = Math.sin(nurse.userData.phase * 0.7) * 0.4; }
    followCam();
    renderer.render(scene, camera);
    if (api.onFrame) api.onFrame();
  }

  /* ---------- input ---------- */
  function onKey(e, down) {
    const k = e.key.toLowerCase(); if (['input', 'textarea', 'select'].includes((e.target.tagName || '').toLowerCase())) return;
    if (down && (k === 'e' || k === 'enter') && mode === 'walk' && target >= 0) goToBed(target);
  }
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function onClick(e) {
    if (mode !== 'walk') return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // clicked a patient / bed?
    if (target >= 0) { const b = beds[target]; const objs = [b.group, b.marker, b.ring, b.patient, b.parent].filter(Boolean); if (ray.intersectObjects(objs, true).length) { goToBed(target); return; } }
    if (arriveBed >= 0) return; // already on the way
    const f = ray.intersectObject(scene.getObjectByName('floor')); if (f.length) { walkPath = []; walkGoal = f[0].point.clone().setY(0); }
  }

  /* ---------- init ---------- */
  function init(cv) {
    canvas = cv;
    renderer = new T.WebGLRenderer({canvas, antialias: true}); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); scene.background = new T.Color('#bfe3d5'); scene.fog = new T.Fog('#bfe3d5', 30, 60);
    camera = new T.PerspectiveCamera(42, 1, 0.1, 100);
    scene.add(new T.HemisphereLight(0xffffff, 0xa8d6c8, 1.4));
    const sun = new T.DirectionalLight(0xfff4e0, 1.6); sun.position.set(6, 14, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 40}); sun.shadow.bias = -0.0008; scene.add(sun);
    buildWard();
    nurse = buildStanding({name: 'Sister Dlamini', sex: 'F', age: 48, skin: 4, build: 'overweight', top: '#ffffff', bottom: '#1f3f73', look: {hair: 'headwrap', hairColor: '#1f1712', wrap: '#1f3f73'}, badge: true});
    nurse.position.set(0.6, 0, -7.15); scene.add(nurse);
    setDoctor(PRESETS[0]);
    clock = new T.Clock();
    const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    new ResizeObserver(resize).observe(canvas); resize();
    addEventListener('keydown', e => onKey(e, true)); addEventListener('keyup', e => onKey(e, false));
    addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', e => {
      if (mode !== 'walk' || target < 0) { canvas.style.cursor = ''; return; }
      const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
      const b = beds[target]; canvas.style.cursor = ray.intersectObjects([b.group, b.marker, b.ring, b.patient].filter(Boolean), true).length ? 'pointer' : '';
    });
    frame();
  }
  function setMode(m) {
    walkPath = []; walkGoal = null; arriveBed = -1;
    mode = m; Object.keys(keys).forEach(k => keys[k] = false); walkGoal = null;
    if (m === 'select' && doctor) { doctor.position.set(0, 0, 3); doctor.rotation.y = 0; }
    if (m === 'walk' && doctor && Math.abs(doctor.position.z - 3) < 0.01) { doctor.position.set(0, 0, 6.6); doctor.rotation.y = Math.PI; }
    viewShiftGoal = 0; viewShiftYGoal = 0; if (m !== 'walk') { prompt = -1; if (api.onNear) api.onNear(null); }
  }
  function focusBed(i, panelPx, panelBottomPx) {
    active = i; const b = beds[i];
    doctor.position.copy(b.visit).add(new T.Vector3(b.dir * -0.5, 0, -1.05)); b.marker.visible = false; b.ring.visible = false; doctor.rotation.y = b.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    setMode('encounter'); viewShiftGoal = (panelPx || 0) / 2; viewShiftYGoal = (panelBottomPx || 0) / 2;
  }
  function release() { const b = beds[active]; active = -1; setMode('walk'); if (b) doctor.position.copy(b.visit).add(new T.Vector3(b.dir * 0.4, 0, 0)); }
  function setVitals(i, v) { if (beds[i]) beds[i].v = Object.assign({}, v); }
  function screenPos(obj3d, yOff = 0) { const v = new T.Vector3(); obj3d.getWorldPosition(v); v.y += yOff; v.project(camera); return {x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight, behind: v.z > 1}; }
  Object.assign(api, {init, goToBed, setMode, setDoctor, PRESETS, setBedPatient, updatePatient, markBed, setDone, focusBed, release, setVitals, screenPos, beds, bedCount: () => beds.length, mode: () => mode});
  Object.defineProperty(api, 'nurse', {get: () => nurse}); Object.defineProperty(api, 'doctor', {get: () => doctor});
  return api;
})();
