/* ============================================================
   MyBurger -- UI Helpers
   Thin layer of DOM utilities that every page reuses. No
   framework, no shadow DOM tricks -- just predictable helpers
   for selecting, building, toasting, opening/closing surfaces,
   and reflecting cart state.

   Public API (window.MyBurger.ui):
     qs(selector, root?)            -> Element | null
     qsa(selector, root?)           -> Element[]
     el(tag, props?, children?)     -> Element
     toast(message, opts?)          -> void
     modal.open(node)               -> void
     modal.close()                  -> void
     drawer.open(node, side?)       -> void   ('right' default)
     drawer.close()                 -> void
     sheet.open(node)               -> void   (mobile bottom-sheet)
     sheet.close()                  -> void
     setActiveNav(currentRoute)     -> void
     refreshCartBadge()             -> void

   Conventions:
     - Surfaces (modal / drawer / sheet) are mutually exclusive.
       Opening one closes the others.
     - Scrim click + ESC key both close the topmost surface.
     - Cart badge listens to myburger:cart and auto-refreshes.
   ============================================================ */

(function () {
  'use strict';

  const STATE = window.MyBurger && window.MyBurger.state;
  const API   = window.MyBurger && window.MyBurger.api;

  /* ---------- Selectors ---------- */

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /* ---------- Element factory ---------- */

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        const val = props[key];
        if (val === null || val === undefined || val === false) return;
        if (key === 'class' || key === 'className') {
          node.className = Array.isArray(val) ? val.filter(Boolean).join(' ') : String(val);
        } else if (key === 'style' && typeof val === 'object') {
          Object.assign(node.style, val);
        } else if (key === 'dataset' && typeof val === 'object') {
          Object.keys(val).forEach(function (k) { node.dataset[k] = val[k]; });
        } else if (key.indexOf('on') === 0 && typeof val === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'html') {
          node.innerHTML = val;
        } else if (key === 'text') {
          node.textContent = val;
        } else {
          node.setAttribute(key, val);
        }
      });
    }
    if (children) {
      const arr = Array.isArray(children) ? children : [children];
      arr.forEach(function (child) {
        if (child === null || child === undefined || child === false) return;
        if (typeof child === 'string' || typeof child === 'number') {
          node.appendChild(document.createTextNode(String(child)));
        } else {
          node.appendChild(child);
        }
      });
    }
    return node;
  }

  /* ---------- Toast ---------- */

  let toastTimer = null;
  function toast(message, opts) {
    const o = Object.assign({ duration: 2400, variant: 'default' }, opts || {});
    let host = qs('.toast-host');
    if (!host) {
      host = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(host);
    }
    const node = el('div', { class: ['toast', 'toast--' + o.variant], text: message });
    host.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('is-shown'); });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove('is-shown');
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 220);
    }, o.duration);
  }

  /* ---------- Surfaces (modal / drawer / sheet) ---------- */

  const surfaceStack = [];

  function getOrCreateScrim() {
    let scrim = qs('.scrim');
    if (!scrim) {
      scrim = el('div', { class: 'scrim', 'aria-hidden': 'true' });
      scrim.addEventListener('click', function () { closeTop(); });
      document.body.appendChild(scrim);
    }
    return scrim;
  }

  function lockScroll() { document.documentElement.classList.add('is-scroll-locked'); }
  function unlockScroll() { document.documentElement.classList.remove('is-scroll-locked'); }

  function openSurface(kind, node, options) {
    const scrim = getOrCreateScrim();
    const wrapper = el('div', { class: 'surface surface--' + kind, role: 'dialog', 'aria-modal': 'true' });
    if (options && options.side) wrapper.classList.add('surface--' + options.side);
    wrapper.appendChild(node);
    document.body.appendChild(wrapper);

    scrim.classList.add('is-shown');
    requestAnimationFrame(function () { wrapper.classList.add('is-shown'); });
    lockScroll();
    surfaceStack.push(wrapper);
  }

  function closeTop() {
    const wrapper = surfaceStack.pop();
    if (!wrapper) return;
    wrapper.classList.remove('is-shown');
    setTimeout(function () {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      if (surfaceStack.length === 0) {
        const scrim = qs('.scrim');
        if (scrim) scrim.classList.remove('is-shown');
        unlockScroll();
      }
    }, 240);
  }

  function closeKind(kind) {
    // Close the most-recently-opened surface of this kind
    for (let i = surfaceStack.length - 1; i >= 0; i--) {
      if (surfaceStack[i].classList.contains('surface--' + kind)) {
        const w = surfaceStack.splice(i, 1)[0];
        w.classList.remove('is-shown');
        setTimeout(function () {
          if (w.parentNode) w.parentNode.removeChild(w);
          if (surfaceStack.length === 0) {
            const scrim = qs('.scrim');
            if (scrim) scrim.classList.remove('is-shown');
            unlockScroll();
          }
        }, 240);
        return;
      }
    }
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && surfaceStack.length > 0) closeTop();
  });

  const modal  = { open: function (node) { openSurface('modal', node); }, close: function () { closeKind('modal'); } };
  const drawer = { open: function (node, side) { openSurface('drawer', node, { side: side || 'right' }); }, close: function () { closeKind('drawer'); } };
  const sheet  = { open: function (node) { openSurface('sheet', node); }, close: function () { closeKind('sheet'); } };

  /* ---------- Active nav state ---------- */

  function setActiveNav(currentRoute) {
    // currentRoute is one of: 'home','menu','cart','account' (customer)
    //                          'dashboard','orders','inventory','products','settings' (admin)
    qsa('[data-nav-item]').forEach(function (item) {
      if (item.dataset.navItem === currentRoute) {
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('is-active');
        item.removeAttribute('aria-current');
      }
    });
  }

  /* ---------- Cart badge ---------- */

  function getCartCount() {
    if (!STATE) return 0;
    const cart = STATE.getStore(STATE.KEYS.CART, []);
    if (!Array.isArray(cart)) return 0;
    return cart.reduce(function (sum, line) { return sum + (Number(line.qty) || 0); }, 0);
  }

  function refreshCartBadge() {
    const count = getCartCount();
    qsa('[data-cart-badge]').forEach(function (badge) {
      if (count > 0) {
        badge.textContent = String(count);
        badge.removeAttribute('hidden');
        badge.classList.add('is-visible');
      } else {
        badge.textContent = '';
        badge.setAttribute('hidden', 'hidden');
        badge.classList.remove('is-visible');
      }
    });

    // Update mobile sticky "View Cart" bar (Menu page) if present
    const stickyBar = qs('[data-cart-sticky]');
    if (stickyBar) {
      if (count > 0) {
        stickyBar.removeAttribute('hidden');
        const subtotal = (STATE.getStore(STATE.KEYS.CART, []) || []).reduce(function (sum, line) {
          return sum + (Number(line.lineTotal) || 0);
        }, 0);
        const labelEl = qs('[data-cart-sticky-label]', stickyBar);
        if (labelEl && API) {
          labelEl.textContent = 'View Cart · ' + count + ' · ' + API.formatRM(subtotal);
        }
      } else {
        stickyBar.setAttribute('hidden', 'hidden');
      }
    }
  }

  if (STATE) {
    STATE.subscribe(STATE.KEYS.CART, refreshCartBadge);
  }

  /* ---------- Expose ---------- */

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.ui = {
    qs:              qs,
    qsa:             qsa,
    el:              el,
    toast:           toast,
    modal:           modal,
    drawer:          drawer,
    sheet:           sheet,
    setActiveNav:    setActiveNav,
    refreshCartBadge: refreshCartBadge
  };

  // Auto-refresh badge on DOM ready so each page boots with correct count.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshCartBadge);
  } else {
    refreshCartBadge();
  }
})();
