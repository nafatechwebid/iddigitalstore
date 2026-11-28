"use strict";
(() => {
  const C = window.SKILLSTORE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const rp = (n) => "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
  const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(".", ",") + " jt" : n >= 1e3 ? Math.round(n / 1e3) + " rb" : String(n));
  const TZ = "Asia/Jakarta";
  const fdt = (v) => v ? new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v)).replace(/\./g, ":").replace(",", "") + " WIB" : "-";
  const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const fd = (s) => { const [y, m, d] = s.split("-"); return `${+d} ${MON[+m - 1]}`; };
  const fm = (s) => { const [y, m] = s.split("-"); return `${MON[+m - 1]} ${y.slice(2)}`; };
  const waLink = (n) => { let d = String(n || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "62" + d.slice(1); return d ? `https://wa.me/${d}` : null; };

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) n.append(kid instanceof Node ? kid : document.createTextNode(kid ?? ""));
    return n;
  }
  function toast(m, ms = 4000) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); }

  /* ---------- sesi ---------- */
  const KEY = "ss_admin";
  const sget = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const sset = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* abaikan */ } };
  async function auth(path, body) {
    const r = await fetch(`${C.SUPABASE_URL}/auth/v1/${path}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: C.SUPABASE_ANON_KEY }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.msg || d.error_description || d.message || "Permintaan gagal.");
    return d;
  }
  const keep = (d, email) => sset({ access: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 30) * 1000, email });
  async function token() {
    let s = sget(); if (!s) return null;
    if (Date.now() > s.exp) {
      try { keep(await auth("token?grant_type=refresh_token", { refresh_token: s.refresh }), s.email); s = sget(); } catch { sset(null); return null; }
    }
    return s.access;
  }
  async function call(action, extra = {}) {
    const t = await token(); if (!t) { renderLogin(); throw new Error("Sesi berakhir."); }
    const r = await fetch(`${C.SUPABASE_URL}/functions/v1/admin`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, apikey: C.SUPABASE_ANON_KEY }, body: JSON.stringify({ action, ...extra }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { sset(null); renderLogin(); throw new Error("Sesi berakhir."); }
    if (!r.ok) throw new Error(d.error || "Permintaan gagal.");
    return d;
  }

  /* ---------- masuk ---------- */
  function renderLogin(note) {
    $("#logout").hidden = true;
    const email = el("input", { type: "email", required: true, placeholder: "Email admin", autocomplete: "email", inputmode: "email" });
    const msg = el("p", { class: "muted", role: "status" }, note || "");
    const form = el("form", { class: "login", onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = "Mengirim kode…";
      try {
        await auth("otp", { email: email.value.trim().toLowerCase(), create_user: true });
        msg.textContent = "Kode dikirim ke email Anda.";
        const code = el("input", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: "8", placeholder: "Kode dari email", required: true });
        const f2 = el("form", { class: "login", onsubmit: async (ev) => {
          ev.preventDefault(); msg.textContent = "Memeriksa…";
          try { keep(await auth("verify", { type: "email", email: email.value.trim().toLowerCase(), token: code.value.trim() }), email.value.trim().toLowerCase()); start(); }
          catch (x) { msg.textContent = x.message; }
        } }, el("h1", {}, "Masukkan kode"), code, el("button", { class: "btn pri", type: "submit" }, "Masuk"), msg);
        form.replaceWith(f2); code.focus();
      } catch (x) { msg.textContent = x.message; }
    } }, el("h1", {}, "Dasbor admin"), el("p", { class: "muted" }, "Masuk dengan email admin. Kode dikirim ke email."), email, el("button", { class: "btn pri", type: "submit" }, "Kirim kode"), msg);
    app.replaceChildren(form);
  }

  /* ---------- kerangka ---------- */
  const TABS = [["ringkasan", "Ringkasan"], ["pesanan", "Pesanan"], ["pembeli", "Pembeli"], ["tiket", "Tiket"]];
  let tab = "ringkasan", ov = null;
  async function start() {
    $("#logout").hidden = false;
    try { ov = await call("overview"); } catch (x) {
      if (/bukan admin/i.test(x.message)) { sset(null); return renderLogin("Akun ini bukan admin."); }
      app.replaceChildren(el("p", { class: "err pad" }, x.message)); return;
    }
    shell();
  }
  function shell() {
    const tabs = el("div", { class: "tabs", role: "tablist" }, TABS.map(([id, label]) => {
      const n = id === "pesanan" ? ov.pending_orders : id === "tiket" ? ov.open_tickets : 0;
      return el("button", { class: "tab", role: "tab", "aria-selected": String(id === tab), onclick: () => { tab = id; shell(); } }, label, n ? el("span", { class: "badge" }, String(n)) : "");
    }));
    const body = el("section", { id: "body" });
    app.replaceChildren(tabs, body);
    ({ ringkasan: vSummary, pesanan: vOrders, pembeli: vCustomers, tiket: vTickets })[tab](body);
  }
  async function refreshOv() { try { ov = await call("overview"); } catch { /* abaikan */ } }

  /* ---------- ringkasan ---------- */
  let unit = "day", topUnit = "week";
  function vSummary(body) {
    const last = (a) => (a.length ? a[a.length - 1] : { total: 0, orders: 0 });
    const cards = el("div", { class: "cards" },
      card("Hari ini", rp(last(ov.day).total), `${last(ov.day).orders} pesanan`),
      card("Minggu ini", rp(last(ov.week).total), `${last(ov.week).orders} pesanan`),
      card("Bulan ini", rp(last(ov.month).total), `${last(ov.month).orders} pesanan`),
      card("Menunggu bayar", String(ov.pending_orders), "pesanan QRIS"),
      card("Tiket terbuka", String(ov.open_tickets), "belum selesai"),
      card("Pembeli", String(ov.customers), "terdaftar"));
    const chartBox = el("div", { class: "chart" });
    const seg = el("div", { class: "seg", role: "group", "aria-label": "Rentang grafik" }, [["day", "Harian"], ["week", "Mingguan"], ["month", "Bulanan"]].map(([u, l]) =>
      el("button", { type: "button", "aria-pressed": String(u === unit), onclick: () => { unit = u; vSummary(body); } }, l)));
    const topBox = el("div");
    const seg2 = el("div", { class: "seg", role: "group", "aria-label": "Rentang terlaris" }, [["week", "7 hari"], ["month", "30 hari"]].map(([u, l]) =>
      el("button", { type: "button", "aria-pressed": String(u === topUnit), onclick: () => { topUnit = u; vSummary(body); } }, l)));
    body.replaceChildren(cards,
      el("div", { class: "row" }, el("h2", {}, "Pendapatan"), seg), chartBox,
      el("div", { class: "row" }, el("h2", {}, "Produk terlaris"), seg2), topBox);
    drawChart(chartBox, ov[unit], unit);
    drawTop(topBox, topUnit === "week" ? ov.top_week : ov.top_month);
  }
  const card = (a, b, c) => el("div", { class: "card" }, el("small", {}, a), el("strong", {}, b), el("em", {}, c));

  function drawChart(box, rows, u) {
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    const label = (r) => u === "month" ? fm(r.bucket) : (u === "week" ? "Mgg " : "") + fd(r.bucket);
    const read = el("p", { class: "readout" }, `Total ${u === "day" ? "30 hari" : u === "week" ? "12 minggu" : "12 bulan"}: ${rp(total)}`);
    const W = 600, H = 200, pl = 34, pb = 22, n = rows.length, max = Math.max(1, ...rows.map((r) => Number(r.total)));
    const step = (W - pl) / n, bw = Math.max(3, step * 0.66);
    const NS = "http://www.w3.org/2000/svg", S = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
    const svg = S("svg", { viewBox: `0 0 ${W} ${H + pb}`, role: "img", "aria-label": "Grafik pendapatan" });
    for (const f of [0, .5, 1]) {
      const y = H - f * (H - 14);
      svg.append(S("line", { x1: pl, x2: W, y1: y, y2: y }));
      const t = S("text", { x: pl - 4, y: y + 3, "text-anchor": "end" }); t.textContent = short(Math.round(max * f)); svg.append(t);
    }
    const every = u === "day" ? 5 : u === "week" ? 2 : 2;
    rows.forEach((r, i) => {
      const h = (Number(r.total) / max) * (H - 14), x = pl + i * step + (step - bw) / 2;
      const rect = S("rect", { class: "bar-r", x, y: H - h, width: bw, height: Math.max(h, Number(r.total) ? 2 : 0), rx: 2, tabindex: "0" });
      const t = S("title"); t.textContent = `${label(r)}: ${rp(r.total)} (${r.orders} pesanan)`; rect.append(t);
      const show = () => { svg.querySelectorAll(".on").forEach((e) => e.classList.remove("on")); rect.classList.add("on"); read.textContent = `${label(r)}: ${rp(r.total)} dari ${r.orders} pesanan`; };
      rect.addEventListener("click", show); rect.addEventListener("focus", show); rect.addEventListener("keydown", (e) => { if (e.key === "Enter") show(); });
      svg.append(rect);
      if ((n - 1 - i) % every === 0) { const tx = S("text", { x: x + bw / 2, y: H + 14, "text-anchor": "middle" }); tx.textContent = u === "month" ? fm(r.bucket).split(" ")[0] : fd(r.bucket); svg.append(tx); }
    });
    box.replaceChildren(read, svg, total ? "" : el("p", { class: "muted" }, "Belum ada penjualan pada rentang ini."));
  }
  function drawTop(box, rows) {
    if (!rows.length) return box.replaceChildren(el("div", { class: "empty" }, "Belum ada penjualan pada rentang ini."));
    const max = Math.max(...rows.map((r) => r.qty));
    box.replaceChildren(el("ol", { class: "rank" }, rows.map((r, i) => el("li", {},
      el("div", { class: "t" }, el("span", {}, `${i + 1}. ${r.title}`), el("span", {}, `${r.qty} terjual`)),
      el("div", { class: "meter" }, el("i", { style: `width:${(r.qty / max) * 100}%` })), el("small", {}, rp(r.revenue))))));
  }

  /* ---------- pesanan ---------- */
  let ofilter = "pending";
  async function vOrders(body) {
    const chips = el("div", { class: "seg", role: "group", "aria-label": "Saring pesanan" }, [["pending", "Menunggu"], ["paid", "Lunas"], ["", "Semua"]].map(([v, l]) =>
      el("button", { type: "button", "aria-pressed": String(v === ofilter), onclick: () => { ofilter = v; vOrders(body); } }, l)));
    const list = el("div", { class: "list" }, el("p", { class: "muted" }, "Memuat…"));
    body.replaceChildren(el("div", { class: "row" }, el("h2", {}, "Pesanan"), chips), list);
    try {
      const { orders } = await call("orders", { status: ofilter });
      if (!orders.length) return list.replaceChildren(el("div", { class: "empty" }, ofilter === "pending" ? "Tidak ada pesanan yang menunggu pembayaran." : "Belum ada pesanan."));
      list.replaceChildren(...orders.map((o) => orderItem(o, body)));
    } catch (x) { list.replaceChildren(el("p", { class: "err" }, x.message)); }
  }
  function orderItem(o, body) {
    const w = waLink(o.customers?.whatsapp);
    const amt = o.pay_method === "qris_manual" && o.status === "pending" ? o.pay_amount : o.gross_amount;
    const acts = el("div", { class: "acts" });
    if (o.status === "pending" || o.status === "expired") acts.append(el("button", { class: "btn pri", type: "button", onclick: (e) => act(e, "confirm", o, `Konfirmasi pembayaran ${rp(amt)} dari ${o.customers?.name || o.email}? Produk akan langsung terbuka di akun pembeli.`, body) }, "Konfirmasi lunas"));
    if (o.status === "pending") acts.append(el("button", { class: "btn dng", type: "button", onclick: (e) => act(e, "cancel", o, "Batalkan pesanan ini?", body) }, "Batalkan"));
    if (o.status === "paid") acts.append(el("button", { class: "btn dng", type: "button", onclick: (e) => act(e, "cancel", o, "Tandai pesanan ini dikembalikan dan cabut akses produk?", body) }, "Refund / cabut akses"));
    if (w) acts.append(el("a", { class: "btn", href: w, target: "_blank", rel: "noopener" }, "WhatsApp"));
    return el("article", { class: "item" },
      el("div", { class: "h" }, el("div", {}, el("p", { class: "n" }, o.customers?.name || "-"), el("p", { class: "s" }, o.email)), el("div", {}, el("p", { class: "amt" }, rp(amt)), el("span", { class: `pill ${o.status}` }, { pending: "Menunggu", paid: "Lunas", failed: "Batal", expired: "Kedaluwarsa", refunded: "Refund" }[o.status] || o.status))),
      el("p", { class: "s" }, (o.items || []).map((i) => i.title).join(", ")),
      el("p", { class: "s" }, `Kode ${o.id} · dibuat ${fdt(o.created_at)}${o.paid_at ? " · lunas " + fdt(o.paid_at) : ""}`),
      o.unique_code && o.status === "pending" ? el("p", { class: "s" }, `Cocokkan dengan mutasi: tepat ${rp(o.pay_amount)} (harga ${rp(o.gross_amount)} + kode ${o.unique_code})`) : "", acts);
  }
  async function act(e, action, o, q, body) {
    if (!confirm(q)) return;
    e.target.disabled = true;
    try { await call(action, { order_id: o.id }); toast("Berhasil disimpan."); await refreshOv(); shell(); } catch (x) { toast(x.message); e.target.disabled = false; }
  }

  /* ---------- pembeli ---------- */
  async function vCustomers(body) {
    const q = el("input", { class: "search", type: "search", placeholder: "Cari nama, email, atau WhatsApp", "aria-label": "Cari pembeli" });
    const list = el("div", { class: "list" }, el("p", { class: "muted" }, "Memuat…"));
    body.replaceChildren(el("h2", {}, "Pembeli"), q, list);
    let rows = [];
    const draw = () => {
      const k = q.value.trim().toLowerCase();
      const r = rows.filter((c) => !k || `${c.name} ${c.email} ${c.whatsapp || ""}`.toLowerCase().includes(k));
      list.replaceChildren(...(r.length ? r.map(custItem) : [el("div", { class: "empty" }, "Tidak ada pembeli yang cocok.")]));
    };
    q.addEventListener("input", draw);
    try { rows = (await call("customers")).customers; draw(); } catch (x) { list.replaceChildren(el("p", { class: "err" }, x.message)); }
  }
  function custItem(c) {
    const w = waLink(c.whatsapp);
    const dv = c.devices.length ? c.devices.map((d) => (d === "mobile" ? "HP" : "Laptop")).join(" + ") : "belum ada";
    const btn = (label, cls, fn) => el("button", { class: `btn ${cls}`, type: "button", onclick: async (e) => { e.target.disabled = true; try { await fn(); toast("Berhasil disimpan."); vCustomers($("#body")); } catch (x) { toast(x.message); e.target.disabled = false; } } }, label);
    return el("article", { class: "item" },
      el("div", { class: "h" }, el("div", {}, el("p", { class: "n" }, c.name), el("p", { class: "s" }, c.email + (c.whatsapp ? " · " + c.whatsapp : ""))), el("span", { class: `pill ${c.status}` }, c.status === "active" ? "Aktif" : "Ditangguhkan")),
      el("p", { class: "s" }, `${c.orders} pesanan lunas · ${rp(c.spent)} · terakhir ${fdt(c.last_paid)}`),
      el("p", { class: "s" }, `Perangkat terdaftar: ${dv} · daftar ${fdt(c.created_at)}`),
      el("div", { class: "acts" },
        w ? el("a", { class: "btn", href: w, target: "_blank", rel: "noopener" }, "WhatsApp") : "",
        btn("Reset perangkat", "", async () => { if (!confirm(`Reset semua perangkat ${c.email}? Pembeli bisa mendaftarkan HP dan laptop lagi.`)) throw new Error("Dibatalkan."); await call("device_reset", { email: c.email }); }),
        btn(c.status === "active" ? "Tangguhkan" : "Aktifkan", c.status === "active" ? "dng" : "", async () => { await call("set_status", { email: c.email, status: c.status === "active" ? "suspended" : "active" }); })));
  }

  /* ---------- tiket ---------- */
  let tfilter = "open";
  async function vTickets(body) {
    const f = { name: el("input", { required: true, maxlength: "80", autocomplete: "off" }), wa: el("input", { type: "tel", inputmode: "tel", placeholder: "08xxxxxxxxxx" }), email: el("input", { type: "email", placeholder: "Boleh dikosongkan" }), issue: el("textarea", { required: true, maxlength: "1000", placeholder: "Contoh: produk tidak bisa diunduh" }) };
    const form = el("form", { class: "form", onsubmit: async (e) => {
      e.preventDefault();
      try { await call("ticket_create", { name: f.name.value, whatsapp: f.wa.value, email: f.email.value, issue: f.issue.value, channel: "whatsapp" }); toast("Tiket dibuat."); await refreshOv(); shell(); } catch (x) { toast(x.message); }
    } }, el("h2", { style: "margin:0" }, "Tiket baru"),
      el("div", { class: "grid2" }, el("label", {}, "Nama pembeli", f.name), el("label", {}, "WhatsApp", f.wa)),
      el("label", {}, "Email", f.email), el("label", {}, "Keluhan", f.issue), el("button", { class: "btn pri", type: "submit" }, "Simpan tiket"));
    const chips = el("div", { class: "seg", role: "group", "aria-label": "Saring tiket" }, [["open", "Terbuka"], ["closed", "Selesai"], ["", "Semua"]].map(([v, l]) =>
      el("button", { type: "button", "aria-pressed": String(v === tfilter), onclick: () => { tfilter = v; vTickets(body); } }, l)));
    const list = el("div", { class: "list" }, el("p", { class: "muted" }, "Memuat…"));
    body.replaceChildren(form, el("div", { class: "row" }, el("h2", {}, "Daftar tiket"), chips), list);
    try {
      const { tickets } = await call("tickets", { status: tfilter });
      list.replaceChildren(...(tickets.length ? tickets.map(ticketItem) : [el("div", { class: "empty" }, "Tidak ada tiket.")]));
    } catch (x) { list.replaceChildren(el("p", { class: "err" }, x.message)); }
  }
  function dur(a, b) { const m = Math.round((new Date(b) - new Date(a)) / 60000); return m < 60 ? `${m} menit` : m < 1440 ? `${Math.floor(m / 60)} jam ${m % 60} menit` : `${Math.floor(m / 1440)} hari`; }
  function ticketItem(t) {
    const w = waLink(t.whatsapp);
    const acts = el("div", { class: "acts" });
    if (t.status === "open") acts.append(el("button", { class: "btn pri", type: "button", onclick: async (e) => { const r = prompt("Catatan penyelesaian (misalnya: link unduhan dikirim ulang):", ""); if (r === null) return; e.target.disabled = true; try { await call("ticket_close", { id: t.id, resolution: r }); toast("Tiket diselesaikan."); await refreshOv(); shell(); } catch (x) { toast(x.message); e.target.disabled = false; } } }, "Tandai selesai"));
    else acts.append(el("button", { class: "btn", type: "button", onclick: async () => { try { await call("ticket_reopen", { id: t.id }); await refreshOv(); shell(); } catch (x) { toast(x.message); } } }, "Buka lagi"));
    if (w) acts.append(el("a", { class: "btn", href: w, target: "_blank", rel: "noopener" }, "WhatsApp"));
    return el("article", { class: "item" },
      el("div", { class: "h" }, el("div", {}, el("p", { class: "n" }, t.customer_name), el("p", { class: "s" }, [t.whatsapp, t.customer_email].filter(Boolean).join(" · "))), el("span", { class: `pill ${t.status}` }, t.status === "open" ? "Terbuka" : "Selesai")),
      el("p", {}, t.issue),
      el("p", { class: "s" }, `Dibuka ${fdt(t.opened_at)}`),
      t.status === "closed" ? el("p", { class: "s" }, `Selesai ${fdt(t.closed_at)} (${dur(t.opened_at, t.closed_at)})${t.resolution ? " · " + t.resolution : ""}`) : "", acts);
  }

  $("#logout").addEventListener("click", () => { sset(null); renderLogin(); });
  if (!C.SUPABASE_URL) app.replaceChildren(el("p", { class: "err pad" }, "Konfigurasi belum lengkap."));
  else if (sget()) start(); else renderLogin();
})();
