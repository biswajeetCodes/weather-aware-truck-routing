import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Moon, Sun } from "lucide-react";
import Sidebar from "./components/dashboard/Sidebar";
import KpiCards from "./components/dashboard/KpiCards";
import RouteMap from "./components/dashboard/RouteMap";
import RouteAnalytics from "./components/dashboard/RouteAnalytics";
import ForecastHeatmapControl from "./components/dashboard/ForecastHeatmapControl";
import RouteRecommendation from "./components/dashboard/RouteRecommendation";
import WeatherRiskAlerts from "./components/dashboard/WeatherRiskAlerts";
import { calculateSafeRoute, getDefaultDepartureTime, getMaximumDepartureTime, getMinimumDepartureTime } from "./services/api";

const createInitialValues = () => ({ origin: "New York, NY", destination: "Boston, MA", departure_time: getDefaultDepartureTime(), load_weight: 35000, checkpoint_interval_miles: 25 });

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("spotter-theme") === "dark" ? "dark" : "light");
  const [values, setValues] = useState(createInitialValues);
  const [data, setData] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forecastOffsetHours, setForecastOffsetHours] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const requestId = useRef(0);

  const selectedRoute = useMemo(() => data?.routes.find((route) => route.route_id === selectedRouteId) ?? data?.routes[0], [data, selectedRouteId]);
  const recommendedRoute = useMemo(() => data?.routes.find((route) => route.route_id === data.recommended_route_id), [data]);
  useEffect(() => {
    localStorage.setItem("spotter-theme", theme);
  }, [theme]);
  async function handleSubmit(event) {
    event.preventDefault();
    const currentRequestId = ++requestId.current;
    setError(""); setLoading(true);
    try {
      const result = await calculateSafeRoute({ ...values, load_weight: Number(values.load_weight) });
      if (currentRequestId !== requestId.current) return;
      setData(result);
      setSelectedRouteId(result.recommended_route_id);
      setForecastOffsetHours(0);
    } catch (err) {
      if (currentRequestId === requestId.current) setError(err.message);
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }

  function handleReset() {
    requestId.current += 1;
    setValues(createInitialValues());
    setData(null);
    setSelectedRouteId(null);
    setError("");
    setLoading(false);
    setForecastOffsetHours(0);
  }

  const dark = theme === "dark";

  return <div className={`${dark ? "dark" : ""} min-h-screen overflow-x-hidden bg-slate-100 text-slate-900 transition-colors duration-300 lg:flex lg:h-screen`}>
    {sidebarOpen && <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((open) => !open)} values={values} onChange={setValues} onSubmit={handleSubmit} onReset={handleReset} loading={loading} minDepartureTime={getMinimumDepartureTime()} maxDepartureTime={getMaximumDepartureTime()} />
    <main className="app-workspace min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 xl:p-6">
      <header className="mb-5 flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-cyan-700">Live route intelligence</p><h2 className="text-2xl font-extrabold tracking-[-.025em] text-slate-900 sm:text-[26px]">Weather-aware dispatch center</h2><p className="mt-1 text-[13px] leading-5 text-slate-600">Compare road routes against weather conditions at each arrival checkpoint.</p></div><div className="flex shrink-0 items-center gap-2"><div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.12)]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.9)]" /> Forecast monitoring active</div><button type="button" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-cyan-400 hover:text-cyan-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><span className="sr-only">Switch to {dark ? "light" : "dark"} mode</span>{dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}</button></div></header>
      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-sm text-rose-800 shadow-md shadow-rose-100"><AlertCircle size={17}/>{error}</div>}
      <KpiCards route={selectedRoute} loadWeight={values.load_weight} departureTime={data?.departure_time} />
      <div className="mt-4"><ForecastHeatmapControl offset={forecastOffsetHours} onChange={setForecastOffsetHours} route={selectedRoute} forecastStartTime={data?.forecast_start_time} /></div>
      <section className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(260px,1fr)]"><RouteMap routes={data?.routes} selectedRouteId={selectedRoute?.route_id} onSelect={setSelectedRouteId} forecastOffsetHours={forecastOffsetHours} />
        <div className="flex min-h-[300px] min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-all duration-200 hover:border-cyan-300 hover:shadow-[0_12px_30px_rgba(8,145,178,0.1)]"><RouteRecommendation routes={data?.routes ?? []} recommendedRoute={recommendedRoute} selectedRoute={selectedRoute} onSelectRecommended={() => setSelectedRouteId(recommendedRoute.route_id)} reportData={data} inputValues={values} /></div>
      </section>
      <WeatherRiskAlerts route={selectedRoute} />
      <section className="mt-4"><RouteAnalytics routes={data?.routes ?? []} selectedRouteId={selectedRoute?.route_id} onSelect={setSelectedRouteId}/></section>
      <footer className="mt-4 flex flex-col gap-0.5 border-t border-slate-300 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold text-slate-700">Spotter AI | Weather-Aware Route Intelligence</span><span>Built for smarter dispatch decisions · Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="font-medium text-cyan-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">Open-Meteo</a></span></footer>
    </main>
  </div>;
}
