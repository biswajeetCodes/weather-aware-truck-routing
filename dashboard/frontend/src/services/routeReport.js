import { formatDuration } from "../components/dashboard/formatters.js";
import { buildRecommendationReason } from "../components/dashboard/recommendationReason.js";

const NAVY = [13, 19, 34];
const CYAN = [8, 145, 178];
const SLATE = [71, 85, 105];
const LIGHT = [241, 245, 249];
const BORDER = [203, 213, 225];
const GREEN = [5, 150, 105];

const available = (value) => value !== undefined && value !== null && value !== "";
const valueOrUnavailable = (value, suffix = "") => available(value) ? `${value}${suffix}` : "Unavailable";

function formatDateTime(value) {
  if (!available(value)) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function locationName(location, fallback) {
  return location?.display_name || fallback || "Unavailable";
}

async function loadLogo() {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch("/assets/spotter_logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function createRouteReport({ data, selectedRoute, inputs, generatedAt = new Date() }) {
  if (!data?.routes?.length || !selectedRoute) throw new Error("Route data is unavailable for this report.");
  const recommendedRoute = data.routes.find((route) => route.route_id === data.recommended_route_id);
  if (!recommendedRoute) throw new Error("Recommended route data is unavailable for this report.");

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const logo = await loadLogo();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const drawHeader = (continuation = false) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 28, "F");
    if (logo) doc.addImage(logo, "PNG", margin, 5, 18, 18);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SPOTTER AI", logo ? 36 : margin, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(165, 243, 252);
    doc.text(continuation ? "Weather-Aware Route Report - Continued" : "Weather-Aware Route Intelligence", logo ? 36 : margin, 18);
    y = 36;
  };

  const ensureSpace = (height) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    drawHeader(true);
  };

  const sectionTitle = (title) => {
    ensureSpace(12);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, "F");
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, margin + 3, y + 5.3);
    y += 12;
  };

  const wrappedText = (text, { color = SLATE, size = 9, bold = false, gap = 3 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), contentWidth);
    ensureSpace(lines.length * 4.2 + gap);
    doc.text(lines, margin, y);
    y += lines.length * 4.2 + gap;
  };

  const keyValue = (label, value, x, width) => {
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(value, width);
    doc.text(lines, x, y + 4.5);
    return lines.length;
  };

  drawHeader();
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Route Safety Report", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`Generated ${formatDateTime(generatedAt)}`, margin, y + 6);
  y += 14;

  sectionTitle("Dispatch summary");
  const half = (contentWidth - 8) / 2;
  let lines = Math.max(
    keyValue("Origin", locationName(data.origin, inputs?.origin), margin, half),
    keyValue("Destination", locationName(data.destination, inputs?.destination), margin + half + 8, half),
  );
  y += lines * 4.2 + 8;
  ensureSpace(14);
  lines = Math.max(
    keyValue("Departure", formatDateTime(data.departure_time || inputs?.departure_time), margin, half),
    keyValue("Load and sampling", `${valueOrUnavailable(data.load_weight_lbs ?? inputs?.load_weight, " lbs")} | ${valueOrUnavailable(data.checkpoint_interval_miles ?? inputs?.checkpoint_interval_miles, " mi checkpoints")}`, margin + half + 8, half),
  );
  y += lines * 4.2 + 8;
  ensureSpace(14);
  lines = Math.max(
    keyValue("Recommended route", `Route ${recommendedRoute.route_id}`, margin, half),
    keyValue("Currently selected", `Route ${selectedRoute.route_id}`, margin + half + 8, half),
  );
  y += lines * 4.2 + 5;

  ensureSpace(50);
  sectionTitle("Recommended route metrics");
  const metrics = [
    ["Distance", valueOrUnavailable(recommendedRoute.distance_miles, " mi")],
    ["Travel duration", available(recommendedRoute.duration_minutes) ? formatDuration(recommendedRoute.duration_minutes) : "Unavailable"],
    ["Severe-risk miles", valueOrUnavailable(recommendedRoute.risk_summary?.severe_miles, " mi")],
    ["High-risk miles", valueOrUnavailable(recommendedRoute.risk_summary?.high_miles, " mi")],
    ["Average weather risk", valueOrUnavailable(recommendedRoute.risk_summary?.average_risk_score, "/5")],
  ];
  const metricWidth = (contentWidth - 8) / 3;
  metrics.forEach(([label, value], index) => {
    if (index === 3) y += 17;
    const column = index % 3;
    const x = margin + column * (metricWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, y, metricWidth, 13, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text(label.toUpperCase(), x + 2.5, y + 4.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(String(value), x + 2.5, y + 9.7);
  });
  y += 18;

  sectionTitle("Why this route?");
  wrappedText(buildRecommendationReason(recommendedRoute, data.routes), { color: NAVY, size: 9 });
  wrappedText("Ranking order: fewest severe-risk miles, fewest high-risk miles, lowest distance-weighted average risk, then shortest duration. Provider route order is used only for an exact tie.", { size: 8 });

  sectionTitle("Genuine route alternatives");
  const routeHeaders = ["Route", "Distance", "Duration", "Severe", "High", "Avg. risk"];
  const routeWidths = [24, 31, 31, 31, 31, 34];
  let x = margin;
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, 8, "F");
  routeHeaders.forEach((header, index) => {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(header, x + 2, y + 5.2);
    x += routeWidths[index];
  });
  y += 8;
  data.routes.forEach((route, index) => {
    ensureSpace(10);
    doc.setFillColor(...(index % 2 ? [248, 250, 252] : [255, 255, 255]));
    doc.rect(margin, y, contentWidth, 9, "F");
    const routeLabel = `Route ${route.route_id}${route.recommended ? " *" : ""}${route.route_id === selectedRoute.route_id ? " [S]" : ""}`;
    const values = [routeLabel, valueOrUnavailable(route.distance_miles, " mi"), available(route.duration_minutes) ? formatDuration(route.duration_minutes) : "Unavailable", valueOrUnavailable(route.risk_summary?.severe_miles, " mi"), valueOrUnavailable(route.risk_summary?.high_miles, " mi"), valueOrUnavailable(route.risk_summary?.average_risk_score, "/5")];
    x = margin;
    values.forEach((value, valueIndex) => {
      doc.setTextColor(...(route.recommended ? GREEN : NAVY));
      doc.setFont("helvetica", route.recommended ? "bold" : "normal");
      doc.setFontSize(7.2);
      doc.text(String(value), x + 2, y + 5.8, { maxWidth: routeWidths[valueIndex] - 3 });
      x += routeWidths[valueIndex];
    });
    y += 9;
  });
  wrappedText("* Recommended route | [S] Currently selected route", { size: 7.5, gap: 4 });

  sectionTitle(`Selected route checkpoint forecast - Route ${selectedRoute.route_id}`);
  wrappedText("Weather values below are forecasts matched to each checkpoint's estimated arrival time. They are not observed conditions. Missing provider data is labeled Unavailable.", { size: 8 });
  const checkpoints = selectedRoute.checkpoints ?? [];
  if (!checkpoints.length) {
    wrappedText("Checkpoint data unavailable.", { bold: true });
  } else {
    checkpoints.forEach((checkpoint, index) => {
      ensureSpace(21);
      doc.setDrawColor(...BORDER);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentWidth, 17, 1.5, 1.5, "FD");
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(`${index === 0 ? "Origin" : `Checkpoint ${index}`} | ${valueOrUnavailable(checkpoint.distance_from_origin_miles, " mi")} | Risk: ${checkpoint.risk_level || "Unknown"}`, margin + 3, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(...SLATE);
      doc.text(`ETA: ${formatDateTime(checkpoint.eta)} | Forecast valid: ${formatDateTime(checkpoint.forecast_time)}`, margin + 3, y + 9.2, { maxWidth: contentWidth - 6 });
      const weather = checkpoint.weather;
      doc.text(`Wind: ${valueOrUnavailable(weather?.wind_mph, " mph")} | Rain: ${valueOrUnavailable(weather?.rain_in_hr, " in/hr")} | Snow: ${valueOrUnavailable(weather?.snow_in_hr, " in/hr")}`, margin + 3, y + 13.8, { maxWidth: contentWidth - 6 });
      y += 20;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...BORDER);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE);
    doc.text("Spotter AI | Weather-Aware Route Intelligence", margin, pageHeight - 7);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }
  return doc;
}

export async function downloadRouteReport(context) {
  const doc = await createRouteReport(context);
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`spotter-route-report-${date}.pdf`);
}
