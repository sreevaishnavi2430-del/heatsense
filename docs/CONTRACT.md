# Frontend and API contract

The backend base path is `/api/v1`. JSON uses the same camelCase field names as the frontend TypeScript interfaces in `src/types/index.ts`. The legacy React mock service functions remain available when `VITE_USE_MOCK=true`; development defaults to the local backend.

| Frontend service | Backend endpoint | Status |
|---|---|---|
| `loginOfficer` | `POST /auth/login` | Demo JWT |
| `getCityOverview` | `GET /city/overview` | Sample aggregates |
| `getWards` | `GET /wards` | 40 sample ward objects; bare array for current UI |
| `getWardGeoJSON` | `GET /wards/geojson` | Approximate sample polygons |
| `getWardById` | `GET /wards/{wardId}` | Sample ward details |
| `getInterventions` | `GET /wards/{wardId}/interventions` | Illustrative recommendations |
| `getAlerts`, `sendAlert` | `GET/POST /alerts`, `GET /alerts/{id}` | In-memory mock delivery |
| `getGridDemand`, `getGridWards` | `GET /grid/demand`, `GET /grid/wards` | Derived/modelled fixture values |
| `getForecast` | `GET /forecast` | Synthetic seven-day and hourly values |
| `subscribeToAlerts` | `POST /public/subscribe` | In-memory, encrypted phone value |
| `generatePlan` | `POST /planner/generate` | Greedy illustrative plan |
| `runSimulation` | `POST /simulator/run` | Illustrative scenario |
| `checkMyArea`, `searchWards` | `GET /public/check-area`, `/public/wards/search` | Name matching and nearest centroid fallback |
| `getMeta` | `GET /meta` | Demo mode and quality labels |
| `getSensorValidation` | `GET /sensors/validation` | Synthetic validation summary |
| `savePlan`, `getSharedPlan` | `POST /plans`, `GET /plans/{shortCode}` | In-memory share code |
| `getReport` | `GET /reports/*` | Basic JSON report responses |
| `getAlertTemplates`, `getAlertRules` | `GET /alerts/templates`, `/alerts/rules` | In-memory collections |
| `getSettings`, `updateSettings` | `GET/PUT /settings` | In-memory settings |

Additional demo routes include health checks, ward comparison, CSV exports, sensor device registration and reading submission. Authentication issues a signed 60-minute bearer token. For frontend compatibility, demo mode allows missing bearer headers on officer routes; live-mode role guards and persistent users are not implemented. No live data pipeline or PostGIS query is currently connected.
