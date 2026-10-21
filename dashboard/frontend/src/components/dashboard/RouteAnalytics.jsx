import { AlertTriangle, ChevronRight, CloudRain, Snowflake, Wind } from "lucide-react";
import { RiskBadge } from "./KpiCards";
import HelpTooltip from "./HelpTooltip";
import { formatDuration } from "./formatters";

const riskDot = { Low: "bg-emerald-400", Moderate: "bg-amber-400", High: "bg-orange-400", Severe: "bg-rose-400", "No Travel": "bg-red-500" };

export default function RouteAnalytics({ routes, selectedRouteId, onSelect }) {
  const selected = routes.find((route) => route.route_id === selectedRouteId);
  if (!selected) return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500 shadow-md shadow-slate-300/50">Calculate a route to view safety comparisons and checkpoint conditions.</div>;
  return <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
    <section className="min-w-0 rounded-xl border border-slate-300 bg-white p-4 shadow-md shadow-slate-300/60"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Route comparison</h2><span className="text-[11px] text-slate-500">{routes.length} options found</span></div>
      <div className="space-y-2">{routes.map((route) => <button key={route.route_id} onClick={() => onSelect(route.route_id)} className={`w-full rounded-lg border p-3 text-left transition ${route.route_id === selectedRouteId ? "border-cyan-400 bg-cyan-50 shadow-sm shadow-cyan-100" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"}`}>
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-slate-900">Route {route.route_id} {route.recommended && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] text-emerald-700">RECOMMENDED</span>} {route.route_id === selectedRouteId && <span className="ml-1 rounded bg-cyan-100 px-1.5 py-0.5 text-[9px] text-cyan-700">SELECTED</span>}</p><p className="mt-0.5 text-[11px] text-slate-500">{route.distance_miles} mi · {formatDuration(route.duration_minutes)}</p></div><div className="flex shrink-0 items-center gap-1.5"><RiskBadge route={route}/><ChevronRight size={16} className="text-slate-400" /></div></div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[10px]"><Metric label="Severe" value={`${route.risk_summary.severe_miles} mi`} help="Miles expected to have Severe ETA-based weather risk." /><Metric label="High" value={`${route.risk_summary.high_miles} mi`} help="Miles expected to have High ETA-based weather risk." /><Metric label="No travel" value={`${route.risk_summary.no_travel_miles} mi`} help="Miles where ETA conditions meet a No Travel rule." /></div>
      </button>)}</div>
    </section>
    <section className="min-w-0 rounded-xl border border-slate-300 bg-white p-4 shadow-md shadow-slate-300/60"><div className="mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-cyan-600" /><h2 className="text-sm font-semibold text-slate-900">Weather risk timeline</h2></div>
      <div className="max-h-72 space-y-0 overflow-y-auto pr-1.5">{selected.checkpoints.map((point, index) => <div key={`${point.latitude}-${point.longitude}`} className="relative grid grid-cols-[14px_1fr] gap-2.5 pb-3.5 last:pb-0"><div className="flex flex-col items-center"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${riskDot[point.risk_level]}`} />{index < selected.checkpoints.length - 1 && <span className="mt-1 h-full w-px bg-slate-300" />}</div><div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-[12px] font-medium text-slate-800">{index === 0 ? "Origin departure" : `${point.distance_from_origin_miles} mi checkpoint`}</p><p className="mt-0.5 text-[10px] text-slate-500">{new Date(point.eta).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p></div><span className="shrink-0 text-[11px] font-semibold" style={{ color: point.risk_level === "Low" ? "#059669" : point.risk_level === "Moderate" ? "#d97706" : "#e11d48" }}>{point.risk_level}</span></div>
        <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-slate-600"><span className="flex items-center gap-1"><Wind size={12}/> {point.weather.wind_mph} mph</span><span className="flex items-center gap-1"><CloudRain size={12}/> {point.weather.rain_in_hr} in/hr</span><span className="flex items-center gap-1"><Snowflake size={12}/> {point.weather.snow_in_hr} in/hr</span></div></div></div>)}</div>
    </section>
  </div>;
}

function Metric({ label, value, help }) { return <div className="min-w-0 rounded-md border border-slate-200 bg-white p-1.5"><div className="flex items-center gap-1 text-slate-500"><p className="truncate">{label}</p><HelpTooltip text={help} align="right" /></div><p className="mt-0.5 truncate font-semibold text-slate-800">{value}</p></div>; }
