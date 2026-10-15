/* Cerea — prenotazione panettone.
   Nessun server: il carrello vive nel browser e l'ordine parte come messaggio WhatsApp
   precompilato (verso Cerea e, come conferma, verso il numero del cliente). */
(function () {
  'use strict';

  // ── Configurazione (modificare qui) ──────────────────────────────────────
  var CONFIG = {
    shopPhone: '393517194846',   // numero di Cerea, formato internazionale senza +
    minLeadDays: 3,              // anticipo minimo tra ordine e ritiro
    lastPickup: '2026-12-24',    // ultimo giorno di ritiro (YYYY-MM-DD)
    closedWeekdays: [0, 1],      // 0 = domenica, 1 = lunedì
    openFrom: 8 * 60,            // 08:00
    openTo: 18 * 60,             // 18:00
    slotStep: 30,                // minuti
    maxQty: 10,                  // per riga di carrello
    storageKey: 'cerea-cart-v1',
    address: 'Via Giuseppe Barbaroux 8, Torino'
  };

  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

  // ── Catalogo letto dall'HTML (unica fonte di verità) ─────────────────────
  var catalog = {};
  Array.prototype.forEach.call(document.querySelectorAll('.flavor'), function (card) {
    Array.prototype.forEach.call(card.querySelectorAll('.size-btn'), function (b) {
      var size = Number(b.dataset.size);
      catalog[card.dataset.id + '|' + size] = {
        key: card.dataset.id + '|' + size,
        name: card.dataset.name,
        size: size,
        price: Number(b.dataset.price)
      };
    });
  });

  function sizeLabel(g) { return g >= 1000 ? (g / 1000) + ' kg' : g + ' g'; }

  // ── Stato carrello ───────────────────────────────────────────────────────
  var cart = load();

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (l) {
        return l && catalog[l.k] && Number.isInteger(l.q) && l.q > 0 && l.q <= CONFIG.maxQty;
      });
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(cart)); } catch (e) { /* ignorato */ }
  }
  function total() {
    return cart.reduce(function (s, l) { return s + catalog[l.k].price * l.q; }, 0);
  }
  function announce(msg) { $('cart-status').textContent = msg; }

  function add(key) {
    var line = cart.filter(function (l) { return l.k === key; })[0];
    if (line) { line.q = Math.min(CONFIG.maxQty, line.q + 1); } else { cart.push({ k: key, q: 1 }); }
    save(); render();
    announce(catalog[key].name + ' ' + sizeLabel(catalog[key].size) + ' aggiunto al carrello');
  }
  function change(key, delta) {
    var line = cart.filter(function (l) { return l.k === key; })[0];
    if (!line) return;
    line.q += delta;
    if (line.q <= 0) cart = cart.filter(function (l) { return l !== line; });
    line.q = Math.min(line.q, CONFIG.maxQty);
    save(); render();
  }
  function remove(key) {
    cart = cart.filter(function (l) { return l.k !== key; });
    save(); render();
    announce('Articolo rimosso dal carrello');
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render() {
    var list = $('cart-lines');
    list.textContent = '';
    cart.forEach(function (l) {
      var item = catalog[l.k];
      var li = el('li', 'cart-line');

      var info = el('div');
      info.appendChild(el('div', 'name', item.name));
      info.appendChild(el('div', 'size', sizeLabel(item.size) + ' · ' + money.format(item.price)));
      li.appendChild(info);
      li.appendChild(el('div', 'line-total', money.format(item.price * l.q)));

      var ctrl = el('div', 'ctrl');
      var qty = el('div', 'qty');
      var minus = el('button', null, '−'); minus.type = 'button';
      minus.setAttribute('aria-label', 'Diminuisci quantità: ' + item.name + ' ' + sizeLabel(item.size));
      minus.dataset.act = 'dec'; minus.dataset.k = l.k;
      var out = el('output', null, String(l.q));
      var plus = el('button', null, '+'); plus.type = 'button';
      plus.setAttribute('aria-label', 'Aumenta quantità: ' + item.name + ' ' + sizeLabel(item.size));
      plus.dataset.act = 'inc'; plus.dataset.k = l.k;
      if (l.q >= CONFIG.maxQty) plus.disabled = true;
      qty.appendChild(minus); qty.appendChild(out); qty.appendChild(plus);
      ctrl.appendChild(qty);
      li.appendChild(ctrl);

      var rm = el('button', 'remove', 'Rimuovi'); rm.type = 'button';
      rm.setAttribute('aria-label', 'Rimuovi ' + item.name + ' ' + sizeLabel(item.size));
      rm.dataset.act = 'rm'; rm.dataset.k = l.k;
      var rmWrap = el('div', 'rm-wrap'); rmWrap.appendChild(rm);
      li.appendChild(rmWrap);

      list.appendChild(li);
    });

    var has = cart.length > 0;
    list.hidden = !has;
    $('cart-total').hidden = !has;
    $('cart-empty').hidden = has;
    $('total').textContent = money.format(total());
    $('bar-total').textContent = money.format(total());
    $('submit').disabled = !has;

    Array.prototype.forEach.call(document.querySelectorAll('.size-btn'), function (b) {
      var key = b.closest('.flavor').dataset.id + '|' + b.dataset.size;
      var inCart = cart.some(function (l) { return l.k === key; });
      b.classList.toggle('added', inCart);
    });
  }

  // ── Date e orari ─────────────────────────────────────────────────────────
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return iso(d) === s ? d : null;
  }
  function isOpenDay(d) { return CONFIG.closedWeekdays.indexOf(d.getDay()) === -1; }

  function firstPickup() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + CONFIG.minLeadDays);
    while (!isOpenDay(d)) d.setDate(d.getDate() + 1);
    return d;
  }

  function setupDate() {
    var input = $('date');
    var min = firstPickup();
    var max = parseISO(CONFIG.lastPickup);
    input.min = iso(min);
    input.max = CONFIG.lastPickup;
    var seasonOver = min > max;
    if (seasonOver) {
      $('date-hint').textContent = 'Le prenotazioni online per questa stagione sono chiuse. Scrivici su WhatsApp.';
      input.disabled = true; $('time').disabled = true;
    } else {
      $('date-hint').textContent = 'Ritiro da martedì a sabato, 08:00–18:00. Primo ritiro possibile: ' + longDate(min) +
        '. Ultimo: ' + longDate(max) + '.';
    }
    var sel = $('time');
    for (var m = CONFIG.openFrom; m < CONFIG.openTo; m += CONFIG.slotStep) {
      var label = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
      var o = document.createElement('option'); o.value = label; o.textContent = label; sel.appendChild(o);
    }
  }
  function longDate(d) {
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ── Telefono ─────────────────────────────────────────────────────────────
  function normalizePhone(v) {
    var s = String(v).trim();
    var plus = s.charAt(0) === '+';
    var digits = s.replace(/\D/g, '');
    if (!digits) return null;
    if (!plus) {
      if (digits.indexOf('00') === 0) digits = digits.slice(2);
      else if (digits.length <= 10 && /^[03]/.test(digits)) digits = '39' + digits;   // numero italiano senza prefisso
    }
    return digits.length >= 9 && digits.length <= 15 ? digits : null;
  }

  // ── Validazione ──────────────────────────────────────────────────────────
  function setErr(id, msg) {
    var field = $(id).closest('.field');
    var out = $(id + '-err');
    if (out) out.textContent = msg || '';
    if (field) field.classList.toggle('invalid', !!msg);
    $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function validate() {
    var ok = true, first = null;
    function fail(id, msg) { setErr(id, msg); ok = false; if (!first) first = $(id); }

    var d = parseISO($('date').value);
    var min = firstPickup(), max = parseISO(CONFIG.lastPickup);
    if (!d) fail('date', 'Scegli la data di ritiro.');
    else if (!isOpenDay(d)) fail('date', 'Siamo chiusi domenica e lunedì: scegli da martedì a sabato.');
    else if (d < min) fail('date', 'Serve un anticipo di almeno ' + CONFIG.minLeadDays + ' giorni: primo ritiro ' + longDate(min) + '.');
    else if (d > max) fail('date', 'L\'ultimo ritiro possibile è il ' + longDate(max) + '.');
    else setErr('date', '');

    if (!$('time').value) fail('time', 'Scegli l\'orario.'); else setErr('time', '');

    var name = $('name').value.trim();
    if (name.length < 2) fail('name', 'Inserisci nome e cognome.'); else setErr('name', '');

    if (!normalizePhone($('phone').value)) fail('phone', 'Inserisci un numero valido (es. 333 1234567).');
    else setErr('phone', '');

    var pr = $('privacy-err');
    if (!$('privacy').checked) { pr.textContent = 'Per procedere devi accettare privacy e condizioni.'; ok = false; if (!first) first = $('privacy'); }
    else pr.textContent = '';

    if (!cart.length) { ok = false; showAlert('Il carrello è vuoto.'); } else showAlert('');
    if (first) first.focus();
    return ok;
  }
  function showAlert(msg) { var a = $('form-alert'); a.textContent = msg; a.hidden = !msg; }

  // ── Messaggi ─────────────────────────────────────────────────────────────
  function linesText() {
    return cart.map(function (l) {
      var i = catalog[l.k];
      return '• ' + l.q + ' × Panettone ' + i.name + ' — ' + sizeLabel(i.size) + ' — ' + money.format(i.price * l.q);
    }).join('\n');
  }

  function build(data) {
    var when = longDate(data.date) + ', ore ' + data.time;
    var base = linesText() + '\n\nTotale: ' + money.format(total()) + '\nRitiro: ' + when + ' (' + CONFIG.address + ')\nPagamento al ritiro.';

    var shop = 'Ciao Cerea, vorrei prenotare:\n' + base +
      '\n\nNome: ' + data.name + '\nTelefono: +' + data.phone +
      (data.notes ? '\nNote: ' + data.notes : '') + '\n\nGrazie!';

    var me = 'Ciao ' + data.name.split(' ')[0] + ', questo è il riepilogo del tuo ordine da Cerea:\n' + base +
      '\n\nCerea ti confermerà la disponibilità su WhatsApp. Per modifiche o annullamenti scrivi al +39 351 719 4846 almeno ' +
      CONFIG.minLeadDays + ' giorni prima del ritiro.';

    return { shop: shop, me: me, summary: shop };
  }
  function wa(phone, text) { return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text); }

  // ── Eventi ───────────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var sb = e.target.closest('.size-btn');
    if (sb) { add(sb.closest('.flavor').dataset.id + '|' + sb.dataset.size); return; }
    var act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'inc') change(act.dataset.k, 1);
    else if (act.dataset.act === 'dec') change(act.dataset.k, -1);
    else if (act.dataset.act === 'rm') remove(act.dataset.k);
  });

  ['date', 'time', 'name', 'phone'].forEach(function (id) {
    $(id).addEventListener('input', function () { setErr(id, ''); });
    $(id).addEventListener('change', function () { setErr(id, ''); });
  });

  $('order-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    var data = {
      date: parseISO($('date').value),
      time: $('time').value,
      name: $('name').value.trim().replace(/\s+/g, ' '),
      phone: normalizePhone($('phone').value),
      notes: $('notes').value.trim().replace(/\s+/g, ' ')
    };
    var msgs = build(data);
    var toShop = wa(CONFIG.shopPhone, msgs.shop);
    var toMe = wa(data.phone, msgs.me);

    $('summary').textContent = msgs.summary;
    $('send-shop').href = toShop;
    $('send-me').href = toMe;
    $('order-form').hidden = true;
    $('cart-lines').hidden = true; $('cart-total').hidden = true; $('cart-empty').hidden = true;
    $('cart-h').hidden = true;
    $('done').hidden = false;
    $('done').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Il carrello si svuota: l'ordine ormai è nel messaggio.
    cart = []; save();
    $('bar-total').textContent = money.format(0);
    Array.prototype.forEach.call(document.querySelectorAll('.size-btn'), function (b) { b.classList.remove('added'); });

    window.open(toShop, '_blank', 'noopener');
  });

  $('new-order').addEventListener('click', function () {
    $('done').hidden = true;
    $('order-form').hidden = false;
    $('cart-h').hidden = false;
    $('order-form').reset();
    render();
    $('flavors').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  setupDate();
  render();
})();
