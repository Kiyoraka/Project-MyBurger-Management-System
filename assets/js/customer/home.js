/* ============================================================
   MyBurger -- Home (page logic)
   Reads products + categories from state, renders the Popular
   grid (up to 4 popular products) and the Categories bento
   grid. The [+] button quick-adds with default modifiers, fires
   a toast, and emits the cart change so the badge updates.

   Public API (window.MyBurger.customer.home):
     render()         -> void
     renderPopular()  -> void
     renderBento()    -> void
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const API   = MB.api;
  const STATE = MB.state;

  if (!UI || !API || !STATE) {
    console.error('[home] missing ui/api/state -- check script load order');
    return;
  }

  const el  = UI.el;
  const qs  = UI.qs;

  /* ---------- Bento icon glyphs ---------- */

  const BENTO_ICONS = {
    burger:  'M5 9c0-3 4-5 7-5s7 2 7 5zM4.5 12h15M4.5 15h15M5 18c0 1.5 1.5 2.5 4 2.5h6c2.5 0 4-1 4-2.5z',
    fries:   'M7 21h10l1.5-12h-13z M9 9V5h2v4 M13 9V4h2v5',
    cup:     'M6 7h12l-1.5 13a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8z M6 7l.5-3h11l.5 3',
    combo:   'M3 8h7v12H3z M14 5h7v6h-7z M14 14h7v6h-7z',
    dessert: 'M5 9c0-2.5 3-4 7-4s7 1.5 7 4v1H5z M6 10l1 9h10l1-9'
  };

  function bentoIconSvg(name) {
    const path = BENTO_ICONS[name] || BENTO_ICONS.burger;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    path.split(' M').forEach(function (segment, idx) {
      const d = (idx === 0 ? segment : 'M' + segment).trim();
      if (!d) return;
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  /* ---------- Default modifier picker (for quick-add from [+] button) ---------- */

  function pickDefaultModifiers(product) {
    const picked = {};
    if (!product || !Array.isArray(product.modifiers)) return picked;
    product.modifiers.forEach(function (group) {
      if (!group.options) return;
      if (group.type === 'radio') {
        const def = group.options.find(function (o) { return o.default; }) || group.options[0];
        if (def) picked[group.id] = [def.id];
      } else if (group.type === 'checkbox') {
        picked[group.id] = group.options
          .filter(function (o) { return o.default; })
          .map(function (o) { return o.id; });
      }
    });
    return picked;
  }

  function priceWithModifiers(product, picked) {
    let total = Number(product.price) || 0;
    if (!product.modifiers) return total;
    product.modifiers.forEach(function (group) {
      const selected = picked[group.id] || [];
      group.options.forEach(function (opt) {
        if (selected.indexOf(opt.id) !== -1) total += Number(opt.price) || 0;
      });
    });
    return total;
  }

  /* ---------- Quick-add to cart ---------- */

  function quickAdd(product, triggerEl) {
    const modifiers = pickDefaultModifiers(product);
    const lineTotal = priceWithModifiers(product, modifiers);

    const cart = STATE.getStore(STATE.KEYS.CART, []) || [];

    const existing = cart.find(function (line) {
      return line.productId === product.id &&
             JSON.stringify(line.modifiers) === JSON.stringify(modifiers);
    });

    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + 1;
      existing.lineTotal = lineTotal * existing.qty;
    } else {
      cart.push({
        productId: product.id,
        name:      product.name,
        img:       product.img,
        qty:       1,
        modifiers: modifiers,
        unitPrice: lineTotal,
        lineTotal: lineTotal
      });
    }

    STATE.setStore(STATE.KEYS.CART, cart);

    if (triggerEl) {
      triggerEl.classList.remove('is-pop');
      /* trigger reflow so the animation replays */
      void triggerEl.offsetWidth;
      triggerEl.classList.add('is-pop');
    }

    UI.toast('Added: ' + product.name, { variant: 'success', duration: 2000 });
  }

  /* ---------- Render: Popular grid ---------- */

  function renderPopular() {
    const grid = qs('[data-popular-grid]');
    if (!grid) return;

    grid.innerHTML = '';

    const products = (API.products.list() || []).filter(function (p) {
      return p.active !== false && p.popular === true;
    }).slice(0, 4);

    if (products.length === 0) {
      grid.appendChild(el('p', { class: 'c-empty', text: 'Menu coming soon.' }));
      return;
    }

    products.forEach(function (product) {
      const card = buildPopularCard(product);
      grid.appendChild(card);
    });
  }

  function buildPopularCard(product) {
    const chips = (product.dietary || []).map(function (tag) {
      const cls = tag === 'spicy'  ? 'pill pill--spicy' :
                  tag === 'veggie' ? 'pill pill--dietary' :
                                     'pill';
      return el('span', { class: cls, text: prettyDietary(tag) });
    });

    const addBtn = el(
      'button',
      {
        type: 'button',
        class: 'qty-add',
        'aria-label': 'Add ' + product.name + ' to cart'
      },
      '+'
    );

    addBtn.addEventListener('click', function () {
      quickAdd(product, addBtn);
    });

    return el('article', { class: 'c-popular-card' }, [
      el('div', { class: 'c-popular-card__media' }, [
        el('img', { src: product.img, alt: product.name, loading: 'lazy' }),
        chips.length ? el('div', { class: 'c-popular-card__chips' }, chips) : null
      ]),
      el('div', { class: 'c-popular-card__body' }, [
        el('h3', { class: 'c-popular-card__title', text: product.name }),
        el('p',  { class: 'c-popular-card__desc',  text: product.desc || '' }),
        el('div', { class: 'c-popular-card__footer' }, [
          el('span', { class: 'c-popular-card__price', text: API.formatRM(product.price) }),
          addBtn
        ])
      ])
    ]);
  }

  function prettyDietary(tag) {
    if (!tag) return '';
    return tag.charAt(0).toUpperCase() + tag.slice(1);
  }

  /* ---------- Render: Categories bento ---------- */

  function renderBento() {
    const grid = qs('[data-bento-grid]');
    if (!grid) return;

    grid.innerHTML = '';

    const categories = (API.categories.list() || []).slice().sort(function (a, b) {
      return (a.sort || 0) - (b.sort || 0);
    });

    if (categories.length === 0) {
      grid.appendChild(el('p', { class: 'c-empty', text: 'Categories loading.' }));
      return;
    }

    categories.forEach(function (cat) {
      grid.appendChild(buildBentoTile(cat));
    });
  }

  function buildBentoTile(cat) {
    const cls = [
      'c-bento__tile',
      cat.wide ? 'c-bento__tile--wide-3' : null,
      'c-bento__tile--' + (cat.slug || cat.id)
    ];

    return el(
      'a',
      {
        href: '/menu.html#' + (cat.slug || cat.id),
        class: cls,
        'aria-label': cat.name
      },
      [
        el('div', { class: 'c-bento__icon' }, [bentoIconSvg(cat.icon)]),
        el('span', { class: 'c-bento__label', text: cat.name })
      ]
    );
  }

  /* ---------- Settings-driven site copy ---------- */

  function applySiteSettings() {
    const settings = (STATE.getStore(STATE.KEYS.SETTINGS, {}) || {});
    const site = settings.site || {};

    /* Hero title / subtext / media */
    if (site.hero) {
      setText('[data-hero="title"]',   site.hero.headline);
      setText('[data-hero="subtext"]', site.hero.subtext);
      const mediaImg = document.querySelector('[data-hero="media"] img');
      if (mediaImg && site.hero.image) mediaImg.src = site.hero.image;
    }

    /* Footer */
    setText('[data-footer="tagline"]', site.hero && site.hero.subtext);
    setText('[data-footer="year"]', String(new Date().getFullYear()));

    /* Document title + brand */
    if (site.name) {
      document.title = site.name + ' -- Fresh. Smashed. Always.';
    }
  }

  function setText(selector, text) {
    if (text == null || text === '') return;
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  /* ---------- Boot ---------- */

  function render() {
    API.ready().then(function () {
      applySiteSettings();
      renderPopular();
      renderBento();
    });
  }

  /* Live re-apply when admin Saves Settings -> Site changes */
  STATE.subscribe(STATE.KEYS.SETTINGS, applySiteSettings);

  /* Re-render Popular when product list changes (admin edit / inventory restock) */
  STATE.subscribe(STATE.KEYS.PRODUCTS, function () {
    renderPopular();
  });
  STATE.subscribe(STATE.KEYS.CATEGORIES, function () {
    renderBento();
  });

  /* ---------- Expose ---------- */

  window.MyBurger.customer = window.MyBurger.customer || {};
  window.MyBurger.customer.home = {
    render:        render,
    renderPopular: renderPopular,
    renderBento:   renderBento
  };
})();
