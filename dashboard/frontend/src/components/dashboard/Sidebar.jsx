import { CalendarClock, CloudSun, LoaderCircle, MapPin, Navigation, Package, RotateCcw, Route } from "lucide-react";
import HelpTooltip from "./HelpTooltip";

const logisticsHubs = ["New York", "Boston", "Chicago", "Los Angeles"];

export default function Sidebar({ values, onChange, onSubmit, onReset, loading, minDepartureTime, maxDepartureTime }) {
  const update = (field, value) => onChange({ ...values, [field]: value });
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-700 bg-[#0d1322] p-4 shadow-xl shadow-black/40 lg:h-screen lg:w-[208px] lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-600 bg-[#081629] shadow-md shadow-black/30"><img src="/assets/spotter_logo.png" alt="Spotter AI logo" className="h-9 w-9 object-contain" /></div>
        <div><h1 className="text-sm font-bold tracking-wide text-white">SPOTTER AI</h1><p className="text-[10px] text-slate-400">Dispatch intelligence</p></div>
      </div>
      <form className="space-y-3.5" onSubmit={onSubmit}>
        <Field label="Origin" icon={<MapPin size={16} />} help="Where the truck begins its trip. Enter a city, address, or logistics hub."><input required value={values.origin} onChange={(e) => update("origin", e.target.value)} placeholder="e.g. New York, NY" /><HubChips onSelect={(city) => update("origin", city)} /></Field>
        <Field label="Destination" icon={<Navigation size={16} />} help="Where the truck must arrive. This is used to find road-route alternatives."><input required value={values.destination} onChange={(e) => update("destination", e.target.value)} placeholder="e.g. Boston, MA" /><HubChips onSelect={(city) => update("destination", city)} /></Field>
        <Field label="Departure" icon={<CalendarClock size={16} />} help="Planned departure in your local timezone. It is converted to UTC for checkpoint ETAs and weather matching.">
          <input required type="datetime-local" step="60" min={minDepartureTime} max={maxDepartureTime} value={values.departure_time} onChange={(e) => update("departure_time", e.target.value)} aria-describedby="departure-time-note" />
          <p id="departure-time-note" className="mt-1 text-[10px] font-normal text-slate-500">Local time · within 15 days</p>
        </Field>
        <Field label="Truck load" icon={<Package size={16} />} help="Cargo weight in pounds. Heavy loads can increase wind-related route risk.">
          <div className="flex items-center gap-2">
            <input className="min-w-0 flex-1" min="0" max="80000" step="500" type="number" value={values.load_weight} onChange={(e) => update("load_weight", e.target.value)} />
            <span className="text-xs text-slate-400">lbs</span>
          </div>
          <input aria-label="Truck load slider" className="mt-2 w-full accent-cyan-400" min="0" max="80000" step="500" type="range" value={values.load_weight} onChange={(e) => update("load_weight", e.target.value)} />
        </Field>
        <Field label="Checkpoint interval" help="How often weather is sampled along each route. Shorter intervals provide more detail."><select value={values.checkpoint_interval_miles} onChange={(e) => update("checkpoint_interval_miles", Number(e.target.value))}><option value={10}>Every 10 miles</option><option value={25}>Every 25 miles</option><option value={50}>Every 50 miles</option></select></Field>
        <div className="flex gap-2">
          <HelpTooltip text="Calculate route alternatives, checkpoint weather, and the safest recommendation." className="flex-1"><button disabled={loading} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-2 py-2.5 text-xs font-semibold text-white shadow-md shadow-cyan-950/50 transition hover:from-cyan-400 hover:to-blue-500 hover:shadow-lg hover:shadow-cyan-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-wait disabled:opacity-60">
            {loading ? <LoaderCircle className="animate-spin" size={16} /> : <Route size={16} />} {loading ? "Scanning…" : "Calculate"}
          </button></HelpTooltip>
          <HelpTooltip text="Clear the route and restore the default New York to Boston inputs." align="right"><button type="button" onClick={onReset} disabled={loading} aria-label="Clear route" className="inline-flex h-full items-center justify-center gap-1 rounded-lg border border-slate-500 bg-transparent px-2 text-xs font-medium text-slate-300 transition hover:border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
            <RotateCcw size={15} />
            Reset
          </button></HelpTooltip>
        </div>
      </form>
      <div className="mt-5 rounded-lg border border-slate-600 bg-[#111b30] p-3 shadow-md shadow-black/40">
        <div className="flex items-start gap-2">
          <CloudSun size={15} className="mt-0.5 shrink-0 text-cyan-400" aria-hidden="true" />
          <div><h2 className="text-[11px] font-semibold leading-4 text-slate-200">ETA-Based Weather Intelligence</h2><p className="mt-1 text-[10px] leading-4 text-slate-400">Weather risks are evaluated based on when your truck is expected to reach each checkpoint.</p></div>
        </div>
      </div>
    </aside>
  );
}

function Field({ label, icon, help, children }) {
  return <div className="block text-xs font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5 text-slate-400">{icon}{label}{help && <HelpTooltip text={help} />}</span><div className="[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-slate-500 [&_input]:bg-[#111b30] [&_input]:px-2.5 [&_input]:py-2 [&_input]:text-xs [&_input]:text-slate-100 [&_input]:outline-none [&_input]:transition [&_input]:placeholder:text-slate-500 [&_input]:focus:border-cyan-400 [&_input]:focus:ring-2 [&_input]:focus:ring-cyan-400/40 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-slate-500 [&_select]:bg-[#111b30] [&_select]:px-2.5 [&_select]:py-2 [&_select]:text-xs [&_select]:text-slate-100 [&_select]:outline-none [&_select]:transition [&_select]:focus:border-cyan-400 [&_select]:focus:ring-2 [&_select]:focus:ring-cyan-400/40">{children}</div></div>;
}

function HubChips({ onSelect }) {
  return <div className="mt-1.5 flex flex-wrap gap-1" aria-label="Quick city suggestions">
    {logisticsHubs.map((city) => <button key={city} type="button" onClick={() => onSelect(city)} className="rounded-full border border-slate-600 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 transition hover:border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">{city}</button>)}
  </div>;
}
