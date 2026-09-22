import type { UserRole } from "@/db/schema";

export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] }
  | { type: "note"; text: string }
  | { type: "warning"; text: string };

export interface HelpTopic {
  id: string;
  title: string;
  blocks: ContentBlock[];
}

export interface RoleGuide {
  role: UserRole;
  label: string;
  tagline: string;
  topics: HelpTopic[];
}

const p = (text: string): ContentBlock => ({ type: "p", text });
const steps = (...items: string[]): ContentBlock => ({ type: "steps", items });
const list = (...items: string[]): ContentBlock => ({ type: "list", items });
const note = (text: string): ContentBlock => ({ type: "note", text });
const warning = (text: string): ContentBlock => ({ type: "warning", text });

export const ROLE_GUIDES: RoleGuide[] = [
  {
    role: "guru_wali",
    label: "Guru Wali",
    tagline: "Pendamping individual 15–25 murid dari masuk sampai lulus — bukan Guru BK, bukan Wali Kelas.",
    topics: [
      {
        id: "mulai",
        title: "Mulai di Sini",
        blocks: [
          p(
            "Sebagai Guru Wali, Anda mendampingi sekelompok murid secara pribadi sepanjang masa sekolah mereka — mirip dosen pembimbing akademik. Menu di bagian atas layar adalah alat bantu Anda sehari-hari.",
          ),
          list(
            "Dashboard — lihat murid mana yang perlu perhatian lebih dulu (Early Warning System).",
            "Murid Saya — lengkapi Lembar Identitas tiap murid binaan (data pribadi, orang tua, riwayat pendidikan, prestasi, aspirasi, karakter) dan unggah fotonya.",
            "Tiket Kolaborasi — laporkan masalah murid dan ikuti alur penanganannya sampai selesai.",
            "Target SMART — catat dan pantau target belajar tiap murid.",
            "Jurnal — catat setiap konsultasi, kolaborasi, bimbingan kelompok, dan kunjungan rumah.",
            "Refleksi Murid — catat refleksi mingguan murid.",
            "Instrumen Asesmen — skrining kesejahteraan emosional murid secara terstruktur.",
            "Matriks Rencana Kerja — susun rencana kerja tahunan Anda sebagai Guru Wali.",
            "AI Assistant — tanya jawab berbasis Buku Saku Guru Wali.",
          ),
          note(
            "Semua menu di atas hanya menampilkan murid binaan AKTIF Anda — sistem otomatis mencegah Anda mengisi data untuk murid yang bukan binaan Anda.",
          ),
        ],
      },
      {
        id: "dashboard",
        title: "Dashboard & Early Warning System (EWS)",
        blocks: [
          p(
            "Dashboard adalah halaman pertama yang Anda lihat setelah login. Isinya ringkasan otomatis kondisi seluruh murid binaan Anda, dihitung dari data kehadiran, nilai, kedisiplinan, dan refleksi mingguan.",
          ),
          steps(
            "4 kartu di bagian atas: total murid binaan, jumlah murid yang perlu perhatian, rata-rata kehadiran, dan jumlah tiket kolaborasi yang masih berjalan.",
            "Panel 'Early Warning System' (kiri): daftar murid diurutkan dari yang paling berisiko. Setiap baris punya badge warna — hijau (Aman), kuning (Waspada), merah (Berisiko Tinggi) — dan garis kecil (sparkline) yang menunjukkan apakah skor risikonya naik atau turun dari beberapa hari terakhir.",
            "Di bawah badge, ada daftar 'faktor penyebab' kalau skor risikonya tinggi, misalnya 'Kehadiran rendah' atau 'Nilai akademik menurun' — ini membantu Anda tahu harus mulai dari mana.",
            "Panel 'Progres Target Belajar SMART' (kanan): grafik batang progres semua target SMART murid binaan Anda.",
            "Tabel 'Daftar Murid Binaan' di bawah: ringkasan cepat semua murid dalam satu tabel.",
          ),
          note(
            "Skor risiko dihitung otomatis dan diperbarui setiap kali Anda membuka Dashboard — Anda tidak perlu menghitung atau mengisi apa pun secara manual. Angka ini adalah alat bantu prioritas, bukan penilaian akhir — tetap gunakan penilaian Anda sendiri sebagai Guru Wali.",
          ),
          note(
            "Data kehadiran & nilai berasal dari rekap Excel yang diunggah Admin (absensi kertas & leger guru mapel — Dapodik belum menyediakan keduanya) — kalau angkanya terasa belum sesuai kondisi terkini, kemungkinan rekap terbarunya belum diunggah, bukan murid tersebut yang salah data.",
          ),
        ],
      },
      {
        id: "murid-saya",
        title: "Murid Saya (Lembar Identitas Murid Wali)",
        blocks: [
          p(
            "Menu 'Murid Saya' menampilkan daftar murid binaan aktif Anda. Klik nama murid untuk membuka Lembar Identitas lengkapnya — satu halaman berisi 5 bagian, supaya pendampingan Anda tidak bersifat umum, melainkan personal per anak.",
          ),
          list(
            "A. Identitas Dasar — nama panggilan, tempat/tanggal lahir, agama, alamat, anak ke-berapa, no. HP, media sosial, riwayat penyakit kronis. Sebagian data ini sudah terisi otomatis dari Dapodik, sisanya Anda lengkapi manual.",
            "B. Identitas Orang Tua/Wali — data ayah, ibu, dan/atau wali.",
            "C. Riwayat Pendidikan & Prestasi — asal sekolah (TK/SD/SMP) dan daftar prestasi akademik/non-akademik, bisa tambah baris sebanyak yang dibutuhkan.",
            "D. Aspirasi Studi Lanjut & Karier — cita-cita, mapel favorit/lemah, hobi, skill yang sudah/ingin dikuasai, hambatan yang dihadapi murid.",
            "E. Karakter & Sosial-Emosional — catatan kedisiplinan, empati, regulasi emosi, dan refleksi diri murid.",
            "Foto Murid — unggah foto (JPG/PNG/WEBP, maks 10MB) di bagian atas halaman.",
          ),
          note(
            "Setiap bagian punya tombol simpan sendiri-sendiri — mengisi bagian D tidak akan menghapus data yang sudah Anda isi di bagian E (atau sebaliknya). Anda bisa mengisi bertahap, tidak harus sekaligus.",
          ),
        ],
      },
      {
        id: "tiket",
        title: "Tiket Kolaborasi (SOP Penanganan Masalah)",
        blocks: [
          p(
            "Kalau Anda menemukan masalah pada seorang murid (akademik, sosial, karakter, dll.), buat Tiket dari menu 'Tiket Kolaborasi'. Tiket ini akan memandu Anda mengikuti SOP resmi langkah demi langkah, dan otomatis melibatkan pihak lain yang relevan (Wali Kelas, Guru Mapel, Guru BK, atau Kepala Sekolah) di waktu yang tepat.",
          ),
          steps(
            "Klik 'Buat Tiket Baru', pilih murid, isi judul singkat dan deskripsi masalahnya, lalu simpan. Status awal tiket adalah 'Baru Dilaporkan'.",
            "Tandai 'Ada Temuan Khusus' atau 'Tidak Ada Temuan'. Kalau tidak ada temuan, tiket langsung selesai.",
            "Kalau ada temuan, tiket masuk 'Koordinasi Awal dgn Wali Kelas' — sistem otomatis menandai Wali Kelas murid tersebut supaya mereka tahu.",
            "Klasifikasikan masalahnya: 'Jalur A: Isu Akademik' (melibatkan Guru Mapel) atau 'Jalur B: Isu Sosial/Karakter' (melibatkan Guru BK).",
            "Setelah kolaborasi Jalur A/B selesai, klik 'Selesai Kolaborasi' — atau 'Selesai + Perlu Home Visit' kalau menurut Anda keluarga murid perlu dikunjungi langsung.",
            "Nilai tingkat keparahan: Ringan, Sedang, atau Berat. Kalau 'Berat', tiket otomatis dieskalasi ke Kepala Sekolah dan Andalah yang menunggu keputusan beliau — Anda TIDAK bisa melanjutkan sendiri.",
            "Setelah tahap implementasi & evaluasi selesai, klik 'Finalisasi Laporan' untuk menutup tiket.",
          ),
          warning(
            "Kalau Anda menandai 'Selesai + Perlu Home Visit', sistem akan MEMBLOKIR Anda dari menilai tingkat keparahan sampai Anda benar-benar mengisi Laporan Kunjungan Rumah (menu Jurnal) untuk tiket tersebut. Akan muncul link langsung ke formulirnya di kartu tiket.",
          ),
          note(
            "Untuk kasus Berat yang dieskalasi, hanya Kepala Sekolah yang bisa mengklik 'Keputusan Kepsek Selesai' — ini sengaja dibuat begitu supaya Anda tidak bisa 'menyetujui' eskalasi Anda sendiri.",
          ),
        ],
      },
      {
        id: "smart-goals",
        title: "Target Belajar SMART",
        blocks: [
          p("Gunakan menu ini untuk mencatat target belajar setiap murid dengan format SMART (Specific, Measurable, Achievable, Relevant, Time-bound) dan memantau progresnya dari waktu ke waktu."),
          steps(
            "Buat target baru: pilih murid, isi judul, deskripsi spesifik, target terukur, dan tenggat waktu.",
            "Perbarui progres (0–100%) kapan saja lewat slider/input progres pada kartu target — setiap perubahan otomatis tercatat sebagai riwayat check-in.",
            "Target yang mencapai 100% otomatis berubah status menjadi 'Tercapai'.",
          ),
        ],
      },
      {
        id: "jurnal",
        title: "Jurnal Pendampingan (4 Jenis Laporan)",
        blocks: [
          p("Halaman Jurnal berisi 4 formulir laporan resmi sesuai Jurnal Guru Wali cetak — semuanya di satu halaman yang sama."),
          list(
            "7. Laporan Pelaksanaan Konsultasi Perwalian — catat setiap konsultasi individual dengan murid.",
            "8. Laporan Kolaborasi dengan Guru BK, Wali Kelas, Guru Mapel — dokumentasikan kolaborasi lintas peran.",
            "9. Laporan Pelaksanaan Bimbingan Kelompok — sesi bimbingan untuk beberapa murid sekaligus (pilih semua peserta).",
            "10. Laporan Pelaksanaan Kunjungan Rumah (Home Visit) — kunjungan ke rumah murid. Kalau laporan ini terkait sebuah tiket yang menandai Home Visit wajib, pilih tiketnya di dropdown 'Terkait Tiket Kolaborasi' supaya tiketnya bisa lanjut.",
          ),
        ],
      },
      {
        id: "refleksi",
        title: "Refleksi Murid Mingguan",
        blocks: [
          p("Catat apa yang murid rasakan/alami setiap minggu — bisa Anda isi sendiri berdasarkan obrolan dengan murid, atau berdasarkan tulisan murid."),
          steps(
            "Pilih murid, tanggal awal minggu, dan skala suasana hati (1 = buruk, 5 = sangat baik).",
            "Tulis isi refleksinya di kolom teks.",
            "Klik 'Simpan Refleksi' — sistem otomatis menganalisis sentimen tulisan tersebut (positif/negatif) di belakang layar.",
          ),
          note(
            "Analisis sentimen ini adalah bantuan deteksi dini, BUKAN diagnosis psikologis. Kalau ada kata-kata yang mengindikasikan tekanan berat, sistem akan menandainya sebagai perlu perhatian — tapi keputusan tindak lanjut tetap ada di tangan Anda (dan bila perlu, Guru BK).",
          ),
        ],
      },
      {
        id: "psikometrik",
        title: "Instrumen Asesmen Diagnostik (IKEM-12)",
        blocks: [
          p(
            "IKEM-12 adalah 12 pertanyaan singkat (skala 1–4: Tidak Pernah / Kadang-kadang / Sering / Selalu) yang mengelompokkan kondisi murid ke 3 area: Emosi & Suasana Hati, Relasi Sosial, dan Fungsi Akademik & Keseharian.",
          ),
          steps(
            "Pilih murid dan tanggal pengisian.",
            "Jawab semua 12 pertanyaan berdasarkan observasi/obrolan Anda dengan murid tersebut.",
            "Tambahkan catatan tambahan kalau perlu, lalu klik 'Simpan Hasil Asesmen'.",
            "Sistem otomatis menghitung skor dan kategori risiko (Rendah / Sedang / Tinggi), lengkap dengan rincian per area.",
          ),
          warning(
            "IKEM-12 adalah instrumen SKRINING AWAL buatan internal untuk membantu Anda memprioritaskan tindak lanjut — BUKAN alat diagnostik klinis (bukan tes psikologi resmi). Hasil 'Tinggi' berarti perlu didiskusikan lebih lanjut, misalnya dengan Guru BK — bukan kesimpulan akhir.",
          ),
        ],
      },
      {
        id: "rencana-kerja",
        title: "Matriks Rencana Kerja",
        blocks: [
          p(
            "Menu 'Matriks Rencana Kerja' adalah rencana kerja tahunan Anda sebagai Guru Wali — tabel kegiatan dikelompokkan ke 3 tahap (Persiapan, Pelaksanaan, Evaluasi) dengan kolom bulan Juli-Juni untuk menandai kapan tiap kegiatan direncanakan.",
          ),
          steps(
            "Kalau belum ada kegiatan, klik 'Pakai Template Resmi' untuk mengisi 11 kegiatan baku sekali sebagai titik awal — Anda tetap bebas menambah atau menghapus kegiatan setelahnya.",
            "Untuk kegiatan tambahan, isi nama kegiatan, kategori (Persiapan/Pelaksanaan/Evaluasi), bulan-bulan rencananya, dan jenis bukti pelaksanaannya, lalu simpan.",
            "Hapus baris kegiatan yang sudah tidak relevan lewat tombol hapus di baris tersebut.",
          ),
          note("Tombol 'Pakai Template Resmi' hanya bisa dipakai sekali selama belum ada kegiatan tersimpan — kalau ingin mulai ulang dari template, hapus dulu semua kegiatan yang ada."),
        ],
      },
      {
        id: "ai-assistant",
        title: "AI Assistant",
        blocks: [
          p("Tanyakan apa saja seputar peran dan teknik pendampingan Guru Wali — jawabannya diambil dari Buku Saku Guru Wali resmi."),
          steps(
            "Ketik pertanyaan Anda di kolom yang tersedia, lalu kirim.",
            "Sistem mencari bagian Buku Saku yang paling relevan, lalu menyusun jawaban dari situ.",
            "Riwayat tanya-jawab Anda tersimpan dan bisa dilihat lagi di bagian bawah halaman.",
          ),
          note(
            "Ada dua mode: 'Lokal (offline)' — menampilkan kutipan paling relevan langsung, selalu tersedia tanpa biaya apa pun; atau mode AI penuh kalau Admin sekolah sudah mengaktifkan provider AI (lihat halaman Panduan untuk Admin). Mode yang sedang aktif tertulis di bagian atas halaman AI Assistant.",
          ),
        ],
      },
    ],
  },
  {
    role: "kepala_sekolah",
    label: "Kepala Sekolah",
    tagline: "Pengambil keputusan untuk kasus berat yang dieskalasi Guru Wali.",
    topics: [
      {
        id: "peran",
        title: "Peran Anda di SIGW",
        blocks: [
          p(
            "Anda hanya dilibatkan sistem pada satu titik krusial: ketika seorang Guru Wali menilai kasus murid sebagai 'Berat' dan mengeskalasikannya. Anda tidak perlu memantau seluruh aktivitas Guru Wali sehari-hari — sistem hanya akan menampilkan kasus yang benar-benar butuh keputusan Anda.",
          ),
          note(
            "Setelah login, Anda mendarat di halaman 'Dashboard' — ringkasan jumlah tiket yang menunggu keputusan Anda, riwayat eskalasi, dan kondisi risiko murid se-sekolah. Menu 'Tiket Kolaborasi' berisi daftar kasusnya satu per satu untuk ditindaklanjuti.",
          ),
        ],
      },
      {
        id: "eskalasi",
        title: "Menangani Tiket yang Dieskalasi",
        blocks: [
          steps(
            "Buka menu 'Tiket Kolaborasi'. Bagian 'Perlu Tindak Lanjut' berisi kasus yang menunggu keputusan Anda.",
            "Baca judul, deskripsi masalah, dan murid yang terlibat pada setiap kartu tiket.",
            "Kalau sudah menentukan sikap/tindak lanjutnya, klik tombol 'Keputusan Kepsek Selesai' — tiket akan lanjut ke tahap implementasi oleh Guru Wali.",
            "Kasus yang sudah Anda selesaikan bisa dilihat lagi di bagian 'Riwayat Selesai'.",
          ),
          note(
            "Hanya Anda (Kepala Sekolah di sekolah yang sama) yang bisa menekan tombol keputusan ini — Guru Wali yang melaporkan kasusnya sendiri tidak bisa melewati langkah ini, sesuai desain SOP.",
          ),
        ],
      },
    ],
  },
  {
    role: "guru_bk",
    label: "Guru BK",
    tagline: "Kolaborator untuk kasus sosial/karakter (Jalur B) yang dilaporkan Guru Wali.",
    topics: [
      {
        id: "peran",
        title: "Peran Anda di SIGW",
        blocks: [
          p(
            "Ketika Guru Wali mengklasifikasikan sebuah tiket sebagai 'Jalur B: Isu Sosial/Karakter', sistem otomatis menandai Anda sebagai kolaborator. Anda akan melihat tiket tersebut muncul di halaman Anda tanpa perlu diberi tahu manual.",
          ),
          note("Menu 'Dashboard' menampilkan ringkasan jumlah kasus yang perlu tindak lanjut, sudah selesai, dan distribusi tingkat keparahannya — tanpa perlu membuka daftar tiket satu per satu untuk tahu beban kerja Anda saat ini."),
        ],
      },
      {
        id: "tiket",
        title: "Menindaklanjuti Tiket Jalur B",
        blocks: [
          steps(
            "Buka menu 'Tiket Kolaborasi'. Bagian 'Perlu Tindak Lanjut' menampilkan kasus yang ditugaskan ke Anda.",
            "Baca detail masalahnya, lalu koordinasikan penanganan dengan Guru Wali yang melaporkan (di luar sistem — lewat pertemuan, chat, dsb).",
            "Anda bisa memantau status tiket dari sini, tapi perubahan status/aksi SOP dilakukan oleh Guru Wali sebagai penanggung jawab kasus (case manager).",
            "Kasus yang sudah selesai ditangani akan pindah ke bagian 'Riwayat Selesai'.",
          ),
        ],
      },
    ],
  },
  {
    role: "wali_kelas",
    label: "Wali Kelas",
    tagline: "Bukan Guru Wali — Wali Kelas mengurus administrasi & koordinasi tingkat kelas.",
    topics: [
      {
        id: "peran",
        title: "Peran Anda (dan bedanya dengan Guru Wali)",
        blocks: [
          p(
            "Wali Kelas berbeda dari Guru Wali. Wali Kelas bertanggung jawab pada satu KELAS secara administratif, sementara Guru Wali mendampingi murid secara individual lintas kelas dan lintas tahun. Di SIGW, Wali Kelas dilibatkan otomatis sebagai kolaborator setiap kali ada tiket murid di kelasnya yang baru dilaporkan, atau yang diklasifikasikan Jalur A (akademik).",
          ),
          note("Menu 'Dashboard' menampilkan ringkasan kelas yang Anda pegang: jumlah murid, distribusi risiko EWS per murid di kelas itu, dan jumlah tiket kolaborasi yang sedang aktif."),
        ],
      },
      {
        id: "tiket",
        title: "Menindaklanjuti Tiket",
        blocks: [
          steps(
            "Buka menu 'Tiket Kolaborasi' — Anda akan melihat tiket murid di kelas Anda yang sedang berjalan.",
            "Bagian 'Perlu Tindak Lanjut' untuk kasus yang masih aktif, 'Riwayat Selesai' untuk yang sudah tuntas.",
            "Koordinasikan dengan Guru Wali murid tersebut untuk penanganan lebih lanjut.",
          ),
        ],
      },
    ],
  },
  {
    role: "guru_mapel",
    label: "Guru Mapel",
    tagline: "Kolaborator untuk kasus akademik (Jalur A) yang dilaporkan Guru Wali.",
    topics: [
      {
        id: "peran",
        title: "Peran Anda di SIGW",
        blocks: [
          p(
            "Ketika Guru Wali mengklasifikasikan sebuah tiket sebagai 'Jalur A: Isu Akademik', sistem otomatis menandai Anda sebagai kolaborator bersama Wali Kelas murid tersebut.",
          ),
          note("Menu 'Dashboard' menampilkan ringkasan jumlah kasus yang perlu tindak lanjut, sudah selesai, dan distribusi tingkat keparahannya — tanpa perlu membuka daftar tiket satu per satu untuk tahu beban kerja Anda saat ini."),
        ],
      },
      {
        id: "tiket",
        title: "Menindaklanjuti Tiket Jalur A",
        blocks: [
          steps(
            "Buka menu 'Tiket Kolaborasi' untuk melihat kasus akademik yang ditugaskan ke Anda.",
            "Koordinasikan dengan Guru Wali yang melaporkan mengenai kondisi akademik murid di mata pelajaran Anda.",
            "Pantau status tiket sampai berpindah ke 'Riwayat Selesai'.",
          ),
        ],
      },
    ],
  },
  {
    role: "admin",
    label: "Admin",
    tagline: "Pengelola data induk sekolah: tahun ajaran, kelas, murid, pengguna, dan penugasan.",
    topics: [
      {
        id: "peran",
        title: "Peran Anda di SIGW",
        blocks: [
          p(
            "Anda mengelola seluruh data dasar yang dipakai peran lain — tanpa data ini, Guru Wali dan role lain tidak bisa mulai bekerja. Semua menu Admin ada dalam satu halaman 'Panel Admin', dibagi jadi beberapa kartu.",
          ),
          note(
            "Menu 'Dashboard' (terpisah dari 'Panel Admin') menampilkan ringkasan statistik sekolah: total murid & kelas, cakupan penugasan Guru Wali, distribusi risiko EWS seluruh murid, ringkasan tiket kolaborasi, serta status sinkronisasi Dapodik dan AI Assistant — gunakan ini untuk memantau kondisi sekolah secara sekilas, sebelum masuk ke 'Panel Admin' untuk mengelola data.",
          ),
        ],
      },
      {
        id: "tahun-ajaran",
        title: "Tahun Ajaran",
        blocks: [
          p("Buat tahun ajaran baru (contoh format nama: '2027/2028') beserta tanggal mulai dan selesainya."),
          note("Menandai satu tahun ajaran sebagai 'aktif' otomatis menonaktifkan tahun ajaran lain — hanya boleh ada 1 yang aktif per sekolah."),
        ],
      },
      {
        id: "kelas",
        title: "Kelas",
        blocks: [
          steps(
            "Pilih tahun ajaran, isi nama kelas (contoh: 'VIII-C'), dan opsional tetapkan Wali Kelas-nya.",
            "Daftar kelas yang sudah ada tampil di bawah formulir.",
          ),
        ],
      },
      {
        id: "murid",
        title: "Murid",
        blocks: [
          steps("Isi NISN, nama lengkap, jenis kelamin, dan kelas (opsional) untuk mendaftarkan murid baru ke sistem."),
          note(
            "Anda juga bisa membuka menu 'Murid Saya' untuk melihat/melengkapi Lembar Identitas Murid Wali (data pribadi, orang tua, riwayat pendidikan, prestasi, aspirasi, karakter) dan foto murid mana pun di sekolah Anda — bukan hanya Guru Wali yang bisa mengisinya.",
          ),
        ],
      },
      {
        id: "pengguna",
        title: "Pengguna",
        blocks: [
          p("Buat akun login untuk semua peran — Guru Wali, Kepala Sekolah, Guru BK, Wali Kelas, Guru Mapel, atau Admin lain."),
          steps(
            "Isi nama, email, kata sandi awal (minimal 8 karakter), dan pilih peran.",
            "Sistem menolak email yang sudah terdaftar.",
            "Sampaikan email dan kata sandi awal ke pengguna yang bersangkutan secara aman di luar sistem.",
          ),
        ],
      },
      {
        id: "penugasan",
        title: "Penugasan Guru Wali",
        blocks: [
          p("Menautkan seorang Guru Wali ke murid tertentu — ini yang menentukan murid mana saja yang muncul di semua menu Guru Wali tersebut."),
          steps(
            "Pilih Guru Wali dan murid, isi tanggal mulai berlaku dan nomor SK (opsional).",
            "Unggah berkas SK Guru Wali (PDF/JPG/PNG/WEBP, maks 10MB) lewat tombol 'Unggah SK' di baris penugasan — ini bukti fisik yang diwajibkan Kepmendikdasmen 221/P/2025. Klik 'Ganti' untuk mengganti berkas yang sudah diunggah.",
            "Klik 'Akhiri' pada penugasan yang sudah tidak berlaku (misalnya murid pindah Guru Wali) — murid tersebut baru bisa ditugaskan ke Guru Wali lain setelah penugasan lamanya diakhiri.",
          ),
          warning("Satu murid hanya boleh punya satu Guru Wali AKTIF pada satu waktu."),
        ],
      },
      {
        id: "kehadiran-nilai",
        title: "Data Kehadiran & Nilai (untuk EWS)",
        blocks: [
          p(
            "Early Warning System butuh data kehadiran dan tren nilai murid (35% + 30% dari skor risiko — komponen terbesar), tapi Dapodik TIDAK menyediakan keduanya lewat webservice-nya. Selama absensi masih dicatat manual di kertas dan nilai ada di leger guru mapel, kedua data ini masuk ke SIGW lewat import Excel.",
          ),
          steps(
            "Unduh 'Template' pada bagian Rekap Kehadiran atau Import Nilai — sheet 'Referensi Murid' di dalamnya berisi NISN murid aktif terkini, dropdown NISN di sheet 'Import' mengacu ke situ (kolom Nama terisi otomatis untuk verifikasi).",
            "Isi Rekap Kehadiran: 1 baris = kehadiran 1 murid pada 1 tanggal (Hadir/Sakit/Izin/Alpa). Bisa diisi bertahap per minggu/bulan, tidak harus sekaligus.",
            "Isi Import Nilai: 1 baris = 1 nilai untuk 1 murid, 1 mata pelajaran, 1 periode (mis. \"2026-gasal-uas\").",
            "Unggah file yang sudah diisi lewat tombol 'Import' — hasilnya langsung terlihat per baris (dicatat/diganti/gagal beserta alasannya).",
          ),
          note(
            "Upload ulang untuk kombinasi yang sama (murid+tanggal untuk kehadiran, atau murid+mapel+periode untuk nilai) akan MENGGANTI data lama, bukan menduplikasi — aman dipakai untuk koreksi.",
          ),
        ],
      },
      {
        id: "ai-config",
        title: "Konfigurasi AI Assistant",
        blocks: [
          p(
            "AI Assistant (menu Guru Wali) bisa berjalan tanpa biaya sama sekali (mode offline), atau ditingkatkan dengan menyambungkan ke penyedia AI eksternal supaya jawabannya lebih pintar.",
          ),
          steps(
            "Pilih provider: OpenAI, OpenRouter, Google Gemini, atau Custom (untuk penyedia lain yang kompatibel format OpenAI).",
            "Masukkan API key dari penyedia yang dipilih (Anda harus sudah punya akun & key-nya sendiri).",
            "Untuk provider Custom, Base URL wajib diisi.",
            "Klik 'Simpan & Aktifkan Provider Ini' — provider langsung aktif untuk seluruh Guru Wali di sekolah Anda.",
          ),
          note(
            "Default sistem selalu offline. Anda bisa menonaktifkan provider kapan saja lewat tombol 'Nonaktifkan, kembali ke mode offline' tanpa kehilangan konfigurasi yang tersimpan — tinggal 'Aktifkan' lagi nanti. API key tidak pernah ditampilkan utuh lagi setelah disimpan (demi keamanan).",
          ),
        ],
      },
    ],
  },
];
