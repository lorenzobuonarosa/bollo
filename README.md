# Calcolatore bollo auto 2026 ed esenzione 2027

Pagina autonoma per l'articolo Radar sull'esenzione dal bollo fino a 80 kW (art. 3, A.C. 3174).

```bash
npm test         # test della logica e della build (node --test)
npm run build    # genera dist/index.html
```

`dist/index.html` è il file da pubblicare: CSS, JavaScript, e tariffe sono incorporati. L'unica risorsa esterna è il font Inter (Google Fonts).

## Struttura

| File | Cosa contiene |
| --- | --- |
| `data/tariffe_2026.json` | Tariffe per Regione e classe, parametri del superbollo e dell'esenzione, compensazione media, testi degli avvisi. Ogni Regione ha `fonte` e `stato` (`ufficiale` / `da verificare`). |
| `calcolo.js` | Logica pura, senza DOM. Importi in centesimi interi. |
| `src/` | Template HTML, CSS e JavaScript dell'interfaccia. |
| `test/` | Test con `node --test`. |

## Aggiornare le tariffe

Modifica solo `data/tariffe_2026.json`, poi `npm test` e `npm run build`. Un test controlla che le Regioni con `stato: "da verificare"` siano le stesse citate nella nota fissa sotto il calcolatore (Calabria, Liguria, Marche, Veneto): se ne cambi una, aggiorna anche la nota in `src/template.html`.

## Embed (altezza fissa)

Un solo tag, senza script né CSS nella pagina dell'articolo:

```html
<iframe src="https://lorenzobuonarosa.github.io/bollo/" title="Calcolatore del bollo auto" width="100%" height="1000" style="border:0" loading="lazy"></iframe>
```

La pagina occupa sempre 1000 px, su mobile e su desktop, e si adatta da sola alla larghezza dell'iframe:

- **720 px o più:** due colonne (form a sinistra, risultato a destra) e nota in basso.
- **sotto i 720 px:** due schede, «La tua auto» e «Risultato». Sotto il form c'è una barra con importo ed esito, e il pulsante «Dettaglio» porta alla scheda Risultato. Il pallino sulla scheda diventa verde o arancio.

Misure del contenuto più alto (auto sopra i 185 kW a GPL, con anno di immatricolazione) in un iframe vero, con margini di pagina da 16 a 300 px:

| Larghezza dell'iframe | Contenuto più alto | Scorrimento interno |
| --- | --- | --- |
| 358 px o più (iPhone e simili) | fino a 988 px | nessuno |
| 328-343 px (Android da 360-375 px) | 1029 px | 29 px, solo in quel caso |
| 288 px (telefoni da 320 px) | 1112 px | fino a 112 px, solo in quel caso |

Sotto il risultato resta spazio vuoto: è il prezzo di un'altezza fissa che non taglia mai il caso più lungo. Per cambiare l'altezza modifica insieme `--altezza` in `src/style.css` e l'attributo `height` dell'iframe (un test controlla che coincidano), poi rimisura i casi lunghi.

La pagina invia comunque `postMessage({ type: "resize", height })` al genitore. È facoltativo e non fa nulla se il genitore non lo ascolta.
