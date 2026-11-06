(() => {
  'use strict';
  const KEY = 'workday-calculator-v2';
  const $ = (id) => document.getElementById(id);
  const nowHalf = new Date().getHours() < 12 ? 'AM' : 'PM';
  const blankT = () => ({ h: '', m: '', s: '', p: nowHalf });
  const DEFAULTS = {
    mode: 'in', h24: false, sec: false, theme: null,
    cin: blankT(), till: blankT(), ydi: false, ydt: false,
    ch: '', cm: '', cs: '', rh: '9', rm: '0', rs: '',
  };
  let S = JSON.parse(JSON.stringify(DEFAULTS));
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  ['cin', 'till'].forEach((k) => {
    const t = S[k];
    S[k] = (t && typeof t === 'object') ? Object.assign(blankT(), t) : blankT();
    if (S[k].p !== 'AM' && S[k].p !== 'PM') S[k].p = nowHalf;
  });
  if (S.theme !== 'dark' && S.theme !== 'light') S.theme = null;
  if (!S.theme) S.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  // ---------- build the time fields (hh : mm : ss  AM/PM) ----------
  document.querySelectorAll('.tf').forEach((el) => {
    const k = el.dataset.key;
    el.innerHTML =
      `<input class="num" id="${k}H" inputmode="numeric" maxlength="2" placeholder="hh" aria-label="Hour" autocomplete="off">` +
      `<b>:</b><input class="num" id="${k}M" inputmode="numeric" maxlength="2" placeholder="mm" aria-label="Minutes" autocomplete="off">` +
      `<b class="sec-only">:</b><input class="num sec-only" id="${k}S" inputmode="numeric" maxlength="2" placeholder="ss" aria-label="Seconds (optional)" autocomplete="off">` +
      `<select id="${k}P" aria-label="AM or PM"><option>AM</option><option>PM</option></select>`;
  });

  // ---------- helpers ----------
  const pad = (n) => String(n).padStart(2, '0');
  const nowSec = () => Math.floor(Date.now() / 1000);
  const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function atSec(secOfDay, back) {            // local-time seconds-since-epoch for a time on today/yesterday
    const d = new Date(); d.setDate(d.getDate() - back);
    d.setHours(Math.floor(secOfDay / 3600), Math.floor((secOfDay % 3600) / 60), secOfDay % 60, 0);
    return Math.floor(d.getTime() / 1000);
  }
  function fmtTime(sec) {                     // -> HTML: big digits, small AM/PM
    const d = new Date(sec * 1000), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    const ss = S.sec ? ':' + pad(s) : '';
    return S.h24 ? `${pad(h)}:${pad(m)}${ss}` : `${h % 12 || 12}:${pad(m)}${ss}<small>${h < 12 ? 'AM' : 'PM'}</small>`;
  }
  const setT = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
  const setH = (id, v) => { const e = $(id); if (e.dataset.h !== v) { e.dataset.h = v; e.innerHTML = v; } };
  function short(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${h}h ${pad(m)}m` + (S.sec ? ` ${pad(s)}s` : '');
  }
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function long(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, p = [];
    if (h) p.push(plural(h, 'hour'));
    if (m) p.push(plural(m, 'minute'));
    if (S.sec && s) p.push(plural(s, 'second'));
    return p.join(' ') || '0 minutes';
  }
  function dayTag(sec) {
    const diff = Math.round((dayStart(sec * 1000) - dayStart(Date.now())) / 864e5);
    return diff === 0 ? '' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : new Date(sec * 1000).toLocaleDateString();
  }
  const n = (v) => (v === '' || v == null ? 0 : Number(v));
  const secPart = (v) => (S.sec ? n(v) : 0);       // seconds fields only count while "Seconds" is on

  // ---------- reading a time field ----------
  function readTime(key, label) {
    const t = S[key];
    if (t.h === '') return { empty: true };
    const h = n(t.h), m = n(t.m), s = secPart(t.s);
    const lo = S.h24 ? 0 : 1, hi = S.h24 ? 23 : 12;
    if (h < lo || h > hi) return { err: { msg: `${label} is invalid: the hour must be ${lo}–${hi}.`, ids: [key + 'H'] } };
    if (m > 59) return { err: { msg: `${label} is invalid: minutes must be 0–59.`, ids: [key + 'M'] } };
    if (s > 59) return { err: { msg: `${label} is invalid: seconds must be 0–59.`, ids: [key + 'S'] } };
    const h24 = S.h24 ? h : (h % 12) + (t.p === 'PM' ? 12 : 0);
    return { sec: h24 * 3600 + m * 60 + s };
  }

  // ---------- core calculation (whole seconds) ----------
  function compute() {
    const bad = (msg, ids) => ({ error: { msg, ids } });
    // required duration
    const rh = n(S.rh), rm = n(S.rm), rs = secPart(S.rs);
    if (rh > 24) return bad('Required hours can be at most 24.', ['rh']);
    if (rm > 59) return bad('Required minutes must be 0–59.', ['rm']);
    if (rs > 59) return bad('Required seconds must be 0–59.', ['rs']);
    const R = rh * 3600 + rm * 60 + rs;
    if (R <= 0) return bad('Required time must be more than zero.', ['rh', 'rm']);
    if (R > 86400) return bad('Required time can be at most 24 hours.', ['rh', 'rm', 'rs']);

    const now = nowSec();
    let ref, C = 0, hint = '';
    if (S.mode === 'in') {
      const t = readTime('cin', 'Check-in time');
      if (t.err) return { error: t.err };
      if (t.empty) return { empty: true };
      ref = atSec(t.sec, S.ydi ? 1 : 0);
      if (ref > now) return bad('Check-in time is invalid: it is in the future.' + (S.ydi ? '' : ' If you checked in yesterday, tick “This was yesterday”.'), ['cinH', 'cinM', 'cinS', 'cinP']);
      if (now - ref > 18 * 3600) hint = `You checked in ${long(now - ref)} ago. If that looks wrong, check the time or the “This was yesterday” box.`;
    } else {
      const ch = n(S.ch), cm = n(S.cm), cs = secPart(S.cs);
      if (cm > 59) return bad('Completed minutes must be 0–59.', ['cm']);
      if (cs > 59) return bad('Completed seconds must be 0–59.', ['cs']);
      C = ch * 3600 + cm * 60 + cs;
      if (C > 86400) return bad('Completed time can be at most 24 hours.', ['ch', 'cm', 'cs']);
      const t = readTime('till', 'Till time');
      if (t.err) return { error: t.err };
      if (t.empty || (S.ch === '' && S.cm === '' && (!S.sec || S.cs === ''))) return { empty: true };
      ref = atSec(t.sec, S.ydt ? 1 : 0);
      if (ref > now) return bad('Till time is invalid: it is in the future.' + (S.ydt ? '' : ' If it was recorded yesterday, tick “This was yesterday”.'), ['tillH', 'tillM', 'tillS', 'tillP']);
      if (now - ref > 12 * 3600) hint = `That reading is ${long(now - ref)} old. If that looks wrong, check the time or the “This was yesterday” box.`;
    }
    const elapsed = Math.max(0, now - ref);
    return { R, checkout: ref + (R - C), left: R - C - elapsed, completed: C + elapsed, hint };
  }

  // ---------- render ----------
  const ID_LIST = ['cinH', 'cinM', 'cinS', 'cinP', 'tillH', 'tillM', 'tillS', 'tillP', 'ch', 'cm', 'cs', 'rh', 'rm', 'rs'];
  function render() {
    document.documentElement.setAttribute('data-theme', S.theme);
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = S.theme === 'dark' ? '#0e131b' : '#eef1f6';
    document.body.classList.toggle('sec-on', S.sec);
    $('secT').checked = S.sec;
    $('f12').classList.toggle('on', !S.h24);
    $('f24').classList.toggle('on', S.h24);
    ['cinP', 'tillP'].forEach((id) => ($(id).hidden = S.h24));
    $('tabIn').classList.toggle('on', S.mode === 'in');
    $('tabTill').classList.toggle('on', S.mode === 'till');
    $('tabIn').setAttribute('aria-selected', S.mode === 'in');
    $('tabTill').setAttribute('aria-selected', S.mode === 'till');
    $('paneIn').hidden = S.mode !== 'in';
    $('paneTill').hidden = S.mode !== 'till';
    ['cinH', 'tillH'].forEach((id) => ($(id).placeholder = S.h24 ? 'HH' : 'hh'));
    const total = n(S.rh) * 60 + n(S.rm);
    document.querySelectorAll('#chips button').forEach((b) => b.classList.toggle('on', Number(b.dataset.m) === total && !secPart(S.rs)));

    const r = compute(), box = $('result'), msg = $('msg');
    box.classList.remove('done', 'invalid');
    ID_LIST.forEach((id) => $(id).classList.remove('bad'));
    let mText = '', mCls = 'msg';
    const applyMsg = () => { setT('msg', mText); if (msg.className !== mCls) msg.className = mCls; };

    if (r.error) {
      r.error.ids.forEach((id) => $(id).classList.add('bad'));
      mText = r.error.msg; mCls = 'msg err';
      box.classList.add('invalid');
      setH('out', '—'); setT('day', '');
      setT('sub', 'Fix the highlighted value to see your checkout time.');
      $('fill').style.width = '0%'; setT('pct', '');
      setT('sComp', '—'); setT('sLeft', '—'); setT('sReq', '—');
      setT('sLeftL', 'Left');
      return applyMsg();
    }
    if (r.empty) {
      setH('out', '—'); setT('day', '');
      setT('sub', 'Enter your details to see when you can leave.');
      $('fill').style.width = '0%'; setT('pct', '');
      setT('sComp', '—'); setT('sLeft', '—'); setT('sReq', '—');
      setT('sLeftL', 'Left');
      return applyMsg();
    }
    if (r.hint) { mText = r.hint; mCls = 'msg hint'; }

    const R = r.R;
    // Without seconds, show whole minutes: remaining rounds up, completed rounds down.
    const left = S.sec ? r.left : (r.left > 0 ? Math.ceil(r.left / 60) * 60 : -Math.floor(-r.left / 60) * 60);
    const completed = S.sec ? r.completed : Math.floor(r.completed / 60) * 60;
    setH('out', fmtTime(r.checkout));
    setT('day', dayTag(r.checkout));
    setT('sReq', short(R));
    setT('sComp', short(completed));
    const pct = Math.min(100, Math.floor((r.completed / R) * 100));
    $('fill').style.width = pct + '%';
    $('bar').setAttribute('aria-valuenow', pct);
    setT('pct', `${pct}% completed`);
    if (r.left > 0) {
      setT('sub', `You have ${long(left)} left.`);
      setT('sLeftL', 'Left'); setT('sLeft', short(left));
    } else {
      box.classList.add('done');
      const over = Math.abs(left);
      setT('sub', over === 0 ? 'You’re done for the day! You can check out now.'
        : `You’re done for the day! You’re ${long(over)} over your required hours.`);
      setT('sLeftL', 'Over'); setT('sLeft', short(over));
    }
    applyMsg();
  }

  // ---------- inputs <-> state ----------
  const TF = (k) => ({ h: $(k + 'H').value, m: $(k + 'M').value, s: $(k + 'S').value, p: $(k + 'P').value });
  function readInputs() {
    S.cin = TF('cin'); S.till = TF('till'); S.ydi = $('ydi').checked; S.ydt = $('ydt').checked;
    ['ch', 'cm', 'cs', 'rh', 'rm', 'rs'].forEach((id) => (S[id] = $(id).value));
  }
  function fillInputs() {
    ['cin', 'till'].forEach((k) => {
      $(k + 'H').value = S[k].h; $(k + 'M').value = S[k].m; $(k + 'S').value = S[k].s; $(k + 'P').value = S[k].p;
    });
    $('ydi').checked = !!S.ydi; $('ydt').checked = !!S.ydt;
    ['ch', 'cm', 'cs', 'rh', 'rm', 'rs'].forEach((id) => ($(id).value = S[id]));
  }
  // typing moves on by itself: hh -> mm -> ss, completed hr -> min -> sec
  const NEXT = { cinH: 'cinM', cinM: 'cinS', tillH: 'tillM', tillM: 'tillS', ch: 'cm', cm: 'cs' };
  function advance(e) {
    const id = e.target.id, nxt = NEXT[id], v = e.target.value;
    if (!nxt || !v || !(e.inputType || '').startsWith('insert')) return;
    let go = v.length === 2;
    if (!go && (id === 'cinH' || id === 'tillH')) go = Number(v) > (S.h24 ? 2 : 1);
    if (!go && id === 'ch') go = Number(v) > 2;
    const el = $(nxt);
    if (go && el.offsetParent !== null) el.focus();
  }
  function onInput(e) {
    if (e.target.classList.contains('num')) e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2);
    readInputs(); save(); render();
    if (e.type === 'input') advance(e);
  }
  [...ID_LIST, 'ydi', 'ydt'].forEach((id) => { $(id).addEventListener('input', onInput); $(id).addEventListener('change', onInput); });

  // switching 12H <-> 24H converts what is already typed, so nothing needs re-entering
  function convertHour(t, to24) {
    if (t.h === '') return;
    const h = n(t.h);
    if (to24) {
      if (h < 1 || h > 12) return;
      t.h = String((h % 12) + (t.p === 'PM' ? 12 : 0));
    } else {
      if (h > 23) return;
      t.p = h >= 12 ? 'PM' : 'AM';
      t.h = String(h % 12 || 12);
    }
  }
  document.querySelectorAll('[data-fmt]').forEach((b) => b.addEventListener('click', () => {
    const to24 = b.dataset.fmt === '24';
    if (to24 !== S.h24) { readInputs(); convertHour(S.cin, to24); convertHour(S.till, to24); S.h24 = to24; fillInputs(); }
    save(); render();
  }));
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { S.mode = b.dataset.mode; save(); render(); }));
  $('secT').addEventListener('change', () => { S.sec = $('secT').checked; save(); render(); });
  $('theme').addEventListener('click', () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; save(); render(); });
  document.querySelectorAll('#chips button').forEach((b) => b.addEventListener('click', () => {
    const m = Number(b.dataset.m); S.rh = String(Math.floor(m / 60)); S.rm = String(m % 60); S.rs = ''; fillInputs(); save(); render();
  }));
  $('reset').addEventListener('click', () => {
    const keep = { mode: S.mode, h24: S.h24, sec: S.sec, theme: S.theme, rh: S.rh, rm: S.rm, rs: S.rs };
    S = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), keep);
    fillInputs(); save(); render();
  });

  // live updates: every second, and immediately when the tab/phone wakes up
  setInterval(render, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('focus', render);

  fillInputs();
  render();
})();
