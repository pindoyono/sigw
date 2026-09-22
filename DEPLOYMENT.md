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

bun run build                 # build production (.next/)
```

> **Jangan jalankan `bun run db:seed`** di server produksi — itu mengisi data DEMO (sekolah palsu "SMP Negeri 1 Contoh", 5 akun dengan password `password123`). Untuk sekolah sungguhan, ikuti §7 di bawah untuk membuat sekolah & admin pertama yang benar.

### 6a. Inisialisasi Sekolah & Admin Pertama (WAJIB, sekali saja)

SIGW saat ini **belum punya form "buat sekolah baru"** di UI (satu deployment = satu sekolah, lihat §9 ARCHITECTURE.md) — jadi baris `schools` pertama & akun admin pertama harus dibuat lewat `db:seed`, lalu dibersihkan/disesuaikan manual:

```bash
bun run db:seed   # SEKALI SAJA — bikin 1 sekolah + 5 akun demo (termasuk admin@sigw.test / password123)
```

Login ke `https://<domain-anda>/login` dengan `admin@sigw.test` / `password123`, lalu:

1. **Ganti password admin**: di Panel Admin → kartu "Pengguna" → baris `admin@sigw.test` → tombol **Reset Password** → catat password sementara yang muncul → logout → login lagi pakai password sementara itu → sistem otomatis mengarahkan ke halaman **Ganti Kata Sandi** → set password pilihan Anda sendiri.
2. **Perbaiki data sekolah** (belum ada UI untuk ini — lewat SQL langsung):
   ```bash
   sudo -u postgres psql -d sigw -c "UPDATE schools SET name = 'Nama Sekolah Anda', npsn = '12345678', address = 'Alamat Sekolah' WHERE name = 'SMP Negeri 1 Contoh';"
   ```
3. **Hapus akun & data demo** yang tidak dipakai (4 akun guru demo + 5 murid demo beserta data terkaitnya — aman dihapus, tidak menyentuh akun admin yang sudah Anda perbaiki di langkah 1):
   ```bash
   sudo -u postgres psql -d sigw <<'EOF'
   DELETE FROM students WHERE nisn IN ('0031234561','0031234562','0031234563','0031234564','0031234565');
   DELETE FROM users WHERE email IN ('guruwali@sigw.test','kepsek@sigw.test','gurubk@sigw.test','walikelas@sigw.test');
   EOF
   ```
4. Kalau sekolah Anda memakai Dapodik, lanjut ke `/dashboard/admin` → kartu **Sinkronisasi Dapodik** untuk menarik data murid/kelas/guru sungguhan (lihat §5.5 ARCHITECTURE.md) — ini akan menggantikan kebutuhan input manual lebih lanjut.

---

## 7. Jalankan Aplikasi lewat systemd

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
