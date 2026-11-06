'use strict';
/*
 * Costruisce dist/index.html: un'unica pagina con CSS, JS e tariffe (JSON) incorporati.
 * Uso: node build.js
 */
const fs = require('node:fs');
const path = require('node:path');

const leggi = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const dati = JSON.parse(leggi('data/tariffe_2026.json'));

// Dentro un <script> non può comparire "</": lo si neutralizza.
const perScript = (s) => s.replace(/<\//g, '<\\/');

const calcolo = leggi('calcolo.js');
const app = leggi('src/app.js');
for (const [nome, testo] of [['calcolo.js', calcolo], ['app.js', app]]) {
  if (/<\/script/i.test(testo)) throw new Error(nome + ' contiene </script');
}

const sostituzioni = {
  '/*__CSS__*/': leggi('src/style.css'),
  '__DATI__': perScript(JSON.stringify(dati)),
  '/*__CALCOLO__*/': calcolo,
  '/*__APP__*/': app,
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
