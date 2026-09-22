import { auth } from "@/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@/db/schema";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  kepala_sekolah: "Kepala Sekolah",
  guru_wali: "Guru Wali",
  guru_bk: "Guru BK",
  wali_kelas: "Wali Kelas",
  guru_mapel: "Guru Mapel",
};

/** Menu per peran — halaman Guru Wali hanya render lengkap untuk role itu sendiri (lihat masing-masing page.tsx). */
const GURU_WALI_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/tickets", label: "Tiket Kolaborasi" },
  { href: "/dashboard/smart-goals", label: "Target SMART" },
  { href: "/dashboard/journal", label: "Jurnal" },
  { href: "/dashboard/reflections", label: "Refleksi Murid" },
  { href: "/dashboard/psychometric", label: "Instrumen Asesmen" },
  { href: "/dashboard/ai-assistant", label: "AI Assistant" },
];

const COLLABORATOR_NAV = [{ href: "/dashboard/collaboration", label: "Tiket Kolaborasi" }];
const ADMIN_NAV = [{ href: "/dashboard/admin", label: "Panel Admin" }];
const HELP_NAV_ITEM = { href: "/dashboard/help", label: "Panduan" };

function navForRole(role: UserRole) {
  if (role === "guru_wali") return [...GURU_WALI_NAV, HELP_NAV_ITEM];
  if (role === "admin") return [...ADMIN_NAV, HELP_NAV_ITEM];
  if (role === "kepala_sekolah" || role === "guru_bk" || role === "wali_kelas" || role === "guru_mapel") {
    return [...COLLABORATOR_NAV, HELP_NAV_ITEM];
  }
  return [HELP_NAV_ITEM];
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const nav = navForRole(session.user.role);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-slate-900">SIGW · Sistem Informasi Guru Wali</span>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-slate-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {ROLE_LABELS[session.user.role]}
            </span>
            <span className="text-sm text-slate-600">{session.user.name}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Keluar
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
