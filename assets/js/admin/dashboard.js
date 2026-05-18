/* ============================================================
   MyBurger -- Admin Dashboard logic
   Computes today's snapshot (revenue, order count, avg ticket,
   avg prep), lists the latest 4 live orders, low-stock alerts,
   top items sold today, and a 7-day revenue sparkline.

   Public API (window.MyBurger.admin.dashboard):
     render() -> void
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const API   = MB.api;
  const STATE = MB.state;

  if (!UI || !API || !STATE) {
    console.error('[admin/dashboard] missing ui/api/state');
    return;
  }

  const el = UI.el;
  const qs = UI.qs;

  /* ---------- Render ---------- */

  function render() {
    API.ready().then(function () {
      renderKpis();
      renderQueue();
      renderLowStock();
      renderTopItems();
      renderSparkline();
    });
  }

  /* ---------- Helpers ---------- */

  function startOfDay(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function ordersToday() {
    const todayStart = startOfDay(new Date()).getTime();
    return (API.orders.list() || []).filter(function (o) {
      return new Date(o.ts).getTime() >= todayStart;
    });
  }

  function ordersYesterday() {
    const today = startOfDay(new Date()).getTime();
    const yest  = today - 24 * 60 * 60 * 1000;
    return (API.orders.list() || []).filter(function (o) {
      const t = new Date(o.ts).getTime();
      return t >= yest && t < today;
    });
  }

  function pct(curr, prev) {
    if (!prev) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  /* ---------- KPI cards ---------- */

  function renderKpis() {
    const root = qs('[data-kpis]');
    if (!root) return;

    const today = ordersToday();
    const yest  = ordersYesterday();

    const revenue = today.reduce(function (s, o) { return s + Number(o.totals && o.totals.total || 0); }, 0);
    const yestRev = yest.reduce(function (s, o) { return s + Number(o.totals && o.totals.total || 0); }, 0);
    const avg     = today.length > 0 ? revenue / today.length : 0;
    const yestAvg = yest.length > 0 ? yestRev / yest.length : 0;

    const cards = [
      { label: 'Revenue', value: API.formatRM(revenue), delta: pct(revenue, yestRev), unit: '%' },
      { label: 'Orders',  value: String(today.length), delta: today.length - yest.length, unit: '' },
      { label: 'Avg Ticket', value: API.formatRM(avg), delta: pct(avg, yestAvg), unit: '%' },
      { label: 'Avg Prep', value: '8m 42s', delta: -40, unit: 's' }   // demo placeholder
    ];

    root.innerHTML = '';
    cards.forEach(function (c) {
      const arrow = c.delta > 0 ? '↑' : (c.delta < 0 ? '↓' : '·');
      const variant = c.delta > 0 ? 'a-kpi__delta--up' :
                      c.delta < 0 ? (c.label === 'Avg Prep' ? 'a-kpi__delta--up' : 'a-kpi__delta--bad') :
                                    'a-kpi__delta--down';
      root.appendChild(el('article', { class: 'a-kpi' }, [
        el('span', { class: 'a-kpi__label', text: c.label }),
        el('span', { class: 'a-kpi__value', text: c.value }),
        el('span', { class: 'a-kpi__delta ' + variant, text: arrow + ' ' + Math.abs(c.delta) + c.unit + ' vs yesterday' })
      ]));
    });
  }

  /* ---------- Live queue ---------- */

  function renderQueue() {
    const root = qs('[data-queue]');
    if (!root) return;
    root.innerHTML = '';

    const orders = (API.orders.list() || []).slice(0, 4);
    if (orders.length === 0) {
      root.appendChild(el('li', { class: 'a-widget__row', text: 'No orders yet today.' }));
      return;
    }

    orders.forEach(function (o) {
      const items = (o.items || []).reduce(function (s, line) { return s + (Number(line.qty) || 0); }, 0);
      root.appendChild(el('li', { class: 'a-widget__row' }, [
        el('div', { class: 'a-widget__row-main' }, [
          el('span', { class: 'a-widget__row-name', text: '#' + o.number }),
          el('span', { class: 'status status--' + (o.status || 'new').toLowerCase(), text: o.status || 'NEW' }),
          el('span', { class: 'a-widget__row-meta', text: items + ' items' })
        ]),
        el('span', { class: 'a-widget__row-val', text: API.formatRM(o.totals && o.totals.total || 0) })
      ]));
    });
  }

  /* ---------- Low stock ---------- */

  function renderLowStock() {
    const root = qs('[data-low-stock]');
    if (!root) return;
    root.innerHTML = '';

    const inv = (API.inventory.list() || [])
      .filter(function (r) {
        return Number(r.stock) <= Number(r.lowStockAt || 0);
      })
      .slice(0, 5);

    if (inv.length === 0) {
      root.appendChild(el('li', { class: 'a-widget__row', text: 'Everything stocked.' }));
      return;
    }

    inv.forEach(function (r) {
      const product = API.products.get(r.productId);
      const out = Number(r.stock) === 0;
      const dot = out ? 'badge badge--danger badge--dot' :
                        'badge badge--warning badge--dot';
      root.appendChild(el('li', { class: 'a-widget__row' }, [
        el('div', { class: 'a-widget__row-main' }, [
          el('span', { class: dot }),
          el('span', { class: 'a-widget__row-name', text: product ? product.name : r.productId })
        ]),
        el('span', { class: 'a-widget__row-val', text: String(r.stock) })
      ]));
    });
  }

  /* ---------- Top items today ---------- */

  function renderTopItems() {
    const root = qs('[data-top-items]');
    if (!root) return;
    root.innerHTML = '';

    const counts = {};
    ordersToday().forEach(function (o) {
      (o.items || []).forEach(function (line) {
        counts[line.productId] = (counts[line.productId] || 0) + (Number(line.qty) || 0);
      });
    });

    const sorted = Object.keys(counts).map(function (id) {
      const p = API.products.get(id);
      return { name: p ? p.name : id, count: counts[id] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 5);

    if (sorted.length === 0) {
      root.appendChild(el('li', { class: 'a-widget__row', text: 'No items sold yet today.' }));
      return;
    }

    sorted.forEach(function (item) {
      root.appendChild(el('li', { class: 'a-widget__row' }, [
        el('span', { class: 'a-widget__row-name', text: item.name }),
        el('span', { class: 'a-widget__row-val', text: item.count + '× sold' })
      ]));
    });
  }

  /* ---------- 7-day sparkline ---------- */

  function renderSparkline() {
    const root = qs('[data-sparkline]');
    if (!root) return;
    root.innerHTML = '';

    const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    const buckets = [0, 0, 0, 0, 0, 0, 0];
    const today  = startOfDay(new Date()).getTime();
    const weekAgo = today - 6 * 24 * 60 * 60 * 1000;

    (API.orders.list() || []).forEach(function (o) {
      const ts = new Date(o.ts).getTime();
      if (ts < weekAgo) return;
      const idx = Math.floor((ts - weekAgo) / (24 * 60 * 60 * 1000));
      if (idx >= 0 && idx < 7) {
        buckets[idx] += Number(o.totals && o.totals.total || 0);
      }
    });

    const max = Math.max.apply(null, buckets.concat([1]));
    buckets.forEach(function (val, i) {
      const heightPct = Math.max((val / max) * 100, 4);
      const bar = el('div', { class: 'a-spark__bar' }, [
        el('div', {
          class: 'a-spark__fill',
          style: { height: heightPct + '%' }
        }),
        el('span', { class: 'a-spark__label', text: labels[i] })
      ]);
      root.appendChild(bar);
    });
  }

  /* Re-render on order / inventory mutation */
  STATE.subscribe(STATE.KEYS.ORDERS,    function () { renderKpis(); renderQueue(); renderTopItems(); renderSparkline(); });
  STATE.subscribe(STATE.KEYS.INVENTORY, renderLowStock);

  /* ---------- Expose ---------- */

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.admin = window.MyBurger.admin || {};
  window.MyBurger.admin.dashboard = { render: render };
})();
