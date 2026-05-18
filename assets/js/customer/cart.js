/* ============================================================
   MyBurger -- Cart page logic
   Reads myburger:cart, renders the lines, wires the qty
   stepper + delete + fulfilment toggle + promo + totals.
   Keeps the cart key in sync so the badge and sticky bar on
   other pages update live.

   Public API (window.MyBurger.customer.cart):
     render()            -> void
     applyPromo(code)    -> { ok, message, percent }
     getTotals()         -> totals object
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const API   = MB.api;
  const STATE = MB.state;

  if (!UI || !API || !STATE) {
    console.error('[cart] missing ui/api/state');
    return;
  }

  const el  = UI.el;
  const qs  = UI.qs;

  const SERVICE_RATE = 0.06; // 6% service charge

  let currentMode  = 'pickup';
  let promoApplied = null;   // { code, percent }

  /* ---------- Render ---------- */

  function render() {
    API.ready().then(function () {
      hydrateMode();
      bindFulfilmentToggle();
      bindPromo();
      renderLines();
    });
  }

  function hydrateMode() {
    // Restore last mode from a transient state slot
    currentMode = STATE.getStore('myburger:cart-mode', 'pickup');
    const radio = qs('input[data-cart-mode="' + currentMode + '"]');
    if (radio) radio.checked = true;
  }

  function bindFulfilmentToggle() {
    const radios = document.querySelectorAll('input[name="cart-mode"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) {
          currentMode = radio.value;
          STATE.setStore('myburger:cart-mode', currentMode);
          renderTotals();
          updateEta();
        }
      });
    });
    updateEta();
  }

  function updateEta() {
    const sub = qs('[data-cart-eta]');
    if (!sub) return;
    sub.textContent = currentMode === 'delivery'
      ? 'Delivery · arrives in ~35 min'
      : 'Pickup · ready in ~15 min';
  }

  /* ---------- Lines ---------- */

  function renderLines() {
    const root  = qs('[data-cart-items]');
    const empty = qs('[data-cart-empty]');
    if (!root) return;

    const cart = STATE.getStore(STATE.KEYS.CART, []) || [];

    root.innerHTML = '';

    if (cart.length === 0) {
      if (empty) empty.removeAttribute('hidden');
      const checkout = qs('[data-cart-checkout]');
      if (checkout) {
        checkout.classList.add('btn--disabled');
        checkout.setAttribute('aria-disabled', 'true');
      }
      renderTotals();
      return;
    }

    if (empty) empty.setAttribute('hidden', 'hidden');
    const checkout = qs('[data-cart-checkout]');
    if (checkout) {
      checkout.classList.remove('btn--disabled');
      checkout.removeAttribute('aria-disabled');
    }

    cart.forEach(function (line, index) {
      root.appendChild(buildLine(line, index));
    });

    renderTotals();
  }

  function buildLine(line, index) {
    const dec = el('button', { type: 'button', class: 'qty__btn', 'aria-label': 'Decrease' }, '−');
    const inc = el('button', { type: 'button', class: 'qty__btn', 'aria-label': 'Increase' }, '+');
    const val = el('span', { class: 'qty__value', text: String(line.qty || 1) });

    dec.addEventListener('click', function () {
      const cart = STATE.getStore(STATE.KEYS.CART, []);
      const target = cart[index];
      if (!target) return;
      if (target.qty <= 1) {
        cart.splice(index, 1);
      } else {
        target.qty -= 1;
        target.lineTotal = (Number(target.unitPrice) || 0) * target.qty;
      }
      STATE.setStore(STATE.KEYS.CART, cart);
      renderLines();
    });

    inc.addEventListener('click', function () {
      const cart = STATE.getStore(STATE.KEYS.CART, []);
      const target = cart[index];
      if (!target) return;
      if (target.qty >= 20) return;
      target.qty += 1;
      target.lineTotal = (Number(target.unitPrice) || 0) * target.qty;
      STATE.setStore(STATE.KEYS.CART, cart);
      renderLines();
    });

    const del = el(
      'button',
      {
        type: 'button',
        class: 'c-cart-line__delete',
        'aria-label': 'Remove ' + (line.name || 'item')
      },
      '🗑'
    );

    del.addEventListener('click', function () {
      const cart = STATE.getStore(STATE.KEYS.CART, []);
      cart.splice(index, 1);
      STATE.setStore(STATE.KEYS.CART, cart);
      UI.toast('Removed: ' + (line.name || 'item'), { duration: 1600 });
      renderLines();
    });

    return el('article', { class: 'c-cart-line' }, [
      el('div', { class: 'c-cart-line__media' }, [
        el('img', { src: line.img || '/assets/img/burgers/placeholder-burger.svg', alt: line.name || '' })
      ]),
      el('div', { class: 'c-cart-line__body' }, [
        el('h3', { class: 'c-cart-line__name', text: line.name || 'Item' }),
        el('p',  { class: 'c-cart-line__mods', text: modSummary(line) }),
        line.notes ? el('p', { class: 'c-cart-line__notes', text: '“' + line.notes + '”' }) : null,
        el('span', { class: 'c-cart-line__price', text: API.formatRM(line.lineTotal) })
      ]),
      el('div', { class: 'c-cart-line__controls' }, [
        del,
        el('div', { class: 'qty' }, [dec, val, inc])
      ])
    ]);
  }

  function modSummary(line) {
    if (!line.modifiers) return '';
    const product = API.products.get(line.productId);
    if (!product) return '';

    const out = [];
    (product.modifiers || []).forEach(function (group) {
      const picks = (line.modifiers[group.id] || []);
      if (picks.length === 0) return;
      const labels = picks.map(function (id) {
        const opt = (group.options || []).find(function (o) { return o.id === id; });
        return opt ? opt.label : id;
      });
      out.push(labels.join(', '));
    });
    return out.join(' · ');
  }

  /* ---------- Totals ---------- */

  function getTotals() {
    const cart = STATE.getStore(STATE.KEYS.CART, []) || [];
    const subtotal = cart.reduce(function (sum, line) {
      return sum + (Number(line.lineTotal) || 0);
    }, 0);

    const settings = (STATE.getStore(STATE.KEYS.SETTINGS, {}) || {});
    const fulfilment = (settings.site && settings.site.fulfilment) || {};
    const deliveryFee = currentMode === 'delivery' ? (Number(fulfilment.deliveryFee) || 0) : 0;

    const discountPct = promoApplied ? Number(promoApplied.percent) : 0;
    const discountAmt = subtotal * (discountPct / 100);

    const taxable = subtotal - discountAmt + deliveryFee;
    const service = taxable * SERVICE_RATE;
    const total = taxable + service;

    return {
      subtotal:    subtotal,
      deliveryFee: deliveryFee,
      discountPct: discountPct,
      discountAmt: discountAmt,
      service:     service,
      total:       total,
      mode:        currentMode,
      promoCode:   promoApplied ? promoApplied.code : null
    };
  }

  function renderTotals() {
    const t = getTotals();

    setText('[data-cart-subtotal]', API.formatRM(t.subtotal));
    setText('[data-cart-service]',  API.formatRM(t.service));
    setText('[data-cart-total]',    API.formatRM(t.total));

    const dRow = qs('[data-cart-delivery-row]');
    if (dRow) {
      if (t.mode === 'delivery' && t.deliveryFee > 0) {
        dRow.removeAttribute('hidden');
        setText('[data-cart-delivery]', API.formatRM(t.deliveryFee));
      } else {
        dRow.setAttribute('hidden', 'hidden');
      }
    }

    const discRow = qs('[data-cart-discount-row]');
    if (discRow) {
      if (t.discountAmt > 0) {
        discRow.removeAttribute('hidden');
        setText('[data-cart-discount]', '-' + API.formatRM(t.discountAmt));
      } else {
        discRow.setAttribute('hidden', 'hidden');
      }
    }
  }

  function setText(selector, text) {
    const node = qs(selector);
    if (node) node.textContent = text;
  }

  /* ---------- Promo ---------- */

  function bindPromo() {
    const apply = qs('[data-cart-promo-apply]');
    const input = qs('[data-cart-promo-input]');
    const msg   = qs('[data-cart-promo-msg]');
    if (!apply || !input) return;

    apply.addEventListener('click', function () {
      const code = (input.value || '').trim();
      if (!code) return;
      const result = applyPromo(code);
      if (msg) {
        msg.textContent = result.message;
        msg.removeAttribute('hidden');
        msg.classList.toggle('field__error', !result.ok);
        msg.classList.toggle('field__hint', result.ok);
      }
      if (result.ok) {
        promoApplied = { code: code.toUpperCase(), percent: result.percent };
      } else {
        promoApplied = null;
      }
      renderTotals();
    });
  }

  // Hardcoded demo promo table (Settings could later own this)
  function applyPromo(code) {
    const up = (code || '').toUpperCase();
    const table = {
      WELCOME10: { percent: 10, message: 'WELCOME10 applied -- 10% off' },
      BURGER20:  { percent: 20, message: 'BURGER20 applied -- 20% off' }
    };
    if (table[up]) {
      return { ok: true, percent: table[up].percent, message: table[up].message };
    }
    return { ok: false, percent: 0, message: 'Invalid or expired promo code.' };
  }

  /* Re-render when cart changes (from any tab / page) */
  STATE.subscribe(STATE.KEYS.CART, renderLines);

  /* ---------- Expose ---------- */

  window.MyBurger.customer = window.MyBurger.customer || {};
  window.MyBurger.customer.cart = {
    render:     render,
    applyPromo: applyPromo,
    getTotals:  getTotals
  };
})();
