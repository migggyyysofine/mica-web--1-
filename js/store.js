/* Data layer: two hard-coded admin accounts + one shared workspace in localStorage.
   Passwords are NOT stored in plain text – only salted PBKDF2 hashes. */
const Store = (() => {
  const SESSION = "mica_session", DATA = "mica_workspace";
  const DEFAULTS = { cost: [330, 340, 350, 360, 370, 380, 390, 400], price: [600, 650, 700, 850] };
  const ACCOUNTS = {
    "admin.mica": { salt: "1250f2db644555108074fa5441b8b6ad", hash: "36fe9f79c1078ad7ae30c4b8aff061d8460347bd455c2a88ae633992a9d62c1d" },
    "admin.migz": { salt: "3f97f488d77fe772eaecf67c5ca239be", hash: "311364ee3f7200e9d6bf8c8bb1542b437168d9f356ad25fc59385928d339eadb" },
  };

  const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
  const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  async function hash(password, saltHex) {
    const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256));
  }

  async function login(username, password) {
    const id = username.trim().toLowerCase(), a = ACCOUNTS[id];
    if (!a || (await hash(password, a.salt)) !== a.hash) throw new Error("Invalid username or password.");
    localStorage.setItem(SESSION, id);
  }
  const logout = () => localStorage.removeItem(SESSION);
  const currentId = () => { const id = localStorage.getItem(SESSION); return ACCOUNTS[id] ? id : null; };
  const currentName = currentId;

  const data = () => read(DATA, { batches: [], presets: structuredClone(DEFAULTS), nextId: 1 });
  const save = d => localStorage.setItem(DATA, JSON.stringify(d));

  const calc = b => {
    const investment = b.cost * b.qty, sales = b.price * b.qty, profit = sales - investment;
    const perWeek = b.weeks > 0 ? b.qty / b.weeks : 0;               // predicted pieces sold per week
    const beUnits = b.price > 0 ? investment / b.price : Infinity;      // pieces needed to earn back the investment
    const breakEvenWeek = perWeek > 0 && beUnits <= b.qty ? Math.max(1, Math.ceil(beUnits / perWeek - 1e-9)) : null;
    return { ...b, investment, sales, profit, perWeek, weeklySales: perWeek * b.price, breakEvenWeek };
  };
  const batches = () => data().batches.map(calc);
  function upsertBatch(b) {
    const d = data();
    if (b.id) d.batches = d.batches.map(x => (x.id === b.id ? { ...x, ...b } : x));
    else d.batches.push({ ...b, id: d.nextId++, addedBy: currentId(), createdAt: new Date().toISOString() });
    save(d);
  }
  function deleteBatch(id) { const d = data(); d.batches = d.batches.filter(b => b.id !== id); save(d); }
  function totals() {
    const rows = batches(), sum = k => rows.reduce((s, r) => s + r[k], 0);
    return { count: rows.length, pieces: sum("qty"), investment: sum("investment"), sales: sum("sales"), profit: sum("profit") };
  }
  const presets = () => data().presets;
  function addPreset(kind, value) { const d = data(), l = d.presets[kind]; if (!l.includes(value)) l.push(value); l.sort((a, b) => a - b); save(d); }
  function removePreset(kind, value) { const d = data(); d.presets[kind] = d.presets[kind].filter(v => v !== value); save(d); }

  return { login, logout, currentId, currentName, batches, upsertBatch, deleteBatch, totals, presets, addPreset, removePreset, calc };
})();
