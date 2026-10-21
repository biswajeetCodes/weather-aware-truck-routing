import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { getCheckpointForecast } from "./forecastSnapshot";

const colors = { Low: "#10b981", Moderate: "#f59e0b", High: "#f97316", Severe: "#f43f5e", "No Travel": "#991b1b", Unknown: "#94a3b8" };

function routePositions(route) {
  const geometry = route.geometry?.coordinates;
  if (route.geometry?.type === "LineString" && geometry?.length > 1) {
    return geometry
      .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
      .map(([longitude, latitude]) => [Number(latitude), Number(longitude)])
      .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180);
  }
  return route.checkpoints
    .map((point) => [Number(point.latitude), Number(point.longitude)])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude)
      && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180);
}

function distanceMiles([lat1, lon1], [lat2, lon2]) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lon2 - lon1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(a));
}

function buildRiskRuns(route, offset) {
  const positions = routePositions(route);
  if (positions.length < 2) return [];
  const checkpoints = route.checkpoints;
  const boundaries = checkpoints.slice(0, -1).map((point, index) =>
    (point.distance_from_origin_miles + checkpoints[index + 1].distance_from_origin_miles) / 2);
  const runs = [];
  let travelled = 0;
  let checkpointIndex = 0;

  for (let index = 0; index < positions.length - 1; index += 1) {
    const start = positions[index];
    const end = positions[index + 1];
    const segmentMiles = distanceMiles(start, end);
    const midpoint = travelled + segmentMiles / 2;
    while (checkpointIndex < boundaries.length && midpoint > boundaries[checkpointIndex]) checkpointIndex += 1;
    const forecast = getCheckpointForecast(checkpoints[checkpointIndex], offset);
    const risk = forecast?.available ? forecast.risk_level : "Unknown";
    const previous = runs[runs.length - 1];
    if (previous?.risk === risk) previous.positions.push(end);
    else runs.push({ risk, positions: [start, end] });
    travelled += segmentMiles;
  }
  return runs;
}

function FitSelectedRoute({ route }) {
  const map = useMap();
  useEffect(() => {
    if (!route) return;
    const points = routePositions(route);
    if (points.length < 2) return;
    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      map.fitBounds(points, { padding: [32, 32], maxZoom: 10, animate: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [map, route]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let frame;
    let previousWidth = container.clientWidth;
    let previousHeight = container.clientHeight;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width === previousWidth && height === previousHeight) return;
      previousWidth = width;
      previousHeight = height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false, debounceMoveend: true }));
    });
    observer.observe(container);
    frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [map]);
  return null;
}

export default function RouteMap({ routes, selectedRouteId, onSelect, forecastOffsetHours = 0 }) {
  const usableRoutes = routes ?? [];
  const selectedRoute = usableRoutes.find((route) => route.route_id === selectedRouteId);
  const riskRuns = useMemo(
    () => selectedRoute ? buildRiskRuns(selectedRoute, forecastOffsetHours) : [],
    [selectedRoute, forecastOffsetHours],
  );
  const center = usableRoutes[0]?.checkpoints?.[0]
    ? [usableRoutes[0].checkpoints[0].latitude, usableRoutes[0].checkpoints[0].longitude]
    : [39.5, -98.35];

  return <div className="h-[300px] min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.09)] transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.12)] sm:h-[340px] xl:h-[360px]">
    <MapContainer center={center} zoom={4} scrollWheelZoom preferCanvas style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitSelectedRoute route={selectedRoute} /><MapResizer />
      {usableRoutes.filter((route) => route.route_id !== selectedRouteId).map((route) => <Polyline
        key={route.route_id} positions={routePositions(route)}
        pathOptions={{ color: "#64748b", weight: 3, opacity: .48, dashArray: "6 7" }}
        eventHandlers={{ click: () => onSelect(route.route_id) }} />)}
      {riskRuns.map((run, index) => <Polyline key={`${index}-${run.risk}`} positions={run.positions}
        pathOptions={{ color: colors[run.risk] ?? colors.Unknown, weight: 6, opacity: .95, lineCap: "round", lineJoin: "round" }}
        eventHandlers={{ click: () => onSelect(selectedRouteId) }} />)}
      {selectedRoute?.checkpoints.map((point, index) => {
        const forecast = getCheckpointForecast(point, forecastOffsetHours);
        const activeRisk = forecast?.available ? forecast.risk_level : "Unknown";
        const activeWeather = forecast?.available ? forecast.weather : null;
        return <CircleMarker key={`${point.latitude}-${point.longitude}`} center={[point.latitude, point.longitude]} radius={index === 0 ? 7 : 5}
          pathOptions={{ color: colors[activeRisk], fillColor: colors[activeRisk], fillOpacity: 1, weight: 2 }}>
          <Popup><div className="space-y-1 text-sm">
            <b>{index === 0 ? "Origin" : `${point.distance_from_origin_miles} mi checkpoint`}</b><br />
            Forecast +{forecastOffsetHours}h: <b style={{ color: colors[activeRisk] }}>{activeRisk}</b><br />
            {activeWeather
              ? <>Wind {activeWeather.wind_mph} mph / Rain {activeWeather.rain_in_hr} in/hr / Snow {activeWeather.snow_in_hr} in/hr</>
              : <span>Hourly weather unavailable</span>}
            <br /><span className="text-slate-400">{forecast?.forecast_time ? new Date(forecast.forecast_time).toLocaleString() : "Forecast time unavailable"}</span>
            <hr className="border-slate-600" />
            <span>ETA risk: <b style={{ color: colors[point.risk_level] }}>{point.risk_level}</b></span><br />
            <span className="text-slate-400">Arrival {new Date(point.eta).toLocaleString()}</span>
          </div></Popup>
        </CircleMarker>;
      })}
    </MapContainer>
  </div>;
}
