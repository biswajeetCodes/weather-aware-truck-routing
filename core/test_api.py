from datetime import datetime, timezone
from time import perf_counter, sleep
from unittest.mock import patch

from django.test import TestCase

from .views import build_route, calculate_weather_risk, sample_checkpoints


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
        def delayed_weather(latitude, longitude, eta):
            sleep(0.12)
            return {"wind_mph": latitude, "rain_in_hr": 0, "snow_in_hr": 0, "forecast_time": eta}

        weather.side_effect = delayed_weather
        route = {"distance": 160934, "duration": 7200, "geometry": {"coordinates": [[0, 0], [1, 0]]}}
        started = perf_counter()
        result = build_route(route, 1, 1000, 50, datetime(2026, 1, 1, tzinfo=timezone.utc))

        # This fixture produces three checkpoints. Sequential calls take at
        # least 0.36 seconds; concurrent requests complete in about one delay.
        self.assertLess(perf_counter() - started, 0.30)
        self.assertEqual(weather.call_count, len(result["checkpoints"]))
        self.assertEqual(
            [point["eta"] for point in result["checkpoints"]],
            sorted(point["eta"] for point in result["checkpoints"]),
        )


class RouteWeatherApiTests(TestCase):
    @patch("core.views.fetch_weather")
    @patch("core.views.fetch_routes")
    @patch("core.views.geocode_location")
    def test_returns_frontend_ready_ranked_routes(self, geocode, routes, weather):
        geocode.side_effect = [
            {"latitude": 0, "longitude": 0, "display_name": "Origin"},
            {"latitude": 0, "longitude": 1, "display_name": "Destination"},
        ]
        routes.return_value = [
            {"distance": 160934, "duration": 7200, "geometry": {"coordinates": [[0, 0], [1, 0]]}},
        ]
        weather.return_value = {"wind_mph": 10, "rain_in_hr": 0, "snow_in_hr": 0,
                                "forecast_time": datetime(2026, 1, 1, tzinfo=timezone.utc)}
        response = self.client.post(
            "/api/route-weather/",
            {"origin": "A", "destination": "B", "load_weight": 35000, "checkpoint_interval_miles": 50,
             "departure_time": "2026-01-01T00:00:00Z"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["recommended_route_id"], 1)
        self.assertTrue(body["routes"][0]["recommended"])
        self.assertIn("checkpoints", body["routes"][0])

    def test_rejects_unsupported_checkpoint_interval(self):
        response = self.client.post("/api/route-weather/",
                                    {"origin": "A", "destination": "B", "checkpoint_interval_miles": 20},
                                    content_type="application/json")
        self.assertEqual(response.status_code, 400)
