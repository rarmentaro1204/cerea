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
               'Importo riga (€)', 'Data ritiro', 'Ora ritiro', 'Note', 'Stato'];
var STATI = ['Da confermare', 'Confermato', 'Pronto', 'Ritirato', 'Annullato'];

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
}

function getSheet_() {
  var ss = getSpreadsheet_();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
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
    var date = text_(data.date, 10), time = text_(data.time, 5);
    if (!items.length || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return reply_({ ok: false, error: 'dati' });
    }

    var now = new Date();
    var name = safe_(text_(data.name, 80));
    var phone = text_(data.phone, 20);
    var notes = safe_(text_(data.notes, 400));
    var id = text_(data.id, 20);

    var rows = items.map(function (it) {
      var qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1));
      return [now, id, name, phone, text_(it.flavor, 80), text_(it.size, 10), qty,
              Number(it.amount) || 0, date, time, notes, 'Da confermare'];
    });

    lock.waitLock(15000);
    var sh = getSheet_();
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
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
function setup() {
  var ss = getSpreadsheet_();
  ss.setSpreadsheetTimeZone('Europe/Rome');

  var sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  sh.setName(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#efebe3');
  sh.setFrozenRows(1);
  sh.getRange('D2:D').setNumberFormat('@');
  sh.getRange('A2:A').setNumberFormat('dd/MM/yyyy HH:mm');
  sh.getRange('I2:I').setNumberFormat('ddd dd/MM/yyyy');
  sh.getRange('H2:H').setNumberFormat('#,##0.00');
  sh.getRange('L2:L1000').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATI, true).setAllowInvalid(false).build());
  sh.getRange('L2:L1000').setValue('Da confermare');
  var widths = [130, 110, 170, 130, 260, 80, 60, 110, 130, 80, 240, 120];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  if (!sh.getFilter()) sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), HEADERS.length).createFilter();

  var rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Annullato').setFontColor('#a1261a').setRanges([sh.getRange('A2:L1000')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Ritirato').setFontColor('#8a8a80').setRanges([sh.getRange('A2:L1000')]).build()
  ];
  sh.setConditionalFormatRules(rules);

  var prod = ss.getSheetByName('Produzione') || ss.insertSheet('Produzione');
  prod.clear();
  prod.getRange('A1').setFormula(
    '=QUERY(' + SHEET_NAME + '!A2:L, "select I, E, F, sum(G) where I is not null and L <> \'Annullato\' ' +
    'group by I, E, F order by I label I \'Giorno ritiro\', E \'Gusto\', F \'Pezzatura\', sum(G) \'Pezzi\'", 0)');
  prod.getRange('A:A').setNumberFormat('ddd dd/MM/yyyy');
  prod.setColumnWidths(1, 1, 150); prod.setColumnWidths(2, 1, 290); prod.setColumnWidths(3, 2, 90);
  prod.getRange('A1:D1').setFontWeight('bold').setBackground('#efebe3');
  prod.setFrozenRows(1);
}
