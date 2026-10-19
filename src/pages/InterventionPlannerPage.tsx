import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getWards, generatePlan, savePlan } from '../services/api';
import { InterventionType, RecommendedAction, Ward } from '../types';
import { useStore } from '../store/useStore';
import { generateOptimisedPlan, PlanOptimizationResult } from '../lib/interventions';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { formatCurrencyLakh, formatNumber } from '../lib/utils';
import { WardMap } from '../components/map/WardMap';
import {
  Sparkles,
  Sliders,
  Users,
  Thermometer,
  ShieldCheck,
  Check,
  Plus,
  Trash2,
  Bookmark,
  Split,
  Download,
  Share2,
  TreePine,
  Home,
  Umbrella,
  Droplets,
  Building,
  Radio,
  Wind,
  Loader2,
  CloudUpload,
} from 'lucide-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';

export const InterventionPlannerPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { addToPlan, planItems } = useStore();

  const { data: wards = [], isLoading } = useQuery({
    queryKey: ['wards'],
    queryFn: getWards,
  });

  // Top Controls State
  const [budgetLakh, setBudgetLakh] = useState<number>(150); // ₹150 Lakh default
  const [goal, setGoal] = useState<'people' | 'cooling' | 'vulnerable'>('people');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [allowedTypes, setAllowedTypes] = useState<InterventionType[]>([
    'cool_roofs',
    'tree_planting',
    'shade_shelters',
    'water_points',
    'cooling_centres',
    'misting_corridors',
    'early_warning',
  ]);

  // Current Generated Plan
  const [currentPlanResult, setCurrentPlanResult] = useState<PlanOptimizationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [cloudShortCode, setCloudShortCode] = useState<string | null>(null);

  // Plan A vs Plan B Saved State
  const [savedPlanA, setSavedPlanA] = useState<PlanOptimizationResult | null>(null);
  const [savedPlanB, setSavedPlanB] = useState<PlanOptimizationResult | null>(null);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  // Run Backend Optimization with Local Fallback
  const handleGeneratePlan = async () => {
    if (wards.length === 0) return;
    setIsGenerating(true);
    try {
      const apiGoal = goal === 'cooling' ? 'maximise_cooling' : goal === 'vulnerable' ? 'most_vulnerable_first' : 'maximise_people';
      const apiRes = await generatePlan({
        budgetInrLakh: budgetLakh,
        types: allowedTypes,
        goal: apiGoal,
        zone: zoneFilter === 'all' ? undefined : zoneFilter,
      });

      if (apiRes && (apiRes.items || apiRes.plan)) {
        const items = apiRes.items || apiRes.plan || [];
        const cost = apiRes.totals?.cost || 0;
        const result: PlanOptimizationResult = {
          plan: items,
          totalCost: cost,
          peopleProtected: apiRes.totals?.peopleProtected || 0,
          avgCooling: apiRes.totals?.avgCoolingC || 0,
          wardsCovered: apiRes.totals?.wardsCovered || 0,
        };
        setCurrentPlanResult(result);
        toast(
          'Plan Generated via Backend API',
          `Optimized ${result.plan.length} actions across ${result.wardsCovered} wards within ₹${budgetLakh}L budget.`,
          'success'
        );
        return;
      }
    } catch {
      // Graceful fallback to client-side optimization algorithm if offline
    } finally {
      setIsGenerating(false);
    }

    const fallbackResult = generateOptimisedPlan(wards, budgetLakh, allowedTypes, goal, zoneFilter);
    setCurrentPlanResult(fallbackResult);
    toast(
      'Plan Generated',
      `Optimized ${fallbackResult.plan.length} actions across ${fallbackResult.wardsCovered} wards within ₹${budgetLakh}L budget.`,
      'success'
    );
  };

  const handleSaveToCloud = async () => {
    if (!currentPlanResult) return;
    try {
      const res = await savePlan({
        name: `Heat Intervention Plan (${goal.toUpperCase()} - ₹${budgetLakh}L)`,
        items: currentPlanResult.plan,
        totals: {
          cost: currentPlanResult.totalCost,
          peopleProtected: currentPlanResult.peopleProtected,
          avgCoolingC: currentPlanResult.avgCooling,
          wardsCovered: currentPlanResult.wardsCovered,
        },
      });
      setCloudShortCode(res.shortCode);
      const shareUrl = `${window.location.origin}/planner?plan=${res.shortCode}`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast('Plan Saved to Server', `Persistent short code: ${res.shortCode}. Share URL copied!`, 'success');
      } else {
        toast('Plan Saved to Server', `Persistent short code: ${res.shortCode}`, 'success');
      }
    } catch (err: any) {
      toast('Save Failed', err.message || 'Could not persist plan to server', 'error');
    }
  };

  const toggleType = (type: InterventionType) => {
    setAllowedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSaveAsPlanA = () => {
    if (!currentPlanResult) return;
    setSavedPlanA(currentPlanResult);
    toast('Saved as Plan A', 'Baseline scenario saved.', 'success');
  };

  const handleSaveAsPlanB = () => {
    if (!currentPlanResult) return;
    setSavedPlanB(currentPlanResult);
    toast('Saved as Plan B', 'Alternative scenario saved.', 'success');
  };

  const handleAddAllToCart = () => {
    if (!currentPlanResult) return;
    let addedCount = 0;
    currentPlanResult.plan.forEach((item) => {
      const added = addToPlan(item);
      if (added) addedCount++;
    });
    toast('Added to Basket', `${addedCount} interventions transferred to your action basket.`, 'success');
  };

  // Extract wards that have interventions in the current plan for highlighting on the map
  const activePlanWardIds = useMemo(() => {
    if (!currentPlanResult) return [];
    return Array.from(new Set(currentPlanResult.plan.map((p) => p.wardId)));
  }, [currentPlanResult]);

  const mapWards = useMemo(() => {
    return wards.filter((w) => activePlanWardIds.length === 0 || activePlanWardIds.includes(w.id));
  }, [wards, activePlanWardIds]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white flex items-center gap-2">
            <span>Municipal Intervention Planner</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-800">
              Greedy Optimizer
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Algorithmic budget-constrained decision engine to maximize protected population or surface cooling benefit.
          </p>
        </div>

        {/* Plan A vs Plan B Buttons */}
        <div className="flex items-center gap-2">
          {savedPlanA && savedPlanB && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCompareModal(true)}
              className="text-xs gap-1.5 font-semibold"
            >
              <Split className="w-3.5 h-3.5" />
              <span>Compare Plan A vs Plan B</span>
            </Button>
          )}

          {currentPlanResult && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToCloud}
                className="text-xs gap-1 border-teal-500 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                title="Save plan to persistent cloud database and generate short link"
              >
                <CloudUpload className="w-3.5 h-3.5 text-teal-600" />
                <span>{cloudShortCode ? `Saved (${cloudShortCode})` : 'Save to Cloud'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAsPlanA}
                className="text-xs gap-1"
                title="Save current as Plan A"
              >
                <Bookmark className="w-3.5 h-3.5 text-teal-600" />
                <span>Save Plan A</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAsPlanB}
                className="text-xs gap-1"
                title="Save current as Plan B"
              >
                <Bookmark className="w-3.5 h-3.5 text-purple-600" />
                <span>Save Plan B</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Top Controls Card: Budget Slider, Goals, Zone & Checkboxes */}
      <Card className="p-5 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Budget Slider */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Municipal Resilience Budget:
              </span>
              <span className="font-extrabold text-base text-[#E4572E]">
                {formatCurrencyLakh(budgetLakh)}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={5}
              value={budgetLakh}
              onChange={(e) => setBudgetLakh(Number(e.target.value))}
              aria-label="Available Budget Slider in INR Lakh"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E4572E]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>₹10 Lakh</span>
              <span>₹250 Lakh</span>
              <span>₹500 Lakh</span>
            </div>
          </div>

          {/* Goal Selector */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Optimisation Goal:
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { id: 'people', label: 'Max People', icon: Users },
                { id: 'cooling', label: 'Max Cooling', icon: Thermometer },
                { id: 'vulnerable', label: 'Vulnerable First', icon: ShieldCheck },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id as any)}
                  className={`p-2 rounded-lg border font-semibold flex flex-col items-center justify-center text-center transition-all ${
                    goal === g.id
                      ? 'bg-orange-50 dark:bg-orange-950/40 border-[#E4572E] text-[#E4572E]'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <g.icon className="w-4 h-4 mb-1" />
                  <span className="text-[11px] leading-tight">{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Zone Filter & Action Button */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Zone Filter:
              </label>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="all">All City Zones (40 Wards)</option>
                <option value="Central">Central Zone (Old City & Downtown)</option>
                <option value="East">East Zone (Dilsukhnagar, LB Nagar, Uppal)</option>
                <option value="West">West Zone (Madhapur, Hitec, Gachibowli)</option>
                <option value="North">North Zone (Secunderabad, Jeedimetla)</option>
                <option value="South">South Zone (Charminar, Chandrayangutta)</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleGeneratePlan}
              disabled={isGenerating}
              className="w-full text-xs font-bold gap-2 shadow-md shadow-[#E4572E]/25 disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Computing Optimal Allocation...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Optimised Plan</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Intervention Types Checkbox Filter */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Permitted Intervention Types:
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { id: 'cool_roofs', label: 'Cool Roofs', icon: Home },
              { id: 'tree_planting', label: 'Tree Planting', icon: TreePine },
              { id: 'shade_shelters', label: 'Shade Shelters', icon: Umbrella },
              { id: 'water_points', label: 'Drinking Kiosks', icon: Droplets },
              { id: 'cooling_centres', label: 'Cooling Centres', icon: Building },
              { id: 'misting_corridors', label: 'Misting Lines', icon: Wind },
              { id: 'early_warning', label: 'Early Warnings', icon: Radio },
            ].map((item) => {
              const active = allowedTypes.includes(item.id as InterventionType);
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => toggleType(item.id as InterventionType)}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-800 dark:text-teal-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Output Section: Summary Bar + Prioritized Actions Table + Location Map */}
      {currentPlanResult ? (
        <div className="space-y-6 animate-slide-up">
          {/* Summary Bar */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Budget Committed</span>
              <span className="font-heading font-extrabold text-2xl text-[#E4572E]">
                {formatCurrencyLakh(currentPlanResult.totalCost)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                (Remaining: {formatCurrencyLakh(budgetLakh - currentPlanResult.totalCost)})
              </span>
            </div>

            <div className="p-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">People Protected</span>
              <span className="font-heading font-extrabold text-2xl text-emerald-400">
                {currentPlanResult.peopleProtected.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Direct beneficiaries</span>
            </div>

            <div className="p-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Average Cooling</span>
              <span className="font-heading font-extrabold text-2xl text-sky-400">
                -{currentPlanResult.avgCooling}°C
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Local microclimate drop</span>
            </div>

            <div className="p-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Wards Covered</span>
              <span className="font-heading font-extrabold text-2xl text-amber-400">
                {currentPlanResult.wardsCovered}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Targeted municipal units</span>
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Algorithm prioritized <strong>{currentPlanResult.plan.length}</strong> actions based on your &apos;{goal}&apos; goal.
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddAllToCart}
                className="text-xs font-semibold gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add All Actions to Basket</span>
              </Button>
            </div>
          </div>

          {/* Map & Table Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Table of Actions */}
            <div className="lg:col-span-7">
              <Card className="overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-base">Prioritised Intervention Schedule</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5">Rank</th>
                        <th className="px-3 py-2.5">Ward</th>
                        <th className="px-4 py-2.5">Action</th>
                        <th className="px-3 py-2.5">Cost</th>
                        <th className="px-3 py-2.5">Cooling</th>
                        <th className="px-3 py-2.5">People</th>
                        <th className="px-3 py-2.5 text-right">Basket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentPlanResult.plan.map((item, idx) => {
                        const inBasket = planItems.some((p) => p.id === item.id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-3 font-bold text-[#E4572E]">#{idx + 1}</td>
                            <td className="px-3 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {item.wardName}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold">{item.title}</div>
                              <div className="text-[10px] text-slate-500 line-clamp-1">{item.reason}</div>
                            </td>
                            <td className="px-3 py-3 font-bold text-[#E4572E]">
                              {formatCurrencyLakh(item.costLakhINR)}
                            </td>
                            <td className="px-3 py-3 font-semibold text-[#0F766E]">
                              -{item.coolingBenefitC}°C
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {item.peopleBenefited.toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button
                                size="sm"
                                variant={inBasket ? 'outline' : 'primary'}
                                onClick={() => addToPlan(item)}
                                className="h-6 px-2 text-[10px]"
                              >
                                {inBasket ? 'In Basket' : 'Add'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Spatial Location Map */}
            <div className="lg:col-span-5">
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500">
                    Spatial Action Distribution
                  </span>
                  <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                    {activePlanWardIds.length} target wards highlighted
                  </span>
                </div>
                <WardMap
                  wards={mapWards}
                  selectedWard={null}
                  onSelectWard={() => {}}
                  hideControls={true}
                  className="h-[460px]"
                />
              </Card>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State before Plan is generated */
        <Card className="p-16 text-center border-dashed">
          <Sparkles className="w-12 h-12 text-[#E4572E] mx-auto mb-3" />
          <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
            Ready to Generate Optimization Plan
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Choose your budget and priority above, then click &apos;Generate Optimised Plan&apos; to run the greedy allocation model across Hyderabad wards.
          </p>
          <Button variant="primary" size="sm" onClick={handleGeneratePlan} className="mt-4 text-xs font-semibold gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Plan (₹150 Lakh)</span>
          </Button>
        </Card>
      )}

      {/* Plan A vs Plan B Comparison Modal */}
      {showCompareModal && savedPlanA && savedPlanB && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-[#121C20] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="font-heading font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                  <Split className="w-5 h-5 text-[#E4572E]" />
                  <span>Strategic Scenario Comparison: Plan A vs Plan B</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Evaluate capital efficiency and population coverage between two policy options.</p>
              </div>
              <button onClick={() => setShowCompareModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Plan A Column */}
              <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-teal-900 dark:text-teal-200 uppercase tracking-wider">
                    Plan A (Baseline Scenario)
                  </h3>
                  <Badge variant="secondary">{savedPlanA.plan.length} Actions</Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span>Budget Utilized:</span>
                    <span className="font-extrabold text-[#E4572E]">{formatCurrencyLakh(savedPlanA.totalCost)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span>People Protected:</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{savedPlanA.peopleProtected.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span>Average Cooling Drop:</span>
                    <span className="font-extrabold text-[#0F766E]">-{savedPlanA.avgCooling}°C</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Wards Covered:</span>
                    <span className="font-bold">{savedPlanA.wardsCovered} wards</span>
                  </div>
                </div>
              </div>

              {/* Plan B Column */}
              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                    Plan B (Alternative Scenario)
                  </h3>
                  <Badge variant="outline">{savedPlanB.plan.length} Actions</Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span>Budget Utilized:</span>
                    <span className="font-extrabold text-[#E4572E]">{formatCurrencyLakh(savedPlanB.totalCost)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span>People Protected:</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{savedPlanB.peopleProtected.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span>Average Cooling Drop:</span>
                    <span className="font-extrabold text-[#0F766E]">-{savedPlanB.avgCooling}°C</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Wards Covered:</span>
                    <span className="font-bold">{savedPlanB.wardsCovered} wards</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowCompareModal(false)}>
                Close Comparison
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
