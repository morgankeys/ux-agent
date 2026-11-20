import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cli } from '../../src/validate/validate.mjs';
import { designSystemConfig } from '../../src/validate/stylelint-config.mjs';
import { USAGE_MAP, details, makeProject, summary } from './helpers.mjs';

const svelte = (css, markup = '<div class="card"></div>') => `${markup}\n<style>\n${css}\n</style>\n`;

test('clean component: no findings, backlog says so, exit 0', async () => {
  const proj = makeProject({
    'src/lib/Card.svelte': svelte(
      '.card { color: var(--ds-color-on-primary); background: var(--ds-color-primary); padding: var(--ds-spacing-md); gap: 0; }',
    ),
  });
  const r = await proj.run();
  assert.equal(r.code, 0);
  assert.deepEqual(r.deviations, []);
  assert.deepEqual(r.scopingErrors, []);
  assert.match(proj.backlog(), /No deviations\./);
});

test('token files are never scanned', async () => {
  const r = await makeProject().run();
  assert.deepEqual(r.deviations, []);
});

test('hardcoded-color: hex, named, rgb(), shorthands, var() fallbacks; allowed keywords pass', async () => {
  const proj = makeProject({
    'src/lib/A.svelte': svelte(
      [
        '.a {',
        '  color: #fff;',
        '  border: 1px solid red;',
        '  background: var(--ds-color-surface, #000);',
        '  box-shadow: 0 1px 2px rgb(0 0 0 / 20%);',
        '  outline-color: currentcolor;',
        '  border-color: transparent;',
        '  background-color: rgb(from var(--ds-color-primary) r g b / 50%);',
        '}',
      ].join('\n'),
    ),
  });
  const r = await proj.run();
  assert.deepEqual(summary(r.deviations.filter((d) => d.rule === 'hardcoded-color')), [
    'hardcoded-color@4',
    'hardcoded-color@5',
    'hardcoded-color@6',
    'hardcoded-color@7',
  ]);
  assert.ok(details(r.deviations, 'hardcoded-color').includes('`color: #fff` uses a literal color.'));
});

test('raw-spacing, raw-border-radius, raw-font-size: raw lengths, including mixed with a token and in calc()', async () => {
  const proj = makeProject({
    'src/lib/A.svelte': svelte(
      [
        '.a {',
        '  padding: 20px;',
        '  margin: calc(var(--ds-spacing-md) + 4px);',
        '  gap: 0;',
        '  padding-inline: var(--ds-spacing-md);',
        '  border-radius: 8px;',
        '  border-top-left-radius: var(--ds-shape-sm);',
        '  font-size: 1.25rem;',
        '  margin-block: calc(var(--ds-spacing-md) * 2);',
        '}',
      ].join('\n'),
    ),
  });
  const r = await proj.run();
  assert.deepEqual(summary(r.deviations), ['raw-border-radius@8', 'raw-font-size@10', 'raw-spacing@4', 'raw-spacing@5']);
  assert.deepEqual(details(r.deviations, 'raw-spacing'), ['`padding: 20px` uses a raw length.', '`margin: calc(var(--ds-spacing-md) + 4px)` uses a raw length.']);
});

test('non-token-font-family and raw-typography', async () => {
  const proj = makeProject({
    'src/lib/A.svelte': svelte(
      [
        '.a {',
        '  font-family: "Inter", sans-serif;',
        '  font-weight: 600;',
        '  line-height: 1.4;',
        '  letter-spacing: 0.02em;',
        '}',
        '.b {',
        '  font-family: var(--ds-type-body-family);',
        '  font-weight: var(--ds-type-body-weight);',
        '  line-height: var(--ds-type-body-line);',
        '  letter-spacing: 0;',
        '  font-family: inherit;',
        '  font-family: var(--ds-type-body-family), sans-serif;',
        '  font-family: sans-serif;',
        '}',
        '@font-face { font-family: "Inter"; font-weight: 400; src: url(inter.woff2); }',
      ].join('\n'),
    ),
  });
  const r = await proj.run();
  assert.deepEqual(summary(r.deviations), [
    'non-token-font-family@16',
    'non-token-font-family@4',
    'raw-typography@5',
    'raw-typography@6',
    'raw-typography@7',
  ]);
});

test('non-token-variable: definitions and references outside the namespace; allowed patterns pass', async () => {
  const proj = makeProject({
    'src/lib/A.svelte': svelte('.a { --gap: 4px; padding: var(--other-space); margin: var(--tw-space-x); }'),
  });
  const r = await proj.run();
  assert.deepEqual(details(r.deviations, 'non-token-variable'), [
    '`--gap` is a CSS variable outside the token namespace (`--ds-*`).',
    '`--other-space` is a CSS variable outside the token namespace (`--ds-*`).',
  ]);
});

test('local-token-override: literal redefinition in a component; a token-to-token alias passes', async () => {
  const proj = makeProject({
    'src/lib/A.svelte': svelte('.a { --ds-color-surface: #221f17; }\n.b { --ds-color-surface: var(--ds-color-primary); }'),
  });
  const r = await proj.run();
  assert.deepEqual(details(r.deviations, 'local-token-override'), [
    '`--ds-color-surface` redefines a namespace token with a literal value: `#221f17`.',
  ]);
});

test('token usage: wrong property (scope and group), not for direct use, wrong context, unpaired, unclassified', async () => {
  const proj = makeProject({
    'src/lib/A.svelte': svelte(
      [
        '.a { font-size: var(--ds-spacing-md); }',
        '.b { color: var(--ds-ref-blue-500); }',
        '.c { background: var(--ds-color-state-hover); }',
        '.c:hover { background: var(--ds-color-state-hover); }',
        '.d { color: var(--ds-color-on-primary); background: var(--ds-color-surface); }',
        '.e { color: var(--ds-color-on-primary); background: var(--ds-color-primary); }',
        '.f { padding: var(--ds-misc-thing); }',
      ].join('\n'),
    ),
  });
  const r = await proj.run();
  const d = (rule) => details(r.deviations, rule);
  assert.deepEqual(d('token-wrong-property').sort(), [
    '`--ds-spacing-md` in `font-size` is outside group `spacing`.',
    '`--ds-spacing-md` in `font-size` is outside its Figma scopes (`GAP`).',
  ]);
  assert.deepEqual(d('token-not-for-direct-use'), ['`--ds-ref-blue-500` in `color` is not for direct use (group `primitive`).']);
  assert.deepEqual(summary(r.deviations.filter((x) => x.rule === 'token-wrong-context')), ['token-wrong-context@5']);
  assert.deepEqual(d('token-unpaired'), [
    '`--ds-color-on-primary` in `color` is paired with `--ds-color-surface` in `background`, outside the pairs of group `on-color`.',
  ]);
  assert.deepEqual(d('token-unclassified'), ['`--ds-misc-thing` has no restricting Figma scope and no usage-map group.']);
});

test('usage-map warning for a group that matches no token; no manifest turns scope checks off', async () => {
  const r = await makeProject().run();
  assert.match(r.output, /usage-map group `unused` matches no token/);
  const r2 = await makeProject({}, { manifest: null }).run();
  assert.match(r2.output, /No token manifest found/);
});

// ---- Scoping ------------------------------------------------------------------------------

test('svelte: <style global> and a bare :global() are scoping errors; nested escapes pass', async () => {
  const proj = makeProject({
    'src/lib/Global.svelte': '<p>x</p>\n<style global>\np { margin: 0; }\n</style>\n',
    'src/lib/Escapes.svelte': svelte(
      [
        ':global(p) { margin: 0; }',
        '.card :global(p) { margin: 0; }',
        ':global(body) .card { margin: 0; }',
        ':global { h2 { margin: 0; } }',
        '.card :global { h3 { margin: 0; } }',
        '.card { & :global(a) { color: var(--ds-color-on-primary); } }',
      ].join('\n'),
    ),
  });
  const r = await proj.run();
  assert.equal(r.code, 1);
  assert.deepEqual(
    r.scopingErrors.map((e) => `${e.file.split('/').pop()}@${e.line} ${e.detail}`).sort(),
    [
      'Escapes.svelte@3 `:global(p)` is not nested under one of the component\'s own selectors.',
      'Escapes.svelte@6 `:global` is not nested under one of the component\'s own selectors.',
      'Global.svelte@3 `<style global>` is not scoped.',
    ],
  );
});

test('vue: a <style> without scoped or module is a scoping error', async () => {
  const proj = makeProject({
    'src/lib/Plain.vue': '<template><div class="a"/></template>\n<style>\n.a { margin: 0; }\n</style>\n',
    'src/lib/Scoped.vue': '<template><div class="a"/></template>\n<style scoped>\n.a { margin: 0; }\n</style>\n',
    'src/lib/Module.vue': '<template><div :class="$style.a"/></template>\n<style module lang="css">\n.a { margin: 0; }\n</style>\n',
  });
  const r = await proj.run();
  assert.deepEqual(
    r.scopingErrors.map((e) => `${e.file.split('/').pop()} ${e.detail}`),
    ['Plain.vue `<style>` is not scoped.'],
  );
});

test('astro: <style is:global> is a scoping error', async () => {
  const proj = makeProject({
    'src/components/Hero.astro': '---\nconst t = 1;\n---\n<h1>x</h1>\n<style is:global>\nh1 { margin: 0; }\n</style>\n',
    'src/components/Ok.astro': '---\n---\n<h1 class="t">x</h1>\n<style>\n.t { margin: 0; }\n</style>\n',
  });
  const r = await proj.run();
  assert.deepEqual(r.scopingErrors.map((e) => e.detail), ['`<style is:global>` is not scoped.']);
});

test('css modules: top-level :global() and a :global switch are errors; nested escapes pass', async () => {
  const proj = makeProject({
    'src/lib/Card.module.css': ['.card { margin: 0; }', '.card :global(.x) { margin: 0; }', ':global(.x) { margin: 0; }', ':global .y { margin: 0; }'].join('\n'),
  });
  const r = await proj.run();
  assert.deepEqual(summary(r.scopingErrors), ['unscoped-style@3', 'unscoped-style@4']);
});

test('a plain stylesheet must keep its rules inside @scope', async () => {
  const proj = makeProject({
    'src/lib/card.css': ['@scope (.card) { p { margin: 0; } }', '.card { margin: 0; }', '@media (width > 40rem) { .card { margin: 0; } }'].join('\n'),
  });
  const r = await proj.run();
  assert.deepEqual(summary(r.scopingErrors), ['unscoped-style@2', 'unscoped-style@3']);
});

test('global stylesheet: element, :root and theme rules pass; component selectors leak; allowed classes pass', async () => {
  const css = [
    'html, body { margin: 0; }',
    ':root[data-theme="dark"] { color-scheme: dark; }',
    'h1, h2 { font-family: var(--ds-type-body-family); }',
    'a:hover { color: var(--ds-color-on-primary); }',
    '.visually-hidden { position: absolute; }',
    '.card { margin: 0; }',
    '[data-component="Button"] { margin: 0; }',
    '#app { margin: 0; }',
    'a:not(.button) { margin: 0; }',
    'html[data-theme="dark"] body { margin: 0; }',
    '@keyframes spin { from { transform: rotate(0); } to { transform: rotate(1turn); } }',
  ].join('\n');
  const proj = makeProject(
    { 'src/styles/global.css': css },
    { config: { allowedGlobalClasses: [{ class: 'visually-hidden', for: 'Text for screen readers only' }] } },
  );
  const r = await proj.run();
  assert.deepEqual(r.scopingErrors.map((e) => `${e.line} ${e.detail}`), [
    '6 `.card` styles a component in the global stylesheet (`.card`).',
    '7 `[data-component="Button"]` styles a component in the global stylesheet (`[data-component]`).',
    '8 `#app` styles a component in the global stylesheet (`#app`).',
    '9 `a:not(.button)` styles a component in the global stylesheet (`.button`).',
  ]);
  // Value rules still apply in the global stylesheet; scoping errors never reach the backlog.
  assert.doesNotMatch(proj.backlog(), /global-component-leak/);
});

test('inline style attributes are not scoping errors, but their values are still checked', async () => {
  const proj = makeProject({ 'src/lib/A.svelte': '<div style="color: #fff"></div>\n' });
  const r = await proj.run();
  assert.deepEqual(r.scopingErrors, []);
  assert.deepEqual(summary(r.deviations), ['hardcoded-color@1']);
});

// ---- Exit codes, backlog, config --------------------------------------------------------

test('exit codes: 0 with deviations, 1 with --strict, 1 on a scoping error', async () => {
  const proj = makeProject({ 'src/lib/A.svelte': svelte('.a { padding: 20px; }') });
  assert.equal((await proj.run()).code, 0);
  assert.equal((await proj.run({ strict: true })).code, 1);
  proj.write('src/lib/B.vue', '<template><i/></template>\n<style>\ni { margin: 0; }\n</style>\n');
  assert.equal((await proj.run()).code, 1);
});

test('backlog: rationale carries forward across line moves, unchanged runs do not rewrite, fixed entries drop', async () => {
  const proj = makeProject({ 'src/lib/A.svelte': svelte('.a { padding: 20px; color: #fff; }') });
  let r = await proj.run();
  assert.equal(r.changed, true);
  let text = proj.backlog();
  assert.match(text, /- \*\*L3 · raw-spacing\*\* — `padding: 20px` uses a raw length\.\n {2}- Rationale: Unknown — needs review/);

  // Write a two-line rationale by hand, then move the code down three lines.
  text = text.replace(
    /(raw-spacing\*\* — .*\n) {2}- Rationale: Unknown — needs review/,
    '$1  - Rationale: The card sits on a fixed grid the spacing scale\n    does not cover yet.',
  );
  fs.writeFileSync(proj.backlogPath, text);
  proj.write('src/lib/A.svelte', svelte('\n\n\n.a { padding: 20px; color: #fff; }'));
  r = await proj.run();
  assert.equal(r.changed, true);
  text = proj.backlog();
  assert.match(text, /L6 · raw-spacing\*\* — `padding: 20px` uses a raw length\.\n {2}- Rationale: The card sits on a fixed grid the spacing scale\n {4}does not cover yet\./);

  r = await proj.run();
  assert.equal(r.changed, false);

  proj.write('src/lib/A.svelte', svelte('\n\n\n.a { padding: var(--ds-spacing-md); color: #fff; }'));
  await proj.run();
  assert.doesNotMatch(proj.backlog(), /raw-spacing|fixed grid/);
  assert.match(proj.backlog(), /\| `hardcoded-color` \| 1 \|/);
});

test('exemptions: a deviation rule can be exempted per file; a scoping rule cannot', async () => {
  const files = { 'src/styles/primitives.css': '@scope (.x) { p { color: #123456; } }' };
  const ok = makeProject(files, { config: { exemptions: [{ files: ['src/styles/primitives.css'], rules: ['hardcoded-color'], why: 'Defines primitives the export lacks.' }] } });
  assert.deepEqual((await ok.run()).deviations, []);
  const bad = makeProject(files, { config: { exemptions: [{ files: ['src/styles/primitives.css'], rules: ['unscoped-style'], why: 'no' }] } });
  const r = await bad.run();
  assert.equal(r.code, 2);
  assert.match(r.output, /Scoping errors can't be exempted/);
});

test('a placeholder namespace stops validate with a clear message', async () => {
  const r = await makeProject({}, { usageMap: { namespace: '<prefix>', groups: [] } }).run();
  assert.equal(r.code, 2);
  assert.match(r.output, /namespace is still a placeholder/);
});

test('unparseable CSS stops validate and points to lint', async () => {
  const r = await makeProject({ 'src/lib/broken.css': '@scope (.a) { p { color: red; ' }).run();
  assert.equal(r.code, 2);
  assert.match(r.output, /could not be parsed/);
});

// ---- Project layout and entry points -------------------------------------------------------

test('a missing ux/config.json stops validate with exit code 2', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-validate-none-'));
  const lines = [];
  const { code } = await (await import('../../src/validate/validate.mjs')).validate({ root: dir, log: (l) => lines.push(l) });
  assert.equal(code, 2);
  assert.match(lines.join('\n'), /No ux\/config\.json/);
});

test('a missing token usage map stops validate', async () => {
  const proj = makeProject();
  fs.rmSync(path.join(proj.root, 'design-system/token-usage.json'));
  const r = await proj.run();
  assert.equal(r.code, 2);
  assert.match(r.output, /No token usage map at/);
});

test('validate.namespace overrides the namespace in the usage map', async () => {
  const proj = makeProject(
    { 'src/lib/A.svelte': svelte('.a { color: var(--zz-color-on-primary); }') },
    { config: { namespace: 'zz' }, usageMap: { ...USAGE_MAP, namespace: 'ds' }, manifest: null },
  );
  const r = await proj.run();
  assert.deepEqual(r.deviations, []);
});

test('the root is found from cwd, and a subfolder works', async () => {
  const proj = makeProject({ 'src/lib/A.svelte': svelte('.a { padding: 20px; }') });
  const lines = [];
  const { validate } = await import('../../src/validate/validate.mjs');
  const r = await validate({ cwd: path.join(proj.root, 'src/lib'), log: (l) => lines.push(l) });
  assert.equal(r.code, 0);
  assert.deepEqual(summary(r.deviations), ['raw-spacing@3']);
});

test('cli: exit codes 0, 1 (--strict and scoping), 2 (no project, bad option, placeholder namespace)', async () => {
  const quiet = (cwd) => cli([], { cwd, log: () => {} });
  const proj = makeProject({ 'src/lib/A.svelte': svelte('.a { padding: 20px; }') });
  const opts = { cwd: proj.root, log: () => {} };
  assert.equal(await cli([], opts), 0);
  assert.equal(await cli(['--strict'], opts), 1);
  assert.equal(await cli(['--nope'], opts), 2);
  proj.write('src/lib/B.vue', '<template><i/></template>\n<style>\ni { margin: 0; }\n</style>\n');
  assert.equal(await cli([], opts), 1);
  assert.equal(await quiet(fs.mkdtempSync(path.join(os.tmpdir(), 'ds-validate-none-'))), 2);
  const bad = makeProject({}, { usageMap: { namespace: '<prefix>', groups: [] } });
  assert.equal(await cli([], { cwd: bad.root, log: () => {} }), 2);
});

test('the manifest path comes from validate.manifest; a manifest that is not valid JSON stops validate', async () => {
  const proj = makeProject();
  proj.write('src/styles/tokens/manifest.json', '{ nope');
  const r = await proj.run();
  assert.equal(r.code, 2);
  assert.match(r.output, /Could not read the token manifest/);
});

test('the backlog is written where paths.designSystem says', async () => {
  const proj = makeProject({ 'src/lib/A.svelte': svelte('.a { padding: 20px; }') });
  const cfgFile = path.join(proj.root, 'ux/config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  cfg.paths = { designSystem: 'ds-docs' };
  fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  fs.cpSync(path.join(proj.root, 'design-system'), path.join(proj.root, 'ds-docs'), { recursive: true });
  const r = await proj.run();
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(proj.root, 'ds-docs/deviations-backlog.md')));
  assert.match(r.output, /Backlog updated: ds-docs\/deviations-backlog\.md/);
});

// ---- Component extensions ---------------------------------------------------------------

test('componentExtensions: a custom file type behaves like the framework it maps to', async () => {
  const files = {
    'src/lib/Plain.mdx': '<div class="a"/>\n<style>\n.a { margin: 0; }\n</style>\n',
    'src/lib/Scoped.mdx': '<div class="a"/>\n<style scoped>\n.a { margin: 0; }\n</style>\n',
  };
  const config = { include: ['src/**/*.{css,svelte,vue,astro,mdx}'], componentExtensions: { '.mdx': 'vue' } };
  const r = await makeProject(files, { config }).run();
  assert.deepEqual(r.scopingErrors.map((e) => `${e.file.split('/').pop()} ${e.detail}`), ['Plain.mdx `<style>` is not scoped.']);
  // Without the mapping the file is a plain stylesheet, which must use @scope.
  const r2 = await makeProject(files, { config: { include: config.include } }).run();
  assert.ok(r2.scopingErrors.every((e) => /outside `@scope`/.test(e.detail)));
});

test('componentExtensions: an unknown framework is a config error', async () => {
  const r = await makeProject({}, { config: { componentExtensions: { '.x': 'react' } } }).run();
  assert.equal(r.code, 2);
  assert.match(r.output, /maps \.x to `react`\. Use one of: svelte, vue, astro/);
});

test('designSystemConfig carries the project root and the custom component extensions', () => {
  const proj = makeProject({}, { config: { componentExtensions: { mdx: 'vue' } } });
  const c = designSystemConfig({ root: proj.root, extends: ['./stylelint.config.mjs'] });
  assert.deepEqual(c.extends, ['./stylelint.config.mjs']);
  assert.equal(c.rules['ds/raw-spacing'][1].root, proj.root);
  assert.equal(c.rules['ds/unscoped-style'][1].severity, 'error');
  assert.match(c.overrides[0].files[0], /mdx/);
  assert.throws(() => designSystemConfig({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'ds-validate-none-')) }), /ux\/config\.json/);
});
