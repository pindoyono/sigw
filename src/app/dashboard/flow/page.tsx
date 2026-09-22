import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowChart } from "@/components/dashboard/flow/flow-chart";

export default async function FlowPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Alur Kerja SIGW</CardTitle>
          <CardDescription>
            Diagram alur kerja SIGW dari awal (Admin menyiapkan data) sampai penanganan kasus murid selesai — lintas semua peran.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FlowChart currentRole={session.user.role} />
        </CardContent>
      </Card>
    </div>
  );
}
