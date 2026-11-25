/* Slash Photo — app logic. No build step, no dependencies. */
(() => {
  'use strict';

  const DEF = window.SLASH_DEFAULTS;
  const LS_KEY = 'slashphoto.config.v1';
  const ASPECTS = ['', '1:1', '4:5', '3:4', '2:3', '9:16', '5:4', '4:3', '3:2', '16:9', '21:9'];
  const ACCENTS = ['#FFD60A', '#FF9F0A', '#FF453A', '#FF375F', '#BF5AF2', '#0A84FF', '#64D2FF', '#30D158', '#FFFFFF'];

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
    for (const k of Object.keys(over)) {
      out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
    }
    return out;
  };
  const normCmd = (s) => String(s || '').toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9_-]/g, '');
  const icon = (d, size = 20, sw = 1.9) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const I = {
    x: 'M7 7l10 10M17 7 7 17',
    save: 'M12 4v11M7.5 10.5 12 15l4.5-4.500M5 19h14',
    share: 'M12 15V4M8 7.5 12 3.500l4 4M6 11H5.500A1.5 1.5 0 0 0 4 12.500v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.500v-6a1.5 1.5 0 0 0-1.5-1.500H18',
    chain: 'M4 12h13M12 6.5 17.5 12 12 17.500M20 5v14',
    redo: 'M19 5v5h-5M19 10a7.5 7.5 0 1 0 1.3 5',
    up: 'M12 18V6M7 11l5-5 5 5',
    down: 'M12 6v12M7 13l5 5 5-5',
    minus: 'M7 12h10',
    chev: 'm9 6 6 6-6 6',
    cam: 'M4 8.500A2.5 2.5 0 0 1 6.5 6h1.700l1.3-2h5l1.3 2h1.700A2.5 2.5 0 0 1 20 8.500v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.500zM12 15.500a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    lib: 'M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4.5 16l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5',
  };

  /* ───────── config ───────── */
  let C = load();
  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { /* corrupted → defaults */ }
    const c = merge(clone(DEF.config), saved);
    if (!Array.isArray(c.categories) || !c.categories.length) c.categories = clone(DEF.config.categories);
    if (!Array.isArray(c.presets)) c.presets = clone(DEF.config.presets);
    if (!DEF.providers[c.ai.provider]) c.ai.provider = 'gemini';
    return c;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(C)); }
    catch { toast('Penyimpanan penuh — perubahan belum tersimpan'); }
  }
  const catById = (id) => C.categories.find((c) => c.id === id) || C.categories[0];
  const presetById = (id) => C.presets.find((p) => p.id === id);
  const visiblePresets = () => C.presets.filter((p) => !p.hidden);

  /* ───────── session state ───────── */
  const S = {
    tab: 'studio',
    src: null,          // { blob, url }
    out: null,          // { blob, url, prompt, cmds }
    show: 'out',
    sel: [],            // preset ids, in order
    override: null,     // manually edited final prompt for the next run
    filter: 'all',
    busy: false,
    abort: null,
    timer: null,
    error: null,
    query: '',
    reorder: false,
    sugIndex: 0,
    scroll: {},
    shotUrls: [],
  };

  /* ───────── appearance ───────── */
  const mqLight = window.matchMedia('(prefers-color-scheme: light)');
  function applyAppearance() {
    const root = document.documentElement;
    const theme = C.app.theme === 'auto' ? (mqLight.matches ? 'light' : 'dark') : C.app.theme;
    root.dataset.theme = theme;
    root.dataset.cols = String(C.app.columns);
    const accent = /^#[0-9a-f]{6}$/i.test(C.app.accent) ? C.app.accent : '#FFD60A';
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--cols', C.app.columns);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    root.style.setProperty('--on-accent', lum > 0.6 ? '#000' : '#fff');
    // a white accent can't be used as text on a light background — fall back to label colour
    if (theme === 'light' && lum > 0.9) root.style.setProperty('--accent-ink', '#000');
    else if (theme === 'dark' && lum < 0.12) root.style.setProperty('--accent-ink', '#fff');
    else root.style.removeProperty('--accent-ink');
    $('meta[name="theme-color"]').content = theme === 'light' ? '#F2F2F7' : '#000000';
    const name = C.app.name || 'Slash Photo';
    document.title = name;
    $$('[data-app-name]').forEach((el) => (el.textContent = name));
    const ai = C.ai;
    $('#engine-pill').textContent = ai.keys[ai.provider] ? ai[ai.provider].model : 'tanpa API key';
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
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    $('.l', wrap).addEventListener('click', close);
    if (right) $('.r', wrap).addEventListener('click', () => onRight?.(api));
    const api = { el: wrap, body: $('.sheet-body', wrap), close };
    $('#layer').append(wrap);
    return api;
  }

  /* ───────── image prep ───────── */
  async function prepareImage(file) {
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
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, (Number(C.image.maxSide) || 1536) / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', Number(C.image.quality) || 0.9));
    if (!blob) throw new Error('Gagal memproses foto');
    return blob;
  }
  const blobToDataUrl = (blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error('Gagal membaca gambar'));
    fr.readAsDataURL(blob);
  });
  const dataUrlToBlob = async (u) => (await fetch(u)).blob();

  function setSource(blob) {
    if (S.src) URL.revokeObjectURL(S.src.url);
    if (S.out) URL.revokeObjectURL(S.out.url);
    S.src = { blob, url: URL.createObjectURL(blob) };
    S.out = null; S.error = null; S.show = 'out';
    renderStage(); renderComposer();
  }
  async function onPick(file) {
    if (!file) return;
    try { setSource(await prepareImage(file)); }
    catch (e) { toast(e.message || 'Gagal membuka foto'); }
  }

  /* ───────── prompt building ───────── */
  const selPresets = () => S.sel.map(presetById).filter(Boolean);
  function buildPrompt() {
    const ps = selPresets();
    const extra = $('#cmd-input').value.replace(/(^|\s)\/\S*$/, '').trim();
    let core = '';
    if (ps.length === 1) core = ps[0].prompt;
    else if (ps.length > 1) core = 'Apply all of the following edits together in one image:\n' + ps.map((p, i) => `${i + 1}. ${p.prompt}`).join('\n');
    return [C.prompt.prefix, core, extra, core || extra ? C.prompt.suffix : ''].map((s) => (s || '').trim()).filter(Boolean).join('\n\n');
  }
  const finalPrompt = () => (S.override != null ? S.override.trim() : buildPrompt());
  const hasPrompt = () => (S.override != null ? !!S.override.trim() : !!(selPresets().length || $('#cmd-input').value.replace(/(^|\s)\/\S*$/, '').trim()));
  const pickAspect = () => selPresets().find((p) => p.aspect)?.aspect || C.prompt.aspect || '';

  /* ───────── AI providers ───────── */
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

  /* ───────── generate ───────── */
  async function generate() {
    if (S.busy) return;
    if (!S.src) { toast('Pilih foto dulu'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!hasPrompt()) { toast('Pilih efek atau tulis instruksi'); return; }
    const ai = C.ai, key = (ai.keys[ai.provider] || '').trim();
    if (!key) return noKeySheet();

    const prompt = finalPrompt();
    const cmds = S.override != null && !S.sel.length ? [] : selPresets().map((p) => p.cmd);
    S.busy = true; S.error = null; S.abort = new AbortController();
    const t0 = Date.now();
    $('#cmd-input').blur(); closeSuggest();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderStage(); renderComposer();
    S.timer = setInterval(() => {
      const el = $('.busy-time');
      if (el) el.textContent = `${Math.round((Date.now() - t0) / 1000)} dtk · ${ai[ai.provider].model}`;
    }, 500);
    try {
      const blob = await PROVIDERS[ai.provider].edit({ key, cfg: ai[ai.provider], prompt, blob: S.src.blob, aspect: pickAspect(), signal: S.abort.signal });
      if (!blob || !/^image\//.test(blob.type)) throw new Error('Respons bukan gambar.');
      if (S.out) URL.revokeObjectURL(S.out.url);
      S.out = { blob, url: URL.createObjectURL(blob), prompt, cmds };
      S.show = 'out';
      if (C.image.autoSave) {
        try { await DB.add({ id: Date.now() + '-' + uid(), ts: Date.now(), blob, prompt, cmds, model: ai[ai.provider].model }); await DB.trim(Number(C.image.maxHistory) || 60); }
        catch { toast('Hasil jadi, tapi gagal disimpan ke Galeri'); }
      }
    } catch (e) {
      if (e.name !== 'AbortError') S.error = e.message || String(e);
    } finally {
      clearInterval(S.timer);
      S.busy = false; S.abort = null;
      renderStage(); renderComposer();
    }
  }

  function noKeySheet() {
    const p = DEF.providers[C.ai.provider];
    const sh = sheet({
      title: 'Belum ada API key',
      html: `<div class="group"><div class="group-foot" style="padding-top:0;font-size:15px;color:var(--label)">
          Untuk membuat gambar langsung di sini, masukkan API key ${esc(p.label)} di Setelan. Key hanya disimpan di perangkat ini dan dikirim langsung ke penyedia AI.
        </div></div>
        <div class="group"><button class="btn btn-primary" data-a="settings" type="button">Buka Setelan</button></div>
        <div class="group"><button class="btn" data-a="copy" type="button">Salin prompt saja</button>
          <div class="group-foot">Tanpa key, salin prompt-nya lalu tempel bersama fotomu di aplikasi AI apa pun.</div></div>`,
    });
    sh.body.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'settings') { sh.close(); go('settings'); }
      if (a === 'copy') { copyText(finalPrompt()); sh.close(); }
    });
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('Prompt disalin'); }
    catch {
      const ta = Object.assign(document.createElement('textarea'), { value: t });
      document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      toast(ok ? 'Prompt disalin' : 'Gagal menyalin');
    }
  }

  /* ───────── save / share ───────── */
  const fileName = (cmds) => `${(C.app.name || 'slash').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(cmds?.[0] || 'edit')}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;
  const extOf = (blob) => (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.${extOf(blob)}`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function share(blob, name, text) {
    const file = new File([blob], `${name}.${extOf(blob)}`, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); } catch { /* user cancelled */ }
    } else download(blob, name);
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
        <p>Lalu pilih perintah di bawah — atau ketik sendiri.</p>
        <div class="empty-btns">
          <button class="btn btn-primary" type="button" data-a="lib">${icon(I.lib)} Pilih dari Galeri</button>
          <button class="btn" type="button" data-a="cam">${icon(I.cam)} Ambil Foto</button>
        </div>
      </div>`;
    } else {
      const showOut = S.out && S.show === 'out';
      st.innerHTML = `<img src="${showOut ? S.out.url : S.src.url}" alt="${showOut ? 'Hasil edit' : 'Foto sumber'}" draggable="false">
        ${S.out ? `<div class="seg-ba" role="group" aria-label="Bandingkan">
            <button type="button" data-a="show-src" aria-pressed="${!showOut}">Sebelum</button>
            <button type="button" data-a="show-out" aria-pressed="${showOut}">Sesudah</button></div>` : ''}
        ${S.busy ? '' : `<button class="stage-chip right" type="button" data-a="change">Ganti foto</button>`}
        ${S.busy ? `<div class="busy" role="status">
            <div class="busy-cmd">${esc(selPresets().map((p) => '/' + p.cmd).join(' ') || 'Instruksi kustom')}</div>
            <div class="busy-time">0 dtk · ${esc(C.ai[C.ai.provider].model)}</div>
            <button class="btn btn-sm" type="button" data-a="cancel">Batal</button></div>` : ''}`;
    }
    $('#stage-actions').innerHTML = S.out && !S.busy ? `
      <button class="act" type="button" data-a="save">${icon(I.save, 22)}Simpan</button>
      <button class="act" type="button" data-a="share">${icon(I.share, 22)}Bagikan</button>
      <button class="act" type="button" data-a="chain">${icon(I.chain, 22)}Lanjut edit</button>
      <button class="act" type="button" data-a="redo">${icon(I.redo, 22)}Ulangi</button>` : '';
    const keyIssue = S.error && /\b(401|403)\b|api.?key|unauth|permission/i.test(S.error);
    const modelIssue = S.error && /\b404\b|not found|model/i.test(S.error);
    $('#stage-error').innerHTML = S.error ? `<div class="error" role="alert">
      <div><b>Gagal membuat gambar</b></div><div class="error-msg">${esc(S.error)}</div>
      <div class="error-row">
        <button class="btn btn-sm" type="button" data-a="redo">Coba lagi</button>
        ${keyIssue || modelIssue ? '<button class="btn btn-sm" type="button" data-a="open-settings">Cek Setelan</button>' : ''}
      </div></div>` : '';
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
  }

  function renderGrid() {
    let list = visiblePresets();
    if (S.filter === 'fav') list = list.filter((p) => p.fav);
    else if (S.filter !== 'all') list = list.filter((p) => p.cat === S.filter);
    $('#grid').innerHTML = list.length ? list.map((p) => {
      const c = catById(p.cat);
      const n = S.sel.indexOf(p.id);
      return `<button class="tile" type="button" data-id="${esc(p.id)}" aria-pressed="${n >= 0}">
        <span class="tile-top"><span class="tile-emoji" aria-hidden="true">${esc(c.emoji)}</span>
          ${n >= 0 ? `<span class="tile-badge">${S.sel.length > 1 ? n + 1 : '✓'}</span>` : p.fav ? '<span class="tile-fav" aria-label="Favorit">★</span>' : `<span class="tile-dot" style="background:${esc(c.color)}"></span>`}</span>
        <span class="tile-cmd">/${esc(p.cmd)}</span>
        <span class="tile-name">${esc(p.name)}</span>
        <span class="tile-desc">${esc(p.prompt)}</span>
      </button>`;
    }).join('') : '<div class="grid-empty">Belum ada efek di sini. Tambahkan dari tab Efek.</div>';
  }

  function renderComposer() {
    S.sel = S.sel.filter((id) => { const p = presetById(id); return p && !p.hidden; });
    const ps = selPresets();
    const sel = $('#sel');
    sel.hidden = !ps.length && S.override == null;
    sel.innerHTML = ps.map((p) => `<button class="sel-chip" type="button" data-rm="${esc(p.id)}" aria-label="Hapus /${esc(p.cmd)}">/${esc(p.cmd)}${icon(I.x, 15, 2.4)}</button>`).join('')
      + (S.override != null ? '<button class="sel-chip" type="button" data-rm="override" aria-label="Buang prompt manual">prompt manual' + icon(I.x, 15, 2.4) + '</button>' : '')
      + (ps.length > 1 ? `<span class="sel-note">${ps.length}/${C.prompt.maxStack} digabung</span>` : '');
    $('#btn-go').setAttribute('aria-disabled', String(S.busy || !S.src || !hasPrompt()));
    $('#btn-prompt').classList.toggle('on', S.override != null);
  }

  function toggleSel(id) {
    const i = S.sel.indexOf(id);
    if (i >= 0) S.sel.splice(i, 1);
    else {
      const max = Math.max(1, Number(C.prompt.maxStack) || 1);
      if (max === 1) S.sel = [id];
      else if (S.sel.length >= max) return toast(`Maksimal ${max} efek sekaligus — ubah di Setelan`);
      else S.sel.push(id);
    }
    S.override = null;
    renderGrid(); renderComposer();
  }

  /* slash autocomplete */
  function currentToken() { return $('#cmd-input').value.match(/(?:^|\s)\/(\S*)$/)?.[1]; }
  function renderSuggest() {
    const tok = currentToken();
    const box = $('#suggest');
    if (tok == null) return closeSuggest();
    const q = normCmd(tok);
    const pool = visiblePresets().filter((p) => !S.sel.includes(p.id));
    const hits = [...pool.filter((p) => p.cmd.startsWith(q)), ...pool.filter((p) => !p.cmd.startsWith(q) && (p.cmd.includes(q) || p.name.toLowerCase().includes(q)))].slice(0, 6);
    if (!hits.length) return closeSuggest();
    S.sugIndex = Math.min(S.sugIndex, hits.length - 1);
    box.hidden = false;
    box.innerHTML = hits.map((p, i) => `<button type="button" data-id="${esc(p.id)}" class="${i === S.sugIndex ? 'active' : ''}"><span class="s-cmd">/${esc(p.cmd)}</span><span class="s-name">${esc(p.name)}</span></button>`).join('');
  }
  function closeSuggest() { $('#suggest').hidden = true; S.sugIndex = 0; }
  function acceptSuggest(id) {
    const inp = $('#cmd-input');
    inp.value = inp.value.replace(/(^|\s)\/\S*$/, '$1');
    closeSuggest();
    if (!S.sel.includes(id)) toggleSel(id);
    inp.focus();
  }

  function promptSheet() {
    const ai = C.ai;
    const sh = sheet({
      title: 'Prompt akhir',
      left: 'Batal',
      right: 'Pakai',
      html: `<div class="group"><div class="list"><div class="row-stack">
            <textarea class="area mono" id="pf" rows="11" aria-label="Prompt akhir" spellcheck="false">${esc(finalPrompt())}</textarea>
          </div></div>
          <div class="group-foot">Ini teks yang dikirim ke <span class="mono">${esc(ai[ai.provider].model)}</span> bersama fotomu. Edit sesukamu — berlaku untuk generate berikutnya saja.</div></div>
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

  /* ───────── EFEK tab ───────── */
  function renderPresetList() {
    const q = S.query.trim().toLowerCase();
    const match = (p) => !q || p.cmd.includes(normCmd(q) || '\u0000') || p.name.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q);
    let html = '';
    for (const c of C.categories) {
      const all = C.presets.filter((p) => p.cat === c.id);
      const list = all.filter(match);
      if (q && !list.length) continue;
      html += `<div class="group"><div class="group-head"><span>${esc(c.emoji)} ${esc(c.name)} · ${all.length}</span></div>
        <div class="list">${list.length ? list.map((p) => {
          const i = all.indexOf(p);
          return `<div class="row p-row ${p.hidden ? 'is-hidden' : ''}">
            <button class="p-emoji" type="button" data-edit="${esc(p.id)}" style="background:color-mix(in srgb, ${esc(c.color)} 22%, transparent)" tabindex="-1" aria-hidden="true">${esc(c.emoji)}</button>
            <button class="p-main" type="button" data-edit="${esc(p.id)}" style="text-align:left">
              <span class="p-cmd">/${esc(p.cmd)}</span><span class="p-sub">${esc(p.name)} — ${esc(p.prompt)}</span></button>
            ${p.hidden ? '<span class="tag">Tersembunyi</span>' : ''}
            ${S.reorder ? `<span class="p-tools">
                <button type="button" data-mv="-1" data-id="${esc(p.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan">${icon(I.up, 19)}</button>
                <button type="button" data-mv="1" data-id="${esc(p.id)}" ${i === all.length - 1 ? 'disabled' : ''} aria-label="Turunkan">${icon(I.down, 19)}</button>
                <button type="button" class="del" data-del="${esc(p.id)}" aria-label="Hapus /${esc(p.cmd)}">${icon(I.minus, 19, 2.4)}</button></span>`
              : `<button class="p-star" type="button" data-fav="${esc(p.id)}" aria-pressed="${!!p.fav}" aria-label="Favorit">${p.fav ? '★' : '☆'}</button>`}
          </div>`;
        }).join('') : '<div class="row" style="color:var(--label-2)">Kategori ini masih kosong</div>'}</div></div>`;
    }
    if (!html) html = `<div class="blank" style="padding-top:8vh"><h2>Tidak ketemu</h2><p>Tidak ada efek yang cocok dengan “${esc(S.query)}”.</p></div>`;
    else if (!q) html += `<div class="group"><div class="list">
        <button class="row row-btn" type="button" id="btn-cats">Kelola kategori<span class="row-value">${C.categories.length}</span>${icon(I.chev, 16)}</button>
      </div><div class="group-foot">${C.presets.length} efek. Ketuk untuk mengedit perintah, nama, prompt, kategori, dan rasio.</div></div>`;
    $('#preset-list').innerHTML = html;
    $('#btn-reorder').textContent = S.reorder ? 'Selesai' : 'Atur';
  }

  const aspectOptions = (val, autoLabel) => ASPECTS.map((a) => `<option value="${a}" ${a === val ? 'selected' : ''}>${a || autoLabel}</option>`).join('');

  function presetSheet(id) {
    const isNew = !id;
    const p = isNew ? { id: uid(), cmd: '', name: '', prompt: '', cat: S.filter !== 'all' && S.filter !== 'fav' ? S.filter : C.categories[0].id, aspect: '', fav: false, hidden: false } : presetById(id);
    if (!p) return;
    const orig = DEF.config.presets.find((d) => d.id === p.id);
    const changed = orig && ['cmd', 'name', 'prompt', 'cat', 'aspect'].some((k) => orig[k] !== p[k]);
    const sh = sheet({
      title: isNew ? 'Efek baru' : '/' + p.cmd,
      left: 'Batal',
      right: 'Simpan',
      html: `<div class="group"><div class="list">
          <label class="row"><span class="row-label">Perintah</span><input class="mono" type="text" id="f-cmd" value="${esc(p.cmd ? '/' + p.cmd : '')}" placeholder="/namaefek" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
          <label class="row"><span class="row-label">Nama</span><input type="text" id="f-name" value="${esc(p.name)}" placeholder="Nama tampilan"></label>
          <label class="row"><span class="row-label">Kategori</span><select id="f-cat">${C.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === p.cat ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}</select></label>
          <label class="row"><span class="row-label">Rasio hasil</span><select id="f-aspect">${aspectOptions(p.aspect, 'Ikuti setelan')}</select></label>
        </div></div>
        <div class="group"><div class="group-head"><span>Prompt</span></div><div class="list"><div class="row-stack">
          <textarea class="area" id="f-prompt" rows="6" placeholder="Jelaskan perubahan yang diminta ke AI. Bahasa Inggris biasanya paling akurat." aria-label="Prompt">${esc(p.prompt)}</textarea>
        </div></div></div>
        <div class="group"><div class="list">
          <label class="row"><span class="row-label">Favorit</span><span class="switch"><input type="checkbox" id="f-fav" ${p.fav ? 'checked' : ''}><i></i></span></label>
          <label class="row"><span class="row-label">Sembunyikan dari Studio</span><span class="switch"><input type="checkbox" id="f-hidden" ${p.hidden ? 'checked' : ''}><i></i></span></label>
        </div></div>
        ${isNew ? '' : `<div class="group"><div class="list">
          <button class="row row-btn" type="button" data-a="dup">Duplikat</button>
          ${changed ? '<button class="row row-btn" type="button" data-a="restore">Kembalikan ke bawaan</button>' : ''}
          <button class="row row-btn danger" type="button" data-a="del">Hapus efek</button>
        </div></div>`}`,
      onRight: (api) => {
        const cmd = normCmd($('#f-cmd', api.body).value);
        const prompt = $('#f-prompt', api.body).value.trim();
        if (!cmd) return toast('Perintah wajib diisi (huruf/angka tanpa spasi)');
        if (!prompt) return toast('Prompt wajib diisi');
        if (C.presets.some((x) => x.cmd === cmd && x.id !== p.id)) return toast(`/${cmd} sudah dipakai efek lain`);
        Object.assign(p, {
          cmd, prompt,
          name: $('#f-name', api.body).value.trim() || cmd,
          cat: $('#f-cat', api.body).value,
          aspect: $('#f-aspect', api.body).value,
          fav: $('#f-fav', api.body).checked,
          hidden: $('#f-hidden', api.body).checked,
        });
        if (isNew) C.presets.push(p);
        save(); renderAllPresets(); api.close();
        toast(isNew ? `/${cmd} ditambahkan` : 'Tersimpan');
      },
    });
    sh.body.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'dup') {
        let cmd = p.cmd + '2', n = 2;
        while (C.presets.some((x) => x.cmd === cmd)) cmd = p.cmd + ++n;
        const copy = { ...clone(p), id: uid(), cmd, name: p.name + ' (salinan)', builtin: false };
        C.presets.splice(C.presets.indexOf(p) + 1, 0, copy);
        save(); renderAllPresets(); sh.close(); presetSheet(copy.id);
      }
      if (a === 'restore') {
        Object.assign(p, clone(orig), { fav: p.fav, hidden: p.hidden });
        save(); renderAllPresets(); sh.close(); toast('Dikembalikan ke bawaan');
      }
      if (a === 'del' && await confirmDelete(p)) sh.close();
    });
    if (isNew) setTimeout(() => $('#f-cmd', sh.body)?.focus(), 350);
  }
  async function confirmDelete(p) {
    if (!(await ask({ title: `Hapus /${p.cmd}?`, text: 'Efek ini dihapus dari daftar. Efek bawaan bisa dipulihkan lewat Setelan → Reset efek.', ok: 'Hapus', danger: true }))) return false;
    C.presets = C.presets.filter((x) => x.id !== p.id);
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
  function renderAllPresets() { renderFilters(); renderGrid(); renderComposer(); renderPresetList(); }

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
      : `<div class="blank"><h2>Belum ada hasil</h2><p>${C.image.autoSave ? 'Setiap gambar yang kamu buat di Studio otomatis muncul di sini.' : 'Simpan otomatis sedang mati. Nyalakan di Setelan untuk mengisi galeri.'}</p></div>`;
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
        <div class="viewer-meta">${esc(when)} · <span class="mono">${esc(s.model || '')}</span></div>
        <div class="btn-grid">
          <button class="btn btn-primary" type="button" data-a="save">Simpan</button>
          <button class="btn" type="button" data-a="share">Bagikan</button>
          <button class="btn" type="button" data-a="use">Edit lagi</button>
          <button class="btn btn-danger" type="button" data-a="del">Hapus</button>
        </div>
        <div class="group"><div class="group-head"><span>Prompt</span><button type="button" data-a="copy">Salin</button></div>
          <div class="list"><div class="kv">${esc(s.prompt || '')}</div></div></div>`,
    });
    sh.body.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'save') download(s.blob, name);
      if (a === 'share') share(s.blob, name);
      if (a === 'copy') copyText(s.prompt || '');
      if (a === 'use') { setSource(s.blob); sh.close(); go('studio'); }
      if (a === 'del' && await ask({ title: 'Hapus hasil ini?', ok: 'Hapus', danger: true })) { await DB.del(s.id); sh.close(); renderGallery(); }
    });
  }

  /* ───────── SETELAN ───────── */
  const R = {
    text: (label, path, o = {}) => `<label class="row"><span class="row-label">${esc(label)}</span><input type="${o.type || 'text'}" class="${o.mono ? 'mono' : ''}" data-path="${path}" value="${esc(getPath(C, path))}" placeholder="${esc(o.placeholder || '')}" ${o.list ? `list="${o.list}"` : ''} ${o.attrs || ''} autocapitalize="off" autocorrect="off" spellcheck="false"></label>`,
    select: (label, path, opts, o = {}) => `<label class="row"><span class="row-label">${esc(label)}</span><select data-path="${path}" ${o.num ? 'data-num' : ''} ${o.rerender ? 'data-rerender' : ''}>${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(getPath(C, path)) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`,
    toggle: (label, path) => `<label class="row"><span class="row-label" style="max-width:70%">${esc(label)}</span><span class="switch"><input type="checkbox" data-path="${path}" ${getPath(C, path) ? 'checked' : ''}><i></i></span></label>`,
    area: (label, path, placeholder) => `<label class="row-stack row"><span>${esc(label)}</span><textarea class="area" rows="3" data-path="${path}" placeholder="${esc(placeholder)}">${esc(getPath(C, path))}</textarea></label>`,
    range: (label, path, min, max, step, fmt) => `<label class="row"><span class="row-label">${esc(label)}</span><input type="range" data-path="${path}" data-num data-fmt="${fmt}" min="${min}" max="${max}" step="${step}" value="${esc(getPath(C, path))}"><span class="row-num">${fmtVal(getPath(C, path), fmt)}</span></label>`,
    seg: (label, path, opts, num) => `<div class="row"><span class="row-label">${esc(label)}</span><span class="segmented" role="group" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button type="button" data-seg="${path}" data-v="${esc(v)}" ${num ? 'data-num' : ''} aria-pressed="${String(getPath(C, path)) === String(v)}">${esc(t)}</button>`).join('')}</span></div>`,
    btn: (label, action, cls = '') => `<button class="row row-btn ${cls}" type="button" data-act="${action}">${esc(label)}</button>`,
    group: (head, rows, foot = '') => `<div class="group">${head ? `<div class="group-head"><span>${esc(head)}</span></div>` : ''}<div class="list">${rows.join('')}</div>${foot ? `<div class="group-foot">${foot}</div>` : ''}</div>`,
  };
  const fmtVal = (v, fmt) => (fmt === 'pct' ? Math.round(v * 100) + '%' : fmt === 'px' ? v + ' px' : String(v));

  function renderSettings() {
    const pv = C.ai.provider, P = DEF.providers[pv];
    const key = C.ai.keys[pv];
    const aiRows = [
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
    $('#settings').innerHTML =
      R.group('Mesin AI', aiRows, `${key ? 'Key tersimpan di perangkat ini saja dan dikirim langsung ke penyedia.' : `Buat key di <span class="mono">${esc(P.keyUrl)}</span>. Key tersimpan di perangkat ini saja dan dikirim langsung ke penyedia.`} Tiap penyedia menyimpan key, model, dan URL-nya sendiri.<datalist id="model-list">${P.suggestions.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>`)
      + R.group('Prompt', [
        R.area('Awalan — ditaruh sebelum setiap prompt', 'prompt.prefix', 'Kosong'),
        R.area('Akhiran — ditaruh setelah setiap prompt', 'prompt.suffix', 'Kosong'),
        R.select('Rasio hasil', 'prompt.aspect', ASPECTS.map((a) => [a, a || 'Ikuti foto asli'])),
        R.seg('Gabung efek, maks.', 'prompt.maxStack', [[1, '1'], [2, '2'], [3, '3'], [5, '5']], true),
      ], 'Awalan dan akhiran berlaku untuk semua efek. Rasio bisa ditimpa per efek di tab Efek.')
      + R.group('Foto', [
        R.select('Sisi terpanjang saat dikirim', 'image.maxSide', [[1024, '1024 px'], [1536, '1536 px'], [2048, '2048 px'], [3072, '3072 px']], { num: true }),
        R.range('Kualitas JPEG', 'image.quality', 0.5, 1, 0.05, 'pct'),
        R.toggle('Simpan hasil ke Galeri otomatis', 'image.autoSave'),
        R.select('Batas isi Galeri', 'image.maxHistory', [[20, '20 hasil'], [60, '60 hasil'], [120, '120 hasil'], [300, '300 hasil']], { num: true }),
      ], 'Foto diperkecil di perangkat sebelum dikirim. Makin besar makin detail, tapi lebih lambat dan mahal.')
      + R.group('Tampilan', [
        R.text('Nama aplikasi', 'app.name', { placeholder: 'Slash Photo', attrs: 'maxlength="24" data-live' }),
        R.seg('Tema', 'app.theme', [['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']]),
        R.seg('Kolom efek', 'app.columns', [[2, '2'], [3, '3']], true),
        `<div class="swatches" role="group" aria-label="Warna aksen">${ACCENTS.map((c) => `<button class="swatch" type="button" data-accent="${c}" style="background:${c}" aria-pressed="${C.app.accent.toUpperCase() === c}" aria-label="Aksen ${c}"></button>`).join('')}
          <label class="row" style="padding:0;min-height:0;width:auto;margin-left:auto"><input type="color" data-path="app.accent" data-live value="${esc(C.app.accent)}" aria-label="Warna aksen kustom"></label></div>`,
      ])
      + R.group('Efek & kategori', [
        `<button class="row row-btn" type="button" data-act="goto-presets">Edit ${C.presets.length} efek${icon(I.chev, 16)}</button>`,
        `<button class="row row-btn" type="button" data-act="cats">Kelola ${C.categories.length} kategori${icon(I.chev, 16)}</button>`,
      ])
      + R.group('Cadangan', [
        R.btn('Ekspor konfigurasi (.json)', 'export'),
        R.btn('Impor konfigurasi', 'import'),
      ], 'Berisi semua efek, kategori, dan setelan. API key tidak ikut diekspor.')
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
    if (path.startsWith('app.') || path.startsWith('ai.')) applyAppearance();
    if (path === 'prompt.maxStack') { S.sel = S.sel.slice(0, v); }
    if (path === 'app.accent') $$('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.accent === String(v).toUpperCase())));
    if (el.hasAttribute('data-rerender')) renderSettings();
    renderComposer();
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
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'slash-photo-config.json';
      document.body.append(a); a.click(); a.remove();
      toast('Konfigurasi diekspor');
    }
    if (act === 'import') $('#file-import').click();
    if (act === 'reset-presets' && await ask({ title: 'Reset efek & kategori?', text: 'Semua efek buatanmu dan perubahan pada efek bawaan akan hilang.', ok: 'Reset', danger: true })) {
      C.presets = clone(DEF.config.presets); C.categories = clone(DEF.config.categories);
      S.sel = []; save(); renderAll(); toast('100 efek bawaan dipulihkan');
    }
    if (act === 'clear-gallery' && await ask({ title: 'Kosongkan Galeri?', text: 'Semua hasil di perangkat ini dihapus permanen.', ok: 'Hapus semua', danger: true })) {
      await DB.clear(); toast('Galeri dikosongkan');
    }
    if (act === 'reset-all' && await ask({ title: 'Reset semua setelan?', text: 'API key, efek, kategori, dan tampilan kembali ke awal. Galeri tidak ikut terhapus.', ok: 'Reset', danger: true })) {
      C = clone(DEF.config); S.sel = []; S.override = null; save(); renderAll(); toast('Semua setelan direset');
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
        C.ai[pv].model = m; save(); applyAppearance(); renderSettings(); sh.close(); toast(`Model: ${m}`);
      };
    } catch (e) {
      sh.body.innerHTML = `<div class="error" role="alert"><div><b>Koneksi gagal</b></div><div class="error-msg">${esc(e.message)}</div></div>`;
    }
  }

  async function importConfig(file) {
    try {
      const j = JSON.parse(await file.text());
      if (!isObj(j) || !Array.isArray(j.presets) || !Array.isArray(j.categories)) throw new Error('bad');
      const cats = j.categories.filter((c) => isObj(c) && c.id && c.name).map((c) => ({ id: String(c.id), name: String(c.name), emoji: String(c.emoji || '📁'), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#8E8E93' }));
      if (!cats.length) throw new Error('bad');
      const seen = new Set();
      const presets = j.presets.filter((p) => isObj(p) && normCmd(p.cmd) && p.prompt && !seen.has(normCmd(p.cmd)) && seen.add(normCmd(p.cmd))).map((p) => ({
        id: String(p.id || uid()), cmd: normCmd(p.cmd), name: String(p.name || p.cmd), prompt: String(p.prompt),
        cat: cats.some((c) => c.id === p.cat) ? p.cat : cats[0].id, aspect: ASPECTS.includes(p.aspect) ? p.aspect : '', fav: !!p.fav, hidden: !!p.hidden, builtin: !!p.builtin,
      }));
      const keys = C.ai.keys;
      C = merge(clone(DEF.config), { ...j, categories: cats, presets });
      C.ai.keys = { ...clone(DEF.config.ai.keys), ...keys };
      if (!DEF.providers[C.ai.provider]) C.ai.provider = 'gemini';
      S.sel = []; S.override = null;
      save(); renderAll();
      toast(`Diimpor: ${presets.length} efek, ${cats.length} kategori`);
    } catch { toast('File konfigurasi tidak valid'); }
  }

  /* ───────── navigation ───────── */
  function go(tab) {
    S.scroll[S.tab] = window.scrollY;
    S.tab = tab;
    $$('.view').forEach((v) => (v.hidden = v.dataset.view !== tab));
    $$('#tabbar button').forEach((b) => (b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    $('#composer').hidden = tab !== 'studio';
    if (tab === 'gallery') renderGallery();
    if (tab === 'settings') renderSettings();
    if (tab === 'presets') renderPresetList();
    window.scrollTo(0, S.scroll[tab] || 0);
  }
  function renderAll() {
    applyAppearance(); renderStage(); renderFilters(); renderGrid(); renderComposer(); renderPresetList();
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
    if (a === 'show-src') { S.show = 'src'; renderStage(); }
    if (a === 'show-out') { S.show = 'out'; renderStage(); }
    if (a === 'save' && S.out) download(S.out.blob, fileName(S.out.cmds));
    if (a === 'share' && S.out) share(S.out.blob, fileName(S.out.cmds));
    if (a === 'chain' && S.out) { const b = S.out.blob; S.out = null; setSource(b); toast('Hasil jadi foto sumber'); }
    if (a === 'redo') generate();
    if (a === 'open-settings') go('settings');
    const f = e.target.closest('[data-f]')?.dataset.f;
    if (f) { S.filter = f; renderFilters(); renderGrid(); }
    const id = e.target.closest('.tile')?.dataset.id;
    if (id) toggleSel(id);
  });

  for (const id of ['#file-lib', '#file-cam']) {
    $(id).addEventListener('change', (e) => { onPick(e.target.files[0]); e.target.value = ''; });
  }
  $('#file-import').addEventListener('change', (e) => { if (e.target.files[0]) importConfig(e.target.files[0]); e.target.value = ''; });

  // desktop niceties: drop & paste
  const stage = $('#stage');
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dragover'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dragover'));
  stage.addEventListener('drop', (e) => { e.preventDefault(); stage.classList.remove('dragover'); onPick([...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))); });
  document.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f && S.tab === 'studio') onPick(f);
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
    else if (e.key === 'Enter') { e.preventDefault(); generate(); }
    else if (e.key === 'Backspace' && !cmdInput.value && S.sel.length) { S.sel.pop(); S.override = null; renderGrid(); renderComposer(); }
  });
  $('#suggest').addEventListener('pointerdown', (e) => {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id) { e.preventDefault(); acceptSuggest(id); }
  });
  cmdInput.addEventListener('blur', () => setTimeout(closeSuggest, 120));
  $('#sel').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]')?.dataset.rm;
    if (!rm) return;
    if (rm === 'override') S.override = null; else S.sel = S.sel.filter((x) => x !== rm);
    if (rm !== 'override') S.override = null;
    renderGrid(); renderComposer();
  });
  $('#btn-go').addEventListener('click', generate);
  $('#btn-prompt').addEventListener('click', () => {
    if (!hasPrompt()) return toast('Pilih efek atau tulis instruksi dulu');
    promptSheet();
  });

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
    if (seg) {
      setPath(C, seg.dataset.seg, seg.hasAttribute('data-num') ? Number(seg.dataset.v) : seg.dataset.v);
      if (seg.dataset.seg === 'prompt.maxStack') S.sel = S.sel.slice(0, C.prompt.maxStack);
      save(); applyAppearance(); renderSettings(); renderGrid(); renderComposer();
      return;
    }
    const acc = e.target.closest('[data-accent]')?.dataset.accent;
    if (acc) { C.app.accent = acc; save(); applyAppearance(); renderSettings(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) settingsAction(act);
  });

  // keep the composer above the on-screen keyboard (iOS doesn't move fixed elements)
  const vv = window.visualViewport;
  if (vv) {
    const onVV = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', kb > 80 ? kb + 'px' : '0px');
      document.body.classList.toggle('kb-open', kb > 80);
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
  renderAll();
  go('studio');
  window.__slash = { get config() { return C; }, state: S }; // handy for debugging in the console
})();
