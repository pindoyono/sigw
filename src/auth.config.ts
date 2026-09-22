import type { NextAuthConfig } from "next-auth";

/**
 * Konfigurasi edge-safe (tanpa import DB) — dipakai oleh middleware.
 * Provider dengan akses database ditambahkan terpisah di `src/auth.ts`.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      if (!isOnDashboard) return true;
      if (!isLoggedIn) return false;

      // Akun yang baru dibuat otomatis oleh sinkronisasi GTK/PTK Dapodik (lihat dapodik-sync-job.ts)
      // wajib ganti password sementara sebelum bisa mengakses halaman dashboard lain.
      const onChangePasswordPage = request.nextUrl.pathname === "/dashboard/change-password";
      if (auth.user.mustChangePassword && !onChangePasswordPage) {
        return Response.redirect(new URL("/dashboard/change-password", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.schoolId = user.schoolId;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.schoolId = token.schoolId;
        session.user.mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
};
