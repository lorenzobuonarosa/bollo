'use strict';
// Eseguire con: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../calcolo.js');
const dati = require('../data/tariffe_2026.json');

// Gli importi usano lo spazio non separabile prima di "€": nei test lo normalizziamo.
const norm = (s) => s.replace(/ /g, ' ');

// Auto "base": persona fisica, benzina, unica auto, anno di riferimento 2026.
function auto(extra) {
  return Object.assign(
    {
      regione: 'lombardia',
      kw: 50,
      classe: 'E6',
      alimentazione: 'benzina',
      intestatario: 'persona',
      unica: true,
      annoImmatricolazione: null,
    },
    extra
  );
}
const calc = (extra) => C.calcola(dati, auto(extra));

// ---------------------------------------------------------------- casi richiesti

test('Lombardia, Euro 6, 50 kW: 129,00 €, esente', () => {
  const r = calc({ regione: 'lombardia', kw: 50 });
  assert.equal(r.bollo.importoCent, 12900);
  assert.equal(norm(r.bollo.dettaglio), '50 kW × 2,58 €/kW = 129,00 €');
  assert.equal(r.superbollo, null);
  assert.equal(r.esenzione.esente, true);
});

test('Campania, Euro 6, 50 kW: 156,00 €, esente', () => {
  const r = calc({ regione: 'campania', kw: 50 });
  assert.equal(r.bollo.importoCent, 15600);
  assert.equal(r.esenzione.esente, true);
});

test('Lazio, Euro 6, 110 kW: 100 × 2,84 + 10 × 4,26 = 326,60 €, non esente', () => {
  const r = calc({ regione: 'lazio', kw: 110 });
  assert.equal(r.bollo.importoCent, 32660);
  assert.equal(
    norm(r.bollo.dettaglio),
    '100 kW × 2,84 €/kW + 10 kW × 4,26 €/kW = 326,60 €'
  );
  assert.equal(r.esenzione.esente, false);
  assert.equal(r.esenzione.motivo, 'potenza oltre 80 kW');
});

test('Piemonte, Euro 6: 70 kW = 191,10 € e 110 kW = 320,80 € (esempi Quattroruote)', () => {
  assert.equal(calc({ regione: 'piemonte', kw: 70 }).bollo.importoCent, 19110);
  assert.equal(calc({ regione: 'piemonte', kw: 110 }).bollo.importoCent, 32080);
});

test('Piemonte, Euro 6, 53 kW = 136,74 €', () => {
  assert.equal(calc({ regione: 'piemonte', kw: 53 }).bollo.importoCent, 13674);
});

test('Bolzano, Euro 6, 60 kW = 117,60 €', () => {
  assert.equal(calc({ regione: 'pa-bolzano', kw: 60 }).bollo.importoCent, 11760);
});

test('200 kW Euro 6 in Lombardia, immatricolata 3 anni fa: 645,00 € + superbollo 300,00 €', () => {
  const r = calc({ kw: 200, annoImmatricolazione: 2023 });
  assert.equal(r.bollo.importoCent, 64500);
  assert.equal(r.superbollo.kwOltre, 15);
  assert.equal(r.superbollo.importoCent, 30000);
  assert.equal(r.totaleCent, 94500);
});

test('75 kW intestata a società: non esente, motivo "intestata a una società"', () => {
  const r = calc({ kw: 75, intestatario: 'societa' });
  assert.equal(r.esenzione.esente, false);
  assert.equal(r.esenzione.motivo, 'intestata a una società');
});

test('81 kW persona fisica: non esente, motivo "potenza oltre 80 kW"', () => {
  const r = calc({ kw: 81 });
  assert.equal(r.esenzione.esente, false);
  assert.equal(r.esenzione.motivo, 'potenza oltre 80 kW');
});

// ---------------------------------------------------------------- bollo ordinario

test('100 kW è ancora tutto a tariffa "fino a 100"; 101 kW cambia', () => {
  assert.equal(calc({ kw: 100 }).bollo.importoCent, 25800);
  assert.equal(calc({ kw: 101 }).bollo.importoCent, 25800 + 387);
});

test('1 e 999 kW: nessun errore, importi coerenti', () => {
  assert.equal(calc({ kw: 1 }).bollo.importoCent, 258);
  // 100 × 2,58 + 899 × 3,87 = 258 + 3.479,13 = 3.737,13
  assert.equal(calc({ kw: 999 }).bollo.importoCent, 373713);
});

test('Piemonte: confini delle fasce (53/54, 100/101, 130/131)', () => {
  const p = (kw, classe = 'E6') => calc({ regione: 'piemonte', kw, classe }).bollo.importoCent;
  assert.equal(p(54), 54 * 273);
  assert.equal(p(100), 100 * 273);
  assert.equal(p(101), 100 * 279 + 1 * 418);
  assert.equal(p(130), 100 * 279 + 30 * 418);
  assert.equal(p(131), 100 * 284 + 31 * 426);
  // Euro 0, fascia alta
  assert.equal(p(150, 'E0'), 100 * 330 + 50 * 495);
});

test('Piemonte: il dettaglio mostra i due addendi', () => {
  const r = calc({ regione: 'piemonte', kw: 110 });
  assert.equal(
    norm(r.bollo.dettaglio),
    '100 kW × 2,79 €/kW + 10 kW × 4,18 €/kW = 320,80 €'
  );
});

test('Tutte le Regioni e tutte le classi producono un importo positivo', () => {
  for (const reg of dati.regioni) {
    for (const cl of dati.classi) {
      for (const kw of [1, 53, 54, 100, 101, 130, 131, 185, 999]) {
        const r = C.calcola(dati, auto({ regione: reg.id, classe: cl.id, kw }));
        assert.ok(Number.isInteger(r.bollo.importoCent) && r.bollo.importoCent > 0, `${reg.id} ${cl.id} ${kw}`);
      }
    }
  }
});

test('Regione o classe sconosciuta: errore esplicito', () => {
  assert.throws(() => calc({ regione: 'atlantide' }), /Regione/);
  assert.throws(() => calc({ classe: 'E9' }), /classe/i);
});

// ---------------------------------------------------------------- superbollo

test('Superbollo: soglia a 185 kW (185 no, 186 sì)', () => {
  assert.equal(calc({ kw: 185 }).superbollo, null);
  const r = calc({ kw: 186 });
  assert.equal(r.superbollo.importoCent, 2000);
});

test('Superbollo: riduzioni 100% / 60% / 30% / 15% / 0% a 4, 5, 10, 15, 20 anni', () => {
  const sb = (eta) => calc({ kw: 200, annoImmatricolazione: 2026 - eta }).superbollo;
  assert.equal(sb(0).importoCent, 30000);
  assert.equal(sb(4).importoCent, 30000);
  assert.equal(sb(5).importoCent, 18000);
  assert.equal(sb(9).importoCent, 18000);
  assert.equal(sb(10).importoCent, 9000);
  assert.equal(sb(14).importoCent, 9000);
  assert.equal(sb(15).importoCent, 4500);
  assert.equal(sb(19).importoCent, 4500);
  assert.equal(sb(20).importoCent, 0);
  assert.equal(sb(20).dovuto, false);
});

test('Superbollo: senza anno si usa l\'importo pieno e lo si segnala', () => {
  const r = calc({ kw: 200, annoImmatricolazione: null });
  assert.equal(r.superbollo.importoCent, 30000);
  assert.equal(r.superbollo.annoNonIndicato, true);
});

test('Superbollo: anno non valido (futuro o prima del 1900) viene ignorato', () => {
  assert.equal(calc({ kw: 200, annoImmatricolazione: 2030 }).superbollo.importoCent, 30000);
  assert.equal(calc({ kw: 200, annoImmatricolazione: 1850 }).superbollo.importoCent, 30000);
});

test('Superbollo: 7 kW oltre soglia al 60% = 84,00 €', () => {
  // 192 kW = 7 kW oltre 185; auto di 6 anni (2020): 7 × 20 € × 60%
  assert.equal(calc({ kw: 192, annoImmatricolazione: 2020 }).superbollo.importoCent, 8400);
});

test('Il superbollo non si calcola per le auto elettriche', () => {
  const r = calc({ kw: 250, alimentazione: 'elettrica' });
  assert.equal(r.superbollo, null);
});

// ---------------------------------------------------------------- alimentazioni

test('Elettrica: nessun importo, solo l\'avviso', () => {
  const r = calc({ alimentazione: 'elettrica', kw: 60 });
  assert.equal(r.bollo.calcolato, false);
  assert.equal(r.bollo.importoCent, null);
  assert.equal(
    r.bollo.avviso,
    'Le auto elettriche sono esenti o hanno forti riduzioni in quasi tutte le Regioni: verifica le regole della tua Regione'
  );
  assert.equal(r.esenzione.esente, false);
  assert.equal(r.esenzione.motivo, 'alimentazione elettrica');
  assert.equal(r.valore, null);
});

test('GPL o metano: calcolo normale più avviso', () => {
  const r = calc({ alimentazione: 'gpl_metano', kw: 60 });
  assert.equal(r.bollo.importoCent, 15480);
  assert.equal(
    r.bollo.avviso,
    'Molte Regioni prevedono esenzioni o riduzioni per GPL e metano: l\'importo può essere più basso'
  );
});

test('Ibrida: calcolo normale più avviso', () => {
  const r = calc({ alimentazione: 'ibrida', kw: 60 });
  assert.equal(r.bollo.importoCent, 15480);
  assert.equal(r.bollo.avviso, 'Alcune Regioni riducono il bollo per le ibride nei primi anni');
  assert.equal(r.esenzione.esente, true);
});

test('Benzina e gasolio: nessun avviso', () => {
  assert.equal(calc({ alimentazione: 'benzina' }).bollo.avviso, null);
  assert.equal(calc({ alimentazione: 'gasolio' }).bollo.avviso, null);
});

// ---------------------------------------------------------------- esenzione 2027

test('Esenzione: 80 kW sì, 81 kW no', () => {
  assert.equal(calc({ kw: 80 }).esenzione.esente, true);
  assert.equal(calc({ kw: 81 }).esenzione.esente, false);
});

test('Esenzione: casella "unica o meno potente" non spuntata', () => {
  const r = calc({ kw: 60, unica: false });
  assert.equal(r.esenzione.esente, false);
  assert.equal(r.esenzione.motivo, 'non è l\'auto meno potente');
});

test('Esenzione: benzina, gasolio e ibrida sì; GPL/metano ed elettrica no', () => {
  const e = (alimentazione) => calc({ kw: 60, alimentazione }).esenzione;
  assert.equal(e('benzina').esente, true);
  assert.equal(e('gasolio').esente, true);
  assert.equal(e('ibrida').esente, true);
  assert.equal(e('gpl_metano').esente, false);
  assert.equal(e('elettrica').esente, false);
});

test('Esenzione: con più motivi vince il primo in ordine (intestatario, alimentazione, potenza, casella)', () => {
  const r = calc({ kw: 120, intestatario: 'societa', alimentazione: 'elettrica', unica: false });
  assert.equal(r.esenzione.motivo, 'intestata a una società');
  const r2 = calc({ kw: 120, alimentazione: 'elettrica', unica: false });
  assert.equal(r2.esenzione.motivo, 'alimentazione elettrica');
  const r3 = calc({ kw: 120, unica: false });
  assert.equal(r3.esenzione.motivo, 'potenza oltre 80 kW');
});

test('Esenzione: ogni esito "no" ha una frase di spiegazione', () => {
  for (const extra of [
    { intestatario: 'societa' },
    { alimentazione: 'elettrica' },
    { alimentazione: 'gpl_metano' },
    { kw: 90 },
    { unica: false },
  ]) {
    const e = calc(extra).esenzione;
    assert.equal(e.esente, false);
    assert.ok(e.motivo && e.frase && e.frase.endsWith('.'), JSON.stringify(extra));
  }
});

test('Esenzione: note per Friuli Venezia Giulia, Sardegna, Trento e Bolzano (solo se esente)', () => {
  const nota = (regione, extra) => calc(Object.assign({ regione, kw: 60 }, extra)).esenzione.nota;
  const fvg = 'In Friuli Venezia Giulia e Sardegna il bollo è un tributo statale: l\'esenzione vale anche lì';
  const pa = 'L\'esenzione si applica previo accordo tra lo Stato e la Provincia autonoma';
  assert.equal(nota('friuli-venezia-giulia'), fvg);
  assert.equal(nota('sardegna'), fvg);
  assert.equal(nota('pa-trento'), pa);
  assert.equal(nota('pa-bolzano'), pa);
  assert.equal(nota('lombardia'), null);
  assert.equal(nota('sardegna', { kw: 90 }), null);
});

// ---------------------------------------------------------------- quanto vale

test('Compensazione media: 2.293,5 milioni / 24,6 milioni ≈ 93 €', () => {
  const c = C.compensazioneMediaCent(dati);
  assert.equal(c, 9323);
  assert.equal(Math.round(c / 100), 93);
});

test('Valore: se esente, risparmio = bollo 2026 e confronto con la compensazione', () => {
  const r = calc({ kw: 50 }); // 129,00 €
  assert.equal(r.valore.risparmioCent, 12900);
  assert.equal(r.valore.compensazioneCent, 9323);
  assert.equal(r.valore.differenzaCent, 12900 - 9323);
});

test('Valore: se non esente, nessun risparmio', () => {
  assert.equal(calc({ kw: 120 }).valore, null);
});

// ---------------------------------------------------------------- formati e validazione

test('formatEuro: virgola decimale, punto per le migliaia, € dopo la cifra', () => {
  assert.equal(norm(C.formatEuro(19880)), '198,80 €');
  assert.equal(norm(C.formatEuro(64500)), '645,00 €');
  assert.equal(norm(C.formatEuro(373713)), '3.737,13 €');
  assert.equal(norm(C.formatEuro(1234567)), '12.345,67 €');
  assert.equal(norm(C.formatEuro(5)), '0,05 €');
  assert.equal(norm(C.formatEuro(0)), '0,00 €');
});

test('formatTariffa: due decimali con la virgola', () => {
  assert.equal(C.formatTariffa(284), '2,84');
  assert.equal(C.formatTariffa(300), '3,00');
});

test('Dettaglio con tariffa e importo come da esempio: 70 kW × 2,84 €/kW = 198,80 €', () => {
  const r = calc({ regione: 'lazio', kw: 70 });
  assert.equal(norm(r.bollo.dettaglio), '70 kW × 2,84 €/kW = 198,80 €');
});

test('validaIntero: accetta solo interi nell\'intervallo', () => {
  assert.deepEqual(C.validaIntero('70', 1, 999), { stato: 'ok', valore: 70 });
  assert.equal(C.validaIntero('', 1, 999).stato, 'vuoto');
  assert.equal(C.validaIntero('   ', 1, 999).stato, 'vuoto');
  assert.equal(C.validaIntero('0', 1, 999).stato, 'errore');
  assert.equal(C.validaIntero('1000', 1, 999).stato, 'errore');
  assert.equal(C.validaIntero('70.5', 1, 999).stato, 'errore');
  assert.equal(C.validaIntero('70,5', 1, 999).stato, 'errore');
  assert.equal(C.validaIntero('abc', 1, 999).stato, 'errore');
  assert.equal(C.validaIntero('-3', 1, 999).stato, 'errore');
  assert.equal(C.validaIntero('1', 1, 999).valore, 1);
  assert.equal(C.validaIntero('999', 1, 999).valore, 999);
});

// ---------------------------------------------------------------- dati

test('Dati: 21 voci, id univoci, 7 classi, campi fonte e stato presenti', () => {
  assert.equal(dati.regioni.length, 21);
  assert.equal(new Set(dati.regioni.map((r) => r.id)).size, 21);
  assert.equal(dati.classi.length, 7);
  for (const r of dati.regioni) {
    assert.ok(r.fonte, r.id);
    assert.ok(['ufficiale', 'da verificare'].includes(r.stato), r.id);
    for (const cl of dati.classi) assert.ok(r.tariffe[cl.id], `${r.id} ${cl.id}`);
  }
});

test('Dati: le Regioni "da verificare" sono quelle citate nella nota fissa', () => {
  const daVerificare = dati.regioni.filter((r) => r.stato === 'da verificare').map((r) => r.nome).sort();
  assert.deepEqual(daVerificare, ['Calabria', 'Liguria', 'Marche', 'Veneto']);
});

test('Dati: le tariffe oltre 100 kW non sono mai inferiori a quelle fino a 100 kW', () => {
  for (const r of dati.regioni.filter((x) => x.modello === 'lineare')) {
    for (const cl of dati.classi) {
      const t = r.tariffe[cl.id];
      assert.ok(t.oltre100 >= t.fino100, `${r.id} ${cl.id}`);
    }
  }
});
