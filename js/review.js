/* End-of-round review: EYE1 practice-paper questions (js/eye1.js), shown word for word.
   - after a debrief: a short review from the cluster that matches this patient
   - from the menu: any whole cluster from papers 1 to 3 */
const Review = (() => {
  const KEY = 'wardround.eye1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const SECT = {BCMH: 'BCMH', CVS: 'CVS', RESP: 'Resp', Resp: 'Resp'};

  // which block a game case belongs to (from its id's cluster mapping, or its own block field)
  function clustersFor(def) {
    const exact = EYE1.filter(c => c.cases.includes(def.id));
    if (exact.length) return {list: exact, exact: true};
    const blk = (def.cat || []).map(x => SECT[x] || SECT[String(x).toUpperCase()]).find(Boolean);
    return {list: blk ? EYE1.filter(c => c.block === blk) : [], exact: false};
  }
  // prefer clusters you haven't done yet
  function pick(list) {
    const s = load(), seen = s.done || {};
    const fresh = list.filter(c => !seen[c.id]);
    const pool = fresh.length ? fresh : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // a short review keeps the paper's order and always includes the data question and one VSAQ
  function shortSet(c, n) {
    const qs = c.qs;
    if (qs.length <= n) return qs;
    const keep = new Set();
    const data = qs.find(q => q.type === 'data'), vsa = qs.filter(q => q.type === 'vsa');
    if (data) keep.add(data);
    if (vsa.length) keep.add(vsa[Math.floor(Math.random() * vsa.length)]);
    const sba = qs.filter(q => q.type === 'sba').sort(() => Math.random() - .5);
    while (keep.size < n && sba.length) keep.add(sba.pop());
    return qs.filter(q => keep.has(q));
  }

  /* ---- short-answer checking: spelling slips allowed, then you can overrule ---- */
  const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[₀-₉]/g, d => '0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(d)]).replace(/[^a-z0-9+ ]/g, ' ').replace(/(\d)([a-z])/g, '$1 $2').replace(/\s+/g, ' ').trim()
    .split(' ').map(w => ({i: '1', ii: '2', iii: '3', iv: '4', h: 'hours', hr: 'hours', hrs: 'hours', hour: 'hours', min: 'minutes', mins: 'minutes', wk: 'weeks', wks: 'weeks', mo: 'months', mths: 'months'}[w] || w)).join(' ');
  const GENERIC = new Set('mechanism syndrome disease test ratio cell cells necrosis infarct therapy treatment vaccine monitor phenomenon effect sign'.split(' '));
  const STOP = new Set('a an the of and or to in on for with by is are be as at its it from use using'.split(' '));
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n);
    let prev = Array.from({length: n + 1}, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  const digits = x => (x.match(/\d+/g) || []).join(',');
  const close = (w, v) => w === v || (digits(w) === digits(v) && w.length > 3 && v.length > 3 && 1 - lev(w, v) / Math.max(w.length, v.length) >= (w.length <= 5 ? 0.75 : 0.7));
  function vsaOk(said, answer) {
    const s = norm(said).split(' ').filter(Boolean);
    if (!s.length) return false;
    // the model answer and anything in brackets or after a slash count as alternatives
    const base = answer.replace(/\.$/, '');
    const alts = [base.replace(/\([^)]*\)/g, ''), ...(base.match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1)), ...base.split(/\s*\/\s*|\s+or\s+/)].map(norm).filter(Boolean);
    return alts.some(a => {
      const all = a.split(' ').filter(w => !STOP.has(w)), core = all.filter(w => !GENERIC.has(w));
      const t = core.length ? core : all;
      if (!t.length) return false;
      const j = t.join(''), sj = s.filter(w => !STOP.has(w)).join('');
      if (j.length > 3 && digits(j) === digits(sj) && 1 - lev(j, sj) / Math.max(j.length, sj.length) >= 0.8) return true;
      const hit = t.filter(w => s.some(v => close(w, v))).length;
      return hit / t.length >= (t.length <= 3 ? 1 : 0.75);
    });
  }

  /* ---- rendering ---- */
  function tableHTML(q) {
    if (q.report) return `<div class="rv-report">${h(q.report)}</div>`;
    if (!q.table) return '';
    const [head, ...rows] = q.table;
    const w = Math.max(...q.table.map(r => r.length));
    const cells = (r, tag) => r.map((c, i) => `<${tag}${i === r.length - 1 && r.length < w ? ` colspan="${w - r.length + 1}"` : ''}>${h(c)}</${tag}>`).join('');
    return `<div class="rv-tablewrap"><table class="rv-table"><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${rows.map(r => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody></table></div>`;
  }

  // runs a set of questions in host; resolves with {got, of}
  function run(host, c, qs, opts = {}) {
    return new Promise(done => {
      const st = load(); st.done = st.done || {}; st.q = st.q || {};
      let got = 0, i = 0;
      host.innerHTML = `<div class="rv">
        <div class="rv-head"><div><b class="f">${h(c.title)}</b><div class="setting">EYE1 practice paper ${c.paper} · cluster ${c.n} · ${c.block}</div></div><div class="rv-score" aria-live="polite">0/${qs.length}</div></div>
        <div class="rv-scen"><b>Clinical scenario</b><p>${h(c.scenario)}</p></div>
        <div class="rv-qs"></div></div>`;
      const qhost = host.querySelector('.rv-qs'), score = host.querySelector('.rv-score');
      const mark = (q, ok) => { if (ok) got++; score.textContent = `${got}/${qs.length}`; st.q[c.id + ':' + q.n] = ok ? 1 : 0; save(st); };
      const finish = () => {
        st.done[c.id] = Math.max(st.done[c.id] || 0, Math.round(100 * got / qs.length)); save(st);
        const pc = got / qs.length;
        qhost.insertAdjacentHTML('beforeend', `<div class="verdict ${pc >= .8 ? 'correct' : pc >= .5 ? 'partial' : 'incorrect'}"><h4>Review: ${got}/${qs.length}</h4>${pc >= .8 ? 'Exam-ready on this one.' : pc >= .5 ? 'Getting there. Read the explanations for the ones you missed.' : 'Worth going back over this topic in your notes.'}${opts.more ? ` <button class="btn sec rv-more" type="button">Do the whole cluster (${c.qs.length} questions)</button>` : ''}</div>`);
        const more = qhost.querySelector('.rv-more'); if (more) more.onclick = () => run(host, c, c.qs, {}).then(opts.onMore || (() => {}));
        done({got, of: qs.length});
      };
      const next = () => {
        if (i >= qs.length) return finish();
        const q = qs[i++], el = document.createElement('div');
        // same options, new order every time; letters follow the new order
        const order = q.options ? Object.entries(q.options).map(e => [e, Math.random()]).sort((a, b) => a[1] - b[1]).map(x => x[0]) : [];
        const shown = k => 'ABCD'[order.findIndex(([x]) => x === k)];
        el.className = 'rv-q';
        const lab = q.type === 'data' ? 'Data interpretation' : q.type === 'vsa' ? 'Very short answer (1 to 3 words)' : q.tag || 'Single best answer';
        el.innerHTML = `<div class="tag">Q${q.n} · ${h(lab)}</div>${tableHTML(q)}<p class="rv-stem">${h(q.stem)}</p>` +
          (q.type === 'vsa'
            ? `<form class="rv-vsa"><input type="text" autocomplete="off" spellcheck="false" placeholder="Your answer" aria-label="Your answer to Q${q.n}"><button class="btn">Check</button></form>`
            : `<div class="rv-opts" role="group">${order.map(([k, v], i) => `<button type="button" class="rv-opt" data-k="${k}"><span class="rv-k">${'ABCD'[i]}</span><span>${h(v)}</span></button>`).join('')}</div>`) +
          `<div class="rv-out"></div>`;
        qhost.appendChild(el);
        const out = el.querySelector('.rv-out');
        if (q.type === 'vsa') {
          const f = el.querySelector('form'), inp = f.querySelector('input');
          f.onsubmit = e => {
            e.preventDefault(); if (!inp.value.trim()) { inp.focus(); return; }
            inp.disabled = true; f.querySelector('button').disabled = true;
            let ok = vsaOk(inp.value, q.answer);
            out.innerHTML = `<div class="verdict ${ok ? 'correct' : 'incorrect'}"><h4>${ok ? 'Correct' : 'Not quite'}</h4><b>Answer:</b> ${h(q.answer)}<div class="rv-own">Marked wrong but you meant the same thing? <button type="button" class="btn sec">I had it right</button></div></div>`;
            const own = out.querySelector('.rv-own');
            if (ok) own.remove(); else own.querySelector('button').onclick = () => { ok = true; own.remove(); const v = out.querySelector('.verdict'); v.className = 'verdict correct'; v.querySelector('h4').textContent = 'Counted as correct'; got++; score.textContent = `${got}/${qs.length}`; st.q[c.id + ':' + q.n] = 1; save(st); };
            mark(q, ok); next(); scrollTo(el);
          };
          if (!opts.noFocus && !document.documentElement.classList.contains('mobile')) setTimeout(() => inp.focus({preventScroll: true}), 50);
        } else {
          el.querySelectorAll('.rv-opt').forEach(b => b.onclick = () => {
            const ok = b.dataset.k === q.key;
            el.querySelectorAll('.rv-opt').forEach(x => { x.disabled = true; if (x.dataset.k === q.key) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
            out.innerHTML = `<div class="verdict ${ok ? 'correct' : 'incorrect'}"><h4>${ok ? 'Correct' : `Answer: ${shown(q.key)}`}</h4>${h(q.why)}</div>`;
            mark(q, ok); next(); scrollTo(el);
          });
        }
      };
      const scrollTo = el => { const n = el.nextElementSibling; if (n) setTimeout(() => n.scrollIntoView({behavior: 'smooth', block: 'nearest'}), 60); };
      next();
    });
  }

  // debrief card for this patient
  function debriefCard(host, def, onAnswered) {
    const {list, exact} = clustersFor(def);
    if (!list.length) { host.remove(); return; }
    const c = pick(list), qs = shortSet(c, 5);
    host.innerHTML = `<b>End-of-round review</b><p class="setting" style="margin:4px 0 10px">${exact ? 'Exam-style questions on this condition' : `The practice papers don't have this exact condition, so here's a ${c.block} case instead`}, word for word from the EYE1 practice papers. ${qs.length} questions, about ${Math.ceil(qs.length * 1.5)} minutes.</p><div class="row"><button class="btn" type="button" id="rvGo">Start review</button></div>`;
    host.querySelector('#rvGo').onclick = () => {
      host.querySelector('.row').remove();
      const box = host.appendChild(Object.assign(document.createElement('div'), {className: 'rv-host'}));
      run(box, c, qs, {more: qs.length < c.qs.length}).then(r => onAnswered && onAnswered(r));
      box.scrollIntoView({behavior: 'smooth', block: 'start'});
    };
  }

  // menu screen: papers → clusters
  function menu(host) {
    const st = load(), done = st.done || {};
    const papers = [1, 2, 3];
    const total = EYE1.length, did = EYE1.filter(c => done[c.id] !== undefined).length;
    host.innerHTML = `<h2 style="margin:0 0 4px">EYE1 practice papers</h2><p class="setting" style="margin:0 0 12px">Papers 1 to 3, BCMH, CVS and Resp. Pick a case cluster and answer it like the exam. ${did ? `You've done ${did} of ${total}.` : ''}</p>
      ${papers.map(n => `<details class="rv-paper"${n === 1 ? ' open' : ''}><summary class="f">Practice paper ${n}</summary><div class="rv-list">${EYE1.filter(c => c.paper === n).map(c => `<button type="button" class="rv-cl" data-id="${c.id}"><span class="rv-n">${c.n}</span><span>${h(c.title)}<small>${c.block} · ${c.qs.length} questions</small></span>${done[c.id] !== undefined ? `<b class="rv-done">${done[c.id]}%</b>` : ''}</button>`).join('')}</div></details>`).join('')}
      <div class="row"><button class="btn sec" type="button" id="rvRand">Random cluster</button><button class="btn" data-back type="button">Back</button></div>`;
    const open = c => {
      host.innerHTML = `<div class="row rv-top"><button class="btn sec" type="button" data-all>‹ All clusters</button></div><div class="rv-host"></div>`;
      const toList = () => { menu(host); bindBack(host); host.scrollTop = 0; host.closest('.screen').scrollTop = 0; };
      host.querySelector('[data-all]').onclick = toList;
      host.scrollTop = 0; host.closest('.screen').scrollTop = 0;
      run(host.querySelector('.rv-host'), c, c.qs, {noFocus: true}).then(() => {
        const nx = EYE1[(EYE1.indexOf(c) + 1) % EYE1.length];
        host.insertAdjacentHTML('beforeend', `<div class="row rv-end"><button class="btn sec" type="button" data-all>‹ All clusters</button><button class="btn" type="button" data-next>Next: ${h(nx.title)}</button></div>`);
        host.querySelector('.rv-end [data-all]').onclick = toList;
        host.querySelector('[data-next]').onclick = () => open(nx);
        setTimeout(() => host.querySelector('.rv-end').scrollIntoView({behavior: 'smooth', block: 'nearest'}), 100);
      });
    };
    host.querySelectorAll('.rv-cl').forEach(b => b.onclick = () => open(EYE1.find(c => c.id === b.dataset.id)));
    host.querySelector('#rvRand').onclick = () => open(pick(EYE1));
  }
  let bindBack = () => {};
  return {debriefCard, menu, run, vsaOk, clustersFor, setBack: f => { bindBack = f; }};
})();
