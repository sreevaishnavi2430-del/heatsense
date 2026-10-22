# HeatSense

HeatSense is a Hyderabad-focused heat-risk mapping and action-planning prototype for city teams. It brings ward-level risk indicators, weather, intervention planning, public safety guidance, alerts, reports, and sensor workflows into one React application backed by a FastAPI service.

> **Data status:** This is a planning and demonstration prototype, not an operational city heat-warning system. Current weather comes from the Open-Meteo forecast model. Most ward-level environmental and vulnerability layers are bundled sample data or proxies; they are not verified live measurements.

## What it does

- **Ward heat-risk map and rankings:** Explore 40 Hyderabad ward fixtures, filter and compare wards, and inspect the inputs behind the weighted risk score. Stored land-surface temperature, tree cover, built-up density, population, polygons, and vulnerability inputs are sample or proxy values.
- **Current weather and forecast:** Requests current conditions for Hyderabad and modelled conditions for ward centroids from the Open-Meteo Forecast API. The dashboard and reports show current air temperature when the provider responds. The ward endpoint uses centroid conditions; these are gridded weather-model values, not ward weather-station observations. Results are cached briefly by the backend. If the provider is unavailable, the API reports unavailable data rather than substituting a synthetic weather reading.
- **Action planning and cooling scenarios:** Build budget-constrained intervention plans and explore illustrative cooling scenarios. Outputs are planning estimates, not measured impacts.
- **Alerts and public heat guidance:** Manage saved alerts, multilingual templates and rules, subscriptions, and public “check my area” guidance. The demo provider does not send real SMS or WhatsApp messages.
- **Reports and exports:** Build city, ward, planner, and alert reports and export ward/alert data as CSV.
- **Sensor workflows:** Register demo ESP32 devices and submit readings. Sensor-validation metrics and model-training features are prototypes; they should not be treated as validated sensor calibration without real observations.
- **Maps:** Ward maps use Google Maps when a valid browser key is configured. If the key is absent, rejected, or Google Maps fails to load, the ward map switches to Leaflet with OpenStreetMap tiles. The OSM fallback needs an internet connection but no API key and includes required attribution.

## Technology

- Frontend: React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, Leaflet/Google Maps.
- Backend: Python 3.11+, FastAPI, SQLAlchemy async, Pydantic, HTTPX.
- Storage: SQLite with WAL and foreign-key enforcement by default; PostgreSQL/asyncpg is configurable. Alembic migration files are in `backend/alembic/`.
- External weather source: Open-Meteo Forecast API, requested for Hyderabad (Asia/Kolkata) and ward-centroid coordinates.

## Requirements

- Node.js 20 or later and npm.
- Python 3.11 or later.
- Internet access for Open-Meteo weather requests and map tiles.
- A Google Maps JavaScript API key is optional. Without one, ward maps use the OpenStreetMap fallback. Internet access is needed for either live basemap.

## Local setup

### 1. Configure the frontend

Copy the committed example file to create your local Vite configuration:

```powershell
Copy-Item .env.development.example .env.development
```

The example leaves mock mode enabled so the dashboard, ward rankings, cooling simulator and power-grid monitor all work immediately, and leaves the Google key blank so the map works with the OpenStreetMap fallback after `npm run dev`. To use Google Maps instead, add your key to `.env.development`:

```dotenv
VITE_GOOGLE_MAPS_API_KEY=your_restricted_google_maps_key
```

In Google Cloud Console, enable **Maps JavaScript API**, configure billing as required by Google, and restrict the browser key to your development/referrer domains. Keep your real key in the ignored `.env.development` file; never commit it. Restart Vite after changing a `VITE_` variable because Vite reads these values at startup.

The public OpenStreetMap tile service is suitable for development and modest interactive use. For production traffic, select a tile provider and comply with its usage policy rather than assuming the community tile servers provide an unlimited production service.

### 2. Configure and run the backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The default database URL is `sqlite+aiosqlite:///./heatsense.db`. The API initializes its schema during startup. For local development, demo login accepts the configured demo credentials/mode; do not use demo authentication settings in a public deployment.

### 3. Install and run the frontend

In a second PowerShell terminal at the project root:

```powershell
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs), and readiness at [http://localhost:8000/health/ready](http://localhost:8000/health/ready).

### 4. Running without a backend

The frontend ships with the full 40-ward dataset bundled, so it runs standalone. Mock mode is **on by default**; set `VITE_USE_MOCK=false` in `.env.development` to point the app at a live backend instead:

```dotenv
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

With mock mode enabled, ward rankings, the cooling simulator, the power-grid monitor and the dashboard all work without the FastAPI server running. Live weather for the city forecast still requires the backend, because it is fetched server-side from Open-Meteo.

## Database and seed data

The backend uses async SQLAlchemy models for wards, alerts, subscribers, plans, devices, sensor readings, alert templates/rules, city settings, and ingestion runs. Startup initializes tables. Alembic configuration and migrations are under `backend/alembic/`.

Seed the bundled demo ward, alert, template, and rule records from `backend/`:

```powershell
python -m app.seed.seed_demo
```

To reset the seeded demo records, use `python -m app.seed.seed_demo --reset`. Protect and back up the SQLite database file if you need to retain local changes; it is intentionally excluded from source control.

To use PostgreSQL, install and configure PostgreSQL and set `DATABASE_URL` in `backend/.env`, for example:

```dotenv
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/heatsense
```

`backend/docker-compose.yml` provides a PostGIS-oriented development service configuration. Review and configure credentials and deployment networking before using it outside a local environment.

## Important API routes

All routes are under `/api/v1` unless stated otherwise. Interactive OpenAPI docs at `/docs` are the authoritative route and schema reference.

| Area | Example routes |
| --- | --- |
| Health and metadata | `GET /health/ready`, `GET /api/v1/meta` |
| Wards and map data | `GET /api/v1/wards`, `GET /api/v1/wards/{ward_id}`, `GET /api/v1/wards/geojson`, `GET /api/v1/wards/export.csv` |
| City summary | `GET /api/v1/city/overview` |
| Live weather | `GET /api/v1/forecast/live`, `GET /api/v1/forecast/wards/{ward_id}/live` |
| Planning and simulation | `POST /api/v1/planner/generate`, `POST /api/v1/simulator/run`, `POST /api/v1/plans` |
| Alerts | `GET/POST /api/v1/alerts`, `GET /api/v1/alerts/templates`, `GET /api/v1/alerts/rules` |
| Public safety | `GET /api/v1/public/check-area`, `POST /api/v1/public/subscribe` |
| Sensors | `POST /api/v1/sensors/readings`, `POST /api/v1/sensors/devices`, `GET /api/v1/sensors/validation` |
| Data operations | `GET /api/v1/pipelines/status`, `POST /api/v1/pipelines/run/{pipeline_name}`, `POST /api/v1/grid/upload` |
| Reports and settings | `GET /api/v1/reports/city-summary`, `GET/PUT /api/v1/settings` |

Some officer routes require a bearer token. Check the OpenAPI documentation for exact request bodies and access requirements.

## Data quality and limitations

| Data | Current source/status | What it can support |
| --- | --- | --- |
| Current air temperature, humidity, wind and forecast | Open-Meteo gridded forecast model | General current conditions and forecast context; not a local station measurement |
| Ward boundary geometry and centroids | Bundled project fixtures | Demonstration maps and ward lookup; verify against official GHMC boundaries before operational use |
| Surface temperature, tree cover and built-up indicators | Bundled sample values/fixtures | UI and planning workflow demonstration only; not current satellite retrievals |
| Population and vulnerability | Bundled values and proxy indicators | Illustrative prioritization only; not a verified census or household assessment |
| Grid stress and cooling demand | Modelled/demo values unless measured utility data is uploaded | Scenario exploration only; not a live utility feed |
| Device readings | Real only after a deployed device sends authenticated observations; validation page also contains sample values | Calibration only with documented sensors, siting, timestamps and quality control |
| SMS/WhatsApp delivery | Mock provider/demo workflow | No message reaches residents until a production provider and required registrations are configured |

Heat-risk rankings combine the project's available indicators and configured weights. A score is a prioritization aid, not a health forecast. Satellite land-surface temperature (LST) is distinct from near-surface air temperature; the current weather feed does not make the sample LST layer live.

To move toward an operational system, connect and document authoritative Hyderabad ward boundaries, recent cloud-masked Landsat 8/9 surface-temperature scenes, Sentinel-2 vegetation/built-up processing, verified population/vulnerability sources, IMD or local station observations, quality-controlled sensor stations, and utility-provided demand data. Record each source's date, spatial resolution, processing, license, uncertainty, and refresh schedule. Revalidate scores and model calibration before using them for public warnings or resource allocation.

## Privacy and safety

Subscriber phone numbers are encrypted at rest with Fernet and are indexed by a
keyed HMAC (`app/privacy.py`) rather than a plain digest. A plain SHA-256 of an
Indian mobile number is reversible in seconds because only ~40 million values are
valid, so the keyed form is what makes the lookup key safe to store.

The service refuses to start with `MODE=production` while `SECRET_KEY` or
`FERNET_KEY` is still a placeholder, and logs a warning in `MODE=demo` where
authentication is bypassed on the protected endpoints. Generate real values before
deploying:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"          # SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FERNET_KEY
```

Provide consent, opt-out, retention, deletion, and audit procedures appropriate to your jurisdiction. Do not enable real SMS/WhatsApp delivery until the provider integration, consent handling, sender registration, templates, delivery callbacks, rate controls, and incident procedures have been reviewed.

This application is not a substitute for official heat-health advisories or emergency services. Keep public safety advice consistent with current local government guidance.

## Development checks

```powershell
# Frontend type check and production bundle
npx tsc --noEmit
npm run build

# Runtime checks (no browser or backend required)
npm run verify            # runs both suites below
npm run verify:i18n       # language switching, persistence and rehydration
npm run verify:mock-api   # every API function resolves in mock mode

# Backend tests
cd backend
python -m pytest -q
```

The two runtime suites load the real `src/` modules through Vite's SSR pipeline and
assert the behaviour that previously only worked on the maintainer's machine: the
interface language survives a reload and stays in sync with the store, and no page
depends on a live endpoint without a mock fallback. The mock-API suite fails on any
network call, so an endpoint that loses its mock implementation is caught immediately.

## Project structure

```text
backend/
  app/
    alerts/       # alert provider interfaces and demo provider
    db/           # SQLAlchemy models, sessions and repository
    ml/           # air-temperature model prototype
    pipelines/    # weather, satellite, vulnerability and grid ingestion logic
    seed/         # bundled demo fixtures and seeding command
  alembic/        # database migration configuration and revisions
  tests/          # API, persistence and pipeline tests
src/
  components/     # shared UI, map and layout components
  data/           # frontend demo fixtures (ward data + operational fixtures)
  pages/          # dashboard, rankings, reports, planner and public flows
  services/       # frontend API client with mock fallbacks
  lib/             # risk scoring, interventions and formatting helpers
scripts/          # runtime verification suites (i18n, mock API coverage)
docs/              # methodology and API contract notes
```


## License

No license is specified in this repository. Contact the project owner before reusing or redistributing the code.
