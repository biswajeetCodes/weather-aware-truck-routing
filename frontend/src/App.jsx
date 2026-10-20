import { useMemo, useState } from "react";
import { AlertCircle, Radar, ShieldCheck } from "lucide-react";
import Sidebar from "./components/dashboard/Sidebar";
import KpiCards from "./components/dashboard/KpiCards";
import RouteMap from "./components/dashboard/RouteMap";
import RouteAnalytics from "./components/dashboard/RouteAnalytics";
import { calculateSafeRoute } from "./services/api";

const initialValues = { origin: "New York, NY", destination: "Boston, MA", load_weight: 35000, checkpoint_interval_miles: 25 };

export default function App() {
  const [values, setValues] = useState(initialValues);
  const [data, setData] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRoute = useMemo(() => data?.routes.find((route) => route.route_id === selectedRouteId) ?? data?.routes[0], [data, selectedRouteId]);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = await calculateSafeRoute({ ...values, load_weight: Number(values.load_weight) });
      setData(result);
      setSelectedRouteId(result.recommended_route_id);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return <div className="min-h-screen bg-ink text-slate-200 lg:flex">
    <Sidebar values={values} onChange={setValues} onSubmit={handleSubmit} loading={loading} />
    <main className="min-w-0 flex-1 p-4 sm:p-6">
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">Live route intelligence</p><h2 className="text-2xl font-semibold tracking-tight text-white">Weather-aware dispatch center</h2><p className="mt-1 text-sm text-slate-400">Compare road routes against weather conditions at each arrival checkpoint.</p></div><div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Forecast monitoring active</div></header>
      {error && <div role="alert" className="mb-5 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertCircle size={18}/>{error}</div>}
      <KpiCards route={selectedRoute} loadWeight={values.load_weight} departureTime={data?.departure_time} />
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]"><div className="min-h-[440px]"><RouteMap routes={data?.routes} selectedRouteId={selectedRoute?.route_id} onSelect={setSelectedRouteId} /></div>
        <div className="rounded-xl border border-line bg-panel p-6">{selectedRoute ? <><div className="mb-5 flex items-center gap-2 text-emerald-300"><ShieldCheck size={20}/><span className="text-sm font-semibold">Dispatch recommendation</span></div><p className="text-xl font-semibold text-white">Route {selectedRoute.route_id} is selected</p><p className="mt-2 text-sm leading-6 text-slate-400">This route is ranked using severe exposure, high-risk exposure, average weather risk, then duration.</p><div className="mt-6 rounded-lg bg-slate-950/40 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">No-travel exposure</p><p className="mt-1 text-2xl font-semibold text-white">{selectedRoute.risk_summary.no_travel_miles} mi</p></div></> : <div className="flex h-full flex-col items-center justify-center text-center"><Radar size={32} className="mb-3 text-cyan-300"/><p className="font-medium text-slate-200">Ready to scan</p><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Enter an origin and destination to calculate weather-aware alternatives.</p></div>}</div>
      </section>
      <section className="mt-5"><RouteAnalytics routes={data?.routes ?? []} selectedRouteId={selectedRoute?.route_id} onSelect={setSelectedRouteId}/></section>
    </main>
  </div>;
}
