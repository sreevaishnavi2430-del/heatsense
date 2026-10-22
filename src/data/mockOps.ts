/**
 * Operational mock fixtures.
 *
 * These mirror the server-side defaults seeded in `backend/app/main.py` so the
 * alert centre, settings, sensor validation and report builder all work in mock
 * mode without a running backend. Keep the shapes aligned with the API contract
 * described in `docs/CONTRACT.md`.
 */
import { MOCK_WARDS, MOCK_CITY_OVERVIEW } from './mockData';

export interface MockAlertTemplate {
  id: string;
  level: 'Yellow' | 'Orange' | 'Red';
  language: 'en' | 'te' | 'hi';
  title: string;
  body: string;
  tips: string[];
}

const SAFETY_TIPS = [
  'Drink water often',
  'Avoid outdoor activity from 12 to 4 PM',
  'Wear light cotton clothes',
  'Check on older neighbours; call 108 for heat stroke',
];

export const MOCK_ALERT_TEMPLATES: MockAlertTemplate[] = [
  {
    id: 'yellow-en',
    level: 'Yellow',
    language: 'en',
    title: 'Heat safety advisory',
    body: 'Heat advisory for {ward} ({temp}°C). Drink water, wear light cotton clothes and check on older neighbours. Avoid midday sun.',
    tips: SAFETY_TIPS,
  },
  {
    id: 'yellow-te',
    level: 'Yellow',
    language: 'te',
    title: 'హీట్ భద్రతా సలహా',
    body: '{ward} లో వేడి ఎక్కువగా ఉంది ({temp}°C). నీరు త్రాగండి, తేలికపాటి పత్తి దుస్తులు ధరించండి. మధ్యాహ్నం ఎండను నివారించండి.',
    tips: SAFETY_TIPS,
  },
  {
    id: 'yellow-hi',
    level: 'Yellow',
    language: 'hi',
    title: 'गर्मी से बचाव की सलाह',
    body: '{ward} में गर्मी अधिक है ({temp}°C)। पानी पिएं, हल्के सूती कपड़े पहनें और दोपहर की धूप से बचें।',
    tips: SAFETY_TIPS,
  },
  {
    id: 'orange-en',
    level: 'Orange',
    language: 'en',
    title: 'Severe heat warning',
    body: 'ORANGE ALERT for {ward}: avoid going out 12–4 PM. Drink water and check on older neighbours. Call 108 for heat stroke.',
    tips: SAFETY_TIPS,
  },
  {
    id: 'orange-te',
    level: 'Orange',
    language: 'te',
    title: 'తీవ్రమైన వేడి హెచ్చరిక',
    body: '{ward} కు ఆరెంజ్ హెచ్చరిక: మధ్యాహ్నం 12–4 బయటకు వెళ్లవద్దు. నీరు త్రాగండి. హీట్ స్ట్రోక్‌కు 108కు కాల్ చేయండి.',
    tips: SAFETY_TIPS,
  },
  {
    id: 'orange-hi',
    level: 'Orange',
    language: 'hi',
    title: 'गंभीर गर्मी चेतावनी',
    body: '{ward} के लिए ऑरेंज चेतावनी: दोपहर 12–4 बजे बाहर न जाएं। पानी पिएं। लू लगने पर 108 पर कॉल करें।',
    tips: SAFETY_TIPS,
  },
  {
    id: 'red-en',
    level: 'Red',
    language: 'en',
    title: 'Extreme heat emergency',
    body: 'RED ALERT for {ward}: stay in shade, drink water and avoid outdoor work during peak heat. Call 108 for confusion, fainting or hot dry skin.',
    tips: SAFETY_TIPS,
  },
  {
    id: 'red-te',
    level: 'Red',
    language: 'te',
    title: 'అత్యంత తీవ్రమైన వేడి అత్యవసరం',
    body: '{ward} కు రెడ్ హెచ్చరిక: నీడలో ఉండండి, నీరు త్రాగండి, తీవ్రమైన వేడిలో బయట పని చేయవద్దు. అత్యవసరానికి 108కు కాల్ చేయండి.',
    tips: SAFETY_TIPS,
  },
  {
    id: 'red-hi',
    level: 'Red',
    language: 'hi',
    title: 'अत्यधिक गर्मी आपात स्थिति',
    body: '{ward} के लिए रेड चेतावनी: छाया में रहें, पानी पिएं और तेज गर्मी में बाहर काम न करें। आपात स्थिति में 108 पर कॉल करें।',
    tips: SAFETY_TIPS,
  },
];

export interface MockAlertRule {
  id: string;
  name: string;
  condition: {
    metric: string;
    operator: string;
    value: number;
    consecutiveDays?: number;
    consecutiveHours?: number;
  };
  level: 'Yellow' | 'Orange' | 'Red';
  wardsScope: 'all' | 'allSevere';
  enabled: boolean;
  autoSend: boolean;
}

export const MOCK_ALERT_RULES: MockAlertRule[] = [
  {
    id: 'rule-forecast-43',
    name: 'Consecutive extreme forecast',
    condition: { metric: 'forecastSurfaceTempC', operator: '>', value: 43, consecutiveDays: 2 },
    level: 'Orange',
    wardsScope: 'allSevere',
    enabled: true,
    autoSend: false,
  },
  {
    id: 'rule-red-45',
    name: 'Extreme heat forecast',
    condition: { metric: 'forecastSurfaceTempC', operator: '>=', value: 45, consecutiveDays: 1 },
    level: 'Red',
    wardsScope: 'allSevere',
    enabled: true,
    autoSend: false,
  },
  {
    id: 'rule-grid-stress',
    name: 'High power stress',
    condition: { metric: 'stressIndex', operator: '>', value: 85, consecutiveHours: 3 },
    level: 'Yellow',
    wardsScope: 'all',
    enabled: true,
    autoSend: false,
  },
];

export interface MockCitySettings {
  weights: { wTemp: number; wTree: number; wBuilt: number; wVuln: number };
  temperatureUnit: 'C' | 'F';
  refreshIntervalSeconds: number;
  benchmarks: { peoplePerWaterPoint: number; peoplePerShadeShelter: number };
}

export const MOCK_CITY_SETTINGS: MockCitySettings = {
  weights: { wTemp: 0.35, wTree: 0.2, wBuilt: 0.15, wVuln: 0.3 },
  temperatureUnit: 'C',
  refreshIntervalSeconds: 60,
  benchmarks: { peoplePerWaterPoint: 2000, peoplePerShadeShelter: 3000 },
};

/**
 * Builds a deterministic 7-day city forecast from the ward sample data.
 * The shape matches the live Open-Meteo payload served by `/forecast/live`.
 */
export function buildMockForecast(now: Date = new Date()) {
  const base = MOCK_CITY_OVERVIEW.avgCitySurfaceTempC;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daily = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() + i * 86400000);
    const maxTempC = Number((base + ((i * 3) % 5) - 1.4).toFixed(1));
    const minTempC = Number((maxTempC - 9.6).toFixed(1));
    const level = maxTempC >= 45 ? 'Red' : maxTempC >= 43 ? 'Orange' : maxTempC >= 40 ? 'Yellow' : 'Green';
    const condition =
      level === 'Red'
        ? 'Extreme Heatwave Emergency'
        : level === 'Orange'
          ? 'Severe Heatwave Warning'
          : level === 'Yellow'
            ? 'Heatwave Caution'
            : 'Hot & Sunny';
    return {
      date: date.toISOString().slice(0, 10),
      maxTempC,
      minTempC,
      alertLevel: level,
      condition,
      weekday: weekday[date.getDay()],
    };
  });

  const currentTemp = Number((base - 1.8).toFixed(1));

  return {
    daily,
    current: {
      temperature_2m: currentTemp,
      apparent_temperature: Number((currentTemp + 1.6).toFixed(1)),
      relative_humidity_2m: 48,
      wind_speed_10m: 9.4,
      time: now.toISOString().slice(0, 16),
    },
    source: 'Mock city forecast derived from ward sample data',
    dataQuality: 'sample',
    fetchedAt: now.toISOString(),
  };
}

/** Sensor ground-truthing payload mirroring `/sensors/validation`. */
export function buildMockSensorValidation() {
  return {
    maeC: 1.2,
    rmseC: 1.5,
    biasC: 0.2,
    numberOfReadings: 0,
    dataQuality: 'sample',
    model: {
      trainedAt: null,
      mae: 1.2,
      rmse: 1.5,
      nSamples: 0,
      label: 'synthetic demo model',
    },
    wards: MOCK_WARDS.map((w) => ({
      wardId: w.id,
      wardName: w.name,
      modelledTempC: w.airTempEstimateC,
      sensorTempC: null,
      readings: 0,
      dataQuality: 'sample',
    })),
  };
}
