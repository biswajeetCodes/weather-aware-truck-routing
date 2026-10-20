import { Clock3, Gauge, Map, PackageCheck } from "lucide-react";

const riskStyle = (route) => {
  const summary = route?.risk_summary;
  if (!summary) return ["—", "bg-slate-700 text-slate-200"];
  if (summary.no_travel_miles > 0 || summary.severe_miles > 0 || summary.average_risk_score >= 3) return ["High risk", "bg-rose-500/15 text-rose-300 ring-rose-500/30"];
  if (summary.high_miles > 0 || summary.average_risk_score > 1.5) return ["Moderate", "bg-amber-400/15 text-amber-300 ring-amber-400/30"];
  return ["Safe", "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30"];
};

export function RiskBadge({ route }) {
  const [label, style] = riskStyle(route);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${style}`}>{label}</span>;
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
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ title, value, detail, icon: Icon }) => <article key={title} className="rounded-xl border border-line bg-panel p-4 shadow-lg shadow-slate-950/10"><div className="flex items-start justify-between"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p><Icon size={18} className="text-cyan-300" /></div><p className="mt-4 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>)}</section>;
}
