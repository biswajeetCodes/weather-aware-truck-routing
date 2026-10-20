import { LoaderCircle, MapPin, Navigation, Package, Route } from "lucide-react";

export default function Sidebar({ values, onChange, onSubmit, loading }) {
  const update = (field, value) => onChange({ ...values, [field]: value });
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-panel p-5 lg:min-h-screen lg:w-80 lg:border-r lg:border-b-0">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-cyan-400 p-2 text-slate-950"><Route size={22} strokeWidth={2.7} /></div>
        <div><h1 className="font-semibold tracking-wide text-white">SPOTTER AI</h1><p className="text-xs text-slate-400">Dispatch intelligence</p></div>
      </div>
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field label="Origin" icon={<MapPin size={16} />}><input required value={values.origin} onChange={(e) => update("origin", e.target.value)} placeholder="e.g. New York, NY" /></Field>
        <Field label="Destination" icon={<Navigation size={16} />}><input required value={values.destination} onChange={(e) => update("destination", e.target.value)} placeholder="e.g. Boston, MA" /></Field>
        <Field label="Truck load" icon={<Package size={16} />}>
          <div className="flex items-center gap-2">
            <input className="min-w-0 flex-1" min="0" max="80000" step="500" type="number" value={values.load_weight} onChange={(e) => update("load_weight", e.target.value)} />
            <span className="text-xs text-slate-400">lbs</span>
          </div>
          <input aria-label="Truck load slider" className="mt-3 w-full accent-cyan-400" min="0" max="80000" step="500" type="range" value={values.load_weight} onChange={(e) => update("load_weight", e.target.value)} />
        </Field>
        <Field label="Checkpoint interval"><select value={values.checkpoint_interval_miles} onChange={(e) => update("checkpoint_interval_miles", Number(e.target.value))}><option value={10}>Every 10 miles</option><option value={25}>Every 25 miles</option><option value={50}>Every 50 miles</option></select></Field>
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">
          {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Route size={18} />} {loading ? "Scanning conditions…" : "Calculate Safe Route"}
        </button>
      </form>
      <div className="mt-auto hidden rounded-lg border border-line bg-slate-950/30 p-4 text-xs leading-5 text-slate-400 lg:block">
        Forecasts are evaluated at each checkpoint's estimated arrival time.
      </div>
    </aside>
  );
}

function Field({ label, icon, children }) {
  return <label className="block text-sm font-medium text-slate-300"><span className="mb-2 flex items-center gap-2 text-slate-400">{icon}{label}</span><div className="[&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-slate-950/50 [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-sm [&_input]:outline-none [&_input]:focus:border-cyan-400 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-slate-950/50 [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-sm">{children}</div></label>;
}
