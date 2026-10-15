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

## Foglio ordini (Google Sheets)

Ogni ordine viene copiato in un foglio Google: una riga per gusto e pezzatura con numero d'ordine, nome, telefono, prodotto, pezzi, importo, data e ora di ritiro, note e stato (menu a tendina: Da confermare / Confermato / Pronto / Ritirato / Annullato). Il foglio "Produzione" somma i pezzi da preparare per giorno.

Il foglio sta nel Drive del profilo aziendale di Cerea ed è collegato al sito tramite l'app web di Apps Script il cui indirizzo è in `js/order.js` (`CONFIG.sheetUrl`). Se serve rifarlo da zero, una volta sola:

1. Crea un foglio Google, aprilo → **Estensioni → Apps Script**.
2. Cancella il codice di esempio e incolla il contenuto di `apps-script/Code.gs`. Salva.
3. Scegli la funzione **setup** in alto e premi **Esegui** (autorizza l'accesso quando richiesto). Prepara intestazioni, menu "Stato" e foglio "Produzione".
4. **Distribuisci → Nuova distribuzione → Tipo: App web**. *Esegui come:* **Me**. *Chi ha accesso:* **Chiunque**. Distribuisci e copia l'URL che finisce con `/exec`.
5. Incolla l'URL in `js/order.js`, `CONFIG.sheetUrl`, e pubblica.
6. Prova: apri l'URL `/exec` nel browser (deve dire "Cerea ordini panettone: attivo"), poi fai un ordine di prova dal sito e controlla che compaia la riga.

Se cambi il codice di `Code.gs` devi creare una **nuova versione** della distribuzione. Per condividere il foglio usa il pulsante **Condividi** del foglio (anche solo in visualizzazione per chi deve vedere gli ordini). Se l'URL non è impostato, il sito continua a funzionare solo con WhatsApp.

## Foto dei panettoni

Nelle schede (`panettone/index.html`) il gusto "Pesche semi candite, caramello e nocciole" ha uno spazio riservato (`<div class="photo-slot">`). Per metterci la foto sostituisci quel `div` con
`<img src="/img/panettone-pesche.webp" alt="descrizione" width="720" height="900" loading="lazy" decoding="async">`
(immagine WebP larga circa 720 px, in `img/`).

## SEO / GEO

Dati strutturati JSON-LD in ogni pagina, `sitemap.xml`, `robots.txt` (crawler AI ammessi) e `llms.txt`. Quando aggiungi una pagina, aggiorna sitemap e `llms.txt`.
