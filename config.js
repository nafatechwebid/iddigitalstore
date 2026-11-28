// Semua nilai di sini publik dan aman berada di browser.
// JANGAN pernah menaruh Midtrans Server Key, Service Role Key, atau Google API Key di file ini.
window.SKILLSTORE = {
  SUPABASE_URL: "https://sdsxrlgkdmzyltbwkoif.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkc3hybGdrZG16eWx0Yndrb2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODE3NzIsImV4cCI6MjEwNDk1Nzc3Mn0.T7eWW0YnbExFAKUHl2EuUP78p-FEIkCExlSCyftr9ds",
  MIDTRANS_CLIENT_KEY: "Mid-client-cwNJz_g3ZwCHeqXM",
  PAYMENT_MODE: "qris_manual",   // "qris_manual" = QRIS + konfirmasi admin (sementara). Ganti "midtrans" jika gateway sudah siap.
  MIDTRANS_PRODUCTION: true   // Client Key berformat Mid-client-... adalah kunci produksi (uang asli)
};
