// Generates site/dist from src/objects, src/effects, the bundle's meta, and site/src.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const OUT = 'site/dist';
const SCRIPT = 'https://mmaxence.github.io/solids/solids.js';
const SKILL = 'https://github.com/mmaxence/solids/blob/main/docs/SKILL.md';

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
const COLORS = ['#9bd1ff', '#c9b3ff', '#ff9bd1', '#9bffe0', '#ffd29b', '#9bffb0'];
const colorOf = (i) => COLORS[i % COLORS.length];

/** Minimal markdown: headings, paragraphs, lists, fenced code, inline code, links, bold. */
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
    if (l.startsWith('- ')) { const items = []; while (i < lines.length && lines[i].startsWith('- ')) items.push(`<li>${inline(lines[i++].slice(2))}</li>`); i--; out.push(`<ul>${items.join('')}</ul>`); continue; }
    if (l.trim()) { const p = [l]; while (lines[i + 1]?.trim() && !/^(#|- |```)/.test(lines[i + 1])) p.push(lines[++i]); out.push(`<p>${inline(p.join(' '))}</p>`); }
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

function page(path, { title, description, main }) {
  const root = path.includes('/') ? '../' : './';
  const html = shell.replace(/{{root}}/g, root).replace('{{title}}', esc(title)).replace('{{description}}', esc(description)).replace('{{nav}}', nav(root, path)).replace('{{main}}', main);
  mkdirSync(`${OUT}/${path}`.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(`${OUT}/${path}`, html);
}

/** Preview panel: a scene, generated controls, live markup, copy buttons. */
function preview({ sceneAttrs = '', inner, controls, prompt, stageClass = '' }) {
  const spec = JSON.stringify({ controls, prompt }).replace(/</g, '\\u003c');
  return `<div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-panel="preview">Preview</button><button role="tab" aria-selected="false" data-panel="install">Install</button></div>
<section id="preview" class="panel">
  <div class="stage ${stageClass}"><sd-scene id="demo" ${sceneAttrs}>${inner}</sd-scene></div>
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
  ['color', 'color', '#9bd1ff', 'any CSS hex or rgb()', 'Accent color of the object.'],
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
  const intro = md(readFileSync('site/src/intro.md', 'utf8'));
  const heroScene = `<div class="hero"><div class="stage scatter"><sd-scene interaction="gravity hover-lift" effect="glow" gravity-strength="0.5">
  <sd-orb gravity="center" animation="breathe" color="#9bd1ff" style="left:calc(50% - 90px);top:calc(50% - 90px)" size="180px"></sd-orb>
  <sd-ring animation="spin" color="#c9b3ff" size="90px" style="left:12%;top:18%"></sd-ring>
  <sd-crystal animation="idle" color="#ff9bd1" size="80px" style="left:74%;top:60%"></sd-crystal>
  <sd-cube animation="idle" color="#9bffb0" size="64px" style="left:20%;top:66%"></sd-cube>
  <sd-coil animation="spin" color="#9bffe0" size="70px" style="left:72%;top:12%"></sd-coil>
</sd-scene></div></div>`;
  const [h1, ...rest] = intro.split('\n');
  const layers = `<ul class="layers">
<li><b>Objects</b><span>${objects.map((o) => o.name).join(', ')}. Each one is a fragment shader on a quad.</span></li>
<li><b>Animations</b><span>${animations.map((a) => a.name).join(', ')}. Pure functions of time, composable.</span></li>
<li><b>Effects</b><span>${effects.map((e) => e.name).join(', ')}. Post passes on an object or a whole scene.</span></li>
<li><b>Interactions</b><span>${interactions.map((i) => i.name).join(', ')}. Scene rules that react to the pointer and to each other.</span></li></ul>`;
  const main = `${h1}${heroScene}${rest.join('\n').replace('</p>\n<h2>Sizing', `</p>${layers}\n<h2>Sizing`)}`;
  page('index.html', { title: 'solids', description: 'Lightweight 3D objects for the web. Zero dependencies.', main });
  page('accessibility.html', { title: 'Accessibility', description: 'How solids objects behave for assistive tech, reduced motion, and low-end devices.', main: md(readFileSync('site/src/accessibility.md', 'utf8')) });
}

// --- Object pages ---
objects.forEach((o, i) => {
  const rows = [...o.uniforms.map((u) => [kebab(u.name), u.type, String(u.default), u.min !== undefined ? `${u.min} to ${u.max}` : '', u.label]), ...CORE_ROWS];
  const controls = [...o.uniforms.map((u) => rangeControl(u, 'object')), ...coreControls('object')];
  controls.find((c) => c.attr === 'color').value = colorOf(i);
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
    { kind: 'select', attr: 'data-object', label: 'Object', options: objects.map((o) => o.tag), value: 'sd-orb', target: 'scene' },
    ...e.params.map((p) => rangeControl(p, 'scene', `${e.name}-${kebab(p.name)}`)),
    { kind: 'select', attr: 'effect', label: 'Scene effect', options: ['', ...effects.map((x) => x.name)], value: e.name, target: 'scene' },
  ];
  const prompt = `Effect "${e.name}": ${e.description}\n\nSet it on a scene (applies to everything) or on one object. Parameters are attributes prefixed with the effect name.\n\n${optionsMd(rows)}\n\n\`\`\`html\n{{markup}}\n\`\`\``;
  page(`effects/${e.name}.html`, { title: e.name, description: e.description, main: `<h1>${esc(e.name)}</h1><p class="lede">${esc(e.description)}</p>${preview({ sceneAttrs: `effect="${e.name}"`, inner: `<sd-orb size="220px" color="#9bd1ff" animation="idle"></sd-orb>`, controls, prompt })}<h2>Options</h2>${optionsTable(rows)}<p>Put <code>effect="${e.name}"</code> on a scene to process the whole canvas, or on a single object to process only that object. Chain several with spaces; they run in the order written.</p>${license}` });
});

// --- Interaction pages and the Scene page ---
const sceneInner = `<sd-orb id="orb" gravity="center" animation="breathe" color="#9bd1ff" size="150px" style="left:calc(50% - 75px);top:calc(50% - 75px)"></sd-orb>
<sd-ring id="ring" animation="spin" color="#c9b3ff" size="90px" style="left:14%;top:16%"></sd-ring>
<sd-crystal id="crystal" animation="idle" color="#ff9bd1" size="80px" style="left:76%;top:58%"></sd-crystal>
<sd-cube id="cube" animation="idle" color="#9bffb0" size="64px" style="left:22%;top:68%"></sd-cube>`;
const sceneControls = (active) => [
  { kind: 'select', attr: 'gravity', label: 'Center of gravity', options: ['orb', 'ring', 'crystal', 'cube'], value: 'orb', target: 'scene' },
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
  const rows = i.params.map((p) => [kebab(p.name), 'number', String(p.default), `${p.min} to ${p.max}`, p.label]);
  const prompt = `Interaction "${i.name}": ${i.description}\n\nEnable it with interaction="${i.name}" on the scene. Several can be combined, space separated.\n\n${rows.length ? optionsMd(rows) + '\n\n' : ''}\`\`\`html\n{{markup}}\n\`\`\``;
  page(`interactions/${i.name}.html`, { title: i.name, description: i.description, main: `<h1>${esc(i.name)}</h1><p class="lede">${esc(i.description)}</p>${preview({ sceneAttrs: `interaction="${i.name}"${i.name === 'gravity' ? ' gravity-strength="0.6"' : ''}`, inner: sceneInner, controls: sceneControls([i.name]), prompt, stageClass: 'scatter' })}<h2>Usage</h2><p>Set <code>interaction="${i.name}"</code> on the scene. Interactions are scene rules: they work on every object inside, whatever its type.</p>${rows.length ? `<h2>Options</h2>${optionsTable(rows)}` : ''}${license}` });
});

// --- static files ---
copyFileSync('site/src/styles.css', `${OUT}/styles.css`);
copyFileSync('site/src/site.js', `${OUT}/site.js`);
copyFileSync('dist/solids.js', `${OUT}/solids.js`);
copyFileSync('dist/solids.js.map', `${OUT}/solids.js.map`);
writeFileSync(`${OUT}/.nojekyll`, '');
const count = readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith('.html')).length;
console.log(`site: ${count} pages in ${OUT}`);
