import { USE_MOCK, API_BASE_URL } from '../config';
import { Ward, CityOverview, HeatAlert, GridDemandData, RecommendedAction, AlertSubscription, RiskWeights } from '../types';
import { MOCK_WARDS, MOCK_ALERTS, MOCK_CITY_OVERVIEW, MOCK_GRID_DATA } from '../data/mockData';
import {
  MOCK_ALERT_TEMPLATES,
  MOCK_ALERT_RULES,
  MOCK_CITY_SETTINGS,
  buildMockForecast,
  buildMockSensorValidation,
} from '../data/mockOps';
import { generateWardInterventions, generateOptimisedPlan } from '../lib/interventions';
import { getRiskLevel, getWardRiskWithWeights } from '../lib/risk';

const TOKEN_KEY = 'heatsense-token';
const delay = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let alertsState: HeatAlert[] = [...MOCK_ALERTS];
let subscriptionsState: AlertSubscription[] = [];
let templatesState: any[] = MOCK_ALERT_TEMPLATES.map((t) => ({ ...t }));
let rulesState: any[] = MOCK_ALERT_RULES.map((r) => ({ ...r }));
let settingsState: any = { ...MOCK_CITY_SETTINGS, weights: { ...MOCK_CITY_SETTINGS.weights }, benchmarks: { ...MOCK_CITY_SETTINGS.benchmarks } };
let sharedPlansState: Record<string, any> = {};


export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) { super(message); this.name = 'ApiError'; this.status = status; this.code = code; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers }); }
  catch { throw new ApiError('Cannot reach the HeatSense API. Check that the backend is running.', 0, 'network_error'); }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    try { const data = await response.json(); message = data?.error?.message || data?.detail?.error?.message || data?.detail || message; code = data?.error?.code || data?.detail?.error?.code; } catch { /* non-JSON error */ }
    throw new ApiError(String(message), response.status, code);
  }
  return response.json() as Promise<T>;
}

const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
  return params.toString();
};

export async function loginOfficer(email: string, password: string) {
  if (USE_MOCK) {
    await delay(400);
    const role = email.toLowerCase().startsWith('admin') ? 'admin' : 'officer';
    const result = {
      accessToken: `mock-token-${role}-${Date.now().toString(36)}`,
      tokenType: 'bearer',
      user: {
        name: 'HeatSense Officer',
        email,
        department: 'GHMC Disaster Management',
        role,
      },
    };
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    return result;
  }
  const result = await request<{ accessToken: string; tokenType: string; user: { name: string; email: string; department: string; role: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem(TOKEN_KEY, result.accessToken);
  return result;
}

export async function getCityOverview(): Promise<CityOverview> {
  if (USE_MOCK) { await delay(); return { ...MOCK_CITY_OVERVIEW, activeAlertsCount: alertsState.filter((a) => a.status === 'sent' && a.level !== 'Green').length }; }
  return request('/city/overview');
}

export async function getWards(): Promise<Ward[]> {
  if (USE_MOCK) { await delay(); return [...MOCK_WARDS]; }
  return request('/wards');
}

export async function getWardsWithWeights(weights: RiskWeights): Promise<Ward[]> {
  if (USE_MOCK) return getWards();
  return request(`/wards?${query({ wTemp: weights.wTemp, wTree: weights.wTree, wBuilt: weights.wBuilt, wVuln: weights.wVuln })}`);
}

export async function getWardGeoJSON(weights?: RiskWeights) {
  if (USE_MOCK) {
    await delay(250);
    const wards = weights ? MOCK_WARDS.map((w) => ({
      ...w,
      ...getWardRiskWithWeights(w, weights),
    })) : MOCK_WARDS;
    return {
      type: 'FeatureCollection',
      features: wards.map((w) => {
        const ring: number[][] = w.polygon.map(([lat, lng]) => [lng, lat]);
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (ring.length && (first[0] !== last[0] || first[1] !== last[1])) {
          ring.push([first[0], first[1]]);
        }
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {
            id: w.id,
            name: w.name,
            heatRiskScore: w.heatRiskScore,
            riskLevel: w.riskLevel,
            landSurfaceTempC: w.landSurfaceTempC,
            treeCoverPercent: w.treeCoverPercent,
            builtUpPercent: w.builtUpPercent,
            powerStress: w.peakDemandStressIndex,
            dataQuality: 'sample',
          },
        };
      }),
    };
  }
  return request(`/wards/geojson${weights ? `?${query({ wTemp: weights.wTemp, wTree: weights.wTree, wBuilt: weights.wBuilt, wVuln: weights.wVuln })}` : ''}`);
}

export async function getWardById(id: string): Promise<Ward | null> {
  if (USE_MOCK) { await delay(250); const ward = MOCK_WARDS.find((w) => w.id === id || w.name.toLowerCase() === id.toLowerCase()); return ward ? { ...ward } : null; }
  return request(`/wards/${encodeURIComponent(id)}`);
}

export async function getInterventions(wardId: string): Promise<RecommendedAction[]> {
  if (USE_MOCK) { await delay(); const ward = MOCK_WARDS.find((w) => w.id === wardId); return ward ? generateWardInterventions(ward) : []; }
  return request(`/wards/${encodeURIComponent(wardId)}/interventions`);
}

export async function getAlerts(): Promise<HeatAlert[]> {
  if (USE_MOCK) { await delay(); return [...alertsState]; }
  return request('/alerts');
}

export async function sendAlert(payload: Omit<HeatAlert, 'id' | 'timestamp' | 'deliveredPercent'>): Promise<HeatAlert> {
  if (USE_MOCK) { await delay(600); const item: HeatAlert = { ...payload, id: `alt-${String(alertsState.length + 1).padStart(3, '0')}`, timestamp: new Date().toISOString(), deliveredPercent: payload.status === 'sent' ? 98.6 : 0 }; alertsState = [item, ...alertsState]; return item; }
  const created = await request<HeatAlert>('/alerts', { method: 'POST', body: JSON.stringify(payload) });
  if (created.status === 'sent' || created.status === 'scheduled') {
    for (let attempt = 0; attempt < 15; attempt++) {
      if (attempt) await delay(2000);
      const latest = await request<HeatAlert>(`/alerts/${created.id}`);
      if (latest.status === 'sent' || (latest.status as string) === 'failed') return latest;
    }
    return request<HeatAlert>(`/alerts/${created.id}`);
  }
  return created;
}

export async function getGridDemand(): Promise<GridDemandData> {
  if (USE_MOCK) { await delay(); return { ...MOCK_GRID_DATA }; }
  return request('/grid/demand');
}

export async function getGridWards() {
  if (USE_MOCK) {
    await delay(250);
    return MOCK_WARDS.map((w) => ({
      wardId: w.id,
      wardName: w.name,
      peakPowerDemandMW: w.peakPowerDemandMW,
      stressIndex: w.peakDemandStressIndex,
      transformerOverloadRisk: w.transformerOverloadRisk,
      recommendedActions:
        w.peakDemandStressIndex > 85
          ? ['Automated thermostat 24°C nudge', 'Cool roof subsidy', 'Inspect local transformer']
          : ['Stagger cooling loads', 'Inspect local transformer'],
      dataQuality: 'modelled',
    }));
  }
  return request('/grid/wards');
}

export async function getForecast(): Promise<{
  daily: { date: string; maxTempC: number; minTempC: number; alertLevel: string; condition: string }[];
  current?: { temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; wind_speed_10m?: number; time?: string };
  source?: string;
  dataQuality?: string;
  fetchedAt?: string | null;
  error?: string;
}> {
  if (USE_MOCK) { await delay(250); return buildMockForecast() as any; }
  return request('/forecast/live');
}

export async function subscribeToAlerts(payload: Omit<AlertSubscription, 'createdAt'>): Promise<{ success: boolean; id: string }> {
  if (USE_MOCK) { await delay(500); subscriptionsState.push({ ...payload, createdAt: new Date().toISOString() }); return { success: true, id: `sub-${subscriptionsState.length}` }; }
  return request('/public/subscribe', { method: 'POST', body: JSON.stringify({ name: payload.name, phone: payload.mobile, wardId: payload.wardId, language: payload.language, role: payload.userType, channel: payload.channel, consent: true }) });
}

export async function generatePlan(payload: { budgetInrLakh: number; types: string[]; goal: string; zone?: string }): Promise<any> {
  if (USE_MOCK) {
    await delay(500);
    // Use the same greedy optimizer the backend runs so mock plans are real plans,
    // not an empty shell that would make the planner look broken.
    const goal =
      payload.goal === 'maximise_cooling'
        ? 'cooling'
        : payload.goal === 'most_vulnerable_first'
          ? 'vulnerable'
          : 'people';
    const result = generateOptimisedPlan(
      MOCK_WARDS,
      payload.budgetInrLakh,
      payload.types as any,
      goal,
      payload.zone ?? 'all'
    );
    return {
      items: result.plan,
      plan: result.plan,
      nextBest: [],
      totals: {
        cost: result.totalCost,
        peopleProtected: result.peopleProtected,
        avgCoolingC: result.avgCooling,
        wardsCovered: result.wardsCovered,
      },
      mapPoints: result.plan.map((a) => ({
        wardId: a.wardId,
        centroid: MOCK_WARDS.find((w) => w.id === a.wardId)?.centroid ?? [17.385, 78.4867],
      })),
      assumptionsNote: 'Illustrative assumptions, to be validated with field data.',
    };
  }
  return request<any>('/planner/generate', { method: 'POST', body: JSON.stringify(payload) });
}

export async function runSimulation(payload: { wardId: string; treeCoverIncreasePct: number; coolRoofPct: number; shadeSheltersAdded: number; waterPointsAdded: number }): Promise<any> {
  if (USE_MOCK) {
    await delay();
    const ward = MOCK_WARDS.find((w) => w.id === payload.wardId || w.name.toLowerCase() === payload.wardId.toLowerCase());
    if (!ward) return { error: 'Ward not found' };
    const temp = ward.airTempEstimateC;
    const cooling = Math.min(5.0, payload.treeCoverIncreasePct * 0.08 + payload.coolRoofPct * 0.0333 + payload.shadeSheltersAdded * 0.025 + payload.waterPointsAdded * 0.02);
    const afterTemp = Math.max(20, temp - cooling);
    const newLST = Math.max(34, ward.landSurfaceTempC - payload.treeCoverIncreasePct * 0.08 - payload.coolRoofPct * 0.0333);
    const newScore = Math.max(0, Math.min(100, Math.round(ward.heatRiskScore * (1 - cooling * 0.05))));
    const demand = ward.peakPowerDemandMW;
    const reduction = demand * Math.min(0.25, cooling * 0.022);
    return {
      before: { tempC: temp, score: ward.heatRiskScore, level: ward.riskLevel, demandMW: demand },
      after: { tempC: parseFloat(afterTemp.toFixed(1)), score: newScore, level: getRiskLevel(newScore), demandMW: parseFloat((demand - reduction).toFixed(2)) },
      peopleMovedToSaferLevel: newScore < ward.heatRiskScore ? Math.round(ward.population * 0.1) : 0,
      demandReductionMW: parseFloat(reduction.toFixed(2)),
      assumptions: ['Scenario results are illustrative planning estimates, not measured outcomes.'],
      disclaimer: 'Scenario results are illustrative planning estimates, not measured outcomes.'
    };
  }
  return request<any>('/simulator/run', { method: 'POST', body: JSON.stringify(payload) });
}

export async function checkMyArea(params: { q?: string; lat?: number; lng?: number } | string) {
  if (USE_MOCK) {
    await delay(400);
    const opts = typeof params === 'string' ? { q: params } : params;
    let ward: Ward | undefined;
    if (opts.q) {
      const needle = opts.q.toLowerCase();
      ward = MOCK_WARDS.find(
        (w) =>
          w.name.toLowerCase().includes(needle) ||
          w.nameTelugu.includes(opts.q!) ||
          w.nameHindi.includes(opts.q!)
      );
    }
    if (!ward && opts.lat != null && opts.lng != null) {
      ward = MOCK_WARDS.reduce((best, w) => {
        const dBest = (best.centroid[0] - opts.lat!) ** 2 + (best.centroid[1] - opts.lng!) ** 2;
        const dCur = (w.centroid[0] - opts.lat!) ** 2 + (w.centroid[1] - opts.lng!) ** 2;
        return dCur < dBest ? w : best;
      }, MOCK_WARDS[0]);
    }
    if (!ward) throw new ApiError('No matching ward found', 404);
    return {
      ward: { id: ward.id, name: ward.name, nameTelugu: ward.nameTelugu, nameHindi: ward.nameHindi },
      todayRiskLevel: ward.riskLevel,
      expectedPeakTempC: ward.airTempEstimateC,
      hottestHours: ['12:00', '13:00', '14:00', '15:00'],
      safetyTips: {
        en: ['Drink water regularly', 'Avoid going out from 12 to 4 PM', 'Wear light cotton clothes', 'Check on elderly neighbours; call 108 for heat stroke'],
        te: ['క్రమం తప్పకుండా నీరు త్రాగండి', 'మధ్యాహ్నం 12 నుండి 4 వరకు బయటకు వెళ్లవద్దు', 'తేలికపాటి పత్తి దుస్తులు ధరించండి'],
        hi: ['नियमित रूप से पानी पिएं', 'दोपहर 12 से 4 बजे तक बाहर न जाएं', 'हल्के सूती कपड़े पहनें'],
      },
      nearest: {
        waterPoint: { name: 'Ward water point', distanceM: 350 },
        shadeShelter: { name: 'Ward shade shelter', distanceM: 500 },
        coolingCentre: { name: 'GHMC community centre', distanceM: 900 },
      },
      dataQuality: 'sample',
    };
  }
  if (typeof params === 'string') return request<any>(`/public/check-area?${query({ q: params })}`);
  return request<any>(`/public/check-area?${query({ q: params.q, lat: params.lat, lng: params.lng })}`);
}
export async function searchWards(q: string) {
  if (USE_MOCK) {
    await delay(200);
    const needle = (q || '').toLowerCase();
    return MOCK_WARDS.filter(
      (w) =>
        !needle ||
        w.name.toLowerCase().includes(needle) ||
        w.nameTelugu.includes(q) ||
        w.nameHindi.includes(q)
    )
      .slice(0, 10)
      .map((w) => ({ id: w.id, name: w.name, nameTelugu: w.nameTelugu, nameHindi: w.nameHindi }));
  }
  return request<any[]>(`/public/wards/search?${query({ q })}`);
}
export async function getMeta() {
  if (USE_MOCK) {
    await delay(150);
    return {
      version: '1.0.0',
      mode: 'mock',
      dataQuality: { overall: 'sample', vulnerability: 'proxy', grid: 'modelled' },
      lastRefresh: { wards: null, forecast: new Date().toISOString() },
      model: { status: 'synthetic-demo' },
    };
  }
  return request<{ version: string; mode: string; dataQuality: Record<string, string> }>('/meta');
}
export async function getHealthReady() {
  if (USE_MOCK) {
    await delay(150);
    return { status: 'ready', database: 'mock', scheduler: 'disabled' };
  }
  return request<{ status: string; database: string; scheduler: string }>('/health/ready');
}
export async function getSensorValidation() {
  if (USE_MOCK) { await delay(300); return buildMockSensorValidation(); }
  return request<any>('/sensors/validation');
}
export async function registerDevice(payload: { name?: string; wardId?: string }) {
  if (USE_MOCK) {
    await delay(300);
    return { deviceId: `dev-${Date.now().toString(16)}`, deviceKey: `mock-key-${Math.random().toString(36).slice(2)}` };
  }
  return request<{ deviceId: string; deviceKey: string }>('/sensors/devices', { method: 'POST', body: JSON.stringify(payload) });
}
export async function savePlan(payload: { name: string; items: unknown[]; totals?: unknown }) {
  if (USE_MOCK) {
    await delay(400);
    const id = `plan-${Date.now().toString(16)}`;
    const shortCode = Math.random().toString(36).slice(2, 8);
    sharedPlansState[shortCode] = {
      id,
      shortCode,
      name: payload.name,
      items: payload.items,
      totals: payload.totals ?? {},
      createdAt: new Date().toISOString(),
    };
    return { id, shortCode };
  }
  return request<{ id: string; shortCode: string }>('/plans', { method: 'POST', body: JSON.stringify(payload) });
}
export async function getSharedPlan(code: string) {
  if (USE_MOCK) {
    await delay(300);
    const plan = sharedPlansState[code];
    if (!plan) throw new ApiError('Plan not found', 404);
    return plan;
  }
  return request<any>(`/plans/${encodeURIComponent(code)}`);
}
export async function getReport(path: string) {
  const clean = path.replace(/^\/+/, '');
  if (USE_MOCK) {
    await delay(400);
    if (clean === 'city-summary') {
      return { overview: { ...MOCK_CITY_OVERVIEW, lastUpdated: new Date().toISOString() }, wards: MOCK_WARDS, dataQuality: 'sample' };
    }
    if (clean.startsWith('ward/')) {
      const wardId = clean.slice('ward/'.length);
      const ward = MOCK_WARDS.find((w) => w.id === wardId);
      if (!ward) throw new ApiError('Ward not found', 404);
      return ward;
    }
    if (clean.startsWith('alerts-summary')) {
      return { total: alertsState.length, alerts: alertsState };
    }
    if (clean.startsWith('plan/')) {
      const planId = clean.slice('plan/'.length);
      const plan = Object.values(sharedPlansState).find((p) => p.id === planId);
      if (!plan) throw new ApiError('Plan not found', 404);
      return plan;
    }
    throw new ApiError(`Unknown report: ${clean}`, 404);
  }
  return request<any>(`/reports/${clean}`);
}
export async function getAlertTemplates() {
  if (USE_MOCK) { await delay(200); return templatesState.map((t) => ({ ...t })); }
  return request<any[]>('/alerts/templates');
}
export async function updateAlertTemplate(id: string, payload: unknown) {
  if (USE_MOCK) {
    await delay(200);
    const found = templatesState.find((t) => t.id === id);
    if (!found) throw new ApiError('Template not found', 404);
    Object.assign(found, payload);
    return { ...found };
  }
  return request<any>(`/alerts/templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export async function getAlertRules() {
  if (USE_MOCK) { await delay(200); return rulesState.map((r) => ({ ...r })); }
  return request<any[]>('/alerts/rules');
}
export async function updateAlertRule(id: string, payload: unknown) {
  if (USE_MOCK) {
    await delay(200);
    const found = rulesState.find((r) => r.id === id);
    if (!found) throw new ApiError('Rule not found', 404);
    Object.assign(found, payload);
    return { ...found };
  }
  return request<any>(`/alerts/rules/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export async function getSettings() {
  if (USE_MOCK) { await delay(200); return { ...settingsState }; }
  return request<any>('/settings');
}
export async function updateSettings(values: unknown) {
  if (USE_MOCK) {
    await delay(300);
    settingsState = { ...settingsState, ...(values as object) };
    return { ...settingsState };
  }
  return request<any>('/settings', { method: 'PUT', body: JSON.stringify(values) });
}

const csvCell = (value: unknown) => {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const toCsv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');

export async function getWardsCsv(): Promise<string> {
  if (USE_MOCK) {
    await delay(300);
    return toCsv(
      ['id', 'name', 'zone', 'heatRiskScore', 'riskLevel', 'landSurfaceTempC', 'treeCoverPercent', 'builtUpPercent', 'population', 'dataQuality'],
      MOCK_WARDS.map((w) => [
        w.id, w.name, w.zone, w.heatRiskScore, w.riskLevel, w.landSurfaceTempC,
        w.treeCoverPercent, w.builtUpPercent, w.population, 'sample',
      ])
    );
  }
  const r = await fetch(`${API_BASE_URL}/wards/export.csv`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` } }); if (!r.ok) throw new ApiError('CSV export failed', r.status); return r.text();
}
export async function getAlertsCsv(): Promise<string> {
  if (USE_MOCK) {
    await delay(300);
    return toCsv(
      ['id', 'level', 'title', 'status', 'timestamp', 'recipientsCount'],
      alertsState.map((a) => [a.id, a.level, a.title, a.status, a.timestamp, a.recipientsCount])
    );
  }
  const r = await fetch(`${API_BASE_URL}/alerts/export.csv`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` } }); if (!r.ok) throw new ApiError('CSV export failed', r.status); return r.text();
}
