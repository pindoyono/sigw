import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClassName } from "@/components/ui/input";

/** Native `<select>` bergaya sama dengan Input — dipilih di atas Radix/shadcn Select supaya tetap ringan (tanpa dependensi baru) dan otomatis dapat keyboard/screen-reader native browser. Panah dropdown pakai ikon Lucide yang sudah jadi dependensi proyek, bukan SVG data-URI di CSS (lebih gampang dibaca & tidak rawan salah escape). */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, multiple, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        multiple={multiple}
        className={cn(inputClassName, "cursor-pointer", multiple ? "h-auto py-1" : "appearance-none pr-8", className)}
        {...props}
      >
        {children}
      </select>
      {/* Chevron dekoratif cuma masuk akal untuk single-select (dropdown) — multi-select dirender browser sebagai listbox biasa, bukan dropdown. */}
      {!multiple && <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
    </div>
  ),
);
Select.displayName = "Select";
