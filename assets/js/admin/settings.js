/* ============================================================
   MyBurger -- Admin Settings
   Four tabs (Site / Payment Gateway / Hours / Notifications)
   all editing the myburger:settings document.
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

  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  let currentTab = 'site';
  let working = null;

  function defaults() {
    return {
      site: {
        name: 'MyBurger',
        logo: '/assets/img/logo.svg',
        hero: {
          headline: 'Fresh. Smashed. Always.',
          subtext:  'Hand-pressed beef, soft brioche, stupid-good sauces.',
          image:    '/assets/img/burgers/hero.svg'
        },
        contact: { phone: '+60 12-345 6789', email: 'hello@myburger.example.com', address: 'Bachok, Kelantan' },
        social:  { instagram: '', facebook: '', tiktok: '' },
        fulfilment: {
          deliveryFee: 5.00,
          minOrderForDelivery: 25.00,
          deliveryRadiusNote: 'Within 5km of branch'
        },
        hours: DAYS.map(function (d) { return { day: d, open: '11:00', close: '22:00', closed: false }; })
      },
      payment: {
        provider: 'billplz',
        apiKey: '',
        collectionId: '',
        mode: 'test',
        xSignature: '',
        callbackUrl: 'https://myburger.example.com/api/billplz/callback',
        redirectUrl: 'https://myburger.example.com/order/confirm',
        methods: { fpx: true, card: true, ewallet: true, cash: true },
        serviceChargePct: 6,
        sstPct: 0
      },
      notifications: {
        newOrderSound: true,
        lowStockAlerts: true,
        emailReceipts: false
      }
    };
  }

  function render() {
    API.ready().then(function () {
      working = mergeDeep(defaults(), STATE.getStore(STATE.KEYS.SETTINGS, {}) || {});
      bindTabs();
      bindFooter();
      renderPanel();
    });
  }

  function bindTabs() {
    qsa('[data-set-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        currentTab = tab.dataset.setTab;
        qsa('[data-set-tab]').forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        renderPanel();
      });
    });
  }

  function bindFooter() {
    const form = qs('#settings-form');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        commit();
      });
    }
    const cancel = qs('[data-set-cancel]');
    if (cancel) {
      cancel.addEventListener('click', function () {
        working = mergeDeep(defaults(), STATE.getStore(STATE.KEYS.SETTINGS, {}) || {});
        renderPanel();
        UI.toast('Changes reverted', { duration: 1500 });
      });
    }
  }

  function commit() {
    API.settings.save(working);
    UI.toast('Settings saved', { variant: 'success' });
  }

  /* ---------- Panel render dispatch ---------- */

  function renderPanel() {
    const panel = qs('[data-set-panel]');
    if (!panel) return;
    panel.innerHTML = '';
    if      (currentTab === 'site')          panel.appendChild(panelSite());
    else if (currentTab === 'payment')       panel.appendChild(panelPayment());
    else if (currentTab === 'hours')         panel.appendChild(panelHours());
    else if (currentTab === 'notifications') panel.appendChild(panelNotifications());
  }

  /* ---------- Site panel ---------- */

  function panelSite() {
    const s = working.site;

    return wrap('Site', [
      el('div', { class: 'a-set__logo-row' }, [
        el('div', { class: 'a-set__logo' }, [el('img', { src: s.logo, alt: 'Logo' })]),
        fileField('Logo upload', function (dataUrl) { s.logo = dataUrl; })
      ]),
      grid([
        textField('Brand name', s.name, function (v) { s.name = v; }, true),
        textField('Phone',      s.contact.phone, function (v) { s.contact.phone = v; })
      ]),
      grid([
        textField('Email',     s.contact.email,   function (v) { s.contact.email = v; }),
        textField('Address',   s.contact.address, function (v) { s.contact.address = v; })
      ], true),
      grid([
        textField('Hero headline', s.hero.headline, function (v) { s.hero.headline = v; }),
        textField('Hero subtext',  s.hero.subtext,  function (v) { s.hero.subtext = v; })
      ], true),
      grid([
        textField('Instagram', s.social.instagram, function (v) { s.social.instagram = v; }),
        textField('Facebook',  s.social.facebook,  function (v) { s.social.facebook = v; }),
        textField('TikTok',    s.social.tiktok,    function (v) { s.social.tiktok = v; })
      ]),
      section('Fulfilment', [
        grid([
          numField('Delivery fee (RM)',        s.fulfilment.deliveryFee,         function (v) { s.fulfilment.deliveryFee = v; }),
          numField('Min order for delivery',   s.fulfilment.minOrderForDelivery, function (v) { s.fulfilment.minOrderForDelivery = v; })
        ]),
        textField('Delivery radius note', s.fulfilment.deliveryRadiusNote, function (v) { s.fulfilment.deliveryRadiusNote = v; })
      ])
    ]);
  }

  /* ---------- Payment panel ---------- */

  function panelPayment() {
    const p = working.payment;

    const secret = function (label, key) {
      const reveal = el('button', { type: 'button', class: 'btn btn--secondary btn--sm' }, 'Reveal');
      const rotate = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: function () {
        p[key] = randomKey();
        renderPanel();
        UI.toast(label + ' rotated', { duration: 1500 });
      } }, 'Rotate');
      const input = el('input', {
        class: 'input', type: 'password', value: p[key] || '',
        oninput: function (ev) { p[key] = ev.target.value; }
      });
      reveal.addEventListener('click', function () {
        input.type = input.type === 'password' ? 'text' : 'password';
        reveal.textContent = input.type === 'password' ? 'Reveal' : 'Hide';
      });
      return el('div', { class: 'field' }, [
        el('label', { class: 'field__label', text: label }),
        el('div', { class: 'a-set__secret-row' }, [input, reveal, rotate])
      ]);
    };

    const modeRow = el('div', { class: 'choice-group' }, ['test', 'live'].map(function (m) {
      const inp = el('input', { type: 'radio', name: 'p-mode', value: m, checked: p.mode === m ? 'checked' : null });
      inp.addEventListener('change', function () { if (inp.checked) p.mode = m; });
      return el('label', { class: 'choice' }, [inp, el('span', { class: 'choice__label', text: m === 'test' ? 'Sandbox' : 'Production' })]);
    }));

    const methodRow = el('div', { class: 'choice-group' }, ['fpx','card','ewallet','cash'].map(function (m) {
      const inp = el('input', { type: 'checkbox', checked: p.methods[m] ? 'checked' : null });
      inp.addEventListener('change', function () { p.methods[m] = inp.checked; });
      return el('label', { class: 'choice' }, [inp, el('span', { class: 'choice__label', text: m === 'fpx' ? 'FPX' : m === 'ewallet' ? 'E-Wallet' : pretty(m) })]);
    }));

    const test = el('button', { type: 'button', class: 'btn btn--secondary btn--sm', onclick: function () {
      UI.toast('Billplz test connection OK (mock)', { variant: 'success' });
    } }, 'Test Connection');

    return wrap('Payment Gateway · Billplz', [
      grid([
        textField('Provider', 'Billplz', null, true, true),
        textField('Collection ID', p.collectionId, function (v) { p.collectionId = v; })
      ]),
      secret('API Key',         'apiKey'),
      secret('X-Signature Key', 'xSignature'),
      grid([
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Mode' }), modeRow]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Accepted Methods' }), methodRow])
      ]),
      grid([
        textField('Callback URL', p.callbackUrl, function (v) { p.callbackUrl = v; }),
        textField('Redirect URL', p.redirectUrl, function (v) { p.redirectUrl = v; })
      ], true),
      grid([
        numField('Service Charge %', p.serviceChargePct, function (v) { p.serviceChargePct = v; }),
        numField('SST %',            p.sstPct,           function (v) { p.sstPct = v; })
      ]),
      el('div', {}, [test])
    ]);
  }

  /* ---------- Hours panel ---------- */

  function panelHours() {
    const s = working.site;
    return wrap('Trading Hours', s.hours.map(function (row, idx) {
      const openInput  = el('input', { class: 'input', type: 'time', value: row.open, oninput: function (ev) { s.hours[idx].open = ev.target.value; } });
      const closeInput = el('input', { class: 'input', type: 'time', value: row.close, oninput: function (ev) { s.hours[idx].close = ev.target.value; } });
      const closedBox  = el('input', { type: 'checkbox', checked: row.closed ? 'checked' : null });
      closedBox.addEventListener('change', function () {
        s.hours[idx].closed = closedBox.checked;
        openInput.disabled = closedBox.checked;
        closeInput.disabled = closedBox.checked;
      });
      openInput.disabled = row.closed;
      closeInput.disabled = row.closed;

      return el('div', { class: 'a-set__hours-row' }, [
        el('span', { text: row.day }),
        el('label', { class: 'choice' }, [closedBox, el('span', { class: 'choice__label', text: 'Closed' })]),
        el('div', { class: 'hstack' }, [openInput, el('span', { text: '→' }), closeInput])
      ]);
    }));
  }

  /* ---------- Notifications panel ---------- */

  function panelNotifications() {
    const n = working.notifications;
    return wrap('Notifications', [
      toggle('New-order sound', n.newOrderSound, function (v) { n.newOrderSound = v; }),
      toggle('Low-stock alerts', n.lowStockAlerts, function (v) { n.lowStockAlerts = v; }),
      toggle('Email receipts to customers', n.emailReceipts, function (v) { n.emailReceipts = v; })
    ]);
  }

  /* ---------- Helpers ---------- */

  function wrap(title, children) {
    return el('div', { class: 'a-set__section' }, [
      el('h2', { class: 'a-set__section-title', text: title })
    ].concat(children));
  }

  function section(title, children) {
    return el('section', { class: 'a-set__section' }, [
      el('h3', { class: 'a-set__section-title', text: title })
    ].concat(children));
  }

  function grid(children, span2) {
    return el('div', { class: 'a-set__grid' + (span2 ? ' a-set__grid--span2' : '') }, children);
  }

  function textField(label, value, onChange, span2, disabled) {
    const input = el('input', { class: 'input', type: 'text', value: value || '', disabled: disabled ? 'disabled' : null });
    if (onChange) input.addEventListener('input', function () { onChange(input.value); });
    return el('div', { class: 'field' + (span2 ? ' a-set__grid--span2' : '') }, [
      el('label', { class: 'field__label', text: label }), input
    ]);
  }

  function numField(label, value, onChange) {
    const input = el('input', { class: 'input', type: 'number', step: '0.01', value: value != null ? String(value) : '0' });
    if (onChange) input.addEventListener('input', function () { onChange(Number(input.value) || 0); });
    return el('div', { class: 'field' }, [
      el('label', { class: 'field__label', text: label }), input
    ]);
  }

  function fileField(label, onLoad) {
    const input = el('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        onLoad(reader.result);
        renderPanel();
      };
      reader.readAsDataURL(file);
    });
    return el('div', { class: 'field' }, [
      el('label', { class: 'field__label', text: label }), input
    ]);
  }

  function toggle(label, value, onChange) {
    const cb = el('input', { type: 'checkbox', checked: value ? 'checked' : null });
    cb.addEventListener('change', function () { onChange(cb.checked); });
    return el('label', { class: 'choice' }, [cb, el('span', { class: 'choice__label', text: label })]);
  }

  function pretty(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function randomKey() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function mergeDeep(a, b) {
    if (typeof a !== 'object' || a === null) return b == null ? a : b;
    if (typeof b !== 'object' || b === null) return a;
    if (Array.isArray(a) || Array.isArray(b)) return b == null ? a : b;
    const out = Object.assign({}, a);
    Object.keys(b).forEach(function (k) {
      out[k] = mergeDeep(a[k], b[k]);
    });
    return out;
  }

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.admin = window.MyBurger.admin || {};
  window.MyBurger.admin.settings = { render: render };
})();
