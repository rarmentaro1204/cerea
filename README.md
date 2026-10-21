# Cerea — sito

Sito statico (nessuna build) pubblicato su Netlify. Pagine: `index.html` (home), `privacy/`, `404.html`.

- **SEO / GEO**: dati strutturati JSON-LD in ogni pagina, `sitemap.xml`, `robots.txt` (crawler AI ammessi) e `llms.txt`. Quando aggiungi una pagina, aggiorna sitemap e `llms.txt`.
- **Sicurezza**: intestazioni e CSP restrittiva in `netlify.toml` (nessuno script o font esterno).
- **Cache**: CSS e JS hanno la versione nell'indirizzo (`?v=…`) e il sito li ricontrolla a ogni visita.

## Pagina di prenotazione panettone (rimossa)

La pagina `/panettone/` con carrello e ordine su WhatsApp, la pagina "Condizioni di vendita" e il relativo codice sono stati tolti dal sito. Restano nella cronologia di git (commit `7dac7de` e precedenti) e si possono recuperare.

La cartella `apps-script/` (registro ordini su Google Sheets) non è usata dal sito attuale e non viene servita (`netlify.toml` la blocca con un 404): serve solo se la prenotazione tornerà online.
