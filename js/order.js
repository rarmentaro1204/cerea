/* Cerea — prenotazione panettone.
   Nessun server: il carrello vive nel browser e l'ordine parte come messaggio WhatsApp
   precompilato (verso Cerea e, come conferma, verso il numero del cliente).
   Flusso: schede gusto → barra carrello → pannello a 3 passi (Carrello, Ritiro, Dati) → WhatsApp. */
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
    // Registro ordini su Google Sheets: incollare qui l'URL dell'app web di Apps Script (vedi README).
    // Se è vuoto, l'ordine parte solo su WhatsApp.
    sheetUrl: 'https://script.google.com/macros/s/AKfycbzlFyK3HkfNbJqQNFh9bvwqZ_rVo6xlaFkTPrkEq63_WYCjJFPi3t8LFOn0qDaq5Q6k/exec',
    sheetToken: '8675a9933ce08872a33a5b4f',  // deve coincidere con TOKEN in apps-script/Code.gs
    storageKey: 'cerea-cart-v1',
    address: 'Via Giuseppe Barbaroux 8, Torino'
  };

  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  var dlg = $('checkout');
  var form = $('order-form');
  var STEPS = 3;
  var step = 1;
  var lastFocus = null;

  // ── Catalogo letto dall'HTML (unica fonte di verità) ─────────────────────
  var catalog = {};
  Array.prototype.forEach.call(document.querySelectorAll('.flavor'), function (card) {
    Array.prototype.forEach.call(card.querySelectorAll('input[type=radio]'), function (r) {
      var size = Number(r.value);
      catalog[card.dataset.id + '|' + size] = {
        key: card.dataset.id + '|' + size,
        id: card.dataset.id,
        name: card.dataset.name,
        size: size,
        price: Number(r.dataset.price)
      };
    });
  });

  function sizeLabel(g) { return g >= 1000 ? (g / 1000) + ' kg' : g + ' g'; }
  function plural(n) { return n + (n === 1 ? ' panettone' : ' panettoni'); }

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
  function count() {
    return cart.reduce(function (s, l) { return s + l.q; }, 0);
  }
  function announce(msg) { $('cart-status').textContent = msg; }
  function find(key) { return cart.filter(function (l) { return l.k === key; })[0]; }

  function add(key) {
    var line = find(key);
    if (line) {
      if (line.q >= CONFIG.maxQty) { announce('Massimo ' + CONFIG.maxQty + ' per gusto e pezzatura. Per quantità maggiori scrivici su WhatsApp.'); return; }
      line.q += 1;
    } else { cart.push({ k: key, q: 1 }); }
    save(); render();
    announce(catalog[key].name + ' ' + sizeLabel(catalog[key].size) + ' aggiunto. Nel carrello: ' + plural(count()) + ', ' + money.format(total()));
  }
  function change(key, delta) {
    var line = find(key);
    if (!line) return;
    line.q = Math.min(CONFIG.maxQty, line.q + delta);
    if (line.q <= 0) { cart = cart.filter(function (l) { return l !== line; }); announce('Rimosso dal carrello.'); }
    save(); render();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render() {
    // barra carrello
    var n = count(), has = n > 0;
    $('cart-bar').hidden = !has;
    document.body.classList.toggle('has-cart', has);
    $('bar-count').textContent = plural(n);
    $('bar-total').textContent = money.format(total());

    // schede: indicatore "nel carrello"
    Array.prototype.forEach.call(document.querySelectorAll('.flavor'), function (card) {
      var q = cart.reduce(function (s, l) { return catalog[l.k].id === card.dataset.id ? s + l.q : s; }, 0);
      card.classList.toggle('has-items', q > 0);
      card.querySelector('.in-cart').textContent = q > 0 ? 'Nel carrello: ' + q : '';
    });

    // righe carrello (passo 1)
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

      var qty = el('div', 'qty');
      var minus = el('button', null, l.q === 1 ? '×' : '−'); minus.type = 'button';
      minus.setAttribute('aria-label', (l.q === 1 ? 'Rimuovi: ' : 'Diminuisci: ') + item.name + ' ' + sizeLabel(item.size));
      minus.dataset.act = 'dec'; minus.dataset.k = l.k;
      var out = el('output', null, String(l.q));
      var plus = el('button', null, '+'); plus.type = 'button';
      plus.setAttribute('aria-label', 'Aumenta: ' + item.name + ' ' + sizeLabel(item.size));
      plus.dataset.act = 'inc'; plus.dataset.k = l.k;
      if (l.q >= CONFIG.maxQty) plus.disabled = true;
      qty.appendChild(minus); qty.appendChild(out); qty.appendChild(plus);
      li.appendChild(qty);

      list.appendChild(li);
    });
    $('cart-empty').hidden = has;
    $('cart-total').hidden = !has;
    $('total').textContent = money.format(total());
    if (step === 1) $('next').disabled = !has;

    // se il carrello si svuota mentre il pannello è aperto, torna al passo 1
    if (!has && dlg.open && step !== 1 && $('done').hidden) goTo(1, false);
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
  function longDate(d) {
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
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
    if (min > max) {
      $('date-hint').textContent = 'Le prenotazioni online per questa stagione sono chiuse. Scrivici su WhatsApp.';
      input.disabled = true; $('time').disabled = true;
    } else {
      $('date-hint').textContent = 'Ritiro da martedì a sabato, 08:00–18:00. Primo giorno disponibile: ' + longDate(min) +
        '. Ultimo: ' + longDate(max) + '.';
    }
    var sel = $('time');
    for (var m = CONFIG.openFrom; m < CONFIG.openTo; m += CONFIG.slotStep) {
      var label = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
      var o = document.createElement('option'); o.value = label; o.textContent = label; sel.appendChild(o);
    }
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

  // ── Validazione (per passo) ──────────────────────────────────────────────
  function setErr(id, msg) {
    var field = $(id).closest('.field');
    var out = $(id + '-err');
    if (out) out.textContent = msg || '';
    if (field) field.classList.toggle('invalid', !!msg);
    $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function showAlert(msg) { var a = $('form-alert'); a.textContent = msg; a.hidden = !msg; }

  function checkDate() {
    var d = parseISO($('date').value);
    var min = firstPickup(), max = parseISO(CONFIG.lastPickup);
    var msg = '';
    if (!d) msg = 'Scegli il giorno del ritiro.';
    else if (!isOpenDay(d)) msg = 'Siamo chiusi domenica e lunedì. Scegli un giorno da martedì a sabato.';
    else if (d < min) msg = 'Servono almeno ' + CONFIG.minLeadDays + ' giorni. Il primo giorno disponibile è ' + longDate(min) + '.';
    else if (d > max) msg = 'L\'ultimo ritiro possibile è ' + longDate(max) + '.';
    setErr('date', msg);
    return !msg;
  }

  function validateStep(n) {
    var first = null;
    function bad(id) { if (!first) first = $(id); }
    showAlert('');

    if (n === 1) {
      if (!cart.length) { showAlert('Il carrello è vuoto. Aggiungi almeno un panettone.'); return false; }
      return true;
    }
    if (n === 2) {
      if (!checkDate()) bad('date');
      if (!$('time').value) { setErr('time', 'Scegli l\'orario di ritiro.'); bad('time'); } else setErr('time', '');
    }
    if (n === 3) {
      if ($('name').value.trim().length < 2) { setErr('name', 'Inserisci nome e cognome.'); bad('name'); } else setErr('name', '');
      if (!normalizePhone($('phone').value)) { setErr('phone', 'Il numero non sembra valido. Esempio: 333 1234567 (estero: +44…).'); bad('phone'); } else setErr('phone', '');
      if (!$('privacy').checked) { $('privacy-err').textContent = 'Per inviare l\'ordine spunta la casella privacy e condizioni.'; bad('privacy'); } else $('privacy-err').textContent = '';
    }
    if (first) { first.focus(); return false; }
    return true;
  }

  // ── Passi ────────────────────────────────────────────────────────────────
  var NEXT_LABEL = { 1: 'Continua con il ritiro', 2: 'Continua con i tuoi dati', 3: 'Ordina su WhatsApp' };

  function pickupText() {
    var d = parseISO($('date').value);
    return d && $('time').value
      ? d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + $('time').value
      : '';
  }

  function renderReview() {
    var r = $('review');
    r.textContent = '';
    function row(label, value, target) {
      var wrap = el('div');
      wrap.appendChild(el('dt', null, label));
      var dd = el('dd');
      dd.appendChild(document.createTextNode(value));
      var b = el('button', null, 'Modifica'); b.type = 'button'; b.dataset.goto = String(target);
      b.setAttribute('aria-label', 'Modifica ' + label.toLowerCase());
      dd.appendChild(b);
      wrap.appendChild(dd);
      r.appendChild(wrap);
    }
    row('Ordine', plural(count()) + ' · ' + money.format(total()), 1);
    row('Ritiro', pickupText(), 2);
  }

  function goTo(n, focus) {
    step = n;
    Array.prototype.forEach.call(form.querySelectorAll('.step'), function (s) {
      s.hidden = Number(s.dataset.step) !== n;
    });
    Array.prototype.forEach.call($('steps').children, function (li, i) {
      li.classList.toggle('done', i + 1 < n);
      if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('back').hidden = n === 1;
    $('next').textContent = NEXT_LABEL[n];
    $('next').disabled = n === 1 && !cart.length;
    showAlert('');
    if (n === 3) renderReview();
    form.querySelector('.sheet-body').scrollTop = 0;
    if (focus !== false) {
      var h = form.querySelector('.step[data-step="' + n + '"] h3');
      if (h) h.focus();
    }
  }

  // ── Messaggi ─────────────────────────────────────────────────────────────
  function linesText() {
    return cart.map(function (l) {
      var i = catalog[l.k];
      return '• ' + l.q + ' × Panettone ' + i.name + ' — ' + sizeLabel(i.size) + ' — ' + money.format(i.price * l.q);
    }).join('\n');
  }

  function newOrderId() {
    var d = new Date();
    var rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'CER-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + rnd;
  }

  // Copia dell'ordine nel foglio Google di Cerea (una riga per gusto e pezzatura).
  // Invio "fire and forget": se fallisce, l'ordine su WhatsApp funziona comunque.
  function logOrder(data) {
    if (!CONFIG.sheetUrl) return;
    var payload = {
      token: CONFIG.sheetToken,
      id: data.id,
      name: data.name,
      phone: '+' + data.phone,
      date: iso(data.date),
      time: data.time,
      notes: data.notes,
      items: cart.map(function (l) {
        var i = catalog[l.k];
        return { flavor: i.name, size: sizeLabel(i.size), qty: l.q, amount: i.price * l.q };
      })
    };
    try {
      fetch(CONFIG.sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(function () { /* ignorato */ });
    } catch (e) { /* ignorato */ }
  }

  function build(data) {
    var when = longDate(data.date) + ', ore ' + data.time;
    var base = linesText() + '\n\nTotale: ' + money.format(total()) + '\nRitiro: ' + when + ' (' + CONFIG.address + ')\nPagamento al ritiro.';

    var shop = 'Ciao Cerea, vorrei prenotare (ordine ' + data.id + '):\n' + base +
      '\n\nNome: ' + data.name + '\nTelefono: +' + data.phone +
      (data.notes ? '\nNote: ' + data.notes : '') + '\n\nGrazie!';

    var me = 'Ciao ' + data.name.split(' ')[0] + ', questo è il riepilogo del tuo ordine ' + data.id + ' da Cerea:\n' + base +
      '\n\nCerea ti confermerà la disponibilità su WhatsApp. Per modifiche o annullamenti scrivi al +39 351 719 4846 almeno ' +
      CONFIG.minLeadDays + ' giorni prima del ritiro.';

    return { shop: shop, me: me };
  }
  function wa(phone, text) { return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text); }

  // ── Apertura / chiusura pannello ─────────────────────────────────────────
  function resetPanel() {
    $('done').hidden = true;
    form.hidden = false;
    $('steps').hidden = false;
  }
  function openCart() {
    lastFocus = document.activeElement;
    resetPanel();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.body.classList.add('modal-open');
    goTo(1);
  }
  function closeCart() {
    if (typeof dlg.close === 'function') dlg.close(); else { dlg.removeAttribute('open'); dlg.dispatchEvent(new Event('close')); }
  }
  dlg.addEventListener('close', function () {
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeCart(); });

  // ── Eventi ───────────────────────────────────────────────────────────────
  // Il pulsante mostra il prezzo della pezzatura scelta.
  function syncAddButton(card) {
    var checked = card.querySelector('input[type=radio]:checked');
    var btn = card.querySelector('.add-btn');
    if (!checked || !btn) return;
    var item = catalog[card.dataset.id + '|' + checked.value];
    btn.textContent = 'Aggiungi · ' + money.format(item.price).replace(',00', '');
    btn.setAttribute('aria-label', 'Aggiungi al carrello: ' + item.name + ', ' + sizeLabel(item.size) + ', ' + money.format(item.price));
    btn.classList.remove('is-added');
  }
  Array.prototype.forEach.call(document.querySelectorAll('.flavor'), function (card) {
    card.addEventListener('change', function (e) {
      if (e.target.type === 'radio') syncAddButton(card);
    });
    syncAddButton(card);
  });

  $('flavors').addEventListener('click', function (e) {
    var b = e.target.closest('.add-btn');
    if (!b) return;
    var card = b.closest('.flavor');
    var checked = card.querySelector('input[type=radio]:checked');
    if (!checked) return;
    add(card.dataset.id + '|' + checked.value);
    // conferma visiva breve
    b.textContent = 'Aggiunto ✓';
    b.classList.add('is-added');
    clearTimeout(b._t);
    b._t = setTimeout(function () { syncAddButton(card); }, 1400);
  });

  $('cart-lines').addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (!act) return;
    var k = act.dataset.k, kind = act.dataset.act;
    if (kind === 'inc') change(k, 1);
    else if (kind === 'dec') change(k, -1);
    // dopo il re-render i pulsanti sono nuovi: riporta il focus su quello corrispondente
    var again = $('cart-lines').querySelector('[data-act="' + kind + '"][data-k="' + k + '"]');
    if (again && !again.disabled) again.focus();
  });

  $('open-cart').addEventListener('click', openCart);
  $('close-cart').addEventListener('click', closeCart);
  $('finish').addEventListener('click', closeCart);
  $('back-to-shop').addEventListener('click', closeCart);
  $('back').addEventListener('click', function () { if (step > 1) goTo(step - 1); });
  $('review').addEventListener('click', function (e) {
    var b = e.target.closest('[data-goto]');
    if (b) goTo(Number(b.dataset.goto));
  });

  $('date').addEventListener('change', checkDate);
  $('time').addEventListener('change', function () { setErr('time', ''); });
  $('name').addEventListener('input', function () { setErr('name', ''); });
  $('phone').addEventListener('input', function () { setErr('phone', ''); });
  $('privacy').addEventListener('change', function () { $('privacy-err').textContent = ''; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateStep(step)) return;
    if (step < STEPS) { goTo(step + 1); return; }

    // ultimo passo: ricontrolla tutto (l'utente può essere tornato indietro) e invia
    if (!validateStep(1)) { goTo(1); return; }
    if (!validateStep(2)) { goTo(2); return; }

    var data = {
      date: parseISO($('date').value),
      time: $('time').value,
      name: $('name').value.trim().replace(/\s+/g, ' '),
      phone: normalizePhone($('phone').value),
      notes: $('notes').value.trim().replace(/\s+/g, ' '),
      id: newOrderId()
    };
    var msgs = build(data);
    logOrder(data);
    var toShop = wa(CONFIG.shopPhone, msgs.shop);

    $('summary').textContent = msgs.shop;
    $('send-shop').href = toShop;
    $('send-me').href = wa(data.phone, msgs.me);
    form.hidden = true;
    $('steps').hidden = true;
    $('done').hidden = false;
    $('done-title').focus();

    // L'ordine ormai è nel messaggio: svuota il carrello.
    cart = []; save(); render();
    form.reset();

    window.open(toShop, '_blank', 'noopener');
  });

  setupDate();
  render();
})();
