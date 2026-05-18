/* ============================================================
   MyBurger -- Admin Navigation
   Renders the admin sidebar (desktop) and bottom-nav (mobile).
   Each admin page calls renderSidebar('orders') + renderBottomNav('orders')
   + renderTopbar({ title, meta }) after DOM ready.

   Public API (window.MyBurger.admin.nav):
     renderTopbar({ title, meta })   -> HTMLElement
     renderSidebar(currentRoute)     -> HTMLElement
     renderBottomNav(currentRoute)   -> HTMLElement
   ============================================================ */

(function () {
  'use strict';

  const MB    = window.MyBurger || {};
  const UI    = MB.ui;
  const STATE = MB.state;
  const AUTH  = MB.admin && MB.admin.auth;

  if (!UI) {
    console.error('[admin/nav] ui.js must load before nav.js');
    return;
  }

  const el  = UI.el;
  const qs  = UI.qs;

  /* ---------- Tabs config ---------- */

  const TABS = [
    { route: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html', icon: iconDash },
    { route: 'orders',    label: 'Orders',    href: '/admin/orders.html',    icon: iconBox  },
    { route: 'inventory', label: 'Inventory', href: '/admin/inventory.html', icon: iconChart },
    { route: 'products',  label: 'Products',  href: '/admin/products.html',  icon: iconBurger },
    { route: 'settings',  label: 'Settings',  href: '/admin/settings.html',  icon: iconGear }
  ];

  /* ---------- SVG icons ---------- */

  function svgEl(inner, opts) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', (opts && opts.strokeWidth) || '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = inner;
    return svg;
  }

  function iconDash()   { return svgEl('<rect x="3" y="3" width="8" height="9" /><rect x="13" y="3" width="8" height="5" /><rect x="13" y="10" width="8" height="11" /><rect x="3" y="14" width="8" height="7" />'); }
  function iconBox()    { return svgEl('<path d="M3 7l9-4 9 4-9 4-9-4z M3 7v10l9 4 M21 7v10l-9 4 M12 11v10" />'); }
  function iconChart()  { return svgEl('<line x1="4" y1="20" x2="20" y2="20" /><rect x="5" y="11" width="3" height="8" /><rect x="10" y="7" width="3" height="12" /><rect x="15" y="13" width="3" height="6" />'); }
  function iconBurger() { return svgEl('<path d="M4 9c0-3 4-5 8-5s8 2 8 5z" /><line x1="3.5" y1="12" x2="20.5" y2="12" /><line x1="3.5" y1="15" x2="20.5" y2="15" /><path d="M4 18c0 1.5 1.5 2.5 4 2.5h8c2.5 0 4-1 4-2.5z" />'); }
  function iconGear()   { return svgEl('<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />'); }
  function iconStore()  { return svgEl('<path d="M3 9l1.5-5h15L21 9 M5 9v11h14V9 M9 13h6"/>'); }
  function iconLogout() { return svgEl('<path d="M10 4H4v16h6 M16 16l5-4-5-4 M21 12H9"/>'); }
  function iconMenu()   { return svgEl('<line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />'); }
  function iconBell()   { return svgEl('<path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3z M10 19a2 2 0 0 0 4 0"/>'); }

  /* ---------- Topbar ---------- */

  function renderTopbar(opts) {
    const slot = qs('[data-slot="a-topbar"]');
    const meta = opts && opts.meta ? opts.meta : todayLabel();

    const node = el('header', { class: 'a-topbar', dataset: { topbar: '' } }, [
      el(
        'button',
        {
          type: 'button',
          class: 'a-topbar__icon-btn a-topbar__menu-btn',
          'aria-label': 'Open menu',
          onclick: openMobileSidebar
        },
        iconMenu()
      ),
      el('h1', { class: 'a-topbar__title', text: (opts && opts.title) || 'Admin' }),
      el('span', { class: 'a-topbar__meta', text: meta }),
      el('div', { class: 'a-topbar__actions' }, [
        el('button', { type: 'button', class: 'a-topbar__icon-btn', 'aria-label': 'Notifications' }, iconBell()),
        el(
          'button',
          {
            type: 'button',
            class: 'a-topbar__icon-btn',
            'aria-label': 'Sign out',
            onclick: function () {
              if (AUTH) AUTH.logout();
              window.location.replace('/admin/index.html');
            }
          },
          iconLogout()
        )
      ])
    ]);

    if (slot) slot.replaceWith(node);
    else qs('.a-main').insertBefore(node, qs('.a-main').firstChild);
    return node;
  }

  /* ---------- Sidebar ---------- */

  function renderSidebar(currentRoute) {
    const slot = qs('[data-slot="a-sidebar"]');

    const links = TABS.map(function (tab) {
      return el('li', {}, [
        el(
          'a',
          {
            href: tab.href,
            class: 'a-sidebar__link',
            dataset: { navItem: tab.route }
          },
          [tab.icon(), el('span', { text: tab.label })]
        )
      ]);
    });

    const node = el('aside', { class: 'a-sidebar', dataset: { sidebar: '' } }, [
      el('div', { class: 'a-sidebar__brand' }, [
        el('img', { class: 'a-sidebar__brand-mark', src: '/assets/img/logo.svg', alt: 'MyBurger' }),
        el('div', {}, [
          el('div', { class: 'a-sidebar__brand-name', text: 'MyBurger' }),
          el('div', { class: 'a-sidebar__brand-sub',  text: 'Admin' })
        ])
      ]),
      el('ul', { class: 'a-sidebar__list', role: 'list' }, links),
      el('hr', { class: 'a-sidebar__divider' }),
      el('div', { class: 'a-sidebar__footer' }, [
        el(
          'a',
          { href: '/index.html', class: 'a-sidebar__link', target: '_blank', rel: 'noopener' },
          [iconStore(), el('span', { text: 'Storefront' })]
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'a-sidebar__link',
            onclick: function () {
              if (AUTH) AUTH.logout();
              window.location.replace('/admin/index.html');
            }
          },
          [iconLogout(), el('span', { text: 'Log out' })]
        )
      ])
    ]);

    if (slot) slot.replaceWith(node);
    else document.body.insertBefore(node, document.body.firstChild);

    if (currentRoute) UI.setActiveNav(currentRoute);
    return node;
  }

  /* ---------- Mobile sidebar drawer ---------- */

  function openMobileSidebar() {
    const links = TABS.concat([
      { route: 'storefront', label: 'Storefront', href: '/index.html', icon: iconStore },
      { route: 'logout',     label: 'Log out',    href: '#',           icon: iconLogout, action: function () {
          if (AUTH) AUTH.logout();
          window.location.replace('/admin/index.html');
        } }
    ]).map(function (tab) {
      const opts = {
        href: tab.href,
        class: 'a-sidebar__link',
        dataset: { navItem: tab.route }
      };
      if (tab.action) {
        opts.onclick = function (ev) { ev.preventDefault(); tab.action(); };
      }
      return el('a', opts, [tab.icon(), el('span', { text: tab.label })]);
    });

    const panel = el('div', { class: 'a-sidebar a-sidebar--mobile' }, [
      el('div', { class: 'a-sidebar__brand' }, [
        el('img', { class: 'a-sidebar__brand-mark', src: '/assets/img/logo.svg', alt: 'MyBurger' }),
        el('div', { class: 'a-sidebar__brand-name', text: 'Admin' })
      ]),
      el('div', { class: 'a-sidebar__list' }, links)
    ]);

    UI.drawer.open(panel, 'left');
  }

  /* ---------- Bottom-nav (mobile) ---------- */

  function renderBottomNav(currentRoute) {
    const slot = qs('[data-slot="a-bottomnav"]');

    const items = TABS.map(function (tab) {
      return el(
        'a',
        {
          href: tab.href,
          class: 'a-bottomnav__item',
          dataset: { navItem: tab.route },
          'aria-label': tab.label
        },
        [tab.icon(), el('span', { text: tab.label })]
      );
    });

    const node = el(
      'nav',
      { class: 'a-bottomnav', 'aria-label': 'Admin primary' },
      [el('div', { class: 'a-bottomnav__inner' }, items)]
    );

    if (slot) slot.replaceWith(node);
    else document.body.appendChild(node);

    if (currentRoute) UI.setActiveNav(currentRoute);
    return node;
  }

  /* ---------- Helpers ---------- */

  function todayLabel() {
    const d = new Date();
    const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = ((hh + 11) % 12) + 1;
    return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] + ' · ' + h12 + ':' + mm + ' ' + ampm;
  }

  /* ---------- Expose ---------- */

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.admin = window.MyBurger.admin || {};
  window.MyBurger.admin.nav = {
    renderTopbar:    renderTopbar,
    renderSidebar:   renderSidebar,
    renderBottomNav: renderBottomNav,
    TABS:            TABS
  };
})();
