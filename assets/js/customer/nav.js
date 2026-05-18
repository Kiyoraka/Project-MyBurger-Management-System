/* ============================================================
   MyBurger -- Customer Navigation Partials
   Single source of truth for the customer top-nav and bottom-nav.
   Each page calls MyBurger.customer.nav.renderTopNav('menu') and
   MyBurger.customer.nav.renderBottomNav('menu') after DOM ready.

   Public API (window.MyBurger.customer.nav):
     renderTopNav(currentRoute?, target?)    -> HTMLElement
     renderBottomNav(currentRoute?, target?) -> HTMLElement | null

   The `target` argument is optional:
     - If a DOM element is passed, the nav is mounted inside it.
     - Otherwise the renderer looks up the default slot:
         top-nav    -> [data-slot="c-topnav"]   (fallback: prepended to body)
         bottom-nav -> [data-slot="c-bottomnav"] (fallback: appended to body)

   Pages declare the active tab via currentRoute:
     'home' | 'menu' | 'cart' | 'account'

   This module also wires the scroll-state hook that toggles
   .is-solid on the top-nav once the page scroll exceeds 16px.
   ============================================================ */

(function () {
  'use strict';

  const UI = window.MyBurger && window.MyBurger.ui;
  if (!UI) {
    console.error('[nav] ui.js must load before nav.js');
    return;
  }

  const el   = UI.el;
  const qs   = UI.qs;

  /* ---------- Top-nav config ---------- */

  const TOP_LINKS = [
    { route: 'home',      label: 'Home',      href: '/index.html' },
    { route: 'menu',      label: 'Menu',      href: '/menu.html' },
    { route: 'about',     label: 'About',     href: '/index.html#about' },
    { route: 'locations', label: 'Locations', href: '/index.html#locations' }
  ];

  /* ---------- Inline SVG icons (no external deps) ---------- */

  function iconSearch() {
    return svgEl(
      '<circle cx="11" cy="11" r="7" />' +
      '<line x1="20" y1="20" x2="16.5" y2="16.5" />'
    );
  }

  function iconCart() {
    return svgEl(
      '<path d="M3 5h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6" />' +
      '<circle cx="9.5" cy="20.5" r="1.4" />' +
      '<circle cx="17.5" cy="20.5" r="1.4" />'
    );
  }

  function iconHamburger() {
    return svgEl(
      '<line x1="4" y1="7" x2="20" y2="7" />' +
      '<line x1="4" y1="12" x2="20" y2="12" />' +
      '<line x1="4" y1="17" x2="20" y2="17" />'
    );
  }

  function iconHome() {
    return svgEl('<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />');
  }

  function iconBurgerGlyph() {
    return svgEl(
      '<path d="M4 9c0-3 4-5 8-5s8 2 8 5z" />' +
      '<line x1="3.5" y1="12" x2="20.5" y2="12" />' +
      '<line x1="3.5" y1="15" x2="20.5" y2="15" />' +
      '<path d="M4 18c0 1.5 1.5 2.5 4 2.5h8c2.5 0 4-1 4-2.5z" />'
    );
  }

  function iconAccount() {
    return svgEl(
      '<circle cx="12" cy="8" r="4" />' +
      '<path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" />'
    );
  }

  function svgEl(inner) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = inner;
    return svg;
  }

  /* ---------- Brand logo ---------- */

  function brandLogo() {
    return el(
      'a',
      { href: '/index.html', class: 'c-topnav__logo', 'aria-label': 'MyBurger home' },
      [el('img', { src: '/assets/img/logo.svg', alt: 'MyBurger', height: '36' })]
    );
  }

  /* ---------- Top-nav render ---------- */

  function renderTopNav(currentRoute, target) {
    const slot = resolveSlot(target, '[data-slot="c-topnav"]');

    const linksNav = el(
      'nav',
      { class: 'c-topnav__links', 'aria-label': 'Primary' },
      TOP_LINKS.map(function (link) {
        return el(
          'a',
          {
            href: link.href,
            class: 'c-topnav__link',
            dataset: { navItem: link.route }
          },
          link.label
        );
      })
    );

    const cartBtn = el(
      'a',
      {
        href: '/cart.html',
        class: 'c-topnav__icon-btn',
        'aria-label': 'View cart'
      },
      [
        iconCart(),
        el('span', {
          class: 'badge c-topnav__cart-badge',
          dataset: { cartBadge: '' },
          hidden: 'hidden'
        })
      ]
    );

    const searchBtn = el(
      'button',
      { type: 'button', class: 'c-topnav__icon-btn', 'aria-label': 'Search menu' },
      iconSearch()
    );

    const hamburgerBtn = el(
      'button',
      {
        type: 'button',
        class: 'c-topnav__icon-btn c-topnav__hamburger',
        'aria-label': 'Open menu',
        'aria-expanded': 'false',
        dataset: { topnavToggle: '' }
      },
      iconHamburger()
    );

    const header = el('header', { class: 'c-topnav', dataset: { topnav: '' } }, [
      el('div', { class: 'c-topnav__inner' }, [
        brandLogo(),
        linksNav,
        el('div', { class: 'c-topnav__actions' }, [searchBtn, cartBtn, hamburgerBtn])
      ])
    ]);

    if (slot) {
      slot.replaceWith(header);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }

    wireScrollState(header);
    wireHamburger(hamburgerBtn);

    if (currentRoute) UI.setActiveNav(currentRoute);
    UI.refreshCartBadge();

    return header;
  }

  /* ---------- Bottom-nav config (mobile only, 4-tab customer variant) ---------- */

  const BOTTOM_TABS = [
    { route: 'home',    label: 'Home',    href: '/index.html', icon: iconHome },
    { route: 'menu',    label: 'Menu',    href: '/menu.html',  icon: iconBurgerGlyph },
    { route: 'cart',    label: 'Cart',    href: '/cart.html',  icon: iconCart,    badge: true },
    { route: 'account', label: 'Account', href: '/index.html#account', icon: iconAccount }
  ];

  /* ---------- Bottom-nav render ---------- */

  function renderBottomNav(currentRoute, target) {
    const slot = resolveSlot(target, '[data-slot="c-bottomnav"]');

    const items = BOTTOM_TABS.map(function (tab) {
      const children = [tab.icon(), el('span', { class: 'c-bottomnav__label', text: tab.label })];
      if (tab.badge) {
        children.push(
          el('span', {
            class: 'badge c-bottomnav__badge',
            dataset: { cartBadge: '' },
            hidden: 'hidden'
          })
        );
      }
      return el(
        'a',
        {
          href: tab.href,
          class: 'c-bottomnav__item',
          dataset: { navItem: tab.route },
          'aria-label': tab.label
        },
        children
      );
    });

    const nav = el(
      'nav',
      { class: 'c-bottomnav', 'aria-label': 'Mobile primary', dataset: { bottomnav: '' } },
      [el('div', { class: 'c-bottomnav__inner' }, items)]
    );

    if (slot) {
      slot.replaceWith(nav);
    } else {
      document.body.appendChild(nav);
    }

    if (currentRoute) UI.setActiveNav(currentRoute);
    UI.refreshCartBadge();

    return nav;
  }

  /* ---------- Slot resolution ---------- */

  function resolveSlot(target, fallbackSelector) {
    if (target instanceof Element) return target;
    return qs(fallbackSelector);
  }

  /* ---------- Scroll-state toggle (transparent <-> solid) ---------- */

  function wireScrollState(headerEl) {
    const threshold = 16;
    let ticking = false;

    function update() {
      const scrolled = window.scrollY > threshold;
      headerEl.classList.toggle('is-solid', scrolled);
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  /* ---------- Hamburger toggle (mobile) ---------- */

  function wireHamburger(btn) {
    btn.addEventListener('click', function () {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');

      // Mobile drawer is opened via ui.drawer + a built sheet of TOP_LINKS.
      if (!expanded) openMobileMenu();
      else UI.drawer.close();
    });
  }

  function openMobileMenu() {
    const links = TOP_LINKS.map(function (link) {
      return el(
        'a',
        {
          href: link.href,
          class: 'c-mobilemenu__link',
          dataset: { navItem: link.route }
        },
        link.label
      );
    });

    const node = el('div', { class: 'c-mobilemenu' }, [
      el('div', { class: 'c-mobilemenu__header' }, [
        el('span', { class: 'c-mobilemenu__title', text: 'Menu' }),
        el(
          'button',
          {
            type: 'button',
            class: 'modal__close',
            'aria-label': 'Close menu',
            onclick: function () { UI.drawer.close(); }
          },
          '✕'
        )
      ]),
      el('nav', { class: 'c-mobilemenu__list', 'aria-label': 'Primary mobile' }, links)
    ]);

    UI.drawer.open(node, 'right');
  }

  /* ---------- Expose ---------- */

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.customer = window.MyBurger.customer || {};
  window.MyBurger.customer.nav = {
    renderTopNav:    renderTopNav,
    renderBottomNav: renderBottomNav,
    TOP_LINKS:       TOP_LINKS,
    BOTTOM_TABS:     BOTTOM_TABS
  };
})();
