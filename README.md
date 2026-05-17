# MyBurger Management System

A modern burger / fast-food ordering platform with a customer storefront and an admin operations dashboard.

Software Version: 0.1.0 (scaffold)

## Description

MyBurger is a vanilla HTML / CSS / JavaScript application -- no framework, no build step, no Node toolchain required. It ships two surfaces sharing one design language:

- **Customer storefront** -- public-facing landing, menu browsing, customization, cart, and checkout with Billplz (FPX) payment.
- **Admin dashboard** -- login-gated operations console with main dashboard overview, live order kanban, inventory tracking, product catalog editor, and site + payment-gateway settings.

State is persisted in `localStorage` under the `myburger:*` namespace. Seed data hydrates from `assets/data/seed.json` on first visit.

## Tech Stack

- HTML5 (per-page, no router)
- CSS3 (CSS variables for design tokens, no preprocessor)
- Vanilla JavaScript (ES modules optional, plain scripts default)
- localStorage as the backing store (no backend, no database)
- Billplz payment gateway integration shim (adapter pattern, sandbox by default)

## Run Locally

No install step. Open via any static file server from the project root.

**Option A -- VS Code Live Server extension**
1. Install the "Live Server" extension
2. Right-click `index.html` -> "Open with Live Server"

**Option B -- Python (any version with `http.server`)**
```
python -m http.server 5500
```

**Option C -- Node (if available)**
```
npx serve -l 5500 .
```

Then visit:

- Customer storefront: `http://localhost:5500/`
- Admin login:        `http://localhost:5500/admin/index.html`

### Demo Admin Credentials

```
Email:    admin@gmail.com
Password: admin123
```

The login modal exposes these as a clickable hint that auto-fills the form for demos.

## File Map

```
.
├── index.html                  Customer Home (landing)
├── menu.html                   Customer Menu
├── cart.html                   Customer Cart
├── checkout.html               Customer Checkout
├── admin/
│   ├── index.html              Admin login modal (landing)
│   ├── dashboard.html          Admin main overview
│   ├── orders.html             Order kanban + queue
│   ├── inventory.html          Stock tracking + restock
│   ├── products.html           Catalog editor
│   └── settings.html           Site / Payment / Hours / Notifications tabs
├── assets/
│   ├── css/
│   │   ├── tokens.css          Design tokens (colors, type, spacing)
│   │   ├── reset.css           Modern CSS reset
│   │   ├── components.css      Buttons, cards, modal, drawer, sheet, pills
│   │   ├── layout-customer.css Top-nav + bottom-nav + hero + grid
│   │   ├── layout-admin.css    Sidebar + topbar + dashboard grid
│   │   └── pages/              Per-page overrides
│   ├── js/
│   │   ├── state.js            localStorage wrapper
│   │   ├── api.js              Seed hydration + CRUD helpers
│   │   ├── ui.js               Shared DOM helpers
│   │   ├── customer/           home / menu / cart / checkout
│   │   └── admin/              auth / dashboard / orders / inventory / products / settings
│   ├── img/
│   │   ├── burgers/            Product photos (4:5 mobile, 4:3 desktop)
│   │   ├── icons/              SVG icons
│   │   └── logo.svg
│   └── data/
│       └── seed.json           Initial products / categories / settings
└── README.md
```

## Design Language

Modern burger / fast-food (Shake Shack / Smashburger / Five Guys lineage).

- Palette: ketchup-red `#E63946`, mustard `#F4A261`, charcoal `#1B1B1E`, cream `#FAF6F0`, pickle-green `#5C8C3A`
- Display type: `Fraunces` (chunky serif)
- Body type: `Inter` (tabular figures for prices)
- Desktop: left sidebar (admin) / top nav (customer)
- Mobile: bottom navigation, sticky cart bar, drawer + bottom-sheet patterns

## Features (Scope)

**Customer**
- Hero landing with bento-grid category browser
- Menu with category filter (sticky sidebar desktop, pill-chip carousel mobile)
- Product customization modal (size / patty / cheese / toppings / sauces / notes / qty)
- Cart with pickup / delivery toggle, line-item edit, promo, summary
- Checkout with contact, fulfilment (pickup or delivery + ASAP or scheduled), Billplz payment

**Admin**
- Login modal with hardcoded demo credentials
- Dashboard overview (KPIs, live queue snapshot, low-stock alerts, top items, quick actions, 7-day revenue trend)
- Order kanban (NEW / PREPARING / READY / DONE) with elapsed-time color cues
- Inventory tracking with low-stock / out-of-stock indicators, restock and 86-out actions
- Product catalog editor with photo upload, modifier groups, dietary tags
- Settings: brand identity, hero content, fulfilment fee, payment gateway (Billplz sandbox + production), hours, notifications

## Build & Deployment Notes

- No build step. The repo root is also the deploy root.
- Static hosts: GitHub Pages, Netlify, Cloudflare Pages, Vercel (static), DigitalOcean App Platform (static site)
- For real payment processing the Billplz Bill API calls in `assets/js/customer/checkout.js` must be moved server-side (see the adapter shim's `createBill` for the swap point)

## License

Proprietary. For TNEX Malaysia Sdn Bhd internal use.
