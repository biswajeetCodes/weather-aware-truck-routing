import { Download, LoaderCircle, Radar, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { formatDuration } from "./formatters";
import { downloadRouteReport } from "../../services/routeReport";
import { buildRecommendationReason } from "./recommendationReason";

function Metric({ label, value }) {
  return <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
    <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-1 truncate text-[13px] font-bold text-slate-900">{value}</dd>
  </div>;
}

export default function RouteRecommendation({ routes = [], recommendedRoute, selectedRoute, onSelectRecommended, reportData, inputValues }) {
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState("");

  const handleDownload = async () => {
    setReporting(true);
    setReportError("");
    try {
      await downloadRouteReport({ data: reportData, selectedRoute, inputs: inputValues });
    } catch {
      setReportError("The PDF report could not be generated. Please try again.");
    } finally {
      setReporting(false);
    }
  };

  if (!selectedRoute || !recommendedRoute) {
    return <div className="flex h-full flex-col items-center justify-center text-center">
      <Radar size={27} className="mb-2 text-cyan-600" />
      <p className="text-sm font-semibold text-slate-900">Ready to scan</p>
      <p className="mt-1.5 max-w-xs text-[13px] leading-5 text-slate-500">Enter an origin and destination to calculate weather-aware alternatives.</p>
    </div>;
  }

  const summary = recommendedRoute.risk_summary;
  const reason = buildRecommendationReason(recommendedRoute, routes);

  return <>
    <div className="mb-3 flex items-center gap-2 text-emerald-600">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50"><ShieldCheck size={17} aria-hidden="true" /></span>
      <span className="text-[13px] font-bold">Safest-route recommendation</span>
    </div>
    <p className="text-lg font-bold text-slate-900">Recommended: Route {recommendedRoute.route_id}</p>
    <p className="mt-1 text-[12px] font-semibold text-cyan-700">Currently selected: Route {selectedRoute.route_id}</p>
    {!selectedRoute.recommended && <button type="button" onClick={onSelectRecommended} className="mt-2 self-start rounded-md border border-cyan-300 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">View recommended route</button>}
    <button type="button" onClick={handleDownload} disabled={reporting} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-[11px] font-bold text-cyan-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-cyan-400 hover:bg-cyan-100 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0">
      {reporting ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
      {reporting ? "Preparing PDF…" : "Download PDF Report"}
    </button>
    {reportError && <p role="alert" className="mt-2 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-700">{reportError}</p>}

    <section aria-labelledby="why-this-route-heading" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
      <h3 id="why-this-route-heading" className="text-[12px] font-bold text-slate-900">Why This Route?</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        <Metric label="Severe risk" value={`${summary.severe_miles} mi`} />
        <Metric label="High risk" value={`${summary.high_miles} mi`} />
        <Metric label="Average risk" value={`${summary.average_risk_score}/5`} />
        <Metric label="Travel duration" value={formatDuration(recommendedRoute.duration_minutes)} />
      </dl>
      <p className="mt-2.5 text-[12px] leading-5 text-slate-700">{reason}</p>
      <p className="mt-2 border-t border-slate-200 pt-2 text-[10px] leading-4 text-slate-500">Ranking order: fewest severe-risk miles, fewest high-risk miles, lowest distance-weighted average risk, then shortest duration.</p>
    </section>

    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Selected route · No-travel exposure</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{selectedRoute.risk_summary.no_travel_miles} mi</p>
    </div>
  </>;
}
