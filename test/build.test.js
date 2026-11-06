'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const radice = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(radice, 'build.js')], { stdio: 'pipe' });
const html = fs.readFileSync(path.join(radice, 'dist/index.html'), 'utf8');

test('Build: nessun segnaposto rimasto e pagina autonoma sotto i 200 KB', () => {
  assert.ok(!/__[A-Z_]+__/.test(html.replace(/__DATI__/g, '')));
  assert.ok(Buffer.byteLength(html) < 200 * 1024);
});

test('Build: nessuna risorsa esterna a parte il font Inter', () => {
  const esterni = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
  for (const u of esterni) assert.match(u, /^https:\/\/fonts\.(googleapis|gstatic)\.com/);
  assert.ok(!/<script[^>]+src=/.test(html));
});

test('Build: la nota fissa è presente per intero', () => {
  const nota =
    "Calcolo indicativo per autovetture a uso privato con pagamento annuale. Le tariffe sono quelle 2026 pubblicate da ACI e dalle Regioni; per Calabria, Liguria, Marche e Veneto vanno verificate sul sito della Regione. Non sono considerate le esenzioni e riduzioni regionali per GPL, metano, ibride, auto storiche e disabili. L'esenzione 2027 è quella prevista dall'articolo 3 del disegno di legge di bilancio 2027 e può cambiare durante l'esame parlamentare. Fonti: ACI, tariffari regionali 2026; A.C. 3174, legge di bilancio 2027.";
  assert.ok(html.includes(nota));
});

test('Build: aiuto per la potenza, font Inter, aria-live e postMessage presenti', () => {
  assert.ok(html.includes('La trovi alla voce P.2 della carta di circolazione. Se il libretto riporta solo i cavalli (CV), dividi per 1,36'));
  assert.ok(html.includes('family=Inter:wght@400;500;600;700'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes("type: 'resize'"));
});

test('Build: i dati incorporati sono quelli del JSON', () => {
  const m = html.match(/<script type="application\/json" id="dati">([\s\S]*?)<\/script>/);
  assert.deepEqual(JSON.parse(m[1]), require('../data/tariffe_2026.json'));
});
