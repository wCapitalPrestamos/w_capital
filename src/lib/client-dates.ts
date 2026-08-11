// Fechas YYYY-MM-DD en hora local del navegador (para defaults de formularios)
export function todayLocalISO(plusDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
