# Calcolatore bollo auto 2026 ed esenzione 2027

Pagina autonoma per l'articolo Radar sull'esenzione dal bollo fino a 80 kW (art. 3, A.C. 3174).

```bash
npm test         # test della logica, della mappa e della build (node --test)
npm run build    # genera dist/index.html
```

`dist/index.html` è il file da pubblicare: CSS, JavaScript, tariffe e mappa sono incorporati. L'unica risorsa esterna è il font Inter (Google Fonts).

## Struttura

| File | Cosa contiene |
| --- | --- |
| `data/tariffe_2026.json` | Tariffe per Regione e classe, parametri del superbollo e dell'esenzione, compensazione media, testi degli avvisi. Ogni Regione ha `fonte` e `stato` (`ufficiale` / `da verificare`). |
| `calcolo.js` | Logica pura, senza DOM. Importi in centesimi interi. |
| `mappa.js`, `data/confini_province_flourish.csv`, `data/province_regioni.json` | Mappa cliccabile: unisce le province per Regione e ricava i confini regionali. |
| `src/` | Template HTML, CSS e JavaScript dell'interfaccia. |
| `test/` | Test con `node --test`. |

## Aggiornare le tariffe

Modifica solo `data/tariffe_2026.json`, poi `npm test` e `npm run build`. Un test controlla che le Regioni con `stato: "da verificare"` siano le stesse citate nella nota fissa sotto il calcolatore (Calabria, Liguria, Marche, Veneto): se ne cambi una, aggiorna anche la nota in `src/template.html`.

## Embed

La pagina comunica la propria altezza al genitore con `postMessage({ type: "resize", height })`.

```html
<iframe id="bollo" src="https://.../index.html" title="Calcolatore del bollo auto"
        style="width:100%;border:0;height:900px" loading="lazy"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'resize' && e.source === document.getElementById('bollo').contentWindow) {
      document.getElementById('bollo').style.height = e.data.height + 'px';
    }
  });
</script>
```
