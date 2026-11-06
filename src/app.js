(function () {
  'use strict';

  var dati = JSON.parse(document.getElementById('dati').textContent);
  var C = window.Calcolo;
  var NBSP = ' ';

  function $(id) {
    return document.getElementById(id);
  }
  var el = {
    app: $('app'),
    regione: $('regione'),
    kw: $('kw'),
    kwErrore: $('kw-errore'),
    classe: $('classe'),
    alimentazione: $('alimentazione'),
    unica: $('unica'),
    annoCampo: $('anno-campo'),
    anno: $('anno'),
    annoErrore: $('anno-errore'),
    risultato: $('risultato'),
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function opzione(valore, testo) {
    return '<option value="' + esc(valore) + '">' + esc(testo) + '</option>';
  }

  // ------------------------------------------------------------ menu

  el.regione.insertAdjacentHTML(
    'beforeend',
    dati.regioni
      .map(function (r) {
        return opzione(r.id, r.nome);
      })
      .join('')
  );
  el.classe.insertAdjacentHTML(
    'beforeend',
    dati.classi
      .map(function (c) {
        return opzione(c.id, c.nome);
      })
      .join('')
  );
  el.alimentazione.innerHTML = dati.alimentazioni
    .map(function (a) {
      return opzione(a.id, a.nome);
    })
    .join('');

  el.anno.max = String(dati.anno_tariffe);

  // ------------------------------------------------------------ lettura dei campi

  function leggi() {
    var kwTesto = el.kw.validity.badInput ? 'non valido' : el.kw.value;
    var kw = C.validaIntero(kwTesto, C.KW_MIN, C.KW_MAX);
    var alim = el.alimentazione.value;
    var haImporto = dati.alimentazioni.filter(function (a) {
      return a.id === alim;
    })[0].calcola_importo !== false;
    var mostraAnno =
      kw.stato === 'ok' && haImporto && kw.valore > dati.superbollo.soglia_kw;

    var anno = { stato: 'vuoto' };
    if (mostraAnno) {
      var annoTesto = el.anno.validity.badInput ? 'non valido' : el.anno.value;
      anno = C.validaIntero(annoTesto, C.ANNO_MIN, dati.anno_tariffe);
    }

    return {
      regione: el.regione.value,
      classe: el.classe.value,
      alimentazione: alim,
      intestatario: document.querySelector('input[name="intestatario"]:checked').value,
      unica: el.unica.checked,
      kw: kw,
      anno: anno,
      mostraAnno: mostraAnno,
    };
  }

  // ------------------------------------------------------------ pezzi di HTML

  function euroIntero(cent) {
    return C.formatEuro(Math.round(cent / 100) * 100).replace(',00' + NBSP, NBSP);
  }

  /** 2293.5 -> "2.293,5" */
  function numeroIt(n) {
    var parti = String(n).split('.');
    parti[0] = parti[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parti.join(',');
  }

  function percentuale(quota) {
    return Math.round(quota * 100) + '%';
  }

  function htmlBollo(r) {
    var b = r.bollo;
    var h = '<article class="blocco" aria-labelledby="t-bollo"><h3 id="t-bollo" class="titolo">Bollo 2026</h3>';

    if (!b.calcolato) {
      h += '<p class="avviso">' + esc(b.avviso) + '</p>';
    } else {
      h += '<p class="importo">' + esc(C.formatEuro(b.importoCent)) + ' <small>l’anno</small></p>';
      h += '<p class="dettaglio">' + esc(b.dettaglio) + '</p>';

      var sb = r.superbollo;
      if (sb) {
        h += '<div class="riga"><p class="riga__titolo"><span>Superbollo</span><span>' + (sb.dovuto ? esc(C.formatEuro(sb.importoCent)) : 'Non dovuto') + '</span></p>';
        if (sb.dovuto) {
          var calcolo = sb.kwOltre + ' kW oltre ' + dati.superbollo.soglia_kw + ' × ' + sb.euroPerKw + ' €';
          if (sb.quota < 1) calcolo += ' × ' + percentuale(sb.quota);
          calcolo += ' = ' + C.formatEuro(sb.importoCent);
          h += '<p class="dettaglio">' + esc(calcolo) + '</p>';
        }
        if (!sb.dovuto) {
          h += '<p class="piccolo">L’auto ha ' + sb.eta + ' anni: dopo 20 anni il superbollo non si paga più.</p>';
        } else if (sb.annoNonIndicato) {
          h += '<p class="piccolo">Importo pieno. Indica l’anno di immatricolazione per vedere la riduzione.</p>';
        } else if (sb.quota < 1) {
          h += '<p class="piccolo">Ridotto perché l’auto ha ' + sb.eta + ' anni.</p>';
        }
        h += '</div>';
        h += '<div class="riga"><p class="riga__titolo riga__titolo--totale"><span>Totale 2026</span><span>' + esc(C.formatEuro(r.totaleCent)) + '</span></p></div>';
      }

      if (b.avviso) h += '<p class="avviso">' + esc(b.avviso) + '</p>';
    }

    var reg = b.regione;
    if (b.calcolato) {
      h += '<p class="piccolo fonte">Tariffa ' + esc(reg.nome) + ': ' + esc(reg.fonte) +
        (reg.stato === 'da verificare' ? '. Da verificare sul sito della Regione' : '') + '</p>';
    }
    return h + '</article>';
  }

  function htmlEsenzione(r) {
    var e = r.esenzione;
    var h = '<article class="blocco" aria-labelledby="t-esenzione"><h3 id="t-esenzione" class="titolo">Esenzione 2027</h3>';
    if (e.esente) {
      h += '<p class="esito esito--si">Sì, dal 2027 non paghi il bollo</p>';
      if (e.nota) h += '<p class="piccolo nota-regione">' + esc(e.nota) + '</p>';
    } else {
      h += '<p class="esito esito--no">No, per questa auto l’esenzione non vale</p>';
      h += '<p class="motivo">' + esc(e.frase) + '</p>';
    }
    return h + '</article>';
  }

  function htmlValore(r) {
    var h = '<article class="blocco" aria-labelledby="t-valore"><h3 id="t-valore" class="titolo">Quanto vale</h3>';
    var v = r.valore;
    if (!v) {
      return h + '<p>Nessun risparmio da calcolare: per questa auto l’esenzione non vale.</p></article>';
    }
    var max = Math.max(v.risparmioCent, v.compensazioneCent);
    var largh = function (x) {
      return Math.max(2, Math.round((x / max) * 100));
    };
    var diff = Math.abs(v.differenzaCent);
    var confronto;
    if (Math.round(diff / 100) === 0) {
      confronto = 'Il tuo risparmio è in linea con la compensazione media.';
    } else {
      confronto = 'Il tuo risparmio è di ' + euroIntero(diff) + ' ' + (v.differenzaCent > 0 ? 'più alto' : 'più basso') + ' della compensazione media.';
    }
    var c = dati.compensazione;

    h += '<p class="valore">Risparmi ' + esc(C.formatEuro(v.risparmioCent)) + ' l’anno</p>';
    h += '<div class="barre">';
    h += '<div class="barra"><div class="barra__testa"><span>Il tuo risparmio</span><strong>' + esc(C.formatEuro(v.risparmioCent)) + '</strong></div>' +
      '<div class="barra__pista" aria-hidden="true"><div class="barra__riempimento barra--risparmio" style="width:' + largh(v.risparmioCent) + '%"></div></div></div>';
    h += '<div class="barra"><div class="barra__testa"><span>Compensazione media dello Stato</span><strong>circa ' + esc(euroIntero(v.compensazioneCent)) + '</strong></div>' +
      '<div class="barra__pista" aria-hidden="true"><div class="barra__riempimento barra--compensazione" style="width:' + largh(v.compensazioneCent) + '%"></div></div></div>';
    h += '</div>';
    h += '<p class="confronto">' + esc(confronto) + '</p>';
    h += '<p class="piccolo fonte">La compensazione è quanto lo Stato trasferisce alle Regioni per ogni beneficiario: ' +
      esc(numeroIt(c.milioni_euro)) + ' milioni di euro divisi per ' +
      esc(numeroIt(c.milioni_beneficiari)) + ' milioni di beneficiari.</p>';
    return h + '</article>';
  }

  // ------------------------------------------------------------ aggiornamento

  function mostraErrore(campo, errore, messaggio) {
    errore.hidden = !messaggio;
    errore.textContent = messaggio || '';
    if (messaggio) campo.setAttribute('aria-invalid', 'true');
    else campo.removeAttribute('aria-invalid');
  }

  function aggiorna() {
    var s = leggi();

    el.annoCampo.hidden = !s.mostraAnno;
    mostraErrore(el.kw, el.kwErrore, s.kw.stato === 'errore' ? s.kw.messaggio : '');
    mostraErrore(el.anno, el.annoErrore, s.anno.stato === 'errore' ? s.anno.messaggio : '');

    var mancano = [];
    if (!s.regione) mancano.push('la Regione');
    if (s.kw.stato === 'vuoto') mancano.push('la potenza');
    if (!s.classe) mancano.push('la classe ambientale');

    if (s.kw.stato === 'errore') {
      el.risultato.innerHTML = '<p class="vuoto">' + esc(s.kw.messaggio) + ' per vedere il risultato.</p>';
      return;
    }
    if (mancano.length) {
      var elenco = mancano.length > 1 ? mancano.slice(0, -1).join(', ') + ' e ' + mancano[mancano.length - 1] : mancano[0];
      el.risultato.innerHTML = '<p class="vuoto">Per vedere il risultato scegli ' + esc(elenco) + '.</p>';
      return;
    }

    var r = C.calcola(dati, {
      regione: s.regione,
      kw: s.kw.valore,
      classe: s.classe,
      alimentazione: s.alimentazione,
      intestatario: s.intestatario,
      unica: s.unica,
      annoImmatricolazione: s.anno.stato === 'ok' ? s.anno.valore : null,
    });

    el.risultato.innerHTML = htmlBollo(r) + htmlEsenzione(r) + htmlValore(r);
  }

  el.regione.form.addEventListener('input', aggiorna);
  el.regione.form.addEventListener('change', aggiorna);
  el.regione.form.addEventListener('submit', function (ev) {
    ev.preventDefault();
  });

  // ------------------------------------------------------------ altezza per l'iframe

  var ultimaAltezza = 0;
  function inviaAltezza(forza) {
    var h = Math.ceil(el.app.getBoundingClientRect().height);
    if (h === ultimaAltezza && forza !== true) return;
    ultimaAltezza = h;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'resize', height: h }, '*');
    }
  }

  if (window.ResizeObserver) new ResizeObserver(function () { inviaAltezza(); }).observe(el.app);
  window.addEventListener('resize', function () { inviaAltezza(); });
  window.addEventListener('load', function () { inviaAltezza(true); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { inviaAltezza(); });

  aggiorna();
  inviaAltezza(true);
})();
