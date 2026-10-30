// Page behavior: theme toggle, tabs, generated controls, live markup, copy buttons.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Theme
// The site is dark unless the person picked light; scenes follow the site, not the OS.
function applyTheme(t) {
  $$('sd-scene, sd-universe').forEach((s) => s.setAttribute('theme', t));
  $$('*').filter((e) => e.localName.startsWith('sd-')).forEach((e) => e.shadowRoot?.querySelector('sd-scene')?.setAttribute('theme', t));
}
$('.theme')?.addEventListener('click', () => {
  const next = (document.documentElement.dataset.theme || 'dark') === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('sd-theme', next); } catch {}
  applyTheme(next);
});
applyTheme(document.documentElement.dataset.theme || 'dark');
customElements.whenDefined('sd-orb').then(() => applyTheme(document.documentElement.dataset.theme || 'dark'));

// Tabs
$$('.tabs').forEach((tabs) => {
  const buttons = $$('button', tabs);
  buttons.forEach((b) => b.addEventListener('click', () => {
    buttons.forEach((x) => { x.setAttribute('aria-selected', x === b); $('#' + x.dataset.panel).hidden = x !== b; });
  }));
});

// Serialize the demo scene as the markup a user would paste.
const SKIP = new Set(['class', 'id', 'theme']);
function serialize(el, depth = 0) {
  const pad = '  '.repeat(depth);
  const attrs = [...el.attributes].filter((a) => !SKIP.has(a.name) && a.value !== '' && !(a.name === 'style' && depth === 0 && !('keepStyle' in el.dataset))).map((a) => ` ${a.name}="${a.value}"`).join('');
  const kids = [...el.children].filter((c) => c.tagName.startsWith('SD-'));
  if (!kids.length) return `${pad}<${el.localName}${attrs}></${el.localName}>`;
  return `${pad}<${el.localName}${attrs}>\n${kids.map((k) => serialize(k, depth + 1)).join('\n')}\n${pad}</${el.localName}>`;
}

// Controls from the page spec
const specEl = $('#spec');
if (specEl) {
  const spec = JSON.parse(specEl.textContent);
  const scene = $('#demo');
  const form = $('#controls');
  const live = $('#live');
  const targets = (c) => (c.target === 'scene' ? [scene] : c.target === 'all' ? $$('sd-scene > *', scene) : [$('#demo > [data-subject]') || $('#demo > *')]);
  const refresh = () => { if (live) live.textContent = serialize(scene); };
  for (const c of spec.controls) {
    const label = document.createElement('label');
    const head = document.createElement('span');
    head.textContent = c.label;
    let input;
    if (c.kind === 'range') {
      input = Object.assign(document.createElement('input'), { type: 'range', min: c.min, max: c.max, step: c.step ?? 0.01, value: c.value });
      const out = document.createElement('output'); out.textContent = c.value; head.append(out);
      input.addEventListener('input', () => { out.textContent = input.value; });
    } else if (c.kind === 'color') {
      input = Object.assign(document.createElement('input'), { type: 'color', value: c.value });
    } else if (c.kind === 'select') {
      input = document.createElement('select');
      for (const o of c.options) input.append(new Option(o || 'none', o));
      input.value = c.value ?? '';
    } else if (c.kind === 'check') {
      label.className = 'check';
      input = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!c.value });
    }
    c.input = input;
    const apply = () => {
      const v = c.kind === 'check' ? (input.checked ? c.on : '') : input.value;
      if (c.attr === 'object') { // swap the demo subject for another object type, keeping its attributes
        const old = $('#demo > *'); const nu = document.createElement(v);
        for (const a of old.attributes) nu.setAttribute(a.name, a.value);
        old.replaceWith(nu); refresh(); return;
      }
      if (c.attr === 'center') { // exactly one center
        $$('sd-scene > *', scene).forEach((o) => (o.id === v ? o.setAttribute('gravity', 'center') : o.getAttribute('gravity') === 'center' && o.removeAttribute('gravity')));
        refresh(); return;
      }
      for (const t of targets(c)) {
        if (c.kind === 'check') { // rebuild in control order so interactions keep their documented order
          const cur = spec.controls.filter((x) => x.kind === 'check' && x.attr === c.attr && x.input?.checked).map((x) => x.on);
          if (c.attr === 'camera') t.setAttribute(c.attr, cur.join(' ') || 'none'); // a fixed view, kept by Copy code (an empty value would be dropped)
          else cur.length ? t.setAttribute(c.attr, cur.join(' ')) : t.removeAttribute(c.attr);
        } else if (v === '' || v === String(c.default ?? '\u0000')) t.removeAttribute(c.attr);
        else t.setAttribute(c.attr, v);
      }
      refresh();
    };
    input.addEventListener('input', apply);
    if (c.kind === 'check') label.append(input, head); else label.append(head, input);
    form.append(label);
  }
  refresh();

  $('#copy-code')?.addEventListener('click', async (e) => {
    await navigator.clipboard.writeText(`<script type="module" src="https://mmaxence.github.io/solids/solids.js"></script>\n${serialize(scene)}`);
    flash(e.currentTarget, 'Copied');
  });
  $('#copy-prompt')?.addEventListener('click', async (e) => {
    await navigator.clipboard.writeText(spec.prompt.replace('{{markup}}', serialize(scene)));
    flash(e.currentTarget, 'Copied');
  });
}
function flash(btn, text) { const t = btn.textContent; btn.textContent = text; setTimeout(() => (btn.textContent = t), 1200); }

// fps badge on every stage, fed by that stage's own scene. A dash until the scene has drawn a frame.
$$('.fps').forEach((badge) => {
  const scene = badge.parentElement.querySelector('sd-scene, sd-universe');
  if (!scene) return;
  const tick = () => {
    if (!(scene.fps > 0)) return;
    const fps = Math.round(scene.fps);
    badge.firstElementChild.textContent = `${fps} fps`;
    badge.lastElementChild.textContent = ` ${scene.frameTime.toFixed(2)} ms`;
    badge.classList.toggle('warn', fps < 50 && fps >= 30);
    badge.classList.toggle('bad', fps < 30);
  };
  tick(); setInterval(tick, 250);
});

// Live numbers from the demo scene: the Performance page's meter and the landing's frame number.
const demo = $('#demo'), meter = $('#meter'), liveFrame = $('#live-frame');
if (demo && (meter || liveFrame)) {
  const show = () => {
    const fps = Math.round(demo.fps);
    if (liveFrame) liveFrame.textContent = `${demo.frameTime.toFixed(2)} ms`;
    if (!meter) return;
    const gpu = demo.gpuTime;   // reading it turns the GPU timer on for this scene
    const pr = +demo.pixelRatio.toFixed(2), dpr = +(devicePixelRatio || 1).toFixed(2);
    const v = {
      cpu: `${demo.frameTime.toFixed(2)} ms`,
      gpu: gpu != null ? `${gpu.toFixed(2)} ms` : demo.gl?.getExtension('EXT_disjoint_timer_query_webgl2') ? 'measuring' : 'unavailable',
      fps: String(fps), dpr: pr < dpr ? `${pr} (screen ${dpr})` : String(pr), space: demo.colorSpace,
    };
    for (const [k, t] of Object.entries(v)) meter.querySelector(`[data-k="${k}"]`).textContent = t;
  };
  show(); setInterval(show, 500);
}

// Benchmark: one subject in a hidden scene, frames driven by hand, context freed at the end.
const raf = () => new Promise((r) => requestAnimationFrame(r));
/** `subject` is an object tag or { effect }. Resolves { cpu, gpu }: median ms per frame, waited until drawn; GPU ms or null. */
async function solidsBench(subject, frames = 60) {
  await customElements.whenDefined('sd-scene');
  frames = Math.max(1, frames | 0);
  const sc = document.createElement('sd-scene');
  sc.setAttribute('paused', '');   // no rAF loop of its own
  sc.setAttribute('theme', document.documentElement.dataset.theme || 'dark');
  if (subject.effect) sc.setAttribute('effect', subject.effect);
  // On screen for GL but invisible: visibility:hidden or display:none would not draw.
  sc.style.cssText = 'position:fixed;left:0;top:0;width:240px;height:240px;display:grid;place-items:center;opacity:0;pointer-events:none';
  sc.appendChild(document.createElement(subject.effect ? 'sd-orb' : subject)).setAttribute('size', '200px');
  document.body.append(sc);
  const gl = sc.gl;
  try {
    if (!gl) throw new Error('WebGL2 is unavailable in this browser.');
    const px = new Uint8Array(4);
    // A one-pixel read waits for the frame to finish, so the time includes the GPU work.
    const one = (i) => { const t = performance.now(); sc.frame(i / 60, 16); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t; };
    for (let i = 0; i < 3; i++) one(i);   // shader compile and warm-up
    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (timer) sc.gpuTime;   // opt in
    const times = Array.from({ length: frames }, (_, i) => one(i)).sort((a, b) => a - b);
    // Timer results arrive only after the event loop turns; a few more frames collect them.
    if (timer) for (let i = 0; i < 10; i++) { await raf(); one(frames + i); }
    return { cpu: times[frames >> 1], gpu: timer ? sc.gpuTime : null };
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    sc.remove();
  }
}
window.solidsBench = solidsBench;

/** Benchmark one table row and redraw the bars relative to the slowest row so far. */
async function benchRow(tr, frames) {
  const r = await solidsBench(tr.dataset.tag || { effect: tr.dataset.effect }, frames);
  tr.cells[1].textContent = r.cpu.toFixed(2);
  tr.cells[3].textContent = r.gpu == null ? 'unavailable' : r.gpu.toFixed(2);
  tr.dataset.cpu = r.cpu;
  const done = $$('tr[data-cpu]', tr.parentElement), max = Math.max(...done.map((x) => +x.dataset.cpu));
  for (const x of done) x.cells[2].firstElementChild.style.width = `${(+x.dataset.cpu / max) * 100}%`;
}
$('#bench-run')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget, status = $('#bench-status'), rows = $$('#bench tbody tr');
  btn.disabled = true; demo?.setAttribute('paused', '');
  try {
    for (const [i, tr] of rows.entries()) { status.textContent = `Running ${i + 1} of ${rows.length}`; await benchRow(tr); }
    status.textContent = 'Done. Measured here, kept here.';
  } catch (err) { status.textContent = String(err.message || err); }
  finally { btn.disabled = false; demo?.removeAttribute('paused'); }
});

// Headless check hook: report console errors after a few frames.
if (location.search.includes('__check')) {
  const errors = [];
  const ce = console.error.bind(console);
  console.error = (...a) => { errors.push(a.map(String).join(' ')); ce(...a); };
  addEventListener('error', (e) => errors.push(String(e.message)));
  let n = 0;
  const report = async () => {
    const scenesBeforeBench = $$('sd-scene').length;
    let bench, benchRowText, noTimerRow;
    if ($('#bench')) {
      try {
        bench = await solidsBench('sd-orb', 5); const [tr, tr2] = $$('#bench tbody tr'); await benchRow(tr, 5); benchRowText = tr.textContent;
        // A browser without the GPU timer: the row still fills, the GPU cell says unavailable.
        const ge = WebGL2RenderingContext.prototype.getExtension;
        WebGL2RenderingContext.prototype.getExtension = function (n) { return n === 'EXT_disjoint_timer_query_webgl2' ? null : ge.call(this, n); };
        try { await benchRow(tr2, 5); noTimerRow = tr2.textContent; } finally { WebGL2RenderingContext.prototype.getExtension = ge; }
      }
      catch (e) { errors.push('bench: ' + (e?.message || e)); }
    }
    $('.theme')?.click();
    const sel = $$('#controls label').find((l) => l.querySelector('span')?.textContent === 'Object')?.querySelector('select');
    if (sel) { sel.value = 'sd-cube'; sel.dispatchEvent(new Event('input')); }
    const center = $$('#controls label').find((l) => l.querySelector('span')?.textContent.startsWith('Center'))?.querySelector('select');
    if (center) { center.value = 'ring'; center.dispatchEvent(new Event('input')); }
    const strength = $$('#controls label').find((l) => l.querySelector('span')?.firstChild?.textContent === 'Gravity strength')?.querySelector('input');
    if (strength) { strength.value = '0'; strength.dispatchEvent(new Event('input')); }
    const h1 = $('h1')?.getBoundingClientRect(), dock = $('.dock')?.getBoundingClientRect();
    const toggle = (name, on) => { const t = $$('#controls label.check').find((l) => l.textContent.trim() === name)?.querySelector('input'); if (t && t.checked !== on) { t.checked = on; t.dispatchEvent(new Event('input')); } };
    let interactionAttr;
    if ($('.dock')) { toggle('collide', true); toggle('gravity', false); toggle('gravity', true); interactionAttr = $('#demo').getAttribute('interaction'); }
    if ($('sd-universe#demo')) { toggle('Spin', false); toggle('Drag', false); toggle('Pointer', false); }
    const demo = $('#demo');
    fetch('/__result', { method: 'POST', body: JSON.stringify({ errors, scenes: $$('sd-scene, sd-universe').length, theme: document.documentElement.dataset.theme, subject: $('#demo > *')?.localName, live: $('#live')?.textContent,
      objects: $$('#demo > *').length, hasCenter: !!center, scrollWidth: document.documentElement.scrollWidth, innerWidth, h1Bottom: h1?.bottom, dockTop: dock?.top,
      markup: demo && serialize(demo), centerOptions: center && [...center.options].map((o) => o.value), interactionAttr,
contexts: $$('sd-scene, sd-universe').length + $$('*').filter((e) => e.shadowRoot?.querySelector('sd-scene')).length, sceneObjects: $$('sd-scene, sd-universe').map((s) => s.objects?.size), liveFrame: $('#live-frame')?.textContent,
      badge: $('.fps')?.textContent, meter: meter?.textContent, bench, benchRow: benchRowText, noTimerRow, scenesBeforeBench }) });
  };
  const tick = () => (++n < 6 ? requestAnimationFrame(tick) : report());
  requestAnimationFrame(tick);
}
