/**
 * Runtime verification that every API function used by the UI resolves in mock mode.
 *
 * Guards the "works on my machine" class of bug: if a page calls an endpoint that
 * has no mock fallback, it silently renders empty for anyone without the backend.
 * Every function exercised here must return usable data without a network call.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

// ── Fake browser environment ────────────────────────────────────────────────
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};
globalThis.document = {
  documentElement: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
};
// Any network attempt during mock mode is a failure, not a silent fallback.
globalThis.fetch = async (url) => {
  throw new Error(`Unexpected network call in mock mode: ${url}`);
};

const vite = await createServer({
  configFile: 'vite.config.ts',
  // `test` mode avoids loading .env.development, so VITE_USE_MOCK resolves to the
  // mock-mode default rather than the developer's local live-backend setting.
  mode: 'test',
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

let failures = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
};

try {
  console.log('\nHeatSense mock-mode API coverage verification\n');

  const api = await vite.ssrLoadModule('/src/services/api.ts');

  await check('getWards returns all 40 wards with currentWeather', async () => {
    const wards = await api.getWards();
    assert.equal(wards.length, 40, 'expected 40 wards');
    assert.ok(wards.every((w) => w.currentWeather), 'every ward needs currentWeather');
    assert.ok(wards.every((w) => typeof w.heatRiskScore === 'number'), 'every ward needs a score');
    assert.ok(wards.every((w) => w.polygon.length >= 3), 'every ward needs a polygon');
  });

  await check('getCityOverview returns populated overview', async () => {
    const overview = await api.getCityOverview();
    assert.equal(overview.totalWards, 40);
    assert.ok(overview.totalPopulation > 0, 'population must be non-zero');
  });

  await check('getWardById resolves a ward', async () => {
    const ward = await api.getWardById('charminar');
    assert.ok(ward, 'ward must resolve');
    assert.ok(ward.currentWeather, 'ward must carry currentWeather');
  });

  await check('getGridDemand returns 24h curves', async () => {
    const grid = await api.getGridDemand();
    assert.ok(grid.hourlyLabels.length > 0, 'needs hourly labels');
    assert.equal(grid.totalDemandMW.length, grid.hourlyLabels.length, 'demand curve must align with labels');
    assert.ok(grid.peakDemandMW > 0, 'peak demand must be positive');
    assert.ok(grid.stressedSubstationsCount > 0, 'stressed substations must be reported');
  });

  await check('grid series is a true hourly profile with a plausible diurnal shape', async () => {
    const grid = await api.getGridDemand();
    assert.equal(grid.hourlyLabels.length, 24, 'expected 24 hourly points');
    assert.equal(grid.hourlyLabels[0], '00:00');
    assert.equal(grid.hourlyLabels[23], '23:00');
    assert.equal(grid.temperatureCurveC.length, 24, 'temperature curve must have 24 points');
    for (const zone of ['Central', 'East', 'West', 'North', 'South']) {
      assert.equal(grid.zoneDemand[zone].length, 24, `${zone} demand must have 24 points`);
    }
    // The demand peak must fall in the evening AC window the grid monitor highlights.
    const peakIdx = grid.totalDemandMW.indexOf(Math.max(...grid.totalDemandMW));
    assert.ok(peakIdx >= 18 && peakIdx <= 21, `peak hour ${peakIdx} should be in the 18:00-21:00 window`);
    // Surface temperature must peak in the afternoon, before the demand peak.
    const tempPeakIdx = grid.temperatureCurveC.indexOf(Math.max(...grid.temperatureCurveC));
    assert.ok(tempPeakIdx >= 12 && tempPeakIdx <= 16, `temperature peak ${tempPeakIdx} should be in the afternoon`);
  });

  await check('getGridWards returns per-ward stress data', async () => {
    const rows = await api.getGridWards();
    assert.equal(rows.length, 40, 'expected one row per ward');
    assert.ok(rows[0].stressIndex >= 0, 'stress index must be present');
  });

  await check('getForecast returns a 7-day forecast with current conditions', async () => {
    const forecast = await api.getForecast();
    assert.equal(forecast.daily.length, 7, 'expected 7 days');
    assert.ok(forecast.daily.every((d) => typeof d.maxTempC === 'number'), 'each day needs a max temp');
    assert.ok(forecast.current?.temperature_2m != null, 'current conditions required');
  });

  await check('runSimulation produces a before/after result', async () => {
    const res = await api.runSimulation({
      wardId: 'charminar', treeCoverIncreasePct: 10, coolRoofPct: 30,
      shadeSheltersAdded: 6, waterPointsAdded: 5,
    });
    assert.ok(res.before && res.after, 'before/after required');
    assert.ok(res.after.tempC < res.before.tempC, 'cooling must reduce temperature');
    assert.ok(res.after.score <= res.before.score, 'score must not increase');
  });

  await check('generatePlan returns a non-empty budget-constrained plan', async () => {
    const res = await api.generatePlan({
      budgetInrLakh: 150,
      types: ['cool_roofs', 'tree_planting', 'shade_shelters', 'water_points', 'cooling_centres', 'misting_corridors', 'early_warning'],
      goal: 'maximise_people',
    });
    assert.ok(res.items.length > 0, 'plan must contain actions');
    assert.ok(res.totals.cost <= 150, 'plan must respect the budget');
    assert.ok(res.totals.peopleProtected > 0, 'plan must protect people');
    assert.ok(res.totals.wardsCovered > 0, 'plan must cover wards');
  });

  await check('generatePlan respects a tiny budget', async () => {
    const res = await api.generatePlan({ budgetInrLakh: 10, types: ['early_warning', 'water_points'], goal: 'maximise_cooling' });
    assert.ok(res.totals.cost <= 10, 'must not exceed the budget');
  });

  await check('checkMyArea resolves a locality', async () => {
    const res = await api.checkMyArea('Charminar');
    assert.equal(res.ward.id, 'charminar');
    assert.ok(res.todayRiskLevel, 'risk level required');
    assert.ok(res.safetyTips.te && res.safetyTips.hi, 'all three languages required');
  });

  await check('searchWards finds a ward', async () => {
    const rows = await api.searchWards('jubilee');
    assert.ok(rows.length > 0, 'expected at least one match');
  });

  await check('getAlertTemplates returns all three languages', async () => {
    const templates = await api.getAlertTemplates();
    assert.ok(templates.length >= 9, `expected 9 templates, got ${templates.length}`);
    assert.deepEqual(new Set(templates.map((t) => t.language)), new Set(['en', 'te', 'hi']));
  });

  await check('updateAlertTemplate mutates the template', async () => {
    const before = (await api.getAlertTemplates())[0];
    await api.updateAlertTemplate(before.id, { title: 'Updated title' });
    const after = (await api.getAlertTemplates()).find((t) => t.id === before.id);
    assert.equal(after.title, 'Updated title');
  });

  await check('getAlertRules returns the seeded rules', async () => {
    const rules = await api.getAlertRules();
    assert.equal(rules.length, 3, 'expected 3 auto-alert rules');
    assert.ok(rules.every((r) => typeof r.enabled === 'boolean'), 'each rule needs an enabled flag');
  });

  await check('updateAlertRule toggles a rule', async () => {
    const [first] = await api.getAlertRules();
    await api.updateAlertRule(first.id, { enabled: false });
    const after = (await api.getAlertRules()).find((r) => r.id === first.id);
    assert.equal(after.enabled, false);
  });

  await check('getSettings returns the city settings', async () => {
    const settings = await api.getSettings();
    assert.ok(settings.weights, 'weights required');
    assert.ok(settings.benchmarks, 'benchmarks required');
  });

  await check('updateSettings persists the change', async () => {
    await api.updateSettings({ refreshIntervalSeconds: 90 });
    const settings = await api.getSettings();
    assert.equal(settings.refreshIntervalSeconds, 90);
  });

  await check('getMeta and getHealthReady report mock mode', async () => {
    const meta = await api.getMeta();
    assert.equal(meta.mode, 'mock');
    const ready = await api.getHealthReady();
    assert.equal(ready.status, 'ready');
  });

  await check('getSensorValidation returns per-ward validation rows', async () => {
    const validation = await api.getSensorValidation();
    assert.equal(validation.wards.length, 40);
    assert.equal(typeof validation.maeC, 'number');
  });

  await check('registerDevice returns credentials', async () => {
    const device = await api.registerDevice({ name: 'Test sensor', wardId: 'charminar' });
    assert.ok(device.deviceId && device.deviceKey, 'device credentials required');
  });

  await check('savePlan and getSharedPlan round-trip', async () => {
    const saved = await api.savePlan({ name: 'Test plan', items: [], totals: { cost: 10 } });
    assert.ok(saved.shortCode, 'short code required');
    const loaded = await api.getSharedPlan(saved.shortCode);
    assert.equal(loaded.name, 'Test plan');
  });

  await check('getReport returns the city summary', async () => {
    const report = await api.getReport('city-summary');
    assert.equal(report.wards.length, 40);
    assert.ok(report.overview.totalWards === 40);
  });

  await check('getWardsCsv produces a header and 40 data rows', async () => {
    const csv = await api.getWardsCsv();
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 41, `expected header + 40 rows, got ${lines.length}`);
    assert.ok(lines[0].includes('heatRiskScore'), 'header must name the score column');
  });

  await check('getAlertsCsv produces a header and data rows', async () => {
    const csv = await api.getAlertsCsv();
    const lines = csv.trim().split('\n');
    assert.ok(lines.length >= 1, 'expected at least a header');
    assert.ok(lines[0].includes('recipientsCount'), 'header must name the recipients column');
  });

  await check('getWardGeoJSON returns a closed polygon per ward', async () => {
    const fc = await api.getWardGeoJSON();
    assert.equal(fc.features.length, 40, 'expected a feature per ward');
    const ring = fc.features[0].geometry.coordinates[0];
    assert.equal(ring[0][0], ring[ring.length - 1][0], 'ring must be closed');
    assert.equal(ring[0][1], ring[ring.length - 1][1], 'ring must be closed');
  });

  await check('getInterventions returns ranked actions for a ward', async () => {
    const actions = await api.getInterventions('charminar');
    assert.ok(actions.length > 0, 'expected interventions');
    assert.ok(actions[0].priorityScore >= actions[actions.length - 1].priorityScore, 'must be sorted by priority');
  });

  await check('subscribeToAlerts registers a subscriber', async () => {
    const res = await api.subscribeToAlerts({
      name: 'Test', mobile: '9876543210', wardId: 'charminar',
      language: 'te', userType: 'resident', channel: 'SMS',
    });
    assert.equal(res.success, true);
  });

  await check('loginOfficer returns a session token', async () => {
    const session = await api.loginOfficer('officer@heatsense.demo', 'demo1234');
    assert.ok(session.accessToken, 'token required');
    assert.equal(session.user.role, 'officer');
    assert.equal(store.get('heatsense-token'), session.accessToken, 'token must be persisted');
  });

  await check('every exported API function has a mock guard', async () => {
    const source = await readFile(new URL('../src/services/api.ts', import.meta.url), 'utf-8');
    const exported = [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    assert.ok(exported.length >= 25, `expected the full API surface, found ${exported.length}`);

    // Split on top-level function declarations and check each body for a USE_MOCK guard.
    const blocks = source.split(/^export async function /m).slice(1);
    const unguarded = [];
    for (const block of blocks) {
      const name = block.match(/^(\w+)/)[1];
      const body = block.split(/^export async function /m)[0];
      if (!body.includes('USE_MOCK')) unguarded.push(name);
    }
    assert.deepEqual(unguarded, [], `these functions have no mock fallback: ${unguarded.join(', ')}`);
  });

  console.log(
    failures === 0
      ? '\nAll mock-mode API coverage checks passed.\n'
      : `\n${failures} check(s) failed.\n`
  );
} finally {
  await vite.close();
}

process.exit(failures === 0 ? 0 : 1);
