/* ============================================================
   MyBurger -- Menu (page logic)
   Renders the menu page: sidebar links, mobile chip filters,
   and one section per category populated with menu cards.
   The [+] button delegates to the customization-modal module
   when present, falling back to a default-modifier quick-add
   otherwise (so the page still works before modal lands).

   Public API (window.MyBurger.customer.menu):
     render()                 -> void
     scrollToCategory(slugOrId) -> void
     openCustomization(product) -> void   (delegates to modal module)
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const API   = MB.api;
  const STATE = MB.state;

  if (!UI || !API || !STATE) {
    console.error('[menu] missing ui/api/state -- check script load order');
    return;
  }

  const el  = UI.el;
  const qs  = UI.qs;
  const qsa = UI.qsa;

  let currentCategory = null; // slug or id

  /* ---------- Render: full page ---------- */

  function render() {
    API.ready().then(function () {
      renderSidebar();
      renderChips();
      renderContent();
      attachScrollSpy();
    });
  }

  /* ---------- Sidebar (desktop) ---------- */

  function renderSidebar() {
    const list = qs('[data-menu-sidebar]');
    if (!list) return;
    list.innerHTML = '';

    const categories = sortedCategories();
    categories.forEach(function (cat) {
      const li = el('li', {}, [
        el(
          'a',
          {
            href: '#' + (cat.slug || cat.id),
            class: 'c-menu__sidebar-link',
            dataset: { menuSidebar: cat.slug || cat.id },
            onclick: function (ev) {
              ev.preventDefault();
              scrollToCategory(cat.slug || cat.id);
            }
          },
          cat.name
        )
      ]);
      list.appendChild(li);
    });

    setActiveSidebar(categories[0] && (categories[0].slug || categories[0].id));
  }

  function setActiveSidebar(slugOrId) {
    qsa('[data-menu-sidebar]').forEach(function (link) {
      link.classList.toggle('is-active', link.dataset.menuSidebar === slugOrId);
    });
  }

  /* ---------- Chips (mobile) ---------- */

  function renderChips() {
    const row = qs('[data-menu-chips]');
    if (!row) return;
    row.innerHTML = '';

    const categories = sortedCategories();
    categories.forEach(function (cat) {
      const chip = el(
        'button',
        {
          type: 'button',
          class: 'pill',
          dataset: { menuChip: cat.slug || cat.id },
          onclick: function () {
            scrollToCategory(cat.slug || cat.id);
          }
        },
        cat.name
      );
      row.appendChild(chip);
    });

    setActiveChip(categories[0] && (categories[0].slug || categories[0].id));
  }

  function setActiveChip(slugOrId) {
    qsa('[data-menu-chip]').forEach(function (chip) {
      chip.classList.toggle('is-active', chip.dataset.menuChip === slugOrId);
    });
  }

  /* ---------- Content (sections per category) ---------- */

  function renderContent() {
    const root = qs('[data-menu-content]');
    if (!root) return;
    root.innerHTML = '';

    const categories = sortedCategories();
    const products   = (API.products.list() || []).filter(function (p) {
      return p.active !== false;
    });

    if (categories.length === 0 || products.length === 0) {
      root.appendChild(el('p', { class: 'c-menu__empty', text: 'Menu loading.' }));
      return;
    }

    categories.forEach(function (cat) {
      const items = products.filter(function (p) { return p.category === cat.id; });
      if (items.length === 0) return;

      const section = el(
        'section',
        {
          class: 'c-menu__section',
          id: cat.slug || cat.id,
          dataset: { menuSection: cat.slug || cat.id },
          'aria-labelledby': 'sec-' + (cat.slug || cat.id)
        },
        [
          el('h2', {
            class: 'c-menu__section-title',
            id:    'sec-' + (cat.slug || cat.id),
            text:  cat.name
          }),
          el(
            'div',
            { class: 'c-menu__grid' },
            items.map(buildMenuCard)
          )
        ]
      );
      root.appendChild(section);
    });
  }

  function buildMenuCard(product) {
    const stock = stockFor(product.id);
    const soldOut = stock !== null && stock <= 0;

    const chips = (product.dietary || []).map(function (tag) {
      const cls = tag === 'spicy'  ? 'pill pill--spicy' :
                  tag === 'veggie' ? 'pill pill--dietary' :
                                     'pill';
      return el('span', { class: cls, text: pretty(tag) });
    });

    const addBtn = el(
      'button',
      {
        type: 'button',
        class: 'qty-add',
        'aria-label': 'Customise ' + product.name
      },
      '+'
    );

    addBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      openCustomization(product, addBtn);
    });

    const card = el(
      'article',
      {
        class: soldOut ? 'c-menu-card is-disabled' : 'c-menu-card',
        dataset: { productId: product.id }
      },
      [
        el('div', { class: 'c-menu-card__media' }, [
          el('img', { src: product.img, alt: product.name, loading: 'lazy' }),
          chips.length ? el('div', { class: 'c-menu-card__chips' }, chips) : null,
          soldOut ? el('span', { class: 'c-menu-card__sold-out', text: 'Sold out' }) : null
        ]),
        el('div', { class: 'c-menu-card__body' }, [
          el('h3', { class: 'c-menu-card__title', text: product.name }),
          el('p',  { class: 'c-menu-card__desc',  text: product.desc || '' }),
          el('div', { class: 'c-menu-card__footer' }, [
            el('span', { class: 'c-menu-card__price', text: API.formatRM(product.price) }),
            addBtn
          ])
        ])
      ]
    );

    if (!soldOut) {
      card.addEventListener('click', function () {
        openCustomization(product, addBtn);
      });
    }

    return card;
  }

  function stockFor(productId) {
    const inv = (API.inventory.list() || []).find(function (r) {
      return r.productId === productId;
    });
    if (!inv) return null;
    return Number(inv.stock);
  }

  /* ---------- [+] click handler ---------- */

  function openCustomization(product, triggerEl) {
    const modalModule = MB.customer && MB.customer.customization;
    if (modalModule && typeof modalModule.open === 'function') {
      modalModule.open(product, { trigger: triggerEl });
      return;
    }

    // Fallback (no modal module yet) -- quick-add with defaults
    const modifiers = pickDefaults(product);
    const linePrice = priceWith(product, modifiers);
    const cart = STATE.getStore(STATE.KEYS.CART, []) || [];

    const existing = cart.find(function (line) {
      return line.productId === product.id &&
             JSON.stringify(line.modifiers) === JSON.stringify(modifiers);
    });

    if (existing) {
      existing.qty += 1;
      existing.lineTotal = linePrice * existing.qty;
    } else {
      cart.push({
        productId: product.id,
        name:      product.name,
        img:       product.img,
        qty:       1,
        modifiers: modifiers,
        unitPrice: linePrice,
        lineTotal: linePrice
      });
    }

    STATE.setStore(STATE.KEYS.CART, cart);

    if (triggerEl) {
      triggerEl.classList.remove('is-pop');
      void triggerEl.offsetWidth;
      triggerEl.classList.add('is-pop');
    }

    UI.toast('Added: ' + product.name, { variant: 'success', duration: 2000 });
  }

  function pickDefaults(product) {
    const picked = {};
    (product.modifiers || []).forEach(function (group) {
      if (!group.options) return;
      if (group.type === 'radio') {
        const def = group.options.find(function (o) { return o.default; }) || group.options[0];
        if (def) picked[group.id] = [def.id];
      } else {
        picked[group.id] = group.options.filter(function (o) { return o.default; }).map(function (o) { return o.id; });
      }
    });
    return picked;
  }

  function priceWith(product, picked) {
    let total = Number(product.price) || 0;
    (product.modifiers || []).forEach(function (group) {
      const sel = picked[group.id] || [];
      (group.options || []).forEach(function (opt) {
        if (sel.indexOf(opt.id) !== -1) total += Number(opt.price) || 0;
      });
    });
    return total;
  }

  /* ---------- Scroll handling ---------- */

  function scrollToCategory(slugOrId) {
    const target = document.getElementById(slugOrId);
    if (!target) return;
    currentCategory = slugOrId;
    setActiveSidebar(slugOrId);
    setActiveChip(slugOrId);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function attachScrollSpy() {
    const sections = qsa('[data-menu-section]');
    if (sections.length === 0 || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const slugOrId = entry.target.dataset.menuSection;
          if (slugOrId && slugOrId !== currentCategory) {
            currentCategory = slugOrId;
            setActiveSidebar(slugOrId);
            setActiveChip(slugOrId);
          }
        }
      });
    }, {
      rootMargin: '-30% 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ---------- Helpers ---------- */

  function sortedCategories() {
    return (API.categories.list() || []).slice().sort(function (a, b) {
      return (a.sort || 0) - (b.sort || 0);
    });
  }

  function pretty(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* Re-render on product/category/inventory mutation */
  STATE.subscribe(STATE.KEYS.PRODUCTS,   renderContent);
  STATE.subscribe(STATE.KEYS.CATEGORIES, function () {
    renderSidebar();
    renderChips();
    renderContent();
  });
  STATE.subscribe(STATE.KEYS.INVENTORY,  renderContent);

  /* ---------- Expose ---------- */

  window.MyBurger.customer = window.MyBurger.customer || {};
  window.MyBurger.customer.menu = {
    render:             render,
    scrollToCategory:   scrollToCategory,
    openCustomization:  openCustomization
  };
})();
