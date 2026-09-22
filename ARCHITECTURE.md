# SIGW — Sistem Informasi Guru Wali

> Digitalisasi peran **Guru Wali** sesuai **Permendikdasmen No. 11 Tahun 2025**, dibangun dengan pendekatan **STEM** (Science, Technology, Engineering, Mathematics).

**Status: sistem ini SUDAH DIIMPLEMENTASIKAN**, bukan sekadar rancangan di atas kertas. Dokumen ini menjelaskan arsitektur yang benar-benar berjalan di kode saat ini (`src/`), agar developer baru bisa langsung melanjutkan tanpa perlu membaca ulang seluruh codebase dari nol. Jika ada bagian dokumen ini yang menyimpang dari kode, **kode adalah sumber kebenaran** — perbarui dokumen ini saat itu terjadi.

---

## 1. Ringkasan Domain

Guru Wali **bukan** Guru BK dan **bukan** Wali Kelas. Guru Wali mendampingi 15–25 murid secara individual dari masuk hingga lulus, seperti "Dosen Pembimbing Akademik". Empat pilar administrasi yang didigitalkan:

| Pilar | Dokumen fisik asli (`referensi/`) | Entitas digital |
|---|---|---|
| Identitas & profil murid | `3. Lembar Identitas Murid Wali.docx` | `students`, `student_guardians`, `student_profiles`, `student_academic_history`, `student_achievements` |
| Jurnal pendampingan | `7.` Konsultasi Perwalian, `8.` Kolaborasi, `9.` Bimbingan Kelompok, `10.` Home Visit | `consultation_logs`, `collaboration_logs`, `group_guidance_sessions(+participants)`, `home_visits` |
| Refleksi & target murid | Lembar Refleksi Mingguan, Target SMART | `weekly_reflections`, `smart_goals(+checkins)` |
| SOP Kolaborasi / eskalasi | `6.` Mekanisme Kolaborasi (SOP) + `6b.` Diagram Alir | `tickets`, `ticket_events`, `ticket_collaborators` (state machine) |
| Rencana kerja tahunan | `5. Matriks Rencana Kerja.xlsx` | `work_plan_items` |

Skema database (`src/db/schema.ts`) dirancang **1:1 terhadap dokumen fisik** di atas — ini disengaja, supaya guru wali yang familiar dengan perangkat cetak tidak asing dengan sistemnya.

---

## 2. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 16** (App Router, React 19) | Server Components + Server Actions menghilangkan kebutuhan REST/GraphQL API terpisah untuk CRUD internal; cocok untuk tim kecil, deploy cepat (Vercel/self-host). |
| Bahasa | **TypeScript** (strict) | Skema DB, tipe state machine tiket, dan props UI semuanya type-safe end-to-end lewat inferensi Drizzle. |
| Styling/UI | **Tailwind CSS v4** + primitive native (`src/components/ui/`) + `class-variance-authority` | Elemen native (`<input>`/`<select>`/`<button>`) yang di-styling lewat `cva`, BUKAN Radix — dependensi `@radix-ui/*` sempat ter-install (sisa scaffold awal) tapi nol pemakaian di `src/`, dihapus 2026-09-22. Cukup untuk kebutuhan proyek (tanpa modal/dropdown kompleks) dan otomatis dapat keyboard/screen-reader native browser tanpa dependensi tambahan. |
| Database | **PostgreSQL + pgvector** | Data relasional pendidikan (murid, nilai, kehadiran) butuh integritas relasional kuat; `pgvector` memungkinkan RAG (retrieval semantik) tanpa vector DB terpisah — mengurangi jumlah moving parts infrastruktur. |
| ORM | **Drizzle ORM + drizzle-kit** | Query builder type-safe, migrasi SQL eksplisit (bukan magic), ringan (tanpa runtime codegen besar seperti Prisma). |
| Auth | **NextAuth v5 (Credentials + JWT)** | Role-based access (`user_role` enum: admin, kepala_sekolah, guru_wali, guru_bk, wali_kelas, guru_mapel) dicantumkan di JWT/session, dicek di `middleware.ts` (edge) dan di setiap Server Action. |
| Charts | **Recharts** + SVG sparkline custom | Grafik progres SMART Goals & tren EWS di dashboard. |
| Validasi | **Zod** | Validasi input form/Server Action. |
| Password | **bcryptjs** | Hashing password (kompatibel Edge runtime tanpa native binding). |
| AI/RAG | **OpenAI API (opsional) + fallback lokal** | Lihat §5.2 — sistem tetap 100% fungsional tanpa API key (mode offline), naik kualitas otomatis begitu `OPENAI_API_KEY` diset. |
| Penjadwalan | **Vercel Cron** (atau cron/systemd timer manapun) → HTTP endpoint | Lihat §5.4 dan `vercel.json` — job EWS batch dipicu lewat request HTTP terautentikasi, bukan proses long-running terpisah. |
| Package manager | **bun** | Lockfile `bun.lock`, script `bun run dev/db:migrate/db:seed/...`, test runner bawaan (`bun test`, tanpa dependensi tambahan). |
| Excel | **exceljs** | Generate template & parse import Penugasan Guru Wali (§5.5/§7.2) — dropdown data-validation & formula VLOOKUP di sisi Excel butuh library yang bisa tulis fitur Excel asli, bukan sekadar dump tabel CSV. |

**Kenapa bukan microservices / Python ML service terpisah?** Untuk skala satu sekolah–yayasan (ratusan hingga low-ribuan murid), monolith Next.js + Postgres jauh lebih murah dioperasikan dan di-debug. NLP sentimen (§5.1), skoring psikometrik (§5.1), dan EWS (§5.4) adalah fungsi murni TypeScript (`src/lib/*.ts`) — cukup cepat untuk dijalankan sinkron di request, tidak butuh job queue terpisah di tahap ini.

---

## 3. Struktur Proyek

```
app/
├── src/
│   ├── app/
│   │   ├── login/page.tsx              # halaman login (Credentials)
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── cron/ews-snapshot/route.ts  # §5.4 endpoint terjadwal (Vercel Cron)
│   │   │   ├── cron/dapodik-sync/route.ts  # §5.5 endpoint terjadwal sinkronisasi Dapodik (Vercel Cron)
│   │   │   ├── admin/guru-wali-template/route.ts  # §7.2 generate template Excel import Guru Wali
│   │   │   └── files/                  # §7.0c penyajian berkas ber-otorisasi (SK Guru Wali, foto murid) — BUKAN public/
│   │   └── dashboard/
│   │       ├── layout.tsx              # shell dashboard (nav ROLE-AWARE, sign-out)
│   │       ├── page.tsx                # Dashboard Guru Wali (EWS + tren + SMART goals); redirect otomatis utk role lain
│   │       ├── students/page.tsx       # §7.0b daftar murid binaan -> [id]/page.tsx Lembar Identitas Murid Wali lengkap
│   │       ├── work-plan/page.tsx      # §7.0b Matriks Rencana Kerja
│   │       ├── change-password/page.tsx # §5.5/§8 ganti password wajib (akun hasil auto-provisioning Dapodik)
│   │       ├── collaboration/page.tsx  # §7.1 — Kepala Sekolah/Guru BK/Wali Kelas/Guru Mapel
│   │       ├── admin/page.tsx          # §7.2 — panel Admin (CRUD data master)
│   │       ├── psychometric/page.tsx   # §5.1 — instrumen asesmen diagnostik
│   │       ├── journal/page.tsx        # 4 jenis jurnal pendampingan
│   │       ├── reflections/page.tsx    # Lembar Refleksi Mingguan Murid
│   │       ├── smart-goals/page.tsx    # Target SMART
│   │       ├── tickets/page.tsx        # Tiket SOP Kolaborasi (Guru Wali sbg case manager)
│   │       ├── ai-assistant/page.tsx   # AI Assistant (RAG)
│   │       ├── flow/page.tsx           # §7.4 — Alur Kerja (flowchart interaktif), semua role
│   │       └── help/page.tsx           # §7.3 — Panduan Pengguna, semua role
│   ├── components/
│   │   ├── dashboard/                  # form-form + guru-wali-dashboard.tsx, risk-trend-sparkline.tsx
│   │   │   ├── admin/                  # form-form khusus panel Admin
│   │   │   ├── flow/                   # §7.4 konten & UI Alur Kerja (flow-content.ts, flow-chart.tsx)
│   │   │   └── help/                   # §7.3 konten & UI Panduan Pengguna (help-content.ts, help-center.tsx)
│   │   └── ui/                         # §7.5 primitives (badge, button, card, progress, input, textarea, select, checkbox, label, field)
│   ├── lib/
│   │   ├── actions/                    # Server Actions ("use server") — satu file per domain
│   │   │   ├── guards.ts               # §8 primitif otorisasi bersama (isOwnActiveStudent, dst.) — BUKAN "use server"
│   │   │   ├── ai-config.ts            # §5.2/§7.2 CRUD konfigurasi provider AI (admin-only)
│   │   │   ├── dapodik.ts              # §5.5/§7.2 CRUD konfigurasi + trigger sync Dapodik (admin-only)
│   │   │   ├── guru-wali-import.ts     # §7.2 import massal Penugasan Guru Wali dari Excel (admin-only)
│   │   │   ├── student-profile.ts      # §7.0b Lembar Identitas Murid Wali A-E + foto (guru_wali/admin)
│   │   │   └── work-plan.ts            # §7.0b Matriks Rencana Kerja (guru_wali-only)
│   │   ├── jobs/
│   │   │   ├── ews-snapshot-job.ts     # §5.4 logika job batch, dipanggil script CLI & endpoint cron
│   │   │   └── dapodik-sync-job.ts     # §5.5 logika sync Dapodik -> students/classes
│   │   ├── ews.ts                      # §5.4 algoritma Early Warning System
│   │   ├── ews-inputs.ts               # §5.4 ekstraksi sinyal mentah per murid (dipakai live & batch)
│   │   ├── sentiment.ts                # §5.1 analisis sentimen lexicon-based
│   │   ├── psychometrics.ts            # §5.1 skoring instrumen asesmen diagnostik
│   │   ├── rag.ts                      # §5.2 retrieval pgvector (embedding, TIDAK ikut dikonfigurasi provider)
│   │   ├── embeddings.ts               # §5.2 embedding (OpenAI env var atau hashing-trick lokal)
│   │   ├── ai-providers.ts             # §5.2 adapter multi-provider CHAT (openai/openrouter/gemini/custom)
│   │   ├── dapodik.ts                  # §5.5 client Web Service Dapodik (dibangun dari nol, terverifikasi manual)
│   │   ├── ticket-workflow.ts          # §6 state machine SOP Kolaborasi
│   │   ├── file-storage.ts             # §7.0c storage berkas lokal (SK Guru Wali, foto murid) — path statis, LIHAT komentar di file
│   │   ├── text-helpers.ts             # `linesToArray`/`arrayToLines` — konversi textarea <-> field array jsonb, dipakai journal.ts & student-profile.ts
│   │   └── utils.ts
│   ├── db/
│   │   ├── schema.ts                   # single source of truth skema (Drizzle)
│   │   └── index.ts                    # koneksi postgres (pooled, reuse saat hot-reload)
│   ├── auth.ts / auth.config.ts        # NextAuth: config edge-safe terpisah dari provider DB
│   └── middleware.ts                   # proteksi route /dashboard/*
├── scripts/
│   ├── seed.ts                         # bun run db:seed — data demo realistis (5 role, termasuk admin)
│   ├── seed-instruments.ts             # bun run db:seed-instruments — instrumen IKEM-12 (idempotent)
│   ├── ingest-knowledge.ts             # bun run rag:ingest — PDF Buku Saku -> ai_knowledge_chunks
│   ├── compute-ews-snapshots.ts        # bun run ews:snapshot — trigger manual job batch EWS
│   └── ensure-pgvector.ts              # dipanggil otomatis oleh bun run db:migrate
├── drizzle/                            # migrasi SQL ter-generate (jangan diedit manual)
├── vercel.json                         # jadwal Vercel Cron -> /api/cron/ews-snapshot
└── referensi/                          # dokumen sumber asli (docx/xlsx/pdf/png) — TIDAK dideploy
```

---

## 4. Model Data (ERD)

```mermaid
erDiagram
    SCHOOLS ||--o{ SCHOOL_YEARS : memiliki
    SCHOOLS ||--o{ USERS : mempekerjakan
    SCHOOLS ||--o{ STUDENTS : menaungi
    SCHOOL_YEARS ||--o{ CLASSES : membuka
    CLASSES ||--o{ STUDENTS : berisi
    USERS ||--o{ CLASSES : "menjadi wali kelas"

    USERS ||--o{ GURU_WALI_ASSIGNMENTS : ditugaskan
    STUDENTS ||--o{ GURU_WALI_ASSIGNMENTS : didampingi
    STUDENTS ||--|| STUDENT_GUARDIANS : punya
    STUDENTS ||--|| STUDENT_PROFILES : punya
    STUDENTS ||--o{ STUDENT_ACADEMIC_HISTORY : punya
    STUDENTS ||--o{ STUDENT_ACHIEVEMENTS : punya

    USERS ||--o{ WORK_PLAN_ITEMS : menyusun

    STUDENTS ||--o{ SMART_GOALS : memiliki
    USERS ||--o{ SMART_GOALS : membimbing
    SMART_GOALS ||--o{ SMART_GOAL_CHECKINS : dicatat

    STUDENTS ||--o{ TICKETS : dilaporkan
    USERS ||--o{ TICKETS : melaporkan
    TICKETS ||--o{ TICKET_EVENTS : "log transisi"
    TICKETS ||--o{ TICKET_COLLABORATORS : "auto-tag"
    USERS ||--o{ TICKET_COLLABORATORS : ditandai

    STUDENTS ||--o{ CONSULTATION_LOGS : dicatat
    STUDENTS ||--o{ COLLABORATION_LOGS : dicatat
    STUDENTS ||--o{ HOME_VISITS : dikunjungi
    STUDENTS ||--o{ WEEKLY_REFLECTIONS : menulis
    TICKETS ||--o{ CONSULTATION_LOGS : memicu
    TICKETS ||--o{ COLLABORATION_LOGS : memicu
    TICKETS ||--o{ HOME_VISITS : "memicu (menutup invariant home_visit_required)"

    USERS ||--o{ GROUP_GUIDANCE_SESSIONS : memfasilitasi
    GROUP_GUIDANCE_SESSIONS ||--o{ GROUP_GUIDANCE_PARTICIPANTS : diikuti
    STUDENTS ||--o{ GROUP_GUIDANCE_PARTICIPANTS : mengikuti

    STUDENTS ||--o{ ATTENDANCE_RECORDS : dicatat
    STUDENTS ||--o{ ACADEMIC_SCORES : dicatat
    STUDENTS ||--o{ DISCIPLINE_POINTS : dicatat
    STUDENTS ||--o{ EWS_SNAPSHOTS : dihitung

    PSYCHOMETRIC_INSTRUMENTS ||--o{ PSYCHOMETRIC_ASSESSMENTS : dipakai
    STUDENTS ||--o{ PSYCHOMETRIC_ASSESSMENTS : diskrining
    USERS ||--o{ PSYCHOMETRIC_ASSESSMENTS : mengisi

    USERS ||--o{ AI_CHAT_LOGS : bertanya
    STUDENTS ||--o{ AI_CHAT_LOGS : dibahas
    SCHOOLS ||--o{ AI_PROVIDER_CONFIGS : "konfigurasi chat (§5.2)"
    SCHOOLS ||--o| DAPODIK_CONFIGS : "konfigurasi sync (§5.5)"
```

Tabel `ai_knowledge_chunks` (berisi kolom `embedding vector(1536)`) berdiri sendiri — tidak berelasi FK ke entitas lain, ia adalah basis pengetahuan RAG hasil ingest PDF (§5.2).

**Enum penting** (didefinisikan di `schema.ts`, dipakai untuk integrity + UI labels):
`user_role`, `gender`, `parent_relation`, `education_level`, `achievement_category`, `service_orientation`, `collaborator_type`, `ticket_category`, `ticket_severity`, `ticket_status`, `risk_level`, `attendance_status`, `smart_goal_status`, `psychometric_risk`, `ai_provider`.

> Detail kolom lengkap: baca `src/db/schema.ts` langsung — itu single source of truth, jangan diduplikasi manual di dokumen ini agar tidak basi.

---

## 5. Empat Pilar STEM (implementasi nyata)

### 5.1 Science — Deteksi Dini Stres

Dua mekanisme saling melengkapi, keduanya eksplisit menyatakan diri sebagai **triase, bukan diagnosis klinis**:

**a) NLP Sentimen** — File: `src/lib/sentiment.ts`

Pendekatan **lexicon-based** Bahasa Indonesia (bukan model ML eksternal — sengaja, agar 100% offline & tanpa biaya API):
- Daftar kata positif/negatif + penanganan negasi sederhana (`tidak`, `bukan`, `kurang`, `jangan`, `tak`) yang membalik polaritas kata setelahnya.
- Daftar `CONCERN_KEYWORDS` risiko tinggi (mis. "putus asa", "dibully", "menyakiti diri") yang **langsung** memicu `riskFlag = true` terlepas dari skor total — ini prioritas keselamatan di atas akurasi skor.
- Output: `score` (-1..1), `riskFlag`, `concernLevel` (rendah/sedang/tinggi), `matchedKeywords`, `summary`.
- Dipanggil saat murid submit `weekly_reflections` → hasil disimpan di kolom `sentimentScore`, `riskFlag`, `aiAnalysis` (jsonb) pada tabel yang sama.

**b) Instrumen Asesmen Diagnostik (Skrining Terstruktur)** — File: `src/lib/psychometrics.ts`, `src/lib/actions/psychometrics.ts`, `src/app/dashboard/psychometric/page.tsx`, `scripts/seed-instruments.ts`

⚠️ **Sangat penting**: instrumen bawaan **IKEM-12** ("Instrumen Skrining Kesejahteraan Emosional Murid") adalah **skrining awal buatan internal untuk kebutuhan aplikasi ini** — 12 butir Likert 1-4 di 3 subskala (emosi, sosial, akademik), diisi Guru Wali berdasarkan observasi/perbincangan dengan murid. **Ini BUKAN alat diagnostik klinis tervalidasi** (bukan DASS-21/PHQ-9/GAD-7 atau instrumen psikometrik berlisensi apa pun) — hasil kategori "tinggi" berarti *perlu didiskusikan lebih lanjut* (mis. dirujuk ke Guru BK), bukan diagnosis final. Jangan pernah menyajikan hasilnya ke pengguna sebagai diagnosis.

Desain skema (`psychometric_instruments` + `psychometric_assessments` di `schema.ts`) sengaja generik — butir instrumen disimpan sebagai `jsonb` pada instrumen (bukan tabel per-butir terpisah), supaya menambah instrumen baru (mis. versi terjemahan, atau instrumen lain di masa depan) tidak perlu migrasi skema, cukup insert baris baru dengan kode unik.

Skoring (`scorePsychometricAssessment()` di `psychometrics.ts`) murni logika (tanpa I/O, unit-tested di `psychometrics.test.ts`):
- Total skor = jumlah semua butir; rasio ≥0.75 → **tinggi**, ≥0.52 → **sedang**, selainnya → **rendah** (ambang provisional, sama seperti bobot EWS — perlu dikalibrasi ulang dengan data riil).
- **Override keselamatan**: jika ≥3 butir dijawab di level tertinggi skala ("Selalu"), kategori otomatis **tinggi** terlepas dari rasio total — meniru prinsip `CONCERN_KEYWORDS` di sentimen: sinyal individual yang mengkhawatirkan mengalahkan skor agregat.
- Subskala dihitung terpisah (`subscaleScores` jsonb) supaya Guru Wali bisa melihat *area* yang bermasalah (mis. tinggi di "sosial" tapi rendah di "akademik"), bukan cuma satu angka gabungan.

**Belum terintegrasi ke `calculateEws()`** — hasil psikometrik ditampilkan sebagai riwayat informasional di halaman `/dashboard/psychometric`, belum jadi sinyal ke-5 EWS. Ini keputusan sadar (lihat §9): menambah sinyal ke formula EWS yang sudah stabil & teruji butuh rekalibrasi bobot, bukan sekadar tempel.

### 5.2 Technology — AI Assistant (RAG, multi-provider)
File: `src/lib/rag.ts`, `src/lib/embeddings.ts`, `src/lib/ai-providers.ts`, `src/lib/actions/ai-assistant.ts`, `src/lib/actions/ai-config.ts`, `scripts/ingest-knowledge.ts`

Pipeline, dipisah tegas jadi dua bagian yang **sengaja tidak saling memengaruhi**:

```
[BAGIAN A — EMBEDDING/RETRIEVAL, TIDAK BISA DIKONFIGURASI LEWAT UI]

Buku 1/2/3 (PDF, referensi/)
   │  bun run rag:ingest
   ▼
pdf-parse → chunk (1200 char, overlap 150)
   │
   ▼
embedText() ──┬─ OPENAI_API_KEY (env) ada → OpenAI text-embedding-3-small
              └─ tidak ada               → localEmbedding() hashing-trick (offline, 1536 dim, deterministik)
   │
   ▼
INSERT ai_knowledge_chunks(source_document, chunk_index, content, embedding)

--- saat Guru Wali bertanya di /dashboard/ai-assistant ---
question → embedText(question) → cosine distance search (pgvector `<=>` operator, top-4)


[BAGIAN B — JAWABAN (CHAT), BISA DIKONFIGURASI LEWAT PANEL ADMIN]

generateAnswer() → prioritas:
   1. Konfigurasi aktif di Panel Admin (`ai_provider_configs`, per sekolah)
   2. Env var OPENAI_API_KEY (fallback legacy, kalau (1) tidak ada)
   3. Mode offline ekstraktif — tampilkan kutipan top-4 apa adanya
   │
   ▼ (kalau (1) atau (2) dipakai)
generateChatCompletion() di ai-providers.ts → routing ke adapter provider:
   openai | openrouter | gemini | custom (endpoint OpenAI-compatible apa pun)
   │
   ▼ kalau adapter melempar AiProviderError (network/auth/dll)
   → jatuh balik OTOMATIS ke mode ekstraktif offline (bukan error ke pengguna)
   │
   ▼
simpan ke ai_chat_logs (audit trail pertanyaan/jawaban + chunk yang dirujuk)
```

**Kenapa embedding dan chat dipisah tegas begini**: embedding TIDAK ikut dikonfigurasi lewat Panel Admin secara sengaja — cosine similarity antara embedding pertanyaan dan embedding `ai_knowledge_chunks` yang tersimpan cuma valid kalau keduanya berasal dari ruang vektor yang sama. Kalau provider chat diganti-ganti lewat UI tapi ikut memengaruhi embedding, hasil pencarian RAG bisa jadi acak tanpa peringatan apa pun (bug diam-diam paling berbahaya di sistem RAG). Chat completion sebaliknya aman diganti provider kapan saja karena sifatnya stateless per-request, tidak ada data tersimpan yang jadi usang.

**Konfigurasi provider chat lewat UI** (`/dashboard/admin`, khusus role `admin`): form pilih provider (OpenAI/OpenRouter/Google Gemini/Custom OpenAI-compatible), API key, base URL (wajib untuk Custom), model chat opsional. Menyimpan konfigurasi baru otomatis mengaktifkannya (menonaktifkan yang lain — satu aktif per sekolah, pola sama seperti Tahun Ajaran di §7.2). API key **tidak pernah** dikirim utuh ke client — selalu di-mask (`maskApiKey()`, tampil `sk-1•••••••ab12`) saat ditampilkan ulang di daftar konfigurasi tersimpan. Tombol "Nonaktifkan" mengembalikan ke mode offline tanpa menghapus konfigurasi (bisa diaktifkan lagi tanpa input ulang key); tombol "Hapus" menghapus permanen.

Desain **graceful degradation** ini penting di kedua bagian: sistem tetap 100% fungsional di sekolah tanpa anggaran API key sama sekali (default), kualitas naik begitu admin mengaktifkan provider — dan kalau provider yang aktif gagal (key salah/kuota habis/down), sistem otomatis jatuh balik ke mode offline alih-alih menampilkan error ke Guru Wali.

### 5.3 Engineering — State Machine SOP Kolaborasi
File: `src/lib/ticket-workflow.ts` — lihat §6 di bawah untuk diagram lengkap.

Pola: **pure reducer function** `transitionTicket(state, action) => newState`, melempar `InvalidTicketTransitionError` jika transisi tidak valid (mis. mencoba lompat ke `implementasi` tanpa melalui `eskalasi_kepala_sekolah` untuk kasus berat). Tanpa I/O — mudah di-unit-test (`src/lib/ticket-workflow.test.ts`, `bun test`), dipakai ulang dari Server Action (`src/lib/actions/tickets.ts`).

**Otorisasi per-aksi**: `submitTicketTransition()` memanggil `assertTicketActionAllowed()` sebelum mengeksekusi transisi apa pun:
- `PRINCIPAL_DECISION` → hanya role `kepala_sekolah` (sekolah yang sama dengan murid pada tiket), atau `admin`.
- Semua aksi SOP lain → hanya role `guru_wali` yang murid pada tiket tsb adalah murid binaannya aktif (dicek lewat `guru_wali_assignments`), atau `admin`.

Ini menutup celah keamanan nyata yang sempat ditemukan: sebelumnya *siapa pun yang login* bisa memicu `PRINCIPAL_DECISION`, termasuk Guru Wali pelapor sendiri — meniadakan tujuan eskalasi. Diverifikasi end-to-end: Guru Wali membawa tiket sampai `eskalasi_kepala_sekolah` → `PRINCIPAL_DECISION` sebagai Guru Wali ditolak → sebagai Guru BK ditolak → sebagai Kepala Sekolah sekolah yang sama berhasil.

`createTicketAction()` juga memvalidasi murid yang dipilih benar murid binaan aktif pelapor.

**Invariant `home_visit_required`**: kalau `COMPLETE_COLLABORATION` menandai Home Visit wajib, `runTicketAction()` memblokir `ASSESS_SEVERITY` berikutnya sampai ada baris `home_visits` yang tertaut ke `ticketId` tersebut (bukan lagi validasi UI-level pasif). `HomeVisitForm` (`journal/page.tsx`) menampilkan dropdown "Terkait Tiket" berisi tiket-tiket yang menunggu laporan ini, dan `TicketCard` menampilkan link langsung `/dashboard/journal?ticketId=...#home-visit` saat status `pelibatan_orang_tua` dengan flag ini aktif.

`AUTO_TAG_RULES` men-tag otomatis role yang relevan ke `ticket_collaborators` setiap kali status berubah (mis. masuk `jalur_b_bk` → auto-tag `guru_bk`).

### 5.4 Mathematics — Early Warning System (EWS)
File: `src/lib/ews.ts`, `src/lib/ews-inputs.ts`, `src/lib/jobs/ews-snapshot-job.ts`

Skor risiko **0–100**, kombinasi linear berbobot dari 4 sinyal yang masing-masing dinormalisasi ke 0–100 terlebih dahulu:

| Sinyal | Bobot | Normalisasi risiko penuh (100) saat... |
|---|---|---|
| Kehadiran 30 hari terakhir | 35% | kehadiran ≤ 75% (linear dari 95%→0%, 75%→100%) |
| Tren nilai akademik (delta vs periode lalu) | 30% | penurunan ≥ 15 poin |
| Skor kedisiplinan (akumulasi poin) | 20% | akumulasi ≤ -20 poin |
| Tren sentimen jurnal refleksi | 15% | rata-rata sentimen ≤ -0.5 |

```
riskScore = Σ (komponen_i_dinormalisasi_0..100 × bobot_i)
riskLevel = "berisiko_tinggi" jika riskScore ≥ 60
          | "waspada"         jika riskScore ≥ 30
          | "aman"             selainnya
```

Bobot didefinisikan sebagai konstanta (`WEIGHTS` di `ews.ts`) yang eksplisit direkomendasikan untuk **dikalibrasi ulang** berdasarkan data historis riil sekolah — jangan anggap ini angka final.

**Live vs batch, dan kenapa keduanya dipertahankan**: `computeEwsInputsForStudent()` (di `ews-inputs.ts`) adalah satu-satunya tempat sinyal mentah diambil dari DB, dipakai oleh DUA jalur:
1. **Live** — `dashboard/page.tsx` memanggilnya per-request, real-time, jadi angka yang tampil di badge risiko utama **selalu akurat saat ini juga**. Untuk fitur keselamatan seperti ini, keputusan sadar: real-time lebih penting daripada performa, jadi dashboard **tidak** dialihkan membaca `ews_snapshots` sebagai sumber utama.
2. **Batch** — `runEwsSnapshotJob()` (`src/lib/jobs/ews-snapshot-job.ts`) menghitung untuk SEMUA murid aktif dan menyimpan ke `ews_snapshots`, dipicu dari dua tempat yang identik logikanya:
   - Manual: `bun run ews:snapshot` (`scripts/compute-ews-snapshots.ts`)
   - Terjadwal: `GET /api/cron/ews-snapshot` (`src/app/api/cron/ews-snapshot/route.ts`), diamankan header `Authorization: Bearer $CRON_SECRET` (fail-closed kalau env var belum diset), dipanggil `vercel.json` (`crons`, jadwal `0 20 * * *` UTC = 03:00 WIB tiap hari) kalau deploy ke Vercel — atau cron/systemd timer + `curl` untuk deploy non-Vercel.

Snapshot yang terkumpul dipakai dashboard untuk **tren historis**: `RiskTrendSparkline` (`src/components/dashboard/risk-trend-sparkline.tsx`) menggambar sparkline SVG kecil per murid dari 4 snapshot terakhir + skor live sebagai titik terakhir, dengan indikator naik/turun (▲/▼) berwarna semantik (merah=memburuk, hijau=membaik).

### 5.5 Technology — Sinkronisasi Dapodik
File: `src/lib/dapodik.ts` (client API), `src/lib/jobs/dapodik-sync-job.ts` (logika sync), `src/lib/actions/dapodik.ts` (Server Actions admin), `src/app/api/cron/dapodik-sync/route.ts` (pemicu terjadwal).

Menarik data **Murid**, **Rombongan Belajar**, dan **akun Guru (GTK/PTK)** dari Web Service lokal Dapodik sekolah, supaya operator tidak perlu entri manual dua kali (sekali di Dapodik, sekali di SIGW).

**Client (`dapodik.ts`) dibangun dari nol berdasarkan verifikasi manual terhadap instalasi Dapodik nyata** (bukan dari SDK pihak ketiga mana pun) — beberapa temuan di bawah ini **berbeda dari asumsi umum**, jadi penting dibaca sebelum mengubah kode ini:

| Aspek | Perilaku terverifikasi nyata |
|---|---|
| Auth | Header `Authorization: Bearer <token>` (token dari menu **Pengaturan → WebService** di aplikasi Dapodik) |
| Parameter wajib | `npsn` (query string) di **setiap** request, tanpa terkecuali |
| Endpoint dipakai | `getSekolah`, `getRombonganBelajar`, `getPesertaDidik`, `getPengguna`, `getGtk` |
| ⚠️ `getPTK` | **TERBUKTI mengembalikan 404** "page not found" (bukan error auth) pada instalasi yang diuji (SMKN 2 Malinau) — endpoint ini didokumentasikan resmi tapi rupanya tidak diimplementasikan pada versi modul webservice yang mereka pakai. SIGW memakai `getPengguna` (akun) + `getGtk` (profil PTK, termasuk NIP) sebagai gantinya. |
| `getGtk` | **TIDAK terdokumentasi resmi** (nama `get_gtk`/`getGTK` yang beredar tidak cocok — yang TERBUKTI berfungsi persis kapitalisasi `getGtk`, huruf "tk" kecil, ditemukan lewat pengujian empiris 2026-09-22). Melengkapi `nip`/`nuptk` yang tidak ada di `getPengguna`; `ptk_id`-nya 100% (56/56) nyambung ke `ptk_id` milik `getPengguna`. `jenis_ptk_id_str` cuma kategori umum ("Guru"/"Tenaga Kependidikan"/"Kepala Sekolah") — tidak ada label "Wali Kelas", jadi tidak membantu pemetaan Guru Wali. Kode numerik `jenis_ptk_id` (guru/tendik/instruktur/asesor) tersedia sebagai referensi (`JENIS_PTK_REFERENCE` di `dapodik.ts`, dikonfirmasi lewat analisis kode sumber e-Rapor SMK 8) tapi **belum dipakai** untuk keputusan apa pun. |
| `semester_id` (opsional) | **TIDAK wajib** pada instalasi yang diuji (semua endpoint tetap mengembalikan data lengkap tanpa param ini). Ditemukan lewat analisis kode sumber e-Rapor SMK 8 — aplikasi resmi itu SELALU menyertakannya di setiap request. Didukung sebagai field opsional `DapodikClientConfig.semesterId` untuk kompatibilitas ke depan/instalasi lain yang mungkin mewajibkannya, TAPI SENGAJA tidak di-set otomatis oleh `dapodik-sync-job.ts` (SIGW cuma menyimpan tahun ajaran di `school_years`, bukan ganjil/genap — tidak ada cara andal menghitung nilainya tanpa menebak). |
| `jenis_rombel` (numerik) vs `jenis_rombel_str` | Cross-check 2026-09-22 terhadap 44 rombel nyata membuktikan keduanya **selalu konsisten 1:1** (0 selisih di ketiga kategori). Kode numerik (`1`=Reguler/"Kelas", `16`=Matapelajaran Pilihan, `51`=Ekstrakurikuler) dikonfirmasi lewat kode sumber e-Rapor SMK 8 — SIGW memfilter kelas lewat kode numerik (`JENIS_ROMBEL_KELAS = 1` di `dapodik-sync-job.ts`), bukan string, karena itu nilai enum kanonis Dapodik yang lebih tahan terhadap variasi label `_str` antar versi/instalasi. |
| Bentuk `rows` | **Objek tunggal** untuk `getSekolah` (satu Dapodik = satu sekolah); **array** untuk endpoint lain |
| ⚠️ Paginasi | `page`/`start`/`limit`/`offset` **TERBUKTI DIABAIKAN** server — field `start`/`limit` di response envelope cuma metadata dekoratif, TIDAK mencerminkan perilaku sungguhan. Satu request langsung mengembalikan **seluruh** dataset (diuji: 602 murid dalam satu response). **Jangan tambahkan logika paginasi/looping** kecuali sudah diverifikasi ulang secara empiris — SDK mana pun yang berasumsi paginasi bekerja berisiko infinite-loop persis karena ini (`rows.length` tidak akan pernah `< limit` kalau limit tak pernah benar2 diterapkan server). |
| ⚠️ Field `password` di `getPengguna` | HASH BCRYPT dari sistem auth Dapodik SENDIRI (verified: 60 karakter, prefix `$2y$`). **JANGAN PERNAH** disalin/dipakai untuk login SIGW — domain kepercayaan berbeda. SIGW selalu membuat password sementara acak sendiri (lihat di bawah); field ini sengaja tidak dimasukkan ke interface TypeScript `DapodikPengguna` supaya tidak tergoda dipakai tanpa sengaja. |

**Data nilai akademik (`getNilai`/`getMatevNilai`) — TIDAK bisa diambil, terverifikasi dead-end (2026-09-22).** Sempat dicoba `getNilai?table=rapor&id_evaluasi=<uuid>` — endpoint-nya ada, tapi `id_evaluasi` cuma menerima UUID yang valid FORMAT-nya (bukan yang beneran ada), jadi tidak bisa ditebak. Analisis kode sumber **e-Rapor SMK 8** (aplikasi resmi Kemendikbud, `github.com/eraporsmk/erapor8`) membongkar akar masalahnya: `id_evaluasi` bukan sesuatu yang sudah ada menunggu diambil di Dapodik — itu di-**generate oleh aplikasi seperti e-Rapor sendiri**, lalu **didorong (push)** ke Dapodik lewat `postMatevRapor` (bikin "Mata Evaluasi") diikuti `postNilai` (kirim nilai akhirnya). `getMatevNilai?a_dari_template=1` (endpoint yang benar untuk membaca daftar Mata Evaluasi yang sudah ada — TERBUKTI ada, bukan 404) dites langsung ke server SMKN 2 Malinau dan **hasilnya 0 baris**, karena sekolah ini belum pernah memakai e-Rapor (atau sistem sejenis) untuk mendorong nilai ke Dapodik. **Kesimpulan**: SIGW tidak bisa menarik nilai akademik dari Dapodik sampai sekolah benar-benar mengadopsi alur push-nilai (e-Rapor atau setara) — bukan soal endpoint/parameter yang salah tebak, memang tidak ada datanya di sisi Dapodik untuk sekolah ini.

**Pemetaan data — Murid & Kelas** (`dapodik-sync-job.ts`):
- **Rombongan Belajar → `classes`**, dicocokkan lewat kolom `classes.dapodikId` (= `rombongan_belajar_id`, unique) — bukan lewat nama, supaya rename di Dapodik tidak membuat kelas duplikat.
- **Peserta Didik → `students`**, dicocokkan lewat `nisn` (sudah unique di skema). Murid **tanpa NISN dilewati** (bukan error) — NISN adalah kolom wajib unik di `students`.
- **Field yang HANYA dikelola manual di SIGW TIDAK disentuh** sinkronisasi (`chronicIllness`, `photoUrl`, `nickname`, `isActive`, dll. di `student_profiles`/`students`) — supaya data yang sudah diisi Guru Wali tidak tertimpa data Dapodik.
- Data orang tua (`nama_ayah`/`nama_ibu`/pekerjaan) ikut disinkronkan ke `student_guardians`.

**Pemetaan data — GTK/PTK (akun guru)** (`upsertTeacher()` di `dapodik-sync-job.ts`): keputusan sensitif ini dikonfirmasi eksplisit ke Kepala Sekolah/Admin sebelum diimplementasikan — hasil keputusan: **auto-buat akun** untuk guru yang belum punya, **wajib ganti password di login pertama**, dicocokkan lewat **`ptk_id`** (bukan NIP, karena `getPTK` yang seharusnya jadi sumber NIP tidak tersedia — lihat tabel di atas).
- Hanya peran Dapodik yang **jelas berkaitan dengan pengajaran** yang disinkronkan sebagai akun (`TEACHER_ROLE_MAP`): `"PTK"` → `guru_mapel`, `"Wali Kelas"` → `wali_kelas`, `"Kepala Sekolah"` → `kepala_sekolah`. Peran administratif Dapodik (**Operator Sekolah**, **Bendahara BOS**) **SENGAJA dilewati** — tidak masuk map — supaya sinkronisasi tidak diam-diam memberi akses dashboard SIGW ke peran yang tidak relevan/tidak semestinya. Role `guru_wali`/`guru_bk` (spesifik SIGW, tidak ada padanan di Dapodik) tidak pernah di-auto-assign — Admin mempromosikan manual lewat Panel Admin setelah akun tersinkron sebagai `guru_mapel`.
- **Kunci pencocokan**: `users.dapodikPtkId` (= `ptk_id` dari Dapodik, unique, mirip pola `classes.dapodikId`). Kalau belum pernah tertaut tapi sudah ada akun manual dengan email yang sama (`username` Dapodik), akun itu **hanya ditautkan** — role/password/nama TIDAK ditimpa, supaya penyesuaian manual Admin (mis. promosi ke Guru Wali) tidak hilang.
- Akun **benar-benar baru**: `email` = `username` Dapodik (pada instalasi yang diuji formatnya alamat email — divalidasi dengan regex sebelum dipakai, dilewati kalau tidak valid), `passwordHash` = bcrypt dari password **acak yang SIGW buat sendiri** (bukan turunan Dapodik apa pun), `mustChangePassword=true`, `nip` diisi dari `getGtk` kalau tersedia (join lewat `ptk_id`, lihat tabel di atas).
- **NIP untuk akun yang SUDAH ADA** (tertaut lewat `dapodikPtkId` atau email): diisi HANYA kalau kolom `nip`-nya masih kosong (fill-if-empty) — kalau Admin sudah mengisi NIP manual, sinkronisasi ulang TIDAK menimpanya, konsisten dengan filosofi "tidak menimpa data manual" di seluruh job ini.
- **Password sementara plaintext HANYA muncul sekali**, di respons Server Action tepat setelah sinkronisasi (`newTeacherCredentials` — bukan bagian dari `dapodikConfigs.lastSyncSummary` yang dipersist, lihat tipe `lastSyncSummary` di skema) — ditampilkan di Panel Admin dalam kotak peringatan kuning (`dapodik-config-form.tsx`) untuk disalin & dibagikan lewat jalur aman. Tidak bisa dipanggil ulang; kalau admin lupa mencatatnya, jalan keluarnya reset password manual lewat fitur user management biasa.
- **Penegakan ganti password**: `users.mustChangePassword` dipropagasi ke JWT session (`auth.config.ts`), lalu callback `authorized` (dipakai `middleware.ts`) me-redirect paksa ke `/dashboard/change-password` untuk path `/dashboard/*` mana pun selama flag masih `true`. Halaman itu (`change-password-form.tsx` → `changePasswordAction` di `actions/auth.ts`) minta password lama, verifikasi bcrypt, simpan password baru, set `mustChangePassword=false`, lalu **paksa logout** (strategi JWT tidak bisa "diperbarui di tempat" dari Server Action) — user login ulang pakai password barunya.

**Idempotent**: sinkronisasi ulang berkali-kali aman untuk murid/kelas/guru — entitas yang sudah ada di-`UPDATE` konservatif (guru: hanya nama) atau ditautkan, bukan dibuat duplikat (diverifikasi otomatis via mock server + data sintetis, termasuk kasus create/link-by-email/link-by-ptk_id/skip-peran-tak-relevan/skip-email-tak-valid — lihat §11 poin 8&10).

**Lapisan keamanan tambahan (opsional) — Cloudflare Access Service Token**: `dapodikConfigs.cfAccessClientId`/`cfAccessClientSecret` (nullable, di-mask sama seperti `token`) — kalau diisi, `dapodik.ts` mengirim header `CF-Access-Client-Id`/`CF-Access-Client-Secret` di setiap request, di atas `Authorization: Bearer <token>` milik Dapodik sendiri. Field ini opsional dan **dipertahankan** (tidak diam-diam dikosongkan) kalau form disubmit dengan kolom itu kosong tapi sudah pernah terisi sebelumnya — lihat `saveDapodikConfigAction`. Lihat runbook Cloudflare Access di §10 untuk cara memasangnya di sisi Cloudflare.

**Penjadwalan otomatis**: `/api/cron/dapodik-sync` (diamankan `CRON_SECRET`, pola identik `/api/cron/ews-snapshot`) memanggil `runAllDapodikSyncs()` — menjalankan sinkronisasi untuk **semua** sekolah yang sudah punya `dapodik_configs` tersimpan, kegagalan satu sekolah tidak menghentikan yang lain. Dijadwalkan lewat Vercel Cron di `vercel.json` (`30 20 * * *` = 04:30 WITA, 30 menit setelah snapshot EWS supaya tidak tabrakan beban). Selain tombol manual "Sinkronkan Sekarang" di Panel Admin, ini membuat sinkronisasi rutin tidak lagi bergantung pada Admin mengklik tombol setiap hari — **catatan**: kalau sinkronisasi otomatis ini membuat akun guru baru, kredensial sementaranya TIDAK bisa dilihat lagi setelah request cron selesai (tidak ada UI yang menangkapnya) — untuk kasus itu, Admin sebaiknya menjalankan sinkronisasi manual sekali dari Panel Admin supaya bisa melihat & membagikan passwordnya, atau reset password guru yang bersangkutan secara manual.

Konfigurasi (`base URL`, NPSN, token, CF Access opsional) disimpan di tabel `dapodik_configs`, **satu per sekolah**, dikelola dari Panel Admin (§7.2) — form punya tiga aksi terpisah: **Uji Koneksi** (tanpa menyimpan apa pun), **Simpan Konfigurasi** (menguji dulu via `testDapodikConnection()` sebelum menyimpan — konfigurasi salah tidak pernah tersimpan diam-diam), dan **Sinkronkan Sekarang (pakai form ini)** — sinkronisasi "custom" langsung dari nilai form tanpa harus disimpan dulu, berguna untuk mencoba kredensial lain tanpa mengubah konfigurasi tersimpan.

---

## 6. Alur Eskalasi Tiket (SOP Kolaborasi)

Sesuai `6. Mekanisme Kolaborasi (SOP Penanganan Masalah).docx` + `6b. Diagram Alir`.

```mermaid
stateDiagram-v2
    [*] --> baru: Tiket dibuat (murid dilaporkan)

    baru --> koordinasi_awal: CONFIRM_FINDING(hasFinding=true)\nauto-tag: wali_kelas
    baru --> selesai: CONFIRM_FINDING(hasFinding=false)

    koordinasi_awal --> jalur_a_akademik: CLASSIFY(akademik)\nauto-tag: wali_kelas, guru_mapel
    koordinasi_awal --> jalur_b_bk: CLASSIFY(sosial_karakter)\nauto-tag: guru_bk

    jalur_a_akademik --> pelibatan_orang_tua: COMPLETE_COLLABORATION
    jalur_b_bk --> pelibatan_orang_tua: COMPLETE_COLLABORATION

    pelibatan_orang_tua --> eskalasi_kepala_sekolah: ASSESS_SEVERITY(berat)\nauto-tag: kepala_sekolah
    pelibatan_orang_tua --> implementasi: ASSESS_SEVERITY(ringan/sedang)\n[diblokir jika home_visit_required\nbelum ada laporan Home Visit]

    eskalasi_kepala_sekolah --> implementasi: PRINCIPAL_DECISION\n[hanya role kepala_sekolah]

    implementasi --> evaluasi: COMPLETE_IMPLEMENTATION
    evaluasi --> selesai: FINALIZE_REPORT
    selesai --> [*]
```

Prinsip desain (jangan dilanggar saat menambah fitur):
1. **Setiap transisi tervalidasi** oleh status asal — tidak bisa "melompat" state (mencegah kasus berat lolos tanpa eskalasi Kepala Sekolah).
2. **Setiap transisi tercatat** di `ticket_events` (audit trail, siapa mengubah apa kapan) — jangan pernah `UPDATE tickets SET status = ...` langsung tanpa lewat `transitionTicket()` + insert event.
3. **Auto-tag kolaborator** (`AUTO_TAG_RULES`) berjalan di layer Server Action saat status berubah, mengisi `ticket_collaborators` — ini yang dimaksud "otomatisasi workflow" di requirement STEM Engineering.
4. **Otorisasi per-aksi** (§5.3) dan **invariant Home Visit** (§5.3) ditegakkan di `runTicketAction()`/`assertTicketActionAllowed()`, bukan cuma disembunyikan di UI — mencoba memanggil Server Action langsung (mem-bypass tombol UI) tetap ditolak.

---

## 7. Dashboard & Halaman per Peran (UI)

### 7.0 Dashboard Guru Wali
Komponen: `src/components/dashboard/guru-wali-dashboard.tsx`, dirender oleh `src/app/dashboard/page.tsx` (Server Component yang query DB lalu passing props — tidak ada client-side fetch terpisah).

Struktur:
- **4 kartu ringkasan**: total murid binaan, murid perlu perhatian (`riskLevel !== aman`), rata-rata kehadiran, tiket kolaborasi aktif.
- **Panel EWS** (kiri, `lg:col-span-3`): daftar murid diurutkan skor risiko tertinggi → terendah, badge warna (`success`/`warning`/`danger`), **sparkline tren** (§5.4) di sebelah badge, chip `contributingFactors`, status tiket terbuka bila ada.
- **Panel Progres SMART Goals** (kanan, `lg:col-span-2`): horizontal bar chart (Recharts) + daftar progress bar per target.
- **Tabel Daftar Murid Binaan**: kehadiran, tren nilai, status risiko — untuk scan cepat seluruh murid binaan sepanjang tahun ajaran.

Halaman dashboard Guru Wali lain: `journal/` (4 jenis form: konsultasi, kolaborasi, bimbingan kelompok, home visit), `reflections/`, `smart-goals/`, `tickets/`, `psychometric/` (§5.1), `ai-assistant/`, `students/` & `work-plan/` (§7.0b di bawah) — masing-masing punya Server Action pasangan di `src/lib/actions/`.

### 7.0b Murid Saya (Lembar Identitas Murid Wali) & Matriks Rencana Kerja

Ditambahkan setelah analisis mendalam folder `referensi/` (2026-09-22) menemukan bahwa 4 tabel skema — `student_profiles`, `student_academic_history`, `student_achievements`, `work_plan_items` — sudah ada **sejak awal proyek** tapi **tidak dipakai satu pun halaman/Server Action**, walau justru ini bagian yang paling ditekankan dokumen referensi ("Guru Wali dapat mengenal lebih dekat murid... sehingga pendampingan tidak bersifat umum, melainkan personal").

**`/dashboard/students`** (`src/app/dashboard/students/page.tsx` + `[id]/page.tsx`, actions di `src/lib/actions/student-profile.ts`) — Lembar Identitas Murid Wali lengkap per murid binaan:
- **A. Identitas Dasar** — field `students` yang sebelumnya HANYA bisa terisi lewat sinkronisasi Dapodik (nama panggilan, tempat/tgl lahir, agama, alamat, anak ke-berapa, no HP, medsos, penyakit kronis) kini bisa diisi/diedit manual.
- **B. Identitas Orang Tua** — upsert `student_guardians` (pola select-then-insert-or-update yang sama dipakai di seluruh proyek), melengkapi data yang Dapodik sudah isi otomatis.
- **C. Riwayat Pendidikan & Prestasi** — `student_academic_history` (TK/SD/SMP, tahun masuk-keluar) + `student_achievements` (jenjang, akademik/non-akademik) — tambah/hapus baris.
- **D. Aspirasi Studi Lanjut & Karier** — `student_profiles` (cita-cita, mapel favorit/lemah, hobi, skill sudah/ingin dikuasai, hambatan akademik/keluarga/finansial).
- **E. Karakter & Sosial-Emosional** — `student_profiles` (disiplin, empati, regulasi emosi, refleksi diri 3-kata).

**D dan E disimpan di baris `student_profiles` yang SAMA tapi lewat 2 Server Action TERPISAH** (`updateStudentAspirationsAction`/`updateStudentCharacterAction`), masing-masing hanya meng-`UPDATE` kolom bagian dirinya sendiri — supaya submit salah satu form tidak menghapus data bagian yang lain (diverifikasi lewat pengujian: isi D dulu, lalu isi E, keduanya tetap utuh sekaligus).

Otorisasi (`requireStudentAccess()`): **Guru Wali untuk murid binaan aktifnya sendiri** (`isOwnActiveStudent`) **atau Admin untuk murid di sekolahnya** (`assertSameSchool` setara) — bukan sekadar cek role, konsisten dengan pola §8/§11 poin 5. Link nav "Murid Saya" ada di `GURU_WALI_NAV` **dan** `ADMIN_NAV` (`src/app/dashboard/layout.tsx`) supaya akses Admin yang sudah didukung Server Action-nya juga bisa dijangkau lewat UI, bukan cuma lewat mengetik URL langsung (awalnya sempat tertinggal hanya di nav Guru Wali — ditemukan & diperbaiki 2026-09-22 saat menyinkronkan `help-content.ts`).

**`/dashboard/work-plan`** (`src/lib/actions/work-plan.ts`) — Matriks Rencana Kerja: tabel kegiatan × bulan (Jul-Jun) dikelompokkan 3 kategori (persiapan/pelaksanaan/evaluasi), persis struktur `5. Matriks Rencana Kerja.xlsx`. Tombol **"Pakai Template Resmi"** (`seedOfficialTemplateAction`) mengisi 11 kegiatan baku dari spreadsheet aslinya sekali sebagai titik awal (ditolak kalau sudah ada kegiatan — hapus dulu semua untuk mulai ulang dari template), Guru Wali bebas menambah/menghapus setelahnya.

### 7.0c Upload Berkas — SK Guru Wali & Foto Murid
File: `src/lib/file-storage.ts`, `src/app/api/files/sk-guru-wali/[assignmentId]/route.ts`, `src/app/api/files/student-photo/[studentId]/route.ts`.

`guruWaliAssignments.skFileUrl` dan `students.photoUrl` sudah ada di skema sejak awal tapi baru sekarang punya cara diisi — SIGW sebelumnya **tidak punya infrastruktur upload berkas sama sekali**. Ini penting karena Kepmendikdasmen 221/P/2025 eksplisit mewajibkan "Persyaratan Administratif: ... wajib dibuktikan melalui Surat Keputusan (SK) sebagai Guru Wali" sebagai bukti fisik.

**Disimpan di disk lokal** (`<app-root>/uploads/{sk-guru-wali,student-photo}/<uuid>.<ext>`, **bukan** `public/` dan **bukan** cloud/S3) — SIGW ditujukan untuk deploy VPS mandiri satu sekolah (DEPLOYMENT.md), menambah dependensi cloud storage untuk ini tidak proporsional untuk skala itu. Path root SENGAJA **statis** (`path.join(process.cwd(), "uploads")`, bukan dari env var) — versi awal sempat pakai `process.env.UPLOADS_DIR`, tapi Turbopack terbukti tidak bisa menganalisis path yang bergantung env var saat build dan defensif men-trace **seluruh proyek** ke output server (bloat ukuran deploy signifikan, ketahuan lewat `bun run build`, bukan `next dev`).

Disajikan lewat **route Next.js ber-otorisasi** (bukan link `public/` langsung) — cek yang SAMA PERSIS dengan aksi datanya sendiri (admin sekolah yang sama, atau guru wali/pemilik SK yang bersangkutan) sebelum stream isi berkas; kolom DB cuma menyimpan **nama file** hasil `randomUUID()`, bukan path/URL, supaya skema penyimpanan bisa berubah tanpa migrasi data. Validasi: PDF/JPG/PNG/WEBP saja, maks 10MB.

**Keterbatasan yang diketahui**: menghapus baris `guru_wali_assignments`/`students` tidak otomatis menghapus berkas fisiknya di disk (jadi orphan) — belum ada job pembersihan berkala untuk ini; dampaknya kecil karena kedua alur hapus itu jarang dipakai (assignment cuma di-nonaktifkan lewat "Akhiri", bukan dihapus; belum ada fitur hapus murid).

### 7.1 Halaman Kolaborasi (Kepala Sekolah / Guru BK / Wali Kelas / Guru Mapel)
File: `src/app/dashboard/collaboration/page.tsx`.

Satu query universal: *"tiket di mana saya muncul di `ticket_collaborators`"*, dipecah jadi **Perlu Tindak Lanjut** (status ≠ `selesai`) dan **Riwayat Selesai**. Judul & deskripsi halaman disesuaikan per role (`ROLE_INTRO`), UI kartu tiket memakai ulang `<TicketCard>` yang sama persis dengan Guru Wali — tombol aksi menyesuaikan status tiket, otorisasi sesungguhnya ditentukan `assertTicketActionAllowed()` (§5.3).

### 7.2 Panel Admin
File: `src/app/dashboard/admin/page.tsx`, `src/lib/actions/admin.ts`, `src/components/dashboard/admin/*`.

CRUD data master untuk role `admin`, di-scope ke `schoolId` admin yang login (satu admin = satu sekolah; cross-school hanya lewat `admin.schoolId`, lihat §9 untuk batasan ini):
- **Tahun Ajaran** — buat baru; menandai satu sebagai aktif otomatis menonaktifkan yang lain (satu tahun ajaran aktif per sekolah).
- **Kelas** — buat baru per tahun ajaran, opsional tetapkan Wali Kelas.
- **Murid** — buat data murid baru (NISN, nama, gender, kelas).
- **Pengguna** — buat akun baru (nama, email, password awal, peran, NIP opsional); menolak email duplikat. Setiap baris punya tombol **Reset Password** (`resetUserPasswordAction`) — generate password sementara baru & tampilkan SEKALI di halaman itu juga (`mustChangePassword` diset `true`, akun wajib ganti saat login berikutnya). Ini sengaja **reset-on-demand**, BUKAN penyimpanan password permanen yang bisa dilihat admin kapan-kapan — kalau database/sesi admin pernah bocor, kebocorannya tidak otomatis membongkar semua password sekaligus. Dipakai juga untuk akun hasil auto-provisioning sinkronisasi Dapodik (§5.5) yang lupa password sementaranya.
- **Penugasan Guru Wali** — tugaskan satu Guru Wali ke satu murid manual (dengan No. SK opsional); menolak kalau murid sudah punya Guru Wali aktif; tombol "Akhiri" untuk menutup penugasan (`isActive=false`, `endDate` hari ini). **Import massal dari Excel** (`src/lib/actions/guru-wali-import.ts`, `src/app/api/admin/guru-wali-template/route.ts`) — jalur yang dipilih karena Dapodik terbukti belum mengekspos konsep "Guru Wali" lewat webservice (lihat §9). Admin unduh template (`GET /api/admin/guru-wali-template`, dibuat on-the-fly pakai `exceljs`) berisi 3 sheet: **Import** (kolom NIK Guru Wali + NISN Murid dibatasi dropdown data-validation yang menunjuk ke sheet Referensi — tidak bisa ketik bebas — plus kolom Nama otomatis lewat VLOOKUP untuk verifikasi visual sebelum upload), **Referensi Guru Wali** (NIK+nama+email semua guru yang sudah punya NIK), **Referensi Murid** (NISN+nama+kelas semua murid aktif). Dicocokkan lewat **NIK** (`users.nik`, diisi dari `getGtk` Dapodik — lihat §5.5) dan **NISN** — bukan nama, supaya tidak ambigu. Guru yang dicocokkan otomatis **dipromosikan ke role `guru_wali`** kalau belum (aksi eksplisit Admin, beda dari sinkronisasi Dapodik otomatis yang tidak pernah mengubah role diam-diam). Murid yang sudah punya Guru Wali aktif LAIN: penugasan lama otomatis diakhiri & diganti (file import dianggap representasi kondisi yang benar saat ini); murid yang sudah punya Guru Wali aktif SAMA: baris dilewati (idempotent). Hasil per-baris (dibuat/diganti/dilewati/gagal) ditampilkan lengkap supaya Admin bisa perbaiki & upload ulang baris yang gagal saja.
- **Konfigurasi AI Assistant** (`src/lib/actions/ai-config.ts`) — pilih & aktifkan provider LLM untuk jawaban AI Assistant (§5.2): OpenAI, OpenRouter, Google Gemini, atau endpoint custom OpenAI-compatible apa pun. Default tetap offline; API key di-mask saat ditampilkan ulang, tidak pernah dikirim utuh ke client.
- **Sinkronisasi Dapodik** (`src/lib/actions/dapodik.ts`, §5.5) — hubungkan ke Web Service Dapodik sekolah (base URL, NPSN, token), lalu tombol "Sinkronkan Sekarang" menarik Murid & Rombongan Belajar. Token di-mask saat ditampilkan ulang.

**Bukan cakupan panel ini**: membuat *sekolah baru* (multi-tenant lintas sekolah) — lihat §9.

Nav header (`src/app/dashboard/layout.tsx`) sepenuhnya role-aware (`navForRole()`), dan `/dashboard` (root) redirect otomatis: `guru_wali`→tetap di dashboard, `admin`→`/dashboard/admin`, keempat role kolaborator→`/dashboard/collaboration`.

### 7.3 Panduan Pengguna (`/dashboard/help`)
File: `src/app/dashboard/help/page.tsx`, `src/components/dashboard/help/help-center.tsx`, `src/components/dashboard/help/help-content.ts`.

Dokumentasi end-user (bukan developer — untuk itu ada dokumen ini) langsung di dalam aplikasi, dapat diakses **semua role** lewat link "Panduan" di nav header. Isinya panduan langkah-demi-langkah per role (Guru Wali, Kepala Sekolah, Guru BK, Wali Kelas, Guru Mapel, Admin), ditulis dalam Bahasa Indonesia awam, memakai istilah/label tombol yang PERSIS sama dengan yang ada di UI sungguhan (supaya tidak membingungkan).

- **Konten murni statis** (`help-content.ts`, array `ROLE_GUIDES`) — tidak ada dependensi DB, jadi tidak perlu migrasi atau seed untuk menambah/mengubah panduan, cukup edit file ini.
- Struktur konten pakai tipe `ContentBlock` (`p` paragraf, `steps` langkah bernomor, `list` daftar poin, `note` kotak info biru, `warning` kotak peringatan amber) — dirender oleh komponen `Blocks` di `help-center.tsx`. Pakai helper `p()`/`steps()`/`list()`/`note()`/`warning()` di file yang sama saat menambah topik baru, jangan tulis objek block manual.
- Halaman terbuka otomatis pada panduan role yang sedang login (`defaultRole`), tapi pengguna bebas berpindah ke panduan role lain lewat tombol di sisi kiri — berguna misalnya buat Admin yang ingin paham alur kerja Guru Wali tanpa perlu login dua akun.

**Wajib disinkronkan**: setiap kali menambah/mengubah fitur yang terlihat pengguna (menu baru, field baru, alur SOP berubah, label tombol berubah), perbarui juga `help-content.ts` di role yang relevan — dokumen ini gampang basi kalau dilupakan karena tidak ada test yang mengecek kecocokannya dengan UI sungguhan.

### 7.4 Alur Kerja / Flowchart Interaktif (`/dashboard/flow`)
File: `src/app/dashboard/flow/page.tsx`, `src/components/dashboard/flow/flow-chart.tsx` (client), `src/components/dashboard/flow/flow-content.ts` (data).

Satu diagram alur kerja SIGW end-to-end, lintas **semua role** dalam satu gambar (bukan per-role terpisah seperti §7.3) — dibagi 3 tahap: (1) Admin menyiapkan data induk (Dapodik → tahun ajaran → kelas → murid → pengguna → penugasan Guru Wali), (2) Guru Wali bekerja sehari-hari (Dashboard EWS → 7 tool: Murid Saya, Jurnal, SMART Goals, Refleksi, Asesmen, Matriks Rencana Kerja, AI Assistant), (3) SOP Tiket Kolaborasi lengkap dengan percabangan keputusan (Ada Temuan?/Jalur A vs B/Ringan-Sedang vs Berat), sampai eskalasi Kepala Sekolah. Dapat diakses semua role lewat link "Alur Kerja" di nav header.

- **Data node terpusat** di `flow-content.ts` (`FLOW_NODES: Record<string, FlowNode>`) — tiap node punya `role` pemilik langkah & `href` halaman aslinya. Menambah langkah baru ke alur = tambah 1 entri di sini, lalu referensikan `id`-nya di layout JSX `flow-chart.tsx`.
- **Interaksi bergantung role yang login** (`session.user.role`, di-pass dari Server Component `page.tsx` ke Client Component): node milik role yang sedang login dirender sebagai `<Link>` sungguhan (cincin biru, langsung buka halamannya) — node milik role lain dirender sebagai `<button>` yang membuka modal penjelasan singkat, TIDAK mencoba navigasi ke halaman yang memang bukan haknya. Pola ini hasil keputusan eksplisit (bukan grey-out non-interaktif) supaya user tetap bisa pelajari alur kerja role lain dari satu halaman yang sama.
- **Layout flowchart dibuat manual pakai Tailwind (flex/grid + `border-t`/`border-l` sebagai garis penghubung)**, BUKAN library diagram (reactflow dkk.) — konsisten dengan filosofi proyek untuk tidak menambah dependensi kalau CSS biasa sudah cukup. Percabangan SOP (mis. Jalur A/B) dirender lewat komponen `BranchRow`/`Branch` yang generik untuk 2+ opsi bersebelahan.
- **Sengaja tidak menggambar ulang panah reconverge** setelah percabangan "Berat" (Eskalasi Kepsek) kembali ke Finalisasi Laporan — cukup catatan teks singkat di bawah node, karena menghitung ulang path SVG untuk 1 kasus jarang tidak sepadan kompleksitasnya.

### 7.5 Sistem Desain — Primitive Form (`src/components/ui/`)

Audit UI/UX menyeluruh (2026-09-22) menemukan **30 file** menulis ulang `<input>` manual, **12 file** `<textarea>`, **16 file** `<select>`, dan **11 file** `<button>` mentah — semua dengan class Tailwind diketik ulang per file, bukan disalin dari satu sumber. Diselesaikan dengan primitive baru, lalu SEMUA pemakaian di atas dimigrasikan (bukan cuma ditambahkan sebagai opsi):

- **`input.tsx`** — ekspor `inputClassName` (dipakai ulang oleh `textarea.tsx`/`select.tsx` supaya border/fokus/disabled selalu senada) dan komponen `Input`. `text-[16px] sm:text-sm` SENGAJA beda mobile vs desktop — di bawah 16px, Safari iOS auto-zoom saat field difokus.
- **`select.tsx`** — native `<select>` + ikon `ChevronDown` (Lucide, sudah jadi dependensi proyek) yang diposisikan absolut, BUKAN SVG data-URI di CSS (gampang salah escape). Ikon chevron otomatis disembunyikan kalau prop `multiple` true — select multi-baris dirender browser sebagai listbox, bukan dropdown, jadi ikon dropdown di situ menyesatkan.
- **`checkbox.tsx`** — ekspor `Checkbox` dan `Radio` (varian `rounded-full`), dipakai di 5 file yang sebelumnya pakai `<input type="checkbox"/radio">` polos tanpa focus ring konsisten.
- **`field.tsx`** — bungkus `Label` + input + pesan `hint`/`error`, pola `flex flex-col gap-1` yang sebelumnya ditulis ulang manual di hampir semua form. Terima `labelClassName` supaya form padat di Panel Admin bisa tetap pakai label `text-xs` tanpa styling manual berulang.
- **Form compact** (baris tambah-cepat di `history-achievements-form.tsx`, `work-plan-table.tsx`) override `inputClassName` lewat `className` (mis. `h-8 px-2 py-1.5 text-xs`) — `cn()`/`tailwind-merge` menyelesaikan konflik kelas, jadi override selalu menang tanpa perlu `!important`.

**Wajib dipakai untuk form baru**: field teks/angka/tanggal → `Input`, area teks → `Textarea`, dropdown → `Select`, centang → `Checkbox`/`Radio`, tombol → `Button` (jangan `<button>` mentah) — supaya konsistensi ini tidak basi lagi seperti sebelum audit ini.

---

## 8. Autentikasi & Otorisasi (RBAC)

- **NextAuth v5**, strategi **JWT** (bukan DB session) — `role` dan `schoolId` di-embed ke token saat login (`auth.config.ts` callback `jwt`/`session`), lalu tersedia di `session.user` di server manapun tanpa query tambahan.
- `src/auth.config.ts` sengaja **tidak** mengimpor DB (edge-safe) — dipakai `middleware.ts` yang jalan di Edge Runtime. Provider Credentials (yang query DB via bcrypt) didefinisikan terpisah di `src/auth.ts`.
- `middleware.ts` memproteksi seluruh `/dashboard/:path*` — belum login otomatis redirect ke `/login`. Endpoint `/api/cron/*` **tidak** melalui middleware ini (bukan di bawah `/dashboard`) — diamankan terpisah lewat `CRON_SECRET` (§5.4, §5.5).
- **Penegakan ganti password wajib**: `users.mustChangePassword` ikut di-embed ke JWT (dipakai untuk akun hasil auto-provisioning sinkronisasi GTK/PTK Dapodik, §5.5). Callback `authorized` di `auth.config.ts` me-redirect paksa ke `/dashboard/change-password` untuk path `/dashboard/*` mana pun selagi flag ini `true` — pola yang sama seperti proteksi login, tapi berbasis kondisi tambahan pada user, bukan cuma status login.
- **Pola otorisasi standar** yang dipakai konsisten di semua `src/lib/actions/*.ts` — cek role DULU, lalu cek keterkaitan/kepemilikan entitas lewat helper bersama `src/lib/actions/guards.ts`:
  ```ts
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return { error: "Hanya Guru Wali yang dapat ..." };
  }
  if (!(await isOwnActiveStudent(session.user.id, studentId))) {
    return { error: "Murid tersebut bukan murid binaan Anda." };
  }
  ```
  Diterapkan di **semua** action yang menerima `studentId` dari client: `tickets.ts`, `journal.ts` (4 action, termasuk validasi tiap `participantId` di bimbingan kelompok dan validasi `ticketId` yang dipilih di form Home Visit benar milik murid yang sama), `smart-goals.ts`, `reflections.ts`, `psychometrics.ts`. `admin.ts` punya varian sendiri (`assertSameSchool()`) karena konteksnya beda (admin mengelola sekolah, bukan murid binaan).

  **Bug kritis yang ditemukan & diperbaiki saat mengeraskan ini**: `updateSmartGoalProgressAction()` di `smart-goals.ts` sebelumnya **hanya mengecek `session.user` ada (login)** — tidak cek role maupun kepemilikan sama sekali. Artinya akun peran apa pun (mis. Guru BK, Wali Kelas) bisa mengubah progres SMART Goal milik Guru Wali mana pun, murid mana pun. Diperbaiki: sekarang cek role (`guru_wali`/`admin`) DAN `smartGoals.teacherId` cocok dengan aktor. Diverifikasi lewat script yang memanggil `isOwnActiveStudent()` asli dari `guards.ts` terhadap data nyata (guru wali lintas-akun ditolak, role selain guru_wali ditolak, goal milik guru lain ditolak).
- Peta akses per role saat ini:

  | Role | Halaman utama | Cakupan |
  |---|---|---|
  | `guru_wali` | Dashboard, Tiket, SMART Goals, Jurnal, Refleksi, Instrumen Asesmen, AI Assistant | Murid binaan aktif sendiri |
  | `kepala_sekolah` | `/dashboard/collaboration` | Tiket yang dieskalasi ke dia (§7.1); keputusan `PRINCIPAL_DECISION` di sekolahnya |
  | `guru_bk` / `wali_kelas` / `guru_mapel` | `/dashboard/collaboration` | Tiket yang di-auto-tag ke dia |
  | `admin` | `/dashboard/admin` | CRUD data master sekolahnya (§7.2) |

---

## 9. Gap & Roadmap (yang belum dikerjakan)

Semua item berikut sudah pernah dilacak sebagai gap dan **sudah dikerjakan** pada iterasi ini:

- ✅ Dashboard/portal untuk role lain (§7.1)
- ✅ Job batch EWS + endpoint terjadwal + tren historis di UI (§5.4)
- ✅ Invariant `home_visit_required` ditegakkan di state machine (§5.3, §6)
- ✅ Unit test untuk fungsi inti (`ticket-workflow.test.ts`, `ews.test.ts`, `psychometrics.test.ts` — 24 test, `bun test`)
- ✅ Instrumen asesmen diagnostik psikometrik (§5.1)
- ✅ Panel Admin (§7.2)
- ✅ Celah otorisasi `PRINCIPAL_DECISION` (§5.3)
- ✅ `bun run db:seed`/`rag:ingest`/`ews:snapshot` memuat `.env.local` dengan benar (`tsx --env-file=.env.local`)
- ✅ Ekstensi `pgvector` dibuat otomatis (`bun run db:ensure-extensions`, dipanggil dari `db:migrate`)
- ✅ RBAC pola "role + kepemilikan" diterapkan di `journal.ts`, `smart-goals.ts`, `reflections.ts`, `psychometrics.ts` lewat `guards.ts` — termasuk menutup celah kritis di `updateSmartGoalProgressAction` yang sebelumnya tanpa cek role/kepemilikan sama sekali (§8).
- ✅ Konfigurasi API key AI Assistant kini lewat **UI**, bukan cuma env var — Panel Admin punya form untuk mengaktifkan provider (OpenAI/OpenRouter/Gemini/Custom) kapan pun dibutuhkan, default tetap offline (§5.2, §7.2). Env var `OPENAI_API_KEY` masih didukung sebagai fallback legacy untuk deploy tanpa UI (mis. env var Vercel).
- ✅ Sinkronisasi data Dapodik (Murid + Rombongan Belajar) — §5.5, §7.2. Client dibangun & diverifikasi terhadap instalasi Dapodik produksi nyata (bukan asumsi/SDK pihak ketiga); upsert idempotent teruji lewat mock server.
- ✅ Sinkronisasi GTK/PTK (guru) — §5.5. Auto-provisioning akun disetujui eksplisit oleh Kepala Sekolah/Admin (password sementara + wajib ganti di login pertama, dicocokkan via `ptk_id` karena `getPTK` tidak tersedia di instalasi yang diuji); hanya peran pengajaran yang disinkronkan sebagai akun.
- ✅ Penjadwalan otomatis sinkronisasi Dapodik — `/api/cron/dapodik-sync` + `vercel.json`, pola identik EWS snapshot.
- ✅ Dukungan Cloudflare Access Service Token di `dapodik.ts` — header opsional, dikonfigurasi lewat Panel Admin.
- ✅ Kelas → Wali Kelas — hanya rombel `jenis_rombel_str === "Kelas"` disinkronkan sebagai `classes`, `classes.waliKelasId` ditautkan otomatis lewat `ptk_id` (§5.5).
- ✅ NIP guru otomatis terisi lewat `getGtk` (endpoint tidak terdokumentasi resmi, ditemukan lewat pengujian empiris) — fill-if-empty, tidak menimpa NIP yang sudah diisi manual (§5.5).
- ✅ Reset-on-demand untuk password guru yang lupa (`resetUserPasswordAction`, tombol di kartu "Pengguna" Panel Admin) — dipakai juga untuk akun hasil sinkronisasi Dapodik, tanpa perlu menyimpan password plaintext permanen (§7.2, §11 poin 11).
- ✅ Siswa → Guru Wali lewat import Excel (opsi (a) dari tiga opsi yang didiskusikan — dipilih karena Dapodik terbukti belum mengekspos rombel Wali lewat webservice) — template dengan dropdown NIK/NISN + auto-lookup nama, dicocokkan lewat NIK/NISN, promosi role otomatis, ganti penugasan lama otomatis (§7.2).
- ✅ Lembar Identitas Murid Wali (Bagian A/B/C/D/E) + Matriks Rencana Kerja + upload SK Guru Wali & foto murid — ditemukan lewat analisis folder `referensi/` bahwa `student_profiles`/`student_academic_history`/`student_achievements`/`work_plan_items` sudah ada di skema sejak awal tapi 0% terhubung ke UI, dan `skFileUrl`/`photoUrl` tidak ada infrastruktur upload sama sekali (§7.0b, §7.0c).

**Yang masih terbuka** (audit jujur, supaya developer lanjutan tahu persis di mana berhenti):

1. **API key provider AI tetap butuh disediakan pemilik proyek** — sekarang sudah ada tempat untuk memasukkannya (`/dashboard/admin` → Konfigurasi AI Assistant, lihat §5.2/§7.2), tapi key itu sendiri (akun OpenAI/OpenRouter/Google AI Studio + kredit/billing) **bukan sesuatu yang bisa disediakan dari sisi kode**. Sistem tetap 100% fungsional tanpa itu (mode offline, default).
2. **Dashboard EWS masih baca skor live, bukan snapshot** — keputusan produk sadar (real-time > cepat untuk fitur keselamatan, lihat §5.4), bukan bug. Kalau skala murid per Guru Wali membesar signifikan (ratusan+) dan N+1 query jadi masalah nyata, revisit keputusan ini.
3. **Job EWS baru terjadwal kalau di-deploy ke Vercel** (`vercel.json`). Di luar Vercel, endpoint `/api/cron/ews-snapshot` sudah siap dipanggil scheduler manapun (cron/systemd timer + `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/ews-snapshot`), tapi scheduler-nya sendiri perlu disiapkan di infrastruktur deploy target.
4. **Instrumen psikometrik belum jadi sinyal EWS ke-5** — sengaja ditunda (§5.1) sampai ada keputusan produk soal bobot barunya; saat ini murni informasional.
5. **Panel Admin tidak bisa membuat sekolah baru** (multi-tenant lintas sekolah) — sengaja di luar cakupan karena model otorisasi saat ini (`admin.schoolId`) mengasumsikan satu admin mengelola satu sekolah; tidak ada role "super-admin lintas sekolah" di enum. Kalau dibutuhkan, perlu desain RBAC baru, bukan sekadar tambah form.
6. **Belum ada test untuk Server Actions / komponen UI** — `bun test` saat ini hanya menguji fungsi murni (`ticket-workflow.ts`, `ews.ts`, `psychometrics.ts`). Verifikasi Server Actions selama pengembangan ini dilakukan manual (script sekali-pakai + curl terhadap dev server), bukan test otomatis yang tersimpan — perlu setup test DB (mis. testcontainers) untuk membuatnya otomatis.
7. **Ambang batas & bobot masih estimasi pedagogis, bukan hasil kalibrasi data riil** — berlaku untuk `WEIGHTS` di `ews.ts` maupun ambang rasio di `psychometrics.ts`. Begitu ada data historis sekolah yang cukup, kalibrasi ulang keduanya.
8. **`ai-assistant.ts` dan `admin.ts` belum diaudit dengan pola guards yang sama** secara eksplisit dengan naming `isOwnActiveStudent` — `ai-assistant.ts` tidak menerima `studentId` sehingga tidak relevan, `admin.ts` sudah punya proteksi setara lewat `assertSameSchool()` (konteksnya beda: sekolah, bukan murid binaan). Dicatat di sini supaya jelas ini sudah ditinjau, bukan terlewat.
9. **Siswa → Guru Wali masih import manual periodik, bukan sinkron otomatis** — beda dengan Kelas → Wali Kelas Dapodik (§5.5, sudah otomatis tiap sinkronisasi), penugasan Guru Wali (fitur import Excel, §7.2) harus diunggah ulang manual tiap kali ada perubahan (guru wali baru masuk, rotasi tahun ajaran, dst.) — tidak ada jadwal otomatis. Ini karena Dapodik TERBUKTI belum mengekspos konsep "Wali" (fitur baru di UI Dapodik, ada anggota rombelnya persis seperti kelas biasa) lewat webservice sama sekali (`getRombonganBelajar` tidak punya rombel berjenis itu, dan tidak ada endpoint khusus seperti `getWali`/`getAnggotaWali` — semua dicoba, 404). Kalau suatu saat modul webservice diperbarui untuk mengekspos ini, sinkronisasi otomatis penuh (seperti Wali Kelas) baru mungkin diimplementasikan — sampai saat itu, import Excel adalah jalan terbaik yang tersedia.
10. **Satu konfigurasi per sekolah** (bukan riwayat/versi) — sinkronisasi ulang menimpa `lastSyncSummary` sebelumnya, tidak ada audit-trail per-field siapa-berubah-apa-kapan (beda dengan `ticket_events` untuk tiket). Rombel yang di Dapodik dihapus/di-nonaktifkan tidak otomatis menghapus/menonaktifkan `classes`/akun guru di SIGW (sinkronisasi ini cuma create/update/link, belum ada logika "penghapusan lunak" untuk data yang hilang dari Dapodik).
11. **Sinkronisasi otomatis (cron) yang membuat akun guru baru tidak menampilkan password sementaranya di mana pun** — hanya trigger manual dari Panel Admin yang menampilkan kotak kredensial sekali-lihat (§5.5). Kalau cron membuat akun baru tanpa ada admin yang memicu manual, satu-satunya jalan keluar saat ini adalah reset password akun itu secara manual. Kalau ini jadi masalah nyata (banyak guru baru masuk di luar siklus sinkronisasi manual), pertimbangkan notifikasi email otomatis ke admin berisi daftar akun baru (bukan passwordnya) supaya admin tahu harus reset & mendistribusikan akses.

---

## 10. Setup & Menjalankan Proyek

> **Deploy ke VPS Ubuntu produksi?** Lihat [DEPLOYMENT.md](DEPLOYMENT.md) — runbook detail siap-eksekusi (Nginx+SSL, systemd, PostgreSQL+pgvector self-hosted, cron via systemd timer). Bagian di bawah ini untuk setup lokal/development.

### Prasyarat
- **Bun** ≥ 1.4 (`packageManager: bun@1.4.2` di `package.json`)
- **PostgreSQL** dengan ekstensi **pgvector** *ter-install* di instance-nya (bukan cukup di-`CREATE EXTENSION` — binary pgvector harus ada; di Ubuntu/Debian: paket `postgresql-XX-pgvector`, atau image Docker `pgvector/pgvector`). `bun run db:migrate` akan otomatis menjalankan `CREATE EXTENSION IF NOT EXISTS vector` sebelum migrasi — tapi hanya bisa berhasil kalau binary-nya sudah ter-install di server Postgres-nya.

### Langkah
```bash
cd app
bun install

# .env.local sudah ada (DATABASE_URL + AUTH_SECRET + CRON_SECRET) — sesuaikan bila perlu
# credential default (dev saja, JANGAN dipakai di produksi):
#   postgresql://sigw_user:sigw_dev_pw_2026@localhost:5432/sigw

bun run db:migrate           # auto-ensure pgvector extension, lalu jalankan migrasi
bun run db:seed              # (opsional) isi data demo realistis, 5 role termasuk admin
bun run db:seed-instruments  # (opsional tapi disarankan) isi instrumen IKEM-12 — idempotent
bun run rag:ingest           # (opsional) ingest 3 PDF Buku Saku -> ai_knowledge_chunks
bun run ews:snapshot         # (opsional) hitung EWS batch untuk semua murid aktif -> ews_snapshots

bun run dev                  # http://localhost:3000
bun test                     # jalankan unit test (24 test: ticket-workflow, ews, psychometrics)
```

Login demo (setelah `db:seed`, semua pakai password `password123`):

| Email | Peran |
|---|---|
| `guruwali@sigw.test` | Guru Wali |
| `kepsek@sigw.test` | Kepala Sekolah |
| `gurubk@sigw.test` | Guru BK |
| `walikelas@sigw.test` | Wali Kelas |
| `admin@sigw.test` | Admin |

### Environment variables
| Var | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | connection string Postgres |
| `AUTH_SECRET` | ya | secret JWT NextAuth (`openssl rand -base64 32`) |
| `CRON_SECRET` | ya, untuk mengaktifkan `/api/cron/ews-snapshot` | endpoint fail-closed (menolak semua request) kalau var ini kosong — bukan diam-diam jalan tanpa proteksi. Generate: `openssl rand -hex 32`. |
| `OPENAI_API_KEY` | tidak | mempengaruhi **embedding RAG** (selalu, tidak bisa diganti lewat UI — lihat §5.2) DAN jadi fallback legacy untuk **jawaban chat** kalau belum ada provider aktif di Panel Admin. Jika kosong: embedding pakai hashing-trick lokal, chat pakai mode ekstraktif offline (kecuali admin mengaktifkan provider lewat UI). |

Di Vercel: tambahkan `CRON_SECRET` sebagai env var project, lalu `vercel.json` (`crons`) otomatis memanggil endpoint sesuai jadwal — Vercel sendiri yang mengirim header `Authorization` yang cocok untuk cron job miliknya.

**Mengaktifkan provider AI untuk jawaban chat** (opsional, kapan saja, tidak perlu redeploy): login sebagai `admin` → `/dashboard/admin` → kartu "Konfigurasi AI Assistant" → pilih provider (OpenAI/OpenRouter/Google Gemini/Custom), isi API key, simpan. Langsung aktif seketika itu juga.

### Perintah lain
| Perintah | Fungsi |
|---|---|
| `bun run db:generate` | generate migrasi baru dari perubahan `src/db/schema.ts` |
| `bun run db:ensure-extensions` | jalankan `CREATE EXTENSION IF NOT EXISTS vector` saja (bagian dari `db:migrate`, jarang perlu dipanggil manual) |
| `bun run ews:snapshot` | hitung ulang EWS batch untuk semua murid aktif, simpan ke `ews_snapshots` |
| `bun run db:seed-instruments` | isi/pastikan instrumen IKEM-12 ada (idempotent, aman dijalankan berkali-kali) |
| `bun test` | jalankan unit test (`bun:test`, tanpa dependensi tambahan) |
| `bun run lint` | ESLint |
| `bun run build` / `bun run start` | build & jalankan production |

### Menghubungkan Dapodik lewat Cloudflare Tunnel — Runbook

Web Service Dapodik cuma jalan di jaringan lokal sekolah (`http://localhost:5774` di komputer Dapodik). Kalau SIGW di-deploy di luar jaringan itu (mis. Vercel), butuh jembatan — **Cloudflare Tunnel** adalah pilihan yang sudah diverifikasi bekerja untuk deployment ini (contoh nyata: `smkn2malinau.my.id`). Runbook ini merangkum SEMUA masalah nyata yang ditemukan & diperbaiki saat setup pertama kali, supaya sekolah/deployment berikutnya tidak perlu mengulang proses debugging yang sama.

**Langkah dasar** (di komputer tempat Dapodik terpasang):
1. Install `cloudflared`, buat named tunnel via **Zero Trust dashboard → Networks → Tunnels**.
2. Tambahkan **Public Hostname**: Domain = domain Anda, Path = kosong/`*`, Service = `HTTP`, URL = `localhost:5774`.
3. Di aplikasi Dapodik: **Pengaturan → WebService → Add** — catat **Token** yang dihasilkan. Whitelist IP isi `127.0.0.1` (bukan `*`) karena yang benar-benar memanggil port 5774 selalu `cloudflared` di mesin yang sama.
4. Cari **NPSN** sekolah (8 digit) — tercantum di profil Dapodik atau referensi publik Kemendikbud.

**Verifikasi bertahap** (jangan lompat ke integrasi kode sebelum ini semua lolos):
```bash
# 1) Di komputer Dapodik, uji LANGSUNG dulu (tanpa tunnel):
curl.exe "http://localhost:5774/WebService/getSekolah?npsn=<NPSN>" -H "Authorization: Bearer <TOKEN>"
# Harus dapat JSON { "rows": { "nama": "...", ... } } — kalau masih "Access denied",
# cek token/IP whitelist di Pengaturan > WebService dulu, JANGAN lanjut ke tunnel.

# 2) Baru setelah (1) berhasil, uji LEWAT tunnel dari LUAR jaringan sekolah:
curl "https://<domain-tunnel-anda>/WebService/getSekolah?npsn=<NPSN>" -H "Authorization: Bearer <TOKEN>"
```

**Kalau langkah (2) masih menghasilkan respons aneh yang bukan dari Dapodik** (mis. "Hello World!" atau HTML sama sekali), periksa berurutan — ini persis alur diagnosis yang berhasil menemukan akar masalah di deployment nyata pertama:

1. **DNS record bentrok** — buka **dashboard Cloudflare biasa → domain Anda → DNS → Records**. Domain yang dipakai Tunnel WAJIB berupa **CNAME** ke `<tunnel-id>.cfargotunnel.com` (dibuat otomatis oleh dashboard Zero Trust saat menambah Public Hostname). Kalau ada **A record** manual untuk nama yang sama (mis. peninggalan setup lama), itu akan **mencegah** CNAME tunnel terbentuk/berfungsi sama sekali — DNS tidak mengizinkan CNAME dan record lain pada nama yang sama. **Hapus A record itu**, lalu hapus+tambah ulang Public Hostname di Tunnel supaya CNAME-nya ter-generate otomatis.
2. **Worker/Pages route mencegat domain** — buka **dashboard Cloudflare biasa → Workers & Pages** (atau menu **Compute** di UI yang lebih baru — namanya berubah-ubah antar versi dashboard Cloudflare). Worker Route punya prioritas **lebih tinggi** dari Tunnel di edge Cloudflare — kalau ada Worker dengan route `*<domain-anda>/*` (mis. peninggalan setup lama/vendor sebelumnya), SEMUA request akan dicegat Worker itu SEBELUM sempat sampai ke Tunnel, walau konfigurasi Tunnel-nya sendiri sudah 100% benar. Hapus/lepas route tersebut dari Worker (tidak perlu hapus Worker-nya kalau masih dipakai untuk keperluan lain).
3. **`cloudflared` belum benar-benar reconnect** — cek status **Healthy** di halaman daftar Tunnel + uptime-nya masuk akal (bukan berbulan-bulan kalau baru saja diubah). Restart service (`Restart-Service Cloudflared` di Windows, atau lewat Services.msc) kalau baru mengubah konfigurasi.
4. **Alias `curl` di Windows PowerShell** — `curl` di PowerShell adalah alias untuk `Invoke-WebRequest`, sintaks `-H "Key: Value"`-nya **tidak kompatibel** dengan curl asli. Selalu panggil `curl.exe` (bukan `curl`) di PowerShell untuk memastikan curl asli yang dipakai, terutama saat debugging header/auth.

**Keamanan** (baca sebelum mengekspos webservice internal ke internet):
- **Jangan** port-forward 5774 langsung ke IP publik router — itu mengekspos Apache/PHP versi lama (rawan, tidak dapat patch keamanan) langsung ke internet tanpa proteksi apa pun selain satu token statis. Selalu lewat Cloudflare Tunnel (origin IP sekolah tidak pernah terekspos).
- **Sangat disarankan**: tambahkan **Cloudflare Access** (Zero Trust → Access → Applications, pakai **Service Token** untuk akses server-ke-server, bukan login manusia) di depan hostname Tunnel — ini lapisan proteksi KEDUA di edge Cloudflare, di luar token Dapodik sendiri. Setelah dibuat di Cloudflare (Zero Trust → Access → **Service Auth** → Service Tokens), isi **Client Id** & **Client Secret** yang dihasilkan ke Panel Admin (`/dashboard/admin` → kartu Sinkronisasi Dapodik → bagian "Lapisan Keamanan Tambahan (Opsional)") — `dapodik.ts` otomatis mengirim header `CF-Access-Client-Id`/`CF-Access-Client-Secret` di setiap request begitu kedua field itu terisi (§5.5).

---

## 11. Prinsip untuk Developer Selanjutnya

1. **`src/db/schema.ts` adalah sumber kebenaran skema** — jangan duplikasi definisi kolom di dokumen manapun (termasuk dokumen ini); dokumen ini sengaja hanya merujuk, bukan menyalin, detail kolom.
2. **Jangan mengubah `tickets.status` langsung via `UPDATE`** — selalu lewat `transitionTicket()` + `runTicketAction()` di `tickets.ts` supaya invariant SOP (eskalasi kasus berat, Home Visit wajib) dan audit trail (`ticket_events`) tidak bisa dilanggar/terlewat.
3. **Pertahankan graceful degradation tanpa provider AI aktif** — setiap fitur AI baru harus punya jalur fallback yang tetap membuat fitur itu *berguna* (bukan sekadar "fitur nonaktif"), mengikuti pola `embedText()`/`generateAnswer()`. Kalau memanggil provider eksternal via `ai-providers.ts`, selalu bungkus dengan try/catch yang jatuh balik ke mode offline — jangan biarkan kegagalan provider (key salah, kuota habis, network down) menjadi error yang tampil ke pengguna.
4. **Jangan pernah biarkan konfigurasi provider chat (`ai_provider_configs`) memengaruhi embedding RAG.** Keduanya sengaja terpisah total (§5.2) — embedding hanya baca env var `OPENAI_API_KEY`/fallback lokal, tidak pernah baca tabel `ai_provider_configs`. Kalau suatu saat ingin bikin embedding juga bisa diganti provider lewat UI, itu perubahan desain besar (perlu strategi re-ingest ulang semua `ai_knowledge_chunks` setiap kali provider embedding berganti, supaya ruang vektornya tetap konsisten) — jangan sekadar "reuse" konfigurasi chat untuk itu.
5. **Setiap dokumen fisik baru dari `referensi/`** yang ingin didigitalkan → cek dulu apakah sudah ada tabel yang cocok (lihat tabel pemetaan di §1) sebelum membuat skema baru — kemungkinan besar sudah ada.
6. **Otorisasi = role DAN keterkaitan, bukan role saja.** Setiap Server Action yang menerima `studentId` (atau ID entitas lain) dari client **wajib** memverifikasi entitas itu benar terkait aktor — panggil `isOwnActiveStudent()`/`assertOwnActiveStudent()` dari `src/lib/actions/guards.ts` (jangan query `guru_wali_assignments` inline lagi, itu sudah dikonsolidasi ke sana). Untuk konteks di luar murid binaan (mis. admin lintas entitas sekolah), lihat pola `assertSameSchool()` di `admin.ts`. Mengecek role saja **tidak cukup** — payload `studentId`/`smartGoalId`/dll bisa dikirim langsung lewat request tanpa lewat `<select>` UI yang membatasi pilihan; celah nyata pernah ditemukan di `updateSmartGoalProgressAction` (§8) karena ini terlewat.
7. **Jangan panggil `computeEwsInputsForStudent()`/`calculateEws()` secara terpisah dari job snapshot** — kalau menambah sinyal EWS baru, tambahkan di `ews-inputs.ts` + `ews.ts` sekali saja; dashboard (live) dan `runEwsSnapshotJob()` (batch, dipakai script maupun endpoint cron) otomatis ikut konsisten karena keduanya memanggil fungsi yang sama.
8. **Setiap instrumen skrining/psikometrik baru** yang tidak divalidasi secara klinis **wajib** menyatakan batasannya secara eksplisit di UI dan komentar kode (pola: `sentiment.ts`, `psychometrics.ts`) — jangan biarkan hasil skor terlihat seperti diagnosis resmi.
9. **API key provider AI (`ai_provider_configs.apiKey`) sensitif — jangan pernah kirim utuh ke client.** Server Component yang query tabel ini wajib mask sebelum masuk ke JSX (pola `maskApiKey()` di `admin/page.tsx`); jangan buat endpoint/action yang mengembalikan key mentah untuk alasan apa pun (termasuk "biar admin bisa edit" — kalau perlu ganti, minta admin isi ulang key baru, bukan tampilkan yang lama).
10. **Menguji Server Action secara manual selama development**: karena belum ada test-DB otomatis (§9 poin 6), pola yang terbukti reliable adalah script sekali-pakai di `scripts/_verify-*.ts` (dihapus setelah dipakai) yang mengimpor logika langsung (termasuk fungsi dari `guards.ts`/adapter dari `ai-providers.ts` yang asli, bukan reimplementasi) dan query DB nyata/panggilan API nyata — lebih stabil daripada mensimulasikan form POST lewat curl ke dev server (rawan gagal karena action-manifest Turbopack berubah saat hot-reload).
11. **Password sementara (temp password) — SELALU reset-on-demand, JANGAN PERNAH simpan plaintext permanen.** Pola ini dipakai di dua tempat (`generateTempPassword()` di `src/lib/temp-password.ts`, dipakai `dapodik-sync-job.ts` untuk akun guru baru & `resetUserPasswordAction` di `admin.ts`): tampilkan plaintext SEKALI di respons Server Action tepat setelah dibuat, hanya bcrypt hash-nya yang masuk DB, tidak ada UI/kolom apa pun yang bisa memunculkannya lagi setelahnya. Kalau ada permintaan "tampilkan terus"/"biar admin bisa lihat lagi nanti" — itu berarti menyimpan password yang bisa dibaca ulang sistem, yang artinya SATU kebocoran (database atau sesi admin) membongkar SEMUA password sekaligus. Solusinya selalu "reset lagi kapan pun dibutuhkan", bukan "simpan supaya bisa dilihat lagi".
