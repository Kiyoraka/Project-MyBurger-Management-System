/* ============================================================
   MyBurger -- API / Data Module
   Sits on top of state.js. Responsibilities:
     - First-visit hydration: load assets/data/seed.json into
       localStorage if the seed mark is missing.
     - CRUD helpers for products / categories / orders / inventory
       / settings -- each returns the persisted shape and emits
       via state.setStore.
     - ID generation (id() / orderNumber()) and currency formatting
       (formatRM()).

   Public API (attached to window.MyBurger.api):
     hydrate()  -> Promise<boolean>  // resolves true if seeded now
     ready()    -> Promise<void>     // resolves once hydration done
     id(prefix)
     orderNumber()
     formatRM(amount)

     products.list() / get(id) / save(product) / remove(id)
     categories.list() / get(id)
     orders.list() / get(id) / create(order) / setStatus(id, status)
     inventory.list() / get(productId) / restock(productId, qty)
                       / decrement(productId, qty) / setStock(productId, n)
     settings.get() / save(patch)
   ============================================================ */

(function () {
  'use strict';

  const STATE = (window.MyBurger && window.MyBurger.state);
  if (!STATE) {
    console.error('[api] state module missing -- include assets/js/state.js BEFORE api.js');
    return;
  }
  const KEYS = STATE.KEYS;

  /* ---------- ID / number generators ---------- */

  function id(prefix) {
    const p = prefix || 'id';
    const rand = Math.random().toString(36).slice(2, 8);
    return p + '-' + Date.now().toString(36) + '-' + rand;
  }

  function orderNumber() {
    // Human-readable sequential-ish: derive from last order in store or start at 1001
    const orders = STATE.getStore(KEYS.ORDERS, []);
    let max = 1000;
    for (let i = 0; i < orders.length; i++) {
      const n = orders[i].number;
      if (typeof n === 'number' && n > max) max = n;
    }
    return max + 1;
  }

  /* ---------- Currency formatter ---------- */

  const RM_FORMATTER = new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function formatRM(amount) {
    const n = Number(amount);
    if (!isFinite(n)) return 'RM 0.00';
    return 'RM ' + RM_FORMATTER.format(n);
  }

  /* ---------- Hydration ---------- */

  let hydrationPromise = null;

  function hydrate() {
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async function () {
      const seeded = STATE.getStore(KEYS.SEED_MARK, false);
      if (seeded === true) return false;

      try {
        const res = await fetch('assets/data/seed.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('seed.json HTTP ' + res.status);
        const seed = await res.json();

        STATE.setStore(KEYS.PRODUCTS,   seed.products   || []);
        STATE.setStore(KEYS.CATEGORIES, seed.categories || []);
        STATE.setStore(KEYS.INVENTORY,  seed.inventory  || []);
        STATE.setStore(KEYS.ORDERS,     seed.orders     || []);
        STATE.setStore(KEYS.SETTINGS,   seed.settings   || {});
        STATE.setStore(KEYS.SEED_MARK,  true);
        return true;
      } catch (err) {
        console.error('[api] hydrate failed:', err);
        return false;
      }
    })();
    return hydrationPromise;
  }

  function ready() {
    return hydrate().then(function () { /* swallow boolean */ });
  }

  /* ---------- Products ---------- */

  const products = {
    list: function () { return STATE.getStore(KEYS.PRODUCTS, []); },
    get:  function (productId) {
      return this.list().find(function (p) { return p.id === productId; }) || null;
    },
    save: function (product) {
      const list = this.list();
      if (!product.id) product.id = id('prod');
      const idx = list.findIndex(function (p) { return p.id === product.id; });
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], product);
      else          list.push(product);
      STATE.setStore(KEYS.PRODUCTS, list);
      return product;
    },
    remove: function (productId) {
      const list = this.list().filter(function (p) { return p.id !== productId; });
      STATE.setStore(KEYS.PRODUCTS, list);
      return true;
    }
  };

  /* ---------- Categories ---------- */

  const categories = {
    list: function () {
      return STATE.getStore(KEYS.CATEGORIES, []).slice().sort(function (a, b) {
        return (a.sort || 0) - (b.sort || 0);
      });
    },
    get: function (categoryId) {
      return this.list().find(function (c) { return c.id === categoryId; }) || null;
    }
  };

  /* ---------- Orders ---------- */

  const ORDER_STATUSES = ['NEW', 'PREPARING', 'READY', 'DONE', 'CANCELLED'];

  const orders = {
    list: function () { return STATE.getStore(KEYS.ORDERS, []); },
    get:  function (orderId) {
      return this.list().find(function (o) { return o.id === orderId; }) || null;
    },
    create: function (order) {
      const list = this.list();
      const now  = new Date().toISOString();
      const built = Object.assign({
        id:       id('ord'),
        number:   orderNumber(),
        ts:       now,
        status:   'NEW',
        history:  [{ status: 'NEW', ts: now }]
      }, order);
      list.unshift(built);
      STATE.setStore(KEYS.ORDERS, list);
      return built;
    },
    setStatus: function (orderId, nextStatus) {
      if (ORDER_STATUSES.indexOf(nextStatus) === -1) {
        console.warn('[api] invalid order status:', nextStatus);
        return null;
      }
      const list = this.list();
      const idx  = list.findIndex(function (o) { return o.id === orderId; });
      if (idx < 0) return null;
      const ts = new Date().toISOString();
      list[idx].status = nextStatus;
      list[idx].history = (list[idx].history || []).concat([{ status: nextStatus, ts: ts }]);
      STATE.setStore(KEYS.ORDERS, list);
      return list[idx];
    },
    statuses: ORDER_STATUSES
  };

  /* ---------- Inventory ---------- */

  const inventory = {
    list: function () { return STATE.getStore(KEYS.INVENTORY, []); },
    get:  function (productId) {
      return this.list().find(function (r) { return r.productId === productId; }) || null;
    },
    setStock: function (productId, n) {
      const list = this.list();
      const idx = list.findIndex(function (r) { return r.productId === productId; });
      const safe = Math.max(0, Math.floor(Number(n) || 0));
      if (idx < 0) {
        list.push({ productId: productId, stock: safe, lowStockAt: 5, lastRestock: new Date().toISOString().slice(0, 10) });
      } else {
        list[idx].stock = safe;
      }
      STATE.setStore(KEYS.INVENTORY, list);
      return safe;
    },
    restock: function (productId, qty) {
      const cur = this.get(productId);
      const next = (cur ? cur.stock : 0) + Math.max(0, Math.floor(Number(qty) || 0));
      const list = this.list();
      const idx = list.findIndex(function (r) { return r.productId === productId; });
      const today = new Date().toISOString().slice(0, 10);
      if (idx < 0) {
        list.push({ productId: productId, stock: next, lowStockAt: 5, lastRestock: today });
      } else {
        list[idx].stock = next;
        list[idx].lastRestock = today;
      }
      STATE.setStore(KEYS.INVENTORY, list);
      return next;
    },
    decrement: function (productId, qty) {
      const cur = this.get(productId);
      if (!cur) return 0;
      const next = Math.max(0, cur.stock - Math.max(0, Math.floor(Number(qty) || 0)));
      return this.setStock(productId, next);
    }
  };

  /* ---------- Settings ---------- */

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    const out = Array.isArray(target) ? target.slice() : Object.assign({}, target);
    Object.keys(source).forEach(function (k) {
      const sv = source[k];
      const tv = out[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
        out[k] = deepMerge(tv, sv);
      } else {
        out[k] = sv;
      }
    });
    return out;
  }

  const settings = {
    get:  function () { return STATE.getStore(KEYS.SETTINGS, {}); },
    save: function (patch) {
      const merged = deepMerge(this.get(), patch);
      STATE.setStore(KEYS.SETTINGS, merged);
      return merged;
    }
  };

  /* ---------- Expose ---------- */

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.api = {
    hydrate:     hydrate,
    ready:       ready,
    id:          id,
    orderNumber: orderNumber,
    formatRM:    formatRM,
    products:    products,
    categories:  categories,
    orders:      orders,
    inventory:   inventory,
    settings:    settings
  };

  // Auto-fire hydration as soon as the script loads so pages can simply await ready().
  hydrate();
})();
