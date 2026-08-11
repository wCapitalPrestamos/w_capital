import { describe, expect, it } from "vitest";
import {
  allocatePayment,
  type AllocatableInstallment,
} from "@/lib/loans/allocate-payment";

function inst(
  overrides: Partial<AllocatableInstallment> & { id: string; number: number },
): AllocatableInstallment {
  return {
    interest_due: 197,
    principal_due: 298.18,
    total_due: 495.18,
    paid_amount: 0,
    status: "pending",
    ...overrides,
  };
}

describe("allocatePayment", () => {
  it("pago exacto de una cuota: interés y capital completos, sin sobrante", () => {
    const result = allocatePayment([inst({ id: "a", number: 1 })], 495.18);
    expect(result.leftover).toBe(0);
    expect(result.allocations).toEqual([
      { installment_id: "a", interest_amount: 197, principal_amount: 298.18 },
    ]);
  });

  it("pago parcial cubre primero el interés", () => {
    const result = allocatePayment([inst({ id: "a", number: 1 })], 200);
    expect(result.allocations).toEqual([
      { installment_id: "a", interest_amount: 197, principal_amount: 3 },
    ]);
    expect(result.leftover).toBe(0);
  });

  it("un pago grande se reparte entre varias cuotas en orden", () => {
    const result = allocatePayment(
      [
        inst({ id: "a", number: 1, status: "overdue" }),
        inst({ id: "b", number: 2, status: "overdue" }),
        inst({ id: "c", number: 3 }),
      ],
      495.18 * 2 + 100,
    );
    expect(result.allocations).toHaveLength(3);
    expect(result.allocations[0].installment_id).toBe("a");
    expect(result.allocations[1].installment_id).toBe("b");
    // La tercera cuota recibe los $100 restantes, interés primero
    expect(result.allocations[2]).toEqual({
      installment_id: "c",
      interest_amount: 100,
      principal_amount: 0,
    });
    expect(result.leftover).toBe(0);
  });

  it("ignora cuotas pagadas y respeta abonos previos (interés primero)", () => {
    const result = allocatePayment(
      [
        inst({ id: "a", number: 1, status: "paid", paid_amount: 495.18 }),
        // Ya abonó 200: cubrió los 197 de interés y 3 de capital
        inst({ id: "b", number: 2, status: "partial", paid_amount: 200 }),
      ],
      295.18,
    );
    expect(result.allocations).toEqual([
      { installment_id: "b", interest_amount: 0, principal_amount: 295.18 },
    ]);
    expect(result.leftover).toBe(0);
  });

  it("devuelve sobrante cuando el pago excede toda la deuda", () => {
    const result = allocatePayment([inst({ id: "a", number: 1 })], 600);
    expect(result.allocations).toEqual([
      { installment_id: "a", interest_amount: 197, principal_amount: 298.18 },
    ]);
    expect(round2(result.leftover)).toBe(round2(600 - 495.18));
  });

  it("las asignaciones siempre suman el monto aplicado (sin errores de centavos)", () => {
    const installments = Array.from({ length: 10 }, (_, i) =>
      inst({ id: `i${i}`, number: i + 1 }),
    );
    for (const amount of [1, 33.33, 495.18, 700.77, 4951.8]) {
      const { allocations, leftover } = allocatePayment(installments, amount);
      const applied = allocations.reduce(
        (sum, a) => sum + a.interest_amount + a.principal_amount,
        0,
      );
      expect(round2(applied + leftover)).toBe(round2(amount));
    }
  });
});

const round2 = (n: number) => Math.round(n * 100) / 100;
