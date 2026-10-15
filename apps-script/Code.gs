/**
 * Cerea — registro ordini panettone (Google Apps Script).
 *
 * Riceve gli ordini dal sito (pagina /panettone/) e scrive una riga per ogni
 * gusto/pezzatura nel foglio "Ordini". Il foglio "Produzione" somma i pezzi per
 * giorno di ritiro.
 *
 * Installazione: vedi README.md, sezione "Foglio ordini".
 */

// Serve solo se lo script NON è collegato al foglio (Estensioni > Apps Script dal foglio lo collega
// in automatico): in quel caso incolla qui l'ID del foglio (la parte tra /d/ e /edit nell'indirizzo).
var SHEET_ID = '';
// Deve coincidere con CONFIG.sheetToken in js/order.js. Evita invii casuali da altri siti.
var TOKEN = '8675a9933ce08872a33a5b4f';

var SHEET_NAME = 'Ordini';
var HEADERS = ['Ricevuto il', 'ID ordine', 'Nome e cognome', 'Telefono', 'Gusto', 'Pezzatura', 'Pezzi',
               'Importo riga (€)', 'Data ritiro', 'Note', 'Stato'];
var STATI = ['Da confermare', 'Confermato', 'Pronto', 'Ritirato', 'Annullato'];

// Accetta sia l'ID del foglio sia l'indirizzo intero copiato dal browser.
function sheetId_() {
  var m = String(SHEET_ID).match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : String(SHEET_ID).trim();
}

function getSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();   // c'è solo se lo script è aperto DAL foglio
  if (active) return active;
  if (!sheetId_()) throw new Error('Manca SHEET_ID: incolla in cima al codice l\'indirizzo del foglio.');
  return SpreadsheetApp.openById(sheetId_());
}

function getSheet_() {
  var ss = getSpreadsheet_();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

// Titoli di colonna in riga 1 (se il foglio è ancora vuoto si usano quelli standard).
function headerRow_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var row = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  return row.some(function (h) { return h !== ''; }) ? row : HEADERS;
}

// Prima riga libera, guardando solo la colonna A (una colonna formattata o precompilata non conta).
function nextRow_(sh) {
  var vals = sh.getRange(1, 1, sh.getMaxRows(), 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (vals[i][0] !== '') return i + 2;
  }
  return 2;
}

function text_(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Evita che il testo dei clienti venga letto come formula (es. "=1+1").
function safe_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN) return reply_({ ok: false, error: 'token' });

    var items = Array.isArray(data.items) ? data.items.slice(0, 30) : [];
    var date = text_(data.date, 10);
    if (!items.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply_({ ok: false, error: 'dati' });
    }

    var now = new Date();
    var name = safe_(text_(data.name, 80));
    var phone = text_(data.phone, 20);
    var notes = safe_(text_(data.notes, 400));
    var id = text_(data.id, 20);

    // Le colonne si riconoscono dal titolo in riga 1: l'ordine delle colonne nel foglio può cambiare.
    var sh = getSheet_();
    var head = headerRow_(sh);
    var rows = items.map(function (it) {
      var qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1));
      var v = {
        'Ricevuto il': now, 'ID ordine': id, 'Nome e cognome': name, 'Telefono': phone,
        'Gusto': text_(it.flavor, 80), 'Pezzatura': text_(it.size, 10), 'Pezzi': qty,
        'Importo riga (€)': Number(it.amount) || 0, 'Data ritiro': date, 'Note': notes, 'Stato': 'Da confermare'
      };
      return head.map(function (h) { return v.hasOwnProperty(h) ? v[h] : ''; });
    });

    lock.waitLock(15000);
    var start = nextRow_(sh);
    var lastNeeded = start + rows.length - 1;
    if (lastNeeded > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), lastNeeded - sh.getMaxRows());
    sh.getRange(start, 1, rows.length, head.length).setValues(rows);
    return reply_({ ok: true, id: id });
  } catch (err) {
    return reply_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* non bloccato */ }
  }
}

// Aprendo l'indirizzo dell'app web nel browser si vede se è attiva.
function doGet() {
  return ContentService.createTextOutput('Cerea ordini panettone: attivo');
}

/**
 * Da eseguire UNA volta (menu Esegui > setup): intestazioni, formato, menu a tendina "Stato",
 * filtro e foglio "Produzione" con i pezzi da preparare per giorno.
 */
// Sostituisce le virgole con il punto e virgola, ma solo FUORI dalle virgolette (i fogli in italiano
// vogliono ";" tra gli argomenti; dentro la query "select I, E, F" le virgole devono restare).
function localizeFormula_(f) {
  var out = '', inQuotes = false;
  for (var i = 0; i < f.length; i++) {
    var c = f.charAt(i);
    if (c === '"') inQuotes = !inQuotes;
    out += (c === ',' && !inQuotes) ? ';' : c;
  }
  return out;
}

// Scrive la formula e controlla il risultato: se il foglio (per la sua lingua) non la capisce,
// la riscrive con il punto e virgola.
function setFormulaSafe_(range, formula) {
  range.setFormula(formula);
  SpreadsheetApp.flush();
  if (String(range.getDisplayValue()).indexOf('#ERROR') === 0) {
    range.setFormula(localizeFormula_(formula));
    SpreadsheetApp.flush();
  }
}

// Lettera di colonna di un titolo (A, B, C…).
function col_(name) {
  return String.fromCharCode(65 + HEADERS.indexOf(name));
}

function setup() {
  var ss = getSpreadsheet_();
  ss.setSpreadsheetTimeZone('Europe/Rome');

  var sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  sh.setName(SHEET_NAME);

  // Vecchio foglio con la colonna "Ora ritiro" (ora si sceglie solo il giorno): la tolgo.
  var current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  var oldTime = current.indexOf('Ora ritiro');
  if (oldTime >= 0) sh.deleteColumn(oldTime + 1);

  var n = HEADERS.length;
  var lastCol = col_('Stato');
  sh.getRange(1, 1, 1, n).setValues([HEADERS]).setFontWeight('bold').setBackground('#efebe3');
  sh.setFrozenRows(1);
  sh.getRange(col_('Telefono') + '2:' + col_('Telefono')).setNumberFormat('@');
  sh.getRange(col_('Ricevuto il') + '2:' + col_('Ricevuto il')).setNumberFormat('dd/MM/yyyy HH:mm');
  sh.getRange(col_('Data ritiro') + '2:' + col_('Data ritiro')).setNumberFormat('ddd dd/MM/yyyy');
  sh.getRange(col_('Importo riga (€)') + '2:' + col_('Importo riga (€)')).setNumberFormat('#,##0.00');
  sh.getRange(col_('Stato') + '2:' + col_('Stato') + '1000').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATI, true).setAllowInvalid(false).build());
  var widths = [130, 110, 170, 130, 260, 80, 60, 110, 140, 240, 120];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  if (!sh.getFilter()) sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), n).createFilter();

  var area = sh.getRange('A2:' + lastCol + '1000');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + lastCol + '2="Annullato"').setFontColor('#a1261a').setRanges([area]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + lastCol + '2="Ritirato"').setFontColor('#8a8a80').setRanges([area]).build()
  ]);

  var day = col_('Data ritiro'), flavor = col_('Gusto'), size = col_('Pezzatura'), qty = col_('Pezzi'), state = col_('Stato');
  var prod = ss.getSheetByName('Produzione') || ss.insertSheet('Produzione');
  prod.clear();
  // setFormula vuole sempre la sintassi inglese (virgole), anche se il foglio è in italiano.
  // Se la scrivi A MANO in un foglio italiano usa il punto e virgola tra gli argomenti.
  setFormulaSafe_(prod.getRange('A1'),
    '=IFERROR(QUERY(' + SHEET_NAME + '!A2:' + lastCol + ', "select ' + day + ', ' + flavor + ', ' + size + ', sum(' + qty + ') ' +
    'where ' + day + ' is not null and ' + state + ' <> \'Annullato\' group by ' + day + ', ' + flavor + ', ' + size + ' order by ' + day + ' ' +
    'label ' + day + ' \'Giorno ritiro\', ' + flavor + ' \'Gusto\', ' + size + ' \'Pezzatura\', sum(' + qty + ') \'Pezzi\'", 0), "Nessun ordine ancora")');
  prod.getRange('A:A').setNumberFormat('ddd dd/MM/yyyy');
  prod.setColumnWidths(1, 1, 150); prod.setColumnWidths(2, 1, 290); prod.setColumnWidths(3, 2, 90);
  prod.getRange('A1:D1').setFontWeight('bold').setBackground('#efebe3');
  prod.setFrozenRows(1);
}

/**
 * Prova veloce dal menu Esegui: scrive UN ordine finto nel foglio "Ordini" (nome "PROVA …").
 * Serve a controllare che lo script riesca a scrivere. Poi cancella la riga.
 * (Non eseguire doPost a mano dal menu: non ha dati e non serve.)
 */
function provaOrdine() {
  var d = new Date(); d.setDate(d.getDate() + 5);
  var giorno = Utilities.formatDate(d, 'Europe/Rome', 'yyyy-MM-dd');
  var risposta = doPost({ postData: { contents: JSON.stringify({
    token: TOKEN, id: 'PROVA-' + Utilities.formatDate(new Date(), 'Europe/Rome', 'HHmmss'),
    name: 'PROVA Mario Rossi', phone: '+393330000000', date: giorno, notes: 'ORDINE DI PROVA',
    items: [{ flavor: 'Classico', size: '750 g', qty: 2, amount: 68 }, { flavor: 'Cacao e cioccolato', size: '1 kg', qty: 1, amount: 45 }]
  }) } });
  Logger.log(risposta.getContent());
}
