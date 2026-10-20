import { AlertTriangle, ChevronRight, CloudRain, Snowflake, Wind } from "lucide-react";
import { RiskBadge } from "./KpiCards";

const riskDot = { Low: "bg-emerald-400", Moderate: "bg-amber-400", High: "bg-orange-400", Severe: "bg-rose-400", "No Travel": "bg-red-500" };

export default function RouteAnalytics({ routes, selectedRouteId, onSelect }) {
  const selected = routes.find((route) => route.route_id === selectedRouteId);
  if (!selected) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-lg shadow-slate-300/50">Calculate a route to view safety comparisons and checkpoint conditions.</div>;
  return <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
    <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-lg shadow-slate-300/60"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Route comparison</h2><span className="text-xs text-slate-500">{routes.length} options found</span></div>
      <div className="space-y-3">{routes.map((route) => <button key={route.route_id} onClick={() => onSelect(route.route_id)} className={`w-full rounded-xl border p-4 text-left transition ${route.route_id === selectedRouteId ? "border-cyan-400 bg-cyan-50 shadow-md shadow-cyan-100" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"}`}>
        <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-900">Route {route.route_id} {route.recommended && <span className="ml-1 text-xs text-emerald-600">RECOMMENDED</span>}</p><p className="mt-1 text-xs text-slate-500">{route.distance_miles} mi · {Math.round(route.duration_minutes)} min</p></div><div className="flex items-center gap-2"><RiskBadge route={route}/><ChevronRight size={18} className="text-slate-400" /></div></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><Metric label="Severe" value={`${route.risk_summary.severe_miles} mi`} /><Metric label="High" value={`${route.risk_summary.high_miles} mi`} /><Metric label="No travel" value={`${route.risk_summary.no_travel_miles} mi`} /></div>
      </button>)}</div>
    </section>
    <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-lg shadow-slate-300/60"><div className="mb-5 flex items-center gap-2"><AlertTriangle size={18} className="text-cyan-600" /><h2 className="font-semibold text-slate-900">Weather risk timeline</h2></div>
      <div className="max-h-80 space-y-0 overflow-y-auto pr-2">{selected.checkpoints.map((point, index) => <div key={`${point.latitude}-${point.longitude}`} className="relative grid grid-cols-[18px_1fr] gap-3 pb-5 last:pb-0"><div className="flex flex-col items-center"><span className={`mt-1.5 h-3 w-3 rounded-full ring-4 ring-white ${riskDot[point.risk_level]}`} />{index < selected.checkpoints.length - 1 && <span className="mt-1 h-full w-px bg-slate-300" />}</div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium text-slate-800">{index === 0 ? "Origin departure" : `${point.distance_from_origin_miles} mi checkpoint`}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(point.eta).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p></div><span className="text-xs font-semibold" style={{ color: point.risk_level === "Low" ? "#059669" : point.risk_level === "Moderate" ? "#d97706" : "#e11d48" }}>{point.risk_level}</span></div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600"><span className="flex items-center gap-1"><Wind size={13}/> {point.weather.wind_mph} mph</span><span className="flex items-center gap-1"><CloudRain size={13}/> {point.weather.rain_in_hr} in/hr</span><span className="flex items-center gap-1"><Snowflake size={13}/> {point.weather.snow_in_hr} in/hr</span></div></div></div>)}</div>
    </section>
  </div>;
}

function Metric({ label, value }) { return <div className="rounded-lg border border-slate-200 bg-white p-2"><p className="text-slate-500">{label}</p><p className="mt-0.5 font-semibold text-slate-800">{value}</p></div>; }
