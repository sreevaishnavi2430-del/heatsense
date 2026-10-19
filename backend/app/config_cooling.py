"""
Cooling Assumptions and Intervention Parameters

IMPORTANT HONESTY NOTE:
All cooling-benefit numbers and coefficients are illustrative assumptions
and must be validated with hyperlocal field measurements and meteorological data.
"""

COOLING_ASSUMPTIONS = {
    # +10 percentage points tree cover: about -0.8 C surface temperature (0.08 C per 1%)
    "tree_cover_reduction_per_percent_c": 0.08,

    # Cool roofs on 30% of buildings: about -1.0 C local air temperature (0.0333 C per 1%)
    "cool_roof_reduction_per_percent_c": 0.0333,

    # Each shade shelter or water point reduces exposure risk score locally
    "shade_shelter_risk_score_reduction": 0.6,
    "water_point_risk_score_reduction": 0.5,

    # Power demand reduction: ~1.8% to 2.5% AC power savings per degree C reduction in surface/ambient temperature
    "power_demand_reduction_per_degree_percent": 2.2,

    # Amenity benchmarks
    "benchmark_people_per_water_point": 2000,
    "benchmark_people_per_shade_shelter": 3000,

    "disclaimer": "Illustrative assumptions, to be validated with field data."
}

INTERVENTION_CATALOG = [
    {
        "type": "cool_roofs",
        "name": "Solar Reflective Cool Roof Coating",
        "description": "Apply high-albedo solar reflective white coating on 30% of tin/concrete roofs.",
        "cost_band": "Medium",
        "base_cost_lakh_inr": 20,
        "cooling_benefit_c": 1.0,
        "applies_when": {"min_built_up": 65, "min_low_income_or_no_ac": 35},
        "notes": "Illustrative assumption: reduces indoor ambient heat by up to 1.5°C."
    },
    {
        "type": "tree_planting",
        "name": "Targeted Urban Tree Canopy Expansion",
        "description": "Plant 1,200 native drought-tolerant shade trees along high-exposure road corridors.",
        "cost_band": "Medium",
        "base_cost_lakh_inr": 18,
        "cooling_benefit_c": 0.8,
        "applies_when": {"max_tree_cover": 20},
        "notes": "Illustrative assumption: mature canopy shades asphalt and lowers surface temperature."
    },
    {
        "type": "shade_shelters",
        "name": "Tension-Fabric Shade Shelters at Junctions",
        "description": "Erect UV-reflective tensile shade canopies at major auto/bus stops and vendor hubs.",
        "cost_band": "Low",
        "base_cost_lakh_inr": 8,
        "cooling_benefit_c": 0.4,
        "applies_when": {"min_outdoor_workers": 18, "max_shade_shelters": 4},
        "notes": "Direct radiant protection for transit users and gig workers."
    },
    {
        "type": "water_points",
        "name": "Chilled Drinking Water Kiosks",
        "description": "Install 4 solar-powered clean drinking water refilling points in busy commercial markets.",
        "cost_band": "Low",
        "base_cost_lakh_inr": 5,
        "cooling_benefit_c": 0.2,
        "applies_when": {"max_water_points": 5, "min_temp_c": 41.0},
        "notes": "Hydration prevents heat exhaustion and acute kidney injury."
    },
    {
        "type": "cooling_centres",
        "name": "Community Heat Refuge / Cooling Centre",
        "description": "Designate community hall or public library with backup solar air-conditioning and medical triage kit.",
        "cost_band": "Medium",
        "base_cost_lakh_inr": 18,
        "cooling_benefit_c": 1.2,
        "applies_when": {"min_elderly_or_children": 15},
        "notes": "Refuge for vulnerable residents lacking domestic cooling."
    },
    {
        "type": "misting_corridors",
        "name": "Evaporative Misting Spray Line",
        "description": "Install sensor-activated fine water droplet misting lines along pedestrian pathways.",
        "cost_band": "Medium",
        "base_cost_lakh_inr": 14,
        "cooling_benefit_c": 1.5,
        "applies_when": {"min_temp_c": 43.0},
        "notes": "Evaporative cooling for dense commercial and transit corridors."
    },
    {
        "type": "early_warning",
        "name": "Multi-Lingual Hyperlocal Heat Alerts & Outreach",
        "description": "Deploy ward-level SMS/WhatsApp broadcasts and field health volunteer announcements before peak hours.",
        "cost_band": "Low",
        "base_cost_lakh_inr": 3,
        "cooling_benefit_c": 0.1,
        "applies_when": {},
        "notes": "Behavioral nudge to avoid peak sun (12 PM - 4 PM)."
    }
]
