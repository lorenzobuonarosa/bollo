'use strict';
/*
 * Costruisce la mappa d'Italia (tracciati SVG per Regione) a partire dal CSV dei confini
 * delle province (colonne Geometry = GeoJSON, Id = sigla) e dalla tabella sigla -> Regione.
 * Modulo puro, usato solo in fase di build: nel browser arriva SVG già pronto.
 *
 * - Ogni Regione è un unico tracciato (le sue province unite, senza fusione geometrica).
 * - I confini tra Regioni diverse si ricavano dai lati condivisi da due province
 *   di Regioni diverse: i lati interni a una stessa Regione vengono scartati.
 */

const SCALA = 40; // unità SVG per grado di latitudine
const LAT_MEDIA = 42; // per correggere la larghezza dei gradi di longitudine

function leggiCsv(testo) {
  const righe = [];
  let campo = '';
  let riga = [];
  let tra = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (tra) {
      if (c === '"' && testo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') tra = false;
      else campo += c;
    } else if (c === '"') tra = true;
    else if (c === ',') {
      riga.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && testo[i + 1] === '\n') i++;
      riga.push(campo);
      campo = '';
      if (riga.length > 1 || riga[0] !== '') righe.push(riga);
      riga = [];
    } else campo += c;
  }
  if (campo !== '' || riga.length) {
    riga.push(campo);
    righe.push(riga);
  }
  const intestazione = righe.shift();
  const iGeo = intestazione.indexOf('Geometry');
  const iId = intestazione.indexOf('Id');
  if (iGeo < 0 || iId < 0) throw new Error('CSV senza colonne Geometry e Id');
  return righe.map((r) => ({ id: r[iId].trim(), geometria: JSON.parse(r[iGeo]) }));
}

function anelli(geometria) {
  if (geometria.type === 'Polygon') return geometria.coordinates;
  if (geometria.type === 'MultiPolygon') return geometria.coordinates.flat();
  throw new Error('Geometria non supportata: ' + geometria.type);
}

function costruisciMappa(csvTesto, tabella) {
  const province = leggiCsv(csvTesto);

  const regioneDi = {};
  for (const [regione, sigle] of Object.entries(tabella.regioni)) {
    for (const s of sigle) {
      if (regioneDi[s]) throw new Error('Sigla in due Regioni: ' + s);
      regioneDi[s] = regione;
    }
  }
  const senzaRegione = province.filter((p) => !regioneDi[p.id]).map((p) => p.id);
  if (senzaRegione.length) throw new Error('Province senza Regione: ' + senzaRegione.join(', '));
  const senzaGeometria = Object.keys(regioneDi).filter((s) => !province.some((p) => p.id === s));
  if (senzaGeometria.length) throw new Error('Sigle senza geometria: ' + senzaGeometria.join(', '));

  // Estremi per la proiezione (equirettangolare corretta).
  let lonMin = Infinity;
  let latMax = -Infinity;
  let lonMax = -Infinity;
  let latMin = Infinity;
  for (const p of province) {
    for (const anello of anelli(p.geometria)) {
      for (const [lon, lat] of anello) {
        lonMin = Math.min(lonMin, lon);
        lonMax = Math.max(lonMax, lon);
        latMin = Math.min(latMin, lat);
        latMax = Math.max(latMax, lat);
      }
    }
  }
  const kx = Math.cos((LAT_MEDIA * Math.PI) / 180) * SCALA;
  const proietta = ([lon, lat]) => [
    Math.round((lon - lonMin) * kx * 10) / 10,
    Math.round((latMax - lat) * SCALA * 10) / 10,
  ];
  const larghezza = Math.ceil((lonMax - lonMin) * kx);
  const altezza = Math.ceil((latMax - latMin) * SCALA);
  const chiave = (pt) => pt[0] + ' ' + pt[1];

  const tracciati = {}; // regione -> frammenti "M..."
  const lati = new Map(); // chiave lato -> Set di Regioni che lo contengono
  const coordinateLato = new Map();

  for (const p of province) {
    const regione = regioneDi[p.id];
    for (const anello of anelli(p.geometria)) {
      const pts = [];
      for (const c of anello) {
        const pt = proietta(c);
        if (!pts.length || chiave(pts[pts.length - 1]) !== chiave(pt)) pts.push(pt);
      }
      if (pts.length > 1 && chiave(pts[0]) === chiave(pts[pts.length - 1])) pts.pop();
      if (pts.length < 3) continue;
      (tracciati[regione] = tracciati[regione] || []).push(
        'M' + pts.map((pt) => pt[0] + ' ' + pt[1]).join(' ') + 'Z'
      );
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const k = [chiave(a), chiave(b)].sort().join('|');
        if (!lati.has(k)) {
          lati.set(k, []);
          coordinateLato.set(k, [a, b]);
        }
        lati.get(k).push(p.id);
      }
    }
  }

  // Lati condivisi da due province di Regioni diverse.
  const confini = [];
  for (const [k, sigle] of lati) {
    if (sigle.length !== 2) continue;
    if (regioneDi[sigle[0]] === regioneDi[sigle[1]]) continue;
    confini.push(coordinateLato.get(k));
  }

  return {
    larghezza,
    altezza,
    regioni: Object.keys(tracciati)
      .sort()
      .map((id) => ({ id, d: tracciati[id].join('') })),
    confini: concatena(confini),
  };
}

/** Unisce i lati in polilinee: "Mx y x y x y" invece di un segmento per lato. */
function concatena(lati) {
  const chiave = (pt) => pt[0] + ' ' + pt[1];
  const perPunto = new Map();
  lati.forEach((l, i) => {
    for (const pt of l) {
      const k = chiave(pt);
      if (!perPunto.has(k)) perPunto.set(k, []);
      perPunto.get(k).push(i);
    }
  });
  const usato = new Array(lati.length).fill(false);
  const estendi = (catena, fine) => {
    for (;;) {
      const k = chiave(fine ? catena[catena.length - 1] : catena[0]);
      const i = (perPunto.get(k) || []).find((j) => !usato[j]);
      if (i === undefined) return;
      usato[i] = true;
      const [a, b] = lati[i];
      const altro = chiave(a) === k ? b : a;
      if (fine) catena.push(altro);
      else catena.unshift(altro);
    }
  };
  const parti = [];
  for (let i = 0; i < lati.length; i++) {
    if (usato[i]) continue;
    usato[i] = true;
    const catena = [lati[i][0], lati[i][1]];
    estendi(catena, true);
    estendi(catena, false);
    parti.push('M' + catena.map((pt) => pt[0] + ' ' + pt[1]).join(' '));
  }
  return parti.join('');
}

module.exports = { costruisciMappa, leggiCsv };
