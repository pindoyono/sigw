import { auth } from "@/auth";
import { getPelaksanaanTahunanData, renderPelaksanaanTahunanPdf, renderPelaksanaanTahunanDocx } from "@/lib/reports/pelaksanaan-tahunan";

export const dynamic = "force-dynamic";

/**
 * Laporan Pelaksanaan Tahunan (bukti fisik "Penyusunan Laporan Pelaksanaan
 * Tahunan" di Matriks Rencana Kerja, §7.0d) — kompilasi OTOMATIS dari 5
 * komponen resmi yang disebut Buku 1 §1.14 sebagai acuan isi Jurnal Guru
 * Wali: (a) Lembar Identitas Murid Wali, (b) Konsultasi Perwalian,
 * (c) Kolaborasi, (d) Bimbingan Kelompok, (e) Kunjungan Rumah — SEMUANYA
 * data yang sudah diisi Guru Wali sepanjang tahun lewat menu Jurnal &
 * Murid Saya, BUKAN ditulis ulang manual. Plus 1 bagian tambahan (Progres
 * Target SMART) karena datanya sudah ada dan relevan sebagai bukti hasil.
 *
 * `?format=pdf` (default) atau `?format=docx` — Word ditawarkan supaya bisa
 * diedit/ditambah catatan sebelum dicetak (mis. Kepsek ingin menambahkan
 * catatan), keduanya menarik dari `getPelaksanaanTahunanData()` yang sama.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return Response.json({ error: "Hanya Guru Wali yang dapat mengunduh laporan ini." }, { status: 403 });
  }

  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const data = await getPelaksanaanTahunanData(session.user.id, session.user.schoolId);

  if (format === "docx") {
    const buffer = await renderPelaksanaanTahunanDocx(data);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Laporan Pelaksanaan Tahunan - ${data.teacherName}.docx"`,
      },
    });
  }

  const buffer = await renderPelaksanaanTahunanPdf(data);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Laporan Pelaksanaan Tahunan - ${data.teacherName}.pdf"`,
    },
  });
}
