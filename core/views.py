"""Route weather API and the tested weather/load risk rules."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from math import asin, cos, isfinite, radians, sin, sqrt
from threading import local

import requests
from django.http import JsonResponse
from requests.adapters import HTTPAdapter
from rest_framework.decorators import api_view
from rest_framework.response import Response
from urllib3.util.retry import Retry

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
HTTP_TIMEOUT_SECONDS = 12
# Open-Meteo calls are I/O-bound. A bounded pool avoids serial checkpoint
# requests while protecting both our worker and the upstream public service.
MAX_WEATHER_WORKERS = 12
MAX_ROUTE_OPTIONS = 3
ROUTE_SIMILARITY_SAMPLE_MILES = 5
ROUTE_SIMILARITY_TOLERANCE_MILES = 0.25
ROUTE_SIMILARITY_THRESHOLD = 0.98
RISK_SCORES = {"Low": 1, "Moderate": 2, "High": 3, "Severe": 4, "No Travel": 5}
RETRYABLE_STATUS_CODES = (429, 500, 502, 503, 504)
MAX_FORECAST_DAYS = 15
MAX_LOCATION_LENGTH = 250


def _create_http_session():
    """Use retry/backoff for temporary public-provider failures."""
    retry = Retry(
        total=2,
        connect=2,
        read=2,
        backoff_factor=0.4,
        status_forcelist=RETRYABLE_STATUS_CODES,
        allowed_methods=frozenset({"GET"}),
        raise_on_status=False,
    )
    session = requests.Session()
    adapter = HTTPAdapter(max_retries=retry, pool_connections=MAX_WEATHER_WORKERS, pool_maxsize=MAX_WEATHER_WORKERS)
    session.mount("https://", adapter)
    return session


_thread_local = local()


class UpstreamServiceError(Exception):
    """A mapping, routing, or weather provider could not serve usable data."""


def health_check(_request):
    """Dependency-free liveness endpoint for deployment health probes."""
    return JsonResponse({"status": "ok", "service": "spotter-ai-api"})


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


def route_ranking_key(route):
    """Required safety ordering, with provider order used only for an exact tie."""
    summary = route["risk_summary"]
    return (summary["severe_miles"], summary["high_miles"], summary["average_risk_score"],
            route["duration_minutes"], route["route_id"])


def _get_json(service_name, url, *, params, headers=None):
    try:
        # requests.Session is not documented as thread-safe. Each weather
        # worker gets its own retry-enabled session while route work stays parallel.
        if not hasattr(_thread_local, "http_session"):
            _thread_local.http_session = _create_http_session()
        response = _thread_local.http_session.get(url, params=params, headers=headers, timeout=HTTP_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise UpstreamServiceError(
            f"{service_name} is unavailable. Check this server's internet/DNS access and try again."
        ) from exc


def geocode_location(location):
    results = _get_json("Nominatim geocoding", NOMINATIM_URL, params={"q": location, "format": "jsonv2", "limit": 1},
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
    payload = _get_json("OSRM routing", f"{OSRM_URL}/{coordinates}",
                        params={"alternatives": MAX_ROUTE_OPTIONS, "overview": "full",
                                "geometries": "geojson", "steps": "false"})
    if payload.get("code") != "Ok" or not payload.get("routes"):
        raise UpstreamServiceError("No drivable route was found between these locations.")
    routes = deduplicate_routes(payload["routes"])
    if not routes:
        raise UpstreamServiceError("Routing returned no valid route geometry.")
    return routes[:MAX_ROUTE_OPTIONS]


def _distance_miles(first, second):
    """Great-circle distance between GeoJSON [longitude, latitude] points."""
    lon1, lat1 = map(radians, first)
    lon2, lat2 = map(radians, second)
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 3958.7613 * 2 * asin(sqrt(a))


def _valid_route(route):
    """Validate the OSRM fields needed by checkpoints, ETAs, and the map."""
    try:
        distance, duration = float(route["distance"]), float(route["duration"])
        geometry = route["geometry"]
        coordinates = geometry["coordinates"]
        if distance <= 0 or duration <= 0 or geometry.get("type") != "LineString" or len(coordinates) < 2:
            return False
        return all(
            len(point) >= 2 and all(isinstance(value, (int, float)) for value in point[:2])
            and -180 <= point[0] <= 180 and -90 <= point[1] <= 90
            for point in coordinates
        )
    except (KeyError, TypeError, ValueError):
        return False


def _sample_route_geometry(route):
    checkpoints = sample_checkpoints(route["geometry"]["coordinates"], ROUTE_SIMILARITY_SAMPLE_MILES)
    return [[point["longitude"], point["latitude"]] for point in checkpoints]


def _nearby_fraction(source, target):
    return sum(
        any(_distance_miles(point, candidate) <= ROUTE_SIMILARITY_TOLERANCE_MILES for candidate in target)
        for point in source
    ) / len(source)


def routes_are_near_duplicates(first, second):
    """Detect effectively identical routes without rejecting real shared-corridor alternatives."""
    distance_ratio = max(float(first["distance"]), float(second["distance"])) / min(float(first["distance"]), float(second["distance"]))
    duration_ratio = max(float(first["duration"]), float(second["duration"])) / min(float(first["duration"]), float(second["duration"]))
    if distance_ratio > 1.02 or duration_ratio > 1.05:
        return False
    first_points, second_points = _sample_route_geometry(first), _sample_route_geometry(second)
    return min(_nearby_fraction(first_points, second_points), _nearby_fraction(second_points, first_points)) >= ROUTE_SIMILARITY_THRESHOLD


def deduplicate_routes(routes):
    """Keep OSRM recommendation order while removing invalid and near-identical geometry."""
    unique = []
    for route in routes:
        if not _valid_route(route) or any(routes_are_near_duplicates(route, kept) for kept in unique):
            continue
        unique.append(route)
    return unique


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


def _utc_hour(value):
    """Normalize an aware datetime to the start of its UTC hour."""
    return value.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def _iso_utc(value):
    return value.isoformat().replace("+00:00", "Z")


def build_forecast_timeline(start_time=None):
    """Return the shared +0h through +48h UTC timeline for one API request."""
    start = _utc_hour(start_time or datetime.now(timezone.utc))
    return tuple(start + timedelta(hours=offset) for offset in range(49))


def fetch_weather(latitude, longitude, eta, forecast_timeline, load_weight):
    """Return ETA weather and exact timestamp-aligned 0-48 hour forecasts."""
    payload = _get_json("Open-Meteo weather", OPEN_METEO_URL, params={
        "latitude": latitude, "longitude": longitude, "hourly": "wind_speed_10m,rain,snowfall",
        "wind_speed_unit": "mph", "precipitation_unit": "inch", "timezone": "UTC", "forecast_days": 16,
    })
    hourly = payload.get("hourly", {})
    try:
        raw_times = hourly["time"]
        wind_values, rain_values, snow_values = hourly["wind_speed_10m"], hourly["rain"], hourly["snowfall"]
        observations = {}
        for index, raw_time in enumerate(raw_times):
            try:
                observed_at = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
                observed_at = observed_at.replace(tzinfo=timezone.utc) if observed_at.tzinfo is None else observed_at.astimezone(timezone.utc)
                # A partial or null observation is unavailable, never zero-filled.
                weather = {
                    "wind_mph": float(wind_values[index]),
                    "rain_in_hr": float(rain_values[index]),
                    # precipitation_unit=inch applies to Open-Meteo hourly snowfall too.
                    "snow_in_hr": float(snow_values[index]),
                }
            except (TypeError, ValueError, IndexError):
                continue
            observations[observed_at] = weather

        if not observations:
            raise ValueError
        eta_time = min(observations, key=lambda item: abs((item - eta).total_seconds()))
        if abs((eta_time - eta).total_seconds()) > 3600:
            raise ValueError
        eta_weather = observations[eta_time]
        forecast_48h = []
        for offset, target_time in enumerate(forecast_timeline):
            weather = observations.get(target_time)
            if weather is None:
                forecast_48h.append({"offset_hours": offset, "forecast_time": _iso_utc(target_time),
                                     "available": False, "weather": None, "risk_level": "Unknown"})
                continue
            forecast_48h.append({
                "offset_hours": offset,
                "forecast_time": _iso_utc(target_time),
                "available": True,
                "weather": {key: round(value, 2) for key, value in weather.items()},
                "risk_level": calculate_weather_risk(weather["wind_mph"], weather["rain_in_hr"],
                                                     weather["snow_in_hr"], load_weight),
            })
        return {**eta_weather, "forecast_time": eta_time, "forecast_48h": forecast_48h}
    except (KeyError, TypeError, ValueError, IndexError) as exc:
        raise UpstreamServiceError("Weather service returned an incomplete forecast.") from exc


def build_route(route, route_index, load_weight, interval_miles, departure_time, forecast_timeline=None):
    forecast_timeline = forecast_timeline or build_forecast_timeline()
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
            ((checkpoint["latitude"], checkpoint["longitude"], eta, forecast_timeline, load_weight)
             for checkpoint, eta in zip(checkpoints, checkpoint_etas)),
        ))

    weighted_score = assessed_miles = severe_miles = high_miles = no_travel_miles = 0.0
    for index, (checkpoint, eta, weather) in enumerate(zip(checkpoints, checkpoint_etas, weather_by_checkpoint)):
        risk = calculate_weather_risk(weather["wind_mph"], weather["rain_in_hr"], weather["snow_in_hr"], load_weight)
        next_distance = checkpoints[index + 1]["distance_from_origin_miles"] if index + 1 < len(checkpoints) else total_miles
        segment_miles = max(0, next_distance - checkpoint["distance_from_origin_miles"])
        weighted_score += RISK_SCORES[risk] * segment_miles
        assessed_miles += segment_miles
        if risk == "Severe":
            severe_miles += segment_miles
        elif risk == "High":
            high_miles += segment_miles
        elif risk == "No Travel":
            no_travel_miles += segment_miles
        checkpoint.update({"eta": eta.isoformat().replace("+00:00", "Z"),
                           "forecast_time": weather["forecast_time"].isoformat().replace("+00:00", "Z"),
                           "weather": {key: round(weather[key], 2) for key in ("wind_mph", "rain_in_hr", "snow_in_hr")},
                           "risk_level": risk, "segment_miles": round(segment_miles, 2),
                           "forecast_48h": weather["forecast_48h"]})
    return {"route_id": route_index, "distance_miles": round(total_miles, 2),
            "duration_minutes": round(duration_seconds / 60, 1), "checkpoints": checkpoints,
            "geometry": route["geometry"],
            "risk_summary": {"no_travel_miles": round(no_travel_miles, 2), "severe_miles": round(severe_miles, 2),
                             "high_miles": round(high_miles, 2),
                             # Distance-weighted mean of the 1-5 risk score across assessed route segments.
                             "average_risk_score": round(weighted_score / assessed_miles, 2) if assessed_miles else 0}}


@api_view(["POST"])
def calculate_route_weather(request):
    data = request.data
    origin_name, destination_name = str(data.get("origin", "")).strip(), str(data.get("destination", "")).strip()
    if not origin_name or not destination_name:
        return Response({"error": "Origin and destination are required."}, status=400)
    if len(origin_name) > MAX_LOCATION_LENGTH or len(destination_name) > MAX_LOCATION_LENGTH:
        return Response({"error": f"Origin and destination must be {MAX_LOCATION_LENGTH} characters or fewer."}, status=400)
    try:
        load_weight = float(data.get("load_weight", 0))
        interval_miles = int(data.get("checkpoint_interval_miles", 25))
        if not isfinite(load_weight) or load_weight < 0 or interval_miles not in {10, 25, 50}:
            raise ValueError
        departure_time = _parse_departure_time(data.get("departure_time"))
        now = datetime.now(timezone.utc)
        if departure_time < now - timedelta(minutes=1) or departure_time > now + timedelta(days=MAX_FORECAST_DAYS):
            raise ValueError
    except (TypeError, ValueError):
        return Response({"error": "load_weight must be a finite non-negative number, checkpoint_interval_miles must be 10, 25, or 50, and departure_time must be a valid time within the next 15 days."}, status=400)
    try:
        origin, destination = geocode_location(origin_name), geocode_location(destination_name)
        forecast_timeline = build_forecast_timeline()
        routes = [build_route(route, index + 1, load_weight, interval_miles, departure_time, forecast_timeline)
                  for index, route in enumerate(fetch_routes(origin, destination))]
    except UpstreamServiceError as exc:
        return Response({"error": str(exc)}, status=502)
    routes.sort(key=route_ranking_key)
    for rank, route in enumerate(routes, 1):
        route["rank"], route["recommended"] = rank, rank == 1
    return Response({"status": "success", "origin": origin, "destination": destination,
                     "load_weight_lbs": load_weight, "checkpoint_interval_miles": interval_miles,
                     "departure_time": departure_time.isoformat().replace("+00:00", "Z"),
                     "forecast_start_time": _iso_utc(forecast_timeline[0]),
                     "forecast_hours": 48,
                     "recommended_route_id": routes[0]["route_id"], "routes": routes})
