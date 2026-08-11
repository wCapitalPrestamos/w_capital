"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { sourceChannelLabels } from "@/lib/labels";
import type { SourceChannel } from "@/lib/types";

// Paleta categórica validada (ver globals.css --chart-*)
const C1 = "#f75b32"; // naranja marca
const C2 = "#2e7db2"; // azul
const GRID = "rgba(63, 66, 69, 0.08)";
const INK_MUTED = "#6b6f73";

const mxnShort = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}k`
      : `$${n}`;

const mxnFull = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid rgba(63,66,69,0.12)",
  background: "#fff",
  fontSize: 12,
  color: "#3f4245",
};

export function CollectionChart({
  data,
}: {
  data: { week: string; esperado: number; cobrado: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={mxnShort}
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value, name) => [
            mxnFull(Number(value)),
            name === "esperado" ? "Esperado" : "Cobrado",
          ]}
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(63,66,69,0.05)" }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "#3f4245", fontSize: 12 }}>
              {value === "esperado" ? "Esperado" : "Cobrado"}
            </span>
          )}
        />
        <Bar dataKey="esperado" fill={C2} radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="cobrado" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DisbursedChart({
  data,
}: {
  data: { month: string; monto: number; prestamos: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={mxnShort}
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value, name) =>
            name === "monto"
              ? [mxnFull(Number(value)), "Desembolsado"]
              : [String(value), "Préstamos"]
          }
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(63,66,69,0.05)" }}
        />
        <Bar dataKey="monto" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({ data }: { data: { etapa: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="etapa"
          tick={{ fontSize: 12, fill: "#3f4245" }}
          axisLine={false}
          tickLine={false}
          width={104}
        />
        <Tooltip
          formatter={(value) => [String(value), "Total"]}
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(63,66,69,0.05)" }}
        />
        <Bar
          dataKey="total"
          fill={C1}
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          label={{ position: "right", fontSize: 12, fill: "#3f4245" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

const CHANNEL_COLORS: string[] = ["#f75b32", "#2e7db2", "#2e9e63", "#8b5cc7", "#b87400"];

export function ChannelChart({ data }: { data: { canal: string; total: number }[] }) {
  const rows = data.map((d) => ({
    ...d,
    label:
      sourceChannelLabels[d.canal as SourceChannel] ?? d.canal,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 32 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: "#3f4245" }}
          axisLine={false}
          tickLine={false}
          width={124}
        />
        <Tooltip
          formatter={(value) => [String(value), "Contactos"]}
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(63,66,69,0.05)" }}
        />
        <Bar
          dataKey="total"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          label={{ position: "right", fontSize: 12, fill: "#3f4245" }}
        >
          {rows.map((row, i) => (
            <Cell key={row.canal} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
