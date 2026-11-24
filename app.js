"use strict";
(() => {
  const C = window.SKILLSTORE || {};
  const LIVE = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  const FN = (n) => `${C.SUPABASE_URL}/functions/v1/${n}`;
  const $ = (s, r = document) => r.querySelector(s);
  const rp = (n) => "Rp" + new Intl.NumberFormat("id-ID").format(n);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* penyimpanan dinonaktifkan */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* abaikan */ } },
  };
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
  function toast(msg, ms = 5200) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms);
  }

  let products = [], byId = {}, cat = "Semua", query = "";
  let cart = store.get("ss_cart", []).filter((x) => typeof x === "string");

  /* ---------------- Katalog ---------------- */
  function renderCats() {
    const counts = {}; products.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
    const names = ["Semua", ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];
    const ul = $("#cats"); ul.replaceChildren(...names.map((n) =>
      el("li", {}, el("button", { type: "button", "aria-pressed": String(n === cat), onclick: () => { cat = n; renderCats(); renderList(); } },
        n, el("small", {}, String(n === "Semua" ? products.length : counts[n]))))));
  }
  function renderList() {
    const q = query.trim().toLowerCase();
    const rows = products.filter((p) => (cat === "Semua" || p.cat === cat) && (!q || (p.title + " " + p.cat).toLowerCase().includes(q)));
    $("#resultInfo").textContent = rows.length ? `${rows.length} produk` : "";
    const ul = $("#list");
    if (!rows.length) { ul.replaceChildren(el("li", { class: "empty" }, "Tidak ada produk yang cocok. Coba kata kunci lain atau pilih Semua.")); return; }
    ul.replaceChildren(...rows.map((p) => {
      const inCart = cart.includes(p.id);
      return el("li", { class: "row" },
        el("h3", {}, el("button", { type: "button", onclick: () => openDetail(p.id) }, p.title)),
        el("p", { class: "meta" }, `${p.cat} · ${p.fmt}${p.size ? " · " + (p.size >= 1000 ? (p.size / 1000).toFixed(1) + " GB" : Math.round(p.size) + " MB") : ""}`),
        el("div", { class: "buy" }, el("span", { class: "price" }, rp(p.price)),
          el("button", { class: "add", type: "button", "aria-pressed": String(inCart), onclick: () => toggleCart(p.id) }, inCart ? "Di keranjang" : "Tambah")));
    }));
  }
  function openDetail(id) {
    const p = byId[id]; if (!p) return;
    $("#dTitle").textContent = p.title;
    $("#dMeta").textContent = `${p.cat} · ${p.fmt}`;
    $("#dDesc").textContent = p.desc;
    $("#dPrice").textContent = rp(p.price);
    const b = $("#dAdd"); b.onclick = () => { if (!cart.includes(id)) toggleCart(id); $("#detail").close(); openCart(); };
    $("#detail").showModal();
  }

  /* ---------------- Keranjang ---------------- */
  function toggleCart(id) {
    cart = cart.includes(id) ? cart.filter((x) => x !== id) : [...cart, id];
    store.set("ss_cart", cart); renderList(); renderCart();
  }
  function renderCart() {
    $("#cartCount").textContent = String(cart.length);
    const items = cart.map((id) => byId[id]).filter(Boolean);
    $("#cartList").replaceChildren(...items.map((p) => el("li", {}, el("span", {}, p.title), el("span", { class: "price" }, rp(p.price)),
      el("button", { type: "button", onclick: () => toggleCart(p.id) }, "Hapus"))));
    $("#cartEmpty").hidden = items.length > 0;
    $("#checkout").hidden = items.length === 0;
    $("#cartTotal").textContent = rp(items.reduce((s, p) => s + p.price, 0));
  }
  function openCart() { renderCart(); $("#cart").showModal(); }

  function loadSnap() {
    return new Promise((res, rej) => {
      if (window.snap) return res();
      const s = document.createElement("script");
      s.src = C.MIDTRANS_PRODUCTION ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
      s.setAttribute("data-client-key", C.MIDTRANS_CLIENT_KEY);
      s.onload = res; s.onerror = () => rej(new Error("Pembayaran tidak bisa dimuat. Periksa koneksi Anda."));
      document.head.append(s);
    });
  }
  async function submitCheckout(e) {
    e.preventDefault();
    const f = e.target, err = $("#coErr"); err.hidden = true;
    if (!LIVE || !C.MIDTRANS_CLIENT_KEY) { err.textContent = "Mode demo: sambungkan Supabase dan Midtrans di config.js dulu."; err.hidden = false; return; }
    if (!f.reportValidity()) return;
    const btn = $("#payBtn"); btn.disabled = true; btn.textContent = "Menyiapkan pembayaran…";
    try {
      const r = await fetch(FN("create-transaction"), {
        method: "POST", headers: { "Content-Type": "application/json", apikey: C.SUPABASE_ANON_KEY },
        body: JSON.stringify({ name: f.name.value, email: f.email.value, whatsapp: f.whatsapp.value, website: f.website.value, items: cart }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Pesanan gagal dibuat. Coba lagi.");
      await loadSnap();
      store.set("ss_email", f.email.value.trim().toLowerCase());
      $("#cart").close();
      window.snap.pay(d.token, {
        onSuccess() { done("Pembayaran diterima. Akses terbuka begitu Midtrans mengonfirmasi, biasanya hitungan detik."); },
        onPending() { done("Menunggu pembayaran Anda. Akses terbuka otomatis setelah pembayaran berhasil."); },
        onError() { toast("Pembayaran gagal. Coba lagi atau pilih metode lain."); },
        onClose() { toast("Jendela pembayaran ditutup. Pesanan Anda tetap tersimpan 24 jam."); },
      });
    } catch (x) { err.textContent = x.message; err.hidden = false; }
    finally { btn.disabled = false; btn.textContent = "Bayar dengan Midtrans"; }
  }
  function done(msg) { cart = []; store.set("ss_cart", cart); renderList(); renderCart(); location.hash = "#/akun"; toast(msg, 9000); }

  /* ---------------- Auth (OTP email via Supabase Auth) ---------------- */
  const sess = {
    get() { return store.get("ss_sess", null); },
    set(s) { store.set("ss_sess", s); }, clear() { store.del("ss_sess"); },
  };
  async function auth(path, body) {
    const r = await fetch(`${C.SUPABASE_URL}/auth/v1/${path}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: C.SUPABASE_ANON_KEY }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.msg || d.error_description || d.message || "Permintaan gagal.");
    return d;
  }
  function keep(d, email) { sess.set({ access: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 30) * 1000, email }); }
  async function token() {
    let s = sess.get(); if (!s) return null;
    if (Date.now() > s.exp) {
      try { keep(await auth("token?grant_type=refresh_token", { refresh_token: s.refresh }), s.email); s = sess.get(); }
      catch { sess.clear(); return null; }
    }
    return s.access;
  }
  async function api(name, opts = {}) {
    const t = await token(); if (!t) throw Object.assign(new Error("Sesi berakhir. Masuk lagi."), { auth: true });
    const h = { Authorization: `Bearer ${t}`, apikey: C.SUPABASE_ANON_KEY, "X-Device-Token": store.get("ss_dt", "") || "", ...(opts.headers || {}) };
    return fetch(FN(name), { ...opts, headers: h });
  }

  function renderAuth() {
    const box = $("#authBox"), lib = $("#libBox");
    if (!LIVE) { box.replaceChildren(el("div", { class: "panel" }, el("h2", {}, "Belum tersambung"), el("p", {}, "Isi config.js dengan alamat Supabase agar login pembeli aktif."))); lib.hidden = true; return; }
    if (sess.get()) { box.replaceChildren(); showLibrary(); return; }
    lib.hidden = true;
    const email = el("input", { type: "email", placeholder: "Email yang dipakai saat membeli", autocomplete: "email", required: true, value: store.get("ss_email", "") || "" });
    const msg = el("p", { class: "status", role: "status" });
    const send = el("form", { class: "form-row", onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = "Mengirim kode…";
      try {
        await auth("otp", { email: email.value.trim().toLowerCase(), create_user: true });
        msg.textContent = "Kode 6 digit dikirim ke email Anda. Cek juga folder spam.";
        send.replaceWith(verify(email.value.trim().toLowerCase(), msg));
      } catch (x) { msg.textContent = x.message; }
    } }, email, el("button", { class: "btn primary", type: "submit" }, "Kirim kode masuk"));
    box.replaceChildren(el("div", { class: "panel" }, el("h2", {}, "Masuk"), el("p", {}, "Gunakan email pembelian. Tidak perlu kata sandi."), send, msg));
  }
  function verify(email, msg) {
    const code = el("input", { class: "otp", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "8", placeholder: "Kode", required: true });
    return el("form", { class: "form-row", onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = "Memeriksa kode…";
      try { keep(await auth("verify", { type: "email", email, token: code.value.trim() }), email); renderAuth(); }
      catch (x) { msg.textContent = x.message; }
    } }, code, el("button", { class: "btn primary", type: "submit" }, "Masuk"));
  }

  /* ---------------- Perpustakaan + perangkat ---------------- */
  async function showLibrary() {
    const lib = $("#libBox"); lib.hidden = false; lib.replaceChildren(el("p", { class: "status" }, "Memuat akun…"));
    try {
      let r = await api("claim-device", { method: "POST" });
      let d = await r.json().catch(() => ({}));
      if (d.device_token) store.set("ss_dt", d.device_token);
      if (!r.ok) return lib.replaceChildren(panelError(d.error || "Perangkat ini tidak bisa didaftarkan."));
      r = await api("library"); d = await r.json().catch(() => ({}));
      if (!r.ok) return lib.replaceChildren(panelError(d.error || "Akun tidak bisa dimuat."));
      renderLibrary(d);
    } catch (x) { if (x.auth) { sess.clear(); renderAuth(); } else lib.replaceChildren(panelError("Koneksi bermasalah. Muat ulang halaman.")); }
  }
  const panelError = (t) => el("div", { class: "panel" }, el("h2", {}, "Akses ditolak"), el("p", {}, t),
    el("button", { class: "open", type: "button", onclick: () => { sess.clear(); renderAuth(); } }, "Keluar"));

  function renderLibrary(d) {
    const lib = $("#libBox"); const has = (c) => (d.devices || []).some((x) => x.class === c);
    const slot = (c, label, icon) => el("div", { class: "slot " + (has(c) ? "used" : "free") }, icon, el("b", {}, label),
      el("small", {}, has(c) ? (d.this_device === c ? "Perangkat ini" : "Terdaftar") : "Kosong"));
    const svg = (inner) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.innerHTML = inner; return s; };
    const pass = el("div", { class: "pass inline" }, el("div", { class: "pass-head" }, el("span", { class: "pass-title" }, `Halo, ${d.name || "pembeli"}`), el("span", { class: "pass-note" }, "Slot perangkat")),
      el("div", { class: "slots" },
        slot("mobile", "HP", svg('<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.5h3"/>')),
        slot("desktop", "Laptop", svg('<rect x="3" y="4.5" width="18" height="11.5" rx="1.6"/><path d="M2 19.5h20"/>'))),
      el("p", { class: "pass-foot" }, "Perangkat lain tidak bisa membuka produk. Untuk pindah perangkat, hubungi admin."));
    const items = (d.products || []).map((p) => productItem(p));
    lib.replaceChildren(pass,
      el("div", { class: "panel" }, el("h2", {}, "Produk saya"),
        items.length ? el("ul", { class: "lib" }, items) : el("p", {}, "Belum ada produk aktif. Jika baru membayar, tunggu beberapa detik lalu muat ulang."),
        el("button", { class: "open", type: "button", onclick: () => { sess.clear(); renderAuth(); } }, "Keluar")));
  }
  function productItem(p) {
    const status = el("p", { class: "status", role: "status" }), files = el("ul", { class: "files" });
    const open = el("button", { class: "open", type: "button", onclick: async () => {
      if (p.kind === "file") return fetchFile(p.id, null, status);
      status.textContent = "Memuat isi…";
      try {
        const r = await api("download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Isi produk belum bisa dimuat.");
        status.textContent = d.files.length ? "" : "Folder ini kosong. Hubungi admin.";
        files.replaceChildren(...d.files.map((f) => el("li", {}, el("span", {}, f.name),
          f.mimeType === "application/vnd.google-apps.folder"
            ? el("button", { type: "button", onclick: () => subfolder(p.id, f.id, files, status) }, "Buka")
            : el("button", { type: "button", onclick: () => fetchFile(p.id, f.id, status) }, "Unduh"))));
      } catch (x) { status.textContent = x.message; }
    } }, p.kind === "file" ? "Unduh" : "Buka isi");
    return el("li", {}, el("h3", {}, p.title), open, status, files);
  }
  async function subfolder(pid, fid, files, status) {
    try {
      const r = await api("download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: pid, fileId: fid }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Folder tidak bisa dibuka.");
      files.replaceChildren(...d.files.map((f) => el("li", {}, el("span", {}, f.name),
        f.mimeType === "application/vnd.google-apps.folder" ? el("span", {}, "Folder") : el("button", { type: "button", onclick: () => fetchFile(pid, f.id, status) }, "Unduh"))));
    } catch (x) { status.textContent = x.message; }
  }
  async function fetchFile(pid, fid, status) {
    status.textContent = "Menyiapkan unduhan…";
    try {
      const r = await api("download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: pid, fileId: fid }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Unduhan gagal."); }
      if ((r.headers.get("content-type") || "").includes("application/json")) { const d = await r.json(); throw new Error(d.error || "Ini folder, bukan file."); }
      const total = Number(r.headers.get("content-length")) || 0, rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done: dn, value } = await rd.read(); if (dn) break; parts.push(value); got += value.length; status.textContent = total ? `Mengunduh ${Math.round((got / total) * 100)}%` : `Mengunduh ${(got / 1048576).toFixed(0)} MB`; }
      const m = /filename\*=UTF-8''([^;]+)/i.exec(r.headers.get("content-disposition") || "");
      const a = el("a", { href: URL.createObjectURL(new Blob(parts)), download: m ? decodeURIComponent(m[1]) : "produk" });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      status.textContent = "Selesai. Cek folder unduhan Anda.";
    } catch (x) { status.textContent = x.message; }
  }

  /* ---------------- Router + init ---------------- */
  function route() {
    const akun = location.hash.startsWith("#/akun");
    $("#view-home").hidden = akun; $("#view-akun").hidden = !akun;
    document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === (akun ? "akun" : "home") ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    if (akun) renderAuth();
    if (!location.hash.startsWith("#katalog")) window.scrollTo(0, 0);
  }
  async function init() {
    $("#demoBanner").hidden = LIVE && !!C.MIDTRANS_CLIENT_KEY;
    try { products = await (await fetch("products.json", { cache: "no-cache" })).json(); }
    catch { $("#list").replaceChildren(el("li", { class: "empty" }, "Katalog tidak bisa dimuat. Muat ulang halaman.")); return; }
    byId = Object.fromEntries(products.map((p) => [p.id, p]));
    cart = cart.filter((id) => byId[id]);
    renderCats(); renderList(); renderCart();
    $("#q").addEventListener("input", (e) => { query = e.target.value; renderList(); });
    $("#openCart").addEventListener("click", openCart);
    $("#checkout").addEventListener("submit", submitCheckout);
    for (const d of document.querySelectorAll("dialog")) d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    window.addEventListener("hashchange", route); route();
  }
  init();
})();
