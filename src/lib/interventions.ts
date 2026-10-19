import { InterventionType, RecommendedAction, Ward, CostBand } from '../types';
import { COOLING_ASSUMPTIONS } from '../config/cooling';

export interface PlanOptimizationResult {
  plan: RecommendedAction[];
  totalCost: number;
  peopleProtected: number;
  avgCooling: number;
  wardsCovered: number;
}

/**
 * Generates ranked recommended interventions for a specific ward
 */
export function generateWardInterventions(ward: Ward): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  // 1. Cool Roofs (High built-up, low AC or tin roofs)
  if (ward.builtUpPercent > 65 || ward.vulnerability.lowIncomeHousingPercent > 35) {
    const cost = Math.round(15 + (ward.builtUpPercent / 100) * 20);
    const cooling = Number((0.8 + (ward.builtUpPercent / 100) * 0.7).toFixed(1));
    const people = Math.round(ward.population * 0.18);
    const priority = Math.min(98, Math.round(ward.heatRiskScore * 0.95 + ward.vulnerability.lowIncomeHousingPercent * 0.15));

    actions.push({
      id: `${ward.id}-cool-roofs`,
      wardId: ward.id,
      wardName: ward.name,
      type: 'cool_roofs',
      title: 'Solar Reflective Cool Roof Coating',
      description: 'Apply high-albedo solar reflective white coating on 30% of tin/concrete roofs.',
      priorityScore: priority,
      costLakhINR: cost,
      costBand: cost > 30 ? 'High' : 'Medium',
      coolingBenefitC: cooling,
      peopleBenefited: people,
      reason: `High built-up density (${ward.builtUpPercent}%) and low AC penetration (${ward.vulnerability.noAirConditioningPercent}%) make cool roofs the fastest indoor heat mitigator.`,
    });
  }

  // 2. Tree Planting & Micro-Forests (Low tree cover)
  if (ward.treeCoverPercent < 20) {
    const cost = Math.round(12 + (30 - ward.treeCoverPercent) * 1.2);
    const cooling = Number((0.6 + (25 - ward.treeCoverPercent) * 0.04).toFixed(1));
    const people = Math.round(ward.population * 0.22);
    const priority = Math.min(95, Math.round(ward.heatRiskScore * 0.9 + (25 - ward.treeCoverPercent) * 1.5));

    actions.push({
      id: `${ward.id}-tree-planting`,
      wardId: ward.id,
      wardName: ward.name,
      type: 'tree_planting',
      title: 'Targeted Urban Tree Canopy Expansion',
      description: 'Plant 1,200 native drought-tolerant shade trees along high-exposure road corridors.',
      priorityScore: priority,
      costLakhINR: cost,
      costBand: cost > 30 ? 'High' : 'Medium',
      coolingBenefitC: cooling,
      peopleBenefited: people,
      reason: `Critically low canopy cover (${ward.treeCoverPercent}%) leaves walking commuters and residences exposed to solar radiation.`,
    });
  }

  // 3. Shade Shelters at Transit & Junctions (High outdoor workers)
  if (ward.vulnerability.outdoorWorkersPercent > 18 || ward.amenities.shadeShelters < 4) {
    const cost = 8;
    const cooling = 0.4;
    const people = Math.round(ward.population * (ward.vulnerability.outdoorWorkersPercent / 100) * 1.5);
    const priority = Math.min(94, Math.round(ward.vulnerability.outdoorWorkersPercent * 2 + ward.heatRiskScore * 0.3));

    actions.push({
      id: `${ward.id}-shade-shelters`,
      wardId: ward.id,
      wardName: ward.name,
      type: 'shade_shelters',
      title: 'Tension-Fabric Shade Shelters at Junctions',
      description: 'Erect UV-reflective tensile shade canopies at major auto/bus stops and vendor hubs.',
      priorityScore: priority,
      costLakhINR: cost,
      costBand: 'Low',
      coolingBenefitC: cooling,
      peopleBenefited: people,
      reason: `${ward.vulnerability.outdoorWorkersPercent}% outdoor workers face extreme midday radiant heat with only ${ward.amenities.shadeShelters} existing shelters.`,
    });
  }

  // 4. Drinking Water Kiosks / RO Points
  if (ward.amenities.waterPoints < 5 || ward.landSurfaceTempC > 41) {
    const cost = 5;
    const cooling = 0.2;
    const people = Math.round(ward.population * 0.15);
    const priority = Math.min(96, Math.round(ward.landSurfaceTempC * 1.8 + (10 - ward.amenities.waterPoints) * 2));

    actions.push({
      id: `${ward.id}-water-points`,
      wardId: ward.id,
      wardName: ward.name,
      type: 'water_points',
      title: 'Chilled Drinking Water Kiosks',
      description: 'Install 4 solar-powered clean drinking water refilling points in busy commercial markets.',
      priorityScore: priority,
      costLakhINR: cost,
      costBand: 'Low',
      coolingBenefitC: cooling,
      peopleBenefited: people,
      reason: `Peak surface temperature reaches ${ward.landSurfaceTempC}°C; hydration access is essential to prevent heat stroke.`,
    });
  }

  // 5. Emergency Cooling Centres (High elderly & children)
  if (ward.vulnerability.elderlyPercent > 8 || ward.vulnerability.childrenUnder5Percent > 9) {
    const cost = 18;
    const cooling = 1.2;
    const people = Math.round(ward.population * 0.12);
    const priority = Math.min(92, Math.round((ward.vulnerability.elderlyPercent + ward.vulnerability.childrenUnder5Percent) * 3 + ward.heatRiskScore * 0.3));

    actions.push({
      id: `${ward.id}-cooling-centres`,
      wardId: ward.id,
      wardName: ward.name,
      type: 'cooling_centres',
      title: 'Community Heat Refuge / Cooling Centre',
      description: 'Designate community hall or public library with backup solar air-conditioning and medical triage kit.',
      priorityScore: priority,
      costLakhINR: cost,
      costBand: 'Medium',
      coolingBenefitC: cooling,
      peopleBenefited: people,
      reason: `${ward.vulnerability.elderlyPercent}% elderly and ${ward.vulnerability.childrenUnder5Percent}% young children have high physiological heat vulnerability.`,
    });
  }

  // 6. Misting Corridor / High-Pressure Spray
  if (ward.landSurfaceTempC >= 43) {
    const cost = 14;
    const cooling = 1.5;
    const people = Math.round(ward.population * 0.10);
    const priority = Math.min(88, Math.round(ward.landSurfaceTempC * 1.5 + ward.builtUpPercent * 0.2));

    actions.push({
      id: `${ward.id}-misting`,
      wardId: ward.id,
      wardName: ward.name,
      type: 'misting_corridors',
      title: 'Evaporative Misting Spray Line',
      description: 'Install sensor-activated fine water droplet misting lines along pedestrian pathways.',
      priorityScore: priority,
      costLakhINR: cost,
      costBand: 'Medium',
      coolingBenefitC: cooling,
      peopleBenefited: people,
      reason: `Surface temp spikes to ${ward.landSurfaceTempC}°C; evaporative cooling lowers ambient pedestrian temp by up to 1.5°C during peak hours.`,
    });
  }

  // 7. Early Warning & Grassroots Worker Outreach
  const earlyCost = 3;
  const earlyPeople = Math.round(ward.population * 0.45);
  actions.push({
    id: `${ward.id}-early-warning`,
    wardId: ward.id,
    wardName: ward.name,
    type: 'early_warning',
    title: 'Multi-Lingual Hyperlocal Heat Alerts & Outreach',
    description: 'Deploy ward-level SMS/WhatsApp broadcasts and field health volunteer announcements before peak hours.',
    priorityScore: Math.min(90, Math.round(ward.heatRiskScore * 0.85 + 10)),
    costLakhINR: earlyCost,
    costBand: 'Low',
    coolingBenefitC: 0.1,
    peopleBenefited: earlyPeople,
    reason: `Cost-effective behavior-change intervention alerting ${earlyPeople.toLocaleString()} residents and gig workers.`,
  });

  // Sort descending by priorityScore
  return actions.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Greedy budget-constrained plan optimizer for /planner
 */
export function generateOptimisedPlan(
  wards: Ward[],
  budgetLakh: number,
  allowedTypes: InterventionType[],
  goal: 'people' | 'cooling' | 'vulnerable',
  zoneFilter: string = 'all'
): PlanOptimizationResult {
  // 1. Gather all candidates
  const candidates: RecommendedAction[] = [];
  const filteredWards = zoneFilter === 'all' ? wards : wards.filter((w) => w.zone === zoneFilter);

  filteredWards.forEach((ward) => {
    const wardActions = generateWardInterventions(ward);
    wardActions.forEach((act) => {
      if (allowedTypes.includes(act.type)) {
        candidates.push(act);
      }
    });
  });

  // 2. Score candidates according to optimization goal
  const scored = candidates.map((item) => {
    let metricRatio = 0;
    const cost = Math.max(1, item.costLakhINR);

    if (goal === 'people') {
      // People protected per lakh INR
      metricRatio = item.peopleBenefited / cost;
    } else if (goal === 'cooling') {
      // Degrees C cooling benefit per lakh INR
      metricRatio = (item.coolingBenefitC * 1000) / cost;
    } else {
      // Vulnerability & Risk priority
      metricRatio = (item.priorityScore * 100) / cost;
    }

    return { item, metricRatio };
  });

  // 3. Sort by efficiency ratio descending
  scored.sort((a, b) => b.metricRatio - a.metricRatio);

  // 4. Greedy selection within budget
  let remainingBudget = budgetLakh;
  const chosenPlan: RecommendedAction[] = [];
  const chosenWardSet = new Set<string>();

  for (const entry of scored) {
    if (entry.item.costLakhINR <= remainingBudget) {
      // Prevent duplicate intervention of identical type in same ward
      const alreadyHas = chosenPlan.some(
        (p) => p.wardId === entry.item.wardId && p.type === entry.item.type
      );
      if (!alreadyHas) {
        chosenPlan.push(entry.item);
        remainingBudget -= entry.item.costLakhINR;
        chosenWardSet.add(entry.item.wardId);
      }
    }
  }

  const totalCost = chosenPlan.reduce((acc, cur) => acc + cur.costLakhINR, 0);
  const peopleProtected = chosenPlan.reduce((acc, cur) => acc + cur.peopleBenefited, 0);
  const avgCooling =
    chosenPlan.length > 0
      ? Number((chosenPlan.reduce((acc, cur) => acc + cur.coolingBenefitC, 0) / chosenPlan.length).toFixed(2))
      : 0;

  return {
    plan: chosenPlan,
    totalCost,
    peopleProtected,
    avgCooling,
    wardsCovered: chosenWardSet.size,
  };
}
