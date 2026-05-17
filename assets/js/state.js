/* ============================================================
   MyBurger -- State Module
   Thin localStorage wrapper for the myburger:* namespace.
   Adds JSON safety, change-event emitter (in-tab subscribers
   + native cross-tab 'storage' relay), and a single point to
   wipe demo data.

   Public API (attached to window.MyBurger.state):
     getStore(key, fallback)
     setStore(key, value)
     clearStore(key)
     clearAll()
     subscribe(key, handler)  -> unsubscribe()
     KEYS                     -> namespaced key constants
   ============================================================ */

(function () {
  'use strict';

  const NS = 'myburger:';

  const KEYS = Object.freeze({
    PRODUCTS:      NS + 'products',
    CATEGORIES:    NS + 'categories',
    CART:          NS + 'cart',
    ORDERS:        NS + 'orders',
    INVENTORY:     NS + 'inventory',
    SETTINGS:      NS + 'settings',
    ADMIN_SESSION: NS + 'admin-session',
    SEED_MARK:     NS + 'seeded'
  });

  /* ---------- Internal helpers ---------- */

  function safeParse(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[state] JSON parse failed for value, returning fallback:', err);
      return fallback;
    }
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (err) {
      console.error('[state] JSON stringify failed:', err);
      return null;
    }
  }

  /* ---------- Subscriber registry (in-tab) ---------- */

  const subscribers = new Map(); // key -> Set<handler>

  function emit(key, newValue, oldValue) {
    const set = subscribers.get(key);
    if (!set || set.size === 0) return;
    set.forEach(function (handler) {
      try {
        handler(newValue, oldValue, key);
      } catch (err) {
        console.error('[state] subscriber threw:', err);
      }
    });
  }

  /* ---------- Cross-tab relay via native 'storage' event ---------- */

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', function (ev) {
      if (!ev.key || !ev.key.startsWith(NS)) return;
      const newValue = safeParse(ev.newValue, null);
      const oldValue = safeParse(ev.oldValue, null);
      emit(ev.key, newValue, oldValue);
    });
  }

  /* ---------- Public API ---------- */

  function getStore(key, fallback) {
    if (fallback === undefined) fallback = null;
    if (typeof localStorage === 'undefined') return fallback;
    return safeParse(localStorage.getItem(key), fallback);
  }

  function setStore(key, value) {
    if (typeof localStorage === 'undefined') return false;
    const oldValue = getStore(key, null);
    const serialized = safeStringify(value);
    if (serialized === null) return false;
    try {
      localStorage.setItem(key, serialized);
    } catch (err) {
      console.error('[state] setItem failed (quota?):', err);
      return false;
    }
    emit(key, value, oldValue);
    return true;
  }

  function clearStore(key) {
    if (typeof localStorage === 'undefined') return;
    const oldValue = getStore(key, null);
    localStorage.removeItem(key);
    emit(key, null, oldValue);
  }

  function clearAll() {
    if (typeof localStorage === 'undefined') return;
    const wipedKeys = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) {
        wipedKeys.push(k);
        localStorage.removeItem(k);
      }
    }
    wipedKeys.forEach(function (k) { emit(k, null, undefined); });
  }

  function subscribe(key, handler) {
    if (typeof handler !== 'function') {
      console.warn('[state] subscribe handler must be a function');
      return function noop() {};
    }
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    const set = subscribers.get(key);
    set.add(handler);
    return function unsubscribe() {
      set.delete(handler);
      if (set.size === 0) subscribers.delete(key);
    };
  }

  /* ---------- Expose ---------- */

  if (typeof window !== 'undefined') {
    window.MyBurger = window.MyBurger || {};
    window.MyBurger.state = {
      KEYS:       KEYS,
      getStore:   getStore,
      setStore:   setStore,
      clearStore: clearStore,
      clearAll:   clearAll,
      subscribe:  subscribe
    };
  }
})();
