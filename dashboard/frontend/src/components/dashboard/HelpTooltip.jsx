import { CircleHelp } from "lucide-react";
import { cloneElement, isValidElement, useId } from "react";

export default function HelpTooltip({ text, children, align = "left", className = "" }) {
  const tooltipId = useId();
  const trigger = children && isValidElement(children)
    ? cloneElement(children, { "aria-describedby": tooltipId })
    : <span tabIndex="0" role="img" aria-label="More information" aria-describedby={tooltipId} className="inline-flex cursor-help rounded text-slate-400 outline-none transition hover:text-cyan-600 focus-visible:ring-2 focus-visible:ring-cyan-500"><CircleHelp size={13} aria-hidden="true" /></span>;
  return <span className={`group/tooltip relative inline-flex min-w-0 ${className}`}>
    {trigger}
    <span id={tooltipId} role="tooltip" className={`pointer-events-none absolute bottom-[calc(100%+.45rem)] z-[1000] hidden w-52 rounded-md border border-slate-600 bg-slate-900 px-2.5 py-2 text-left text-[11px] font-normal leading-4 tracking-normal text-slate-100 shadow-xl group-hover/tooltip:block group-focus-within/tooltip:block ${align === "right" ? "right-0" : "left-0"}`}>
      {text}
    </span>
  </span>;
}
