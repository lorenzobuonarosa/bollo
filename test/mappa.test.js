'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { costruisciMappa, leggiCsv } = require('../mappa.js');
const dati = require('../data/tariffe_2026.json');
const tabella = require('../data/province_regioni.json');

const csv = fs.readFileSync(path.join(__dirname, '../data/confini_province_flourish.csv'), 'utf8');

test('CSV: 103 geometrie, sigle uniche', () => {
  const p = leggiCsv(csv);
  assert.equal(p.length, 103);
  assert.equal(new Set(p.map((x) => x.id)).size, 103);
});

test('Mappa: una Regione per ogni voce del menu, nessuna in più', () => {
  const m = costruisciMappa(csv, tabella);
  assert.deepEqual(m.regioni.map((r) => r.id).sort(), dati.regioni.map((r) => r.id).sort());
});

test('Mappa: tracciati non vuoti, confini presenti, dimensioni sensate', () => {
  const m = costruisciMappa(csv, tabella);
  for (const r of m.regioni) assert.ok(r.d.startsWith('M') && r.d.length > 20, r.id);
  assert.ok(m.confini.length > 1000);
  assert.ok(m.larghezza > 200 && m.altezza > 300);
});

test('Mappa: una sigla non mappata o in due Regioni blocca la build', () => {
  const monca = { regioni: { ...tabella.regioni, lombardia: tabella.regioni.lombardia.slice(1) } };
  assert.throws(() => costruisciMappa(csv, monca), /senza Regione/);
  const doppia = { regioni: { ...tabella.regioni, umbria: [...tabella.regioni.umbria, 'MI'] } };
  assert.throws(() => costruisciMappa(csv, doppia), /due Regioni/);
});

test('Mappa: ogni Regione dei confini sta in un solo posto (Trento e Bolzano separate)', () => {
  assert.deepEqual(tabella.regioni['pa-trento'], ['TN']);
  assert.deepEqual(tabella.regioni['pa-bolzano'], ['BZ']);
});
