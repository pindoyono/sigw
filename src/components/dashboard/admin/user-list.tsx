"use client";

import { useActionState } from "react";
import { resetUserPasswordAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export interface UserListRow {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  isActive: boolean;
}

function UserRow({ user }: { user: UserListRow }) {
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, undefined);

  return (
    <li className="flex flex-col gap-1 py-1">
      <div className="flex items-center justify-between gap-2">
        <span>
          {user.name} · {user.email} · <span className="font-medium">{user.roleLabel}</span>
          {!user.isActive && " · nonaktif"}
        </span>
        <form action={formAction}>
          <input type="hidden" name="userId" value={user.id} />
          <Button type="submit" disabled={pending} size="sm" variant="ghost" className="shrink-0 text-blue-600 hover:bg-blue-50">
            {pending ? "Mereset..." : "Reset Password"}
          </Button>
        </form>
      </div>
      {state?.error && <p className="text-red-600">{state.error}</p>}
      {state?.tempPassword && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
          <p className="font-semibold">
            ⚠️ Password baru untuk {user.name} — salin SEKARANG, tidak akan ditampilkan lagi setelah halaman
            ditutup/dimuat ulang:
          </p>
          <p className="font-mono">{state.tempPassword}</p>
          <p>Wajib diganti pengguna saat login berikutnya.</p>
        </div>
      )}
    </li>
  );
}

export function UserList({ users }: { users: UserListRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-slate-100 text-xs text-slate-600">
      {users.map((u) => (
        <UserRow key={u.id} user={u} />
      ))}
    </ul>
  );
}
