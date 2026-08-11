// Amortización sistema francés semanal — toda la aritmética en centavos enteros.
// La cuota es fija; el interés se calcula sobre saldo insoluto (coincide con
// "abona a capital e interés desde el primer pago, sin refrendo").

export interface ScheduleRow {
  number: number;
  due_date: string; // YYYY-MM-DD
  principal_due: number; // pesos con 2 decimales
  interest_due: number;
  total_due: number;
}

export interface ScheduleInput {
  principal: number; // pesos
  weeklyRate: number; // p.ej. 0.0197
  termWeeks: number;
  firstPaymentDate: string; // YYYY-MM-DD
}

export interface Schedule {
  weeklyPayment: number; // pesos
  totalInterest: number;
  totalToPay: number;
  rows: ScheduleRow[];
}

function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}

function toPesos(cents: number): number {
  return cents / 100;
}

// Suma días a una fecha YYYY-MM-DD sin tocar zonas horarias
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function weeklyPaymentFor(
  principal: number,
  weeklyRate: number,
  termWeeks: number,
): number {
  const pCents = toCents(principal);
  const a = (pCents * weeklyRate) / (1 - Math.pow(1 + weeklyRate, -termWeeks));
  return toPesos(Math.round(a));
}

export function buildSchedule(input: ScheduleInput): Schedule {
  const { principal, weeklyRate, termWeeks, firstPaymentDate } = input;

  if (principal <= 0) throw new Error("principal debe ser positivo");
  if (termWeeks < 1) throw new Error("termWeeks debe ser al menos 1");
  if (weeklyRate < 0) throw new Error("weeklyRate no puede ser negativa");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstPaymentDate)) {
    throw new Error("firstPaymentDate debe ser YYYY-MM-DD");
  }

  const paymentCents = toCents(weeklyPaymentFor(principal, weeklyRate, termWeeks));
  let balanceCents = toCents(principal);
  const rows: ScheduleRow[] = [];
  let totalInterestCents = 0;

  for (let k = 1; k <= termWeeks; k++) {
    const interestCents = Math.round(balanceCents * weeklyRate);
    let principalCents: number;
    let totalCents: number;

    if (k === termWeeks) {
      // La última cuota absorbe el redondeo: liquida el saldo exacto
      principalCents = balanceCents;
      totalCents = principalCents + interestCents;
    } else {
      principalCents = paymentCents - interestCents;
      totalCents = paymentCents;
    }

    if (principalCents <= 0) {
      throw new Error(
        "la cuota no cubre el interés semanal: plazo demasiado largo para el monto",
      );
    }

    balanceCents -= principalCents;
    totalInterestCents += interestCents;

    rows.push({
      number: k,
      due_date: addDays(firstPaymentDate, (k - 1) * 7),
      principal_due: toPesos(principalCents),
      interest_due: toPesos(interestCents),
      total_due: toPesos(totalCents),
    });
  }

  const totalToPayCents = rows.reduce((sum, r) => sum + toCents(r.total_due), 0);

  return {
    weeklyPayment: toPesos(paymentCents),
    totalInterest: toPesos(totalInterestCents),
    totalToPay: toPesos(totalToPayCents),
    rows,
  };
}
