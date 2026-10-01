"use strict";

const KUOTA = 15; // kuota per program studi
const PRODI = {
  "Fakultas Teknik": ["Teknik Informatika", "Teknik Sipil", "Teknik Elektro"],
  "Fakultas Ekonomi & Bisnis": ["Manajemen", "Akuntansi"],
  "Fakultas Kedokteran": ["Pendidikan Dokter", "Keperawatan"],
  "Fakultas Hukum": ["Ilmu Hukum"],
  "Fakultas Keguruan": ["Pendidikan Matematika", "PGSD"]
};
const BONUS = { "Sangat Baik": 10, "Baik": 6, "Cukup": 3 };
const KEY = "pmb_pendaftar", USER = "pmb_user";

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = d => localStorage.setItem(KEY, JSON.stringify(d));

let user = localStorage.getItem(USER) || "", draft = null, otpCode = "";

function toast(m) {
  const t = $("#toast");
  t.textContent = m; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 6000);
}

/* ---------- Login nomor HP ---------- */
const normHp = v => {
  v = v.replace(/\D/g, "");
  if (v.startsWith("62")) v = "0" + v.slice(2);
  return /^08\d{8,11}$/.test(v) ? v : "";
};

$("#fLogin").addEventListener("submit", e => {
  e.preventDefault();
  if ($("#otpBox").hidden) {
    const hp = normHp($("#hp").value);
    if (!hp) return toast("Nomor HP tidak valid. Contoh: 081234567890");
    $("#hp").value = hp; $("#hp").readOnly = true;
    otpCode = String(Math.floor(1000 + Math.random() * 9000));
    $("#otpBox").hidden = false; $("#otp").focus();
    $("#btnLogin").textContent = "Masuk";
    toast("Kode OTP demo: " + otpCode + ". Di aplikasi nyata kode dikirim lewat SMS.");
  } else {
    if ($("#otp").value !== otpCode) return toast("Kode OTP salah. Periksa lagi kodenya.");
    user = $("#hp").value;
    localStorage.setItem(USER, user);
    mulai();
  }
});
$("#btnOut").addEventListener("click", () => { localStorage.removeItem(USER); location.reload(); });

function mulai() {
  $("#login").hidden = !!user; $("#app").hidden = !user;
  if (!user) return;
  $("#who").textContent = user;
  $("#fBio").elements.hp.value = user;
  go(load().some(d => d.akun === user) ? 3 : 1);
}

/* ---------- Navigasi ---------- */
function go(n) {
  document.querySelectorAll(".page").forEach((p, i) => p.hidden = i + 1 !== n);
  document.querySelectorAll("#steps span").forEach((s, i) => s.className = i + 1 === n ? "on" : i + 1 < n ? "done" : "");
  if (n === 3) renderHasil();
  window.scrollTo(0, 0);
}
document.addEventListener("click", e => { if (e.target.dataset.go) go(+e.target.dataset.go); });

/* ---------- Status internet ---------- */
function net() {
  const el = $("#net"), on = navigator.onLine;
  el.textContent = on ? "Online" : "Offline, data tersimpan di perangkat";
  el.className = "net " + (on ? "on" : "off");
}
addEventListener("online", net); addEventListener("offline", net); net();

/* ---------- Langkah 1 dan 2 ---------- */
$("#fBio").addEventListener("submit", e => {
  e.preventDefault();
  draft = Object.fromEntries(new FormData(e.target));
  go(2);
});

const fak = $("#fak"), prodi = $("#prodi");
fak.innerHTML = '<option value="">Pilih fakultas</option>' + Object.keys(PRODI).map(f => `<option>${f}</option>`).join("");
prodi.innerHTML = '<option value="">Pilih fakultas dulu</option>';
fak.addEventListener("change", () => {
  prodi.innerHTML = '<option value="">Pilih prodi</option>' + (PRODI[fak.value] || []).map(p => `<option>${p}</option>`).join("");
});

const hitungSkor = (nilai, pred) => Math.round((nilai * 0.9 + BONUS[pred]) * 100) / 100;

$("#fDaftar").addEventListener("submit", e => {
  e.preventDefault();
  if (!draft) return go(1);
  const f = Object.fromEntries(new FormData(e.target)), data = load();
  if (data.some(d => d.akun === user)) return go(3);
  if (data.some(d => d.nik === draft.nik)) return toast("NIK ini sudah terdaftar di akun lain.");
  const id = data.reduce((m, d) => Math.max(m, d.id), 0) + 1;
  data.push({ id, akun: user, ...draft, hp: user, fak: f.fak, prodi: f.prodi, predikat: f.predikat,
    nilai: +f.nilai, skor: hitungSkor(+f.nilai, f.predikat), ts: Date.now(), ulang: null });
  save(data);
  go(3);
});

/* ---------- Peringkat ---------- */
function peringkat() {
  const data = load(), grup = {};
  data.forEach(d => (grup[d.prodi] = grup[d.prodi] || []).push(d));
  Object.values(grup).forEach(arr => {
    arr.sort((a, b) => b.skor - a.skor || a.ts - b.ts);
    arr.forEach((d, i) => { d.rank = i + 1; d.status = i < KUOTA ? "Lulus" : "Tidak lulus"; });
  });
  const all = [...data].sort((a, b) => b.skor - a.skor || a.ts - b.ts);
  all.forEach((d, i) => d.rankAll = i + 1);
  return all;
}

function renderHasil() {
  const all = peringkat(), me = all.find(d => d.akun === user), box = $("#hasil");
  if (me) {
    const lulus = me.status === "Lulus";
    box.className = "hasil " + (lulus ? "lulus" : "tidak");
    box.innerHTML = `<div class="rank">Peringkat ${me.rank}</div>
      ${esc(me.nama)}, ${esc(me.prodi)}. Skor ${me.skor}. Peringkat keseluruhan ${me.rankAll} dari ${all.length} pendaftar.<br>
      <b>Status: ${me.status}</b> (kuota ${KUOTA} per prodi). Status bisa berubah saat pendaftar lain masuk.`;
    $("#btnUlang").hidden = !lulus;
    $("#btnUlang").textContent = me.ulang ? "Lihat tiket" : "Lanjut daftar ulang";
  } else {
    box.className = "hasil"; box.textContent = "Belum ada pendaftaran."; $("#btnUlang").hidden = true;
  }
  const rows = [...all].sort((a, b) => a.prodi.localeCompare(b.prodi) || a.rank - b.rank);
  $("#tabel").innerHTML = "<tr><th>Prodi</th><th>Rank</th><th>Nama</th><th>Predikat</th><th>Nilai</th><th>Skor</th><th>Status</th></tr>" +
    rows.map(d => `<tr class="${d.akun === user ? "me" : ""}"><td>${esc(d.prodi)}</td><td>${d.rank}</td><td>${esc(d.nama)}</td>
      <td>${d.predikat}</td><td>${d.nilai}</td><td>${d.skor}</td>
      <td class="${d.status === "Lulus" ? "st-L" : "st-T"}">${d.status}</td></tr>`).join("");
}

/* ---------- Excel (mendukung 100+ pendaftar) ---------- */
$("#btnExcel").addEventListener("click", () => {
  const rows = peringkat().sort((a, b) => a.prodi.localeCompare(b.prodi) || a.rank - b.rank).map(d => ({
    "Peringkat Prodi": d.rank, "Peringkat Umum": d.rankAll, "Nama": d.nama, "NIK": "'" + d.nik,
    "Fakultas": d.fak, "Program Studi": d.prodi, "Predikat": d.predikat, "Nilai": d.nilai, "Skor": d.skor,
    "Status": d.status, "Email": d.email, "No. HP": d.hp, "Asal Sekolah": d.sekolah, "Daftar Ulang": d.ulang ? "Sudah" : "Belum"
  }));
  if (!rows.length) return toast("Belum ada data untuk diunduh.");
  if (window.XLSX) {
    const ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new();
    ws["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 16) }));
    XLSX.utils.book_append_sheet(wb, ws, "Peringkat");
    XLSX.writeFile(wb, "peringkat-pmb.xlsx");
  } else { // cadangan jika CDN tidak terjangkau: CSV
    const h = Object.keys(rows[0]);
    const csv = [h.join(","), ...rows.map(r => h.map(k => `"${String(r[k]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = "peringkat-pmb.csv"; a.click();
    toast("Library Excel gagal dimuat. Periksa internet. Data diunduh sebagai CSV.");
  }
});

/* ---------- 100 data contoh ---------- */
$("#btnDemo").addEventListener("click", () => {
  const data = load(), list = Object.entries(PRODI).flatMap(([f, ps]) => ps.map(p => [f, p]));
  const preds = Object.keys(BONUS), nama = ["Andi", "Budi", "Citra", "Dewi", "Eko", "Fajar", "Gita", "Hana", "Indra", "Joko", "Kiki", "Lestari"];
  let id = data.reduce((m, d) => Math.max(m, d.id), 0);
  for (let i = 0; i < 100; i++) {
    const [f, p] = list[Math.floor(Math.random() * list.length)];
    const pr = preds[Math.floor(Math.random() * 3)], nl = Math.round((60 + Math.random() * 40) * 100) / 100;
    id++;
    data.push({ id, akun: "demo" + id, nama: `${nama[i % 12]} Contoh ${id}`, nik: String(3200000000000000 + id), tempat: "Medan",
      tgl: "2008-01-01", jk: "Laki-laki", email: `contoh${id}@mail.com`, hp: "08123456789", sekolah: "SMA Contoh", alamat: "-",
      fak: f, prodi: p, predikat: pr, nilai: nl, skor: hitungSkor(nl, pr), ts: Date.now() + i, ulang: null });
  }
  save(data); renderHasil();
  toast("100 data contoh ditambahkan.");
});

/* ---------- Daftar ulang dan tiket ---------- */
$("#btnUlang").addEventListener("click", () => {
  const me = peringkat().find(d => d.akun === user);
  if (me && me.ulang) { go(4); showTiket(me); } else { $("#tiket").hidden = $("#aksiTiket").hidden = true; go(4); }
});

$("#fUlang").addEventListener("submit", e => {
  e.preventDefault();
  const data = load(), me = peringkat().find(d => d.akun === user);
  if (!me || me.status !== "Lulus") return toast("Hanya peserta yang lulus yang bisa daftar ulang.");
  const f = Object.fromEntries(new FormData(e.target)), t = data.find(d => d.akun === user);
  t.ulang = t.ulang || { ...f, tgl: new Date().toLocaleDateString("id-ID"), no: "TKT-" + String(t.id).padStart(5, "0") };
  save(data);
  showTiket({ ...me, ulang: t.ulang });
});

const bars = s => { // barcode sederhana dari nomor tiket
  let x = 0, r = "";
  for (const c of s + s) { const k = c.charCodeAt(0), w = k % 3 + 1; r += `<rect x="${x}" width="${w}" height="40"/>`; x += w + 2 + k % 2; }
  return `<svg class="bar" viewBox="0 0 ${x} 40" preserveAspectRatio="none">${r}</svg>`;
};

function showTiket(me) {
  const u = me.ulang;
  $("#tiket").hidden = $("#aksiTiket").hidden = false;
  $("#tiket").innerHTML = `
    <div class="tkt-main">
      <div class="tkt-head"><svg class="logo"><use href="#logo"/></svg><div><b>Universitas Nusantara</b><small>Tiket daftar ulang mahasiswa baru</small></div></div>
      <h3>${esc(me.nama)}</h3><p>${esc(me.prodi)}, ${esc(me.fak)}</p>
      <dl><dt>NIK</dt><dd>${esc(me.nik)}</dd><dt>No. HP</dt><dd>${esc(me.hp)}</dd>
      <dt>Jaket</dt><dd>${u.jaket}</dd><dt>Pembayaran</dt><dd>${u.bayar}</dd><dt>Tanggal</dt><dd>${u.tgl}</dd></dl>
    </div>
    <div class="tkt-stub"><small>Nomor tiket</small><b>${u.no}</b>${bars(u.no)}<small>Peringkat ${me.rank}, skor ${me.skor}</small></div>`;
  $("#tiket").scrollIntoView({ behavior: "smooth" });
}

mulai();
