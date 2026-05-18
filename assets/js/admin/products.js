/* ============================================================
   MyBurger -- Admin Products
   Grid + list + edit modal (with photo upload, modifier rows).
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

  let filterCategory = '';
  let searchTerm = '';

  function render() {
    API.ready().then(function () {
      bindToolbar();
      // ?new=1 from dashboard quick action
      const url = new URL(window.location.href);
      if (url.searchParams.get('new') === '1') {
        setTimeout(openEditor, 100);
      }
      renderCategoryFilter();
      renderAll();
    });
  }

  function bindToolbar() {
    const cat   = qs('[data-prod-category]');
    const srch  = qs('[data-prod-search]');
    const newBt = qs('[data-prod-new]');

    if (cat)   cat.addEventListener('change', function () { filterCategory = cat.value; renderAll(); });
    if (srch)  srch.addEventListener('input', function () { searchTerm = (srch.value || '').toLowerCase(); renderAll(); });
    if (newBt) newBt.addEventListener('click', function () { openEditor(); });
  }

  function renderCategoryFilter() {
    const sel = qs('[data-prod-category]');
    if (!sel) return;
    const cats = (API.categories.list() || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    cats.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  }

  function renderAll() {
    const grid = qs('[data-prod-grid]');
    const list = qs('[data-prod-list]');
    if (!grid || !list) return;

    const products = (API.products.list() || []).filter(function (p) {
      if (filterCategory && p.category !== filterCategory) return false;
      if (searchTerm && p.name.toLowerCase().indexOf(searchTerm) === -1) return false;
      return true;
    });

    grid.innerHTML = '';
    list.innerHTML = '';

    if (products.length === 0) {
      grid.appendChild(el('p', { class: 'field__hint', text: 'No products match.' }));
      list.appendChild(el('p', { class: 'field__hint', text: 'No products match.' }));
      return;
    }

    products.forEach(function (p) {
      grid.appendChild(buildCard(p));
      list.appendChild(buildRow(p));
    });
  }

  function buildCard(p) {
    return el('article', { class: 'a-prod-card' }, [
      el('div', { class: 'a-prod-card__media' }, [
        el('img', { src: p.img || '/assets/img/burgers/placeholder-burger.svg', alt: p.name })
      ]),
      el('div', { class: 'a-prod-card__body' }, [
        el('span', { class: 'a-prod-card__name',   text: p.name }),
        el('span', { class: 'a-prod-card__price',  text: API.formatRM(p.price) }),
        el('span', { class: 'a-prod-card__status' }, [
          el('span', { class: 'badge badge--dot ' + (p.active === false ? 'badge--muted' : 'badge--success') }),
          el('span', { text: p.active === false ? 'Hidden' : 'Active' })
        ])
      ]),
      el('div', { class: 'a-prod-card__footer' }, [
        el('button', { type: 'button', class: 'btn btn--secondary btn--sm btn--block', onclick: function () { openEditor(p); } }, 'Edit')
      ])
    ]);
  }

  function buildRow(p) {
    return el('div', { class: 'a-prod-row' }, [
      el('div', { class: 'a-prod-row__media' }, [
        el('img', { src: p.img || '/assets/img/burgers/placeholder-burger.svg', alt: p.name })
      ]),
      el('div', {}, [
        el('span', { class: 'a-prod-row__name', text: p.name }),
        el('div',  { class: 'a-prod-row__meta' }, [
          el('span', { class: 'badge badge--dot ' + (p.active === false ? 'badge--muted' : 'badge--success') }),
          el('span', { text: API.formatRM(p.price) + ' · ' + (p.active === false ? 'Hidden' : 'Active') })
        ])
      ]),
      el('button', { type: 'button', class: 'btn btn--secondary btn--sm', onclick: function () { openEditor(p); } }, 'Edit')
    ]);
  }

  /* ---------- Editor (create + edit share the surface) ---------- */

  function openEditor(existing) {
    const product = existing ? clone(existing) : {
      id: API.id('prod'),
      name: '',
      category: '',
      price: 0,
      img: '/assets/img/burgers/placeholder-burger.svg',
      desc: '',
      dietary: [],
      popular: false,
      active: true,
      modifiers: []
    };
    const isNew = !existing;

    // Fields
    const photoImg = el('img', { src: product.img, alt: product.name || 'New product' });
    const photoUpload = el('input', { type: 'file', accept: 'image/*' });
    photoUpload.addEventListener('change', function () {
      const file = photoUpload.files && photoUpload.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        product.img = reader.result;
        photoImg.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    const nameInput = el('input', { class: 'input', type: 'text', value: product.name, oninput: function (ev) { product.name = ev.target.value; } });
    const descInput = el('textarea', { class: 'textarea', text: product.desc, oninput: function (ev) { product.desc = ev.target.value; } });
    const priceInput = el('input', { class: 'input', type: 'number', step: '0.10', min: '0', value: String(product.price), oninput: function (ev) { product.price = Number(ev.target.value) || 0; } });

    const catSel = el('select', { class: 'select', onchange: function (ev) { product.category = ev.target.value; } });
    catSel.appendChild(el('option', { value: '', text: 'Select category' }));
    (API.categories.list() || []).forEach(function (c) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      if (product.category === c.id) o.selected = true;
      catSel.appendChild(o);
    });

    // Status radios
    const statusRow = el('div', { class: 'choice-group' }, ['active', 'hidden'].map(function (s) {
      const inp = el('input', { type: 'radio', name: 'pe-status', value: s, checked: ((s === 'active' && product.active !== false) || (s === 'hidden' && product.active === false)) ? 'checked' : null });
      inp.addEventListener('change', function () { if (inp.checked) product.active = (s === 'active'); });
      return el('label', { class: 'choice' }, [inp, el('span', { class: 'choice__label', text: s === 'active' ? 'Active' : 'Hidden' })]);
    }));

    // Popular checkbox
    const popInp = el('input', { type: 'checkbox', checked: product.popular ? 'checked' : null });
    popInp.addEventListener('change', function () { product.popular = popInp.checked; });

    // Modifier groups summary (read-only -- detailed editor stays out of scope)
    const modSummary = el('div', { class: 'a-prod-edit__modgroup' }, [
      el('span', { class: 'field__label', text: 'Modifier groups' }),
      el('span', { class: 'field__hint', text: (product.modifiers || []).length === 0
        ? 'No modifier groups yet -- add via JSON editor in a future release.'
        : (product.modifiers || []).map(function (g) { return g.label + ' (' + (g.options ? g.options.length : 0) + ' options)'; }).join(' · ')
      })
    ]);

    // Save / Delete / Cancel
    const close = function () { UI.modal.close(); UI.sheet.close(); };
    const save  = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      onclick: function () {
        if (!product.name.trim()) { UI.toast('Name is required', { variant: 'warning' }); return; }
        if (!product.category)    { UI.toast('Select a category', { variant: 'warning' }); return; }
        API.products.save(product);
        UI.toast(isNew ? 'Product created' : 'Product saved', { variant: 'success' });
        close();
      }
    }, isNew ? 'Create' : 'Save');

    const del = !isNew ? el('button', {
      type: 'button',
      class: 'btn btn--danger btn--sm',
      onclick: function () {
        if (!confirm('Delete ' + product.name + '?')) return;
        API.products.remove(product.id);
        UI.toast('Product deleted', { variant: 'warning' });
        close();
      }
    }, 'Delete') : null;

    const node = el('div', { class: 'a-prod-edit' }, [
      el('div', { class: 'a-prod-edit__header' }, [
        el('h3', { class: 'a-prod-edit__title', text: isNew ? 'New Product' : 'Edit Product' }),
        el('button', { type: 'button', class: 'modal__close', 'aria-label': 'Close', onclick: close }, '✕')
      ]),
      el('div', { class: 'a-prod-edit__body' }, [
        el('div', { class: 'a-prod-edit__photo-row' }, [
          el('div', { class: 'a-prod-edit__photo' }, [photoImg]),
          el('div', { class: 'field' }, [
            el('label', { class: 'field__label', text: 'Photo' }),
            photoUpload,
            el('p', { class: 'field__hint', text: 'PNG / JPG / SVG -- stored as data URL for demo.' })
          ])
        ]),
        el('div', { class: 'a-prod-edit__grid' }, [
          el('div', { class: 'field a-prod-edit__grid--span2' }, [
            el('label', { class: 'field__label', text: 'Name' }), nameInput
          ]),
          el('div', { class: 'field' }, [
            el('label', { class: 'field__label', text: 'Category' }), catSel
          ]),
          el('div', { class: 'field' }, [
            el('label', { class: 'field__label', text: 'Price (RM)' }), priceInput
          ]),
          el('div', { class: 'field a-prod-edit__grid--span2' }, [
            el('label', { class: 'field__label', text: 'Description' }), descInput
          ])
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: 'Status' }), statusRow
        ]),
        el('label', { class: 'choice' }, [
          popInp, el('span', { class: 'choice__label', text: 'Show on Popular section' })
        ]),
        modSummary
      ]),
      el('div', { class: 'a-prod-edit__footer' }, [
        del || el('span', {}),
        el('div', { class: 'hstack' }, [
          el('button', { type: 'button', class: 'btn btn--ghost', onclick: close }, 'Cancel'),
          save
        ])
      ])
    ]);

    if (window.innerWidth >= 768) UI.modal.open(node);
    else                          UI.sheet.open(node);
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  STATE.subscribe(STATE.KEYS.PRODUCTS,   renderAll);
  STATE.subscribe(STATE.KEYS.CATEGORIES, function () { renderCategoryFilter(); renderAll(); });

  window.MyBurger = window.MyBurger || {};
  window.MyBurger.admin = window.MyBurger.admin || {};
  window.MyBurger.admin.products = { render: render, openEditor: openEditor };
})();
