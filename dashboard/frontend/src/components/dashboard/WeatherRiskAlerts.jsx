import { AlertOctagon, AlertTriangle, BellRing, Clock3, CloudOff, CloudRain, MapPin, ShieldCheck, Snowflake, Wind } from "lucide-react";

const alertRisks = new Set(["High", "Severe", "No Travel"]);
const riskStyles = {
  High: { card: "border-orange-200 bg-orange-50", badge: "border-orange-300 bg-orange-100 text-orange-700", icon: AlertTriangle },
  Severe: { card: "border-rose-200 bg-rose-50", badge: "border-rose-300 bg-rose-100 text-rose-700", icon: AlertOctagon },
  "No Travel": { card: "border-red-300 bg-red-50", badge: "border-red-400 bg-red-100 text-red-800", icon: AlertOctagon },
};

const isFiniteNumber = (value) => Number.isFinite(value);
const weatherValue = (value, unit) => isFiniteNumber(value) ? `${value} ${unit}` : "Unavailable";
const hasCompleteWeather = (point) => point.weather
  && [point.weather.wind_mph, point.weather.rain_in_hr, point.weather.snow_in_hr].every(isFiniteNumber);

function formatEta(value) {
  if (!value) return "ETA unavailable";
  const eta = new Date(value);
  return Number.isNaN(eta.getTime())
    ? "ETA unavailable"
    : eta.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function checkpointName(point, index) {
  if (index === 0) return "Origin departure";
  return isFiniteNumber(point.distance_from_origin_miles)
    ? `${point.distance_from_origin_miles} mi checkpoint`
    : `Checkpoint ${index}`;
}

function coordinates(point) {
  return isFiniteNumber(point.latitude) && isFiniteNumber(point.longitude)
    ? `${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`
    : null;
}

export default function WeatherRiskAlerts({ route }) {
  if (!route) return null;

  const checkpoints = route.checkpoints ?? [];
  const alerts = checkpoints
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => alertRisks.has(point.risk_level));
  const unavailable = checkpoints
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => !alertRisks.has(point.risk_level) && (!hasCompleteWeather(point) || !point.risk_level || point.risk_level === "Unknown"));

  return <section aria-labelledby="weather-alerts-heading" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
    <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-100 bg-cyan-50 text-cyan-700"><BellRing size={16} aria-hidden="true" /></span>
        <div><h2 id="weather-alerts-heading" className="text-sm font-bold text-slate-900">Weather Risk Alerts</h2><p className="mt-0.5 text-[10px] text-slate-500">Route {route.route_id} · ETA-matched checkpoint forecasts</p></div>
      </div>
      <span className={`self-start rounded-full border px-2.5 py-1 text-[10px] font-bold sm:self-auto ${alerts.length ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{alerts.length} active {alerts.length === 1 ? "alert" : "alerts"}</span>
    </div>

    {alerts.length ? <div className="grid max-h-[330px] gap-2.5 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
      {alerts.map(({ point, index }) => {
        const style = riskStyles[point.risk_level];
        const RiskIcon = style.icon;
        const location = coordinates(point);
        return <article key={`${point.latitude}-${point.longitude}-${index}`} className={`min-w-0 rounded-xl border p-3 ${style.card}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <RiskIcon size={15} className="mt-0.5 shrink-0 text-current" aria-hidden="true" />
              <div className="min-w-0"><h3 className="truncate text-[12px] font-bold text-slate-900">{checkpointName(point, index)}</h3>{location && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500"><MapPin size={10} aria-hidden="true" />{location}</p>}</div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>{point.risk_level}</span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-600"><Clock3 size={11} className="shrink-0 text-cyan-600" aria-hidden="true" />{formatEta(point.eta)}</p>
          {point.weather ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-slate-200 pt-2 text-[10px] text-slate-700">
            <span className="flex items-center gap-1"><Wind size={11} aria-hidden="true" />{weatherValue(point.weather.wind_mph, "mph")}</span>
            <span className="flex items-center gap-1"><CloudRain size={11} aria-hidden="true" />{weatherValue(point.weather.rain_in_hr, "in/hr")}</span>
            <span className="flex items-center gap-1"><Snowflake size={11} aria-hidden="true" />{weatherValue(point.weather.snow_in_hr, "in/hr")}</span>
          </div> : <p className="mt-2 flex items-center gap-1.5 border-t border-slate-200 pt-2 text-[10px] font-semibold text-slate-600"><CloudOff size={11} aria-hidden="true" />Weather details unavailable</p>}
        </article>;
      })}
    </div> : <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
      <div><p className="text-[12px] font-bold text-emerald-700">No high-risk weather alerts detected</p><p className="mt-0.5 text-[11px] leading-4 text-slate-600">No available checkpoint is currently classified as High, Severe, or No Travel for its estimated arrival time.</p></div>
    </div>}

    {unavailable.length > 0 && <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-600">
      <CloudOff size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="text-[11px] leading-4"><span className="font-bold text-slate-700">Weather unavailable:</span> {unavailable.map(({ point, index }) => checkpointName(point, index)).join(", ")}. These checkpoints are not treated as safe.</p>
    </div>}
  </section>;
}
