import { auth } from "@/auth";
import { getPerencanaanData, renderPerencanaanPdf, renderPerencanaanExcel } from "@/lib/reports/perencanaan";

export const dynamic = "force-dynamic";

/**
 * Laporan Perencanaan (bukti fisik "Menyusun Laporan Perencanaan" di Matriks
 * Rencana Kerja, §7.0d) — kompilasi OTOMATIS dari data yang sudah ada di
 * sistem (daftar murid binaan + Matriks Rencana Kerja terisi), BUKAN dokumen
 * yang ditulis manual dari nol. Referensi: Buku 1 §1.14 — belum ada format
 * baku resmi, jadi kompilasi terstruktur seperti ini sah dipakai.
 *
 * `?format=pdf` (default) atau `?format=xlsx` — user memilih lewat 2 tombol
 * unduh di `/dashboard/work-plan`, bukan 2 route terpisah, supaya kedua
 * format menarik dari 1 sumber data yang SAMA (`getPerencanaanData`), tidak
 * mungkin drift antar format seperti kalau logic-nya diduplikasi.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "guru_wali") {
    return Response.json({ error: "Hanya Guru Wali yang dapat mengunduh laporan ini." }, { status: 403 });
  }

  const format = new URL(request.url).searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  const data = await getPerencanaanData(session.user.id, session.user.schoolId);

  if (format === "xlsx") {
    const buffer = await renderPerencanaanExcel(data);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Laporan Perencanaan - ${data.teacherName}.xlsx"`,
      },
    });
  }

  const buffer = await renderPerencanaanPdf(data);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Laporan Perencanaan - ${data.teacherName}.pdf"`,
    },
  });
}
