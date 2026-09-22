import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Ganti Kata Sandi</CardTitle>
          <CardDescription>
            {session.user.mustChangePassword
              ? "Akun Anda dibuat otomatis lewat sinkronisasi Dapodik dengan kata sandi sementara. Ganti dulu dengan kata sandi Anda sendiri sebelum melanjutkan ke dashboard."
              : "Perbarui kata sandi akun Anda."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
