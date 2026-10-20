import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

const colors = { Low: "#34d399", Moderate: "#fbbf24", High: "#fb923c", Severe: "#fb7185", "No Travel": "#ef4444" };

function FitRoutes({ routes }) {
  const map = useMap();
  useEffect(() => {
    const points = routes.flatMap((route) => route.checkpoints.map((point) => [point.latitude, point.longitude]));
    if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 10 });
  }, [map, routes]);
  return null;
}

export default function RouteMap({ routes, selectedRouteId, onSelect }) {
  const usableRoutes = routes ?? [];
  const center = usableRoutes[0]?.checkpoints?.[0] ? [usableRoutes[0].checkpoints[0].latitude, usableRoutes[0].checkpoints[0].longitude] : [39.5, -98.35];
  return <div className="h-[440px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg shadow-slate-300/60 lg:h-full"><MapContainer center={center} zoom={4} scrollWheelZoom><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FitRoutes routes={usableRoutes} />
    {usableRoutes.map((route) => {
      const selected = route.route_id === selectedRouteId;
      const color = route.recommended ? "#22c55e" : route.risk_summary.no_travel_miles > 0 || route.risk_summary.severe_miles > 0 ? "#ef4444" : "#fbbf24";
      const positions = route.checkpoints.map((point) => [point.latitude, point.longitude]);
      return <Polyline key={route.route_id} positions={positions} pathOptions={{ color, weight: selected ? 6 : 3, opacity: selected ? 1 : .55 }} eventHandlers={{ click: () => onSelect(route.route_id) }} />;
    })}
    {usableRoutes.find((route) => route.route_id === selectedRouteId)?.checkpoints.map((point, index) => <CircleMarker key={`${point.latitude}-${point.longitude}`} center={[point.latitude, point.longitude]} radius={index === 0 ? 7 : 5} pathOptions={{ color: colors[point.risk_level], fillColor: colors[point.risk_level], fillOpacity: 1, weight: 2 }}><Popup><div className="space-y-1 text-sm"><b>{index === 0 ? "Origin" : `${point.distance_from_origin_miles} mi checkpoint`}</b><br />Risk: <b style={{ color: colors[point.risk_level] }}>{point.risk_level}</b><br />Wind {point.weather.wind_mph} mph · Rain {point.weather.rain_in_hr} in/hr · Snow {point.weather.snow_in_hr} in/hr<br /><span className="text-slate-400">{new Date(point.eta).toLocaleString()}</span></div></Popup></CircleMarker>)}
  </MapContainer></div>;
}
