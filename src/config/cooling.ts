export const COOLING_ASSUMPTIONS = {
  // +10 percentage points tree cover: about -0.8 C surface temperature (0.08 C per 1%)
  treeCoverReductionPerPercentC: 0.08,

  // Cool roofs on 30% of buildings: about -1.0 C local air temperature (0.0333 C per 1%)
  coolRoofReductionPerPercentC: 0.0333,

  // Each shade shelter or water point reduces exposure risk score locally
  shadeShelterRiskScoreReduction: 0.6,
  waterPointRiskScoreReduction: 0.5,

  // Power demand reduction: ~1.8% to 2.5% AC power savings per degree C reduction in surface/ambient temperature
  powerDemandReductionPerDegreePercent: 2.2,

  disclaimer: 'Illustrative assumptions, to be validated with field data.',
};
