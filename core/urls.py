from django.urls import path

from .views import calculate_route_weather, health_check

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("route-weather/", calculate_route_weather, name="route-weather"),
]
