import type { UserRole } from "@/db/schema";

export interface FlowNode {
  id: string;
  title: string;
  role: UserRole;
  href: string;
  description: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  guru_wali: "Guru Wali",
  kepala_sekolah: "Kepala Sekolah",
  guru_bk: "Guru BK",
  wali_kelas: "Wali Kelas",
  guru_mapel: "Guru Mapel",
};

/** Tone warna per role — dipakai konsisten di kotak node & badge legenda. */
export const ROLE_COLORS: Record<UserRole, string> = {
  admin: "border-purple-300 bg-purple-50 text-purple-900",
  guru_wali: "border-blue-300 bg-blue-50 text-blue-900",
  kepala_sekolah: "border-red-300 bg-red-50 text-red-900",
  guru_bk: "border-emerald-300 bg-emerald-50 text-emerald-900",
  wali_kelas: "border-amber-300 bg-amber-50 text-amber-900",
  guru_mapel: "border-cyan-300 bg-cyan-50 text-cyan-900",
};

/**
 * Node flowchart — satu sumber data dipakai untuk seluruh diagram alur kerja SIGW.
 * `role` menentukan pemilik langkah (untuk warna & apakah node ini "milik" user yang sedang login),
 * `href` adalah halaman yang dibuka kalau user yang login adalah pemilik langkah ini.
 */
export const FLOW_NODES: Record<string, FlowNode> = {
  "dapodik-sync": {
    id: "dapodik-sync",
    title: "Sinkronisasi Data Dapodik",
    role: "admin",
    href: "/dashboard/admin",
    description: "Admin menarik data murid & rombongan belajar dari Web Service Dapodik sekolah lewat kartu 'Sinkronisasi Dapodik' di Panel Admin. Murid dicocokkan lewat NISN, kelas lewat ID rombel.",
  },
  "tahun-ajaran": {
    id: "tahun-ajaran",
    title: "Atur Tahun Ajaran",
    role: "admin",
    href: "/dashboard/admin",
    description: "Admin membuat & mengaktifkan tahun ajaran berjalan — hanya boleh ada 1 tahun ajaran aktif per sekolah.",
  },
  kelas: {
    id: "kelas",
    title: "Kelola Kelas",
    role: "admin",
    href: "/dashboard/admin",
    description: "Admin membuat kelas untuk tahun ajaran aktif dan (opsional) menetapkan Wali Kelas-nya.",
  },
  murid: {
    id: "murid",
    title: "Kelola Data Murid",
    role: "admin",
    href: "/dashboard/admin",
    description: "Admin mendaftarkan murid (NISN, nama, jenis kelamin, kelas) — bisa juga otomatis lewat Sinkronisasi Dapodik.",
  },
  pengguna: {
    id: "pengguna",
    title: "Buat Akun Pengguna",
    role: "admin",
    href: "/dashboard/admin",
    description: "Admin membuat akun login untuk Guru Wali, Kepala Sekolah, Guru BK, Wali Kelas, Guru Mapel, atau Admin lain, lalu membagikan email & kata sandi awalnya secara aman di luar sistem.",
  },
  penugasan: {
    id: "penugasan",
    title: "Penugasan Guru Wali (+ Unggah SK)",
    role: "admin",
    href: "/dashboard/admin",
    description: "Admin menautkan seorang Guru Wali ke murid tertentu dan mengunggah berkas SK sebagai bukti fisik — ini yang menentukan murid mana saja yang muncul di seluruh menu Guru Wali tersebut.",
  },
  "dashboard-gw": {
    id: "dashboard-gw",
    title: "Dashboard Guru Wali (EWS)",
    role: "guru_wali",
    href: "/dashboard",
    description: "Halaman pertama Guru Wali setelah login — ringkasan Early Warning System murid binaan, diurutkan dari yang paling berisiko (dihitung dari kehadiran, nilai, kedisiplinan, refleksi).",
  },
  "murid-saya": {
    id: "murid-saya",
    title: "Murid Saya (Lembar Identitas)",
    role: "guru_wali",
    href: "/dashboard/students",
    description: "Lengkapi Lembar Identitas Murid Wali per anak: data pribadi, orang tua, riwayat pendidikan & prestasi, aspirasi, karakter/sosial-emosional, dan foto.",
  },
  jurnal: {
    id: "jurnal",
    title: "Jurnal Pendampingan",
    role: "guru_wali",
    href: "/dashboard/journal",
    description: "Catat 4 jenis laporan resmi: konsultasi perwalian, kolaborasi lintas peran, bimbingan kelompok, dan kunjungan rumah (home visit).",
  },
  "smart-goals": {
    id: "smart-goals",
    title: "Target Belajar SMART",
    role: "guru_wali",
    href: "/dashboard/smart-goals",
    description: "Catat & pantau progres target belajar tiap murid dengan format SMART (Specific, Measurable, Achievable, Relevant, Time-bound).",
  },
  refleksi: {
    id: "refleksi",
    title: "Refleksi Murid Mingguan",
    role: "guru_wali",
    href: "/dashboard/reflections",
    description: "Catat refleksi mingguan murid — sistem otomatis menganalisis sentimen tulisannya sebagai bantuan deteksi dini (bukan diagnosis).",
  },
  asesmen: {
    id: "asesmen",
    title: "Instrumen Asesmen (IKEM-12)",
    role: "guru_wali",
    href: "/dashboard/psychometric",
    description: "Skrining awal kesejahteraan emosional murid lewat 12 pertanyaan terstruktur, menghasilkan kategori risiko Rendah/Sedang/Tinggi.",
  },
  "rencana-kerja": {
    id: "rencana-kerja",
    title: "Matriks Rencana Kerja",
    role: "guru_wali",
    href: "/dashboard/work-plan",
    description: "Susun rencana kerja tahunan Guru Wali — tabel kegiatan x bulan, bisa mulai dari template resmi 11 kegiatan baku.",
  },
  "ai-assistant": {
    id: "ai-assistant",
    title: "AI Assistant",
    role: "guru_wali",
    href: "/dashboard/ai-assistant",
    description: "Tanya jawab berbasis Buku Saku Guru Wali resmi — mode offline (kutipan langsung) atau mode AI penuh kalau Admin sudah mengaktifkan provider.",
  },
  "tiket-buat": {
    id: "tiket-buat",
    title: "Buat Tiket Kolaborasi",
    role: "guru_wali",
    href: "/dashboard/tickets",
    description: "Guru Wali melaporkan masalah murid (akademik/sosial/karakter). Status awal: 'Baru Dilaporkan'. Kalau ditandai 'Tidak Ada Temuan', tiket langsung selesai di sini.",
  },
  "tiket-koordinasi-walikelas": {
    id: "tiket-koordinasi-walikelas",
    title: "Koordinasi Awal dengan Wali Kelas",
    role: "wali_kelas",
    href: "/dashboard/collaboration",
    description: "Kalau ada temuan, sistem otomatis menandai Wali Kelas murid tersebut supaya mereka tahu dan bisa berkoordinasi dengan Guru Wali.",
  },
  "tiket-jalur-a": {
    id: "tiket-jalur-a",
    title: "Jalur A: Tindak Lanjut Akademik",
    role: "guru_mapel",
    href: "/dashboard/collaboration",
    description: "Kasus diklasifikasikan sebagai isu akademik — Guru Mapel terkait otomatis menjadi kolaborator dan berkoordinasi dengan Guru Wali yang melapor.",
  },
  "tiket-jalur-b": {
    id: "tiket-jalur-b",
    title: "Jalur B: Tindak Lanjut Sosial/Karakter",
    role: "guru_bk",
    href: "/dashboard/collaboration",
    description: "Kasus diklasifikasikan sebagai isu sosial/karakter — Guru BK otomatis menjadi kolaborator dan berkoordinasi dengan Guru Wali yang melapor.",
  },
  "tiket-nilai-keparahan": {
    id: "tiket-nilai-keparahan",
    title: "Nilai Tingkat Keparahan",
    role: "guru_wali",
    href: "/dashboard/tickets",
    description: "Setelah kolaborasi Jalur A/B selesai (atau setelah home visit kalau ditandai perlu), Guru Wali menilai keparahan kasus: Ringan, Sedang, atau Berat.",
  },
  "tiket-eskalasi-kepsek": {
    id: "tiket-eskalasi-kepsek",
    title: "Eskalasi ke Kepala Sekolah (kasus Berat)",
    role: "kepala_sekolah",
    href: "/dashboard/collaboration",
    description: "Kasus 'Berat' otomatis dieskalasi — hanya Kepala Sekolah yang bisa menekan 'Keputusan Kepsek Selesai', supaya Guru Wali pelapor tidak bisa 'menyetujui' eskalasinya sendiri. Setelah itu, Guru Wali melanjutkan ke tahap implementasi & evaluasi, lalu Finalisasi Laporan.",
  },
  "tiket-finalisasi": {
    id: "tiket-finalisasi",
    title: "Finalisasi Laporan",
    role: "guru_wali",
    href: "/dashboard/tickets",
    description: "Setelah tahap implementasi & evaluasi selesai (langsung untuk kasus Ringan/Sedang, atau setelah keputusan Kepsek untuk kasus Berat), Guru Wali menutup tiket lewat 'Finalisasi Laporan'.",
  },
};
