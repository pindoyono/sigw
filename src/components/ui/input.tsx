import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primitive input terpusat — sebelumnya setiap form (30+ file) menulis ulang class
 * yang sama persis, jadi kalau mau ubah 1 hal (mis. warna fokus, state error) harus
 * diganti manual di semua tempat. `text-[16px]` di mobile SENGAJA beda dari `sm:text-sm`
 * di desktop — di bawah 16px, Safari iOS auto-zoom saat field difokus.
 */
export const inputClassName =
  "flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[16px] text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500 sm:text-sm";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClassName, className)} {...props} />,
);
Input.displayName = "Input";
