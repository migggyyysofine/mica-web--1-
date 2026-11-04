# MICA – Clothing Line Batch & Profit Tracker

Plain **HTML + CSS + JavaScript** (no build step, no backend), built from `MICA.xlsx`.

- **Login only** – no sign-up. Two hard-coded admin accounts (`admin.mica`, `admin.migz`). Passwords are stored as salted PBKDF2 hashes in `js/store.js`, not plain text.
- **Batches** – cost × qty = investment, qty × price = sales, sales − investment = profit. Live preview, search, sortable columns, edit/delete, Excel import/export.
- **Timeline** – each batch has *production days* and *predicted selling weeks*. The app predicts the ready date, sell-out date, pieces/week, weekly sales and the break-even week, and charts it on the dashboard.
- **Flowchart** – appears once a batch has every detail filled in. Shows Invest → Produce → Merch ready → Sell → Break-even → Sold out → Profit with real amounts and dates, marking each step Done / In progress / Upcoming against today's date.
- **Dashboard** – animated totals + profit-by-batch bars.
- **Presets** – editable cost/price quick-picks (from the Dropdowns sheet).
- Black / white / gray theme with a light/dark toggle.

> Data (shared by both admins) lives in the browser's `localStorage` – per browser/device. This is a static site: the login is a front-end gate, not server security. Anyone can read the page source. For real protection you'd need a backend.

## Run in VS Code
Install the **Live Server** extension → right-click `index.html` → *Open with Live Server* (or double-click `index.html`).

## Publish on GitHub Pages
```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
Repo **Settings → Pages → Deploy from branch → main / (root)**.
