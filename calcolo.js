/*
 * Logica di calcolo del bollo auto. Modulo puro: nessun DOM, nessuna dipendenza.
 * Funziona sia in Node (module.exports) sia nel browser (window.Calcolo).
 * Tariffe e parametri stanno in data/tariffe_2026.json e arrivano come argomento `dati`.
 * Tutti gli importi sono interi in centesimi: niente errori di virgola mobile.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calcolo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NBSP = ' ';
  var KW_MIN = 1;
  var KW_MAX = 999;
  var ANNO_MIN = 1900;

  // ------------------------------------------------------------ formati

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function raggruppa(intero) {
    return String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /** 19880 -> "198,80 €" (spazio non separabile prima del simbolo). */
  function formatEuro(cent) {
    var segno = cent < 0 ? '-' : '';
    var a = Math.abs(cent);
    return segno + raggruppa(Math.floor(a / 100)) + ',' + pad2(a % 100) + NBSP + '€';
  }

  /** 284 -> "2,84" */
  function formatTariffa(cent) {
    return Math.floor(cent / 100) + ',' + pad2(cent % 100);
  }

  // ------------------------------------------------------------ validazione

  /**
   * Valida un intero scritto dall'utente.
   * Restituisce { stato: 'vuoto' } | { stato: 'ok', valore } | { stato: 'errore', messaggio }.
   */
  function validaIntero(testo, min, max) {
    var s = testo == null ? '' : String(testo).trim();
    if (s === '') return { stato: 'vuoto' };
    var messaggio = 'Inserisci un numero intero da ' + min + ' a ' + max;
    if (!/^\d+$/.test(s)) return { stato: 'errore', messaggio: messaggio };
    var v = parseInt(s, 10);
    if (v < min || v > max) return { stato: 'errore', messaggio: messaggio };
    return { stato: 'ok', valore: v };
  }

  // ------------------------------------------------------------ dati

  function cent(tariffaEuro) {
    return Math.round(tariffaEuro * 100);
  }

  function trovaRegione(dati, id) {
    var r = dati.regioni.filter(function (x) {
      return x.id === id;
    })[0];
    if (!r) throw new Error('Regione sconosciuta: ' + id);
    return r;
  }

  function trovaAlimentazione(dati, id) {
    var a = dati.alimentazioni.filter(function (x) {
      return x.id === id;
    })[0];
    if (!a) throw new Error('Alimentazione sconosciuta: ' + id);
    return a;
  }

  // ------------------------------------------------------------ bollo ordinario

  function termine(kw, tariffaEuro) {
    var t = cent(tariffaEuro);
    return { kw: kw, tariffaCent: t, importoCent: kw * t };
  }

  /** Scompone il calcolo in addendi { kw, tariffaCent, importoCent }. */
  function termini(regione, classe, kw) {
    var t = regione.tariffe[classe];
    if (!t) throw new Error('Classe ambientale non valida: ' + classe);

    if (regione.modello === 'fasce') {
      if (kw <= 53) return [termine(kw, t.fino53)];
      if (kw <= 100) return [termine(kw, t.da54a100)];
      if (kw <= 130) {
        return [termine(100, t.primi100_101_130), termine(kw - 100, t.oltre100_101_130)];
      }
      return [termine(100, t.primi100_oltre130), termine(kw - 100, t.oltre100_oltre130)];
    }

    if (kw <= 100) return [termine(kw, t.fino100)];
    return [termine(100, t.fino100), termine(kw - 100, t.oltre100)];
  }

  function descrivi(listaTermini, totaleCent) {
    var parti = listaTermini.map(function (x) {
      return x.kw + ' kW × ' + formatTariffa(x.tariffaCent) + ' €/kW';
    });
    return parti.join(' + ') + ' = ' + formatEuro(totaleCent);
  }

  // ------------------------------------------------------------ superbollo

  /**
   * Superbollo: euro_per_kw per ogni kW oltre la soglia, ridotto in base all'età.
   * L'età è la differenza tra anno di riferimento e anno di immatricolazione.
   * Senza un anno valido si mostra l'importo pieno (annoNonIndicato = true).
   */
  function superbollo(dati, kw, annoImm, annoRif) {
    var s = dati.superbollo;
    if (kw <= s.soglia_kw) return null;

    var kwOltre = kw - s.soglia_kw;
    var pienoCent = kwOltre * s.euro_per_kw * 100;
    var annoValido = Number.isInteger(annoImm) && annoImm >= ANNO_MIN && annoImm <= annoRif;

    var quota = 1;
    var eta = null;
    if (annoValido) {
      eta = annoRif - annoImm;
      s.riduzioni.forEach(function (r) {
        if (eta >= r.da_anni) quota = r.quota;
      });
    }
    var importoCent = Math.round(pienoCent * quota);

    return {
      kwOltre: kwOltre,
      euroPerKw: s.euro_per_kw,
      importoPienoCent: pienoCent,
      quota: quota,
      eta: eta,
      importoCent: importoCent,
      dovuto: importoCent > 0,
      annoNonIndicato: !annoValido,
    };
  }

  // ------------------------------------------------------------ esenzione 2027

  /**
   * Controlla le condizioni nell'ordine: intestatario, alimentazione, potenza, casella.
   * Si ferma al primo motivo che non regge.
   */
  function esenzione(dati, regioneId, input) {
    var e = dati.esenzione;
    var no = function (codice, motivo, frase) {
      return { esente: false, codice: codice, motivo: motivo, frase: frase, nota: null };
    };

    if (input.intestatario !== 'persona') {
      return no(
        'societa',
        'intestata a una società',
        "L'auto è intestata a una società o a un ente: l'esenzione vale solo per le persone fisiche."
      );
    }
    if (input.alimentazione === 'elettrica') {
      return no(
        'elettrica',
        'alimentazione elettrica',
        "L'auto è elettrica: l'esenzione riguarda benzina, gasolio e ibride."
      );
    }
    if (e.alimentazioni_ammesse.indexOf(input.alimentazione) === -1) {
      return no(
        'alimentazione',
        'alimentazione a GPL o metano',
        "L'alimentazione a GPL o metano non è tra quelle previste: l'esenzione riguarda benzina, gasolio e ibride."
      );
    }
    if (input.kw > e.soglia_kw) {
      return no(
        'potenza',
        'potenza oltre ' + e.soglia_kw + ' kW',
        'L\'auto ha ' + input.kw + ' kW: l\'esenzione arriva fino a ' + e.soglia_kw + ' kW.'
      );
    }
    if (!input.unica) {
      return no(
        'non_meno_potente',
        "non è l'auto meno potente",
        "Non è l'unica auto fino a " +
          e.soglia_kw +
          " kW intestata a te né la meno potente: l'esenzione vale per una sola auto, la meno potente."
      );
    }
    return {
      esente: true,
      codice: 'esente',
      motivo: null,
      frase: null,
      nota: (e.note_regionali && e.note_regionali[regioneId]) || null,
    };
  }

  // ------------------------------------------------------------ compensazione

  /** Compensazione media per beneficiario, in centesimi (2.293,5 mln / 24,6 mln ≈ 93,23 €). */
  function compensazioneMediaCent(dati) {
    var c = dati.compensazione;
    return Math.round((c.milioni_euro / c.milioni_beneficiari) * 100);
  }

  // ------------------------------------------------------------ calcolo completo

  /**
   * input: { regione, kw, classe, alimentazione, intestatario: 'persona'|'societa',
   *          unica: boolean, annoImmatricolazione?: number|null, annoRiferimento?: number }
   */
  function calcola(dati, input) {
    var kw = input.kw;
    if (!Number.isInteger(kw) || kw < KW_MIN || kw > KW_MAX) {
      throw new Error('Potenza non valida: ' + kw);
    }
    var annoRif = input.annoRiferimento || dati.anno_tariffe;
    var regione = trovaRegione(dati, input.regione);
    var alim = trovaAlimentazione(dati, input.alimentazione);
    var calcolato = alim.calcola_importo !== false;

    var bollo = {
      calcolato: calcolato,
      importoCent: null,
      termini: [],
      dettaglio: null,
      avviso: alim.avviso || null,
      regione: { id: regione.id, nome: regione.nome, fonte: regione.fonte, stato: regione.stato },
    };

    var sb = null;
    var totaleCent = null;
    if (calcolato) {
      var lista = termini(regione, input.classe, kw);
      var totale = lista.reduce(function (somma, x) {
        return somma + x.importoCent;
      }, 0);
      bollo.termini = lista;
      bollo.importoCent = totale;
      bollo.dettaglio = descrivi(lista, totale);

      sb = superbollo(dati, kw, input.annoImmatricolazione, annoRif);
      totaleCent = totale + (sb ? sb.importoCent : 0);
    } else if (!regione.tariffe[input.classe]) {
      throw new Error('Classe ambientale non valida: ' + input.classe);
    }

    var esen = esenzione(dati, regione.id, input);

    var valore = null;
    if (esen.esente && calcolato) {
      var comp = compensazioneMediaCent(dati);
      valore = {
        risparmioCent: bollo.importoCent,
        compensazioneCent: comp,
        differenzaCent: bollo.importoCent - comp,
      };
    }

    return { bollo: bollo, superbollo: sb, totaleCent: totaleCent, esenzione: esen, valore: valore };
  }

  return {
    KW_MIN: KW_MIN,
    KW_MAX: KW_MAX,
    ANNO_MIN: ANNO_MIN,
    calcola: calcola,
    compensazioneMediaCent: compensazioneMediaCent,
    formatEuro: formatEuro,
    formatTariffa: formatTariffa,
    validaIntero: validaIntero,
  };
});
