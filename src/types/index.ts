export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Severe';

export type AlertLevel = 'Green' | 'Yellow' | 'Orange' | 'Red';

export type Zone = 'Central' | 'East' | 'West' | 'North' | 'South';

export type CostBand = 'Low' | 'Medium' | 'High';

export type InterventionType =
  | 'tree_planting'
  | 'cool_roofs'
  | 'shade_shelters'
  | 'water_points'
  | 'cooling_centres'
  | 'misting_corridors'
  | 'early_warning';

export interface VulnerabilityData {
  elderlyPercent: number;          // % over 65
  childrenUnder5Percent: number;   // % under 5
  lowIncomeHousingPercent: number; // % in slum/informal/tin roof housing
  outdoorWorkersPercent: number;   // % street vendors, delivery, construction, sanitation
  noAirConditioningPercent: number;// % without AC
}

export interface Amenities {
  waterPoints: number;
  shadeShelters: number;
  coolingCentres: number;
  hospitalsNearby: number;
}

export interface CurrentWardWeather {
  temperatureC: number;
  apparentTemperatureC?: number;
  relativeHumidityPct?: number;
  windSpeedKmh?: number;
  precipitationMm?: number;
  weatherCode?: number;
  observedAt?: string;
  source: string;
  dataQuality: 'modelled_current_weather';
}

export interface Ward {
  id: string;
  name: string;
  nameTelugu: string;
  nameHindi: string;
  zone: Zone;
  centroid: [number, number]; // [lat, lng]
  polygon: [number, number][]; // rough polygon coordinates
  population: number;
  populationDensityPerSqKm: number;
  landSurfaceTempC: number;    // daytime peak (36 - 48 C)
  nightTempC: number;          // night surface temp (28 - 35 C)
  airTempEstimateC: number;    // ambient air temp estimate
  treeCoverPercent: number;    // 2 - 35%
  builtUpPercent: number;      // 30 - 95%
  vulnerability: VulnerabilityData;
  heatRiskScore: number;       // 0 - 100 (computed)
  riskLevel: RiskLevel;
  topDrivers: string[];        // 3 primary risk drivers
  peakPowerDemandMW: number;
  peakDemandStressIndex: number; // 0 - 100
  transformerOverloadRisk: 'Low' | 'Medium' | 'High';
  hourlyTemp: number[];        // 24 hourly values (00:00 - 23:00)
  hourlyDemandMW: number[];    // 24 hourly demand values
  trend7Day: { date: string; maxTemp: number; minTemp: number; riskScore: number }[];
  amenities: Amenities;
  currentWeather?: CurrentWardWeather | null;
}

export interface RiskWeights {
  wTemp: number;    // default 0.35
  wTree: number;    // default 0.20
  wBuilt: number;   // default 0.15
  wVuln: number;    // default 0.30
}

export interface RecommendedAction {
  id: string;
  wardId: string;
  wardName: string;
  type: InterventionType;
  title: string;
  description: string;
  priorityScore: number; // 0 - 100
  costLakhINR: number;
  costBand: CostBand;
  coolingBenefitC: number;
  peopleBenefited: number;
  reason: string;
  suggestedCount?: number;
}

export interface PlanItem extends RecommendedAction {
  addedAt: string;
}

export interface HeatAlert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  messageTelugu?: string;
  messageHindi?: string;
  wardIds: string[];
  wardNames: string[];
  channels: ('SMS' | 'WhatsApp')[];
  language: 'en' | 'te' | 'hi' | 'all';
  targetAudience: ('residents' | 'outdoor_workers' | 'elderly_care')[];
  recipientsCount: number;
  deliveredPercent: number;
  timestamp: string;
  status: 'sent' | 'scheduled' | 'draft';
  scheduledFor?: string;
}

export interface CityOverview {
  totalWards: number;
  severeRiskWards: number;
  highRiskWards: number;
  peopleAtSevereRisk: number;
  peopleAtHighOrSevereRisk: number;
  avgCitySurfaceTempC: number;
  hottestWard: { name: string; tempC: number; wardId: string };
  coolestWard: { name: string; tempC: number; wardId: string };
  activeAlertsCount: number;
  avgPowerStressIndex: number;
  totalPopulation: number;
  lastUpdated: string;
}

export interface GridDemandData {
  hourlyLabels: string[];
  totalDemandMW: number[];
  temperatureCurveC: number[];
  zoneDemand: {
    Central: number[];
    East: number[];
    West: number[];
    North: number[];
    South: number[];
  };
  peakHour: string;
  peakDemandMW: number;
  stressedSubstationsCount: number;
}

export interface AlertSubscription {
  name: string;
  mobile: string;
  wardId: string;
  language: 'en' | 'te' | 'hi';
  userType: 'resident' | 'outdoor_worker' | 'caregiver';
  channel: 'SMS' | 'WhatsApp' | 'both';
  createdAt: string;
}

export interface UserSession {
  isAuthenticated: boolean;
  user: {
    name: string;
    email: string;
    department: string;
    role: string;
    avatarUrl?: string;
  } | null;
}
