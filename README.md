# Cerea — sito

Sito statico (nessuna build) pubblicato su Netlify. Pagine: `index.html`, `panettone/`, `privacy/`, `condizioni-di-vendita/`, `404.html`.

## Prenotazione panettone

`js/order.js` → oggetto `CONFIG` in cima al file:

| Voce | Cosa fa |
| --- | --- |
| `shopPhone` | numero WhatsApp di Cerea (formato internazionale, senza `+`) |
| `minLeadDays` | anticipo minimo tra ordine e ritiro |
| `lastPickup` | ultimo giorno di ritiro (`YYYY-MM-DD`) |
| `closedWeekdays` | giorni di chiusura (0 = domenica, 1 = lunedì) |
| `openFrom` / `openTo` / `slotStep` | fasce orarie di ritiro (minuti dalla mezzanotte) |

Gusti e prezzi stanno nell'HTML di `panettone/index.html` (`data-id`, `data-name`, `data-price`): il carrello li legge da lì.
Se cambi prezzi, gusti o date aggiorna anche il JSON-LD della pagina, le FAQ, `llms.txt` e `condizioni-di-vendita/`.

L'ordine **non passa da un server**: apre WhatsApp con il messaggio già scritto e lo invia il cliente. Per l'invio automatico serve la WhatsApp Business API (a pagamento) e una Netlify Function.

## SEO / GEO

Dati strutturati JSON-LD in ogni pagina, `sitemap.xml`, `robots.txt` (crawler AI ammessi) e `llms.txt`. Quando aggiungi una pagina, aggiorna sitemap e `llms.txt`.
