const API_URL = import.meta.env.VITE_ROUTE_WEATHER_API ?? "http://127.0.0.1:8000/api/route-weather/";

export async function calculateSafeRoute(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Route calculation failed. Please try again.");
  return body;
}
