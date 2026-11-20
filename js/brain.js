/* Ward Round — the in-browser examiner.
   A small sentence-meaning model (all-MiniLM-L6-v2, int8, Apache-2.0) running in your browser with
   onnxruntime-web. No server, no account, no tokens, works offline and wherever the game is hosted.
   It turns sentences into "meaning vectors" so "mast cells burst and release histamine" can match
   "mast-cell degranulation" even though the words differ. If it can't load, the game falls back to
   keyword matching. */
'use strict';
const Brain = (() => {
  let session = null, vocab = null, loading = null, ok = false;
  const cache = new Map();
  const BASE = 'models/minilm/';

  /* ---------- BERT WordPiece tokenizer (uncased) ---------- */
  function basicTokens(text) {
    const t = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const out = []; let cur = '';
    for (const ch of t) {
      if (/\s/.test(ch)) { if (cur) out.push(cur); cur = ''; }
      else if (/[\p{P}\p{S}]/u.test(ch)) { if (cur) out.push(cur); cur = ''; out.push(ch); }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }
  function wordpiece(word) {
    if (word.length > 100) return [100];
    const ids = []; let start = 0;
    while (start < word.length) {
      let end = word.length, id = null;
      while (start < end) { const sub = (start > 0 ? '##' : '') + word.slice(start, end); if (vocab.has(sub)) { id = vocab.get(sub); break; } end--; }
      if (id === null) return [100];
      ids.push(id); start = end;
    }
    return ids;
  }
  function encode(text, max = 64) {
    const ids = [101];
    for (const w of basicTokens(text)) { for (const id of wordpiece(w)) { if (ids.length >= max - 1) break; ids.push(id); } }
    ids.push(102); return ids;
  }

  /* ---------- load ---------- */
  function load(onProgress) {
    if (loading) return loading;
    loading = (async () => {
      if (!window.ort) throw new Error('runtime missing');
      ort.env.wasm.wasmPaths = new URL('js/vendor/ort/', location.href).href; ort.env.wasm.numThreads = 1;
      // the model and runtime are stored in small pieces (< 3.5 MB each) so any free host can serve them
      const get = r => { if (!r.ok) throw new Error(r.url + ' ' + r.status); return r.arrayBuffer(); };
      const parts = (pre, n) => Promise.all(Array.from({length: n}, (_, i) => fetch(pre + String(i).padStart(2, '0')).then(get)));
      const join = list => { const out = new Uint8Array(list.reduce((t, x) => t + x.byteLength, 0)); let o = 0; for (const x of list) { out.set(new Uint8Array(x), o); o += x.byteLength; } return out; };
      const [v, mp, wp] = await Promise.all([fetch(BASE + 'vocab.txt').then(r => r.text()), parts(BASE + 'm.', 7), parts('js/vendor/ort/w.', 4)]);
      ort.env.wasm.wasmBinary = join(wp);
      vocab = new Map(v.split('\n').map((w, i) => [w.trim(), i]));
      const buf = join(mp);
      session = await ort.InferenceSession.create(buf, {executionProviders: ['wasm']});
      ok = true; return true;
    })().catch(e => { console.warn('Examiner model unavailable, using keyword marking:', e); ok = false; return false; });
    return loading;
  }

  /* ---------- embed ---------- */
  async function embed(texts) {
    const need = [...new Set(texts.filter(t => !cache.has(t)))];
    for (let i = 0; i < need.length; i += 16) {
      const batch = need.slice(i, i + 16), enc = batch.map(t => encode(t));
      const L = Math.max(...enc.map(e => e.length)), n = batch.length;
      const ids = new BigInt64Array(n * L), mask = new BigInt64Array(n * L), tt = new BigInt64Array(n * L);
      enc.forEach((e, r) => e.forEach((id, c) => { ids[r * L + c] = BigInt(id); mask[r * L + c] = 1n; }));
      const out = await session.run({input_ids: new ort.Tensor('int64', ids, [n, L]), attention_mask: new ort.Tensor('int64', mask, [n, L]), token_type_ids: new ort.Tensor('int64', tt, [n, L])});
      const h = out.last_hidden_state.data, D = 384;
      enc.forEach((e, r) => {
        const v = new Float32Array(D);
        for (let c = 0; c < e.length; c++) for (let d = 0; d < D; d++) v[d] += h[(r * L + c) * D + d];
        let norm = 0; for (let d = 0; d < D; d++) { v[d] /= e.length; norm += v[d] * v[d]; }
        norm = Math.sqrt(norm) || 1; for (let d = 0; d < D; d++) v[d] /= norm;
        cache.set(batch[r], v);
      });
    }
    return texts.map(t => cache.get(t));
  }
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

  /* split an answer into short meaningful chunks (sentences, clauses, list items) */
  function chunks(text, minWords = 2) {
    const parts = String(text).split(/(?<=[.;!?])\s+|\n+|;\s*|,\s+(?=\w+\s+\w+)|\s+→\s+|\s+-\s+/).map(s => s.replace(/[()]/g, ' ').trim()).filter(s => s.split(/\s+/).length >= minWords);
    return parts.length ? parts : [String(text)];
  }

  /* which items does the student's text mention? (by meaning) — returns {ids, sims} */
  async function match(student, items, thr = 0.55) {
    const sc = chunks(student, 1).concat([student]);
    const [S, I] = await Promise.all([embed(sc), embed(items)]);
    const sims = I.map(v => Math.max(...S.map(s => dot(s, v))));
    return {ids: sims.map((s, i) => s >= thr ? i : -1).filter(i => i >= 0), sims};
  }
  /* how much of the model answer does the student cover? */
  async function cover(student, model, thr = 0.58) {
    const pts = chunks(model, 3).slice(0, 14);
    const {sims} = await match(student, pts, thr);
    const hit = pts.filter((_, i) => sims[i] >= thr), miss = pts.filter((_, i) => sims[i] < thr);
    // partial credit for near misses
    const score = sims.reduce((a, s) => a + (s >= thr ? 1 : s >= thr - 0.1 ? 0.5 : 0), 0) / Math.max(1, pts.length);
    return {score, hit, miss, sims, pts};
  }
  /* best match of a question against facts (for the patient) */
  async function best(question, facts) {
    const [q] = await embed([question]); const F = await embed(facts);
    const sims = F.map(v => dot(q, v)); let bi = 0; sims.forEach((s, i) => { if (s > sims[bi]) bi = i; });
    return {i: bi, sim: sims[bi], sims};
  }
  return {load, embed, match, cover, best, chunks, get ready() { return ok; }};
})();
