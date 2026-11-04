/* UI: hash-routed single page app. */
const $app = document.getElementById("app");
const $nav = document.getElementById("nav");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = n => (n < 0 ? "−" : "") + "₱" + Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lossCls = n => (n < 0 ? "loss" : "");
const DAY = 864e5;
const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);
const fmtDate = d => d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const timeline = r => {                                   // production start -> ready -> predicted sell-out
  const start = r.createdAt ? new Date(r.createdAt) : new Date();
  const ready = addDays(start, r.days || 0), soldOut = addDays(ready, (r.weeks || 0) * 7);
  return { start, ready, soldOut };
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- small UI helpers ---------- */
function toast(msg) {
  const el = Object.assign(document.createElement("div"), { className: "toast", textContent: msg });
  document.getElementById("toasts").append(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 250); }, 2200);
}
function confirmModal(text) {
  return new Promise(res => {
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><p>${esc(text)}</p>
      <div class="actions"><button class="ghost" data-v="0">Cancel</button><button data-v="1">Delete</button></div></div>`;
    const done = v => { bg.remove(); removeEventListener("keydown", key); res(v); };
    const key = e => e.key === "Escape" && done(false);
    bg.onclick = e => { if (e.target === bg) done(false); else if (e.target.dataset.v) done(e.target.dataset.v === "1"); };
    addEventListener("keydown", key); document.body.append(bg); bg.querySelector("[data-v='1']").focus();
  });
}
function countUp(el, to, fmt) {
  if (reduced) return (el.textContent = fmt(to));
  const t0 = performance.now(), dur = 700;
  (function tick(now) {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(tick);
  })(t0);
}

/* ---------- views ---------- */
function loginView(error = "") {
  $app.innerHTML = `
  <div class="login-wrap"><form class="card auth" id="auth" autocomplete="on">
    <h2>MICA</h2>
    <p style="text-align:center;color:var(--muted);margin-top:-8px">Admin access only</p>
    <label>Username<input name="username" required autocomplete="username" autofocus></label>
    <label>Password<span class="pw"><input type="password" name="password" required autocomplete="current-password"><button type="button" class="link" id="showpw">Show</button></span></label>
    <p id="err" style="min-height:1.4em;margin:10px 0 0">${esc(error)}</p>
    <button class="main">Log in</button>
  </form></div>`;
  const form = document.getElementById("auth");
  document.getElementById("showpw").onclick = e => {
    const i = form.password; i.type = i.type === "password" ? "text" : "password"; e.target.textContent = i.type === "password" ? "Show" : "Hide";
  };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector(".main"); btn.disabled = true; btn.textContent = "Checking…";
    try { await Store.login(form.username.value, form.password.value); location.hash = "#/dashboard"; toast("Welcome, " + Store.currentName()); }
    catch (err) {
      btn.disabled = false; btn.textContent = "Log in";
      document.getElementById("err").textContent = err.message;
      form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); form.password.select();
    }
  });
}

function timelineCard(all) {
  const rows = all.filter(r => r.days > 0 && r.weeks > 0).map(r => ({ r, t: timeline(r) })).sort((a, b) => a.t.soldOut - b.t.soldOut);
  if (!rows.length) return "";
  const total = Math.max(...rows.map(({ r }) => r.days + r.weeks * 7));
  return `<div class="card"><h3>Production &amp; selling timeline</h3>
    <p class="by" style="margin:-8px 0 12px"><span class="key prod"></span> production &nbsp; <span class="key sell"></span> predicted selling</p>
    <div class="bars">${rows.map(({ r, t }) => `<div class="tl" title="${esc(r.name)}">
      <span class="name">${esc(r.name)}</span>
      <span class="track"><span class="seg prod" data-w="${(r.days / total) * 100}"></span><span class="seg sell" data-w="${((r.weeks * 7) / total) * 100}"></span></span>
      <span class="val">${r.days}d + ${r.weeks}wk<br><small class="by">sold out ~${fmtDate(t.soldOut)}</small></span></div>`).join("")}</div></div>`;
}

function dashboardView() {
  const t = Store.totals(), all = Store.batches().sort((a, b) => b.profit - a.profit), top = all.slice(0, 6);
  const max = Math.max(1, ...top.map(r => Math.abs(r.profit)));
  const stats = [["Designs / batches", t.count, n => Math.round(n)], ["Total pieces", t.pieces, n => Math.round(n).toLocaleString()],
    ["Total investment", t.investment, peso], ["Total sales (if all sell)", t.sales, peso], ["Total income / profit", t.profit, peso, "hero"]];
  $app.innerHTML = `<h2>Business summary</h2>
  <div class="grid">${stats.map(([l, , , c]) => `<div class="card stat ${c || ""}"><small>${l}</small><strong>0</strong></div>`).join("")}</div>
  <div class="card" style="margin-top:16px"><h3>Profit by batch</h3>
  ${top.length ? `<div class="bars">${top.map(r => `<div class="bar" title="${esc(r.name)}"><span class="name">${esc(r.name)}</span>
    <span class="track"><span class="fill ${r.profit < 0 ? "neg" : ""}" data-w="${(Math.abs(r.profit) / max) * 100}"></span></span>
    <span class="val ${lossCls(r.profit)}">${peso(r.profit)}</span></div>`).join("")}</div>`
    : '<p class="empty">No batches yet. <a href="#/batches">Add your first one</a>.</p>'}</div>
  ${timelineCard(all)}`;
  $app.querySelectorAll(".stat strong").forEach((el, i) => countUp(el, stats[i][1], stats[i][2]));
  requestAnimationFrame(() => requestAnimationFrame(() => $app.querySelectorAll(".fill,.seg").forEach(f => (f.style.width = f.dataset.w + "%"))));
}

let editingId = null, sortKey = "id", sortDir = -1, query = "", freshId = null;
function batchesView() {
  const p = Store.presets(), all = Store.batches();
  const b = editingId ? all.find(r => r.id === editingId) : null;
  const opts = a => a.map(v => `<option value="${v}">`).join("");
  const cols = [["name", "Batch"], ["cost", "Cost"], ["qty", "Qty"], ["price", "Price"], ["days", "Prod. days"], ["weeks", "Sell weeks"], ["investment", "Investment"], ["sales", "Sales"], ["profit", "Profit"]];
  $app.innerHTML = `
  <h2>${b ? "Edit batch" : "Batch calculator"}</h2>
  <form class="card" id="batchForm">
    <div class="form-row">
      <label class="span-all">Design / batch name<input name="name" required value="${b ? esc(b.name) : ""}" placeholder="e.g. Black Tee Vol.1"></label>
      <label>Merch cost / shirt<input name="cost" type="number" step="0.01" min="0" list="costs" required value="${b ? b.cost : ""}"></label>
      <label>Quantity<input name="qty" type="number" step="1" min="1" required value="${b ? b.qty : ""}"></label>
      <label>Selling price / shirt<input name="price" type="number" step="0.01" min="0" list="prices" required value="${b ? b.price : ""}"></label>
      <label>Production time (days)<input name="days" type="number" step="1" min="1" required value="${b?.days ?? ""}" placeholder="days to make the merch"></label>
      <label>Predicted selling time (weeks)<input name="weeks" type="number" step="1" min="1" required value="${b?.weeks ?? ""}" placeholder="weeks to sell all"></label>
      <span class="btns"><button>${b ? "Save" : "Add"}</button>${b ? ' <button type="button" class="ghost" id="cancel">Cancel</button>' : ""}</span>
    </div>
    <div class="preview" id="preview"></div>
    <datalist id="costs">${opts(p.cost)}</datalist><datalist id="prices">${opts(p.price)}</datalist>
  </form>
  <div class="card">
    <div class="toolbar">
      <input class="grow" id="search" type="search" placeholder="Search batches…" value="${esc(query)}" style="margin:0">
      <span style="display:flex;gap:8px;flex-wrap:wrap"><input type="file" id="file" accept=".xlsx" style="margin:0;width:auto">
        <button class="ghost" id="import">Import .xlsx</button><button id="export">Export .xlsx</button></span>
    </div>
    <div class="table-wrap"><table><thead><tr>
      ${cols.map(([k, l]) => `<th data-k="${k}" ${sortKey === k ? `data-dir="${sortDir > 0 ? "▲" : "▼"}"` : ""}>${l}</th>`).join("")}<th></th></tr></thead>
      <tbody id="rows"></tbody></table></div>
  </div>`;

  const form = document.getElementById("batchForm");
  const preview = () => {
    const f = new FormData(form), v = k => +f.get(k) || 0;
    const r = Store.calc({ cost: v("cost"), qty: v("qty"), price: v("price"), days: v("days"), weeks: v("weeks"), createdAt: b?.createdAt });
    const t = timeline(r), ok = r.days > 0 && r.weeks > 0;
    document.getElementById("preview").innerHTML =
      `<span>Investment <b>${peso(r.investment)}</b></span><span>Sales <b>${peso(r.sales)}</b></span><span>Profit <b class="${lossCls(r.profit)}">${peso(r.profit)}</b></span><span>Margin <b>${r.sales ? ((r.profit / r.sales) * 100).toFixed(1) : "0.0"}%</b></span>` +
      (ok ? `<span class="sep"></span><span>Merch ready <b>${fmtDate(t.ready)}</b></span><span>Predicted sell-out <b>${fmtDate(t.soldOut)}</b></span>
        <span>Pace <b>${r.perWeek.toFixed(1)} pcs/wk</b> (${peso(r.weeklySales)}/wk)</span>
        <span>Break-even <b>${r.breakEvenWeek ? "week " + r.breakEvenWeek + " of selling" : "not reached"}</b></span>` : "");
  };
  form.addEventListener("input", preview); preview();

  const drawRows = () => {
    const q = query.trim().toLowerCase();
    const rows = all.filter(r => !q || r.name.toLowerCase().includes(q))
      .sort((a, b2) => (a[sortKey] > b2[sortKey] ? 1 : a[sortKey] < b2[sortKey] ? -1 : 0) * sortDir);
    document.getElementById("rows").innerHTML = rows.map(r => `<tr class="${r.id === freshId ? "fresh" : ""}">
      <td>${esc(r.name)}<div class="by">${esc(r.addedBy || "—")}${r.days > 0 && r.weeks > 0 ? ` · sold out ~${timeline(r).soldOut.toLocaleDateString("en-PH",{month:"short",day:"numeric"})}` : ""}</div></td><td>${peso(r.cost)}</td><td>${r.qty}</td><td>${peso(r.price)}</td><td>${r.days ?? "—"}</td><td>${r.weeks ?? "—"}</td>
      <td>${peso(r.investment)}</td><td>${peso(r.sales)}</td><td class="${lossCls(r.profit)}">${peso(r.profit)}</td>
      <td class="actions"><button class="link" data-edit="${r.id}">Edit</button><button class="danger" data-del="${r.id}">Delete</button></td></tr>`).join("")
      || `<tr><td colspan="10" class="empty">${all.length ? "No matches." : "No batches yet — add one above."}</td></tr>`;
    freshId = null;
  };
  drawRows();

  document.getElementById("search").oninput = e => { query = e.target.value; drawRows(); };
  $app.querySelectorAll("th[data-k]").forEach(th => th.onclick = () => {
    sortDir = sortKey === th.dataset.k ? -sortDir : 1; sortKey = th.dataset.k; batchesView();
  });
  $app.addEventListener("click", async e => {
    const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (ed) { editingId = +ed.dataset.edit; batchesView(); scrollTo({ top: 0, behavior: "smooth" }); }
    if (del && await confirmModal("Delete this batch? This can't be undone.")) { Store.deleteBatch(+del.dataset.del); toast("Batch deleted"); batchesView(); }
  }, { once: false, signal: viewAbort() });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(form);
    const rec = { id: editingId, name: f.get("name").trim(), cost: +f.get("cost"), qty: parseInt(f.get("qty"), 10), price: +f.get("price"), days: parseInt(f.get("days"), 10), weeks: parseInt(f.get("weeks"), 10) };
    if (!rec.name || !(rec.qty > 0) || rec.cost < 0 || rec.price < 0 || !(rec.days > 0) || !(rec.weeks > 0)) return toast("Check the values");
    Store.upsertBatch(rec);
    freshId = editingId || Math.max(...Store.batches().map(x => x.id));
    toast(editingId ? "Batch updated" : "Batch added"); editingId = null; batchesView();
  });
  document.getElementById("cancel")?.addEventListener("click", () => { editingId = null; batchesView(); });
  document.getElementById("export").onclick = exportXlsx;
  document.getElementById("import").onclick = importXlsx;
}


/* ---------- flowchart: investment -> production -> selling -> profit, per batch ---------- */
let flowId = null;
const isComplete = r => r.name && r.cost >= 0 && r.qty > 0 && r.price >= 0 && r.days > 0 && r.weeks > 0;
function flowchartView() {
  const done = Store.batches().filter(isComplete).reverse();
  if (!done.length) {
    $app.innerHTML = `<h2>Flowchart</h2><div class="card empty flow-empty"><div class="ghost-flow"><span></span><i>→</i><span></span><i>→</i><span></span><i>→</i><span></span></div>
      <p><b>No flowchart yet.</b></p><p>Add your first batch with every detail filled in (name, cost, quantity, price, production days and selling weeks) and its process flow will appear here.</p>
      <a class="btn" href="#/batches" style="text-decoration:none;display:inline-block">Add a batch</a></div>`;
    return;
  }
  if (!done.some(r => r.id === flowId)) flowId = done[0].id;
  const r = done.find(x => x.id === flowId), t = timeline(r), now = new Date();
  const beDate = r.breakEvenWeek ? addDays(t.ready, r.breakEvenWeek * 7) : null;
  const steps = [
    { icon: "1", title: "Invest", date: t.start, lines: [`${r.qty} pcs × ${peso(r.cost)}`, `<b>${peso(r.investment)}</b> total investment`] },
    { icon: "2", title: "Produce", date: t.start, end: t.ready, lines: [`<b>${r.days} day${r.days > 1 ? "s" : ""}</b> to make the merch`, `${r.qty} pieces`] },
    { icon: "3", title: "Merch ready", date: t.ready, lines: [`Ready ${fmtDate(t.ready)}`, "Stock in hand, ready to sell"] },
    { icon: "4", title: "Sell", date: t.ready, end: t.soldOut, lines: [`<b>${r.weeks} week${r.weeks > 1 ? "s" : ""}</b> predicted`, `${r.perWeek.toFixed(1)} pcs/wk × ${peso(r.price)} = <b>${peso(r.weeklySales)}/wk</b>`] },
    { icon: "5", title: "Break-even", date: beDate, lines: r.breakEvenWeek ? [`Week <b>${r.breakEvenWeek}</b> of selling`, `Investment earned back ~${fmtDate(beDate)}`] : ["<b>Not reached</b>", "Price is below cost"] },
    { icon: "6", title: "Sold out", date: t.soldOut, lines: [`~${fmtDate(t.soldOut)}`, `Total sales <b>${peso(r.sales)}</b>`] },
    { icon: "7", title: r.profit >= 0 ? "Profit" : "Loss", date: t.soldOut, final: true, lines: [`<b class="${lossCls(r.profit)}">${peso(r.profit)}</b>`, `Margin ${r.sales ? ((r.profit / r.sales) * 100).toFixed(1) : "0.0"}%`] },
  ];
  const state = s => { const a = s.date, b = s.end || s.date; if (!a) return "todo"; return now >= b ? "done" : now >= a ? "now" : "todo"; };
  const label = { done: "Done", now: "In progress", todo: "Upcoming" };
  const span = Math.max(1, (t.soldOut - t.start) / DAY), pos = Math.min(100, Math.max(0, ((now - t.start) / DAY / span) * 100));
  $app.innerHTML = `<h2>Flowchart</h2>
  <div class="chips pickers" role="tablist">${done.map(x => `<button class="pick ${x.id === flowId ? "on" : ""}" data-id="${x.id}" role="tab">${esc(x.name)}</button>`).join("")}</div>
  <div class="card">
    <h3>${esc(r.name)} <span class="by">· started ${fmtDate(t.start)}</span></h3>
    <div class="flow">${steps.map((s, i) => { const st = state(s); return `
      ${i ? '<span class="arrow" aria-hidden="true"></span>' : ""}
      <div class="step ${st} ${s.final ? "final" : ""}" style="animation-delay:${i * 90}ms">
        <div class="num">${st === "done" ? "✓" : s.icon}</div>
        <h4>${s.title}</h4><span class="tag">${label[st]}</span>
        ${s.lines.map(l => `<p>${l}</p>`).join("")}
        ${s.date ? `<small class="by">${fmtDate(s.date)}${s.end ? " → " + fmtDate(s.end) : ""}</small>` : ""}
      </div>`; }).join("")}</div>
    <div class="progress"><span class="by">Today</span><span class="ptrack"><span class="pfill" data-w="${pos}"></span></span><span class="by">${pos >= 100 ? "Complete" : Math.round(pos) + "% of timeline"}</span></div>
    <div class="actions" style="margin-top:12px"><button class="ghost" id="editFlow">Edit this batch</button></div>
  </div>`;
  $app.querySelectorAll(".pick").forEach(b => b.onclick = () => { flowId = +b.dataset.id; flowchartView(); });
  document.getElementById("editFlow").onclick = () => { editingId = r.id; location.hash = "#/batches"; };
  requestAnimationFrame(() => requestAnimationFrame(() => $app.querySelectorAll(".pfill").forEach(f => (f.style.width = f.dataset.w + "%"))));
}

/* one abortable click listener per view render (prevents stacking handlers) */
let ctl; const viewAbort = () => { ctl?.abort(); ctl = new AbortController(); return ctl.signal; };

function presetsView() {
  const p = Store.presets();
  const block = (kind, label) => `
  <div class="card"><h3>${label}</h3>
    <div class="chips">${p[kind].map(v => `<span class="chip">${peso(v)} <button class="danger" data-rm="${kind}:${v}" aria-label="Remove ${v}">×</button></span>`).join("") || '<span class="empty" style="padding:0">None</span>'}</div>
    <form data-add="${kind}" style="display:flex;gap:8px;margin-top:14px;max-width:320px">
      <input name="value" type="number" step="0.01" min="0" required placeholder="Add value" style="margin:0"><button>Add</button></form></div>`;
  $app.innerHTML = `<h2>Dropdown presets</h2><p style="color:var(--muted)">Quick-pick values offered when adding a batch.</p>${block("cost", "Merch cost per shirt")}${block("price", "Selling price per shirt")}`;
  $app.querySelectorAll("[data-rm]").forEach(el => el.onclick = () => { const [k, v] = el.dataset.rm.split(":"); Store.removePreset(k, +v); presetsView(); });
  $app.querySelectorAll("[data-add]").forEach(f => f.onsubmit = e => {
    e.preventDefault(); const v = +new FormData(f).get("value");
    if (v >= 0) { Store.addPreset(f.dataset.add, v); toast("Preset added"); presetsView(); }
  });
}

/* ---------- Excel import / export (SheetJS) ---------- */
function exportXlsx() {
  if (typeof XLSX === "undefined") return toast("Excel library didn't load (check internet)");
  const aoa = [["CLOTHING LINE | BATCH / DESIGN PROFIT CALCULATOR"], [],
    ["Design / Batch Name", "Merch Cost per Shirt", "Quantity (pcs)", "Selling Price per Shirt", "Total Investment", "Total Sales (if all sold)", "Total Income / Profit", "Production Days", "Selling Weeks (predicted)"]];
  Store.batches().forEach((r, i) => { const n = i + 4;
    aoa.push([r.name, r.cost, r.qty, r.price, { f: `B${n}*C${n}`, t: "n", v: r.investment }, { f: `C${n}*D${n}`, t: "n", v: r.sales }, { f: `F${n}-E${n}`, t: "n", v: r.profit }, r.days ?? "", r.weeks ?? ""]); });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [28, 20, 15, 22, 18, 24, 20, 16, 24].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Batch Calculator");
  XLSX.writeFile(wb, "MICA-batches.xlsx"); toast("Exported");
}
function importXlsx() {
  const file = document.getElementById("file").files[0];
  if (!file) return toast("Choose an .xlsx file first");
  if (typeof XLSX === "undefined") return toast("Excel library didn't load (check internet)");
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const wb = XLSX.read(reader.result, { type: "array" });
      const ws = wb.Sheets["Batch Calculator"] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }).slice(3);
      let added = 0, skipped = 0;
      for (const [name, cost, qty, price, , , , days, weeks] of rows) {
        if (!name) continue;
        const c = +cost, q = Math.trunc(+qty), p = +price;
        if (cost == null || qty == null || price == null || ![c, q, p].every(Number.isFinite) || c < 0 || p < 0 || q <= 0) { skipped++; continue; }
        const d = Math.trunc(+days), w = Math.trunc(+weeks);
        Store.upsertBatch({ name: String(name).trim(), cost: c, qty: q, price: p, days: d > 0 ? d : null, weeks: w > 0 ? w : null }); added++;
      }
      toast(`Imported ${added}, skipped ${skipped}`);
    } catch { toast("Couldn't read that file"); }
    batchesView();
  };
  reader.readAsArrayBuffer(file);
}

/* ---------- router ---------- */
function render() {
  const route = (location.hash || "#/dashboard").slice(2);
  const user = Store.currentId();
  $nav.hidden = !user;
  if (!user) { if (route !== "login") { location.hash = "#/login"; return; } return loginView(); }
  if (route === "login") { location.hash = "#/dashboard"; return; }
  document.getElementById("whoami").textContent = Store.currentName();
  $nav.querySelectorAll("a").forEach(a => a.classList.toggle("active", a.dataset.r === route));
  if (route !== "batches") { editingId = null; query = ""; }
  ({ batches: batchesView, presets: presetsView, flowchart: flowchartView }[route] || dashboardView)();
}
document.getElementById("logout").onclick = () => { Store.logout(); location.hash = "#/login"; };
document.getElementById("theme").onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t; try { localStorage.setItem("mica_theme", t); } catch {}
};
addEventListener("hashchange", render);
render();
