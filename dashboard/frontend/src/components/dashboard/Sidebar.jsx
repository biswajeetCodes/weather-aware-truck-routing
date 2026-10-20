import { LoaderCircle, MapPin, Navigation, Package, Route } from "lucide-react";

export default function Sidebar({ values, onChange, onSubmit, loading }) {
  const update = (field, value) => onChange({ ...values, [field]: value });
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-700 bg-[#0d1322] p-5 shadow-xl shadow-black/40 lg:min-h-screen lg:w-80 lg:border-r lg:border-b-0 lg:p-6">
      <div className="mb-9 flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 p-2.5 text-white shadow-lg shadow-cyan-900/40"><Route size={22} strokeWidth={2.7} /></div>
        <div><h1 className="font-bold tracking-wide text-white">SPOTTER AI</h1><p className="text-xs text-slate-400">Dispatch intelligence</p></div>
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
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-cyan-950/50 transition hover:from-cyan-400 hover:to-blue-500 hover:shadow-lg hover:shadow-cyan-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-wait disabled:opacity-60">
          {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Route size={18} />} {loading ? "Scanning conditions…" : "Calculate Safe Route"}
        </button>
      </form>
      <div className="mt-auto hidden rounded-xl border border-slate-600 bg-[#111b30] p-4 text-xs leading-5 text-slate-400 shadow-lg shadow-black/40 lg:block">
        Forecasts are evaluated at each checkpoint's estimated arrival time.
      </div>
    </aside>
  );
}

function Field({ label, icon, children }) {
  return <label className="block text-sm font-medium text-slate-300"><span className="mb-2 flex items-center gap-2 text-slate-400">{icon}{label}</span><div className="[&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-500 [&_input]:bg-[#111b30] [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-sm [&_input]:text-slate-100 [&_input]:outline-none [&_input]:transition [&_input]:placeholder:text-slate-500 [&_input]:focus:border-cyan-400 [&_input]:focus:ring-2 [&_input]:focus:ring-cyan-400/40 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-500 [&_select]:bg-[#111b30] [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-sm [&_select]:text-slate-100 [&_select]:outline-none [&_select]:transition [&_select]:focus:border-cyan-400 [&_select]:focus:ring-2 [&_select]:focus:ring-cyan-400/40">{children}</div></label>;
}
