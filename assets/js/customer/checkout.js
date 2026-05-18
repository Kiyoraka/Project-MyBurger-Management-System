/* ============================================================
   MyBurger -- Checkout page logic
   Validates the three form sections (Contact / Fulfilment /
   Payment), builds an order object from cart + form, calls the
   Billplz adapter to obtain a bill_id + redirect URL (mocked
   here -- real createBill() ships when this becomes server-
   side), pushes the order, decrements inventory, clears cart,
   and reveals the confirmation slate.

   Public API (window.MyBurger.customer.checkout):
     render()         -> void
     submit()         -> Promise
     billplz          -> { createBill(payload) -> Promise }
     getTotals()      -> totals object
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const API   = MB.api;
  const STATE = MB.state;

  if (!UI || !API || !STATE) {
    console.error('[checkout] missing ui/api/state');
    return;
  }

  const el  = UI.el;
  const qs  = UI.qs;
  const qsa = UI.qsa;

  const SERVICE_RATE = 0.06;

  let currentMode    = 'pickup';
  let currentWhen    = 'asap';
  let currentMethod  = 'fpx';
  let promoApplied   = null;   // pulled from cart key for parity

  /* ---------- Render ---------- */

  function render() {
    API.ready().then(function () {
      hydrateFromCart();
      bindFulfilment();
      bindWhen();
      bindPaymentTabs();
      bindSubmit();
      renderSummary();
    });
  }

  function hydrateFromCart() {
    currentMode = STATE.getStore('myburger:cart-mode', 'pickup');
    const radio = qs('input[data-co-mode="' + currentMode + '"]');
    if (radio) radio.checked = true;
    toggleDeliveryFields();
  }

  /* ---------- Bindings ---------- */

  function bindFulfilment() {
    const radios = qsa('input[name="mode"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) {
          currentMode = radio.value;
          STATE.setStore('myburger:cart-mode', currentMode);
          toggleDeliveryFields();
          renderSummary();
        }
      });
    });
  }

  function toggleDeliveryFields() {
    const block = qs('[data-delivery-fields]');
    if (!block) return;
    if (currentMode === 'delivery') block.removeAttribute('hidden');
    else                              block.setAttribute('hidden', 'hidden');
  }

  function bindWhen() {
    const radios = qsa('input[name="when"]');
    const schedule = qs('[data-when-schedule]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        currentWhen = radio.value;
        if (!schedule) return;
        if (currentWhen === 'schedule') schedule.removeAttribute('hidden');
        else                             schedule.setAttribute('hidden', 'hidden');
      });
    });
  }

  function bindPaymentTabs() {
    const tabs = qsa('[data-pay-method]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        const method = tab.dataset.payMethod;
        currentMethod = method;
        tabs.forEach(function (t) {
          const active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        qsa('[data-pay-pane]').forEach(function (pane) {
          if (pane.dataset.payPane === method) pane.removeAttribute('hidden');
          else                                  pane.setAttribute('hidden', 'hidden');
        });
      });
    });
  }

  function bindSubmit() {
    const form = qs('#checkout-form');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      submit();
    });
  }

  /* ---------- Validation ---------- */

  function readForm() {
    return {
      name:         (qs('#co-name')     || {}).value || '',
      phone:        (qs('#co-phone')    || {}).value || '',
      email:        (qs('#co-email')    || {}).value || '',
      mode:         currentMode,
      when:         currentWhen,
      scheduleTime: (qs('#co-schedule') || {}).value || '',
      address:      (qs('#co-addr')     || {}).value || '',
      postcode:     (qs('#co-postcode') || {}).value || '',
      city:         (qs('#co-city')     || {}).value || '',
      state:        (qs('#co-state')    || {}).value || '',
      bank:         (qs('#co-bank')     || {}).value || '',
      method:       currentMethod
    };
  }

  function validate(form) {
    const errors = [];
    if (!form.name.trim())  errors.push('Name is required');
    if (!form.phone.trim()) errors.push('Phone is required');
    if (!form.email.trim() || !/.+@.+\..+/.test(form.email)) errors.push('Valid email is required');
    if (form.when === 'schedule' && !form.scheduleTime) errors.push('Schedule time is required');
    if (form.mode === 'delivery') {
      if (!form.address.trim())  errors.push('Delivery address is required');
      if (!form.postcode.trim()) errors.push('Postcode is required');
      if (!form.city.trim())     errors.push('City is required');
      if (!form.state.trim())    errors.push('State is required');
    }
    const cart = STATE.getStore(STATE.KEYS.CART, []);
    if (!cart || cart.length === 0) errors.push('Your cart is empty');
    return errors;
  }

  /* ---------- Submit flow ---------- */

  function submit() {
    const form = readForm();
    const errors = validate(form);
    if (errors.length > 0) {
      UI.toast(errors[0], { variant: 'warning', duration: 3000 });
      return Promise.resolve({ ok: false, errors: errors });
    }

    const totals = computeTotals(form.mode);
    const orderNumber = API.orderNumber();

    const order = {
      id:        API.id('ord'),
      number:    orderNumber,
      ts:        new Date().toISOString(),
      status:    'NEW',
      items:     STATE.getStore(STATE.KEYS.CART, []),
      customer:  {
        name: form.name, phone: form.phone, email: form.email,
        address: form.address, postcode: form.postcode, city: form.city, state: form.state
      },
      fulfilment: {
        mode: form.mode, when: form.when, scheduleTime: form.scheduleTime || null
      },
      payment: {
        provider: 'billplz',
        method:   form.method,
        bank:     form.method === 'fpx' ? form.bank : null,
        mode:     'test',
        status:   form.method === 'cash' ? 'COD' : 'PAID',
        billId:   null,
        callback: null
      },
      totals: totals
    };

    const submitBtn = qs('[data-co-submit]');
    if (submitBtn) {
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.textContent = 'Processing...';
    }

    return billplzCreateBill(order)
      .then(function (bill) {
        order.payment.billId   = bill.id;
        order.payment.callback = bill.callbackUrl;

        // Persist order
        const orders = STATE.getStore(STATE.KEYS.ORDERS, []);
        orders.unshift(order);
        STATE.setStore(STATE.KEYS.ORDERS, orders);

        // Decrement inventory
        decrementInventory(order.items);

        // Clear cart
        STATE.setStore(STATE.KEYS.CART, []);

        // Reveal confirmation
        showConfirmation(order);
        UI.toast('Order placed successfully', { variant: 'success' });

        return { ok: true, order: order };
      })
      .catch(function (err) {
        console.error('[checkout] submit failed:', err);
        UI.toast('Payment failed. Please try again.', { variant: 'danger' });
        if (submitBtn) {
          submitBtn.removeAttribute('disabled');
          submitBtn.textContent = 'Place Order →';
        }
        return { ok: false, error: err };
      });
  }

  /* ---------- Billplz adapter (shim) ----------
     Real implementation would POST to /api/billplz/create-bill
     server-side (collection_id, email, name, amount, callback_url,
     redirect_url) and return { id, url, signature }. Here we mock.
  --------------------------------------------- */

  function billplzCreateBill(order) {
    return new Promise(function (resolve) {
      const settings = STATE.getStore(STATE.KEYS.SETTINGS, {}) || {};
      const payment  = settings.payment || {};
      const collection = payment.collectionId || 'test-collection';

      // Simulate network latency
      setTimeout(function () {
        const billId = 'bill-' + Math.random().toString(36).slice(2, 10);
        resolve({
          id: billId,
          url: 'https://www.billplz-sandbox.com/bills/' + billId,
          callbackUrl: payment.callbackUrl || 'https://myburger.example.com/api/billplz/callback',
          collectionId: collection,
          signature: 'mock-signature'
        });
      }, 450);
    });
  }

  /* ---------- Inventory decrement ---------- */

  function decrementInventory(items) {
    (items || []).forEach(function (line) {
      const qty = Number(line.qty) || 0;
      if (qty <= 0) return;
      try {
        API.inventory.decrement(line.productId, qty);
      } catch (err) {
        console.warn('[checkout] inventory decrement failed for', line.productId, err);
      }
    });
  }

  /* ---------- Summary render ---------- */

  function computeTotals(mode) {
    const cart = STATE.getStore(STATE.KEYS.CART, []) || [];
    const subtotal = cart.reduce(function (sum, line) {
      return sum + (Number(line.lineTotal) || 0);
    }, 0);

    const settings = (STATE.getStore(STATE.KEYS.SETTINGS, {}) || {});
    const fulfilment = (settings.site && settings.site.fulfilment) || {};
    const deliveryFee = mode === 'delivery' ? (Number(fulfilment.deliveryFee) || 0) : 0;

    // Pull promo result from cart module if available
    const cartModule = MB.customer && MB.customer.cart;
    const cartTotals = cartModule && cartModule.getTotals ? cartModule.getTotals() : null;
    const discountAmt = cartTotals ? Number(cartTotals.discountAmt) || 0 : 0;

    const taxable = subtotal - discountAmt + deliveryFee;
    const service = taxable * SERVICE_RATE;
    const total = taxable + service;

    return {
      subtotal:    subtotal,
      deliveryFee: deliveryFee,
      discountAmt: discountAmt,
      service:     service,
      total:       total
    };
  }

  function renderSummary() {
    const cart = STATE.getStore(STATE.KEYS.CART, []) || [];
    const totals = computeTotals(currentMode);

    const list = qs('[data-summary-list]');
    if (list) {
      list.innerHTML = '';
      cart.forEach(function (line) {
        list.appendChild(buildSummaryItem(line));
      });
    }

    setText('[data-summary-subtotal]', API.formatRM(totals.subtotal));
    setText('[data-summary-service]',  API.formatRM(totals.service));
    setText('[data-summary-total]',    API.formatRM(totals.total));

    const dRow = qs('[data-summary-delivery-row]');
    if (dRow) {
      if (currentMode === 'delivery' && totals.deliveryFee > 0) {
        dRow.removeAttribute('hidden');
        setText('[data-summary-delivery]', API.formatRM(totals.deliveryFee));
      } else {
        dRow.setAttribute('hidden', 'hidden');
      }
    }

    const dscRow = qs('[data-summary-discount-row]');
    if (dscRow) {
      if (totals.discountAmt > 0) {
        dscRow.removeAttribute('hidden');
        setText('[data-summary-discount]', '-' + API.formatRM(totals.discountAmt));
      } else {
        dscRow.setAttribute('hidden', 'hidden');
      }
    }

    // Mobile summary body
    const mob = qs('[data-summary-mobile-body]');
    if (mob) {
      mob.innerHTML = '';
      cart.forEach(function (line) {
        mob.appendChild(buildSummaryItem(line));
      });
    }
    setText('[data-summary-total-mobile]', API.formatRM(totals.total));
  }

  function buildSummaryItem(line) {
    return el('li', { class: 'c-checkout__summary-item' }, [
      el('img', { src: line.img || '/assets/img/burgers/placeholder-burger.svg', alt: line.name || '' }),
      el('div', {}, [
        el('div', { class: 'c-checkout__summary-item-name', text: line.name + (line.qty > 1 ? ' x' + line.qty : '') }),
        line.notes ? el('div', { class: 'c-checkout__summary-item-meta', text: line.notes }) : null
      ]),
      el('span', { class: 'c-checkout__summary-item-price', text: API.formatRM(line.lineTotal) })
    ]);
  }

  function setText(selector, text) {
    const node = qs(selector);
    if (node) node.textContent = text;
  }

  /* ---------- Confirmation slate ---------- */

  function showConfirmation(order) {
    const slate = qs('[data-confirm]');
    const layout = qs('.c-checkout__layout');
    const summaryMobile = qs('[data-summary-mobile]');
    if (layout) layout.setAttribute('hidden', 'hidden');
    if (summaryMobile) summaryMobile.setAttribute('hidden', 'hidden');
    if (!slate) return;

    slate.removeAttribute('hidden');
    setText('[data-confirm-number]', '#' + order.number);
    setText('[data-confirm-eta]',
      order.fulfilment.mode === 'delivery' ? '~35 min' : '~15 min');
    setText('[data-confirm-total]', API.formatRM(order.totals.total));

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Re-render summary on cart or settings changes */
  STATE.subscribe(STATE.KEYS.CART,     renderSummary);
  STATE.subscribe(STATE.KEYS.SETTINGS, renderSummary);

  /* ---------- Expose ---------- */

  window.MyBurger.customer = window.MyBurger.customer || {};
  window.MyBurger.customer.checkout = {
    render:    render,
    submit:    submit,
    billplz:   { createBill: billplzCreateBill },
    getTotals: function () { return computeTotals(currentMode); }
  };
})();
