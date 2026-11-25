/* Slash Photo — app logic. No build step, no dependencies.
   The editor runs on the device (engine.js). An AI provider is optional and only used by effects marked "AI". */
(() => {
  'use strict';

  const DEF = window.SLASH_DEFAULTS;
  const FX = window.SlashFX;
  const LS_KEY = 'slashphoto.config.v1';
  const PREVIEW = 1100;      // longest side of the live preview
  const ASPECTS = ['', '1:1', '4:5', '3:4', '2:3', '9:16', '5:4', '4:3', '3:2', '16:9', '21:9'];
  const ACCENTS = ['#FFD60A', '#FF9F0A', '#FF453A', '#FF375F', '#BF5AF2', '#0A84FF', '#64D2FF', '#30D158', '#FFFFFF'];

  /** True when the page runs inside a claude.ai artifact: saving goes through the host, and Web Share is unavailable. */
  const HOSTED = typeof window.claude?.use === 'function';
  const hostTheme = document.documentElement.dataset.theme || '';

  /* ───────── helpers ───────── */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => 'p_' + Math.random().toString(36).slice(2, 9);
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, path, val) => {
    const ks = path.split('.');
    const last = ks.pop();
    ks.reduce((a, k) => (a[k] ??= {}), o)[last] = val;
  };
  /** Deep-merge saved config over defaults so new settings appear after updates. Arrays are replaced whole. */
  const merge = (base, over) => {
    if (!isObj(over)) return base;
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
    return out;
  };
  const normCmd = (s) => String(s || '').toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9_-]/g, '');
  const icon = (d, size = 20, sw = 1.9) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const I = {
    up: 'M12 18V6M7 11l5-5 5 5',
    down: 'M12 6v12M7 13l5 5 5-5',
    minus: 'M7 12h10',
    chev: 'm9 6 6 6-6 6',
    cam: 'M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    lib: 'M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4.5 16l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5',
  };
  const toBlob = (cv, type, q) => new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat file gambar'))), type, q));

  /* ───────── config ───────── */
  /** Bring a stored/imported effect up to the current shape. */
  function normPreset(p) {
    const def = DEF.config.presets.find((d) => d.id === p.id);
    if (p.engine !== 'local' && p.engine !== 'ai') {
      // saved before the on-device editor existed: adopt the built-in look when there is one
      p.engine = def ? def.engine : 'ai';
      p.recipe = def ? clone(def.recipe) : {};
    }
    p.recipe = FX.sanitize(p.recipe);
    return p;
  }
  let C = load();
  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { /* corrupted → defaults */ }
    const c = merge(clone(DEF.config), saved);
    if (!Array.isArray(c.categories) || !c.categories.length) c.categories = clone(DEF.config.categories);
    if (!Array.isArray(c.presets)) c.presets = clone(DEF.config.presets);
    c.presets.forEach(normPreset);
    if (!DEF.providers[c.ai.provider]) c.ai.provider = 'gemini';
    return c;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(C)); }
    catch { toast('Penyimpanan penuh — perubahan belum tersimpan'); }
  }
  const catById = (id) => C.categories.find((c) => c.id === id) || C.categories[0];
  const presetById = (id) => C.presets.find((p) => p.id === id);
  const visiblePresets = () => C.presets.filter((p) => !p.hidden && (C.app.showAi || p.engine !== 'ai'));

  /* ───────── session state ───────── */
  const S = {
    tab: 'studio',
    src: null,            // { full, prev, thumb } canvases of the working photo
    undo: null,           // photo before the last AI edit
    fx: null,             // selected effect id
    adj: FX.defaults(),   // current editor parameters
    strength: 100,
    show: 'out',          // 'out' | 'src' (compare)
    mode: 'fx',           // 'fx' | 'adj'
    group: 'fx',          // open group in the Atur panel
    filter: 'all',
    override: null,       // manually edited AI prompt for the next run
    busy: false, abort: null, timer: null, error: null,
    query: '', reorder: false, sugIndex: 0, scroll: {},
    thumbs: new Map(), thumbQ: [], shotUrls: [],
  };
  const view = Object.assign(document.createElement('canvas'), { id: 'view' });
  const thumbCv = document.createElement('canvas');
  const curFx = () => (S.fx ? presetById(S.fx) : null);
  const isAi = () => curFx()?.engine === 'ai';
  const effective = () => FX.withStrength({ ...FX.defaults(), ...S.adj }, S.strength);
  const edited = () => Object.keys(FX.compact(S.adj)).length > 0;

  /* ───────── appearance ───────── */
  const mqLight = window.matchMedia('(prefers-color-scheme: light)');
  function applyAppearance() {
    const root = document.documentElement;
    // "auto" leaves the choice to the system (or to the host page's own theme switch)
    if (C.app.theme !== 'auto') root.dataset.theme = C.app.theme;
    else if (hostTheme) root.dataset.theme = hostTheme;
    else delete root.dataset.theme;
    const theme = root.dataset.theme || (mqLight.matches ? 'light' : 'dark');
    const accent = /^#[0-9a-f]{6}$/i.test(C.app.accent) ? C.app.accent : '#FFD60A';
    root.style.setProperty('--accent', accent);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    root.style.setProperty('--on-accent', lum > 0.6 ? '#000' : '#fff');
    // a white accent can't be used as text on a light background — fall back to the label colour
    if (theme === 'light' && lum > 0.9) root.style.setProperty('--accent-ink', '#000');
    else if (theme === 'dark' && lum < 0.12) root.style.setProperty('--accent-ink', '#fff');
    else root.style.removeProperty('--accent-ink');
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#F2F2F7' : '#000000';
    const name = C.app.name || 'Slash Photo';
    document.title = name;
    $$('[data-app-name]').forEach((el) => (el.textContent = name));
  }
  mqLight.addEventListener('change', applyAppearance);

  /* ───────── toast / alert / sheet ───────── */
  let toastT;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = true;
    void el.offsetWidth;
    el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (el.hidden = true), 2400);
  }

  function ask({ title, text = '', ok = 'OK', cancel = 'Batal', danger = false }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'backdrop alert-wrap';
      wrap.innerHTML = `<div class="alert" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="alert-text"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>
        <div class="alert-btns"><button type="button" data-v="0">${esc(cancel)}</button><button type="button" data-v="1" class="${danger ? 'danger' : ''}">${esc(ok)}</button></div>
      </div>`;
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        wrap.remove();
        resolve(b.dataset.v === '1');
      });
      $('#layer').append(wrap);
      $('button[data-v="1"]', wrap).focus();
    });
  }

  /** Bottom sheet. Returns { el, body, close }. */
  function sheet({ title, html, left = 'Tutup', right = '', onRight, onClose }) {
    const wrap = document.createElement('div');
    wrap.className = 'backdrop';
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head">
        <button type="button" class="l">${esc(left)}</button>
        <h2 class="sheet-title">${esc(title)}</h2>
        ${right ? `<button type="button" class="r">${esc(right)}</button>` : '<span></span>'}
      </div>
      <div class="sheet-body">${html}</div>
    </div>`;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      wrap.classList.add('closing');
      setTimeout(() => wrap.remove(), 210);
      onClose?.();
    };
    const api = { el: wrap, body: $('.sheet-body', wrap), close };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    $('.l', wrap).addEventListener('click', close);
    if (right) $('.r', wrap).addEventListener('click', () => onRight?.(api));
    $('#layer').append(wrap);
    return api;
  }

  /* ───────── photo loading ───────── */
  function scaled(img, w0, h0, max) {
    const k = Math.min(1, max / Math.max(w0, h0));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  }
  async function decode(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      bmp = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('Format foto tidak didukung browser ini'));
        img.src = URL.createObjectURL(file);
      });
    }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    const full = scaled(bmp, w, h, Number(C.image.maxSide) || 2048);
    bmp.close?.();
    return { full, prev: scaled(full, full.width, full.height, PREVIEW), thumb: scaled(full, full.width, full.height, 200) };
  }
  async function setSource(file, { keepUndo = false } = {}) {
    try {
      const src = await decode(file);
      if (!keepUndo) S.undo = null;
      S.src = src; S.error = null; S.show = 'out';
      renderStage(); requestDraw(); queueThumbs();
    } catch (e) { toast(e.message || 'Gagal membuka foto'); }
  }

  /* ───────── live preview ───────── */
  let raf = 0;
  function draw() {
    raf = 0;
    if (!S.src) return;
    try { FX.render(S.src.prev, S.show === 'src' ? {} : effective(), view, PREVIEW); }
    catch (e) { if (S.error !== e.message) { S.error = e.message; renderStage(); } }
  }
  function requestDraw() { if (!raf) raf = requestAnimationFrame(draw); }

  /* effect thumbnails rendered from the user's own photo */
  function queueThumbs(only) {
    if (!S.src) return;
    if (only) S.thumbQ.unshift(only);
    else {
      S.thumbs.clear();
      S.thumbs.set('', S.src.thumb.toDataURL('image/jpeg', 0.75));
      const list = visiblePresets().filter((p) => p.engine === 'local');
      const inView = (p) => S.filter === 'all' || (S.filter === 'fav' ? p.fav : p.cat === S.filter);
      S.thumbQ = [...list.filter(inView), ...list.filter((p) => !inView(p))].map((p) => p.id);
      paintThumb('');
    }
    setTimeout(pumpThumbs, 60);
  }
  function pumpThumbs() {
    if (!S.src || !S.thumbQ.length) return;
    const t0 = performance.now();
    try {
      while (S.thumbQ.length && performance.now() - t0 < 28) {
        const id = S.thumbQ.shift(), p = presetById(id);
        if (!p || p.engine !== 'local') continue;
        FX.render(S.src.thumb, p.recipe, thumbCv, 160);
        S.thumbs.set(id, thumbCv.toDataURL('image/jpeg', 0.72));
        paintThumb(id);
      }
    } catch { S.thumbQ = []; return; }
    requestDraw();                       // the shared GL canvas was resized for thumbnails
    if (S.thumbQ.length) setTimeout(pumpThumbs, 40);
  }
  function paintThumb(id) {
    const el = $(`#strip [data-id="${CSS.escape(id)}"] .fx-thumb`);
    const url = S.thumbs.get(id);
    if (el && url) { el.style.backgroundImage = `url(${url})`; el.classList.add('has'); }
  }

  /* ───────── choosing & editing an effect ───────── */
  function selectFx(id) {
    const p = id ? presetById(id) : null;
    S.fx = p ? p.id : null;
    S.adj = { ...FX.defaults(), ...(p && p.engine === 'local' ? p.recipe : {}) };
    S.strength = 100; S.override = null; S.show = 'out'; S.error = null;
    renderStage(); renderStrip(); renderComposer(); renderAdj(); requestDraw();
  }
  function resetAll() { selectFx(null); toast('Kembali ke foto asli'); }

  /* ───────── AI (optional) ───────── */
  const extraText = () => $('#cmd-input').value.replace(/(^|\s)\/\S*$/, '').trim();
  function buildPrompt() {
    const p = curFx();
    const core = p ? p.prompt : '';
    const extra = extraText();
    return [C.prompt.prefix, core, extra, core || extra ? C.prompt.suffix : ''].map((s) => (s || '').trim()).filter(Boolean).join('\n\n');
  }
  const finalPrompt = () => (S.override != null ? S.override.trim() : buildPrompt());

  async function httpJson(url, init) {
    let r;
    try { r = await fetch(url, init); }
    catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new Error('Tidak bisa terhubung ke server. Cek koneksi internet atau Base URL.');
    }
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch { /* non-JSON body */ }
    if (!r.ok) {
      const m = j?.error?.message || j?.error || j?.message || text.slice(0, 240) || r.statusText;
      throw new Error(`${r.status} — ${typeof m === 'string' ? m : JSON.stringify(m)}`);
    }
    return j ?? {};
  }
  const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
  const blobToDataUrl = (blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error('Gagal membaca gambar'));
    fr.readAsDataURL(blob);
  });
  const dataUrlToBlob = async (u) => (await fetch(u)).blob();

  const PROVIDERS = {
    gemini: {
      async edit({ key, cfg, prompt, blob, aspect, signal }) {
        const data = (await blobToDataUrl(blob)).split(',')[1];
        const body = {
          contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: blob.type || 'image/jpeg', data } }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(aspect ? { imageConfig: { aspectRatio: aspect } } : {}) },
        };
        const j = await httpJson(`${trimUrl(cfg.baseUrl)}/models/${encodeURIComponent(cfg.model.trim())}:generateContent`, {
          method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
        });
        const parts = j.candidates?.[0]?.content?.parts || [];
        const img = parts.map((p) => p.inlineData || p.inline_data).find((d) => d?.data);
        if (img) return dataUrlToBlob(`data:${img.mimeType || img.mime_type || 'image/png'};base64,${img.data}`);
        const said = parts.map((p) => p.text).filter(Boolean).join(' ').trim();
        const why = j.promptFeedback?.blockReason || j.candidates?.[0]?.finishReason;
        throw new Error(said || (why ? `Model tidak mengembalikan gambar (${why}).` : 'Model tidak mengembalikan gambar.'));
      },
      async models({ key, cfg }) {
        const j = await httpJson(`${trimUrl(cfg.baseUrl)}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
        return (j.models || []).map((m) => String(m.name || '').replace(/^models\//, '')).filter((n) => /image|banana/i.test(n) && !/imagen/i.test(n));
      },
    },
    openai: {
      async edit({ key, cfg, prompt, blob, aspect, signal }) {
        const fd = new FormData();
        fd.append('model', cfg.model.trim());
        fd.append('prompt', prompt);
        fd.append('image', blob, 'photo.jpg');
        let size = cfg.size;
        if (size === 'auto' && aspect) {
          const [a, b] = aspect.split(':').map(Number);
          size = a === b ? '1024x1024' : a > b ? '1536x1024' : '1024x1536';
        }
        if (size && size !== 'auto') fd.append('size', size);
        if (cfg.quality && cfg.quality !== 'auto') fd.append('quality', cfg.quality);
        if (cfg.fidelity) fd.append('input_fidelity', cfg.fidelity);
        const j = await httpJson(`${trimUrl(cfg.baseUrl)}/images/edits`, { method: 'POST', signal, headers: { Authorization: `Bearer ${key}` }, body: fd });
        const d = j.data?.[0];
        if (d?.b64_json) return dataUrlToBlob(`data:image/png;base64,${d.b64_json}`);
        if (d?.url) return dataUrlToBlob(d.url);
        throw new Error('Respons tidak berisi gambar.');
      },
      async models({ key, cfg }) {
        const j = await httpJson(`${trimUrl(cfg.baseUrl)}/models`, { headers: { Authorization: `Bearer ${key}` } });
        return (j.data || []).map((m) => m.id).filter((id) => /image/i.test(id)).sort();
      },
    },
    openrouter: {
      async edit({ key, cfg, prompt, blob, aspect, signal }) {
        const url = await blobToDataUrl(blob);
        const body = {
          model: cfg.model.trim(),
          modalities: ['image', 'text'],
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }] }],
          ...(aspect ? { image_config: { aspect_ratio: aspect } } : {}),
        };
        const j = await httpJson(`${trimUrl(cfg.baseUrl)}/chat/completions`, {
          method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body),
        });
        const msg = j.choices?.[0]?.message || {};
        const parts = Array.isArray(msg.content) ? msg.content : [];
        const found = msg.images?.[0]?.image_url?.url || msg.images?.[0]?.url
          || parts.find((p) => p.type === 'image_url')?.image_url?.url
          || (typeof msg.content === 'string' && msg.content.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/)?.[0]);
        if (found) return dataUrlToBlob(found);
        const said = typeof msg.content === 'string' ? msg.content.trim() : parts.map((p) => p.text).filter(Boolean).join(' ');
        throw new Error(said || 'Model tidak mengembalikan gambar. Pastikan model mendukung keluaran gambar.');
      },
      async models({ key, cfg }) {
        const j = await httpJson(`${trimUrl(cfg.baseUrl)}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
        const all = j.data || [];
        const img = all.filter((m) => m.architecture?.output_modalities?.includes?.('image') || /image/i.test(m.id));
        return (img.length ? img : all).map((m) => m.id).sort();
      },
    },
  };

  /** Send the photo to the AI provider. The result replaces the working photo, so sliders keep working on top of it. */
  async function generate() {
    if (S.busy) return;
    if (!S.src) return toast('Pilih foto dulu');
    const p = curFx();
    const prompt = finalPrompt();
    if (!prompt) return toast('Efek ini belum punya prompt');
    const ai = C.ai, key = (ai.keys[ai.provider] || '').trim();
    if (!key) return noKeySheet();

    S.busy = true; S.error = null; S.abort = new AbortController();
    const t0 = Date.now();
    $('#cmd-input').blur(); closeSuggest();
    renderStage(); renderComposer();
    S.timer = setInterval(() => {
      const el = $('.busy-time');
      if (el) el.textContent = `${Math.round((Date.now() - t0) / 1000)} dtk · ${ai[ai.provider].model}`;
    }, 500);
    try {
      const input = await toBlob(S.src.full, 'image/jpeg', Number(C.image.quality) || 0.92);
      const blob = await PROVIDERS[ai.provider].edit({ key, cfg: ai[ai.provider], prompt, blob: input, aspect: p?.aspect || C.prompt.aspect || '', signal: S.abort.signal });
      if (!blob || !/^image\//.test(blob.type)) throw new Error('Respons bukan gambar.');
      const before = S.src;
      S.fx = null; S.adj = FX.defaults(); S.strength = 100; S.override = null;
      await setSource(blob, { keepUndo: true });
      S.undo = before;
      if (C.image.autoSave) await addShot({ blob, cmds: p ? [p.cmd] : [], prompt, model: ai[ai.provider].model });
      toast('Hasil AI jadi foto dasar — lanjut atur di sini');
    } catch (e) {
      if (e.name !== 'AbortError') S.error = e.message || String(e);
    } finally {
      clearInterval(S.timer);
      S.busy = false; S.abort = null;
      renderStage(); renderStrip(); renderComposer(); renderAdj();
    }
  }

  function noKeySheet() {
    const pv = DEF.providers[C.ai.provider];
    const sh = sheet({
      title: 'Efek ini butuh AI',
      html: `<div class="group"><div class="group-foot" style="padding-top:0;font-size:15px;color:var(--label)">
          Efek bertanda AI mengubah isi foto (sudut kamera, latar, orang), jadi tidak bisa dikerjakan editor di perangkat. Untuk memakainya, isi API key ${esc(pv.label)} di Setelan. Semua efek lain jalan tanpa key.
        </div></div>
        <div class="group"><button class="btn btn-primary" data-a="settings" type="button">Buka Setelan</button></div>
        <div class="group"><button class="btn" data-a="copy" type="button">Salin prompt saja</button>
          <div class="group-foot">Atau salin prompt-nya dan tempel bersama fotomu di aplikasi AI apa pun.</div></div>
        <div class="group"><button class="btn" data-a="hide" type="button">Sembunyikan semua efek AI</button></div>`,
    });
    sh.body.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'settings') { sh.close(); go('settings'); }
      if (a === 'copy') { copyText(finalPrompt()); sh.close(); }
      if (a === 'hide') { C.app.showAi = false; save(); sh.close(); selectFx(null); renderFilters(); toast('Efek AI disembunyikan — nyalakan lagi di Setelan'); }
    });
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('Disalin'); }
    catch {
      const ta = Object.assign(document.createElement('textarea'), { value: t });
      document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      toast(ok ? 'Disalin' : 'Gagal menyalin');
    }
  }
  function promptSheet() {
    const ai = C.ai;
    const sh = sheet({
      title: 'Prompt AI',
      left: 'Batal',
      right: 'Pakai',
      html: `<div class="group"><div class="list"><div class="row-stack">
            <textarea class="area mono" id="pf" rows="10" aria-label="Prompt AI" spellcheck="false">${esc(finalPrompt())}</textarea>
          </div></div>
          <div class="group-foot">Teks ini dikirim ke <span class="mono">${esc(ai[ai.provider].model)}</span> bersama fotomu. Editan di sini berlaku untuk sekali jalan.</div></div>
        <div class="btn-grid"><button class="btn" type="button" data-a="copy">Salin</button><button class="btn" type="button" data-a="reset">Reset</button></div>`,
      onRight: (api) => {
        const v = $('#pf', api.body).value;
        S.override = v.trim() === buildPrompt().trim() ? null : v;
        renderComposer(); api.close();
      },
    });
    sh.body.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'copy') copyText($('#pf', sh.body).value);
      if (a === 'reset') { S.override = null; $('#pf', sh.body).value = buildPrompt(); renderComposer(); }
    });
  }

  /* ───────── export / share ───────── */
  const fileName = (cmds) => `${(C.app.name || 'slash').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(cmds?.[0] || 'edit')}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;
  const extOf = (blob) => (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  async function download(blob, name) {
    const filename = `${name}.${extOf(blob)}`;
    if (HOSTED) {
      const dl = await window.claude.use('downloads').catch(() => null);
      if (!dl) return toast('Tampilan ini tidak bisa menyimpan file — tekan lama fotonya');
      try { await dl.save({ filename, data: blob }); }
      catch (e) { if (e?.code !== 'declined') toast(e?.code === 'rate_limited' ? 'Tunggu sebentar, lalu coba lagi' : 'Tidak bisa menyimpan di tampilan ini'); }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const canShareFiles = (blob) => !HOSTED && !!navigator.canShare?.({ files: [new File([blob], 'a.' + extOf(blob), { type: blob.type })] });
  async function share(blob, name) {
    const file = new File([blob], `${name}.${extOf(blob)}`, { type: blob.type });
    if (canShareFiles(blob)) {
      try { await navigator.share({ files: [file] }); } catch { /* user cancelled */ }
    } else download(blob, name);
  }
  async function addShot(rec) {
    try {
      await DB.add({ id: Date.now() + '-' + uid(), ts: Date.now(), ...rec });
      await DB.trim(Number(C.image.maxHistory) || 60);
    } catch { toast('Gagal menyimpan ke Galeri'); }
  }

  /** Render at full resolution and offer the file. */
  async function exportImage() {
    if (!S.src || S.busy) return;
    const btn = $('#btn-save');
    btn.disabled = true; btn.textContent = 'Memproses…';
    try {
      await new Promise((r) => setTimeout(r, 30));          // let the button repaint before the heavy render
      const cv = document.createElement('canvas');
      FX.render(S.src.full, effective(), cv, Number(C.image.maxSide) || 2048);
      const blob = await toBlob(cv, 'image/jpeg', Number(C.image.quality) || 0.92);
      const w = cv.width, h = cv.height;
      cv.width = cv.height = 1;                            // free the big canvas early (iOS memory)
      requestDraw();
      const p = curFx();
      const cmds = p ? [p.cmd] : [];
      if (C.image.autoSave) await addShot({ blob, cmds, model: 'editor' });
      const url = URL.createObjectURL(blob), name = fileName(cmds);
      const canShare = canShareFiles(blob);
      const sh = sheet({
        title: 'Siap disimpan',
        html: `<img class="viewer-img" src="${url}" alt="Hasil akhir">
          <div class="viewer-meta">${w} × ${h} px · ${(blob.size / 1048576).toFixed(1)} MB${C.image.autoSave ? ' · sudah masuk Galeri' : ''}</div>
          <div class="btn-grid">
            ${canShare ? '<button class="btn btn-primary" type="button" data-a="share">Simpan / Bagikan</button><button class="btn" type="button" data-a="save">Unduh file</button>'
              : '<button class="btn btn-primary" type="button" data-a="save" style="grid-column:1/-1">Simpan file</button>'}
          </div>
          ${canShare ? '<div class="group-foot" style="padding:0 4px">Di iPhone: “Simpan / Bagikan” lalu pilih Simpan Gambar, atau tekan lama fotonya.</div>' : ''}`,
        onClose: () => setTimeout(() => URL.revokeObjectURL(url), 500),
      });
      sh.body.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'share') share(blob, name);
        if (a === 'save') download(blob, name);
      });
    } catch (e) { toast(e.message || 'Gagal menyimpan'); }
    finally { btn.disabled = false; btn.textContent = 'Simpan'; }
  }

  /* ───────── gallery DB ───────── */
  const DB = {
    _p: null,
    open() {
      return (this._p ??= new Promise((res, rej) => {
        const rq = indexedDB.open('slashphoto', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('shots', { keyPath: 'id' });
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      }));
    },
    async tx(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const t = db.transaction('shots', mode);
        const rq = fn(t.objectStore('shots'));
        t.oncomplete = () => res(rq?.result);
        t.onerror = t.onabort = () => rej(t.error);
      });
    },
    add(rec) { return this.tx('readwrite', (s) => s.put(rec)); },
    del(id) { return this.tx('readwrite', (s) => s.delete(id)); },
    clear() { return this.tx('readwrite', (s) => s.clear()); },
    async all() { return ((await this.tx('readonly', (s) => s.getAll())) || []).sort((a, b) => b.ts - a.ts); },
    async trim(max) {
      const all = await this.all();
      for (const r of all.slice(max)) await this.del(r.id);
    },
  };

  /* ───────── STUDIO rendering ───────── */
  function renderStage() {
    const st = $('#stage');
    st.classList.toggle('has-img', !!S.src);
    if (!S.src) {
      st.innerHTML = `<div class="empty">
        <div class="empty-mark" aria-hidden="true">/</div>
        <h2>Mulai dari satu foto</h2>
        <p>Pilih efek, lalu atur sendiri tiap detailnya.</p>
        <div class="empty-btns">
          <button class="btn btn-primary" type="button" data-a="lib">${icon(I.lib)} Pilih dari Galeri</button>
          <button class="btn" type="button" data-a="cam">${icon(I.cam)} Ambil Foto</button>
        </div>
      </div>`;
    } else {
      const showOut = S.show === 'out';
      st.innerHTML = '';
      st.append(view);
      st.insertAdjacentHTML('beforeend', `
        ${edited() && !S.busy ? `<div class="seg-ba" role="group" aria-label="Bandingkan">
            <button type="button" data-a="show-src" aria-pressed="${!showOut}">Asli</button>
            <button type="button" data-a="show-out" aria-pressed="${showOut}">Hasil</button></div>` : ''}
        ${S.busy ? '' : `<button class="stage-chip right" type="button" data-a="change">Ganti foto</button>`}
        ${S.undo && !S.busy ? '<button class="stage-chip left-b" type="button" data-a="undo">Urungkan AI</button>' : ''}
        ${isAi() && !S.busy ? '<div class="stage-hint">Efek AI — tekan ↑ di bawah untuk membuat</div>' : ''}
        ${S.busy ? `<div class="busy" role="status">
            <div class="busy-cmd">${esc(curFx() ? '/' + curFx().cmd : 'AI')}</div>
            <div class="busy-time">0 dtk · ${esc(C.ai[C.ai.provider].model)}</div>
            <button class="btn btn-sm" type="button" data-a="cancel">Batal</button></div>` : ''}`);
    }
    $('#btn-save').hidden = !S.src;
    $('#btn-reset').hidden = !S.src || (!edited() && !S.fx);
    const keyIssue = S.error && /\b(401|403)\b|api.?key|unauth|permission/i.test(S.error);
    const modelIssue = S.error && /\b404\b|not found|model/i.test(S.error);
    $('#stage-error').innerHTML = S.error ? `<div class="error" role="alert">
      <div class="error-msg"><b>Gagal.</b> ${esc(S.error)}</div>
      <div class="error-row">
        ${isAi() ? '<button class="btn btn-sm" type="button" data-a="retry">Coba lagi</button>' : ''}
        ${keyIssue || modelIssue ? '<button class="btn btn-sm" type="button" data-a="open-settings">Cek Setelan</button>' : ''}
        <button class="btn btn-sm" type="button" data-a="dismiss">Tutup</button>
      </div></div>` : '';
    const p = curFx();
    $('#fx-label').innerHTML = p ? `<span class="mono">/${esc(p.cmd)}</span>${S.strength < 100 ? ` · ${S.strength}%` : ''}` : (edited() ? 'Editan sendiri' : '');
  }

  function renderFilters() {
    const vis = visiblePresets();
    const favs = vis.filter((p) => p.fav).length;
    const pills = [['all', 'Semua', vis.length]];
    if (favs) pills.push(['fav', '★ Favorit', favs]);
    for (const c of C.categories) {
      const n = vis.filter((p) => p.cat === c.id).length;
      if (n) pills.push([c.id, `${c.emoji} ${c.name}`, n]);
    }
    if (!pills.some(([id]) => id === S.filter)) S.filter = 'all';
    $('#filters').innerHTML = pills.map(([id, label, n]) =>
      `<button class="pill" type="button" role="tab" aria-selected="${S.filter === id}" data-f="${esc(id)}">${esc(label)} <small>${n}</small></button>`).join('');
    renderStrip();
  }

  function renderStrip() {
    let list = visiblePresets();
    if (S.filter === 'fav') list = list.filter((p) => p.fav);
    else if (S.filter !== 'all') list = list.filter((p) => p.cat === S.filter);
    const tile = (id, label, emoji, ai, color) => {
      const url = S.thumbs.get(id);
      return `<button class="fx" type="button" data-id="${esc(id)}" aria-pressed="${(S.fx || '') === id}">
        <span class="fx-thumb ${url ? 'has' : ''}" style="${url ? `background-image:url(${url});` : ''}--c:${esc(color)}">
          <span class="fx-emoji" aria-hidden="true">${esc(emoji)}</span>${ai ? '<span class="fx-ai">AI</span>' : ''}</span>
        <span class="fx-cmd">${esc(label)}</span></button>`;
    };
    $('#strip').innerHTML = tile('', 'Asli', '○', false, '#8E8E93') + list.map((p) => {
      const c = catById(p.cat);
      return tile(p.id, '/' + p.cmd, c.emoji, p.engine === 'ai', c.color);
    }).join('');
  }

  function renderComposer() {
    const ai = isAi();
    $('#btn-go').hidden = $('#btn-prompt').hidden = !ai;
    $('#btn-go').setAttribute('aria-disabled', String(S.busy || !S.src));
    $('#btn-prompt').classList.toggle('on', S.override != null);
    $('#cmd-input').placeholder = ai ? 'Instruksi tambahan (opsional)' : 'Ketik / untuk cari efek';
  }

  function setMode(mode) {
    S.mode = mode;
    $$('#mode-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('#panel-fx').hidden = mode !== 'fx';
    $('#panel-adj').hidden = mode !== 'adj';
    if (mode === 'adj') renderAdj();
  }

  /* slider panel */
  const groupDirty = (g) => FX.PARAMS.some((p) => p.g === g && S.adj[p.k] !== p.d);
  function renderAdj() {
    if (S.mode !== 'adj') return;
    const groups = [['fx', 'Kekuatan'], ...FX.GROUPS.map(([id, name]) => ['g:' + id, name])];
    $('#adj-groups').innerHTML = groups.map(([id, name]) =>
      `<button class="pill" type="button" role="tab" aria-selected="${S.group === id}" data-g="${id}">${esc(name)}${id !== 'fx' && groupDirty(id.slice(2)) ? '<i class="dot"></i>' : ''}</button>`).join('');
    const list = $('#adj-list');
    if (S.group === 'fx') {
      const p = curFx();
      const local = p && p.engine === 'local';
      list.innerHTML = `
        <label class="adj"><span class="adj-l">Kekuatan</span><input type="range" min="0" max="100" step="1" value="${S.strength}" data-strength aria-label="Kekuatan efek"><span class="adj-v">${S.strength}</span></label>
        <div class="adj-actions">
          ${local ? `<button class="btn btn-sm" type="button" data-a="save-fx">Simpan ke <span class="mono">/${esc(p.cmd)}</span></button>` : ''}
          <button class="btn btn-sm" type="button" data-a="save-new">Simpan sebagai efek baru</button>
          ${local ? '<button class="btn btn-sm" type="button" data-a="revert">Kembali ke setelan efek</button>' : ''}
        </div>
        <p class="adj-note">${p ? (local ? 'Geser tab di atas untuk mengatur tiap detail efek ini. Perubahan baru tersimpan ke efek kalau kamu menekan “Simpan ke”.' : 'Ini efek AI. Setelah hasilnya jadi, kamu bisa lanjut mengaturnya dengan slider.') : 'Belum ada efek dipilih — kamu tetap bisa mengatur foto dari nol lewat tab di atas.'}</p>`;
      return;
    }
    const g = S.group.slice(2);
    list.innerHTML = FX.PARAMS.filter((p) => p.g === g).map((p) => {
      const v = S.adj[p.k];
      if (p.t === 'range') return `<label class="adj"><span class="adj-l">${esc(p.l)}</span><input type="range" min="${p.min}" max="${p.max}" step="1" value="${v}" data-k="${p.k}" aria-label="${esc(p.l)}"><button class="adj-v ${v !== p.d ? 'on' : ''}" type="button" data-zero="${p.k}" aria-label="Reset ${esc(p.l)}">${Math.round(v)}</button></label>`;
      if (p.t === 'color') return `<label class="adj"><span class="adj-l">${esc(p.l)}</span><span class="adj-fill"></span><input type="color" value="${esc(v)}" data-k="${p.k}" aria-label="${esc(p.l)}"></label>`;
      if (p.t === 'select') return `<label class="adj"><span class="adj-l">${esc(p.l)}</span><select data-k="${p.k}" aria-label="${esc(p.l)}">${p.opts.map(([o, t]) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
      if (p.t === 'bool') return `<label class="adj"><span class="adj-l">${esc(p.l)}</span><span class="switch"><input type="checkbox" data-k="${p.k}" ${v ? 'checked' : ''}><i></i></span></label>`;
      return `<label class="adj"><span class="adj-l">${esc(p.l)}</span><input type="text" value="${esc(v)}" data-k="${p.k}" placeholder="—" aria-label="${esc(p.l)}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>`;
    }).join('');
  }
  function onAdjInput(e) {
    const el = e.target;
    if (el.hasAttribute('data-strength')) {
      S.strength = Number(el.value);
      el.nextElementSibling.textContent = S.strength;
    } else if (el.dataset.k) {
      const p = FX.BY_KEY[el.dataset.k];
      S.adj[p.k] = p.t === 'range' ? Number(el.value) : p.t === 'bool' ? el.checked : el.value;
      if (p.t === 'range') { const v = el.nextElementSibling; v.textContent = el.value; v.classList.toggle('on', S.adj[p.k] !== p.d); }
    } else return;
    if (S.show !== 'out') S.show = 'out';
    requestDraw();
  }
  /** What the current sliders amount to as a stored recipe (strength baked in). */
  const currentRecipe = () => {
    const e = effective();
    for (const p of FX.PARAMS) if (p.t === 'range') e[p.k] = Math.round(e[p.k]);
    return FX.compact(e);
  };

  /* slash autocomplete */
  const currentToken = () => $('#cmd-input').value.match(/(?:^|\s)\/(\S*)$/)?.[1];
  function renderSuggest() {
    const tok = currentToken();
    const box = $('#suggest');
    if (tok == null) return closeSuggest();
    const q = normCmd(tok);
    const pool = visiblePresets();
    const hits = [...pool.filter((p) => p.cmd.startsWith(q)), ...pool.filter((p) => !p.cmd.startsWith(q) && (p.cmd.includes(q) || p.name.toLowerCase().includes(q)))].slice(0, 5);
    if (!hits.length) return closeSuggest();
    S.sugIndex = Math.min(S.sugIndex, hits.length - 1);
    box.hidden = false;
    box.innerHTML = hits.map((p, i) => `<button type="button" data-id="${esc(p.id)}" class="${i === S.sugIndex ? 'active' : ''}"><span class="s-cmd">/${esc(p.cmd)}</span><span class="s-name">${esc(p.name)}${p.engine === 'ai' ? ' · AI' : ''}</span></button>`).join('');
  }
  function closeSuggest() { $('#suggest').hidden = true; S.sugIndex = 0; }
  function acceptSuggest(id) {
    const inp = $('#cmd-input');
    inp.value = inp.value.replace(/(^|\s)\/\S*$/, '$1').trimEnd();
    closeSuggest();
    const p = presetById(id);
    if (p && S.filter !== 'all' && S.filter !== p.cat) { S.filter = 'all'; renderFilters(); }
    selectFx(id);
    inp.blur();
    $(`#strip [data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  /* ───────── EFEK tab ───────── */
  function renderPresetList() {
    const q = S.query.trim().toLowerCase();
    const match = (p) => !q || p.cmd.includes(normCmd(q) || '\u0000') || p.name.toLowerCase().includes(q);
    let html = '';
    for (const c of C.categories) {
      const all = C.presets.filter((p) => p.cat === c.id);
      const list = all.filter(match);
      if (q && !list.length) continue;
      html += `<div class="group"><div class="group-head"><span>${esc(c.emoji)} ${esc(c.name)} · ${all.length}</span></div>
        <div class="list">${list.length ? list.map((p) => {
          const i = all.indexOf(p);
          const n = Object.keys(p.recipe || {}).length;
          return `<div class="row p-row ${p.hidden ? 'is-hidden' : ''}">
            <button class="p-emoji" type="button" data-edit="${esc(p.id)}" style="background:color-mix(in srgb, ${esc(c.color)} 22%, transparent)" tabindex="-1" aria-hidden="true">${esc(c.emoji)}</button>
            <button class="p-main" type="button" data-edit="${esc(p.id)}" style="text-align:left">
              <span class="p-cmd">/${esc(p.cmd)}</span><span class="p-sub">${esc(p.name)} · ${p.engine === 'ai' ? 'butuh AI' : `${n} pengaturan`}</span></button>
            ${p.engine === 'ai' ? '<span class="tag tag-ai">AI</span>' : ''}${p.hidden ? '<span class="tag">Tersembunyi</span>' : ''}
            ${S.reorder ? `<span class="p-tools">
                <button type="button" data-mv="-1" data-id="${esc(p.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan">${icon(I.up, 19)}</button>
                <button type="button" data-mv="1" data-id="${esc(p.id)}" ${i === all.length - 1 ? 'disabled' : ''} aria-label="Turunkan">${icon(I.down, 19)}</button>
                <button type="button" class="del" data-del="${esc(p.id)}" aria-label="Hapus /${esc(p.cmd)}">${icon(I.minus, 19, 2.4)}</button></span>`
              : `<button class="p-star" type="button" data-fav="${esc(p.id)}" aria-pressed="${!!p.fav}" aria-label="Favorit">${p.fav ? '★' : '☆'}</button>`}
          </div>`;
        }).join('') : '<div class="row" style="color:var(--label-2)">Kategori ini masih kosong</div>'}</div></div>`;
    }
    if (!html) html = `<div class="blank" style="padding-top:8vh"><h2>Tidak ketemu</h2><p>Tidak ada efek yang cocok dengan “${esc(S.query)}”.</p></div>`;
    else if (!q) {
      const local = C.presets.filter((p) => p.engine === 'local').length;
      html += `<div class="group"><div class="list">
        <button class="row row-btn" type="button" id="btn-cats">Kelola kategori<span class="row-value">${C.categories.length}</span>${icon(I.chev, 16)}</button>
      </div><div class="group-foot">${local} efek jalan di perangkat, ${C.presets.length - local} butuh AI. Ketuk efek untuk mengedit perintah, nama, kategori, dan pengaturannya.</div></div>`;
    }
    $('#preset-list').innerHTML = html;
    $('#btn-reorder').textContent = S.reorder ? 'Selesai' : 'Atur';
  }

  const aspectOptions = (val, autoLabel) => ASPECTS.map((a) => `<option value="${a}" ${a === val ? 'selected' : ''}>${a || autoLabel}</option>`).join('');

  /** Edit an effect. Pass `draft` to create a new one pre-filled (e.g. from the current sliders). */
  function presetSheet(id, draft) {
    const isNew = !id;
    const p = isNew ? { id: uid(), cmd: '', name: '', prompt: '', cat: !['all', 'fav'].includes(S.filter) ? S.filter : C.categories[0].id, engine: 'local', recipe: {}, aspect: '', fav: false, hidden: false, ...draft } : presetById(id);
    if (!p) return;
    const orig = DEF.config.presets.find((d) => d.id === p.id);
    const changed = orig && (['cmd', 'name', 'prompt', 'cat', 'aspect', 'engine'].some((k) => orig[k] !== p[k]) || JSON.stringify(orig.recipe) !== JSON.stringify(p.recipe));
    const sh = sheet({
      title: isNew ? 'Efek baru' : '/' + p.cmd,
      left: 'Batal',
      right: 'Simpan',
      html: `<div class="group"><div class="list">
          <label class="row"><span class="row-label">Perintah</span><input class="mono" type="text" id="f-cmd" value="${esc(p.cmd ? '/' + p.cmd : '')}" placeholder="/namaefek" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
          <label class="row"><span class="row-label">Nama</span><input type="text" id="f-name" value="${esc(p.name)}" placeholder="Nama tampilan"></label>
          <label class="row"><span class="row-label">Kategori</span><select id="f-cat">${C.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === p.cat ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}</select></label>
          <label class="row"><span class="row-label">Dikerjakan oleh</span><select id="f-engine"><option value="local" ${p.engine === 'local' ? 'selected' : ''}>Editor di perangkat</option><option value="ai" ${p.engine === 'ai' ? 'selected' : ''}>AI (butuh API key)</option></select></label>
        </div></div>
        <div class="group" id="g-local"><div class="group-head"><span>Pengaturan editan</span></div><div class="list">
            <button class="row row-btn" type="button" data-a="tune">Atur dengan slider di Studio${icon(I.chev, 16)}</button>
            <div class="row-stack"><span>Atau edit langsung (JSON)</span>
              <textarea class="area mono" id="f-recipe" rows="6" aria-label="Pengaturan dalam JSON" spellcheck="false" autocapitalize="off" autocorrect="off">${esc(JSON.stringify(p.recipe || {}, null, 1))}</textarea></div>
          </div><div class="group-foot">Tiap angka di sini adalah satu slider di tab Atur. Yang tidak ditulis berarti netral.</div></div>
        <div class="group" id="g-ai"><div class="group-head"><span>Prompt AI</span></div><div class="list"><div class="row-stack">
            <textarea class="area" id="f-prompt" rows="5" placeholder="Jelaskan perubahan yang diminta ke AI. Bahasa Inggris biasanya paling akurat." aria-label="Prompt AI">${esc(p.prompt)}</textarea></div>
            <label class="row"><span class="row-label">Rasio hasil</span><select id="f-aspect">${aspectOptions(p.aspect, 'Ikuti setelan')}</select></label>
          </div></div>
        <div class="group"><div class="list">
          <label class="row"><span class="row-label">Favorit</span><span class="switch"><input type="checkbox" id="f-fav" ${p.fav ? 'checked' : ''}><i></i></span></label>
          <label class="row"><span class="row-label">Sembunyikan dari Studio</span><span class="switch"><input type="checkbox" id="f-hidden" ${p.hidden ? 'checked' : ''}><i></i></span></label>
        </div></div>
        ${isNew ? '' : `<div class="group"><div class="list">
          <button class="row row-btn" type="button" data-a="dup">Duplikat</button>
          ${changed ? '<button class="row row-btn" type="button" data-a="restore">Kembalikan ke bawaan</button>' : ''}
          <button class="row row-btn danger" type="button" data-a="del">Hapus efek</button>
        </div></div>`}`,
      onRight: (api) => { if (commit()) { api.close(); toast(isNew ? `/${p.cmd} ditambahkan` : 'Tersimpan'); } },
    });
    const b = sh.body;
    const syncEngine = () => { $('#g-local', b).hidden = $('#f-engine', b).value !== 'local'; };
    $('#f-engine', b).addEventListener('change', syncEngine);
    syncEngine();
    function commit() {
      const cmd = normCmd($('#f-cmd', b).value);
      const engine = $('#f-engine', b).value;
      const prompt = $('#f-prompt', b).value.trim();
      if (!cmd) return toast('Perintah wajib diisi (huruf/angka tanpa spasi)'), false;
      if (C.presets.some((x) => x.cmd === cmd && x.id !== p.id)) return toast(`/${cmd} sudah dipakai efek lain`), false;
      if (engine === 'ai' && !prompt) return toast('Efek AI wajib punya prompt'), false;
      let recipe;
      try { recipe = FX.sanitize(JSON.parse($('#f-recipe', b).value || '{}')); }
      catch { return toast('JSON pengaturan tidak valid'), false; }
      Object.assign(p, {
        cmd, prompt, engine, recipe,
        name: $('#f-name', b).value.trim() || cmd,
        cat: $('#f-cat', b).value,
        aspect: $('#f-aspect', b).value,
        fav: $('#f-fav', b).checked,
        hidden: $('#f-hidden', b).checked,
      });
      if (isNew && !C.presets.includes(p)) C.presets.push(p);
      save(); renderAllPresets(); queueThumbs(p.id);
      if (S.fx === p.id) selectFx(p.id);
      return true;
    }
    b.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'tune') {
        if (!commit()) return;
        sh.close(); go('studio'); selectFx(p.id); S.group = 'g:light'; setMode('adj');
        if (!S.src) toast('Pilih foto dulu untuk melihat hasilnya');
      }
      if (a === 'dup') {
        let cmd = p.cmd + '2', n = 2;
        while (C.presets.some((x) => x.cmd === cmd)) cmd = p.cmd + ++n;
        const copy = { ...clone(p), id: uid(), cmd, name: p.name + ' (salinan)', builtin: false };
        C.presets.splice(C.presets.indexOf(p) + 1, 0, copy);
        save(); renderAllPresets(); queueThumbs(copy.id); sh.close(); presetSheet(copy.id);
      }
      if (a === 'restore') {
        Object.assign(p, clone(orig), { fav: p.fav, hidden: p.hidden });
        save(); renderAllPresets(); queueThumbs(p.id); sh.close(); toast('Dikembalikan ke bawaan');
        if (S.fx === p.id) selectFx(p.id);
      }
      if (a === 'del' && await confirmDelete(p)) sh.close();
    });
    if (isNew) setTimeout(() => $('#f-cmd', b)?.focus(), 350);
  }
  async function confirmDelete(p) {
    if (!(await ask({ title: `Hapus /${p.cmd}?`, text: 'Efek ini dihapus dari daftar. Efek bawaan bisa dipulihkan lewat Setelan → Reset efek.', ok: 'Hapus', danger: true }))) return false;
    C.presets = C.presets.filter((x) => x.id !== p.id);
    if (S.fx === p.id) S.fx = null;
    save(); renderAllPresets();
    return true;
  }
  function movePreset(id, dir) {
    const p = presetById(id);
    const same = C.presets.filter((x) => x.cat === p.cat);
    const other = same[same.indexOf(p) + dir];
    if (!other) return;
    const i = C.presets.indexOf(p), j = C.presets.indexOf(other);
    [C.presets[i], C.presets[j]] = [C.presets[j], C.presets[i]];
    save(); renderAllPresets();
  }
  function renderAllPresets() { renderFilters(); renderComposer(); renderPresetList(); renderStage(); }

  function categorySheet() {
    const draw = () => `<div class="group"><div class="list">${C.categories.map((c, i) => `<div class="row cat-row" data-cid="${esc(c.id)}">
          <input class="cat-emoji" type="text" value="${esc(c.emoji)}" data-k="emoji" maxlength="4" aria-label="Emoji kategori">
          <input type="text" value="${esc(c.name)}" data-k="name" placeholder="Nama kategori" aria-label="Nama kategori">
          <input type="color" value="${esc(c.color)}" data-k="color" aria-label="Warna kategori">
          <span class="p-tools">
            <button type="button" data-cmv="-1" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan">${icon(I.up, 19)}</button>
            <button type="button" data-cmv="1" ${i === C.categories.length - 1 ? 'disabled' : ''} aria-label="Turunkan">${icon(I.down, 19)}</button>
            <button type="button" class="del" data-cdel ${C.categories.length < 2 ? 'disabled' : ''} aria-label="Hapus kategori">${icon(I.minus, 19, 2.4)}</button>
          </span></div>`).join('')}
        </div><div class="group-foot">Ubah emoji, nama, warna, dan urutan. Menghapus kategori memindahkan efeknya ke kategori pertama.</div></div>
        <div class="group"><button class="btn" type="button" data-cadd>Tambah kategori</button></div>`;
    const sh = sheet({ title: 'Kategori', left: 'Selesai', html: draw(), onClose: renderAllPresets });
    const redraw = () => { sh.body.innerHTML = draw(); save(); };
    sh.body.addEventListener('input', (e) => {
      const row = e.target.closest('[data-cid]'); const k = e.target.dataset.k;
      if (!row || !k) return;
      const c = C.categories.find((x) => x.id === row.dataset.cid);
      c[k] = k === 'name' ? e.target.value : e.target.value.trim() || c[k];
      save();
    });
    sh.body.addEventListener('click', async (e) => {
      const row = e.target.closest('[data-cid]');
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-cadd')) {
        C.categories.push({ id: 'c_' + Math.random().toString(36).slice(2, 8), name: 'Kategori baru', emoji: '📁', color: '#8E8E93' });
        return redraw();
      }
      if (!row) return;
      const i = C.categories.findIndex((x) => x.id === row.dataset.cid);
      if (b.dataset.cmv) {
        const j = i + Number(b.dataset.cmv);
        [C.categories[i], C.categories[j]] = [C.categories[j], C.categories[i]];
        return redraw();
      }
      if (b.hasAttribute('data-cdel')) {
        const c = C.categories[i];
        const n = C.presets.filter((p) => p.cat === c.id).length;
        if (n && !(await ask({ title: `Hapus “${c.name}”?`, text: `${n} efek di dalamnya dipindah ke kategori lain, tidak ikut terhapus.`, ok: 'Hapus', danger: true }))) return;
        C.categories.splice(i, 1);
        C.presets.forEach((p) => { if (p.cat === c.id) p.cat = C.categories[0].id; });
        redraw();
      }
    });
  }

  /* ───────── GALERI ───────── */
  async function renderGallery() {
    let shots = [];
    try { shots = await DB.all(); } catch { /* private mode etc. */ }
    S.shotUrls.forEach((u) => URL.revokeObjectURL(u));
    S.shotUrls = shots.map((s) => URL.createObjectURL(s.blob));
    $('#gallery-count').textContent = shots.length ? `${shots.length} hasil` : '';
    $('#gallery').innerHTML = shots.length
      ? `<div class="shots">${shots.map((s, i) => `<button class="shot" type="button" data-shot="${esc(s.id)}" aria-label="Buka hasil ${i + 1}">
          <img src="${S.shotUrls[i]}" alt="" loading="lazy">${s.cmds?.length ? `<span>/${esc(s.cmds.join(' /'))}</span>` : ''}</button>`).join('')}</div>`
      : `<div class="blank"><h2>Belum ada hasil</h2><p>${C.image.autoSave ? 'Setiap foto yang kamu simpan dari Studio otomatis muncul di sini.' : 'Simpan otomatis sedang mati. Nyalakan di Setelan untuk mengisi galeri.'}</p></div>`;
    $('#gallery').onclick = (e) => {
      const id = e.target.closest('[data-shot]')?.dataset.shot;
      const i = shots.findIndex((s) => s.id === id);
      if (i >= 0) shotSheet(shots[i], S.shotUrls[i]);
    };
  }
  function shotSheet(s, url) {
    const name = fileName(s.cmds);
    const when = new Date(s.ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    const sh = sheet({
      title: s.cmds?.length ? '/' + s.cmds.join(' /') : 'Hasil',
      html: `<img class="viewer-img" src="${url}" alt="Hasil edit">
        <div class="viewer-meta">${esc(when)}${s.model && s.model !== 'editor' ? ` · <span class="mono">${esc(s.model)}</span>` : ''}</div>
        <div class="btn-grid">
          ${canShareFiles(s.blob) ? '<button class="btn btn-primary" type="button" data-a="share">Simpan / Bagikan</button><button class="btn" type="button" data-a="save">Unduh file</button>'
            : '<button class="btn btn-primary" type="button" data-a="save" style="grid-column:1/-1">Simpan file</button>'}
          <button class="btn" type="button" data-a="use">Edit lagi</button>
          <button class="btn btn-danger" type="button" data-a="del">Hapus</button>
        </div>
        ${s.prompt ? `<div class="group"><div class="group-head"><span>Prompt AI</span><button type="button" data-a="copy">Salin</button></div>
          <div class="list"><div class="kv">${esc(s.prompt)}</div></div></div>` : ''}`,
    });
    sh.body.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'save') download(s.blob, name);
      if (a === 'share') share(s.blob, name);
      if (a === 'copy') copyText(s.prompt || '');
      if (a === 'use') { sh.close(); go('studio'); selectFx(null); setSource(s.blob); }
      if (a === 'del' && await ask({ title: 'Hapus hasil ini?', ok: 'Hapus', danger: true })) { await DB.del(s.id); sh.close(); renderGallery(); }
    });
  }

  /* ───────── SETELAN ───────── */
  const fmtVal = (v, fmt) => (fmt === 'pct' ? Math.round(v * 100) + '%' : String(v));
  const R = {
    text: (label, path, o = {}) => `<label class="row"><span class="row-label">${esc(label)}</span><input type="${o.type || 'text'}" class="${o.mono ? 'mono' : ''}" data-path="${path}" value="${esc(getPath(C, path))}" placeholder="${esc(o.placeholder || '')}" ${o.list ? `list="${o.list}"` : ''} ${o.attrs || ''} autocapitalize="off" autocorrect="off" spellcheck="false"></label>`,
    select: (label, path, opts, o = {}) => `<label class="row"><span class="row-label">${esc(label)}</span><select data-path="${path}" ${o.num ? 'data-num' : ''} ${o.rerender ? 'data-rerender' : ''}>${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(getPath(C, path)) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`,
    toggle: (label, path) => `<label class="row"><span class="row-label" style="max-width:70%">${esc(label)}</span><span class="switch"><input type="checkbox" data-path="${path}" ${getPath(C, path) ? 'checked' : ''}><i></i></span></label>`,
    area: (label, path, placeholder) => `<label class="row-stack row"><span>${esc(label)}</span><textarea class="area" rows="3" data-path="${path}" placeholder="${esc(placeholder)}">${esc(getPath(C, path))}</textarea></label>`,
    range: (label, path, min, max, step, fmt) => `<label class="row"><span class="row-label">${esc(label)}</span><input type="range" data-path="${path}" data-num data-fmt="${fmt}" min="${min}" max="${max}" step="${step}" value="${esc(getPath(C, path))}"><span class="row-num">${fmtVal(getPath(C, path), fmt)}</span></label>`,
    seg: (label, path, opts) => `<div class="row"><span class="row-label">${esc(label)}</span><span class="segmented" role="group" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button type="button" data-seg="${path}" data-v="${esc(v)}" aria-pressed="${String(getPath(C, path)) === String(v)}">${esc(t)}</button>`).join('')}</span></div>`,
    btn: (label, action, cls = '') => `<button class="row row-btn ${cls}" type="button" data-act="${action}">${esc(label)}</button>`,
    group: (head, rows, foot = '') => `<div class="group">${head ? `<div class="group-head"><span>${esc(head)}</span></div>` : ''}<div class="list">${rows.join('')}</div>${foot ? `<div class="group-foot">${foot}</div>` : ''}</div>`,
  };

  function renderSettings() {
    const pv = C.ai.provider, P = DEF.providers[pv];
    const key = C.ai.keys[pv];
    const nAi = C.presets.filter((p) => p.engine === 'ai').length;
    const aiRows = [
      R.toggle(`Tampilkan ${nAi} efek AI di Studio`, 'app.showAi'),
      R.select('Penyedia', 'ai.provider', Object.entries(DEF.providers).map(([k, v]) => [k, v.label]), { rerender: true }),
      `<label class="row"><span class="row-label">API key</span><input type="password" class="mono" id="key-input" data-path="ai.keys.${pv}" value="${esc(key)}" placeholder="${esc(P.keyHint)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="eye" type="button" data-act="eye">Lihat</button></label>`,
      R.text('Model', `ai.${pv}.model`, { mono: true, list: 'model-list', placeholder: P.model }),
      R.btn('Tes koneksi & pilih model', 'models'),
      R.text('Base URL', `ai.${pv}.baseUrl`, { mono: true, type: 'url', placeholder: P.baseUrl }),
    ];
    if (pv === 'openai') aiRows.push(
      R.select('Ukuran', 'ai.openai.size', [['auto', 'Otomatis'], ['1024x1024', '1024 × 1024'], ['1024x1536', '1024 × 1536 (potret)'], ['1536x1024', '1536 × 1024 (lanskap)']]),
      R.select('Kualitas', 'ai.openai.quality', [['auto', 'Otomatis'], ['low', 'Rendah (murah)'], ['medium', 'Sedang'], ['high', 'Tinggi']]),
      R.select('Kemiripan wajah', 'ai.openai.fidelity', [['', 'Bawaan model'], ['high', 'Tinggi'], ['low', 'Rendah']]),
    );
    aiRows.push(
      R.area('Awalan prompt', 'prompt.prefix', 'Kosong'),
      R.area('Akhiran prompt', 'prompt.suffix', 'Kosong'),
      R.select('Rasio hasil AI', 'prompt.aspect', ASPECTS.map((a) => [a, a || 'Ikuti foto asli'])),
    );
    $('#settings').innerHTML =
      R.group('Foto', [
        R.select('Resolusi kerja & simpan', 'image.maxSide', [[1280, '1280 px'], [2048, '2048 px'], [3072, '3072 px'], [4096, '4096 px']], { num: true }),
        R.range('Kualitas JPEG', 'image.quality', 0.6, 1, 0.01, 'pct'),
        R.toggle('Masukkan hasil ke Galeri otomatis', 'image.autoSave'),
        R.select('Batas isi Galeri', 'image.maxHistory', [[20, '20 hasil'], [60, '60 hasil'], [120, '120 hasil'], [300, '300 hasil']], { num: true }),
      ], 'Semua pengeditan dikerjakan di perangkat ini — foto tidak dikirim ke mana pun. Resolusi baru berlaku untuk foto yang dibuka berikutnya.')
      + R.group('Tampilan', [
        R.text('Nama aplikasi', 'app.name', { placeholder: 'Slash Photo', attrs: 'maxlength="24" data-live' }),
        R.seg('Tema', 'app.theme', [['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']]),
        `<div class="swatches" role="group" aria-label="Warna aksen">${ACCENTS.map((c) => `<button class="swatch" type="button" data-accent="${c}" style="background:${c}" aria-pressed="${C.app.accent.toUpperCase() === c}" aria-label="Aksen ${c}"></button>`).join('')}
          <label class="row" style="padding:0;min-height:0;width:auto;margin-left:auto"><input type="color" data-path="app.accent" data-live value="${esc(C.app.accent)}" aria-label="Warna aksen kustom"></label></div>`,
      ])
      + R.group('Efek & kategori', [
        `<button class="row row-btn" type="button" data-act="goto-presets">Edit ${C.presets.length} efek${icon(I.chev, 16)}</button>`,
        `<button class="row row-btn" type="button" data-act="cats">Kelola ${C.categories.length} kategori${icon(I.chev, 16)}</button>`,
      ])
      + R.group('AI (opsional)', aiRows, `Hanya dipakai efek bertanda AI — yang mengubah isi foto dan tidak bisa dikerjakan editor. ${key ? '' : `Buat key di <span class="mono">${esc(P.keyUrl)}</span>. `}Key tersimpan di perangkat ini saja; saat dipakai, fotomu dikirim ke penyedia tersebut.<datalist id="model-list">${P.suggestions.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>`)
      + R.group('Cadangan', [
        R.btn('Ekspor konfigurasi (.json)', 'export'),
        R.btn('Impor konfigurasi', 'import'),
      ], 'Berisi semua efek beserta pengaturannya, kategori, dan setelan. API key tidak ikut diekspor.')
      + R.group('Reset', [
        R.btn('Reset efek & kategori ke bawaan', 'reset-presets', 'danger'),
        R.btn('Kosongkan Galeri', 'clear-gallery', 'danger'),
        R.btn('Reset semua setelan', 'reset-all', 'danger'),
      ])
      + `<div class="group-foot" style="text-align:center;padding-bottom:8px">${esc(C.app.name)} · ${C.presets.length} efek · data tersimpan di perangkat ini</div>`;
  }

  function commitField(el) {
    const path = el.dataset.path;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.hasAttribute('data-num')) v = Number(v);
    if (path === 'app.name') v = String(v).slice(0, 24);
    setPath(C, path, v);
    save();
    if (el.type === 'range') el.nextElementSibling.textContent = fmtVal(v, el.dataset.fmt);
    if (path.startsWith('app.')) applyAppearance();
    if (path === 'app.showAi') { if (!v && isAi()) selectFx(null); renderFilters(); }
    if (path === 'app.accent') $$('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.accent === String(v).toUpperCase())));
    if (el.hasAttribute('data-rerender')) renderSettings();
  }

  async function settingsAction(act) {
    if (act === 'eye') {
      const inp = $('#key-input');
      inp.type = inp.type === 'password' ? 'text' : 'password';
      $('[data-act="eye"]').textContent = inp.type === 'password' ? 'Lihat' : 'Tutup';
    }
    if (act === 'models') return modelsSheet();
    if (act === 'goto-presets') return go('presets');
    if (act === 'cats') return categorySheet();
    if (act === 'export') {
      const out = clone(C);
      out.ai.keys = { gemini: '', openai: '', openrouter: '' };
      download(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), 'slash-photo-config');
      toast('Konfigurasi diekspor');
    }
    if (act === 'import') $('#file-import').click();
    if (act === 'reset-presets' && await ask({ title: 'Reset efek & kategori?', text: 'Semua efek buatanmu dan perubahan pada efek bawaan akan hilang.', ok: 'Reset', danger: true })) {
      C.presets = clone(DEF.config.presets); C.categories = clone(DEF.config.categories);
      save(); selectFx(null); renderAll(); queueThumbs(); toast('100 efek bawaan dipulihkan');
    }
    if (act === 'clear-gallery' && await ask({ title: 'Kosongkan Galeri?', text: 'Semua hasil di perangkat ini dihapus permanen.', ok: 'Hapus semua', danger: true })) {
      try { await DB.clear(); toast('Galeri dikosongkan'); } catch { toast('Galeri tidak bisa diakses'); }
    }
    if (act === 'reset-all' && await ask({ title: 'Reset semua setelan?', text: 'Efek, kategori, tampilan, dan API key kembali ke awal. Galeri tidak ikut terhapus.', ok: 'Reset', danger: true })) {
      C = clone(DEF.config); save(); selectFx(null); renderAll(); queueThumbs(); toast('Semua setelan direset');
    }
  }

  async function modelsSheet() {
    const pv = C.ai.provider, key = (C.ai.keys[pv] || '').trim();
    if (!key && pv !== 'openrouter') return toast('Isi API key dulu');
    const sh = sheet({ title: 'Model gambar', html: '<div class="group-foot" style="font-size:15px;padding:18px 4px">Menghubungi penyedia…</div>' });
    try {
      const list = await PROVIDERS[pv].models({ key, cfg: C.ai[pv] });
      if (!list.length) throw new Error('Terhubung, tapi tidak ada model gambar di akun ini.');
      sh.body.innerHTML = R.group('Terhubung — pilih model', list.map((m) => `<button class="row" type="button" data-model="${esc(m)}"><span class="mono" style="font-size:15px;overflow-wrap:anywhere">${esc(m)}</span>${m === C.ai[pv].model ? '<span class="row-value" style="color:var(--accent-ink)">✓</span>' : ''}</button>`), 'Daftar ini diambil langsung dari akunmu, jadi selalu yang terbaru.');
      sh.body.onclick = (e) => {
        const m = e.target.closest('[data-model]')?.dataset.model;
        if (!m) return;
        C.ai[pv].model = m; save(); renderSettings(); sh.close(); toast(`Model: ${m}`);
      };
    } catch (e) {
      sh.body.innerHTML = `<div class="error" role="alert"><div class="error-msg"><b>Koneksi gagal.</b> ${esc(e.message)}</div></div>`;
    }
  }

  async function importConfig(file) {
    try {
      const j = JSON.parse(await file.text());
      if (!isObj(j) || !Array.isArray(j.presets) || !Array.isArray(j.categories)) throw new Error('bad');
      const cats = j.categories.filter((c) => isObj(c) && c.id && c.name).map((c) => ({ id: String(c.id), name: String(c.name), emoji: String(c.emoji || '📁'), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#8E8E93' }));
      if (!cats.length) throw new Error('bad');
      const seen = new Set();
      const presets = j.presets.filter((p) => isObj(p) && normCmd(p.cmd) && !seen.has(normCmd(p.cmd)) && seen.add(normCmd(p.cmd))).map((p) => normPreset({
        id: String(p.id || uid()), cmd: normCmd(p.cmd), name: String(p.name || p.cmd), prompt: String(p.prompt || ''),
        cat: cats.some((c) => c.id === p.cat) ? p.cat : cats[0].id, engine: p.engine, recipe: p.recipe,
        aspect: ASPECTS.includes(p.aspect) ? p.aspect : '', fav: !!p.fav, hidden: !!p.hidden, builtin: !!p.builtin,
      }));
      const keys = C.ai.keys;
      C = merge(clone(DEF.config), { ...j, categories: cats, presets });
      C.ai.keys = { ...clone(DEF.config.ai.keys), ...keys };
      if (!DEF.providers[C.ai.provider]) C.ai.provider = 'gemini';
      save(); selectFx(null); renderAll(); queueThumbs();
      toast(`Diimpor: ${presets.length} efek, ${cats.length} kategori`);
    } catch { toast('File konfigurasi tidak valid'); }
  }

  /* ───────── navigation ───────── */
  function go(tab) {
    S.scroll[S.tab] = window.scrollY;
    S.tab = tab;
    $$('.view').forEach((v) => (v.hidden = v.dataset.view !== tab));
    $$('#tabbar button').forEach((b) => (b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    if (tab === 'gallery') renderGallery();
    if (tab === 'settings') renderSettings();
    if (tab === 'presets') renderPresetList();
    window.scrollTo(0, tab === 'studio' ? 0 : S.scroll[tab] || 0);
  }
  function renderAll() {
    applyAppearance(); renderStage(); renderFilters(); renderComposer(); renderAdj(); renderPresetList();
    if (S.tab === 'settings') renderSettings();
  }

  /* ───────── events ───────── */
  $('#tabbar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]')?.dataset.tab;
    if (!t) return;
    if (t === S.tab) window.scrollTo({ top: 0, behavior: 'smooth' }); else go(t);
  });

  $('#view-studio').addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'lib' || a === 'change') $('#file-lib').click();
    if (a === 'cam') $('#file-cam').click();
    if (a === 'cancel') S.abort?.abort();
    if (a === 'show-src' || a === 'show-out') { S.show = a === 'show-src' ? 'src' : 'out'; renderStage(); requestDraw(); }
    if (a === 'undo' && S.undo) { S.src = S.undo; S.undo = null; renderStage(); requestDraw(); queueThumbs(); toast('Kembali ke foto sebelum AI'); }
    if (a === 'retry') generate();
    if (a === 'dismiss') { S.error = null; renderStage(); }
    if (a === 'open-settings') go('settings');
    if (a === 'save-fx') {
      const p = curFx();
      p.recipe = currentRecipe(); p.engine = 'local';
      save(); selectFx(p.id); queueThumbs(p.id); renderPresetList();
      toast(`Tersimpan ke /${p.cmd}`);
    }
    if (a === 'save-new') presetSheet(null, { recipe: currentRecipe(), cat: curFx()?.cat || C.categories[0].id, name: curFx() ? curFx().name + ' (versiku)' : '' });
    if (a === 'revert') selectFx(S.fx);
    const mode = e.target.closest('[data-mode]')?.dataset.mode;
    if (mode) setMode(mode);
    const f = e.target.closest('[data-f]')?.dataset.f;
    if (f) { S.filter = f; renderFilters(); $('#strip').scrollLeft = 0; }
    const g = e.target.closest('[data-g]')?.dataset.g;
    if (g) { S.group = g; renderAdj(); $('#adj-list').scrollTop = 0; }
    const zero = e.target.closest('[data-zero]')?.dataset.zero;
    if (zero) { S.adj[zero] = FX.BY_KEY[zero].d; renderAdj(); renderStage(); requestDraw(); }
    const fx = e.target.closest('.fx');
    if (fx) selectFx(fx.dataset.id === S.fx ? null : fx.dataset.id || null);
  });
  $('#adj-list').addEventListener('input', onAdjInput);
  $('#adj-list').addEventListener('change', (e) => { onAdjInput(e); renderStage(); renderAdj(); });
  $('#btn-save').addEventListener('click', exportImage);
  $('#btn-reset').addEventListener('click', resetAll);

  for (const id of ['#file-lib', '#file-cam']) {
    $(id).addEventListener('change', (e) => { if (e.target.files[0]) setSource(e.target.files[0]); e.target.value = ''; });
  }
  $('#file-import').addEventListener('change', (e) => { if (e.target.files[0]) importConfig(e.target.files[0]); e.target.value = ''; });

  // desktop niceties: drop & paste
  const stage = $('#stage');
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dragover'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dragover'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault(); stage.classList.remove('dragover');
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
    if (f) setSource(f);
  });
  document.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f && S.tab === 'studio') setSource(f);
  });

  const cmdInput = $('#cmd-input');
  cmdInput.addEventListener('input', () => { S.override = null; S.sugIndex = 0; renderSuggest(); renderComposer(); });
  cmdInput.addEventListener('keydown', (e) => {
    const box = $('#suggest'), open = !box.hidden;
    const items = $$('button', box);
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      S.sugIndex = (S.sugIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      renderSuggest();
    } else if (open && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault(); acceptSuggest(items[S.sugIndex].dataset.id);
    } else if (e.key === 'Escape') closeSuggest();
    else if (e.key === 'Enter') { e.preventDefault(); if (isAi()) generate(); else cmdInput.blur(); }
  });
  $('#suggest').addEventListener('pointerdown', (e) => {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id) { e.preventDefault(); acceptSuggest(id); }
  });
  cmdInput.addEventListener('blur', () => setTimeout(closeSuggest, 120));
  $('#btn-go').addEventListener('click', generate);
  $('#btn-prompt').addEventListener('click', promptSheet);

  // Efek tab
  $('#preset-search').addEventListener('input', (e) => { S.query = e.target.value; renderPresetList(); });
  $('#btn-add-preset').addEventListener('click', () => presetSheet());
  $('#btn-reorder').addEventListener('click', () => { S.reorder = !S.reorder; renderPresetList(); });
  $('#preset-list').addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('#btn-cats')) return categorySheet();
    const fav = t.closest('[data-fav]')?.dataset.fav;
    if (fav) { const p = presetById(fav); p.fav = !p.fav; save(); return renderAllPresets(); }
    const mv = t.closest('[data-mv]');
    if (mv) return movePreset(mv.dataset.id, Number(mv.dataset.mv));
    const del = t.closest('[data-del]')?.dataset.del;
    if (del) return confirmDelete(presetById(del));
    const ed = t.closest('[data-edit]')?.dataset.edit;
    if (ed) presetSheet(ed);
  });

  // Setelan tab
  const st = $('#settings');
  st.addEventListener('change', (e) => { if (e.target.dataset.path) commitField(e.target); });
  st.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.path) return;
    if (el.type === 'range' || el.hasAttribute('data-live') || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox')) commitField(el);
  });
  st.addEventListener('click', (e) => {
    const seg = e.target.closest('[data-seg]');
    if (seg) { setPath(C, seg.dataset.seg, seg.dataset.v); save(); applyAppearance(); renderSettings(); return; }
    const acc = e.target.closest('[data-accent]')?.dataset.accent;
    if (acc) { C.app.accent = acc; save(); applyAppearance(); renderSettings(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) settingsAction(act);
  });

  // keep the layout above the on-screen keyboard (iOS doesn't resize the page for it)
  const vv = window.visualViewport;
  if (vv) {
    const onVV = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const open = kb > 80;
      document.documentElement.style.setProperty('--kb', open ? kb + 'px' : '0px');
      document.documentElement.style.setProperty('--vh', open ? vv.height + 'px' : '100dvh');
      document.body.classList.toggle('kb-open', open);
      if (open && S.tab === 'studio') window.scrollTo(0, 0);
    };
    vv.addEventListener('resize', onVV);
    vv.addEventListener('scroll', onVV);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const top = $('#layer').lastElementChild;
    (top?.querySelector('.sheet-head .l') || top?.querySelector('[data-v="0"]'))?.click();
  });

  /* ───────── boot ───────── */
  if (HOSTED) window.claude.use('downloads').catch(() => null);   // warm up so Save answers within the tap
  renderAll();
  go('studio');
  window.__slash = { get config() { return C; }, state: S }; // handy for debugging in the console
})();
