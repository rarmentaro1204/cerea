(function () {
  'use strict';

  var root = document.documentElement;
  var mq = window.matchMedia('(max-width: 760px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ───── Menu ───── */
  var btn = $('.menu-btn');
  var nav = $('#nav');
  var header = $('.site-header');

  function setMenu(open) {
    if (!btn || !nav) return;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    nav.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open && mq.matches);
    if (open && header) header.classList.remove('is-hidden');
  }
  if (btn && nav) {
    btn.addEventListener('click', function () { setMenu(btn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    mq.addEventListener && mq.addEventListener('change', function () { setMenu(false); });
  }

  /* ───── Tutto il resto vale solo su telefono ───── */
  var cleanups = [];
  var ticking = false;
  var vh = window.innerHeight;
  var parallax = [];        // { box, img, shiftMax }
  var progressEl, dock, cue, hero, footer;
  var carousel = null;
  var lastY = window.scrollY;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function addProgress() {
    progressEl = document.createElement('div');
    progressEl.className = 'progress';
    progressEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progressEl);
  }

  function addCue() {
    hero = $('.hero');
    if (!hero) return;
    cue = document.createElement('a');
    cue.className = 'scroll-cue';
    cue.href = '#storia';
    cue.setAttribute('aria-label', 'Scorri verso il basso');
    cue.textContent = '↓';
    hero.appendChild(cue);
  }

  /* Comparsa progressiva: ogni gruppo entra a scalare */
  function setupReveal() {
    var groups = [
      '.facts li',
      '.split-text > *',
      '.section-head > *',
      '.statement > *',
      '.mini-stats li',
      '.grid-6 > li',
      '.contact-grid > div',
      '.faq details',
      '.award',
      '.tags',
      '.carousel-dots'
    ];
    var targets = [];
    groups.forEach(function (sel) {
      var byParent = new Map();
      $$(sel).forEach(function (el) {
        var p = el.parentElement;
        var n = byParent.get(p) || 0;
        byParent.set(p, n + 1);
        el.style.setProperty('--i', Math.min(n, 5));
        targets.push(el);
      });
    });
    $$('.split-media, .gallery .g-item').forEach(function (el) { targets.push(el); el.classList.add('rv-box'); });
    // prodotti: entrano a cascata solo quelli visibili al primo sguardo
    $$('.product').forEach(function (el, i) { el.style.setProperty('--i', Math.min(i, 3)); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('rv-in');
        if (e.target.matches('.facts li')) countUp($('b', e.target));
        io.unobserve(e.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });

    targets.forEach(function (el) {
      if (!el.classList.contains('rv-box')) el.classList.add('rv');
      io.observe(el);
    });
    cleanups.push(function () { io.disconnect(); });
  }

  /* Numeri che salgono: "10+" "48 h" "0" "2025" */
  function countUp(el) {
    if (!el || el.dataset.counted) return;
    el.dataset.counted = '1';
    var m = /^(\d+)(.*)$/.exec(el.textContent.trim());
    if (!m) return;
    var end = parseInt(m[1], 10), suffix = m[2];
    if (end < 2) return;
    var start = performance.now(), dur = 1400;
    (function frame(t) {
      var k = clamp((t - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(end * eased) + suffix;
      if (k < 1) requestAnimationFrame(frame);
    })(start);
  }

  /* Parallasse: l'immagine scorre più lenta del contenitore */
  function setupParallax() {
    var pairs = [];
    var h = $('.hero-media');
    if (h) pairs.push([h, $('img', h)]);
    $$('.split-media').forEach(function (b) { pairs.push([b, $('img', b)]); });
    $$('.gallery .g-item').forEach(function (b) { pairs.push([b, $('img', b)]); });
    parallax = pairs.filter(function (p) { return p[1]; }).map(function (p) {
      return { box: p[0], img: p[1], hero: p[0].classList.contains('hero-media') };
    });
  }

  function updateParallax() {
    parallax.forEach(function (it) {
      var r = it.box.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) return;
      var scale = it.hero ? 1.16 : 1.16;
      var maxShift = (scale - 1) / 2 * r.height * 0.9;
      var p = clamp(((vh - r.top) / (vh + r.height)) * 2 - 1, -1, 1);
      it.img.style.setProperty('--y', (p * maxShift).toFixed(1) + 'px');
    });
  }

  /* Carosello prodotti: la scheda attiva è più grande, puntini sotto */
  function setupCarousel() {
    var grid = $('.product-grid');
    if (!grid) return;
    var cards = $$('.product', grid);
    var dots = document.createElement('div');
    dots.className = 'carousel-dots';
    dots.setAttribute('aria-hidden', 'true');
    cards.forEach(function () { dots.appendChild(document.createElement('span')); });
    grid.parentNode.insertBefore(dots, grid.nextSibling);
    carousel = { grid: grid, cards: cards, dots: $$('span', dots) };
    updateCarousel();
    grid.addEventListener('scroll', function () { requestTick(); }, { passive: true });
  }

  function updateCarousel() {
    if (!carousel) return;
    var g = carousel.grid;
    var base = g.getBoundingClientRect().left + parseFloat(getComputedStyle(g).paddingLeft || 0);
    var best = 0, bestD = 1e9;
    carousel.cards.forEach(function (c, i) {
      var r = c.getBoundingClientRect();
      var d = Math.abs(r.left - base) / r.width;
      if (d < bestD) { bestD = d; best = i; }
      var k = clamp(d, 0, 1);
      c.style.setProperty('--s', (1 - k * 0.07).toFixed(3));
      c.style.setProperty('--o', (1 - k * 0.4).toFixed(3));
    });
    carousel.dots.forEach(function (d, i) { d.classList.toggle('on', i === best); });
  }

  /* Barra rapida: compare dopo l'hero, sparisce vicino al footer */
  function setupDock() {
    dock = $('.dock');
    footer = $('.site-footer');
  }

  function onFrame() {
    ticking = false;
    var y = window.scrollY;
    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - vh);

    if (progressEl) progressEl.style.setProperty('--p', clamp(y / max, 0, 1).toFixed(4));

    if (header && !document.body.classList.contains('menu-open')) {
      var dy = y - lastY;
      if (y < 80) header.classList.remove('is-hidden');
      else if (dy > 6) header.classList.add('is-hidden');
      else if (dy < -6) header.classList.remove('is-hidden');
    }
    lastY = y;

    if (cue) cue.classList.toggle('is-off', y > 60);

    if (dock) {
      var nearFooter = footer && footer.getBoundingClientRect().top < vh - 40;
      dock.classList.toggle('is-on', y > vh * 0.6 && !nearFooter && !document.body.classList.contains('menu-open'));
    }

    if (!reduce) updateParallax();
    updateCarousel();
  }

  function requestTick() {
    if (!ticking) { ticking = true; requestAnimationFrame(onFrame); }
  }

  var started = false;
  function start() {
    if (started || !mq.matches) return;
    started = true;
    addProgress();
    setupDock();
    if (!reduce) {
      addCue();
      setupReveal();
      setupParallax();
    }
    setupCarousel();
    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', function () { vh = window.innerHeight; requestTick(); }, { passive: true });
    window.addEventListener('orientationchange', function () { setTimeout(function () { vh = window.innerHeight; requestTick(); }, 250); });
    requestTick();
  }

  if (mq.matches) start();
  else if (mq.addEventListener) mq.addEventListener('change', function () { if (mq.matches) start(); });
})();
