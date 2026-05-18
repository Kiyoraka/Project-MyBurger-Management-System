/* ============================================================
   MyBurger -- Admin Inventory
   Table on desktop, cards on mobile. Search filter, restock
   modal, 86 toggle (sets product.active false on storefront).
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const API   = MB.api;
  const STATE = MB.state;

  if (!UI || !API || !STATE) return;

  const el  = UI.el;
  const qs  = UI.qs;
  const qsa = UI.qsa;

  let searchTerm = '';

  function render() {
    API.ready().then(function () {
      bindSearch();
      renderKpis();
      renderRows();
    });
  }

  function bindSearch() {
    const input = qs('[data-inv-search]');
    if (!input) return;
    input.addEventListener('input', function () {
      searchTerm = (input.value || '').trim().toLowerCase();
      renderRows();
    });
  }

  function renderKpis() {
    const root = qs('[data-kpis]');
    if (!root) return;
    const inv = API.inventory.list() || [];
    const low = inv.filter(function (r) {
      const s = Number(r.stock), low = Number(r.lowStockAt || 0);
      return s > 0 && s <= low;
    });
    const out = inv.filter(function (r) { return Number(r.stock) === 0; });

    root.innerHTML = '';
    [
      { label: 'Total items',  value: inv.length },
      { label: 'Low stock',    value: low.length },
      { label: 'Out of stock', value: out.length }
    ].forEach(function (c) {
      root.appendChild(el('div', { class: 'a-inv__kpi' }, [
        el('span', { class: 'a-inv__kpi-label', text: c.label }),
        el('span', { class: 'a-inv__kpi-value', text: String(c.value) })
      ]));
    });
  }

  function rowState(r) {
    const s = Number(r.stock), low = Number(r.lowStockAt || 0);
    if (s === 0) return 'out';
    if (s <= low) return 'low';
    return 'ok';
  }

  function renderRows() {
    const tbody = qs('[data-inv-rows]');
    const cards = qs('[data-inv-cards]');
    if (!tbody || !cards) return;

    const inv = (API.inventory.list() || []).slice().filter(function (r) {
      if (!searchTerm) return true;
      const p = API.products.get(r.productId);
      const name = p ? p.name.toLowerCase() : '';
      return name.indexOf(searchTerm) !== -1;
    });

    tbody.innerHTML = '';
    cards.innerHTML = '';

    if (inv.length === 0) {
      tbody.appendChild(el('tr', {}, [el('td', { colspan: 5, text: 'No products match the search.' })]));
      cards.appendChild(el('p', { class: 'field__hint', text: 'No products match the search.' }));
      return;
    }

    inv.forEach(function (r) {
      tbody.appendChild(buildRow(r));
      cards.appendChild(buildCard(r));
    });
  }

  function buildRow(r) {
    const product = API.products.get(r.productId);
    const name = product ? product.name : r.productId;
    const state = rowState(r);

    const restock = el('button', { type: 'button', class: 'btn btn--secondary btn--sm', onclick: function () { openRestock(r); } }, 'Restock');
    const eightySix = el('button', { type: 'button', class: 'btn btn--danger btn--sm', onclick: function () { toggle86(r); } }, product && product.active === false ? 'Re-list' : '86');

    return el('tr', { class: state !== 'ok' ? 'a-inv__row--' + state : null }, [
      el('td', { text: name }),
      el('td', { class: 'tabular', text: String(r.stock) }),
      el('td', { class: 'tabular', text: String(r.lowStockAt || 0) }),
      el('td', { text: r.lastRestock ? formatDate(r.lastRestock) : '—' }),
      el('td', { class: 'a-inv__actions-col' }, [
        el('div', { class: 'a-inv__row-actions' }, [restock, eightySix])
      ])
    ]);
  }

  function buildCard(r) {
    const product = API.products.get(r.productId);
    const name = product ? product.name : r.productId;
    const state = rowState(r);
    const cls = 'a-inv-card' + (state !== 'ok' ? ' a-inv-card--' + state : '');

    return el('div', { class: cls }, [
      el('div', { class: 'a-inv-card__head' }, [
        el('span', { class: 'a-inv-card__name', text: name }),
        el('span', { class: 'tabular', text: String(r.stock) })
      ]),
      el('div', { class: 'a-inv-card__meta', text: 'Low at ' + (r.lowStockAt || 0) + ' · last ' + (r.lastRestock ? formatDate(r.lastRestock) : '—') }),
      el('div', { class: 'a-inv-card__actions' }, [
        el('button', { type: 'button', class: 'btn btn--secondary btn--sm', onclick: function () { openRestock(r); } }, 'Restock'),
        el('button', { type: 'button', class: 'btn btn--danger btn--sm', onclick: function () { toggle86(r); } }, product && product.active === false ? 'Re-list' : '86')
      ])
    ]);
  }

  function openRestock(r) {
    const product = API.products.get(r.productId);
    const qtyInput = el('input', { class: 'input', type: 'number', min: '1', value: '10' });

    const apply = el('button', {
      type: 'button',
      class: 'btn btn--primary btn--block btn--lg',
      onclick: function () {
        const qty = Number(qtyInput.value) || 0;
        if (qty <= 0) { UI.toast('Enter a positive quantity', { variant: 'warning' }); return; }
        API.inventory.restock(r.productId, qty);
        UI.toast('Restocked ' + (product ? product.name : r.productId) + ' (+' + qty + ')', { variant: 'success' });
        UI.modal.close();
      }
    }, 'Apply restock');

    const node = el('div', { class: 'a-restock' }, [
      el('h3', { class: 'mb-cust__title', text: 'Restock ' + (product ? product.name : r.productId) }),
      el('p', { class: 'field__hint', text: 'Current stock: ' + r.stock + ' · Low at ' + (r.lowStockAt || 0) }),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', text: 'Add quantity' }),
        qtyInput
      ]),
      apply,
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: function () { UI.modal.close(); } }, 'Cancel')
    ]);

    UI.modal.open(node);
  }

  function toggle86(r) {
    const product = API.products.get(r.productId);
    if (!product) return;
    const next = !(product.active === false ? false : true); // toggle
    product.active = !next;  // false means hidden, true means active
    API.products.save(product);
    UI.toast(product.name + (product.active ? ' relisted' : ' marked 86'), { variant: 'warning' });
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' });
  }

  STATE.subscribe(STATE.KEYS.INVENTORY, function () { renderKpis(); renderRows(); });
  STATE.subscribe(STATE.KEYS.PRODUCTS,  renderRows);

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.admin = window.MyBurger.admin || {};
  window.MyBurger.admin.inventory = { render: render };
})();
