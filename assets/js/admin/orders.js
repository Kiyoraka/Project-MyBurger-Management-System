/* ============================================================
   MyBurger -- Admin Orders
   Kanban (NEW / PREP / READY / DONE) on desktop, status tabs
   on mobile. Cards show order #, item count, total, elapsed
   time chip (green<5/amber<10/red>10 minutes), status-
   transition CTA. Click card -> detail drawer.

   Public API (window.MyBurger.admin.orders):
     render() -> void
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const API   = MB.api;
  const STATE = MB.state;

  if (!UI || !API || !STATE) {
    console.error('[admin/orders] missing ui/api/state');
    return;
  }

  const el  = UI.el;
  const qs  = UI.qs;
  const qsa = UI.qsa;

  const STATUSES = ['NEW', 'PREPARING', 'READY', 'DONE'];
  const NEXT_STATUS = { NEW: 'PREPARING', PREPARING: 'READY', READY: 'DONE' };
  const CTA_LABEL   = { NEW: 'Accept', PREPARING: 'Mark Ready', READY: 'Complete' };
  const SHORT       = { NEW: 'new', PREPARING: 'prep', READY: 'ready', DONE: 'done' };

  let activeMobileStatus = 'NEW';

  /* ---------- Render ---------- */

  function render() {
    API.ready().then(function () {
      bindMobileTabs();
      renderKpis();
      renderColumns();
      applyMobileFilter();
    });
  }

  function bindMobileTabs() {
    qsa('[data-status-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        activeMobileStatus = tab.dataset.statusTab;
        qsa('[data-status-tab]').forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
        });
        applyMobileFilter();
      });
    });
  }

  function applyMobileFilter() {
    qsa('[data-col]').forEach(function (col) {
      col.classList.toggle('is-active-mobile', col.dataset.col === activeMobileStatus);
    });
  }

  /* ---------- KPI strip ---------- */

  function renderKpis() {
    const root = qs('[data-kpis]');
    if (!root) return;

    const orders = (API.orders.list() || []);
    const today  = orders.filter(function (o) {
      return sameDay(new Date(o.ts), new Date());
    });
    const revenue = today.reduce(function (s, o) { return s + Number(o.totals && o.totals.total || 0); }, 0);
    const avg     = today.length > 0 ? revenue / today.length : 0;

    const cards = [
      { label: 'Today Revenue',  value: API.formatRM(revenue) },
      { label: 'Orders Today',   value: String(today.length) },
      { label: 'Avg Ticket',     value: API.formatRM(avg) },
      { label: 'Avg Prep',       value: '8m 42s' }
    ];

    root.innerHTML = '';
    cards.forEach(function (c) {
      root.appendChild(el('div', { class: 'a-orders__kpi' }, [
        el('span', { class: 'a-orders__kpi-label', text: c.label }),
        el('span', { class: 'a-orders__kpi-value', text: c.value })
      ]));
    });
  }

  /* ---------- Columns ---------- */

  function renderColumns() {
    const orders = API.orders.list() || [];
    STATUSES.forEach(function (status) {
      const body = qs('[data-col-body="' + status + '"]');
      const col  = qs('[data-col="' + status + '"]');
      if (!body || !col) return;

      const inCol = orders.filter(function (o) {
        return (o.status || 'NEW') === status;
      });

      body.innerHTML = '';
      inCol.forEach(function (o) { body.appendChild(buildCard(o)); });

      const countEl = qs('[data-count]', col);
      if (countEl) countEl.textContent = String(inCol.length);
    });
  }

  function buildCard(order) {
    const items = (order.items || []).reduce(function (s, l) { return s + (Number(l.qty) || 0); }, 0);
    const elapsedMin = Math.floor((Date.now() - new Date(order.ts).getTime()) / 60000);

    const chipClass = elapsedMin < 5 ? 'time-chip time-chip--green' :
                      elapsedMin < 10 ? 'time-chip time-chip--amber' :
                                         'time-chip time-chip--red';

    const card = el('article', { class: 'a-order-card', dataset: { orderId: order.id } }, [
      el('div', { class: 'a-order-card__head' }, [
        el('span', { class: 'a-order-card__num',   text: '#' + order.number }),
        el('span', { class: 'a-order-card__total', text: API.formatRM(order.totals && order.totals.total || 0) })
      ]),
      el('div', { class: 'a-order-card__meta' }, [
        el('span', { text: items + ' items' }),
        el('span', { class: chipClass, text: elapsedMin <= 0 ? 'just now' : elapsedMin + 'm ago' })
      ])
    ]);

    if (NEXT_STATUS[order.status]) {
      const cta = el(
        'button',
        { type: 'button', class: 'btn btn--secondary btn--sm a-order-card__cta' },
        CTA_LABEL[order.status] + ' →'
      );
      cta.addEventListener('click', function (ev) {
        ev.stopPropagation();
        advance(order);
      });
      card.appendChild(cta);
    }

    card.addEventListener('click', function () {
      openDetail(order);
    });

    return card;
  }

  function advance(order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    API.orders.setStatus(order.id, next);
    UI.toast('#' + order.number + ' → ' + next, { variant: 'success', duration: 1500 });
  }

  /* ---------- Detail drawer ---------- */

  function openDetail(order) {
    const items = (order.items || []).map(function (line) {
      return el('div', { class: 'a-order-detail__item' }, [
        el('div', {}, [
          el('span', { text: (line.name || 'Item') + (line.qty > 1 ? '  ×' + line.qty : '') }),
          line.notes ? el('div', { class: 'field__hint', text: line.notes }) : null
        ]),
        el('span', { class: 'tabular', text: API.formatRM(line.lineTotal) })
      ]);
    });

    const cust = order.customer || {};
    const ful  = order.fulfilment || {};
    const pay  = order.payment || {};
    const totals = order.totals || {};

    const close = function () { UI.drawer.close(); };
    const node  = el('div', { class: 'a-order-detail' }, [
      el('div', { class: 'a-order-detail__header' }, [
        el('h3', { class: 'a-order-detail__title', text: 'Order #' + order.number }),
        el('button', { type: 'button', class: 'modal__close', 'aria-label': 'Close', onclick: close }, '✕')
      ]),
      el('div', { class: 'a-order-detail__body' }, [
        el('section', { class: 'a-order-detail__section' }, [
          el('h4', { text: 'Items' }),
          el('div', {}, items)
        ]),
        el('section', { class: 'a-order-detail__section' }, [
          el('h4', { text: 'Customer' }),
          el('div', { text: cust.name || '—' }),
          el('div', { class: 'field__hint', text: (cust.phone || '') + (cust.email ? ' · ' + cust.email : '') }),
          ful.mode === 'delivery' ? el('div', { class: 'field__hint', text: [cust.address, cust.postcode, cust.city, cust.state].filter(Boolean).join(', ') }) : null
        ]),
        el('section', { class: 'a-order-detail__section' }, [
          el('h4', { text: 'Fulfilment' }),
          el('div', { text: (ful.mode || 'pickup').toUpperCase() + ' · ' + (ful.when === 'schedule' ? ('Scheduled ' + (ful.scheduleTime || '')) : 'ASAP') })
        ]),
        el('section', { class: 'a-order-detail__section' }, [
          el('h4', { text: 'Payment' }),
          el('div', { text: (pay.method || 'fpx').toUpperCase() + (pay.bank ? ' · ' + pay.bank : '') }),
          el('div', { class: 'field__hint', text: 'Status: ' + (pay.status || 'PAID') + (pay.billId ? ' · Bill ' + pay.billId : '') })
        ]),
        el('section', { class: 'a-order-detail__section' }, [
          el('h4', { text: 'Totals' }),
          el('div', { class: 'a-order-detail__item' }, [el('span', { text: 'Subtotal' }), el('span', { class: 'tabular', text: API.formatRM(totals.subtotal || 0) })]),
          totals.deliveryFee > 0 ? el('div', { class: 'a-order-detail__item' }, [el('span', { text: 'Delivery' }), el('span', { class: 'tabular', text: API.formatRM(totals.deliveryFee) })]) : null,
          el('div', { class: 'a-order-detail__item' }, [el('span', { text: 'Service' }),  el('span', { class: 'tabular', text: API.formatRM(totals.service || 0) })]),
          el('div', { class: 'a-order-detail__item' }, [el('span', { text: 'Total' }),    el('span', { class: 'tabular', text: API.formatRM(totals.total || 0) })])
        ])
      ]),
      el('div', { class: 'a-order-detail__footer' }, [
        NEXT_STATUS[order.status]
          ? el('button', {
              type: 'button',
              class: 'btn btn--primary btn--block btn--lg',
              onclick: function () { advance(order); close(); }
            }, CTA_LABEL[order.status] + ' →')
          : el('span', { class: 'field__hint', text: 'No further status transitions.' }),
        el('div', { class: 'hstack' }, [
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: function () { UI.toast('Receipt sent to printer (mock)'); } }, 'Reprint'),
          el('button', { type: 'button', class: 'btn btn--danger btn--sm', onclick: function () { UI.toast('Refund requested (mock)', { variant: 'warning' }); } }, 'Refund')
        ])
      ])
    ]);

    UI.drawer.open(node, 'right');
  }

  /* ---------- Helpers ---------- */

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  /* Live update on order changes -- detect newly arrived NEW orders */
  let lastNewCount = -1;

  STATE.subscribe(STATE.KEYS.ORDERS, function () {
    renderKpis();
    renderColumns();
    applyMobileFilter();

    const orders = API.orders.list() || [];
    const newOrders = orders.filter(function (o) { return (o.status || 'NEW') === 'NEW'; });
    if (lastNewCount >= 0 && newOrders.length > lastNewCount) {
      const settings = (STATE.getStore(STATE.KEYS.SETTINGS, {}) || {});
      const wantSound = !(settings.notifications && settings.notifications.newOrderSound === false);
      UI.toast('New order #' + newOrders[0].number, { variant: 'success' });
      if (wantSound) playBeep();
    }
    lastNewCount = newOrders.length;
  });

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (err) {
      /* audio context unavailable -- silent fallback */
    }
  }

  /* Re-render time chips every 30s */
  setInterval(function () {
    if (document.visibilityState === 'visible') renderColumns();
  }, 30000);

  /* ---------- Expose ---------- */

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.admin = window.MyBurger.admin || {};
  window.MyBurger.admin.orders = { render: render };
})();
