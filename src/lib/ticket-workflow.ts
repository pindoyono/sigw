/**
 * SOP Kolaborasi / Eskalasi Tiket — State Machine (Engineering: workflow otomatis)
 *
 * Mengimplementasikan alur pada "6. Mekanisme Kolaborasi (SOP Penanganan Masalah)":
 *
 *   baru -> koordinasi_awal -> (jalur_a_akademik | jalur_b_bk) -> pelibatan_orang_tua
 *        -> (eskalasi_kepala_sekolah)? -> implementasi -> evaluasi -> selesai
 *
 * Modul ini murni logika (tanpa I/O) sehingga mudah diuji unit dan dipakai ulang
 * baik dari Server Action maupun dari cron job kalkulasi EWS.
 */

export type TicketStatus =
  | "baru"
  | "koordinasi_awal"
  | "jalur_a_akademik"
  | "jalur_b_bk"
  | "pelibatan_orang_tua"
  | "eskalasi_kepala_sekolah"
  | "implementasi"
  | "evaluasi"
  | "selesai";

export type TicketCategory = "akademik" | "sosial_karakter" | "belum_ditentukan";
export type TicketSeverity = "ringan" | "sedang" | "berat";

export type TicketAction =
  | { type: "CONFIRM_FINDING"; hasFinding: boolean }
  | { type: "CLASSIFY"; category: Exclude<TicketCategory, "belum_ditentukan"> }
  | { type: "COMPLETE_COLLABORATION"; homeVisitRequired: boolean }
  | { type: "ASSESS_SEVERITY"; severity: TicketSeverity }
  | { type: "PRINCIPAL_DECISION" }
  | { type: "COMPLETE_IMPLEMENTATION" }
  | { type: "FINALIZE_REPORT" };

export interface TicketState {
  status: TicketStatus;
  category: TicketCategory;
  severity: TicketSeverity;
  homeVisitRequired: boolean;
}

/** Role yang otomatis di-tag sistem ketika tiket masuk ke suatu status. */
export const AUTO_TAG_RULES: Partial<Record<TicketStatus, string[]>> = {
  koordinasi_awal: ["wali_kelas"],
  jalur_a_akademik: ["wali_kelas", "guru_mapel"],
  jalur_b_bk: ["guru_bk"],
  eskalasi_kepala_sekolah: ["kepala_sekolah"],
};

export class InvalidTicketTransitionError extends Error {
  constructor(status: TicketStatus, action: TicketAction["type"]) {
    super(`Tidak bisa menjalankan aksi "${action}" dari status tiket "${status}"`);
    this.name = "InvalidTicketTransitionError";
  }
}

/**
 * Fungsi transisi murni: menerima state saat ini + aksi, mengembalikan state baru.
 * Melempar InvalidTicketTransitionError jika aksi tidak valid untuk status saat ini
 * (mencegah state korup, mis. eskalasi Kepala Sekolah dilewati untuk kasus berat).
 */
export function transitionTicket(state: TicketState, action: TicketAction): TicketState {
  switch (action.type) {
    case "CONFIRM_FINDING": {
      assertStatus(state, "baru", action.type);
      return {
        ...state,
        status: action.hasFinding ? "koordinasi_awal" : "selesai",
      };
    }

    case "CLASSIFY": {
      assertStatus(state, "koordinasi_awal", action.type);
      return {
        ...state,
        category: action.category,
        status: action.category === "akademik" ? "jalur_a_akademik" : "jalur_b_bk",
      };
    }

    case "COMPLETE_COLLABORATION": {
      assertStatus(state, ["jalur_a_akademik", "jalur_b_bk"], action.type);
      return {
        ...state,
        homeVisitRequired: action.homeVisitRequired,
        status: "pelibatan_orang_tua",
      };
    }

    case "ASSESS_SEVERITY": {
      assertStatus(state, "pelibatan_orang_tua", action.type);
      const isSevere = action.severity === "berat";
      return {
        ...state,
        severity: action.severity,
        status: isSevere ? "eskalasi_kepala_sekolah" : "implementasi",
      };
    }

    case "PRINCIPAL_DECISION": {
      assertStatus(state, "eskalasi_kepala_sekolah", action.type);
      return { ...state, status: "implementasi" };
    }

    case "COMPLETE_IMPLEMENTATION": {
      assertStatus(state, "implementasi", action.type);
      return { ...state, status: "evaluasi" };
    }

    case "FINALIZE_REPORT": {
      assertStatus(state, "evaluasi", action.type);
      return { ...state, status: "selesai" };
    }

    default: {
      const _exhaustive: never = action;
      throw new Error(`Aksi tidak dikenal: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function assertStatus(state: TicketState, expected: TicketStatus | TicketStatus[], action: TicketAction["type"]) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(state.status)) {
    throw new InvalidTicketTransitionError(state.status, action);
  }
}

export function initialTicketState(): TicketState {
  return {
    status: "baru",
    category: "belum_ditentukan",
    severity: "ringan",
    homeVisitRequired: false,
  };
}

/** Label untuk ditampilkan di UI (badge status tiket). */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  baru: "Baru Dilaporkan",
  koordinasi_awal: "Koordinasi Awal dgn Wali Kelas",
  jalur_a_akademik: "Jalur A: Kolaborasi Guru Mapel",
  jalur_b_bk: "Jalur B: Kolaborasi Guru BK",
  pelibatan_orang_tua: "Pelibatan Orang Tua",
  eskalasi_kepala_sekolah: "Eskalasi ke Kepala Sekolah",
  implementasi: "Implementasi Pendampingan",
  evaluasi: "Evaluasi & Pelaporan",
  selesai: "Selesai",
};
