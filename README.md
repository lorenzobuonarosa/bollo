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

## Embed (un solo tag iframe, altezza fissa)

Basta il tag `<iframe>`, senza script né CSS a parte. L'altezza è fissa e passa da 1000 px (desktop) a 1900 px (mobile) in base alla larghezza della finestra, con una funzione CSS dentro l'attributo `style`. Se il CMS toglie lo `style`, resta l'attributo `height="1000"`.

```html
<iframe src="https://lorenzobuonarosa.github.io/bollo/" title="Calcolatore del bollo auto" width="100%" height="1000" style="border:0;width:100%;height:clamp(1000px, calc(1000px + (700px - 100vw) * 900), 1900px)" loading="lazy"></iframe>
```

Come funziona: sotto i 700 px di larghezza della finestra l'altezza è 1900 px, da 700 px in su è 1000 px (il passaggio avviene in un solo pixel). Dentro la pagina il layout è a una colonna sotto i 600 px di larghezza dell'iframe e a due colonne sopra.

| Finestra | Layout | Altezza | Contenuto più alto misurato |
| --- | --- | --- | --- |
| sotto i 700 px | una colonna (due se l'iframe supera 600 px) | 1900 px | 1830 px (telefono da 360 px) |
| da 700 px | due colonne | 1000 px | 969 px |

Provato in un iframe vero con margini di pagina da 16 a 300 px: nessuno scroll interno da 360 px di finestra in su. Su telefoni da 320 px il caso più lungo (auto sopra i 185 kW con superbollo e avvisi) sfora di circa 80 px e compare un piccolo scroll interno.

Sotto il risultato può restare spazio vuoto, soprattutto prima che il lettore compili i campi: serve a non tagliare mai il caso più lungo. Se cambi testi o tariffe, rimisura e aggiorna i due valori.

La pagina invia comunque `postMessage({ type: "resize", height })` al genitore. È facoltativo e non fa nulla se il genitore non lo ascolta.
