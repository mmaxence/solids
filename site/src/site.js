// Page behavior: theme toggle, tabs, generated controls, live markup, copy buttons.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Theme
// The site is dark unless the person picked light; scenes follow the site, not the OS.
function applyTheme(t) {
  $$('sd-scene').forEach((s) => s.setAttribute('theme', t));
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
const SKIP = new Set(['style', 'class', 'id', 'theme']);
function serialize(el, depth = 0) {
  const pad = '  '.repeat(depth);
  const attrs = [...el.attributes].filter((a) => !SKIP.has(a.name) && a.value !== '').map((a) => ` ${a.name}="${a.value}"`).join('');
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
  const refresh = () => { live.textContent = serialize(scene); };
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
        if (c.kind === 'check') {
          const cur = (t.getAttribute(c.attr) || '').split(/\s+/).filter(Boolean).filter((x) => x !== c.on);
          if (input.checked) cur.push(c.on);
          cur.length ? t.setAttribute(c.attr, cur.join(' ')) : t.removeAttribute(c.attr);
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

// Headless check hook: report console errors after a few frames.
if (location.search.includes('__check')) {
  const errors = [];
  const ce = console.error.bind(console);
  console.error = (...a) => { errors.push(a.map(String).join(' ')); ce(...a); };
  addEventListener('error', (e) => errors.push(String(e.message)));
  let n = 0;
  const report = () => {
    $('.theme')?.click();
    const sel = $$('#controls label').find((l) => l.querySelector('span')?.textContent === 'Object')?.querySelector('select');
    if (sel) { sel.value = 'sd-cube'; sel.dispatchEvent(new Event('input')); }
    const center = $$('#controls label').find((l) => l.querySelector('span')?.textContent === 'Center of gravity')?.querySelector('select');
    if (center) { center.value = 'ring'; center.dispatchEvent(new Event('input')); }
    const strength = $$('#controls label').find((l) => l.querySelector('span')?.firstChild?.textContent === 'Gravity strength')?.querySelector('input');
    if (strength) { strength.value = '0'; strength.dispatchEvent(new Event('input')); }
    fetch('/__result', { method: 'POST', body: JSON.stringify({ errors, scenes: $$('sd-scene').length, theme: document.documentElement.dataset.theme, subject: $('#demo > *')?.localName, live: $('#live')?.textContent }) });
  };
  const tick = () => (++n < 6 ? requestAnimationFrame(tick) : report());
  requestAnimationFrame(tick);
}
