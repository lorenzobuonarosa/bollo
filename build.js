'use strict';
/*
 * Costruisce dist/index.html: un'unica pagina con CSS, JS, tariffe (JSON) e mappa incorporati.
 * Uso: node build.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { costruisciMappa } = require('./mappa.js');

const leggi = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const datiTesto = leggi('data/tariffe_2026.json');
const dati = JSON.parse(datiTesto);
const mappa = costruisciMappa(leggi('data/confini_province_flourish.csv'), JSON.parse(leggi('data/province_regioni.json')));

const nomi = Object.fromEntries(dati.regioni.map((r) => [r.id, r.nome]));
const regioniSvg = mappa.regioni
  .map((r) => `<path class="reg" data-regione="${r.id}" d="${r.d}"><title>${esc(nomi[r.id])}</title></path>`)
  .join('');

// Dentro un <script> non può comparire "</": lo si neutralizza.
const perScript = (s) => s.replace(/<\//g, '<\\/');
const jsonCompatto = perScript(JSON.stringify(dati));

const calcolo = leggi('calcolo.js');
const app = leggi('src/app.js');
for (const [nome, testo] of [['calcolo.js', calcolo], ['app.js', app]]) {
  if (/<\/script/i.test(testo)) throw new Error(nome + ' contiene </script');
}

const sostituzioni = {
  '/*__CSS__*/': leggi('src/style.css'),
  '__DATI__': jsonCompatto,
  '/*__CALCOLO__*/': calcolo,
  '/*__APP__*/': app,
  '__MAPPA_L__': String(mappa.larghezza),
  '__MAPPA_A__': String(mappa.altezza),
  '__MAPPA_REGIONI__': regioniSvg,
  '__MAPPA_CONFINI__': mappa.confini,
};

let html = leggi('src/template.html');
for (const [segnaposto, valore] of Object.entries(sostituzioni)) {
  if (!html.includes(segnaposto)) throw new Error('Segnaposto mancante nel template: ' + segnaposto);
  html = html.split(segnaposto).join(valore); // split/join: nessuna interpretazione di "$"
}
const residui = html.match(/__[A-Z_]+__/g);
if (residui) throw new Error('Segnaposto non sostituiti: ' + [...new Set(residui)].join(', '));

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);
console.log('dist/index.html: ' + Math.round(Buffer.byteLength(html) / 1024) + ' KB');
