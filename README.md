# Spotter AI — Weather-Aware Truck Routing

Spotter AI is a full-stack dispatch dashboard that compares genuine road-route alternatives against forecast weather at the time a truck is expected to reach each checkpoint. It combines route geometry, load-aware weather rules, checkpoint ETAs, and a separate 0–48-hour corridor forecast to help a dispatcher make a more informed routing decision.

> This is an independent hiring-assessment and portfolio project. It is not an official Spotter product, endorsement, or production safety system. Forecasts and public routing services can be incomplete or unavailable; dispatchers remain responsible for operational decisions.

## Features

- Origin, destination, local departure date/time, truck load, and 10/25/50-mile checkpoint controls
- OpenStreetMap Nominatim geocoding and OSRM road-route alternatives
- Full OSRM GeoJSON road geometry with near-duplicate route filtering
- Concurrent Open-Meteo requests for checkpoint arrival times
- Exact wind, rain, snow, and load-aware risk classification
- Distance-weighted Severe, High, No Travel, and average-risk exposure
- Deterministic safest-route recommendation and selectable alternatives
- Leaflet corridor visualization, checkpoint popups, and Unknown-data handling
- Independent 0–48-hour forecast slider and selected-hour weather snapshot
- Compact responsive dashboard, light/dark mode, accessible tooltips, and persistent theme
- Retry/backoff, upstream timeouts, input validation, API throttling, and health check

## Architecture and stack

```text
React/Vite dashboard
        │ POST /api/route-weather/
        ▼
Django REST API
  ├─ Nominatim: location text → coordinates
  ├─ OSRM: real road alternatives and GeoJSON geometry
  └─ Open-Meteo: hourly weather per checkpoint
        │
        ▼
Risk engine → route ranking → frontend-ready JSON
```

| Layer | Technology |
| --- | --- |
| Backend | Python 3.11, Django, Django REST Framework, Requests |
| Production server | Gunicorn (Linux/Unix deployment) |
| Frontend | React 18, Vite 6, Tailwind CSS 4, Lucide React |
| Mapping | Leaflet and React-Leaflet |
| Providers | Nominatim, OSRM, Open-Meteo, OpenStreetMap tiles |
| Local database | SQLite (Django administration/runtime only) |

## Project structure

```text
weather-truck-app/
├── core/                         # API view, risk engine, routes, and tests
│   ├── views.py
│   ├── urls.py
│   └── test_api.py
├── weather_core/                 # Django project settings and WSGI/ASGI entry points
├── dashboard/frontend/           # React/Vite dashboard
│   ├── public/assets/
│   ├── src/components/dashboard/
│   ├── src/services/api.js
│   ├── src/App.jsx
│   └── package.json
├── .env.example                  # Backend environment reference
├── requirements.txt
├── Procfile                      # Generic Gunicorn start command
└── manage.py
```

## Prerequisites

- Python 3.11
- Node.js 18+ and npm
- Git
- Internet access to the configured geocoding, routing, weather, and tile services

## Backend setup

Clone the repository and enter it:

```bash
git clone https://github.com/biswajeetCodes/weather-aware-truck-routing.git
cd weather-aware-truck-routing
```

Create and activate a virtual environment.

Windows PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Windows Command Prompt:

```bat
py -3.11 -m venv .venv
.venv\Scripts\activate.bat
```

macOS/Linux:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

Install, initialize, test, and run Django:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py test
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000/`. Check liveness at `GET /api/health/`.

Gunicorn is intended for Linux/Unix production hosts, not the Windows development server:

```bash
gunicorn weather_core.wsgi:application --bind 0.0.0.0:${PORT:-8000}
```

## Frontend setup

In a second terminal:

```bash
cd dashboard/frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`. Create `dashboard/frontend/.env` only when the backend URL differs from the default:

```dotenv
VITE_ROUTE_WEATHER_API=http://127.0.0.1:8000/api/route-weather/
```

Vite reads this file when it starts. Restart the development server after changing it.

## Environment variables

Django reads process environment variables directly; it does not automatically load a root `.env` file. The committed `.env.example` is a safe reference for a shell, service manager, or hosting dashboard.

| Variable | Development/default | Production guidance |
| --- | --- | --- |
| `DJANGO_DEBUG` | `true` | Set to `false` |
| `DJANGO_SECRET_KEY` | Unsafe local fallback if omitted | Required; generate a new high-entropy value |
| `DJANGO_ALLOWED_HOSTS` | `127.0.0.1,localhost` | Comma-separated backend hostnames |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Local Vite origins | Exact HTTPS frontend origins |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Empty | Exact trusted HTTPS origins if needed |
| `DJANGO_API_ANON_RATE` | `30/min` | Adjust to provider quotas and capacity |
| `DJANGO_SECURE_HSTS_SECONDS` | `3600` in production | Increase only after HTTPS validation |
| `DJANGO_SECURE_HSTS_PRELOAD` | `false` | Enable only when the domain is preload-ready |
| `VITE_ROUTE_WEATHER_API` | Local Django endpoint | Public HTTPS API endpoint, including path |

Never commit `.env`, production keys, databases, or session data.

## API

### `POST /api/route-weather/`

Request:

```json
{
  "origin": "New York, NY",
  "destination": "Boston, MA",
  "departure_time": "<ISO-8601 timestamp within the next 15 days>",
  "load_weight": 35000,
  "checkpoint_interval_miles": 25
}
```

The browser converts the selected local `datetime-local` value to an offset-aware UTC ISO-8601 timestamp. The response contains geocoded endpoints, the shared forecast timeline, ranked routes, GeoJSON geometry, duration/distance, checkpoint ETAs, ETA weather, risk summaries, and 49 hourly forecast entries (`+0h` through `+48h`) per checkpoint.

Supported checkpoint intervals are exactly `10`, `25`, or `50` miles. Unsupported intervals, invalid locations, non-finite/negative weights, and departure times outside the available forecast window are rejected.

## Risk engine

The route uses the highest applicable risk across wind, rain, and snow.

| Risk | Wind | Rain | Snow |
| --- | ---: | ---: | ---: |
| Low | `<25 mph` | `<0.10 in/hr` | `<0.5 in/hr` |
| Moderate | `25–<35 mph` | `0.10–<0.25 in/hr` | `0.5–<1.0 in/hr` |
| High | `35–<45 mph` | `0.25–<0.50 in/hr` | `1.0–<2.0 in/hr` |
| Severe | `45–<55 mph` | `0.50–1.00 in/hr` | `2.0–3.0 in/hr` |
| No Travel | `>=55 mph` | `>1.00 in/hr` | `>3.0 in/hr` |

Load overrides:

- Wind `>=55 mph`: No Travel at every load.
- Wind `45–54 mph` with load `>30,000 lb`: No Travel.
- Wind `35–44 mph` with load `>40,000 lb`: Severe.

Routes are ordered lexicographically by:

1. Fewest Severe miles
2. Fewest High miles
3. Lowest distance-weighted average risk score
4. Shortest duration

The original provider route ID is used only to make an exact tie deterministic. No Travel exposure remains visible and contributes its risk score to the average, but it is not inserted ahead of the client-specified ranking fields.

## Dispatch recommendation versus forecast visualization

The dispatch recommendation uses weather at each checkpoint's estimated arrival time. Route KPIs, risk miles, and ranking remain tied to the submitted departure time.

The forecast slider is an independent visualization. Moving it from `+0h` to `+48h` reads the already-returned `forecast_48h` data, recolors the selected route corridor, and updates the Forecast Snapshot. It does not send another request, change the departure time, recompute ETAs, alter KPIs, or rerank routes. Missing hourly data is shown as Unknown rather than Low.

## Tests and builds

From the repository root:

```bash
python manage.py test
python manage.py check
```

From `dashboard/frontend`:

```bash
npm ci
npm run build
npm run preview
```

No frontend unit-test or lint script is currently configured; the production build is the frontend compilation check.

## Deployment configuration

The frontend and backend can be deployed separately without changing the API contract:

1. Build `dashboard/frontend` with the production `VITE_ROUTE_WEATHER_API` value.
2. Serve the generated `dist/` directory from a static host.
3. Run Django with Gunicorn using the `Procfile` command or an equivalent process definition.
4. Set `DJANGO_DEBUG=false`, a new secret key, exact allowed hosts, exact CORS origins, and HTTPS-aware settings.
5. Run `python manage.py migrate` during deployment.
6. Configure the platform health probe to `GET /api/health/`.

SQLite is sufficient for local development. Choose a managed database only if the deployed application will use persistent Django accounts, sessions, or administrative data. A shared cache is not required for the assessment, but multi-worker production throttling needs a shared cache if strict global limits are required.

Before production, run:

```bash
DJANGO_DEBUG=false DJANGO_SECRET_KEY='<secure value>' DJANGO_ALLOWED_HOSTS='api.example.com' python manage.py check --deploy
```

Use the hosting platform's secret manager; do not place production values in source files.

## Provider attribution and limitations

- **OpenStreetMap:** map data and raster tiles © OpenStreetMap contributors. Keep Leaflet attribution visible, honor tile caching headers, and do not bulk-download tiles. Review the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- **Nominatim:** the public service requires an identifying User-Agent, attribution, caching, and an absolute maximum of one request per second. It is not suitable for sustained commercial traffic without a compliant provider or self-hosting. Review the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).
- **OSRM:** `router.project-osrm.org` is a public demonstration service with no application SLA. Review the [OSRM demo-server policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server) and use a managed or self-hosted instance for production.
- **Open-Meteo:** attribution is required. The free endpoint is intended for non-commercial use, is rate-limited, and has no uptime guarantee. Commercial deployments require an appropriate plan or alternative provider. Review the [terms](https://open-meteo.com/en/terms) and [pricing](https://open-meteo.com/en/pricing).

OSRM may return one, two, or three genuinely distinct alternatives depending on the road network and provider response. The application removes invalid and near-identical geometries and never invents or duplicates a route to reach three options.

## Troubleshooting

### `502 Bad Gateway` or “Unable to retrieve live mapping or weather data”

Confirm the backend can reach Nominatim, OSRM, and Open-Meteo over HTTPS. Public providers may throttle or temporarily reject requests. Check the Django console for the named upstream service and retry responsibly.

### Browser reports a CORS error

Set `DJANGO_CORS_ALLOWED_ORIGINS` to the exact frontend origin, including scheme and port, then restart Django. Do not use a wildcard in production.

### Frontend calls the wrong backend

Set `VITE_ROUTE_WEATHER_API`, restart Vite, and rebuild. Vite variables are embedded at build time.

### Departure time is rejected

Choose a future local time within 15 days. The browser submits UTC; the backend validates the same forecast window.

### PowerShell blocks virtual-environment activation

Use Command Prompt activation, or allow the activation script for the current process according to your organization's PowerShell policy. Do not weaken machine-wide policy solely for this project.

### Map tiles or routes are missing

Check browser network access and provider availability. Do not remove attribution or bypass provider usage limits. Production deployments should use services with suitable capacity and support.
