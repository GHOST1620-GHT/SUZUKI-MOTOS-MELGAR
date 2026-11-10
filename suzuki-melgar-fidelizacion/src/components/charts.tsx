"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const cop = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${v}`);
const full = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
const num = (v: number) => v.toLocaleString("es-CO");

const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,.08)", fontSize: 12 };

export function SalesChart({ data }: { data: { month: string; MOTO: number; REPUESTOS: number; ACCESORIOS: number; TALLER: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
        <YAxis tickFormatter={cop} tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" width={56} />
        <Tooltip formatter={(v) => full(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="MOTO" name="Motos" stackId="a" fill="#1a3fc0" />
        <Bar dataKey="REPUESTOS" name="Repuestos" stackId="a" fill="#0891b2" />
        <Bar dataKey="ACCESORIOS" name="Accesorios" stackId="a" fill="#7c3aed" />
        <Bar dataKey="TALLER" name="Taller" stackId="a" fill="#ea580c" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PointsChart({ data }: { data: { month: string; emitidos: number; canjeados: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
        <YAxis tickFormatter={num} tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" width={56} />
        <Tooltip formatter={(v) => `${num(Number(v))} pts`} contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Line type="monotone" dataKey="emitidos" name="Puntos emitidos" stroke="#1a3fc0" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="canjeados" name="Puntos canjeados" stroke="#e30613" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 220, money: isMoney = false }: { data: { name: string; value: number; color: string }[]; height?: number; money?: boolean }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none">
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => (isMoney ? full(Number(v)) : num(Number(v)))} contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{isMoney ? cop(total) : num(total)}</span>
        <span className="text-xs text-slate-500">total</span>
      </div>
    </div>
  );
}

export function HBarChart({ data, money = false, color = "#1a3fc0" }: { data: { name: string; value: number }[]; money?: boolean; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" tickFormatter={money ? cop : num} tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="#334155" width={130} />
        <Tooltip formatter={(v) => (money ? full(Number(v)) : num(Number(v)))} contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
