# HeatSense methodology and assumptions

## Risk score

The implementation matches `src/lib/risk.ts`. Each input uses the same fixed range as that file: surface temperature 34–48 C; tree cover 2–35%; built-up 30–95%; elderly share 2–20%; children under five 2–18%; low-income housing 5–75%; outdoor workers 5–45%; and households without AC 10–90%. Values are clamped to [0,1]. Vulnerability is the arithmetic mean of its five normalized factors. Score is 100 times the weighted sum of normalized temperature, tree-cover gap, built-up share and vulnerability. Weights are normalized by their total. Thresholds are Low through 25, Moderate through 50, High through 75, and Severe above 75.

## Data sources and quality

Current demo API values are copied from the existing UI fixtures, including approximate polygons and temperature curves. They are `sample`; no remote dataset has been ingested. The demographic vulnerability fields in those fixtures are proxies. Power load/stress is a modelled demo estimate. An air-temperature estimate in this dataset is not a sensor observation.

For a future satellite pipeline, Landsat thermal measurements require cloud/shadow/cirrus masking and the Collection 2 scale/offset. Landsat thermal pixels have approximately 100 m native resolution; resampling to 30 m does not create additional spatial detail. Landsat 8/9 combined revisit is roughly eight days. Surface temperature describes land skin temperature, not the 2 m air temperature people experience. MODIS night-time LST is a coarser proxy.

## Intervention and simulation assumptions

Cooling coefficients in `backend/app/config_cooling.py` are illustrative, not validated field effects. Examples include about 0.8 C surface-temperature reduction for a 10 percentage-point increase in tree cover and about 1 C local-air-temperature reduction for cool roofs on 30% of buildings. Water and shade access may lower exposure without changing ward-wide air temperature. Planner and simulator results are scenario estimates and must be reviewed against local feasibility and measured outcomes.

## Forecast and sensor validation

The current forecast is synthetic, and the current sensor-validation summary is a placeholder rather than an evaluated model. A future air-temperature model should be trained and reported against station and ground-sensor observations, with MAE, RMSE, sample count and training period. Weather inputs should be sourced from a documented station/API and stale values identified.
