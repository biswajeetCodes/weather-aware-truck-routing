const API_URL = import.meta.env?.VITE_ROUTE_WEATHER_API ?? "http://127.0.0.1:8000/api/route-weather/";

const DEPARTURE_ROUNDING_MINUTES = 15;
const MAX_DEPARTURE_DAYS = 15;
const MAX_LOAD_WEIGHT_LBS = 80000;

function toLocalDateTimeValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getDefaultDepartureTime(now = new Date()) {
  const interval = DEPARTURE_ROUNDING_MINUTES * 60 * 1000;
  const rounded = new Date(Math.ceil((now.getTime() + 1) / interval) * interval);
  return toLocalDateTimeValue(rounded);
}

export function getMinimumDepartureTime(now = new Date()) {
  const nextMinute = new Date(Math.ceil((now.getTime() + 1) / 60000) * 60000);
  return toLocalDateTimeValue(nextMinute);
}

export function getMaximumDepartureTime(now = new Date()) {
  return toLocalDateTimeValue(new Date(now.getTime() + MAX_DEPARTURE_DAYS * 24 * 60 * 60 * 1000));
}

export function serializeDepartureTime(localDateTime, now = new Date()) {
  const departure = new Date(localDateTime);
  if (!localDateTime || Number.isNaN(departure.getTime())) {
    throw new Error("Choose a valid departure date and time.");
  }
  if (departure.getTime() <= now.getTime()) {
    throw new Error("Departure time must be in the future.");
  }
  if (departure.getTime() > now.getTime() + MAX_DEPARTURE_DAYS * 24 * 60 * 60 * 1000) {
    throw new Error("Departure time must be within the available 15-day forecast window.");
  }
  return departure.toISOString();
}

export function buildRouteRequestPayload(payload, now = new Date()) {
  const origin = typeof payload.origin === "string" ? payload.origin.trim() : "";
  const destination = typeof payload.destination === "string" ? payload.destination.trim() : "";
  if (!origin || !destination) throw new Error("Enter both an origin and destination.");
  if (origin.replace(/\s+/g, " ").toLocaleLowerCase() === destination.replace(/\s+/g, " ").toLocaleLowerCase()) {
    throw new Error("Origin and destination must be different locations.");
  }
  const loadWeight = Number(payload.load_weight);
  if (!Number.isFinite(loadWeight) || loadWeight <= 0 || loadWeight > MAX_LOAD_WEIGHT_LBS) {
    throw new Error("Truck load must be greater than 0 and no more than 80,000 lbs.");
  }
  return { ...payload, origin, destination, load_weight: loadWeight, departure_time: serializeDepartureTime(payload.departure_time, now) };
}

export async function calculateSafeRoute(payload) {
  const requestPayload = buildRouteRequestPayload(payload);
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Route calculation failed. Please try again.");
  return body;
}
