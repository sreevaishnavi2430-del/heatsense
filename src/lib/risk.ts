import { RiskLevel, RiskWeights, VulnerabilityData, Ward } from '../types';
import { DEFAULT_WEIGHTS } from '../config';

/**
 * Normalises a value between min and max into [0, 1]
 */
export function normalise(val: number, min: number, max: number): number {
  if (max === min) return 0;
  const clamped = Math.max(min, Math.min(max, val));
  return (clamped - min) / (max - min);
}

/**
 * Computes vulnerability index (0 to 1) from the 5 demographic factors
 */
export function computeVulnerabilityIndex(v: VulnerabilityData): number {
  const normElderly = normalise(v.elderlyPercent, 2, 20);
  const normChildren = normalise(v.childrenUnder5Percent, 2, 18);
  const normLowIncome = normalise(v.lowIncomeHousingPercent, 5, 75);
  const normOutdoor = normalise(v.outdoorWorkersPercent, 5, 45);
  const normNoAC = normalise(v.noAirConditioningPercent, 10, 90);

  return (normElderly + normChildren + normLowIncome + normOutdoor + normNoAC) / 5;
}

/**
 * Computes Heat-Risk Score (0 - 100) using custom or default weights:
 * score = wTemp * normalisedTemp + wTree * (1 - normalisedTreeCover) + wBuilt * normalisedBuiltUp + wVuln * vulnerabilityIndex
 */
export function calculateHeatRiskScore(
  landSurfaceTempC: number,
  treeCoverPercent: number,
  builtUpPercent: number,
  vulnerability: VulnerabilityData,
  weights: RiskWeights = DEFAULT_WEIGHTS
): {
  score: number;
  riskLevel: RiskLevel;
  components: {
    tempComponent: number;
    treeComponent: number;
    builtComponent: number;
    vulnComponent: number;
  };
} {
  const normTemp = normalise(landSurfaceTempC, 34, 48);
  const normTree = normalise(treeCoverPercent, 2, 35);
  const normBuilt = normalise(builtUpPercent, 30, 95);
  const vulnIdx = computeVulnerabilityIndex(vulnerability);

  // Normalize weights to sum to 1 in case of precision anomalies
  const totalWeight = weights.wTemp + weights.wTree + weights.wBuilt + weights.wVuln || 1;
  const wt = weights.wTemp / totalWeight;
  const wTr = weights.wTree / totalWeight;
  const wb = weights.wBuilt / totalWeight;
  const wv = weights.wVuln / totalWeight;

  const tempComp = wt * normTemp;
  const treeComp = wTr * (1 - normTree);
  const builtComp = wb * normBuilt;
  const vulnComp = wv * vulnIdx;

  const rawScore = (tempComp + treeComp + builtComp + vulnComp) * 100;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    score,
    riskLevel: getRiskLevel(score),
    components: {
      tempComponent: Math.round(tempComp * 100),
      treeComponent: Math.round(treeComp * 100),
      builtComponent: Math.round(builtComp * 100),
      vulnComponent: Math.round(vulnComp * 100),
    },
  };
}

/**
 * Recomputes ward score dynamically given current weights
 */
export function getWardRiskWithWeights(ward: Ward, weights: RiskWeights): {
  score: number;
  riskLevel: RiskLevel;
  components: {
    tempComponent: number;
    treeComponent: number;
    builtComponent: number;
    vulnComponent: number;
  };
} {
  return calculateHeatRiskScore(
    ward.landSurfaceTempC,
    ward.treeCoverPercent,
    ward.builtUpPercent,
    ward.vulnerability,
    weights
  );
}

/**
 * Returns RiskLevel based on 0-100 score
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'Low';
  if (score <= 50) return 'Moderate';
  if (score <= 75) return 'High';
  return 'Severe';
}

/**
 * Returns color hex code for RiskLevel
 */
export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'Low':
      return '#2E9E6B'; // green
    case 'Moderate':
      return '#F2C94C'; // yellow
    case 'High':
      return '#F2994A'; // orange
    case 'Severe':
      return '#D7263D'; // red
  }
}

/**
 * Returns color hex code for Alert Level
 */
export function getAlertColor(level: string): string {
  switch (level) {
    case 'Green':
      return '#2E9E6B';
    case 'Yellow':
      return '#F2C94C';
    case 'Orange':
      return '#F2994A';
    case 'Red':
      return '#D7263D';
    default:
      return '#6B7280';
  }
}

/**
 * Returns accessible text description for screen readers and labels
 */
export function getRiskDescription(level: RiskLevel): string {
  switch (level) {
    case 'Low':
      return 'Low Heat Risk: Normal city summer conditions. Stay hydrated.';
    case 'Moderate':
      return 'Moderate Heat Risk: High temperatures. Children and elderly should limit midday outdoor exposure.';
    case 'High':
      return 'High Heat Risk: Severe thermal stress. Outdoor workers need mandatory shade breaks and water.';
    case 'Severe':
      return 'Severe Heat Risk: Dangerous heat-wave. Immediate city action and cooling interventions required.';
  }
}
