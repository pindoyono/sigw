# Deploy SIGW ke VPS Ubuntu

Panduan ini untuk deploy SIGW **mandiri** di VPS Ubuntu (bukan Vercel) — Nginx sebagai reverse proxy + SSL, PostgreSQL+pgvector self-hosted, `bun run start` dijaga systemd, dan dua cron job (EWS snapshot + sinkronisasi Dapodik) lewat systemd timer. Setiap blok kode di bawah bisa disalin-tempel langsung secara berurutan.

Referensi arsitektur aplikasinya sendiri ada di [ARCHITECTURE.md](ARCHITECTURE.md) — dokumen ini murni operasional (cara menjalankannya di server), bukan penjelasan cara kerja fitur.

---

## 0. Asumsi & Prasyarat

- **Ubuntu 24.04 LTS** (22.04 juga cocok, perintah sama) di VPS baru — akses root/sudo via SSH.
- Minimum **2 vCPU / 2 GB RAM / 20 GB disk** (naikkan RAM kalau data murid & vektor RAG-nya besar).
- Domain yang A record-nya sudah diarahkan ke IP VPS (untuk SSL Let's Encrypt). Tanpa domain tetap bisa jalan lewat IP+port, tapi tanpa HTTPS — **tidak disarankan untuk produksi** karena ada login/password.
- Kode SIGW ada di repo Git yang bisa diakses dari server (mis. `github.com/<akun-anda>/sigw`).

Ganti setiap `<PLACEHOLDER>` di bawah dengan nilai Anda sendiri sebelum menjalankan.

---

## 1. Setup Awal Server

Login sebagai root lewat SSH, lalu:

```bash
apt update && apt upgrade -y

# Timezone server diset ke UTC SENGAJA — supaya jadwal cron di §8 nanti
# sama persis angkanya dengan yang dulu dipakai di vercel.json (semua UTC),
# tidak perlu konversi zona waktu manapun.
timedatectl set-timezone UTC

# User non-root untuk menjalankan aplikasi (jangan jalankan Next.js sebagai root)
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy

# Firewall — hanya SSH, HTTP, HTTPS yang boleh diakses dari luar
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

Mulai dari sini, kerjakan sebagai user `deploy` (bukan root) untuk langkah-langkah yang tidak butuh `sudo`:

```bash
su - deploy
```

---

## 2. Install PostgreSQL + pgvector

```bash
sudo apt install -y postgresql postgresql-contrib

# Cek versi Postgres yang ter-install (biasanya 16 di Ubuntu 24.04)
psql --version

# Paket pgvector resmi mengikuti nomor versi Postgres-nya — ganti "16" kalau versi Anda beda
sudo apt install -y postgresql-16-pgvector
```

Buat database & user khusus SIGW:

```bash
sudo -u postgres psql <<'EOF'
CREATE USER sigw_user WITH PASSWORD 'GANTI_DENGAN_PASSWORD_KUAT';
CREATE DATABASE sigw OWNER sigw_user;
\c sigw
CREATE EXTENSION IF NOT EXISTS vector;
EOF
```

> `CREATE EXTENSION vector` di sini cuma verifikasi awal bahwa binary pgvector-nya benar-benar ter-install dan bisa diaktifkan — `bun run db:migrate` nanti akan menjalankan `CREATE EXTENSION IF NOT EXISTS vector` lagi secara otomatis tiap migrasi (aman, idempotent), jadi tidak masalah kalau langkah ini dijalankan lagi.

**Jangan expose port 5432 ke luar** — default Ubuntu Postgres sudah `listen_addresses = 'localhost'` (cek `/etc/postgresql/16/main/postgresql.conf` kalau ragu). Karena aplikasi & database jalan di server yang sama, `localhost` sudah cukup — tidak perlu buka port 5432 di firewall.

---

## 3. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc   # atau buka ulang sesi SSH
bun --version       # pastikan >= 1.4
```

---

## 4. Ambil Kode

```bash
sudo mkdir -p /var/www/sigw
sudo chown deploy:deploy /var/www/sigw
git clone https://github.com/<akun-anda>/sigw.git /var/www/sigw
cd /var/www/sigw
```

---

## 5. Environment Variables

```bash
cat > /var/www/sigw/.env.local <<'EOF'
DATABASE_URL="postgresql://sigw_user:GANTI_DENGAN_PASSWORD_KUAT@localhost:5432/sigw"
AUTH_SECRET="GANTI_HASIL_OPENSSL_DI_BAWAH"
CRON_SECRET="GANTI_HASIL_OPENSSL_DI_BAWAH"
EOF

# Generate dua secret di atas, lalu tempel ke file .env.local (jangan pakai nilai contoh):
openssl rand -base64 32   # -> untuk AUTH_SECRET
openssl rand -hex 32      # -> untuk CRON_SECRET

chmod 600 /var/www/sigw/.env.local   # hanya user deploy yang bisa baca
```

| Var | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | connection string Postgres dari langkah 2 |
| `AUTH_SECRET` | ya | secret JWT NextAuth — tanpa ini `next build`/`next start` akan gagal di production |
| `CRON_SECRET` | ya, supaya endpoint cron aktif | endpoint `/api/cron/*` **fail-closed** (menolak semua request) kalau var ini kosong — dipakai lagi di §8 |
| `OPENAI_API_KEY` | tidak | opsional, untuk embedding RAG (§5.2 ARCHITECTURE.md) — sistem tetap 100% jalan tanpa ini (mode offline). Kalau mau diisi, tambahkan baris `OPENAI_API_KEY="sk-..."` ke `.env.local` yang sama. |

---

## 6. Install Dependencies, Migrasi, Build

```bash
cd /var/www/sigw
bun install

bun run db:migrate            # bikin extension pgvector + jalankan semua migrasi
bun run db:seed-instruments   # isi instrumen asesmen IKEM-12 (idempotent, aman diulang)

# Folder upload berkas (SK Guru Wali, foto murid) — path STATIS relatif ke root aplikasi
# (lihat src/lib/file-storage.ts), bukan public/, jadi harus ada & writable sebelum dipakai.
# TIDAK ikut `git pull` (di .gitignore) — backup terpisah dari kode, lihat catatan di bawah.
mkdir -p uploads/sk-guru-wali uploads/student-photo

bun run build                 # build production (.next/)
```

> **Backup**: folder `uploads/` berisi dokumen SK & foto murid asli — **tidak ada di git, tidak ikut ter-backup otomatis lewat `git pull`**. Masukkan ke rutinitas backup terpisah (mis. `rsync`/`tar` berkala ke storage lain), sama pentingnya dengan backup database.

> **Jangan jalankan `bun run db:seed`** di server produksi — itu mengisi data DEMO (sekolah palsu "SMP Negeri 1 Contoh", 5 akun dengan password `password123`). SIGW sekarang **multi-tenant** (§3.5 ARCHITECTURE.md) — untuk sekolah sungguhan, cukup buka halaman pendaftaran di langkah §6a, `db:seed` sudah tidak diperlukan sama sekali untuk deploy produksi.

### 6a. Daftarkan Sekolah & Admin Pertama (WAJIB, sekali per sekolah)

SIGW mendukung banyak sekolah dalam satu deployment yang sama — setiap sekolah daftar sendiri lewat halaman publik `/register` (lihat ARCHITECTURE.md §3.5), tidak perlu lagi lewat `db:seed`/SQL manual seperti versi sebelumnya:

1. Buka `https://<domain-anda>/register`.
2. Isi **Data Sekolah**: Nama Sekolah, NPSN (wajib, dicek harus belum terdaftar — siapkan NPSN asli sekolah Anda karena dipakai lagi nanti saat setup Sinkronisasi Dapodik), Alamat (opsional).
3. Isi **Akun Admin Pertama**: Nama, Email, Kata Sandi (pilih sendiri, minimal 8 karakter) + Konfirmasi.
4. Klik **Daftarkan Sekolah** — Anda otomatis login dan langsung masuk ke Panel Admin, TIDAK perlu login manual terpisah.
5. Lanjut lengkapi data di Panel Admin: Tahun Ajaran → Kelas → Murid → Pengguna (guru-guru lain), atau kalau sekolah Anda memakai Dapodik, langsung ke kartu **Sinkronisasi Dapodik** untuk menarik data murid/kelas/guru sungguhan (lihat §5.5 ARCHITECTURE.md) — ini menggantikan kebutuhan input manual lebih lanjut.

> **Catatan keamanan**: pendaftaran ini SENGAJA langsung aktif tanpa approval (keputusan produk, lihat ARCHITECTURE.md §3.5 poin 11) — siapa pun yang tahu URL `/register` bisa mendaftarkan sekolah. Kalau ini jadi perhatian (mis. domain Anda publik & ingin dibatasi), pertimbangkan membatasi akses `/register` lewat Nginx (misal `allow`/`deny` IP, atau basic auth sementara) di luar kode aplikasi.

---

## 7. Jalankan Aplikasi lewat systemd

> **Kalau VPS ini dipakai bersama aplikasi lain** (bukan dedicated satu-aplikasi seperti asumsi panduan ini) — cek dulu port 3000 tidak dipakai proses lain (`ss -ltnp | grep :3000`) sebelum lanjut, atau ganti `PORT` di bawah. Kalau host itu sudah pakai PM2 untuk aplikasi Node lain (bukan systemd), lebih konsisten menambahkan SIGW ke PM2 juga lewat `ecosystem.config.js` di root proyek (`pm2 start ecosystem.config.js && pm2 save`) daripada mencampur 2 process manager berbeda di server yang sama — sesuaikan `PORT` di file itu ke port yang bebas.

```bash
sudo tee /etc/systemd/system/sigw.service > /dev/null <<'EOF'
[Unit]
Description=SIGW - Sistem Informasi Guru Wali
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/sigw
EnvironmentFile=/var/www/sigw/.env.local
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/home/deploy/.bun/bin/bun run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sigw.service
sudo systemctl status sigw.service   # pastikan "active (running)"
```

Cek log kapan pun dibutuhkan:

```bash
sudo journalctl -u sigw.service -f
```

Aplikasi sekarang jalan di `http://127.0.0.1:3000` (belum bisa diakses dari luar — itu tugas Nginx di §8).

---

## 8. Reverse Proxy (Nginx) + SSL

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/sigw > /dev/null <<'EOF'
server {
    listen 80;
    server_name <domain-anda>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/sigw /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Terbitkan sertifikat SSL & aktifkan auto-redirect HTTP->HTTPS (interaktif, ikuti prompt-nya)
sudo certbot --nginx -d <domain-anda>
```

Certbot otomatis memasang timer renewal (`systemctl list-timers | grep certbot`) — tidak perlu perpanjang manual.

Verifikasi: buka `https://<domain-anda>/login` di browser — halaman login SIGW harus muncul dengan gembok SSL valid.

---

## 9. Cron Job (EWS Snapshot & Sinkronisasi Dapodik) lewat systemd timer

Di Vercel ini otomatis lewat `vercel.json` (§5.4/§5.5 ARCHITECTURE.md) — di VPS mandiri, dua endpoint yang sama dipicu pakai systemd timer + `curl`. Jadwalnya SENGAJA disamakan persis dengan `vercel.json` (keduanya UTC, sudah cocok karena server di-set UTC di §1):

```bash
# --- EWS Snapshot: tiap hari 20:00 UTC ---
sudo tee /etc/systemd/system/sigw-ews-snapshot.service > /dev/null <<'EOF'
[Unit]
Description=SIGW - Trigger EWS Snapshot
After=network.target sigw.service

[Service]
Type=oneshot
EnvironmentFile=/var/www/sigw/.env.local
ExecStart=/usr/bin/curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://127.0.0.1:3000/api/cron/ews-snapshot
EOF

sudo tee /etc/systemd/system/sigw-ews-snapshot.timer > /dev/null <<'EOF'
[Unit]
Description=Jadwal EWS Snapshot (20:00 UTC harian)

[Timer]
OnCalendar=*-*-* 20:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# --- Sinkronisasi Dapodik: tiap hari 20:30 UTC ---
sudo tee /etc/systemd/system/sigw-dapodik-sync.service > /dev/null <<'EOF'
[Unit]
Description=SIGW - Trigger Sinkronisasi Dapodik
After=network.target sigw.service

[Service]
Type=oneshot
EnvironmentFile=/var/www/sigw/.env.local
ExecStart=/usr/bin/curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://127.0.0.1:3000/api/cron/dapodik-sync
EOF

sudo tee /etc/systemd/system/sigw-dapodik-sync.timer > /dev/null <<'EOF'
[Unit]
Description=Jadwal Sinkronisasi Dapodik (20:30 UTC harian)

[Timer]
OnCalendar=*-*-* 20:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sigw-ews-snapshot.timer sigw-dapodik-sync.timer
systemctl list-timers | grep sigw   # cek kedua timer terjadwal
```

> ⚠️ **Sinkronisasi Dapodik otomatis bisa membuat akun guru baru** (§5.5 ARCHITECTURE.md) — password sementaranya HANYA muncul di respons saat itu juga, tidak tersimpan di mana pun. Kalau timer ini yang memicu (bukan klik manual Admin), password itu tidak ada yang melihat — solusinya reset manual lewat Panel Admin kalau ada guru baru yang belum bisa login (lihat §7.2 ARCHITECTURE.md, tombol **Reset Password**). Ini bukan bug, memang trade-off keamanan yang disengaja (lihat §11 poin 11 ARCHITECTURE.md).

Uji manual salah satu timer tanpa menunggu jadwalnya:

```bash
sudo systemctl start sigw-ews-snapshot.service
sudo journalctl -u sigw-ews-snapshot.service -n 20
```

---

## 10. Verifikasi Akhir

```bash
# Aplikasi hidup & merespons
curl -sI https://<domain-anda>/login | head -1        # harus HTTP/2 200

# Service & timer semua aktif
sudo systemctl is-active sigw.service nginx postgresql
systemctl list-timers | grep sigw

# Endpoint cron menolak request tanpa token yang benar (fail-closed, seperti didesain)
curl -s https://<domain-anda>/api/cron/ews-snapshot   # harus {"error":"Unauthorized"} atau 401/503, BUKAN data
```

Login ke `https://<domain-anda>/login` dengan akun admin yang sudah Anda perbaiki di §6a, lalu jalankan sinkronisasi Dapodik pertama (kalau dipakai) lewat Panel Admin.

---

## 11. Update / Redeploy (perubahan kode berikutnya)

```bash
cd /var/www/sigw
git pull
bun install                # kalau ada dependency baru
bun run db:migrate         # kalau ada migrasi skema baru — AMAN dijalankan berulang, cuma menerapkan migrasi yang belum jalan
bun run build
sudo systemctl restart sigw.service
sudo systemctl status sigw.service
```

---

## 12. Troubleshooting Umum

| Gejala | Kemungkinan Penyebab | Solusi |
|---|---|---|
| `sigw.service` gagal start, log bilang `AUTH_SECRET` kosong | `.env.local` tidak terbaca / salah path | Cek `EnvironmentFile` di unit systemd menunjuk persis ke `/var/www/sigw/.env.local`, dan file itu ada + terisi |
| `bun run db:migrate` error `extension "vector" is not available` | Paket `postgresql-XX-pgvector` belum ter-install atau versi Postgres-nya beda dari paket yang diinstall | `psql --version` untuk cek versi asli, install ulang `postgresql-<versi>-pgvector` yang cocok |
| Nginx 502 Bad Gateway | `sigw.service` belum jalan / crash | `sudo systemctl status sigw.service` + `sudo journalctl -u sigw.service -n 50` |
| Endpoint `/api/cron/*` selalu balas 503 | `CRON_SECRET` kosong di `.env.local` (fail-closed by design, lihat §5.4/§5.5 ARCHITECTURE.md) | Isi `CRON_SECRET`, `sudo systemctl restart sigw.service` |
| Certbot gagal terbitkan sertifikat | Domain belum resolve ke IP VPS ini, atau port 80 tertutup firewall | `dig <domain-anda>` cek DNS sudah propagate, pastikan `ufw allow 80/tcp` sudah dijalankan |
| Login gagal terus padahal password benar | Salah jalankan `db:seed` dua kali (bikin sekolah/akun duplikat) — jarang terjadi karena tidak ada unique constraint pemicu error di `schools`, tapi bisa bikin bingung akun mana yang aktif | Cek `SELECT id, name FROM schools;` — kalau ada lebih dari satu baris tak terduga, itu tandanya `db:seed` sempat dijalankan berkali-kali; hapus yang tidak dipakai |

---

## Ringkasan Peta Layanan

```
Internet (443) → Nginx (SSL termination) → 127.0.0.1:3000 (bun run start, dijaga sigw.service)
                                                    ↓
                                          PostgreSQL (localhost:5432, pgvector)

sigw-ews-snapshot.timer  ──20:00 UTC──▶ curl localhost:3000/api/cron/ews-snapshot
sigw-dapodik-sync.timer  ──20:30 UTC──▶ curl localhost:3000/api/cron/dapodik-sync
```
