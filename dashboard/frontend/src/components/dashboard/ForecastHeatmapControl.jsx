import { Clock3, CloudRain, Gauge, MapPinned, Snowflake, Wind } from "lucide-react";
import { useMemo } from "react";
import HelpTooltip from "./HelpTooltip";
import { buildForecastSnapshot } from "./forecastSnapshot";

const legend = [
  ["Low", "bg-emerald-500"],
  ["Moderate", "bg-amber-400"],
  ["High", "bg-orange-500"],
  ["Severe", "bg-rose-500"],
  ["No Travel", "bg-red-800"],
  ["Unknown", "bg-slate-400"],
];

const riskStyles = {
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Moderate: "border-amber-200 bg-amber-50 text-amber-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Severe: "border-rose-200 bg-rose-50 text-rose-700",
  "No Travel": "border-red-300 bg-red-50 text-red-800",
  Unknown: "border-slate-200 bg-slate-100 text-slate-500",
};

export default function ForecastHeatmapControl({ offset, onChange, route, forecastStartTime }) {
  const checkpoints = route?.checkpoints ?? [];
  const snapshot = useMemo(() => buildForecastSnapshot(checkpoints, offset), [checkpoints, offset]);
  const forecastTime = snapshot.forecastTime
    ?? (forecastStartTime ? new Date(new Date(forecastStartTime).getTime() + offset * 3600000).toISOString() : null);
  const disabled = !route;

  return <section className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-shadow duration-200 hover:shadow-[0_10px_28px_rgba(15,23,42,0.09)]" aria-label="Route weather forecast heatmap controls">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="flex min-w-[185px] items-center gap-2.5">
        <span className="rounded-lg border border-cyan-100 bg-cyan-50 p-2 text-cyan-700"><Clock3 size={17} aria-hidden="true" /></span>
        <div><h2 className="text-[13px] font-bold text-slate-900">Corridor forecast</h2><p className="text-[11px] text-slate-500">Independent of dispatch ETA</p></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-1.5"><label htmlFor="forecast-hour" className="font-semibold text-slate-700">Forecast hour <span className="text-cyan-700">+{offset}h</span></label><HelpTooltip text="Preview corridor weather from now through 48 hours. This does not change departure time, ETA, or route ranking." /></div>
          <span className="truncate text-right text-slate-500">{forecastTime ? new Date(forecastTime).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric" }) : "Calculate a route to enable"}</span>
        </div>
        <input id="forecast-hour" type="range" min="0" max="48" step="1" value={offset} disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-valuetext={`Forecast plus ${offset} hours${forecastTime ? `, ${new Date(forecastTime).toLocaleString()}` : ""}`}
          className="forecast-slider block w-full disabled:cursor-not-allowed disabled:opacity-40" />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Now</span><span>+24h</span><span>+48h</span></div>
      </div>
      <div className="xl:max-w-[355px]">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">Risk legend <HelpTooltip align="right" text="Route colors show load-aware wind, rain, and snow risk at the selected forecast hour. Gray means data is unavailable." /></div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-1.5" aria-label="Weather risk legend">{legend.map(([label, color]) => <span key={label} className="flex items-center gap-1 text-[10px] font-medium text-slate-600"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>)}</div>
        {route && <p className={`mt-1.5 text-[10px] ${snapshot.availableCount ? "text-slate-500" : "font-semibold text-slate-600"}`}>{snapshot.availableCount} of {snapshot.totalCheckpoints} checkpoints available{snapshot.availableCount < snapshot.totalCheckpoints ? " - unavailable areas shown gray" : ""}</p>}
      </div>
    </div>
    <div className="mt-3 rounded-lg border border-cyan-200/80 bg-slate-50 px-3 py-2.5" aria-live="polite">
      <div className="mb-2 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
        <h3 className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-700">Forecast Snapshot — Selected Hour</h3>
        <p className="text-[11px] font-medium text-cyan-700">{forecastTime ? new Date(forecastTime).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Forecast time unavailable"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <SnapshotMetric icon={Wind} label="Avg. wind" value={formatWeather(snapshot.averageWindMph, 1, "mph")} />
        <SnapshotMetric icon={CloudRain} label="Avg. rainfall" value={formatWeather(snapshot.averageRainInHr, 3, "in/hr")} />
        <SnapshotMetric icon={Snowflake} label="Avg. snowfall" value={formatWeather(snapshot.averageSnowInHr, 3, "in/hr")} />
        <SnapshotMetric icon={Gauge} label="Corridor risk" value={snapshot.overallRisk} risk={snapshot.overallRisk} />
        <SnapshotMetric icon={MapPinned} label="Available" value={route ? `${snapshot.availableCount} / ${snapshot.totalCheckpoints}` : "Unavailable"} />
      </div>
    </div>
  </section>;
}

function formatWeather(value, precision, unit) {
  return Number.isFinite(value) ? `${value.toFixed(precision)} ${unit}` : "Unavailable";
}

function SnapshotMetric({ icon: Icon, label, value, risk }) {
  return <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500"><Icon size={12} className="shrink-0 text-cyan-600" />{label}</div>
    {risk ? <span className={`mt-1 inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-bold ${riskStyles[risk] ?? riskStyles.Unknown}`}>{value}</span>
      : <p className="mt-1 truncate text-[12px] font-bold text-slate-800">{value}</p>}
  </div>;
}
