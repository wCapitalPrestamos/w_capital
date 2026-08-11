// Asignación de un pago a cuotas: la cuota impaga más antigua primero,
// interés antes que capital dentro de cada cuota. En centavos enteros.
// Convención: paid_amount de una cuota cubre primero su interés.

export interface AllocatableInstallment {
  id: string;
  number: number;
  interest_due: number;
  principal_due: number;
  total_due: number;
  paid_amount: number;
  status: "pending" | "partial" | "paid" | "overdue";
}

export interface Allocation {
  installment_id: string;
  interest_amount: number;
  principal_amount: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  /** Sobrante que no cupo en ninguna cuota (sobrepago). */
  leftover: number;
}

function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}

export function allocatePayment(
  installments: AllocatableInstallment[],
  amount: number,
): AllocationResult {
  let remaining = toCents(amount);
  const allocations: Allocation[] = [];

  const open = [...installments]
    .filter((i) => i.status !== "paid" && toCents(i.total_due) > toCents(i.paid_amount))
    .sort((a, b) => a.number - b.number);

  for (const inst of open) {
    if (remaining <= 0) break;

    const interestDue = toCents(inst.interest_due);
    const totalDue = toCents(inst.total_due);
    const paid = toCents(inst.paid_amount);

    const interestRemaining = Math.max(0, interestDue - paid);
    const principalRemaining = totalDue - paid - interestRemaining;

    const interestPay = Math.min(remaining, interestRemaining);
    remaining -= interestPay;
    const principalPay = Math.min(remaining, principalRemaining);
    remaining -= principalPay;

    if (interestPay + principalPay > 0) {
      allocations.push({
        installment_id: inst.id,
        interest_amount: interestPay / 100,
        principal_amount: principalPay / 100,
      });
    }
  }

  return { allocations, leftover: remaining / 100 };
}
