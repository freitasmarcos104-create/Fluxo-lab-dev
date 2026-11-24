import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(path.join(desktop, name), 'utf8');

test('tema Windows inclui reflexo interno e estados de interação', () => {
  const css = read('glass-neon-buttons.css');
  for (const item of ['::before', '::after', ':hover', ':active', ':focus-visible',
    'prefers-reduced-motion', 'forced-colors', 'linear-gradient', 'border-radius']) {
    assert.ok(css.includes(item), 'Efeito ausente: ' + item);
  }
  assert.match(css, /data-no-glass-neon/);
  assert.match(css, /destructive/);
});

test('tema é injetado apenas na janela Electron e em URLs internas', () => {
  const main = read('main.js');
  assert.match(main, /did-finish-load/);
  assert.match(main, /isInternalUrl\(win\.webContents\.getURL\(\)\)/);
  assert.match(main, /insertCSS\(glassNeonStylesheet\)/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /sandbox: true/);
});

test('folha de estilos está incluída no instalador Windows', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.build.files.includes('glass-neon-buttons.css'));
});
