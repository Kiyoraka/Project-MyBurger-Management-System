/* ============================================================
   MyBurger -- Product Customization Surface
   Opens as a centered modal on desktop (>= 768px) and a bottom
   sheet on mobile. Reads product.modifiers and renders the
   appropriate control per group:
     - type === 'radio'    -> single-choice list (required)
     - type === 'checkbox' -> multi-select with optional max
   Plus a notes textarea, a qty stepper, and a sticky footer
   "ADD TO CART RM X.XX" button. Add fires the .is-pop animation
   class on the trigger element (if any), pushes onto the cart
   key, and closes the surface with a toast.

   Public API (window.MyBurger.customer.customization):
     open(product, opts)   -> void
     close()               -> void
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const API   = MB.api;
  const STATE = MB.state;

  if (!UI || !API || !STATE) {
    console.error('[customization] missing ui/api/state');
    return;
  }

  const el  = UI.el;

  const MOBILE_BP = 768; // matches --bp-tablet-min from tokens

  /* ---------- State held while a session is open ---------- */

  let currentProduct = null;
  let currentPicks   = {}; // { groupId: [optionId, ...] }
  let currentQty     = 1;
  let currentNotes   = '';
  let priceEl        = null;
  let footerBtn      = null;

  /* ---------- Open / close ---------- */

  function open(product, opts) {
    if (!product) return;
    currentProduct = product;
    currentPicks   = pickDefaults(product);
    currentQty     = 1;
    currentNotes   = '';
    priceEl        = null;
    footerBtn      = null;

    const node = buildSurface(product, (opts && opts.trigger) || null);

    if (window.innerWidth >= MOBILE_BP) {
      UI.modal.open(node);
    } else {
      UI.sheet.open(node);
    }
  }

  function close() {
    UI.modal.close();
    UI.sheet.close();
    currentProduct = null;
  }

  /* ---------- Build surface ---------- */

  function buildSurface(product, triggerEl) {
    const surface = el('div', { class: 'mb-cust' });

    surface.appendChild(buildHeader(product));
    surface.appendChild(buildBody(product));
    surface.appendChild(buildFooter(product, triggerEl));

    return surface;
  }

  function buildHeader(product) {
    return el('div', { class: 'mb-cust__header' }, [
      el('div', { class: 'mb-cust__header-text' }, [
        el('h2', { class: 'mb-cust__title', text: product.name }),
        el('p',  { class: 'mb-cust__subtitle', text: product.desc || '' })
      ]),
      el(
        'button',
        {
          type: 'button',
          class: 'modal__close',
          'aria-label': 'Close',
          onclick: function () { close(); }
        },
        '✕'
      )
    ]);
  }

  function buildBody(product) {
    const body = el('div', { class: 'mb-cust__body' });

    // Hero image
    if (product.img) {
      body.appendChild(el(
        'div',
        { class: 'mb-cust__media' },
        [el('img', { src: product.img, alt: product.name })]
      ));
    }

    // Base price line
    body.appendChild(el(
      'div',
      { class: 'mb-cust__price-row' },
      [
        el('span', { class: 'mb-cust__price-label', text: 'Base price' }),
        el('span', { class: 'mb-cust__price-value', text: API.formatRM(product.price) })
      ]
    ));

    // Modifier groups
    (product.modifiers || []).forEach(function (group) {
      body.appendChild(buildGroup(group));
    });

    // Notes
    body.appendChild(buildNotes());

    // Qty stepper
    body.appendChild(buildQty());

    return body;
  }

  function buildGroup(group) {
    const groupEl = el('section', { class: 'mb-cust__group' }, [
      el('header', { class: 'mb-cust__group-header' }, [
        el('h3', { class: 'mb-cust__group-title', text: group.label }),
        group.type === 'checkbox' && group.max
          ? el('span', { class: 'mb-cust__group-hint', text: 'Max ' + group.max })
          : (group.type === 'radio'
              ? el('span', { class: 'mb-cust__group-hint', text: 'Choose one' })
              : null)
      ]),
      el('div', { class: 'mb-cust__options' }, group.options.map(function (opt) {
        return buildOption(group, opt);
      }))
    ]);
    return groupEl;
  }

  function buildOption(group, opt) {
    const inputType = group.type === 'radio' ? 'radio' : 'checkbox';
    const inputName = 'g-' + group.id;
    const isSelected = (currentPicks[group.id] || []).indexOf(opt.id) !== -1;

    const input = el('input', {
      type: inputType,
      name: inputName,
      value: opt.id,
      checked: isSelected ? 'checked' : null
    });

    input.addEventListener('change', function () {
      const selected = currentPicks[group.id] || [];
      if (group.type === 'radio') {
        currentPicks[group.id] = [opt.id];
      } else {
        const ix = selected.indexOf(opt.id);
        if (input.checked) {
          if (ix === -1) selected.push(opt.id);
          if (group.max && selected.length > group.max) {
            // bounce: uncheck this one and warn
            input.checked = false;
            const dropIx = selected.indexOf(opt.id);
            if (dropIx !== -1) selected.splice(dropIx, 1);
            UI.toast('Maximum ' + group.max + ' selections in ' + group.label, { variant: 'warning' });
          }
        } else {
          if (ix !== -1) selected.splice(ix, 1);
        }
        currentPicks[group.id] = selected;
      }
      refreshTotal();
    });

    const priceLabel = (Number(opt.price) || 0) > 0 ? ' (+' + API.formatRM(opt.price) + ')' : '';

    return el(
      'label',
      { class: 'mb-cust__option choice' },
      [
        input,
        el('span', { class: 'choice__label', text: opt.label }),
        priceLabel ? el('span', { class: 'choice__price', text: priceLabel }) : null
      ]
    );
  }

  function buildNotes() {
    const ta = el('textarea', {
      class: 'textarea',
      placeholder: 'Add a note for the kitchen (optional)',
      maxlength: 240
    });
    ta.addEventListener('input', function () {
      currentNotes = ta.value;
    });
    return el('div', { class: 'mb-cust__notes' }, [
      el('label', { class: 'field__label', text: 'Notes' }),
      ta
    ]);
  }

  function buildQty() {
    const dec = el('button', { type: 'button', class: 'qty__btn', 'aria-label': 'Decrease' }, '−');
    const inc = el('button', { type: 'button', class: 'qty__btn', 'aria-label': 'Increase' }, '+');
    const val = el('span', { class: 'qty__value', text: String(currentQty) });

    dec.addEventListener('click', function () {
      if (currentQty <= 1) return;
      currentQty -= 1;
      val.textContent = String(currentQty);
      refreshTotal();
    });
    inc.addEventListener('click', function () {
      if (currentQty >= 20) return;
      currentQty += 1;
      val.textContent = String(currentQty);
      refreshTotal();
    });

    return el('div', { class: 'mb-cust__qty' }, [
      el('span', { class: 'field__label', text: 'Quantity' }),
      el('div', { class: 'qty' }, [dec, val, inc])
    ]);
  }

  function buildFooter(product, triggerEl) {
    priceEl = el('span', { class: 'mb-cust__total-value', text: API.formatRM(unitPrice() * currentQty) });
    footerBtn = el(
      'button',
      { type: 'button', class: 'btn btn--primary btn--block btn--lg' },
      [el('span', { text: 'Add to cart · ' }), priceEl]
    );

    footerBtn.addEventListener('click', function () {
      commit(triggerEl);
    });

    return el('div', { class: 'mb-cust__footer' }, [footerBtn]);
  }

  /* ---------- Pricing ---------- */

  function unitPrice() {
    if (!currentProduct) return 0;
    let total = Number(currentProduct.price) || 0;
    (currentProduct.modifiers || []).forEach(function (group) {
      const sel = currentPicks[group.id] || [];
      (group.options || []).forEach(function (opt) {
        if (sel.indexOf(opt.id) !== -1) total += Number(opt.price) || 0;
      });
    });
    return total;
  }

  function refreshTotal() {
    if (!priceEl) return;
    priceEl.textContent = API.formatRM(unitPrice() * currentQty);
  }

  /* ---------- Commit to cart ---------- */

  function commit(triggerEl) {
    if (!currentProduct) return;
    if (!validate()) return;

    const linePrice = unitPrice();
    const cart = STATE.getStore(STATE.KEYS.CART, []) || [];

    const sig = JSON.stringify(currentPicks) + '|' + (currentNotes || '');
    const existing = cart.find(function (line) {
      const ls = JSON.stringify(line.modifiers || {}) + '|' + (line.notes || '');
      return line.productId === currentProduct.id && ls === sig;
    });

    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + currentQty;
      existing.lineTotal = linePrice * existing.qty;
    } else {
      cart.push({
        productId: currentProduct.id,
        name:      currentProduct.name,
        img:       currentProduct.img,
        qty:       currentQty,
        modifiers: deepClone(currentPicks),
        notes:     currentNotes || '',
        unitPrice: linePrice,
        lineTotal: linePrice * currentQty
      });
    }

    STATE.setStore(STATE.KEYS.CART, cart);

    if (triggerEl) {
      triggerEl.classList.remove('is-pop');
      void triggerEl.offsetWidth;
      triggerEl.classList.add('is-pop');
    }

    UI.toast('Added: ' + currentProduct.name + ' x' + currentQty, { variant: 'success', duration: 2200 });
    close();
  }

  function validate() {
    const product = currentProduct;
    if (!product) return false;
    let ok = true;
    (product.modifiers || []).forEach(function (group) {
      if (group.required && (!currentPicks[group.id] || currentPicks[group.id].length === 0)) {
        UI.toast('Please choose ' + group.label, { variant: 'warning' });
        ok = false;
      }
    });
    return ok;
  }

  /* ---------- Helpers ---------- */

  function pickDefaults(product) {
    const picked = {};
    (product.modifiers || []).forEach(function (group) {
      if (!group.options) return;
      if (group.type === 'radio') {
        const def = group.options.find(function (o) { return o.default; }) || group.options[0];
        if (def) picked[group.id] = [def.id];
      } else {
        picked[group.id] = group.options
          .filter(function (o) { return o.default; })
          .map(function (o) { return o.id; });
      }
    });
    return picked;
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  /* ---------- Expose ---------- */

  window.MyBurger.customer = window.MyBurger.customer || {};
  window.MyBurger.customer.customization = {
    open:  open,
    close: close
  };
})();
