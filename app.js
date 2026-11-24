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

  let products = [], byId = {}, cat = "Semua", query = "", shown = 12;
  let cart = store.get("ss_cart", []).filter((x) => typeof x === "string");

  /* ---------------- Katalog ---------------- */
  const tone = (c) => "t" + ([...c].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 6);
  const size = (m) => (m ? (m >= 1000 ? (m / 1000).toFixed(1) + " GB" : Math.round(m) + " MB") : "");
  const cover = (p, big) => el("div", { class: "mini" }, el("small", {}, "NAFA DIGITAL"), el("strong", {}, p.cat), el("span", {}, p.fmt));
  function renderCats() {
    const counts = {}; products.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
    const names = ["Semua", ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];
    $("#cats").replaceChildren(...names.map((n) =>
      el("button", { type: "button", "aria-pressed": String(n === cat), onclick: () => { cat = n; shown = 12; renderCats(); renderList(); } },
        n, el("small", {}, String(n === "Semua" ? products.length : counts[n])))));
  }
  function renderList() {
    const q = query.trim().toLowerCase();
    const rows = products.filter((p) => (cat === "Semua" || p.cat === cat) && (!q || (p.title + " " + p.cat).toLowerCase().includes(q)));
    const vis = rows.slice(0, shown);
    $("#resultInfo").textContent = rows.length ? `Menampilkan ${vis.length} dari ${rows.length} produk` : "";
    const box = $("#list");
    if (!rows.length) { box.replaceChildren(el("p", { class: "empty" }, "Tidak ada produk yang cocok. Coba kata kunci lain atau pilih Semua.")); return; }
    box.replaceChildren(...vis.map((p) => {
      const inCart = cart.includes(p.id);
      return el("article", { class: "card" },
        el("button", { type: "button", class: "art " + tone(p.cat), "aria-label": "Lihat detail " + p.title, onclick: () => openDetail(p.id) },
          el("span", { class: "orbit2" }), cover(p)),
        el("div", { class: "body" },
          el("p", { class: "cat" }, p.cat),
          el("h3", {}, el("button", { type: "button", onclick: () => openDetail(p.id) }, p.title)),
          el("p", { class: "meta" }, [p.fmt, size(p.size)].filter(Boolean).join(" · ")),
          el("div", { class: "foot-row" }, el("span", { class: "price" }, rp(p.price)),
            el("button", { class: "add", type: "button", "aria-pressed": String(inCart), "aria-label": (inCart ? "Hapus dari keranjang: " : "Tambah ke keranjang: ") + p.title, onclick: () => toggleCart(p.id) },
              inCart ? "✓ Di keranjang" : "+ Tambah"))));
    }));
    $("#more").hidden = rows.length <= shown;
  }
  function openDetail(id) {
    const p = byId[id]; if (!p) return;
    $("#dTitle").textContent = p.title;
    $("#dMeta").textContent = [p.cat, p.fmt, size(p.size)].filter(Boolean).join(" · ");
    $("#dDesc").textContent = p.desc;
    $("#dPrice").textContent = rp(p.price);
    const art = $("#dArt"); art.className = "d-art " + tone(p.cat); art.replaceChildren(el("span", { class: "orbit2" }), cover(p));
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
      el("button", { type: "button", "aria-label": "Hapus " + p.title, onclick: () => toggleCart(p.id) }, "Hapus dari keranjang"))));
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
    if (!LIVE || !C.MIDTRANS_CLIENT_KEY) { err.textContent = "Pembayaran belum aktif. Silakan coba lagi nanti atau hubungi admin."; err.hidden = false; return; }
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
        onSuccess() { done("Pembayaran diterima. Produk Anda akan muncul di sini dalam beberapa detik."); },
        onPending() { done("Menunggu pembayaran Anda. Produk terbuka otomatis setelah pembayaran berhasil."); },
        onError() { toast("Pembayaran gagal. Coba lagi atau pilih metode lain."); },
        onClose() { toast("Pembayaran belum selesai. Pesanan Anda tetap tersimpan 24 jam."); },
      });
    } catch (x) { err.textContent = x.message; err.hidden = false; }
    finally { btn.disabled = false; btn.textContent = "Bayar sekarang →"; }
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
    if (!LIVE) { box.replaceChildren(el("div", { class: "panel" }, el("h2", {}, "Akun belum tersedia"), el("p", {}, "Layanan masuk sedang belum aktif. Silakan coba lagi nanti."))); lib.hidden = true; return; }
    if (sess.get()) { box.replaceChildren(); showLibrary(); return; }
    lib.hidden = true;
    const email = el("input", { type: "email", placeholder: "Email yang dipakai saat membeli", autocomplete: "email", required: true, value: store.get("ss_email", "") || "" });
    const msg = el("p", { class: "status", role: "status" });
    const send = el("form", { class: "form-row", onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = "Mengirim kode…";
      try {
        await auth("otp", { email: email.value.trim().toLowerCase(), create_user: true });
        msg.textContent = "Kode dikirim ke email Anda. Cek juga folder spam.";
        send.replaceWith(verify(email.value.trim().toLowerCase(), msg));
      } catch (x) { msg.textContent = x.message; }
    } }, email, el("button", { class: "btn btn-dark", type: "submit" }, "Kirim kode masuk"));
    box.replaceChildren(el("div", { class: "panel" }, el("h2", {}, "Masuk"), el("p", {}, "Pakai email yang Anda isi saat membeli. Tidak perlu kata sandi, kami kirim kode ke email."), send, msg));
  }
  function verify(email, msg) {
    const code = el("input", { class: "otp", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "8", placeholder: "Kode", required: true });
    return el("form", { class: "form-row", onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = "Memeriksa kode…";
      try { keep(await auth("verify", { type: "email", email, token: code.value.trim() }), email); renderAuth(); }
      catch (x) { msg.textContent = x.message; }
    } }, code, el("button", { class: "btn btn-dark", type: "submit" }, "Masuk"));
  }

  /* ---------------- Perpustakaan + perangkat ---------------- */
  async function showLibrary() {
    const lib = $("#libBox"); lib.hidden = false; lib.replaceChildren(el("p", { class: "status" }, "Memuat akun…"));
    try {
      let r = await api("claim-device", { method: "POST" });
      let d = await r.json().catch(() => ({}));
      if (d.device_token) store.set("ss_dt", d.device_token);
      if (!r.ok) return lib.replaceChildren(panelError(d.error || "Akun ini sedang dipakai di perangkat lain. Hubungi admin untuk bantuan."));
      r = await api("library"); d = await r.json().catch(() => ({}));
      if (!r.ok) return lib.replaceChildren(panelError(d.error || "Akun belum bisa dimuat. Coba lagi sebentar lagi."));
      renderLibrary(d);
    } catch (x) { if (x.auth) { sess.clear(); renderAuth(); } else lib.replaceChildren(panelError("Koneksi bermasalah. Muat ulang halaman.")); }
  }
  const panelError = (t) => el("div", { class: "panel" }, el("h2", {}, "Akses ditolak"), el("p", {}, t),
    el("button", { class: "open", type: "button", onclick: () => { sess.clear(); renderAuth(); } }, "Keluar"));

  function renderLibrary(d) {
    const lib = $("#libBox");
    const pass = el("div", { class: "panel hello" }, el("h2", {}, `Halo, ${d.name || "pembeli"}`), el("p", {}, "Produk yang sudah Anda bayar ada di bawah ini. Buka atau unduh kapan saja."));
    const items = (d.products || []).map((p) => productItem(p));
    lib.replaceChildren(pass,
      el("div", { class: "panel" }, el("h2", {}, "Produk saya"),
        items.length ? el("ul", { class: "lib" }, items) : el("p", {}, "Belum ada produk di akun ini. Jika baru membayar, tunggu beberapa detik lalu muat ulang halaman."),
        el("button", { class: "open", type: "button", onclick: () => { sess.clear(); renderAuth(); } }, "Keluar dari akun")));
  }
  function productItem(p) {
    const status = el("p", { class: "status", role: "status" }), files = el("ul", { class: "files" });
    const open = el("button", { class: "open", type: "button", onclick: async () => {
      if (p.kind === "file") return fetchFile(p.id, null, status);
      status.textContent = "Membuka isi produk…";
      try {
        const r = await api("download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Isi produk belum bisa dibuka.");
        status.textContent = d.files.length ? "" : "Folder ini kosong. Hubungi admin.";
        files.replaceChildren(...d.files.map((f) => el("li", {}, el("span", {}, f.name),
          f.mimeType === "application/vnd.google-apps.folder"
            ? el("button", { type: "button", onclick: () => subfolder(p.id, f.id, files, status) }, "Buka")
            : el("button", { type: "button", onclick: () => fetchFile(p.id, f.id, status) }, "Unduh"))));
      } catch (x) { status.textContent = x.message; }
    } }, p.kind === "file" ? "Unduh produk" : "Buka isi produk");
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
    const h = location.hash, akun = h.startsWith("#/akun");
    $("#view-home").hidden = akun; $("#view-akun").hidden = !akun;
    document.querySelectorAll("[data-nav]").forEach((a) => (akun ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    if (akun) renderAuth();
    const target = !akun && h.length > 2 && h[1] !== "/" ? document.getElementById(h.slice(1)) : null;
    if (target) requestAnimationFrame(() => target.scrollIntoView());
    else window.scrollTo(0, 0);
  }
  function setMenu(open) { $("#nav").classList.toggle("open", open); $("#menuBtn").setAttribute("aria-expanded", String(open)); $("#menuBtn").setAttribute("aria-label", open ? "Tutup menu" : "Buka menu"); }
  async function init() {
    $("#menuBtn").addEventListener("click", () => setMenu(!$("#nav").classList.contains("open")));
    $("#nav").addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    try { products = await (await fetch("products.json", { cache: "no-cache" })).json(); }
    catch { $("#list").replaceChildren(el("p", { class: "empty" }, "Daftar produk belum bisa dimuat. Muat ulang halaman.")); return; }
    byId = Object.fromEntries(products.map((p) => [p.id, p]));
    cart = cart.filter((id) => byId[id]);
    renderCats(); renderList(); renderCart();
    $("#q").addEventListener("input", (e) => { query = e.target.value; shown = 12; renderList(); });
    $("#more").addEventListener("click", () => { shown += 12; renderList(); });
    $("#openCart").addEventListener("click", openCart);
    $("#startShop").addEventListener("click", () => { $("#cart").close(); location.hash = "#produk"; });
    $("#checkout").addEventListener("submit", submitCheckout);
    for (const d of document.querySelectorAll("dialog")) d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    window.addEventListener("hashchange", route); route();
  }
  init();
})();
