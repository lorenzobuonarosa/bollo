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

L'iframe ha un'altezza fissa che cambia con la sua larghezza, così non serve nessuno script. Il contenitore usa una container query: guarda la larghezza reale dell'iframe, non quella della finestra.

```html
<div class="bollo-wrap">
  <iframe src="https://lorenzobuonarosa.github.io/bollo/" title="Calcolatore del bollo auto" loading="lazy"></iframe>
</div>
<style>
  .bollo-wrap { container-type: inline-size; width: 100%; }
  .bollo-wrap iframe { display: block; width: 100%; border: 0; height: 920px; }
  @container (max-width: 760px) { .bollo-wrap iframe { height: 1000px; } }
  @container (max-width: 600px) { .bollo-wrap iframe { height: 1860px; } }
</style>
```

| Larghezza dell'iframe | Layout | Altezza | Contenuto più alto misurato |
| --- | --- | --- | --- |
| fino a 600 px | una colonna | 1860 px | 1851 px (a 320 px) |
| 601-760 px | due colonne | 1000 px | 969 px |
| oltre 760 px | due colonne | 920 px | 889 px |

Sotto il risultato può restare spazio vuoto, soprattutto prima che il lettore compili i campi: è voluto, serve a non tagliare mai il caso più lungo (auto sopra i 185 kW con superbollo e avvisi). Se cambi testi o tariffe, rimisura e aggiorna i tre valori.

La pagina invia comunque `postMessage({ type: "resize", height })` al genitore. È facoltativo e non fa nulla se il genitore non lo ascolta.
