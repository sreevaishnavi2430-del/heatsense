import { USE_MOCK, API_BASE_URL } from '../config';
import { Ward, CityOverview, HeatAlert, GridDemandData, RecommendedAction, AlertSubscription, RiskWeights } from '../types';
import { MOCK_WARDS, MOCK_ALERTS, MOCK_CITY_OVERVIEW, MOCK_GRID_DATA } from '../data/mockData';
import { generateWardInterventions } from '../lib/interventions';

const TOKEN_KEY = 'heatsense-token';
const delay = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let alertsState: HeatAlert[] = [...MOCK_ALERTS];
let subscriptionsState: AlertSubscription[] = [];

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
  if (USE_MOCK) return { type: 'FeatureCollection', features: [] };
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

export async function getGridWards() { return USE_MOCK ? [] : request('/grid/wards'); }

export async function getForecast(): Promise<{
  daily: { date: string; maxTempC: number; minTempC: number; alertLevel: string; condition: string }[];
  current?: { temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; wind_speed_10m?: number; time?: string };
  source?: string;
  dataQuality?: string;
  fetchedAt?: string | null;
  error?: string;
}> {
  return request('/forecast/live');
}

export async function subscribeToAlerts(payload: Omit<AlertSubscription, 'createdAt'>): Promise<{ success: boolean; id: string }> {
  if (USE_MOCK) { await delay(500); subscriptionsState.push({ ...payload, createdAt: new Date().toISOString() }); return { success: true, id: `sub-${subscriptionsState.length}` }; }
  return request('/public/subscribe', { method: 'POST', body: JSON.stringify({ name: payload.name, phone: payload.mobile, wardId: payload.wardId, language: payload.language, role: payload.userType, channel: payload.channel, consent: true }) });
}

export async function generatePlan(payload: { budgetInrLakh: number; types: string[]; goal: string; zone?: string }): Promise<any> {
  return USE_MOCK ? { plan: [], items: [], totals: { cost: 0, peopleProtected: 0, avgCoolingC: 0, wardsCovered: 0 }, mapPoints: [] } : request<any>('/planner/generate', { method: 'POST', body: JSON.stringify(payload) });
}

export async function runSimulation(payload: { wardId: string; treeCoverIncreasePct: number; coolRoofPct: number; shadeSheltersAdded: number; waterPointsAdded: number }): Promise<any> {
  return request<any>('/simulator/run', { method: 'POST', body: JSON.stringify(payload) });
}

export async function checkMyArea(params: { q?: string; lat?: number; lng?: number } | string) {
  if (typeof params === 'string') return request<any>(`/public/check-area?${query({ q: params })}`);
  return request<any>(`/public/check-area?${query({ q: params.q, lat: params.lat, lng: params.lng })}`);
}
export async function searchWards(q: string) { return request<any[]>(`/public/wards/search?${query({ q })}`); }
export async function getMeta() { return request<{ version: string; mode: string; dataQuality: Record<string, string> }>('/meta'); }
export async function getHealthReady() { return request<{ status: string; database: string; scheduler: string }>('/health/ready'); }
export async function getSensorValidation() { return request<any>('/sensors/validation'); }
export async function registerDevice(payload: { name?: string; wardId?: string }) { return request<{ deviceId: string; deviceKey: string }>('/sensors/devices', { method: 'POST', body: JSON.stringify(payload) }); }
export async function savePlan(payload: { name: string; items: unknown[]; totals?: unknown }) { return request<{ id: string; shortCode: string }>('/plans', { method: 'POST', body: JSON.stringify(payload) }); }
export async function getSharedPlan(code: string) { return request<any>(`/plans/${encodeURIComponent(code)}`); }
export async function getReport(path: string) { return request<any>(`/reports/${path.replace(/^\/+/, '')}`); }
export async function getAlertTemplates() { return request<any[]>('/alerts/templates'); }
export async function updateAlertTemplate(id: string, payload: unknown) { return request<any>(`/alerts/templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }); }
export async function getAlertRules() { return request<any[]>('/alerts/rules'); }
export async function updateAlertRule(id: string, payload: unknown) { return request<any>(`/alerts/rules/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }); }
export async function getSettings() { return request<any>('/settings'); }
export async function updateSettings(values: unknown) { return request<any>('/settings', { method: 'PUT', body: JSON.stringify(values) }); }

export async function getWardsCsv(): Promise<string> { const r = await fetch(`${API_BASE_URL}/wards/export.csv`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` } }); if (!r.ok) throw new ApiError('CSV export failed', r.status); return r.text(); }
export async function getAlertsCsv(): Promise<string> { const r = await fetch(`${API_BASE_URL}/alerts/export.csv`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` } }); if (!r.ok) throw new ApiError('CSV export failed', r.status); return r.text(); }
