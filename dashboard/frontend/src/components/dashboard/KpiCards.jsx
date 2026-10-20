import { Clock3, Gauge, Map, PackageCheck } from "lucide-react";

const riskStyle = (route) => {
  const summary = route?.risk_summary;
  if (!summary) return ["—", "border-slate-600 bg-slate-700/60 text-slate-200"];
  if (summary.no_travel_miles > 0 || summary.severe_miles > 0 || summary.average_risk_score >= 3) return ["High risk", "border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.15)]"];
  if (summary.high_miles > 0 || summary.average_risk_score > 1.5) return ["Moderate", "border-amber-500/30 bg-amber-500/10 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)]"];
  return ["Safe", "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"];
};

export function RiskBadge({ route }) {
  const [label, style] = riskStyle(route);
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${style}`}>{label}</span>;
}

export default function KpiCards({ route, loadWeight, departureTime }) {
  const [risk] = riskStyle(route);
  const minutes = route?.duration_minutes ?? 0;
  const eta = route && departureTime ? new Date(new Date(departureTime).getTime() + minutes * 60000) : null;
  const category = loadWeight > 40000 ? "Heavy haul" : loadWeight > 30000 ? "Loaded" : "Standard";
  const cards = [
    { title: "Total distance", value: route ? `${route.distance_miles.toLocaleString()} mi` : "—", detail: route ? `${(route.distance_miles * 1.60934).toFixed(1)} km` : "Select a route", icon: Map },
    { title: "Travel time / ETA", value: route ? `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m` : "—", detail: eta ? `Arrives ${eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—", icon: Clock3 },
    { title: "Weather risk score", value: risk, detail: route ? `Avg. ${route.risk_summary.average_risk_score}/5` : "—", icon: Gauge },
    { title: "Load weight status", value: `${Number(loadWeight).toLocaleString()} lbs`, detail: category, icon: PackageCheck },
  ];
  return <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ title, value, detail, icon: Icon }) => <article key={title} className="rounded-xl border border-slate-300 bg-white p-5 shadow-lg shadow-slate-300/60 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-100"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p><Icon size={19} className="text-cyan-600" /></div><p className="mt-4 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1.5 text-xs text-slate-500">{detail}</p></article>)}</section>;
}
