import { Clock3, Gauge, Map, PackageCheck } from "lucide-react";
import HelpTooltip from "./HelpTooltip";
import { formatDuration } from "./formatters";

const riskStyle = (route) => {
  const summary = route?.risk_summary;
  if (!summary) return ["—", "border-slate-300 bg-slate-100 text-slate-700"];
  if (summary.no_travel_miles > 0 || summary.severe_miles > 0 || summary.average_risk_score >= 3) return ["High risk", "border-rose-500/30 bg-rose-500/10 text-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.12)]"];
  if (summary.high_miles > 0 || summary.average_risk_score > 1.5) return ["Moderate", "border-amber-500/30 bg-amber-500/10 text-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.12)]"];
  return ["Safe", "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.16)]"];
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
    { title: "Total distance", value: route ? `${route.distance_miles.toLocaleString()} mi` : "—", detail: route ? `${(route.distance_miles * 1.60934).toFixed(1)} km` : "Select a route", icon: Map, help: "Total road distance for the selected route, shown in miles and kilometers." },
    { title: "Travel time / ETA", value: route ? formatDuration(minutes) : "—", detail: eta ? `Arrives ${eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—", icon: Clock3, help: "OSRM travel duration and estimated arrival time based on the submitted departure." },
    { title: "Weather risk score", value: risk, detail: route ? `Avg. ${route.risk_summary.average_risk_score}/5` : "—", icon: Gauge, help: "Average ETA-based weather risk across the route. The forecast slider does not change it." },
    { title: "Load weight status", value: `${Number(loadWeight).toLocaleString()} lbs`, detail: category, icon: PackageCheck, help: "Submitted cargo weight and operating category. Weight affects wind-risk overrides." },
  ];
  return <section className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ title, value, detail, icon: Icon, help }) => <article key={title} className="group min-h-[116px] min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_12px_30px_rgba(8,145,178,0.12)]"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{title}</p><HelpTooltip text={help} /></div><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-100 bg-cyan-50 text-cyan-700 transition-colors group-hover:border-cyan-200 group-hover:bg-cyan-100"><Icon size={16} aria-hidden="true" /></span></div><p className="mt-2.5 truncate text-[22px] font-bold leading-none tracking-tight text-slate-900">{value}</p><p className="mt-1.5 truncate text-[11px] font-medium text-slate-500">{detail}</p></article>)}</section>;
}
