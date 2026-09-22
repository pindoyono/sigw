/**
 * Mengisi definisi instrumen asesmen diagnostik (bukan data demo — ini data
 * referensi/konfigurasi yang seharusnya ada di setiap environment, produksi
 * maupun development). Idempotent: aman dijalankan berkali-kali (cek `code`
 * dulu sebelum insert).
 *
 * Jalankan dengan: bun run db:seed-instruments
 *
 * ⚠️ IKEM-12 adalah instrumen skrining awal BUATAN INTERNAL untuk membantu
 * Guru Wali memprioritaskan tindak lanjut — bukan alat diagnostik klinis
 * tervalidasi. Lihat catatan lengkap di `src/lib/psychometrics.ts`.
 */
import { db } from "../src/db";
import { psychometricInstruments, type PsychometricItem } from "../src/db/schema";
import { eq } from "drizzle-orm";

const IKEM_ITEMS: PsychometricItem[] = [
  { id: "e1", text: "Saya merasa sedih atau murung dalam beberapa hari terakhir.", subscale: "emosi" },
  { id: "e2", text: "Saya merasa marah atau kesal tanpa alasan yang jelas.", subscale: "emosi" },
  { id: "e3", text: "Saya merasa cemas atau khawatir berlebihan.", subscale: "emosi" },
  { id: "e4", text: "Saya merasa lelah secara emosional, bukan cuma fisik.", subscale: "emosi" },
  { id: "s1", text: "Saya merasa sendirian meskipun berada di antara teman-teman.", subscale: "sosial" },
  { id: "s2", text: "Saya menghindari berbicara dengan teman atau guru.", subscale: "sosial" },
  { id: "s3", text: "Saya merasa tidak ada yang benar-benar memahami saya.", subscale: "sosial" },
  { id: "s4", text: "Saya mengalami konflik atau masalah dengan teman belakangan ini.", subscale: "sosial" },
  { id: "a1", text: "Saya sulit berkonsentrasi saat belajar di kelas.", subscale: "akademik" },
  { id: "a2", text: "Saya kehilangan minat pada kegiatan yang biasanya saya sukai.", subscale: "akademik" },
  { id: "a3", text: "Saya merasa kesulitan tidur atau pola tidur saya berubah.", subscale: "akademik" },
  { id: "a4", text: "Saya merasa tidak sanggup mengikuti tuntutan sekolah akhir-akhir ini.", subscale: "akademik" },
];

async function main() {
  const [existing] = await db.select().from(psychometricInstruments).where(eq(psychometricInstruments.code, "IKEM-12"));
  if (existing) {
    console.log("IKEM-12 sudah ada, dilewati.");
    process.exit(0);
  }

  await db.insert(psychometricInstruments).values({
    code: "IKEM-12",
    name: "Instrumen Skrining Kesejahteraan Emosional Murid (IKEM-12)",
    description:
      "Skrining awal 12 butir untuk membantu Guru Wali memprioritaskan tindak lanjut pendampingan. " +
      "BUKAN alat diagnostik klinis tervalidasi — hasil 'tinggi' berarti perlu didiskusikan lebih lanjut " +
      "(mis. dengan Guru BK), bukan diagnosis final.",
    scaleMin: 1,
    scaleMax: 4,
    scaleLabels: ["Tidak Pernah", "Kadang-kadang", "Sering", "Selalu"],
    items: IKEM_ITEMS,
  });

  console.log("Instrumen IKEM-12 berhasil ditambahkan (12 butir, 3 subskala: emosi, sosial, akademik).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
