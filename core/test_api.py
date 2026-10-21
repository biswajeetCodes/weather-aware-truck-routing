from datetime import datetime, timedelta, timezone
from time import perf_counter, sleep
from unittest.mock import patch

from django.test import TestCase

from .views import (RISK_SCORES, build_forecast_timeline, build_route, calculate_weather_risk, deduplicate_routes,
                    fetch_routes, fetch_weather, routes_are_near_duplicates, sample_checkpoints)
from .views import route_ranking_key


def forecast_entry(start, risk="Low", weather=None):
    return [{"offset_hours": offset,
             "forecast_time": (start + timedelta(hours=offset)).isoformat().replace("+00:00", "Z"),
             "available": True,
             "weather": weather or {"wind_mph": 10, "rain_in_hr": 0, "snow_in_hr": 0},
             "risk_level": risk} for offset in range(49)]


class WeatherRiskRulesTests(TestCase):
    def test_strict_thresholds_and_wind_overrides(self):
        self.assertEqual(calculate_weather_risk(24.9, 0, 0, 1), "Low")
        self.assertEqual(calculate_weather_risk(25, 0, 0, 1), "Moderate")
        self.assertEqual(calculate_weather_risk(35, 0, 0, 1), "High")
        self.assertEqual(calculate_weather_risk(45, 0, 0, 30000), "Severe")
        self.assertEqual(calculate_weather_risk(55, 0, 0, 1), "No Travel")
        self.assertEqual(calculate_weather_risk(45, 0, 0, 30001), "No Travel")
        self.assertEqual(calculate_weather_risk(35, 0, 0, 40001), "Severe")
        self.assertEqual(calculate_weather_risk(0, 1.0, 0, 1), "Severe")
        self.assertEqual(calculate_weather_risk(0, 1.01, 0, 1), "No Travel")
        self.assertEqual(calculate_weather_risk(0, 0, 3.0, 1), "Severe")
        self.assertEqual(calculate_weather_risk(0, 0, 3.01, 1), "No Travel")

    def test_sampling_keeps_origin_interval_and_destination(self):
        points = sample_checkpoints([[0, 0], [1, 0]], 25)
        self.assertEqual(points[0]["distance_from_origin_miles"], 0)
        self.assertEqual(points[-1]["longitude"], 1)
        self.assertGreater(len(points), 2)

    @patch("core.views.fetch_weather")
    def test_checkpoint_weather_requests_are_concurrent_and_ordered(self, weather):
        timeline = build_forecast_timeline(datetime(2026, 1, 1, tzinfo=timezone.utc))

        def delayed_weather(latitude, longitude, eta, forecast_timeline, load_weight):
            sleep(0.12)
            return {"wind_mph": latitude, "rain_in_hr": 0, "snow_in_hr": 0, "forecast_time": eta,
                    "forecast_48h": forecast_entry(timeline[0])}

        weather.side_effect = delayed_weather
        route = {"distance": 160934, "duration": 7200, "geometry": {"coordinates": [[0, 0], [1, 0]]}}
        started = perf_counter()
        result = build_route(route, 1, 1000, 50, datetime(2026, 1, 1, tzinfo=timezone.utc), timeline)

        # This fixture produces three checkpoints. Sequential calls take at
        # least 0.36 seconds; concurrent requests complete in about one delay.
        self.assertLess(perf_counter() - started, 0.30)
        self.assertEqual(weather.call_count, len(result["checkpoints"]))
        self.assertEqual(
            [point["eta"] for point in result["checkpoints"]],
            sorted(point["eta"] for point in result["checkpoints"]),
        )
        self.assertTrue(all(
            [hour["forecast_time"] for hour in point["forecast_48h"]]
            == [hour["forecast_time"] for hour in result["checkpoints"][0]["forecast_48h"]]
            for point in result["checkpoints"]
        ))

    @patch("core.views.fetch_weather")
    def test_risk_miles_and_average_use_actual_segment_lengths(self, weather):
        timeline = build_forecast_timeline(datetime(2026, 1, 1, tzinfo=timezone.utc))

        def weather_for_location(latitude, longitude, eta, forecast_timeline, load_weight):
            wind = 45 if longitude < .1 else 35 if longitude < .7 else 10
            return {"wind_mph": wind, "rain_in_hr": 0, "snow_in_hr": 0, "forecast_time": eta,
                    "forecast_48h": forecast_entry(timeline[0])}

        weather.side_effect = weather_for_location
        route = {"distance": 160934, "duration": 7200,
                 "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 0]]}}
        result = build_route(route, 1, 1000, 25, datetime(2026, 1, 1, tzinfo=timezone.utc), timeline)

        self.assertEqual(result["risk_summary"]["severe_miles"], 25)
        self.assertEqual(result["risk_summary"]["high_miles"], 25)
        assessed = sum(point["segment_miles"] for point in result["checkpoints"])
        weighted = sum(RISK_SCORES[point["risk_level"]] * point["segment_miles"]
                       for point in result["checkpoints"])
        self.assertAlmostEqual(result["risk_summary"]["average_risk_score"], weighted / assessed, places=2)


class RouteDiscoveryTests(TestCase):
    @staticmethod
    def route(coordinates, distance=100000, duration=5000):
        return {"distance": distance, "duration": duration,
                "geometry": {"type": "LineString", "coordinates": coordinates}}

    @patch("core.views._get_json")
    def test_requests_three_alternatives_and_deduplicates_provider_results(self, get_json):
        primary = self.route([[0, 0], [1, 0]])
        duplicate = self.route([[0, 0.001], [1, 0.001]])
        distinct = self.route([[0, 0], [.5, .5], [1, 0]], distance=120000, duration=6000)
        invalid = {"distance": 0, "duration": 0, "geometry": {"type": "LineString", "coordinates": []}}
        get_json.return_value = {"code": "Ok", "routes": [primary, duplicate, distinct, invalid]}

        result = fetch_routes({"longitude": 0, "latitude": 0}, {"longitude": 1, "latitude": 0})

        self.assertEqual(get_json.call_args.kwargs["params"]["alternatives"], 3)
        self.assertEqual(result, [primary, distinct])

    def test_geometry_similarity_keeps_real_alternatives(self):
        primary = self.route([[0, 0], [1, 0]])
        duplicate = self.route([[0, 0.001], [1, 0.001]])
        distinct = self.route([[0, 0], [.5, .5], [1, 0]], distance=120000, duration=6000)

        self.assertTrue(routes_are_near_duplicates(primary, duplicate))
        self.assertFalse(routes_are_near_duplicates(primary, distinct))
        self.assertEqual(len(deduplicate_routes([primary, duplicate, distinct])), 2)


class RouteRankingTests(TestCase):
    @staticmethod
    def route(route_id, severe, high, average, duration, no_travel=0):
        return {"route_id": route_id, "duration_minutes": duration,
                "risk_summary": {"severe_miles": severe, "high_miles": high,
                                 "average_risk_score": average, "no_travel_miles": no_travel}}

    def test_severe_miles_rank_before_duration(self):
        safer_longer = self.route(1, severe=0, high=5, average=2, duration=300)
        shorter_severe = self.route(2, severe=10, high=0, average=1, duration=100)
        self.assertEqual(sorted([shorter_severe, safer_longer], key=route_ranking_key)[0]["route_id"], 1)

    def test_high_miles_rank_after_equal_severe_miles(self):
        fewer_high = self.route(1, severe=0, high=2, average=3, duration=300)
        more_high = self.route(2, severe=0, high=8, average=1, duration=100)
        self.assertEqual(sorted([more_high, fewer_high], key=route_ranking_key)[0]["route_id"], 1)

    def test_average_risk_ranks_after_equal_severe_and_high_miles(self):
        lower_average = self.route(1, severe=0, high=2, average=1.5, duration=300)
        higher_average = self.route(2, severe=0, high=2, average=2.5, duration=100)
        self.assertEqual(sorted([higher_average, lower_average], key=route_ranking_key)[0]["route_id"], 1)

    def test_duration_ranks_after_equal_risk_values(self):
        shorter = self.route(1, severe=0, high=2, average=1.5, duration=100)
        longer = self.route(2, severe=0, high=2, average=1.5, duration=300)
        self.assertEqual(sorted([longer, shorter], key=route_ranking_key)[0]["route_id"], 1)

    def test_no_travel_is_reported_but_not_an_extra_ranking_key(self):
        required_priority_winner = self.route(2, severe=0, high=0, average=1, duration=200, no_travel=10)
        severe_route = self.route(1, severe=1, high=0, average=1, duration=100, no_travel=0)
        self.assertEqual(sorted([severe_route, required_priority_winner], key=route_ranking_key)[0]["route_id"], 2)

    def test_exact_ties_use_original_provider_route_id(self):
        first = self.route(1, severe=0, high=0, average=1, duration=100)
        second = self.route(2, severe=0, high=0, average=1, duration=100)
        self.assertEqual(sorted([second, first], key=route_ranking_key)[0]["route_id"], 1)


class HourlyForecastTests(TestCase):
    def setUp(self):
        self.start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.timeline = build_forecast_timeline(self.start.replace(minute=37))

    def test_shared_timeline_is_normalized_to_49_utc_hours(self):
        self.assertEqual(len(self.timeline), 49)
        self.assertEqual(self.timeline[0], self.start)
        self.assertTrue(all(item.tzinfo == timezone.utc for item in self.timeline))
        self.assertTrue(all(
            later - earlier == timedelta(hours=1)
            for earlier, later in zip(self.timeline, self.timeline[1:])
        ))

    @patch("core.views._get_json")
    def test_extracts_49_exact_shared_utc_hours_and_preserves_eta_weather(self, get_json):
        times = [self.start + timedelta(hours=offset) for offset in range(60)]
        get_json.return_value = {"hourly": {
            "time": [item.strftime("%Y-%m-%dT%H:%M") for item in times],
            "wind_speed_10m": [10] * 60,
            "rain": [0] * 60,
            "snowfall": [0] * 60,
        }}

        result = fetch_weather(40, -73, self.start + timedelta(hours=7, minutes=10), self.timeline, 35000)

        self.assertEqual(len(result["forecast_48h"]), 49)
        self.assertEqual(result["forecast_48h"][0]["forecast_time"], "2026-01-01T00:00:00Z")
        self.assertEqual(result["forecast_48h"][-1]["forecast_time"], "2026-01-03T00:00:00Z")
        self.assertEqual(result["forecast_time"], self.start + timedelta(hours=7))
        self.assertEqual(result["wind_mph"], 10)

    @patch("core.views._get_json")
    def test_missing_hour_is_explicitly_unknown_and_not_zero_filled(self, get_json):
        times = [self.start + timedelta(hours=offset) for offset in range(49) if offset != 12]
        get_json.return_value = {"hourly": {
            "time": [item.strftime("%Y-%m-%dT%H:%M") for item in times],
            "wind_speed_10m": [10] * len(times), "rain": [0] * len(times), "snowfall": [0] * len(times),
        }}

        result = fetch_weather(40, -73, self.start, self.timeline, 35000)
        missing = result["forecast_48h"][12]
        self.assertFalse(missing["available"])
        self.assertIsNone(missing["weather"])
        self.assertEqual(missing["risk_level"], "Unknown")

    @patch("core.views._get_json")
    def test_hourly_risk_uses_actual_load_weight(self, get_json):
        times = [self.start + timedelta(hours=offset) for offset in range(49)]
        get_json.return_value = {"hourly": {
            "time": [item.strftime("%Y-%m-%dT%H:%M") for item in times],
            "wind_speed_10m": [45] * 49, "rain": [0] * 49, "snowfall": [0] * 49,
        }}

        light = fetch_weather(40, -73, self.start, self.timeline, 30000)
        heavy = fetch_weather(40, -73, self.start, self.timeline, 30001)
        self.assertEqual(light["forecast_48h"][0]["risk_level"], "Severe")
        self.assertEqual(heavy["forecast_48h"][0]["risk_level"], "No Travel")


class RouteWeatherApiTests(TestCase):
    def test_health_check_is_available_without_provider_calls(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "spotter-ai-api"})

    @patch("core.views.fetch_weather")
    @patch("core.views.fetch_routes")
    @patch("core.views.geocode_location")
    def test_returns_frontend_ready_ranked_routes(self, geocode, routes, weather):
        departure = datetime.now(timezone.utc) + timedelta(hours=1)
        geocode.side_effect = [
            {"latitude": 0, "longitude": 0, "display_name": "Origin"},
            {"latitude": 0, "longitude": 1, "display_name": "Destination"},
        ]
        routes.return_value = [
            {"distance": 160934, "duration": 7200, "geometry": {"coordinates": [[0, 0], [1, 0]]}},
        ]
        weather.return_value = {"wind_mph": 10, "rain_in_hr": 0, "snow_in_hr": 0,
                                "forecast_time": datetime(2026, 1, 1, tzinfo=timezone.utc),
                                "forecast_48h": forecast_entry(datetime(2026, 1, 1, tzinfo=timezone.utc))}
        response = self.client.post(
            "/api/route-weather/",
            {"origin": "A", "destination": "B", "load_weight": 35000, "checkpoint_interval_miles": 50,
             "departure_time": departure.isoformat()},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["recommended_route_id"], 1)
        self.assertTrue(body["routes"][0]["recommended"])
        self.assertIn("checkpoints", body["routes"][0])
        self.assertIn("geometry", body["routes"][0])
        self.assertIn("forecast_start_time", body)
        self.assertEqual(len(body["routes"][0]["checkpoints"][0]["forecast_48h"]), 49)
        self.assertIn("weather", body["routes"][0]["checkpoints"][0])
        self.assertIn("risk_level", body["routes"][0]["checkpoints"][0])

    def test_rejects_unsupported_checkpoint_interval(self):
        response = self.client.post("/api/route-weather/",
                                    {"origin": "A", "destination": "B", "checkpoint_interval_miles": 20},
                                    content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_non_finite_load_weight(self):
        response = self.client.post(
            "/api/route-weather/",
            {"origin": "A", "destination": "B", "load_weight": "nan"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_rejects_departure_outside_forecast_window(self):
        response = self.client.post(
            "/api/route-weather/",
            {"origin": "A", "destination": "B", "load_weight": 1000,
             "departure_time": (datetime.now(timezone.utc) + timedelta(days=16)).isoformat()},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
