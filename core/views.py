"""Route weather API and the tested weather/load risk rules."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt

import requests
from rest_framework.decorators import api_view
from rest_framework.response import Response

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
HTTP_TIMEOUT_SECONDS = 12
# Open-Meteo calls are I/O-bound. A bounded pool avoids serial checkpoint
# requests while protecting both our worker and the upstream public service.
MAX_WEATHER_WORKERS = 12
RISK_SCORES = {"Low": 1, "Moderate": 2, "High": 3, "Severe": 4, "No Travel": 5}


class UpstreamServiceError(Exception):
    """A mapping, routing, or weather provider could not serve usable data."""


def calculate_weather_risk(wind_mph, rain_in_hr, snow_in_hr, load_weight_lbs):
    """Return the highest applicable risk, applying the load-based overrides."""
    if wind_mph >= 55:
        return "No Travel"
    if 45 <= wind_mph <= 54 and load_weight_lbs > 30000:
        return "No Travel"
    if 35 <= wind_mph <= 44 and load_weight_lbs > 40000:
        return "Severe"

    wind_risk = "Severe" if wind_mph >= 45 else "High" if wind_mph >= 35 else "Moderate" if wind_mph >= 25 else "Low"
    rain_risk = "No Travel" if rain_in_hr > 1 else "Severe" if rain_in_hr >= .5 else "High" if rain_in_hr >= .25 else "Moderate" if rain_in_hr >= .1 else "Low"
    snow_risk = "No Travel" if snow_in_hr > 3 else "Severe" if snow_in_hr >= 2 else "High" if snow_in_hr >= 1 else "Moderate" if snow_in_hr >= .5 else "Low"
    return max((wind_risk, rain_risk, snow_risk), key=RISK_SCORES.get)


def _get_json(url, *, params, headers=None):
    try:
        response = requests.get(url, params=params, headers=headers, timeout=HTTP_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise UpstreamServiceError("Unable to retrieve live mapping or weather data.") from exc


def geocode_location(location):
    results = _get_json(NOMINATIM_URL, params={"q": location, "format": "jsonv2", "limit": 1},
                        headers={"User-Agent": "SpotterAI-WeatherRouting/1.0"})
    if not results:
        raise UpstreamServiceError("A location could not be found.")
    try:
        item = results[0]
        return {"latitude": float(item["lat"]), "longitude": float(item["lon"]), "display_name": item["display_name"]}
    except (KeyError, TypeError, ValueError) as exc:
        raise UpstreamServiceError("Geocoding returned an invalid location.") from exc


def fetch_routes(origin, destination):
    coordinates = f"{origin['longitude']},{origin['latitude']};{destination['longitude']},{destination['latitude']}"
    payload = _get_json(f"{OSRM_URL}/{coordinates}",
                        params={"alternatives": "true", "overview": "full", "geometries": "geojson", "steps": "false"})
    if payload.get("code") != "Ok" or not payload.get("routes"):
        raise UpstreamServiceError("No drivable route was found between these locations.")
    return payload["routes"]


def _distance_miles(first, second):
    """Great-circle distance between GeoJSON [longitude, latitude] points."""
    lon1, lat1 = map(radians, first)
    lon2, lat2 = map(radians, second)
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 3958.7613 * 2 * asin(sqrt(a))


def sample_checkpoints(coordinates, interval_miles):
    """Create fixed-distance checkpoint positions on an OSRM GeoJSON line."""
    if len(coordinates) < 2:
        raise UpstreamServiceError("Routing returned an incomplete route geometry.")
    checkpoints = [{"longitude": coordinates[0][0], "latitude": coordinates[0][1], "distance_from_origin_miles": 0.0}]
    travelled, next_sample = 0.0, interval_miles
    for start, end in zip(coordinates, coordinates[1:]):
        segment = _distance_miles(start, end)
        while segment and travelled + segment >= next_sample:
            fraction = (next_sample - travelled) / segment
            checkpoints.append({"longitude": start[0] + (end[0] - start[0]) * fraction,
                                "latitude": start[1] + (end[1] - start[1]) * fraction,
                                "distance_from_origin_miles": round(next_sample, 2)})
            next_sample += interval_miles
        travelled += segment
    if checkpoints[-1]["distance_from_origin_miles"] != round(travelled, 2):
        checkpoints.append({"longitude": coordinates[-1][0], "latitude": coordinates[-1][1],
                            "distance_from_origin_miles": round(travelled, 2)})
    return checkpoints


def _parse_departure_time(value):
    if not value:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except (AttributeError, ValueError) as exc:
        raise ValueError("departure_time must be an ISO-8601 datetime.") from exc


def fetch_weather(latitude, longitude, eta):
    """Return forecast values at the forecast hour closest to the arrival ETA."""
    payload = _get_json(OPEN_METEO_URL, params={
        "latitude": latitude, "longitude": longitude, "hourly": "wind_speed_10m,rain,snowfall",
        "wind_speed_unit": "mph", "precipitation_unit": "inch", "timezone": "UTC", "forecast_days": 16,
    })
    hourly = payload.get("hourly", {})
    try:
        times = [datetime.fromisoformat(value).replace(tzinfo=timezone.utc) for value in hourly["time"]]
        index = min(range(len(times)), key=lambda i: abs((times[i] - eta).total_seconds()))
        return {"wind_mph": float(hourly["wind_speed_10m"][index]), "rain_in_hr": float(hourly["rain"][index]),
                # precipitation_unit=inch applies to Open-Meteo hourly snowfall too.
                "snow_in_hr": float(hourly["snowfall"][index]), "forecast_time": times[index]}
    except (KeyError, TypeError, ValueError, IndexError) as exc:
        raise UpstreamServiceError("Weather service returned an incomplete forecast.") from exc


def build_route(route, route_index, load_weight, interval_miles, departure_time):
    checkpoints = sample_checkpoints(route.get("geometry", {}).get("coordinates", []), interval_miles)
    total_miles, duration_seconds = float(route["distance"]) / 1609.344, float(route["duration"])
    checkpoint_etas = [
        departure_time + timedelta(
            seconds=duration_seconds * (checkpoint["distance_from_origin_miles"] / total_miles if total_miles else 0)
        )
        for checkpoint in checkpoints
    ]

    # executor.map preserves input order, so checkpoint ordering and the public
    # response payload remain unchanged while network I/O runs concurrently.
    with ThreadPoolExecutor(max_workers=min(MAX_WEATHER_WORKERS, len(checkpoints))) as executor:
        weather_by_checkpoint = list(executor.map(
            lambda values: fetch_weather(*values),
            ((checkpoint["latitude"], checkpoint["longitude"], eta)
             for checkpoint, eta in zip(checkpoints, checkpoint_etas)),
        ))

    weighted_score = severe_miles = high_miles = no_travel_miles = 0.0
    for index, (checkpoint, eta, weather) in enumerate(zip(checkpoints, checkpoint_etas, weather_by_checkpoint)):
        risk = calculate_weather_risk(weather["wind_mph"], weather["rain_in_hr"], weather["snow_in_hr"], load_weight)
        next_distance = checkpoints[index + 1]["distance_from_origin_miles"] if index + 1 < len(checkpoints) else total_miles
        segment_miles = max(0, next_distance - checkpoint["distance_from_origin_miles"])
        weighted_score += RISK_SCORES[risk] * segment_miles
        if risk == "Severe":
            severe_miles += segment_miles
        elif risk == "High":
            high_miles += segment_miles
        elif risk == "No Travel":
            no_travel_miles += segment_miles
        checkpoint.update({"eta": eta.isoformat().replace("+00:00", "Z"),
                           "forecast_time": weather["forecast_time"].isoformat().replace("+00:00", "Z"),
                           "weather": {key: round(weather[key], 2) for key in ("wind_mph", "rain_in_hr", "snow_in_hr")},
                           "risk_level": risk, "segment_miles": round(segment_miles, 2)})
    return {"route_id": route_index, "distance_miles": round(total_miles, 2),
            "duration_minutes": round(duration_seconds / 60, 1), "checkpoints": checkpoints,
            "risk_summary": {"no_travel_miles": round(no_travel_miles, 2), "severe_miles": round(severe_miles, 2),
                             "high_miles": round(high_miles, 2),
                             "average_risk_score": round(weighted_score / total_miles, 2) if total_miles else 0}}


@api_view(["POST"])
def calculate_route_weather(request):
    data = request.data
    origin_name, destination_name = str(data.get("origin", "")).strip(), str(data.get("destination", "")).strip()
    if not origin_name or not destination_name:
        return Response({"error": "Origin and destination are required."}, status=400)
    try:
        load_weight = float(data.get("load_weight", 0))
        interval_miles = int(data.get("checkpoint_interval_miles", 25))
        if load_weight < 0 or interval_miles not in {10, 25, 50}:
            raise ValueError
        departure_time = _parse_departure_time(data.get("departure_time"))
    except (TypeError, ValueError):
        return Response({"error": "load_weight must be non-negative, checkpoint_interval_miles must be 10, 25, or 50, and departure_time must be ISO-8601."}, status=400)
    try:
        origin, destination = geocode_location(origin_name), geocode_location(destination_name)
        routes = [build_route(route, index + 1, load_weight, interval_miles, departure_time)
                  for index, route in enumerate(fetch_routes(origin, destination))]
    except UpstreamServiceError as exc:
        return Response({"error": str(exc)}, status=502)
    # No-Travel routes cannot be recommended; safe routes follow the requested ordering.
    routes.sort(key=lambda route: (route["risk_summary"]["no_travel_miles"] > 0,
                                   route["risk_summary"]["severe_miles"], route["risk_summary"]["high_miles"],
                                   route["risk_summary"]["average_risk_score"], route["duration_minutes"]))
    for rank, route in enumerate(routes, 1):
        route["rank"], route["recommended"] = rank, rank == 1
    return Response({"status": "success", "origin": origin, "destination": destination,
                     "load_weight_lbs": load_weight, "checkpoint_interval_miles": interval_miles,
                     "departure_time": departure_time.isoformat().replace("+00:00", "Z"),
                     "recommended_route_id": routes[0]["route_id"], "routes": routes})
