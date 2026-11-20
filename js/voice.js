/* Ward Round — voice, all local: speak instead of typing, hear the patient, hands-free with Handy */
'use strict';
(function () {
  /* Everything here is the browser's own speech engine: free, no account, nothing sent to Claude.
     Speech-to-text uses Chrome/Edge's built-in recogniser (or Handy); the patient's voice uses the
     voices installed on your computer. */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SYN = window.speechSynthesis || null;
  let rec = null, target = null, listening = false, voiceOn = false;
  try { voiceOn = localStorage.getItem('wardround.voice') === 'on'; } catch (e) {}

  /* ---------- speak instead of typing ---------- */
  window.wireVoice = function (scope) {
    if (!SR) return;
    scope.querySelectorAll('[data-mic]').forEach(b => {
      if (b.dataset.wired) return; b.dataset.wired = '1'; b.classList.remove('hide');
      b.addEventListener('click', () => {
        const inp = document.getElementById(b.dataset.mic); if (!inp || inp.readOnly || inp.disabled) return;
        if (listening) { rec.stop(); return; }
        if (SYN) SYN.cancel();
        target = inp; const base = inp.value ? inp.value.replace(/\s*$/, ' ') : '';
        rec = new SR(); rec.lang = 'en-ZA'; rec.interimResults = true; rec.continuous = inp.tagName === 'TEXTAREA';
        let finalText = '';
        rec.onresult = e => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t + ' '; else interim += t; } inp.value = base + finalText + interim; };
        rec.onstart = () => { listening = true; mics(); };
        rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') document.querySelectorAll('[data-mic]').forEach(x => x.classList.add('hide')); };
        rec.onend = () => {
          listening = false; mics();
          const go = {askIn: 'askInGo', exIn: 'exInGo'}[inp.id];
          if (go && inp.value.trim()) { const g = document.getElementById(go); if (g && !g.disabled) g.click(); }
        };
        try { rec.start(); } catch (e) {}
      });
    });
  };
  function mics() { document.querySelectorAll('[data-mic]').forEach(b => { const on = listening && target && b.dataset.mic === target.id; b.textContent = on ? 'listening… stop' : 'speak'; b.classList.toggle('live', on); }); }

  /* ---------- the patient's voice ---------- */
  let voices = [];
  const loadVoices = () => { voices = SYN ? SYN.getVoices().filter(v => /^en/i.test(v.lang)) : []; };
  if (SYN) { loadVoices(); SYN.onvoiceschanged = loadVoices; }
  function voiceFor(p) {
    if (!voices.length) return null;
    const female = p.age < 13 ? true : p.sex === 'F';
    const want = female ? /female|zira|susan|hazel|libby|sonia|aria|jenny|samantha|karen|moira|tessa|fiona|leah|natasha/i : /male|david|mark|george|ryan|daniel|alex|fred|guy|william|thomas/i;
    const pool = voices.filter(v => want.test(v.name) && !(female ? /\bmale\b/i : /female/i).test(v.name));
    const za = pool.find(v => /en-ZA/i.test(v.lang)) || pool.find(v => /en-GB/i.test(v.lang));
    return za || pool[0] || voices[0];
  }
  window.speakPatient = function (txt, p) {
    if (!SYN || !voiceOn || listening) return;
    SYN.cancel();
    const u = new SpeechSynthesisUtterance(String(txt).replace(/\([^)]*\)\s*/g, ''));
    const v = voiceFor(p); if (v) u.voice = v;
    u.rate = p.age > 70 ? 0.88 : 0.98; u.pitch = p.age < 13 ? 1.35 : p.sex === 'F' ? 1.08 : 0.9;
    SYN.speak(u);
  };
  document.addEventListener('DOMContentLoaded', () => {
    const vb = document.getElementById('voiceBtn');
    if (vb && SYN) {
      vb.classList.remove('hide');
      const draw = () => { vb.textContent = voiceOn ? 'patient voice · on' : 'patient voice · off'; vb.setAttribute('aria-pressed', voiceOn); };
      vb.onclick = () => { voiceOn = !voiceOn; try { localStorage.setItem('wardround.voice', voiceOn ? 'on' : 'off'); } catch (e) {} if (!voiceOn) SYN.cancel(); draw(); };
      draw();
    }
    window.wireVoice(document);
  });

  /* ---------- hands-free with Handy (or any dictation app that pastes): a spoken question
     pasted into the chat or exam box is sent straight away; long answer boxes are left alone ---------- */
  let handsFree = true; try { handsFree = localStorage.getItem('wardround.handsfree') !== 'off'; } catch (e) {}
  const AUTO = {askIn: 'askInGo', exIn: 'exInGo'};
  document.addEventListener('paste', e => {
    const t = e.target; if (!handsFree || !t || !AUTO[t.id]) return;
    setTimeout(() => { const go = document.getElementById(AUTO[t.id]); if (t.value.trim() && go && !go.disabled) go.click(); }, 60);
  }, true);
  window.toggleHandsFree = function (btn) {
    handsFree = !handsFree; try { localStorage.setItem('wardround.handsfree', handsFree ? 'on' : 'off'); } catch (e) {}
    if (btn) { btn.textContent = handsFree ? 'hands-free · on' : 'hands-free · off'; btn.setAttribute('aria-pressed', handsFree); }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('handsBtn'); if (!b) return;
    b.textContent = handsFree ? 'hands-free · on' : 'hands-free · off'; b.setAttribute('aria-pressed', handsFree);
    b.addEventListener('click', () => window.toggleHandsFree(b));
  });

})();
