// Generates site/dist from src/objects, src/effects, the bundle's meta, and site/src.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
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
if (!existsSync('dist/solids.js')) { console.error('run npm run build first'); process.exit(1); }
const { registry } = await import(pathToFileURL('dist/solids.js').href + '?' + Date.now());
const objects = [...registry.objects.values()].map((o) => ({ ...o.manifest, readme: readFileSync(`src/objects/${o.manifest.name}/README.md`, 'utf8') }));
const effects = [...registry.effects.values()].map((e) => e.manifest);
const animations = [...registry.animations.values()].map((a) => a.meta);
const interactions = [...registry.interactions.values()].map((i) => i.meta);

// --- helpers ---
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const shell = readFileSync('site/src/shell.html', 'utf8');
// The palette, single source: Display P3 picks outside sRGB. Browsers without P3 clip them to sRGB.
const COLORS = ['color(display-p3 0.55 0.85 1)', 'color(display-p3 0.78 0.66 1)', 'color(display-p3 1 0.55 0.8)', 'color(display-p3 0.5 1 0.85)', 'color(display-p3 1 0.8 0.5)', 'color(display-p3 0.55 1 0.6)'];
const colorOf = (i) => COLORS[i % COLORS.length];
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
  return `<h2>Getting started</h2><ul>${item('index.html', 'Introduction')}${item('accessibility.html', 'Accessibility')}${item('scene.html', 'Scene and gravity')}</ul>
<h2>Objects</h2><ul>${objects.map((o) => item(`objects/${o.name}.html`, o.name)).join('')}</ul>
<h2>Animations</h2><ul>${animations.map((a) => item(`animations/${a.name}.html`, a.name)).join('')}</ul>
<h2>Effects</h2><ul>${effects.map((e) => item(`effects/${e.name}.html`, e.name)).join('')}</ul>
<h2>Interactions</h2><ul>${interactions.map((i) => item(`interactions/${i.name}.html`, i.name)).join('')}</ul>`;
}

function page(path, { title, description, main, hero = '' }) {
  const root = path.includes('/') ? '../' : './';
  const html = shell.replace(/{{root}}/g, root).replace('{{title}}', () => esc(title)).replace('{{description}}', () => esc(description)).replace('{{nav}}', () => nav(root, path)).replace('{{main}}', () => main).replace('{{hero}}', () => hero);
  mkdirSync(`${OUT}/${path}`.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(`${OUT}/${path}`, html);
}

/** Full-viewport hero: the scene fills the first screen; title top-left, control dock at the bottom. */
function hero({ sceneAttrs, inner, controls, title, pitch, prompt }) {
  const spec = JSON.stringify({ controls, prompt }).replace(/</g, '\\u003c');
  return `<section class="hero-full">
  <div class="stage scatter hero-stage"><sd-scene id="demo" data-keep-style style="position:relative;height:100%;min-height:560px" ${sceneAttrs}>${inner}</sd-scene></div>
  <div class="hero-title"><h1>${esc(title)}</h1><p>${esc(pitch)}</p></div>
  <form id="controls" class="controls dock" onsubmit="return false"><button type="button" class="btn quiet" id="copy-prompt">Copy prompt</button><button type="button" class="btn" id="copy-code">Copy code</button></form>
  <script type="application/json" id="spec">${spec}</script>
</section>`;
}

/** Preview panel: a scene, generated controls, live markup, copy buttons. */
function preview({ sceneAttrs = '', inner, controls, prompt, stageClass = '' }) {
  const spec = JSON.stringify({ controls, prompt }).replace(/</g, '\\u003c');
  return `<div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-panel="preview">Preview</button><button role="tab" aria-selected="false" data-panel="install">Install</button></div>
<section id="preview" class="panel">
  <div class="stage ${stageClass}"><sd-scene id="demo"${stageClass.includes('scatter') ? ' data-keep-style style="position:relative;height:100%;min-height:340px"' : ''} ${sceneAttrs}>${inner}</sd-scene></div>
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

const rangeControl = (u, target, attr) => ({ kind: 'range', attr: attr ?? kebab(u.name), label: u.label, min: u.min, max: u.max, step: u.step ?? 0.01, value: u.default, default: u.default, target });
const coreControls = (target = 'object') => [
  { kind: 'color', attr: 'color', label: 'Color', value: '#9bd1ff', default: '#9bd1ff', target },
  { kind: 'select', attr: 'animation', label: 'Animation', options: ['', ...animations.map((a) => a.name)], value: '', target },
  { kind: 'range', attr: 'speed', label: 'Speed', min: 0.1, max: 3, step: 0.1, value: 1, default: 1, target },
  { kind: 'select', attr: 'state', label: 'State', options: ['', 'off', 'idle', 'busy', 'active'], value: '', target },
  { kind: 'select', attr: 'effect', label: 'Effect', options: ['', ...effects.map((e) => e.name)], value: '', target },
];
const optionsTable = (rows) => `<table><thead><tr><th>Attribute</th><th>Type</th><th>Default</th><th>Range</th><th>Description</th></tr></thead><tbody>${rows.map((r) => `<tr><td><code>${esc(r[0])}</code></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join('')}</tbody></table>`;
const optionsMd = (rows) => `| Attribute | Type | Default | Range | Description |\n|---|---|---|---|---|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`;
const CORE_ROWS = [
  ['color', 'color', '#9bd1ff', 'any CSS color, including color(display-p3 r g b)', 'Accent color of the object.'],
  ['size', 'length', '160px', 'any CSS length', 'Width and height of the object box.'],
  ['animation', 'list', 'none', animations.map((a) => a.name).join(', '), 'Space separated animations, composed in order.'],
  ['speed', 'number', '1', '0.1 to 3', 'Multiplies animation time.'],
  ['state', 'keyword', 'idle', 'off, idle, busy, active', 'Brightness level, eased on change.'],
  ['effect', 'list', 'none', effects.map((e) => e.name).join(', '), 'Space separated post effects on this object only.'],
  ['gravity', 'keyword', 'orbit', 'center, orbit, fall, none', 'Role in a gravity scene.'],
];
const license = `<h2>License</h2><p>MIT. Use it anywhere, credit appreciated.</p>`;

// --- Introduction ---
{
  // Hand-placed hero. Orbiters sit on a ring of about 27vmin around the center; the others float at the edges.
  const sz = (px) => `clamp(${Math.round(px * 0.6)}px, ${(px / 6.5).toFixed(1)}vmin, ${Math.round(px * 1.3)}px)`;
  const orbit = (tag, id, size, dx, dy, color, anim) => `<${tag} id="${id}" size="${sz(size)}" color="${color}" animation="${anim}" style="position:absolute;left:calc(50% + ${dx}vmin - ${sz(size)} / 2);top:calc(50% + ${dy}vmin - ${sz(size)} / 2)"></${tag}>`;
  const edge = (tag, id, size, left, top, color, anim) => `<${tag} id="${id}" gravity="none" size="${sz(size)}" color="${color}" animation="${anim}" style="position:absolute;left:${left}%;top:${top}%"></${tag}>`;
  const heroInner = [
    `<sd-orb id="orb" gravity="center" size="${sz(200)}" color="${colorOf(0)}" animation="breathe" glow="0.8" style="position:absolute;left:calc(50% - ${sz(200)} / 2);top:calc(50% - ${sz(200)} / 2)"></sd-orb>`,
    orbit('sd-ring', 'ring', 90, 30, -8, colorOf(1), 'spin'),
    orbit('sd-crystal', 'crystal', 80, -28, 12, colorOf(2), 'idle'),
    orbit('sd-knot', 'knot', 84, 21, 22, colorOf(3), 'spin'),
    orbit('sd-capsule', 'capsule', 70, -23, -18, colorOf(4), 'idle'),
    orbit('sd-star', 'star', 72, 6, -30, colorOf(5), 'spin'),
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
    { kind: 'range', attr: 'gravity-strength', label: 'Gravity', min: 0, max: 1, step: 0.01, value: 0.35, default: 0.6, target: 'scene' },
    ...interactions.map((i) => ({ kind: 'check', attr: 'interaction', on: i.name, label: i.name, value: ['gravity', 'pointer-follow', 'hover-lift'].includes(i.name), target: 'scene' })),
  ];
  const heroHtml = hero({
    sceneAttrs: 'interaction="gravity pointer-follow hover-lift" gravity-strength="0.35" dpr="1.5"',
    inner: heroInner, controls: heroControls,
    title: 'Lightweight 3D objects for the web',
    pitch: 'Glassy shapes you drop into HTML. One script tag, no dependencies, about 16 KB. Hover, pick a center of gravity, try an effect.',
    prompt: `This is a solids scene: glassy 3D objects as web components, one script tag, no dependencies.\n\n\`\`\`html\n<script type="module" src="${SCRIPT}"></script>\n{{markup}}\n\`\`\`\n\nThe contract for adding an object is ${SKILL}. Read it, then add a new object to this scene that fits the family.`,
  });

  // The landing under the hero: one band per `## ` heading of intro.md, live parts appended after the prose.
  // Live minis share one <sd-scene> per row (browsers keep about 16 WebGL contexts per page).
  const links = (dir, list) => `<p class="names">${list.map((x) => `<a href="${dir}/${x.name}.html">${esc(x.name)}</a>`).join('')}</p>`;
  const layer = (title, line, dir, list, mini) => `<li class="layer"><div class="mini">${mini}</div><h3>${title}</h3><p>${line}</p>${links(dir, list)}</li>`;
  const layers = `<sd-scene class="row" dpr="1.5" interaction="gravity" gravity-strength="0.9"><ul class="layers">
${layer('Objects', 'The shape. A fragment shader on a quad.', 'objects', objects, `<sd-orb size="96px" gravity="none" color="${colorOf(0)}"></sd-orb>`)}
${layer('Animations', 'Pure functions of time, composable.', 'animations', animations, `<sd-ring size="96px" gravity="none" animation="spin" color="${colorOf(1)}"></sd-ring>`)}
${layer('Effects', 'Post passes on an object or a whole scene.', 'effects', effects, `<sd-crystal size="88px" gravity="none" effect="glow" color="${colorOf(2)}"></sd-crystal>`)}
${layer('Interactions', 'Scene rules that react to the pointer and to each other.', 'interactions', interactions, `<sd-orb size="60px" gravity="center" color="${colorOf(3)}"></sd-orb><sd-star size="34px" animation="spin" color="${colorOf(4)}" style="left:46px"></sd-star>`)}
</ul></sd-scene>`;
  const catalogue = `<sd-scene class="row" dpr="1.5" interaction="hover-lift"><ul class="catalogue">${objects.map((o, i) => `<li><a href="objects/${o.name}.html"><${o.tag} size="96px" animation="idle" color="${colorOf(i)}"></${o.tag}><span>${esc(o.name)}</span></a></li>`).join('')}</ul></sd-scene>
<p class="chips"><span>Effects</span>${effects.map((e) => `<a href="effects/${e.name}.html">${esc(e.name)}</a>`).join('')}</p>
<p class="chips"><span>Interactions</span>${interactions.map((i) => `<a href="interactions/${i.name}.html">${esc(i.name)}</a>`).join('')}</p>`;
  const numbers = `<dl class="numbers"><div><dt>The whole library, gzipped</dt><dd>${(gzipSync(readFileSync('dist/solids.js')).length / 1024).toFixed(1)} KB</dd></div><div><dt>Objects on the hero, one canvas</dt><dd>${ids.length}</dd></div></dl>`;
  const live = { 'Four layers': layers, Catalogue: catalogue, Performance: numbers };
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
    { kind: 'select', attr: 'object', label: 'Object', options: objects.map((o) => o.tag), value: 'sd-orb', target: 'scene' },
    ...e.params.map((p) => rangeControl(p, 'scene', `${e.name}-${kebab(p.name)}`)),
    { kind: 'select', attr: 'effect', label: 'Scene effect', options: ['', ...effects.map((x) => x.name)], value: e.name, target: 'scene' },
  ];
  const prompt = `Effect "${e.name}": ${e.description}\n\nSet it on a scene (applies to everything) or on one object. Parameters are attributes prefixed with the effect name.\n\n${optionsMd(rows)}\n\n\`\`\`html\n{{markup}}\n\`\`\``;
  page(`effects/${e.name}.html`, { title: e.name, description: e.description, main: `<h1>${esc(e.name)}</h1><p class="lede">${esc(e.description)}</p>${preview({ sceneAttrs: `effect="${e.name}"`, inner: `<sd-orb size="220px" color="${colorOf(0)}" animation="idle"></sd-orb>`, controls, prompt })}<h2>Options</h2>${optionsTable(rows)}<p>Put <code>effect="${e.name}"</code> on a scene to process the whole canvas, or on a single object to process only that object. Chain several with spaces; they run in the order written.</p>${license}` });
});

// --- Interaction pages and the Scene page ---
const sceneInner = `<sd-orb id="orb" gravity="center" animation="breathe" color="${colorOf(0)}" size="150px" style="position:absolute;left:calc(50% - 75px);top:calc(50% - 75px)"></sd-orb>
<sd-ring id="ring" animation="spin" color="${colorOf(1)}" size="90px" style="position:absolute;left:14%;top:16%"></sd-ring>
<sd-crystal id="crystal" animation="idle" color="${colorOf(2)}" size="80px" style="position:absolute;left:76%;top:58%"></sd-crystal>
<sd-cube id="cube" animation="idle" color="${colorOf(5)}" size="64px" style="position:absolute;left:22%;top:68%"></sd-cube>
<sd-knot id="knot" animation="spin" speed="0.4" color="${colorOf(3)}" size="84px" style="position:absolute;left:70%;top:12%"></sd-knot>
<sd-prism id="prism" animation="idle" color="${colorOf(4)}" size="70px" style="position:absolute;left:48%;top:76%"></sd-prism>`;
const sceneControls = (active) => [
  { kind: 'select', attr: 'center', label: 'Center of gravity', options: ['orb', 'ring', 'crystal', 'cube', 'knot', 'prism'], value: 'orb', target: 'scene' },
  { kind: 'range', attr: 'gravity-strength', label: 'Gravity strength', min: 0, max: 1, step: 0.01, value: 0.6, default: 0.6, target: 'scene' },
  ...interactions.map((i) => ({ kind: 'check', attr: 'interaction', on: i.name, label: i.name, value: active.includes(i.name), target: 'scene' })),
  { kind: 'select', attr: 'effect', label: 'Scene effect', options: ['', ...effects.map((x) => x.name)], value: '', target: 'scene' },
];
const scenePrompt = `A solids scene holds objects on one canvas and applies interactions between them. Gravity: mark one object gravity="center"; the others orbit it by default, gravity="fall" drifts toward it and stops at gravity-gap, gravity="none" opts out. Change the center at runtime and everything eases to its new path.\n\n\`\`\`html\n{{markup}}\n\`\`\``;
page('scene.html', { title: 'Scene and gravity', description: 'Objects in one scene interact. Pick the center of gravity and watch the others follow.', main: `<h1>Scene and gravity</h1><p class="lede">Objects inside one scene share a canvas and can react to each other. Pick which object is the center of gravity.</p>${preview({ sceneAttrs: 'interaction="gravity hover-lift" gravity-strength="0.6"', inner: sceneInner, controls: sceneControls(['gravity', 'hover-lift']), prompt: scenePrompt, stageClass: 'scatter' })}
<h2>How a scene works</h2><p>A scene is a block element that owns one canvas covering its own box. Its children are placed with ordinary CSS, and each object renders centered on its layout box. Interactions may move an object visually without touching the layout, so your page never reflows.</p>
<h2>Gravity</h2>${optionsTable([['gravity', 'keyword', 'orbit', 'center, orbit, fall, none', 'On an object: its role. Exactly one center; extra centers orbit.'], ['gravity-strength', 'number', '0.6', '0 to 1', 'On the scene: orbital speed and pull.'], ['gravity-gap', 'number', '24', '0 to 200', 'On a falling object: distance it keeps from the center, in px.']])}
${license}` });
interactions.forEach((i) => {
  const rows = i.params.map((p) => [`${i.name}-${kebab(p.name)}`, 'number', String(p.default), `${p.min} to ${p.max}`, p.label]);
  const prompt = `Interaction "${i.name}": ${i.description}\n\nEnable it with interaction="${i.name}" on the scene. Several can be combined, space separated.\n\n${rows.length ? optionsMd(rows) + '\n\n' : ''}\`\`\`html\n{{markup}}\n\`\`\``;
  page(`interactions/${i.name}.html`, { title: i.name, description: i.description, main: `<h1>${esc(i.name)}</h1><p class="lede">${esc(i.description)}</p>${preview({ sceneAttrs: `interaction="${i.name}"${i.name === 'gravity' ? ' gravity-strength="0.6"' : ''}`, inner: sceneInner, controls: [...sceneControls([i.name]), ...(i.name === 'gravity' ? [] : i.params.map((p) => rangeControl(p, 'scene', `${i.name}-${kebab(p.name)}`)))], prompt, stageClass: 'scatter' })}<h2>Usage</h2><p>Set <code>interaction="${i.name}"</code> on the scene. Interactions are scene rules: they work on every object inside, whatever its type. Several run in the order written.</p>${rows.length ? `<h2>Options</h2>${optionsTable(rows)}` : ''}${license}` });
});

// --- static files ---
copyFileSync('site/src/styles.css', `${OUT}/styles.css`);
copyFileSync('site/src/site.js', `${OUT}/site.js`);
copyFileSync('dist/solids.js', `${OUT}/solids.js`);
copyFileSync('dist/solids.js.map', `${OUT}/solids.js.map`);
copyFileSync('docs/SKILL.md', `${OUT}/skill.md`);
// llms.txt (llmstxt.org shape): title, a one-paragraph summary, then one link line per page.
const entries = (dir, list) => list.map((x) => `- [${x.name}](${BASE}${dir}/${x.name}.html): ${x.description}`).join('\n');
writeFileSync(`${OUT}/llms.txt`, `# solids

> Lightweight 3D objects for the web: glassy shapes as web components such as <sd-orb>, each drawn by a fragment shader. Load ${SCRIPT} as a module, then use the tags in HTML; objects can animate, take post effects, and interact inside an <sd-scene>. To add an object or an effect, read skill.md: it is the whole contract, written for coding agents, and npm run check validates the result.

## Contract

- [skill.md](${SKILL}): how to add an object or an effect to solids.

## Objects

${entries('objects', objects)}

## Animations

${entries('animations', animations)}

## Effects

${entries('effects', effects)}

## Interactions

${entries('interactions', interactions)}

## Pages

- [Introduction](${BASE}index.html): install, the four layers, the catalogue.
- [Scene and gravity](${BASE}scene.html): objects in one scene and the center of gravity.
- [Accessibility](${BASE}accessibility.html): reduced motion, focus, contrast, the context limit.
- [GitHub](${REPO}): source, README and the contribution flow.
`);
writeFileSync(`${OUT}/.nojekyll`, '');
const count = readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith('.html')).length;
console.log(`site: ${count} pages in ${OUT}`);
