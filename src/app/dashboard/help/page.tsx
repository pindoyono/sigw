import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { HelpCenter } from "@/components/dashboard/help/help-center";

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Panduan Pengguna SIGW</h1>
        <p className="text-sm text-slate-500">
          Penjelasan lengkap setiap fitur, disusun per peran. Panduan untuk peran Anda saat ini terbuka secara
          otomatis — tapi Anda bebas melihat panduan peran lain juga, misalnya untuk memahami alur kerja lintas
          peran.
        </p>
      </div>
      <HelpCenter defaultRole={session.user.role} />
    </div>
  );
}
