// Page behavior: theme toggle, tabs, generated controls, live markup, copy buttons.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Theme
$('.theme')?.addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('sd-theme', next); } catch {}
  $$('sd-scene').forEach((s) => s.setAttribute('theme', next));
});
// The site is dark unless the person picked light; scenes follow the site, not the OS.
$$('sd-scene').forEach((s) => s.setAttribute('theme', document.documentElement.dataset.theme || 'dark'));

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
      for (const t of targets(c)) {
        if (c.kind === 'check') {
          const cur = (t.getAttribute(c.attr) || '').split(/\s+/).filter(Boolean).filter((x) => x !== c.on);
          if (input.checked) cur.push(c.on);
          cur.length ? t.setAttribute(c.attr, cur.join(' ')) : t.removeAttribute(c.attr);
        } else if (v === '' || v === String(c.default ?? '\u0000')) t.removeAttribute(c.attr);
        else t.setAttribute(c.attr, v);
      }
      if (c.attr === 'gravity') { // the center control: one object only
        $$('sd-scene > *', scene).forEach((o) => (o.id === v ? o.setAttribute('gravity', 'center') : o.getAttribute('gravity') === 'center' && o.removeAttribute('gravity')));
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
  const tick = () => (++n < 6 ? requestAnimationFrame(tick) : fetch('/__result', { method: 'POST', body: JSON.stringify({ errors, scenes: $$('sd-scene').length }) }));
  requestAnimationFrame(tick);
}
