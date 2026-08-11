import { describe, expect, it } from "vitest";
import { addDays, buildSchedule, weeklyPaymentFor } from "@/lib/loans/amortization";

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("weeklyPaymentFor", () => {
  it("caso de referencia: $10,000 a 26 semanas al 1.97%", () => {
    expect(weeklyPaymentFor(10000, 0.0197, 26)).toBe(495.18);
  });
});

describe("buildSchedule", () => {
  it("la semana 1 cobra interés exacto sobre el principal", () => {
    const s = buildSchedule({
      principal: 10000,
      weeklyRate: 0.0197,
      termWeeks: 26,
      firstPaymentDate: "2026-08-17",
    });
    expect(s.rows[0].interest_due).toBe(197.0);
    expect(s.rows[0].principal_due).toBe(298.18);
    expect(s.rows[0].total_due).toBe(495.18);
    expect(s.rows).toHaveLength(26);
  });

  it("el capital de las cuotas suma exactamente el principal (saldo cierra en 0)", () => {
    for (const principal of [5000, 10000, 12345.67, 50000, 100000]) {
      for (const term of [4, 12, 26, 52]) {
        const s = buildSchedule({
          principal,
          weeklyRate: 0.0197,
          termWeeks: term,
          firstPaymentDate: "2026-01-05",
        });
        const totalPrincipal = round2(
          s.rows.reduce((sum, r) => sum + r.principal_due, 0),
        );
        expect(totalPrincipal).toBe(round2(principal));
      }
    }
  });

  it("cada cuota cumple total = capital + interés", () => {
    const s = buildSchedule({
      principal: 20000,
      weeklyRate: 0.0197,
      termWeeks: 26,
      firstPaymentDate: "2026-08-17",
    });
    for (const row of s.rows) {
      expect(round2(row.principal_due + row.interest_due)).toBe(row.total_due);
    }
  });

  it("las fechas avanzan de 7 en 7 días", () => {
    const s = buildSchedule({
      principal: 10000,
      weeklyRate: 0.0197,
      termWeeks: 5,
      firstPaymentDate: "2026-12-28", // cruza año
    });
    expect(s.rows.map((r) => r.due_date)).toEqual([
      "2026-12-28",
      "2027-01-04",
      "2027-01-11",
      "2027-01-18",
      "2027-01-25",
    ]);
  });

  it("el interés decrece semana a semana (saldo insoluto)", () => {
    const s = buildSchedule({
      principal: 10000,
      weeklyRate: 0.0197,
      termWeeks: 26,
      firstPaymentDate: "2026-08-17",
    });
    for (let i = 1; i < s.rows.length; i++) {
      expect(s.rows[i].interest_due).toBeLessThan(s.rows[i - 1].interest_due);
    }
  });

  it("totalInterest y totalToPay son consistentes", () => {
    const s = buildSchedule({
      principal: 10000,
      weeklyRate: 0.0197,
      termWeeks: 26,
      firstPaymentDate: "2026-08-17",
    });
    const sumInterest = round2(s.rows.reduce((a, r) => a + r.interest_due, 0));
    const sumTotal = round2(s.rows.reduce((a, r) => a + r.total_due, 0));
    expect(round2(s.totalInterest)).toBe(sumInterest);
    expect(round2(s.totalToPay)).toBe(sumTotal);
    expect(round2(sumTotal)).toBe(round2(10000 + sumInterest));
  });

  it("rechaza entradas inválidas", () => {
    expect(() =>
      buildSchedule({ principal: 0, weeklyRate: 0.0197, termWeeks: 26, firstPaymentDate: "2026-01-01" }),
    ).toThrow();
    expect(() =>
      buildSchedule({ principal: 10000, weeklyRate: 0.0197, termWeeks: 0, firstPaymentDate: "2026-01-01" }),
    ).toThrow();
    expect(() =>
      buildSchedule({ principal: 10000, weeklyRate: 0.0197, termWeeks: 26, firstPaymentDate: "01/01/2026" }),
    ).toThrow();
  });
});

describe("addDays", () => {
  it("cruza meses y años bisiestos", () => {
    expect(addDays("2026-08-28", 7)).toBe("2026-09-04");
    expect(addDays("2028-02-26", 7)).toBe("2028-03-04"); // 2028 bisiesto
    expect(addDays("2026-12-31", 7)).toBe("2027-01-07");
    expect(addDays("2026-08-10", -56)).toBe("2026-06-15");
  });
});
