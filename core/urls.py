from django.urls import path

from .views import calculate_route_weather

urlpatterns = [
    path("route-weather/", calculate_route_weather, name="route-weather"),
]
