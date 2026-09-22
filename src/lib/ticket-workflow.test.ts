import { describe, expect, test } from "bun:test";
import {
  transitionTicket,
  initialTicketState,
  InvalidTicketTransitionError,
  AUTO_TAG_RULES,
  type TicketState,
} from "./ticket-workflow";

describe("transitionTicket — alur normal", () => {
  test("tiket tanpa temuan langsung selesai", () => {
    const state = transitionTicket(initialTicketState(), { type: "CONFIRM_FINDING", hasFinding: false });
    expect(state.status).toBe("selesai");
  });

  test("Jalur A (akademik) sampai selesai", () => {
    let state: TicketState = initialTicketState();
    state = transitionTicket(state, { type: "CONFIRM_FINDING", hasFinding: true });
    expect(state.status).toBe("koordinasi_awal");

    state = transitionTicket(state, { type: "CLASSIFY", category: "akademik" });
    expect(state.status).toBe("jalur_a_akademik");
    expect(state.category).toBe("akademik");

    state = transitionTicket(state, { type: "COMPLETE_COLLABORATION", homeVisitRequired: false });
    expect(state.status).toBe("pelibatan_orang_tua");

    state = transitionTicket(state, { type: "ASSESS_SEVERITY", severity: "ringan" });
    expect(state.status).toBe("implementasi");

    state = transitionTicket(state, { type: "COMPLETE_IMPLEMENTATION" });
    expect(state.status).toBe("evaluasi");

    state = transitionTicket(state, { type: "FINALIZE_REPORT" });
    expect(state.status).toBe("selesai");
  });

  test("Jalur B (sosial/karakter) diarahkan ke guru BK", () => {
    let state: TicketState = initialTicketState();
    state = transitionTicket(state, { type: "CONFIRM_FINDING", hasFinding: true });
    state = transitionTicket(state, { type: "CLASSIFY", category: "sosial_karakter" });
    expect(state.status).toBe("jalur_b_bk");
  });

  test("kasus berat WAJIB melalui eskalasi_kepala_sekolah sebelum implementasi", () => {
    let state: TicketState = initialTicketState();
    state = transitionTicket(state, { type: "CONFIRM_FINDING", hasFinding: true });
    state = transitionTicket(state, { type: "CLASSIFY", category: "sosial_karakter" });
    state = transitionTicket(state, { type: "COMPLETE_COLLABORATION", homeVisitRequired: true });
    expect(state.homeVisitRequired).toBe(true);

    state = transitionTicket(state, { type: "ASSESS_SEVERITY", severity: "berat" });
    expect(state.status).toBe("eskalasi_kepala_sekolah");
    expect(state.severity).toBe("berat");

    // Tidak boleh lompat langsung ke implementasi tanpa keputusan kepala sekolah.
    expect(() => transitionTicket(state, { type: "COMPLETE_IMPLEMENTATION" })).toThrow(
      InvalidTicketTransitionError,
    );

    state = transitionTicket(state, { type: "PRINCIPAL_DECISION" });
    expect(state.status).toBe("implementasi");
  });

  test("kasus ringan/sedang TIDAK melalui eskalasi_kepala_sekolah", () => {
    let state: TicketState = initialTicketState();
    state = transitionTicket(state, { type: "CONFIRM_FINDING", hasFinding: true });
    state = transitionTicket(state, { type: "CLASSIFY", category: "akademik" });
    state = transitionTicket(state, { type: "COMPLETE_COLLABORATION", homeVisitRequired: false });
    state = transitionTicket(state, { type: "ASSESS_SEVERITY", severity: "sedang" });
    expect(state.status).toBe("implementasi");
  });
});

describe("transitionTicket — transisi invalid ditolak", () => {
  test("tidak bisa CLASSIFY dari status baru", () => {
    const state = initialTicketState();
    expect(() => transitionTicket(state, { type: "CLASSIFY", category: "akademik" })).toThrow(
      InvalidTicketTransitionError,
    );
  });

  test("tidak bisa ASSESS_SEVERITY sebelum pelibatan_orang_tua", () => {
    let state: TicketState = initialTicketState();
    state = transitionTicket(state, { type: "CONFIRM_FINDING", hasFinding: true });
    expect(() => transitionTicket(state, { type: "ASSESS_SEVERITY", severity: "ringan" })).toThrow(
      InvalidTicketTransitionError,
    );
  });

  test("tidak bisa FINALIZE_REPORT sebelum evaluasi", () => {
    const state = initialTicketState();
    expect(() => transitionTicket(state, { type: "FINALIZE_REPORT" })).toThrow(InvalidTicketTransitionError);
  });

  test("tiket yang sudah selesai tidak bisa ditransisikan lagi", () => {
    const selesai: TicketState = {
      status: "selesai",
      category: "akademik",
      severity: "ringan",
      homeVisitRequired: false,
    };
    expect(() => transitionTicket(selesai, { type: "COMPLETE_IMPLEMENTATION" })).toThrow(
      InvalidTicketTransitionError,
    );
  });
});

describe("AUTO_TAG_RULES", () => {
  test("eskalasi_kepala_sekolah men-tag kepala_sekolah", () => {
    expect(AUTO_TAG_RULES.eskalasi_kepala_sekolah).toEqual(["kepala_sekolah"]);
  });

  test("jalur_b_bk men-tag guru_bk", () => {
    expect(AUTO_TAG_RULES.jalur_b_bk).toEqual(["guru_bk"]);
  });

  test("jalur_a_akademik men-tag wali_kelas dan guru_mapel", () => {
    expect(AUTO_TAG_RULES.jalur_a_akademik).toEqual(["wali_kelas", "guru_mapel"]);
  });
});
