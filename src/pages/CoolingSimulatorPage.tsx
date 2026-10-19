import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getWards, runSimulation } from '../services/api';
import { Ward } from '../types';
import { useStore } from '../store/useStore';
import { COOLING_ASSUMPTIONS } from '../config/cooling';
import { calculateHeatRiskScore, getRiskColor, getRiskLevel } from '../lib/risk';
import { RiskScoreGauge } from '../components/ui/RiskScoreGauge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { MiniWardMap } from '../components/map/MiniWardMap';
import { formatCurrencyLakh, formatTemp } from '../lib/utils';
import {
  Sliders,
  TreePine,
  Home,
  Umbrella,
  Droplets,
  Zap,
  Users,
  AlertCircle,
  Plus,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export const CoolingSimulatorPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { weights, tempUnit, addToPlan } = useStore();

  const initialWardId = searchParams.get('ward') || 'charminar';

  const { data: wards = [], isLoading } = useQuery({
    queryKey: ['wards'],
    queryFn: getWards,
  });

  const [selectedWardId, setSelectedWardId] = useState<string>(initialWardId);

  // Simulation Sliders
  const [treeIncrease, setTreeIncrease] = useState<number>(10); // +10% pts
  const [coolRoofPercent, setCoolRoofPercent] = useState<number>(30); // 30% of roofs
  const [addedShelters, setAddedShelters] = useState<number>(6);
  const [addedWaterPoints, setAddedWaterPoints] = useState<number>(5);
  const [apiSimulationResult, setApiSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const currentWard = useMemo(() => {
    return wards.find((w) => w.id === selectedWardId) || wards[0] || null;
  }, [wards, selectedWardId]);

  useEffect(() => {
    let isCancelled = false;
    const fetchSimulation = async () => {
      if (!currentWard) return;
      setIsSimulating(true);
      try {
        const res = await runSimulation({
          wardId: currentWard.id,
          treeCoverIncreasePct: treeIncrease,
          coolRoofPct: coolRoofPercent,
          shadeSheltersAdded: addedShelters,
          waterPointsAdded: addedWaterPoints,
        });
        if (!isCancelled && res) {
          setApiSimulationResult(res);
        }
      } catch {
        // Fall back gracefully to local calculation
      } finally {
        if (!isCancelled) setIsSimulating(false);
      }
    };
    const timer = setTimeout(fetchSimulation, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [currentWard?.id, treeIncrease, coolRoofPercent, addedShelters, addedWaterPoints]);

  // Before baseline score
  const baselineCalc = useMemo(() => {
    if (!currentWard) return null;
    return calculateHeatRiskScore(
      currentWard.landSurfaceTempC,
      currentWard.treeCoverPercent,
      currentWard.builtUpPercent,
      currentWard.vulnerability,
      weights
    );
  }, [currentWard, weights]);

  // Simulation calculations using the specified config
  const simulationResults = useMemo(() => {
    if (!currentWard || !baselineCalc) return null;

    // Temperature reductions:
    // +10% tree cover -> -0.8°C (0.08°C per 1%)
    const treeCooling = treeIncrease * COOLING_ASSUMPTIONS.treeCoverReductionPerPercentC;
    // 30% cool roofs -> -1.0°C (0.0333°C per 1%)
    const roofCooling = coolRoofPercent * COOLING_ASSUMPTIONS.coolRoofReductionPerPercentC;
    const totalSurfaceCooling = Number((treeCooling + roofCooling).toFixed(2));

    const simulatedTemp = Number(Math.max(30, currentWard.landSurfaceTempC - totalSurfaceCooling).toFixed(1));
    const simulatedTreeCover = Math.min(60, currentWard.treeCoverPercent + treeIncrease);

    // Simulated new risk score
    const newRiskCalc = calculateHeatRiskScore(
      simulatedTemp,
      simulatedTreeCover,
      currentWard.builtUpPercent,
      currentWard.vulnerability,
      weights
    );

    // Direct risk score reduction from public hydration and shade amenities:
    const amenityBonus =
      addedShelters * COOLING_ASSUMPTIONS.shadeShelterRiskScoreReduction +
      addedWaterPoints * COOLING_ASSUMPTIONS.waterPointRiskScoreReduction;

    const finalSimulatedScore = Math.max(5, Math.round(newRiskCalc.score - amenityBonus));
    const finalSimulatedLevel = getRiskLevel(finalSimulatedScore);

    // Power Demand reduction:
    // ~2.2% reduction in peak AC load per degree C drop
    const percentPowerCut = (totalSurfaceCooling * COOLING_ASSUMPTIONS.powerDemandReductionPerDegreePercent) / 100;
    const powerSavedMW = Number((currentWard.peakPowerDemandMW * percentPowerCut).toFixed(2));
    const newPowerMW = Number((currentWard.peakPowerDemandMW - powerSavedMW).toFixed(2));

    // Estimated people moved to a safer tier
    const scoreDiff = baselineCalc.score - finalSimulatedScore;
    const peopleBenefited = Math.round(currentWard.population * Math.min(0.85, (scoreDiff / 100) * 1.8));

    return {
      baselineScore: baselineCalc.score,
      baselineLevel: baselineCalc.riskLevel,
      simulatedScore: finalSimulatedScore,
      simulatedLevel: finalSimulatedLevel,
      surfaceCoolingDrop: totalSurfaceCooling,
      newTemp: simulatedTemp,
      powerSavedMW,
      newPowerMW,
      peopleBenefited,
      scoreReduction: baselineCalc.score - finalSimulatedScore,
    };
  }, [currentWard, baselineCalc, treeIncrease, coolRoofPercent, addedShelters, addedWaterPoints, weights]);

  const handleResetSliders = () => {
    setTreeIncrease(0);
    setCoolRoofPercent(0);
    setAddedShelters(0);
    setAddedWaterPoints(0);
  };

  const handleAddScenarioToPlan = () => {
    if (!currentWard || !simulationResults) return;
    const cost = Math.round(treeIncrease * 1.5 + (coolRoofPercent / 10) * 4 + addedShelters * 1.2 + addedWaterPoints * 1.0);
    const action = {
      id: `${currentWard.id}-simulated-custom`,
      wardId: currentWard.id,
      wardName: currentWard.name,
      type: 'cool_roofs' as const,
      title: `Composite Cooling Package (${currentWard.name})`,
      description: `Package: +${treeIncrease}% canopy, ${coolRoofPercent}% cool roofs, ${addedShelters} shelters, ${addedWaterPoints} water kiosks.`,
      priorityScore: Math.min(99, Math.round(simulationResults.scoreReduction * 3)),
      costLakhINR: cost,
      costBand: cost > 30 ? ('High' as const) : ('Medium' as const),
      coolingBenefitC: simulationResults.surfaceCoolingDrop,
      peopleBenefited: simulationResults.peopleBenefited,
      reason: `Simulation projects -${simulationResults.surfaceCoolingDrop}°C cooling and moves ${simulationResults.peopleBenefited.toLocaleString('en-IN')} citizens to a safer tier.`,
    };

    addToPlan(action);
    toast('Scenario Added to Plan', `${action.title} added to your intervention basket.`, 'success');
  };

  const comparisonBarData = [
    {
      metric: 'Risk Score (/100)',
      Current: simulationResults?.baselineScore || 0,
      Simulated: simulationResults?.simulatedScore || 0,
    },
    {
      metric: 'Surface Temp (°C)',
      Current: currentWard?.landSurfaceTempC || 0,
      Simulated: simulationResults?.newTemp || 0,
    },
    {
      metric: 'Peak Power (MW)',
      Current: currentWard?.peakPowerDemandMW || 0,
      Simulated: simulationResults?.newPowerMW || 0,
    },
  ];

  if (!currentWard) return null;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white flex items-center gap-2">
            <span>What-If Urban Cooling Simulator</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#E4572E] font-bold border border-orange-300 dark:border-orange-800">
              Microclimate Modeler
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Test surface temperature drops, risk mitigation, and peak power grid savings before committing municipal capital.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetSliders}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Sliders</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddScenarioToPlan}
            className="text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scenario to Plan</span>
          </Button>
        </div>
      </div>

      {/* Policy Disclaimer Banner */}
      <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Planning Assumption Notice: </span>
            <span>{apiSimulationResult?.disclaimer || "Scenario results are illustrative planning estimates, not measured outcomes. Cooling-benefit figures are assumptions for planning."}</span>
          </div>
        </div>
        {isSimulating && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/40 text-[11px] font-semibold">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Computing...
          </span>
        )}
      </div>

      {/* Ward Selector Banner */}
      <Card className="p-4 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Select Ward to Simulate:
          </label>
          <select
            value={selectedWardId}
            onChange={(e) => setSelectedWardId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
          >
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.zone} Zone, {w.riskLevel} Risk)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span>Baseline LST: <strong>{currentWard.landSurfaceTempC}°C</strong></span>
          <span>Baseline Canopy: <strong>{currentWard.treeCoverPercent}%</strong></span>
          <span>Population: <strong>{currentWard.population.toLocaleString('en-IN')}</strong></span>
        </div>
      </Card>

      {/* Main Grid: Sliders on Left (45%), Simulation Outcome on Right (55%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Simulation Sliders */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 space-y-6">
            <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#E4572E]" />
              <span>Cooling Intervention Parameters</span>
            </h3>

            {/* Slider 1: Tree Canopy Expansion */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <TreePine className="w-4 h-4 text-[#0F766E]" />
                  Increase Tree Canopy:
                </span>
                <span className="font-extrabold text-[#0F766E] font-mono text-sm">
                  +{treeIncrease}% pts
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={treeIncrease}
                onChange={(e) => setTreeIncrease(Number(e.target.value))}
                aria-label="Increase Tree Canopy Slider"
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0F766E]"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0%</span>
                <span>Current: {currentWard.treeCoverPercent}%</span>
                <span>Max: +30%</span>
              </div>
            </div>

            {/* Slider 2: Cool Roofs % */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-sky-600" />
                  Buildings with Cool Roof Coating:
                </span>
                <span className="font-extrabold text-sky-600 font-mono text-sm">
                  {coolRoofPercent}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={coolRoofPercent}
                onChange={(e) => setCoolRoofPercent(Number(e.target.value))}
                aria-label="Cool Roof Percentage Slider"
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0%</span>
                <span>Target: 30%</span>
                <span>100% (Full Coverage)</span>
              </div>
            </div>

            {/* Slider 3: Shade Shelters */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Umbrella className="w-4 h-4 text-amber-500" />
                  Additional Shade Shelters:
                </span>
                <span className="font-extrabold text-amber-600 font-mono text-sm">
                  +{addedShelters} shelters
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={addedShelters}
                onChange={(e) => setAddedShelters(Number(e.target.value))}
                aria-label="Additional Shade Shelters Slider"
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0</span>
                <span>+10</span>
                <span>+20</span>
              </div>
            </div>

            {/* Slider 4: Clean Water Kiosks */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-teal-600" />
                  Additional Water Points:
                </span>
                <span className="font-extrabold text-teal-600 font-mono text-sm">
                  +{addedWaterPoints} kiosks
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                value={addedWaterPoints}
                onChange={(e) => setAddedWaterPoints(Number(e.target.value))}
                aria-label="Additional Water Kiosks Slider"
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0</span>
                <span>+12</span>
                <span>+25</span>
              </div>
            </div>
          </Card>

          {/* Scientific Disclaimer Note as mandated by prompt */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="leading-relaxed">
              <strong>{COOLING_ASSUMPTIONS.disclaimer}</strong> Model assumes -0.8°C surface drop per +10% canopy, -1.0°C per 30% cool roofs, and ~2.2% AC power savings per degree reduction.
            </p>
          </div>
        </div>

        {/* Right: Before vs After Display & Visual Metrics */}
        <div className="lg:col-span-7 space-y-6">
          {simulationResults && (
            <>
              {/* Side-by-Side Before / After Gauges */}
              <Card className="p-6">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-4 text-center">
                  Live Heat-Risk Score Shift: Before vs Simulated
                </h3>

                <div className="grid grid-cols-2 gap-6 items-center">
                  {/* Current Baseline */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex flex-col items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Current Baseline
                    </span>
                    <RiskScoreGauge score={simulationResults.baselineScore} size="md" />
                    <span className="text-xs font-semibold text-slate-500 mt-2">
                      LST: {currentWard.landSurfaceTempC}°C
                    </span>
                  </div>

                  {/* Simulated Outcome */}
                  <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 flex flex-col items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 mb-2">
                      Simulated Outcome
                    </span>
                    <RiskScoreGauge score={simulationResults.simulatedScore} size="md" />
                    <span className="text-xs font-semibold text-[#0F766E] mt-2">
                      New LST: {simulationResults.newTemp}°C (-{simulationResults.surfaceCoolingDrop}°C)
                    </span>
                  </div>
                </div>

                {/* Simulated Outcome KPIs */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3 text-center">
                  <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Risk Reduction</span>
                    <span className="font-heading font-extrabold text-xl text-[#E4572E]">
                      -{simulationResults.scoreReduction} pts
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">People De-escalated</span>
                    <span className="font-heading font-extrabold text-xl text-[#0F766E]">
                      {simulationResults.peopleBenefited.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Peak AC Power Saved</span>
                    <span className="font-heading font-extrabold text-xl text-purple-600">
                      {simulationResults.powerSavedMW} MW
                    </span>
                  </div>
                </div>
              </Card>

              {/* Comparative Bar Chart */}
              <Card className="p-5">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3">
                  Key Metrics Comparison
                </h4>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                      <Bar dataKey="Current" fill="#D7263D" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Simulated" fill="#0F766E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
