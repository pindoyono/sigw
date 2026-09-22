import { auth } from "@/auth";
import { db } from "@/db";
import { workPlanItems, schoolYears } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkPlanTable } from "@/components/dashboard/work-plan-table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WorkPlanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "guru_wali") redirect("/dashboard");

  const [activeYear] = await db.select().from(schoolYears).where(and(eq(schoolYears.schoolId, session.user.schoolId), eq(schoolYears.isActive, true)));

  const items = activeYear
    ? await db.select().from(workPlanItems).where(and(eq(workPlanItems.teacherId, session.user.id), eq(workPlanItems.schoolYearId, activeYear.id)))
    : [];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Matriks Rencana Kerja</CardTitle>
          <CardDescription>
            {activeYear
              ? `Peta jalan kegiatan pendampingan tahun ajaran ${activeYear.name}, bulan Juli–Juni.`
              : "Belum ada Tahun Ajaran aktif — hubungi Admin."}
          </CardDescription>
        </CardHeader>
        <CardContent>{activeYear && <WorkPlanTable items={items} />}</CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Unduh Laporan</CardTitle>
          <CardDescription>
            Dibuat otomatis dari data yang sudah Anda isi — tidak perlu menulis ulang manual. Cetak, tanda tangani, lalu
            simpan sebagai bukti fisik sesuai Matriks Rencana Kerja di atas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <a href="/api/reports/laporan-perencanaan" className={cn(buttonVariants({ variant: "outline" }))}>
            Unduh Laporan Perencanaan
          </a>
          <a href="/api/reports/laporan-pelaksanaan-tahunan" className={cn(buttonVariants({ variant: "outline" }))}>
            Unduh Laporan Pelaksanaan Tahunan
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
