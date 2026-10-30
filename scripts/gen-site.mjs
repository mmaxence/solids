// Generates site/dist from src/objects, src/effects, the bundle's meta, and site/src.
import { statSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const OUT = 'site/dist';
const BASE = 'https://mmaxence.github.io/solids/';
const SCRIPT = BASE + 'solids.js';
const SKILL = BASE + 'skill.md';   // the site serves docs/SKILL.md verbatim, as plain text for agents
const REPO = 'https://github.com/mmaxence/solids';

// --- load library metadata through the built bundle under a tiny DOM shim ---
globalThis.window = globalThis;
globalThis.HTMLElement = class {};
globalThis.customElements = { get: () => undefined, define: () => {} };
if (!existsSync('dist/solids.js') || !existsSync('dist/core.js')) { console.error('run npm run build first'); process.exit(1); }
const sizes = { core: gzipSync(readFileSync('dist/core.js')).length, full: gzipSync(readFileSync('dist/solids.js')).length };   // gzipped bytes
rmSync(OUT, { recursive: true, force: true }); // renamed pages do not linger
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const { registry, PALETTE } = await import(pathToFileURL('dist/solids.js').href);
const objects = [...registry.objects.values()].map((o) => ({ ...o.manifest, readme: readFileSync(`src/objects/${o.manifest.name}/README.md`, 'utf8') }));
const effects = [...registry.effects.values()].map((e) => e.manifest);
const shades = [...registry.shades.values()].map((s) => ({ ...s.manifest, readme: readFileSync(`src/shades/${s.manifest.name}/README.md`, 'utf8') }));
const LIGHT_SHADE = registry.LIGHT_SHADE;
const animations = [...registry.animations.values()].map((a) => a.meta);
const interactions = [...registry.interactions.values()].map((i) => i.meta);

// --- helpers ---
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const shell = readFileSync('site/src/shell.html', 'utf8');
// The palette, single source: Display P3 picks outside sRGB. Browsers without P3 clip them to sRGB.
const colorOf = (i) => PALETTE[i % PALETTE.length]; // the universe's palette, one source
/** `<input type="color">` only holds sRGB hex, so its swatch is the P3 pick clipped to sRGB. */
const swatch = (p3) => {
  const [r, g, b] = p3.match(/[\d.]+/g).slice(-3).map(Number).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return '#' + [[1.2249, -0.2249, 0], [-0.0421, 1.0421, 0], [-0.0196, -0.0786, 1.0983]]
    .map(([x, y, z]) => Math.min(1, Math.max(0, x * r + y * g + z * b)))
    .map((v) => Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0')).join('');
};

/** Minimal markdown: headings, paragraphs, lists (bulleted and numbered), fenced code, inline code, links, bold. */
function md(src) {
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  const out = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { const buf = []; while (!lines[++i].startsWith('```')) buf.push(lines[i]); out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    const h = l.match(/^(#{1,3}) (.*)/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const list = /^- /.test(l) ? [/^- /, 'ul'] : /^\d+\. /.test(l) ? [/^\d+\. /, 'ol'] : null;
    if (list) { const items = []; while (i < lines.length && list[0].test(lines[i])) items.push(`<li>${inline(lines[i++].replace(list[0], ''))}</li>`); i--; out.push(`<${list[1]}>${items.join('')}</${list[1]}>`); continue; }
    if (l.trim()) { const p = [l]; while (lines[i + 1]?.trim() && !/^(#|- |\d+\. |```)/.test(lines[i + 1])) p.push(lines[++i]); out.push(`<p>${inline(p.join(' '))}</p>`); }
  }
  return out.join('\n');
}

function nav(root, current) {
  const item = (href, label) => `<li><a href="${root}${href}"${href === current ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`;
  // Two tiers: the guide, always open, then the catalogue as four collapsible groups. Only the current page's group starts open.
  const group = (label, dir, list) => { const open = current.startsWith(dir + '/'); return `<details${open ? ' open' : ''}><summary>${label} <span>${list.length}</span></summary><ul>${list.map((x) => item(`${dir}/${x.name}.html`, x.name)).join('')}</ul></details>`; };
  return `<h2>Guide</h2><ul>${item('index.html', 'Introduction')}${item('accessibility.html', 'Accessibility')}${item('scene.html', 'Scene and gravity')}${item('universe.html', 'Universe')}${item('text.html', 'Text')}${item('shades.html', 'Shades')}${item('performance.html', 'Performance')}</ul>
<h2>Catalogue</h2>${group('Objects', 'objects', objects)}${group('Animations', 'animations', animations)}${group('Effects', 'effects', effects)}${group('Shades', 'shades', shades)}${group('Interactions', 'interactions', interactions)}`;
}

function page(path, { title, description, main, hero = '' }) {
  const root = path.includes('/') ? '../' : './';
  const html = shell.replace(/{{root}}/g, root).replace('{{title}}', () => esc(title)).replace('{{description}}', () => esc(description)).replace('{{nav}}', () => nav(root, path)).replace('{{main}}', () => main).replace('{{hero}}', () => hero);
  mkdirSync(`${OUT}/${path}`.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(`${OUT}/${path}`, html);
}

/** The fps badge every stage carries; site.js feeds it from the stage's own scene. */
const badge = () => `<output class="fps" aria-hidden="true" title="Frames per second and CPU ms per frame of this scene, measured live"><b>&ndash;</b><span></span></output>`;
/** A landing or comparison row: a relative box around a scene so the badge has a corner. */
const bandStage = (html) => `<div class="band-stage">${badge()}${html}</div>`;

/** Full-viewport hero: the scene fills the first screen; title top-left, control dock at the bottom. */
function hero({ sceneAttrs, inner, controls, title, pitch, prompt }) {
  const spec = JSON.stringify({ controls, prompt }).replace(/</g, '\\u003c');
  return `<section class="hero-full">
  <div class="stage scatter hero-stage">${badge()}<sd-scene id="demo" data-keep-style style="position:relative;height:100%;min-height:560px" ${sceneAttrs}>${inner}</sd-scene></div>
  <div class="hero-title"><h1>${esc(title)}</h1><p>${esc(pitch)}</p></div>
  <form id="controls" class="controls dock" onsubmit="return false"><button type="button" class="btn quiet" id="copy-prompt">Copy prompt</button><button type="button" class="btn" id="copy-code">Copy code</button></form>
  <script type="application/json" id="spec">${spec}</script>
</section>`;
}

/** Preview panel: a scene, generated controls, live markup, copy buttons. */
function preview({ sceneAttrs = '', inner, controls, prompt, stageClass = '', tag = 'sd-scene' }) {
  const spec = JSON.stringify({ controls, prompt }).replace(/</g, '\\u003c');
  return `<div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-panel="preview">Preview</button><button role="tab" aria-selected="false" data-panel="install">Install</button></div>
<section id="preview" class="panel">
  <div class="stage ${stageClass}">${badge()}<${tag} id="demo"${stageClass.includes('scatter') ? ' data-keep-style style="position:relative;height:100%;min-height:340px"' : ''} ${sceneAttrs}>${inner}</${tag}></div>
  <form id="controls" class="controls" onsubmit="return false"></form>
  <div class="codebar"><pre><code id="live"></code></pre><div class="actions"><button type="button" class="btn quiet" id="copy-prompt">Copy prompt</button><button type="button" class="btn" id="copy-code">Copy code</button></div></div>
</section>
<section id="install" class="install" hidden>
  <p>Add the script once, then use the tags anywhere.</p>
  <pre><code>&lt;script type="module" src="${SCRIPT}"&gt;&lt;/script&gt;</code></pre>
  <p>Or copy the library into your project: download <code>solids.js</code> from the repo and serve it yourself. No build step, no other files.</p>
</section>
<script type="application/json" id="spec">${spec}</script>`;
}

const rangeControl = (u, target, attr, group = 'Shape') => ({ kind: 'range', attr: attr ?? kebab(u.name), label: u.label, min: u.min, max: u.max, step: u.step ?? 0.01, value: u.default, default: u.default, target, group });
// Docks are grouped by what a control changes; the hero's single row passes no group.
const coreControls = (target = 'object') => [
  { kind: 'select', attr: 'animation', label: 'Animation', options: ['', ...animations.map((a) => a.name)], value: '', target, group: 'Motion' },
  { kind: 'range', attr: 'speed', label: 'Speed', min: 0.1, max: 3, step: 0.1, value: 1, default: 1, target, group: 'Motion' },
  { kind: 'select', attr: 'state', label: 'State', options: ['', 'off', 'idle', 'busy', 'active'], value: '', target, group: 'Motion' },
  { kind: 'color', attr: 'color', label: 'Color', value: '#9bd1ff', default: '#9bd1ff', target, group: 'Look' },
  shadingControl(target, 'Look'),
  { kind: 'select', attr: 'effect', label: 'Effect', options: ['', ...effects.map((e) => e.name)], value: '', target, group: 'Look' },
];
const shadingControl = (target, group) => ({ kind: 'select', attr: 'shading', label: 'Shading', options: ['', ...shades.map((s) => s.name)], value: '', empty: 'auto', target, group });
const effectControl = (value, group) => ({ kind: 'select', attr: 'effect', label: 'Scene effect', options: ['', ...effects.map((x) => x.name)], value, target: 'scene', group });
const objectControl = (group) => ({ kind: 'select', attr: 'object', label: 'Object', options: objects.map((o) => o.tag), value: 'sd-orb', target: 'scene', group });
const optionsTable = (rows) => `<table><thead><tr><th>Attribute</th><th>Type</th><th>Default</th><th>Range</th><th>Description</th></tr></thead><tbody>${rows.map((r) => `<tr><td><code>${esc(r[0])}</code></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join('')}</tbody></table>`;
const optionsMd = (rows) => `| Attribute | Type | Default | Range | Description |\n|---|---|---|---|---|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`;
const CORE_ROWS = [
  ['color', 'color', '#9bd1ff', 'any CSS color, including color(display-p3 r g b)', 'Accent color of the object.'],
  ['size', 'length', '160px', 'any CSS length', 'Width and height of the object box.'],
  ['animation', 'list', 'none', animations.map((a) => a.name).join(', '), 'Space separated animations, composed in order.'],
  ['speed', 'number', '1', '0.1 to 3', 'Multiplies animation time.'],
  ['state', 'keyword', 'idle', 'off, idle, busy, active', 'Brightness level, eased on change.'],
  ['effect', 'list', 'none', effects.map((e) => e.name).join(', '), 'Space separated post effects on this object only.'],
  ['shading', 'keyword', 'auto', ['auto', ...shades.map((s) => s.name)].join(', '), `How the surface takes light. auto is glass in the dark theme and ${LIGHT_SHADE} in the light one; a scene's shading is the default for its children.`],
  ['gravity', 'keyword', 'orbit', 'center, orbit, fall, none', 'Role in a gravity scene.'],
];
const license = `<h2>License</h2><p>MIT. Use it anywhere, credit appreciated.</p>`;

// --- Introduction ---
{
  // Hand-placed hero. Orbiters sit at five distances from 20 to 32 vmin, one ring each (inner rings turn faster); the others float at the edges.
  const sz = (px) => `clamp(${Math.round(px * 0.6)}px, ${(px / 6.5).toFixed(1)}vmin, ${Math.round(px * 1.3)}px)`;
  const orbit = (tag, id, size, dx, dy, color, anim) => `<${tag} id="${id}" size="${sz(size)}" color="${color}" animation="${anim}" style="position:absolute;left:calc(50% + ${dx}vmin - ${sz(size)} / 2);top:calc(50% + ${dy}vmin - ${sz(size)} / 2)"></${tag}>`;
  const edge = (tag, id, size, left, top, color, anim) => `<${tag} id="${id}" gravity="none" size="${sz(size)}" color="${color}" animation="${anim}" style="position:absolute;left:${left}%;top:${top}%"></${tag}>`;
  const heroInner = [
    `<sd-orb id="orb" gravity="center" size="${sz(200)}" color="${colorOf(0)}" animation="breathe" glow="0.8" style="position:absolute;left:calc(50% - ${sz(200)} / 2);top:calc(50% - ${sz(200)} / 2)"></sd-orb>`,
    orbit('sd-ring', 'ring', 90, 22.2, -5.9, colorOf(1), 'spin'),
    orbit('sd-crystal', 'crystal', 80, -23.9, 10.2, colorOf(2), 'idle'),
    orbit('sd-knot', 'knot', 84, 20, 21, colorOf(3), 'spin'),
    orbit('sd-capsule', 'capsule', 70, -25.2, -19.7, colorOf(4), 'idle'),
    orbit('sd-star', 'star', 72, 3.9, -19.6, colorOf(5), 'spin'),
    edge('sd-cube', 'cube', 64, 9, 60, colorOf(5), 'idle'),
    edge('sd-coil', 'coil', 80, 84, 12, colorOf(3), 'spin'),
    edge('sd-blob', 'blob', 76, 86, 56, colorOf(4), 'float'),
    edge('sd-prism', 'prism', 70, 5, 40, colorOf(1), 'idle'),
    edge('sd-shell', 'shell', 72, 70, 68, colorOf(2), 'float'),
    edge('sd-disc', 'disc', 60, 60, 4, colorOf(0), 'spin'),
  ].join('\n');
  const ids = ['orb', 'ring', 'crystal', 'knot', 'capsule', 'star', 'cube', 'coil', 'blob', 'prism', 'shell', 'disc'];
  const heroControls = [
    { kind: 'select', attr: 'center', label: 'Center', options: ids.slice(0, 6), value: 'orb', target: 'scene' },
    { kind: 'select', attr: 'effect', label: 'Effect', options: ['', ...effects.map((x) => x.name)], value: '', target: 'scene' },
    shadingControl('scene'),
    { kind: 'range', attr: 'gravity-strength', label: 'Gravity', min: 0, max: 1, step: 0.01, value: 0.35, default: 0.6, target: 'scene' },
    ...interactions.map((i) => ({ kind: 'check', attr: 'interaction', on: i.name, label: i.name, value: ['gravity', 'pointer-follow', 'hover-lift'].includes(i.name), target: 'scene' })),
  ];
  const heroHtml = hero({
    sceneAttrs: 'interaction="gravity pointer-follow hover-lift" gravity-strength="0.35" dpr="1.5"',
    inner: heroInner, controls: heroControls,
    title: 'Lightweight 3D objects for the web',
    pitch: `Glassy shapes you drop into HTML. One script tag, no dependencies, about ${Math.round(sizes.full / 1024)} KB. Hover, pick a center of gravity, try an effect or a shade.`,
    prompt: `This is a solids scene: glassy 3D objects as web components, one script tag, no dependencies.\n\n\`\`\`html\n<script type="module" src="${SCRIPT}"></script>\n{{markup}}\n\`\`\`\n\nThe contract for adding an object is ${SKILL}. Read it, clone https://github.com/mmaxence/solids, add the object under src/objects there, run npm run check until it prints ok, then use the new tag in this scene.`,
  });

  // The landing under the hero: one band per `## ` heading of intro.md, live parts appended after the prose.
  // Live minis share one <sd-scene> per row (browsers keep about 16 WebGL contexts per page).
  const links = (dir, list) => `<p class="names">${list.map((x) => `<a href="${dir}/${x.name}.html">${esc(x.name)}</a>`).join('')}</p>`;
  const layer = (title, line, dir, list, mini) => `<li class="layer"><div class="mini">${mini}</div><h3>${title}</h3><p>${line}</p>${links(dir, list)}</li>`;
  const layers = `<sd-scene class="row" dpr="1.5" interaction="gravity" gravity-strength="0.9"><ul class="layers">
${layer('Objects', 'The shape. A fragment shader on a quad.', 'objects', objects, `<sd-orb size="96px" gravity="none" color="${colorOf(0)}"></sd-orb>`)}
${layer('Animations', 'Pure functions of time, composable.', 'animations', animations, `<sd-ring size="96px" gravity="none" animation="spin" color="${colorOf(1)}"></sd-ring>`)}
${layer('Effects', 'Post passes on an object or a whole scene.', 'effects', effects, `<sd-crystal size="88px" gravity="none" effect="glow" color="${colorOf(2)}"></sd-crystal>`)}
${layer('Shades', 'How a surface takes light. One attribute, any object.', 'shades', shades, `<sd-orb size="96px" gravity="none" shading="cel" color="${colorOf(4)}"></sd-orb>`)}
${layer('Interactions', 'Scene rules that react to the pointer and to each other.', 'interactions', interactions, `<sd-orb size="60px" gravity="center" color="${colorOf(3)}"></sd-orb><sd-star size="34px" animation="spin" color="${colorOf(4)}" style="left:46px"></sd-star>`)}
</ul></sd-scene>`;
  const catalogue = `<sd-scene class="row" dpr="1.5" interaction="hover-lift"><ul class="catalogue">${objects.map((o, i) => `<li><a href="objects/${o.name}.html"><${o.tag} size="96px" animation="idle" color="${colorOf(i)}"></${o.tag}><span>${esc(o.name)}</span></a></li>`).join('')}</ul></sd-scene>
<p class="chips"><span>Effects</span>${effects.map((e) => `<a href="effects/${e.name}.html">${esc(e.name)}</a>`).join('')}</p>
<p class="chips"><span><a href="shades.html">Shades</a></span>${shades.map((x) => `<a href="shades/${x.name}.html">${esc(x.name)}</a>`).join('')}</p>
<p class="chips"><span>Interactions</span>${interactions.map((i) => `<a href="interactions/${i.name}.html">${esc(i.name)}</a>`).join('')}</p>`;
  const numbers = `<dl class="numbers"><div><dt>The whole library, gzipped</dt><dd>${kb(sizes.full)}</dd></div><div><dt>Objects on the hero, one canvas</dt><dd>${ids.length}</dd></div><div><dt>One hero frame, measured now</dt><dd id="live-frame">measuring</dd></div></dl>`;
  const universe = `<sd-universe class="band-universe" count="36" seed="5" collide depth="0.55" dpr="1.5" style="position:relative;height:70vh;min-height:480px"></sd-universe>`;
  // What a new shape costs an agent, from the files it reads and writes. Reads: the contract, the SDF prelude and the largest object
  // as a reference, re-read over 4 turns, plus two check runs of about 2 KB each; writes: one object of mean size. Bytes / 4 per token.
  // Prices: Claude Opus 5.5 list, $4 in / $20 out per million tokens, as of 2026-10-06.
  const bytes = (...fs) => fs.reduce((t, f) => { const st = statSync(f); if (!st.size) throw new Error(`empty ${f}`); return t + st.size; }, 0);
  const objFiles = (n) => ['manifest.json', 'frag.glsl', 'README.md'].map((f) => `src/objects/${n}/${f}`);
  const reads = bytes('docs/SKILL.md', 'src/core/prelude.glsl', ...objFiles('knot'));
  const writes = objects.reduce((t, o) => t + bytes(...objFiles(o.name)), 0) / objects.length;
  const inTok = (4 * reads + 2 * 2048) / 4, outTok = writes / 4;
  const usd = inTok * 4e-6 + outTok * 20e-6;
  const cost = `<p class="cost">The files an agent reads and writes to add a shape come to about ${Math.round((inTok + outTok) / 1000)} K tokens: the contract, one reference object, and the three small files it writes, with two check runs. That is around $${usd.toFixed(2)} at Claude Opus 5.5 list prices (2026-10-06), before the agent's own system prompt and reasoning, which a full session adds on top. Codex reads the same files.</p>`;
  const live = { 'Five layers': bandStage(layers), Universe: bandStage(universe), Catalogue: bandStage(catalogue) + cost, Performance: numbers };
  const main = `<div class="landing">${readFileSync('site/src/intro.md', 'utf8').split(/^(?=## )/m).map((s) => {
    const h = s.match(/^## (.*)/)[1];
    return `<section class="band" id="${h.toLowerCase().replace(/\s+/g, '-')}">${md(s)}${live[h] ?? ''}</section>`;
  }).join('\n')}</div>`;
  page('index.html', { title: 'solids', description: 'Lightweight 3D objects for the web. Zero dependencies.', main, hero: heroHtml });
  page('accessibility.html', { title: 'Accessibility', description: 'How solids objects behave for assistive tech, reduced motion, and low-end devices.', main: md(readFileSync('site/src/accessibility.md', 'utf8')) });
}

// --- Object pages ---
objects.forEach((o, i) => {
  const rows = [...o.uniforms.map((u) => [kebab(u.name), u.type, String(u.default), u.min !== undefined ? `${u.min} to ${u.max}` : '', u.label]), ...CORE_ROWS];
  const controls = [...o.uniforms.map((u) => rangeControl(u, 'object')), ...coreControls('object')];
  controls.find((c) => c.attr === 'color').value = swatch(colorOf(i));
  const prompt = `${o.readme}\n\n## Attributes\n\n${optionsMd(rows)}\n\n## Current markup\n\n\`\`\`html\n{{markup}}\n\`\`\`\n\nLoad the library with <script type="module" src="${SCRIPT}"></script>. To add a new object to the library, read ${SKILL}.`;
  const main = `<h1>${esc(o.name)}</h1><p class="lede">${esc(o.description)}</p>
${preview({ sceneAttrs: 'interaction="pointer-follow hover-lift"', inner: `<${o.tag} size="220px" color="${colorOf(i)}"></${o.tag}>`, controls, prompt })}
<h2>Options</h2>${optionsTable(rows)}
<h2>Notes</h2>${md(o.readme.replace(/^# .*\n/, ''))}
${license}`;
  page(`objects/${o.name}.html`, { title: `${o.name}`, description: o.description, main });
});

// --- Animation pages ---
animations.forEach((a, i) => {
  const controls = [{ kind: 'select', attr: 'animation', label: 'Animation', options: ['', ...animations.map((x) => x.name)], value: a.name, target: 'all' }, { kind: 'range', attr: 'speed', label: 'Speed', min: 0.1, max: 3, step: 0.1, value: 1, default: 1, target: 'all' }];
  const inner = objects.slice(0, 3).map((o, j) => `<${o.tag} animation="${a.name}" size="150px" color="${colorOf(j)}"></${o.tag}>`).join('');
  const prompt = `Animation "${a.name}": ${a.description}\n\nSet it with the animation attribute. Several can be combined, space separated, and speed scales time.\n\n\`\`\`html\n{{markup}}\n\`\`\``;
  page(`animations/${a.name}.html`, { title: a.name, description: a.description, main: `<h1>${esc(a.name)}</h1><p class="lede">${esc(a.description)}</p>${preview({ inner, controls, prompt })}<h2>Usage</h2><p>Set <code>animation="${a.name}"</code> on any object. Combine animations with spaces, for example <code>animation="spin breathe"</code>. The change eases over 400 ms. With reduced motion on, the object stays at its rest pose.</p>${license}` });
});

// --- Effect pages ---
effects.forEach((e) => {
  const rows = e.params.map((p) => [`${e.name}-${kebab(p.name)}`, 'number', String(p.default), `${p.min} to ${p.max}`, p.label]);
  const controls = [
    objectControl('Scene'),
    ...e.params.map((p) => rangeControl(p, 'scene', `${e.name}-${kebab(p.name)}`, 'Effect')),
    effectControl(e.name, 'Look'),
    shadingControl('scene', 'Look'),
  ];
  const prompt = `Effect "${e.name}": ${e.description}\n\nSet it on a scene (applies to everything) or on one object. Parameters are attributes prefixed with the effect name.\n\n${optionsMd(rows)}\n\n\`\`\`html\n{{markup}}\n\`\`\``;
  page(`effects/${e.name}.html`, { title: e.name, description: e.description, main: `<h1>${esc(e.name)}</h1><p class="lede">${esc(e.description)}</p>${preview({ sceneAttrs: `effect="${e.name}"`, inner: `<sd-orb size="220px" color="${colorOf(0)}" animation="idle"></sd-orb>`, controls, prompt })}<h2>Options</h2>${optionsTable(rows)}<p>Put <code>effect="${e.name}"</code> on a scene to process the whole canvas, or on a single object to process only that object. Chain several with spaces; they run in the order written.</p>${license}` });
});

// --- Text page ---
{
  const rows = [
    ['depth', 'number', '0.35', '0.02 to 1', 'Half the thickness of the extrusion.'],
    ['bevel', 'number', '0.25', '0 to 1', 'Rounding of the edges.'],
    ['pixel', 'number', '0', '0 to 24', 'Raster cell in px for a pixel-font look from any monospace; 0 keeps the glyphs smooth.'],
    ...CORE_ROWS.filter((r) => r[0] !== 'size'),
  ];
  const controls = [
    { kind: 'text', attr: 'text', label: 'Text', value: 'Solids', target: 'object', group: 'Text' },
    { kind: 'range', attr: 'pixel', label: 'Pixel', min: 0, max: 24, step: 1, value: 6, default: 0, target: 'object', group: 'Text' },
    { kind: 'range', attr: 'depth', label: 'Thickness', min: 0.02, max: 1, step: 0.01, value: 0.5, default: 0.35, target: 'object', group: 'Text' },
    { kind: 'range', attr: 'bevel', label: 'Edge rounding', min: 0, max: 1, step: 0.01, value: 0.25, default: 0.25, target: 'object', group: 'Text' },
    ...coreControls('object'),
  ];
  const prompt = `A solids text is HTML lifted into 3D: <sd-text> wraps the text (or an element such as an h1), keeps it in the page for layout and accessibility, and draws an extruded, shaded twin over it from a distance field made with the element's CSS font. depth and bevel shape the extrusion; pixel="6" gives a pixel font from any monospace; font-size rules (size does nothing). Every shade, effect, animation and interaction applies.\n\n${optionsMd(rows)}\n\n\`\`\`html\n{{markup}}\n\`\`\``;
  page('text.html', { title: 'Text', description: 'Your HTML text as a solid: wrap a word or a heading and it gets depth, a shade, animations and interactions.', main: `<h1>Text</h1><p class="lede">Wrap a word or a heading in <code>&lt;sd-text&gt;</code> and it becomes a solid: extruded letters in your own font, drawn exactly over the HTML, which stays in the page for layout, selection and screen readers.</p>${preview({ sceneAttrs: 'interaction="pointer-follow hover-lift poke"', inner: `<sd-text pixel="6" depth="0.5" color="${colorOf(0)}" style="font:700 clamp(48px, 12vw, 120px)/1 ui-monospace, Menlo, monospace">Solids</sd-text>`, controls, prompt, stageClass: 'text' })}
<h2>How text works</h2><p>The element reads the text it wraps and the computed CSS font of that element, rasterizes the line on a canvas, turns the raster into a signed distance field and uploads it as a texture. The shader extrudes that field with a rounded edge and marches it like any object, so the letters take every shade, effect and animation, and every interaction moves them. Tap a letter with <code>poke</code> and the word turns to show its sides. With <code>pixel</code> the raster is sampled at that cell size, which gives a pixel font from any monospace; the distance field keeps the blocks sharp.</p>
<p>On a light background the word reads through its shade like any object: <code>auto</code> is glass in the dark theme and matte in the light one, with a darker edge; no effect is needed.</p>
<h2>Options</h2>${optionsTable(rows)}${license}` });
}

// --- Shade pages and the comparison page ---
shades.forEach((sh) => {
  const rows = sh.params.map((p) => [`${sh.name}-${kebab(p.name)}`, 'number', String(p.default), `${p.min} to ${p.max}`, p.label]);
  const controls = [
    objectControl('Scene'),
    ...sh.params.map((p) => rangeControl(p, 'scene', `${sh.name}-${kebab(p.name)}`, 'Shade')),
    { kind: 'select', attr: 'shading', label: 'Shading', options: ['', ...shades.map((x) => x.name)], value: sh.name, empty: 'auto', target: 'scene', group: 'Look' },
    effectControl('', 'Look'),
  ];
  const prompt = `Shade "${sh.name}": ${sh.description}\n\nSet shading="${sh.name}" on a scene (the default for its children) or on one object. Parameters are attributes prefixed with the shade name. shading="auto" is glass in the dark theme and ${LIGHT_SHADE} in the light one.\n\n${optionsMd(rows)}\n\n\`\`\`html\n{{markup}}\n\`\`\``;
  page(`shades/${sh.name}.html`, { title: sh.name, description: sh.description, main: `<h1>${esc(sh.name)}</h1><p class="lede">${esc(sh.description)}</p>${preview({ sceneAttrs: `shading="${sh.name}"`, inner: `<sd-orb size="220px" color="${colorOf(0)}" animation="idle"></sd-orb>`, controls, prompt })}${rows.length ? `<h2>Options</h2>${optionsTable(rows)}` : ''}<h2>Notes</h2>${md(sh.readme.replace(/^# .*\n/, ''))}<p>Put <code>shading="${sh.name}"</code> on a scene to shade every object in it, or on one object. Compare all shades on the <a href="../shades.html">Shades page</a>.</p>${license}` });
});
{
  const row = (sh, i) => `<li><h2><a href="shades/${sh.name}.html">${esc(sh.name)}</a></h2><p>${esc(sh.description)}</p>${bandStage(`<sd-scene class="row" dpr="1.5" shading="${sh.name}" interaction="hover-lift"><ul class="catalogue compare">${objects.map((o, k) => `<li><${o.tag} size="96px" animation="idle" color="${colorOf(k)}"></${o.tag}></li>`).join('')}</ul></sd-scene>`)}</li>`;
  page('shades.html', { title: 'Shades', description: 'Every shade on every object, in both themes. Pick the one that reads best on your background.', main: `<h1>Shades</h1><p class="lede">Every shade on every object. Use the Theme button to compare them on dark and on light. <code>shading="auto"</code> is <code>glass</code> in the dark theme and <code>${LIGHT_SHADE}</code> is the light default today.</p><ul class="compare-rows">${shades.map(row).join('')}</ul><p>Set <code>shading</code> on a scene to shade everything in it, or on one object. Each shade page has its parameters and the markup to copy; the contract for adding a shade is in <a href="skill.md">skill.md</a>.</p>${license}` });
}

// --- Interaction pages and the Scene page ---
const sceneInner = `<sd-orb id="orb" gravity="center" animation="breathe" color="${colorOf(0)}" size="150px" style="position:absolute;left:calc(50% - 75px);top:calc(50% - 75px)"></sd-orb>
<sd-ring id="ring" animation="spin" color="${colorOf(1)}" size="90px" style="position:absolute;left:14%;top:16%"></sd-ring>
<sd-crystal id="crystal" animation="idle" color="${colorOf(2)}" size="80px" style="position:absolute;left:76%;top:58%"></sd-crystal>
<sd-cube id="cube" animation="idle" color="${colorOf(5)}" size="64px" style="position:absolute;left:22%;top:68%"></sd-cube>
<sd-knot id="knot" animation="spin" speed="0.4" color="${colorOf(3)}" size="84px" style="position:absolute;left:70%;top:12%"></sd-knot>
<sd-prism id="prism" animation="idle" color="${colorOf(4)}" size="70px" style="position:absolute;left:48%;top:76%"></sd-prism>`;
const sceneControls = (active) => [
  { kind: 'select', attr: 'center', label: 'Center of gravity', options: ['orb', 'ring', 'crystal', 'cube', 'knot', 'prism'], value: 'orb', target: 'scene', group: 'Scene' },
  { kind: 'range', attr: 'gravity-strength', label: 'Gravity strength', min: 0, max: 1, step: 0.01, value: 0.6, default: 0.6, target: 'scene', group: 'Scene' },
  ...interactions.map((i) => ({ kind: 'check', attr: 'interaction', on: i.name, label: i.name, value: active.includes(i.name), target: 'scene', group: 'Interactions' })),
  effectControl('', 'Look'),
  shadingControl('scene', 'Look'),
];
const scenePrompt = `A solids scene holds objects on one canvas and applies interactions between them. Gravity: mark one object gravity="center"; the others orbit it by default, each on its own ring (sorted by distance in the layout, spread evenly, farther rings turn slower like real orbits), gravity="fall" drifts toward it and stops at gravity-gap, gravity="none" opts out. Change the center at runtime and everything eases to its new path.\n\n\`\`\`html\n{{markup}}\n\`\`\``;
page('scene.html', { title: 'Scene and gravity', description: 'Objects in one scene interact. Pick the center of gravity and watch the others follow.', main: `<h1>Scene and gravity</h1><p class="lede">Objects inside one scene share a canvas and can react to each other. Pick which object is the center of gravity.</p>${preview({ sceneAttrs: 'interaction="gravity hover-lift" gravity-strength="0.6"', inner: sceneInner, controls: sceneControls(['gravity', 'hover-lift']), prompt: scenePrompt, stageClass: 'scatter' })}
<h2>How a scene works</h2><p>A scene is a block element that owns one canvas covering its own box. Its children are placed with ordinary CSS, and each object renders centered on its layout box. Interactions may move an object visually without touching the layout, so your page never reflows.</p>
<h2>Gravity</h2><p>Orbiters take concentric rings: they are sorted by how far the layout puts them from the center, the nearest ring keeps clear of the center, the farthest sits at the farthest rest distance, and the rings in between are spread evenly. A ring turns at a speed that falls with its radius to the power 1.5, so the outer ring sets the pace and inner rings pass it, the way planets do.</p>${optionsTable([['gravity', 'keyword', 'orbit', 'center, orbit, fall, none', 'On an object: its role. Exactly one center; extra centers orbit. Orbiters sit on rings, one each, farther rings turning slower.'], ['gravity-strength', 'number', '0.6', '0 to 1', 'On the scene: orbital speed and pull. At 1 the outer ring turns once every 21 seconds.'], ['gravity-gap', 'number', '24', '0 to 200', 'On a falling object: distance it keeps from the center, in px.']])}
${license}` });
interactions.forEach((i) => {
  const rows = i.params.map((p) => [`${i.name}-${kebab(p.name)}`, 'number', String(p.default), `${p.min} to ${p.max}`, p.label]);
  const prompt = `Interaction "${i.name}": ${i.description}\n\nEnable it with interaction="${i.name}" on the scene. Several can be combined, space separated.\n\n${rows.length ? optionsMd(rows) + '\n\n' : ''}\`\`\`html\n{{markup}}\n\`\`\``;
  page(`interactions/${i.name}.html`, { title: i.name, description: i.description, main: `<h1>${esc(i.name)}</h1><p class="lede">${esc(i.description)}</p>${preview({ sceneAttrs: `interaction="${i.name}"${i.name === 'gravity' ? ' gravity-strength="0.6"' : ''}`, inner: sceneInner, controls: [...sceneControls([i.name]), ...(i.name === 'gravity' ? [] : i.params.map((p) => rangeControl(p, 'scene', `${i.name}-${kebab(p.name)}`, 'Scene')))], prompt, stageClass: 'scatter' })}<h2>Usage</h2><p>Set <code>interaction="${i.name}"</code> on the scene. Interactions are scene rules: they work on every object inside, whatever its type. Several run in the order written.</p>${rows.length ? `<h2>Options</h2>${optionsTable(rows)}` : ''}${license}` });
});

// --- Performance: sizes from the build, a live meter on the demo scene, a benchmark the visitor runs ---
{
  const [head, sizesMd, meterMd, benchMd] = readFileSync('site/src/performance.md', 'utf8').split(/^(?=## )/m);
  const sizesTable = `<table class="sizes"><thead><tr><th>Bundle</th><th>Gzipped</th><th>Bytes</th></tr></thead><tbody>
<tr><td>Core, the engine alone</td><td>${kb(sizes.core)}</td><td>${sizes.core.toLocaleString('en-US')}</td></tr>
<tr><td>Full, <code>solids.js</code> with ${objects.length} objects and ${effects.length} effects</td><td>${kb(sizes.full)}</td><td>${sizes.full.toLocaleString('en-US')}</td></tr></tbody></table>`;
  const spec = JSON.stringify({ controls: [{ kind: 'select', attr: 'effect', label: 'Scene effect', options: ['', ...effects.map((x) => x.name)], value: '', target: 'scene' }], prompt: '' });
  const stat = (k, label) => `<div><dt>${label}</dt><dd data-k="${k}"></dd></div>`;
  const meter = `<section class="panel">
  <div class="stage scatter">${badge()}<sd-scene id="demo" data-keep-style style="position:relative;height:100%;min-height:340px" interaction="gravity hover-lift" gravity-strength="0.6">${sceneInner}</sd-scene></div>
  <form id="controls" class="controls" onsubmit="return false"></form>
  <dl class="meter" id="meter">${stat('cpu', 'Frame (CPU)')}${stat('gpu', 'Frame (GPU)')}${stat('fps', 'fps')}${stat('dpr', 'Pixel ratio')}${stat('space', 'Color space')}</dl>
</section>
<script type="application/json" id="spec">${spec}</script>`;
  const row = (attr, label) => `<tr ${attr}><td>${label}</td><td></td><td class="bar"><span></span></td><td></td></tr>`;
  const bench = `<div class="bench-run"><button type="button" class="btn" id="bench-run">Run benchmark</button><span id="bench-status" aria-live="polite"></span></div>
<table class="bench" id="bench"><thead><tr><th>Subject</th><th>ms per frame (GPU included)</th><th>Relative</th><th>GPU ms</th></tr></thead><tbody>
${objects.map((o) => row(`data-tag="${o.tag}"`, `<a href="objects/${o.name}.html">${o.name}</a>`)).join('\n')}
${effects.map((e) => row(`data-effect="${e.name}"`, `<a href="effects/${e.name}.html">${e.name}</a> on an orb`)).join('\n')}
</tbody></table>`;
  const main = `${md(head).replace('<p>', '<p class="lede">')}\n${md(sizesMd)}${sizesTable}\n${md(meterMd)}${meter}\n${md(benchMd)}${bench}`;
  page('performance.html', { title: 'Performance', description: 'What solids costs: bundle sizes, a live frame meter, and a benchmark that runs in your browser.', main });
}

// --- Universe page ---
{
  const controls = [
    { kind: 'range', attr: 'count', label: 'Count', min: 1, max: 120, step: 1, value: 36, default: 24, target: 'scene', group: 'Universe' },
    { kind: 'range', attr: 'seed', label: 'Seed', min: 1, max: 99, step: 1, value: 1, default: 1, target: 'scene', group: 'Universe' },
    { kind: 'range', attr: 'drift', label: 'Drift', min: 0, max: 1, step: 0.05, value: 0.5, default: 0.5, target: 'scene', group: 'Universe' },
    { kind: 'check', attr: 'collide', on: 'on', label: 'Collide', value: false, target: 'scene', group: 'Universe' },
    { kind: 'check', attr: 'camera', on: 'spin', label: 'Spin', value: true, target: 'scene', group: 'Camera' },
    { kind: 'check', attr: 'camera', on: 'drag', label: 'Drag', value: true, target: 'scene', group: 'Camera' },
    { kind: 'check', attr: 'camera', on: 'pointer', label: 'Pointer', value: true, target: 'scene', group: 'Camera' },
    { kind: 'range', attr: 'speed', label: 'Spin speed', min: 0, max: 4, step: 0.1, value: 1, default: 1, target: 'scene', group: 'Camera' },
    { kind: 'range', attr: 'perspective', label: 'Perspective', min: 0.05, max: 1, step: 0.05, value: 0.5, default: 0.5, target: 'scene', group: 'Camera' },
    { kind: 'range', attr: 'depth', label: 'Depth of field', min: 0, max: 1, step: 0.05, value: 0.5, default: 0.5, target: 'scene', group: 'Depth' },
    { kind: 'range', attr: 'focus', label: 'Focus', min: -1, max: 1, step: 0.05, value: 0, default: 0, target: 'scene', group: 'Depth' },
    effectControl('', 'Look'),
    shadingControl('scene', 'Look'),
  ];
  const rows = [
    ['count', 'number', '24', '0 to 120', 'How many shapes. Changing it regenerates the children.'],
    ['seed', 'number', '1', 'any integer', 'The same seed always gives the same universe: positions, sizes, colors and motion.'],
    ['collide', 'boolean', 'absent', 'present or absent', 'Shapes bounce off each other and keep their speed.'],
    ['camera', 'list', 'spin drag pointer', 'spin, drag, pointer', 'How the view moves: spin turns on its own, drag or swipe rotates it with inertia, pointer tilts it toward the cursor. none for a fixed view.'],
    ['speed', 'number', '1', '0 to 4', 'How fast the camera spins. 1 is one turn every 90 seconds.'],
    ['drift', 'number', '0.5', '0 to 1', 'How much the free shapes float about. 0 holds them in place.'],
    ['perspective', 'number', '0.5', '0.05 to 1', 'How strongly near shapes grow and far ones shrink. Higher brings the camera closer.'],
    ['depth', 'number', '0.5', '0 to 1', 'Strength of the depth of field. 0 keeps every shape sharp.'],
    ['focus', 'number', '0', '-1 to 1', 'The focal plane, from the back (-1) to the front (1), in camera space.'],
    ['shapes', 'list', 'every object', 'object tags', 'Space separated tags to draw from, for example sd-orb sd-ring. Unknown tags are skipped.'],
    ['palette', 'list', 'six P3 colors', 'any CSS colors', 'Space separated colors to pick from.'],
  ];
  const prompt = `A solids universe is a scene that fills its box with seeded shapes in a 3D ball, seen through a perspective camera. Its children are plain objects with a data-pos (x y z in a unit ball), a size, a color, an animation with its own speed and phase. Each shape drifts on its own; the camera spins, drags and tilts toward the pointer; far shapes blur and dim with the depth of field. Change count, seed, shapes or palette to regenerate; everything else applies live.\n\n${optionsMd(rows)}\n\n\`\`\`html\n{{markup}}\n\`\`\``;
  page('universe.html', { title: 'Universe', description: 'A scene that fills its box with seeded shapes in 3D, with a camera you can spin and drag, a depth of field and optional collisions.', main: `<h1>Universe</h1><p class="lede">One element fills its box with a cloud of shapes in three dimensions. Spin it, drag it, set the focal plane, turn on collisions.</p>${preview({ tag: 'sd-universe', sceneAttrs: 'count="36" dpr="1.5"', inner: '', controls, prompt, stageClass: 'scatter universe' })}
<h2>How a universe works</h2><p><code>&lt;sd-universe&gt;</code> is a scene. On first connect it creates its children from a seeded random sequence: a shape, a spot in a unit ball chosen to keep its distance from the others, a size, a color, and an animation with its own speed and phase. They are ordinary objects in the light DOM with a <code>data-pos</code>, so Copy code gives you markup you can paste and edit; a universe that already has children keeps them.</p>
<p>Every frame the universe moves its shapes and places them through a camera. Shapes drift and wobble on their own paths and turn back at the edge of the ball; with <code>collide</code> they bounce off each other. The camera sits at a distance set by <code>perspective</code> and turns with the tokens in <code>camera</code>: <code>spin</code> on its own, <code>drag</code> with the pointer or a swipe (with inertia), <code>pointer</code> as a tilt toward the cursor.</p>
<p>Depth comes from the camera: near shapes draw larger and on top, far ones smaller and behind. Each shape gets the <code>defocus</code> effect with a radius of <code>depth</code> times its distance from the <code>focus</code> plane, times 14 px, and shapes behind the plane are dimmed. Under reduced motion nothing moves on its own; drag and the pointer tilt still work.</p>
<h2>Options</h2>${optionsTable(rows)}
${license}` });
}

// --- static files ---
copyFileSync('site/src/styles.css', `${OUT}/styles.css`);
copyFileSync('site/src/site.js', `${OUT}/site.js`);
copyFileSync('dist/solids.js', `${OUT}/solids.js`);
copyFileSync('dist/solids.js.map', `${OUT}/solids.js.map`);
copyFileSync('docs/SKILL.md', `${OUT}/skill.md`);
// llms.txt (llmstxt.org shape): title, a one-paragraph summary, then one link line per page.
const entries = (dir, list) => list.map((x) => `- [${x.name}](${BASE}${dir}/${x.name}.html): ${x.description}`).join('\n');
writeFileSync(`${OUT}/llms.txt`, `# solids

> Lightweight 3D objects for the web: glassy shapes as web components such as <sd-orb>, each drawn by a fragment shader. Load ${SCRIPT} as a module, then use the tags in HTML; objects can animate, take post effects, and interact inside an <sd-scene>; <sd-universe> fills a box with a cloud of shapes in 3D behind a camera you can spin and drag. To add an object or an effect, read skill.md: it is the whole contract, written for coding agents, and npm run check validates the result.

## Contract

- [skill.md](${SKILL}): how to add an object or an effect to solids.

## Objects

${entries('objects', objects)}

## Animations

${entries('animations', animations)}

## Effects

${entries('effects', effects)}

## Shades

${entries('shades', shades)}
- [Shades](${BASE}shades.html): every shade on every object, both themes.

## Interactions

${entries('interactions', interactions)}

## Pages

- [Introduction](${BASE}index.html): install, the five layers, the catalogue.
- [Scene and gravity](${BASE}scene.html): objects in one scene and the center of gravity.
- [Universe](${BASE}universe.html): a scene that fills its box with seeded shapes in 3D, with a camera that spins and drags, a depth of field and optional collisions.
- [Text](${BASE}text.html): HTML text lifted into 3D with sd-text, in your own font, with depth, a pixel mode and every shade and interaction.
- [Performance](${BASE}performance.html): bundle sizes, a live frame meter, and a benchmark that runs in the browser.
- [Accessibility](${BASE}accessibility.html): reduced motion, focus, contrast, the context limit.
- [GitHub](${REPO}): source, README and the contribution flow.
`);
writeFileSync(`${OUT}/.nojekyll`, '');
const count = readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith('.html')).length;
console.log(`site: ${count} pages in ${OUT}`);
