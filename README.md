# POLAR SIAM

A dark-luxe, 3D-immersive single-page site for the Polar Siam fashion house.
Built as plain static files — no build step, no framework.

**Stack:** Three.js (flowing-silk 3D background + polar dust) · Lenis (smooth momentum scroll) · anime.js v4 (kinetic reveals) · vanilla JS (custom cursor, magnetic buttons, horizontal collection, parallax).

```
Polar Siam/
├── index.html        ← page markup + section content
├── css/style.css     ← design system (colors, type, layout, animations)
├── js/
│   ├── main.js       ← scroll, reveals, cursor, form, orchestration
│   └── scene.js      ← Three.js silk + dust 3D scene
└── assets/           ← drop real product/lookbook images here
```

---

## 1. Preview locally

The site uses ES modules + an import map, so it must be served over HTTP (opening
`index.html` directly with `file://` will not load the libraries).

From this folder run **either**:

```bash
# Python (already installed on most machines)
python -m http.server 8000
```
```bash
# or Node
npx serve
```

Then open **http://localhost:8000**.

> Requires an internet connection — Three.js, Lenis and anime.js load from a CDN
> (see the `<script type="importmap">` block in `index.html`). To go fully
> self-hosted, see *§4 Going offline / self-hosted libraries*.

---

## 2. Deploy to Namecheap (your domain)

Polar Siam is 100% static, so it drops straight into Namecheap shared hosting.

### A. Upload via cPanel File Manager (easiest)
1. Log in to Namecheap → **Hosting List → Manage → cPanel**.
2. Open **File Manager → `public_html`**.
3. Upload **the contents** of this folder (not the folder itself) so that
   `index.html` sits directly inside `public_html`, with `css/`, `js/`, `assets/`
   beside it.
4. Visit your domain — done. (Namecheap serves `index.html` automatically.)

### B. Or upload via FTP (FileZilla)
- **Host:** `ftp.yourdomain.com`  **User/Pass:** from cPanel → *FTP Accounts*
- Drag the folder contents into `/public_html/`.

### C. Force HTTPS
In cPanel, run **SSL/TLS Status → AutoSSL** (free), then add a redirect.
Create a file named `.htaccess` inside `public_html` with:
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

> **No Namecheap hosting, only the domain?** Host the static files free on
> Cloudflare Pages / Netlify / Vercel and point your Namecheap domain's
> nameservers (or an `A`/`CNAME` record) at them. Ask me and I'll walk you through it.

---

## 3. Make it yours — common edits

| Want to change… | Where |
|---|---|
| Brand copy, section text, product names/prices | `index.html` |
| Colors, fonts, spacing | `:root` variables at the top of `css/style.css` |
| The 3D look (silk colors, dust amount) | `silkUniforms` & `COUNT` in `js/scene.js` |
| Hero / reveal animation timing | `playHero()` and `initReveals()` in `js/main.js` |

### Add real product & lookbook photos
Put images in `assets/`, then replace the placeholder gradient blocks:
- **Collection card** — in `index.html` give the `.card__media` a background image, e.g.
  ```html
  <div class="card__media" style="background-image:url(assets/glacier-trench.jpg);background-size:cover"></div>
  ```
- **Lookbook** — same idea on each `.look` figure. Keep them dark/moody to match.

### Connect the email signup
`js/main.js → initForm()` currently just shows a confirmation. Wire the form to
your provider (Mailchimp, Klaviyo, or Formspree — the no-backend option):
```html
<!-- Formspree example: change the <form> tag in index.html -->
<form class="join__form" action="https://formspree.io/f/yourid" method="POST">
```

---

## 4. Going offline / self-hosted libraries (optional)
For zero external dependencies, download the three libraries and swap the import map
in `index.html` to local paths:
```
js/vendor/three.module.js
js/vendor/lenis.mjs
js/vendor/animejs.mjs
```
```html
<script type="importmap">
{ "imports": {
  "three": "./js/vendor/three.module.js",
  "lenis": "./js/vendor/lenis.mjs",
  "animejs": "./js/vendor/animejs.mjs"
}}
</script>
```
Self-host the two Google Fonts the same way for full independence. Ask me and I can do this conversion for you.

---

## Notes
- Fully responsive; nav collapses and the lookbook stacks on mobile.
- Respects `prefers-reduced-motion` (disables animation for accessibility).
- Custom cursor and magnetic buttons auto-disable on touch devices.
