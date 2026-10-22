import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getWards, getCityOverview, getForecast, getGridDemand } from '../services/api';
import { Ward, RiskLevel, Zone } from '../types';
import { useStore } from '../store/useStore';
import { getWardRiskWithWeights, getRiskColor, getRiskLevel } from '../lib/risk';
import { WardMap } from '../components/map/WardMap';
import { RiskScoreGauge } from '../components/ui/RiskScoreGauge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { CountUp } from '../components/ui/CountUp';
import { useToast } from '../components/ui/Toast';
import {
  Flame,
  Users,
  Thermometer,
  Zap,
  Bell,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  TreePine,
  Building,
  Plus,
  Check,
  Send,
  Eye,
  Info,
} from 'lucide-react';
import { formatNumber, formatCurrencyLakh, formatTemp } from '../lib/utils';
import { generateWardInterventions } from '../lib/interventions';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    weights,
    tempUnit,
    language,
    selectedWardId,
    setSelectedWardId,
    addToPlan,
    planItems,
  } = useStore();

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [onlySevereHigh, setOnlySevereHigh] = useState<boolean>(false);
  const [minPop, setMinPop] = useState<number>(0);

  // Data fetching via TanStack Query
  const { data: wardsData = [], isLoading: wardsLoading } = useQuery({
    queryKey: ['wards'],
    queryFn: getWards,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['city-overview'],
    queryFn: getCityOverview,
  });

  const { data: liveWeather } = useQuery({
    queryKey: ['live-weather'],
    queryFn: getForecast,
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 15,
  });

  const { data: gridData, isLoading: gridLoading } = useQuery({
    queryKey: ['grid-demand'],
    queryFn: getGridDemand,
    staleTime: 1000 * 60 * 10,
  });

  // Dynamically recompute each ward's risk score and components using active weights
  const enrichedWards: Ward[] = useMemo(() => {
    return wardsData.map((ward) => {
      const riskCalc = getWardRiskWithWeights(ward, weights);
      return {
        ...ward,
        heatRiskScore: riskCalc.score,
        riskLevel: riskCalc.riskLevel,
      };
    });
  }, [wardsData, weights]);

  // Filtered wards for search and criteria
  const filteredWards = useMemo(() => {
    return enrichedWards.filter((ward) => {
      // Search filter across EN, TE, HI
      const matchesSearch =
        searchQuery === '' ||
        ward.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ward.nameTelugu.includes(searchQuery) ||
        ward.nameHindi.includes(searchQuery);

      const matchesZone = selectedZone === 'all' || ward.zone === selectedZone;
      const matchesRisk = selectedRisk === 'all' || ward.riskLevel === selectedRisk;
      const matchesSevereHigh = !onlySevereHigh || ward.riskLevel === 'Severe' || ward.riskLevel === 'High';
      const matchesPop = ward.population >= minPop;

      return matchesSearch && matchesZone && matchesRisk && matchesSevereHigh && matchesPop;
    });
  }, [enrichedWards, searchQuery, selectedZone, selectedRisk, onlySevereHigh, minPop]);

  // Selected ward
  const activeWard = useMemo(() => {
    if (!selectedWardId) return null;
    return enrichedWards.find((w) => w.id === selectedWardId) || null;
  }, [enrichedWards, selectedWardId]);

  // Top 5 priority wards sorted by dynamically weighted Heat-Risk Score
  const topPriorityWards = useMemo(() => {
    return [...enrichedWards].sort((a, b) => b.heatRiskScore - a.heatRiskScore).slice(0, 5);
  }, [enrichedWards]);

  // Aggregate KPI computations dynamically
  const kpiData = useMemo(() => {
    const severeCount = enrichedWards.filter((w) => w.riskLevel === 'Severe').length;
    const severeHighPeople = enrichedWards
      .filter((w) => w.riskLevel === 'Severe' || w.riskLevel === 'High')
      .reduce((acc, w) => acc + w.population, 0);

    const sortedByTemp = [...enrichedWards].sort((a, b) => b.landSurfaceTempC - a.landSurfaceTempC);
    const hottest = sortedByTemp[0] || null;

    const avgTemp =
      enrichedWards.length > 0
        ? Number((enrichedWards.reduce((acc, w) => acc + w.landSurfaceTempC, 0) / enrichedWards.length).toFixed(1))
        : null;

    return {
      severeCount,
      severeHighPeople,
      hottest,
      avgTemp,
    };
  }, [enrichedWards]);

  const getWardDisplayName = (w: Ward) => {
    if (language === 'te' && w.nameTelugu) return w.nameTelugu;
    if (language === 'hi' && w.nameHindi) return w.nameHindi;
    return w.name;
  };

  const activeWardInterventions = activeWard ? generateWardInterventions(activeWard).slice(0, 3) : [];

  const handleAddActionToPlan = (action: any) => {
    const added = addToPlan(action);
    if (added) {
      toast('Added to Action Plan', `${action.title} for ${action.wardName} added to your basket.`, 'success');
    } else {
      toast('Already in Plan', `${action.title} is already in your intervention basket.`, 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>Hyderabad Municipal Heat Risk Dashboard</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
              Live weather · sample ward layers
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Current weather comes from Open-Meteo. Ward heat-risk, surface temperature, vegetation and vulnerability layers are sample or proxy data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/planner')}
            className="text-xs gap-1.5"
          >
            <span>Open Planner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/alerts')}
            className="text-xs gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose Alert</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row (6 Cards with animated count-up & sparklines) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* KPI 1: Severe Risk Wards */}
        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-red-500 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Severe Wards</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            <CountUp end={kpiData.severeCount} />
            <span className="text-xs font-normal text-slate-400 ml-1">/ 40</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 mt-1.5 font-semibold">
            <TrendingUp className="w-3 h-3" />
            <span>+2 wards vs yesterday</span>
          </div>
        </Card>

        {/* KPI 2: High/Severe Population */}
        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-orange-500 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">At-Risk Citizens</span>
            <Users className="w-4 h-4 text-orange-500" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            <CountUp end={Number((kpiData.severeHighPeople / 100000).toFixed(1))} decimals={1} suffix="M" />
          </div>
          <div className="text-[10px] text-slate-500 mt-1.5 truncate">
            {formatNumber(kpiData.severeHighPeople)} exposed
          </div>
        </Card>

        {/* KPI 3: Hottest Ward */}
        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-rose-500 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hottest Ward (sample LST)</span>
            <Thermometer className="w-4 h-4 text-rose-500" />
          </div>
          <div className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white mt-1 truncate">
            {kpiData.hottest?.name ?? 'Unavailable'}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
            <span>{kpiData.hottest ? `Sample peak ${formatTemp(kpiData.hottest.landSurfaceTempC, tempUnit)}` : 'No ward sample available'}</span>
          </div>
        </Card>

        {/* KPI 4: Live ambient weather */}
        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-amber-500 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Live Air Temp</span>
            <Thermometer className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            {liveWeather?.current?.temperature_2m != null ? formatTemp(liveWeather.current.temperature_2m, tempUnit) : 'Unavailable'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1.5">{liveWeather?.current?.time ? `Weather model · ${liveWeather.current.time}` : liveWeather?.error || 'Waiting for live weather'}</div>
        </Card>

        {/* KPI 5: Active Alerts */}
        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-red-600 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Alerts</span>
            <Bell className="w-4 h-4 text-red-600" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            <CountUp end={overview?.activeAlertsCount ?? 0} />
          </div>
          <div className="text-[10px] text-red-600 dark:text-red-400 mt-1.5 font-semibold">Saved alert records</div>
        </Card>

        {/* KPI 6: Peak Power Stress */}
        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-purple-500 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Grid Stress</span>
            <Zap className="w-4 h-4 text-purple-600" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            {gridData ? `${gridData.stressedSubstationsCount} substations` : gridLoading ? 'Loading...' : 'Unavailable'}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-1.5 font-semibold">
            {gridData ? `Peak demand: ${Math.round(gridData.peakDemandMW)} MW @ ${gridData.peakHour}` : 'No live utility feed connected'}
          </div>
        </Card>
      </div>

      {/* Grid Demand Visualization */}
      {gridData && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <span>24-Hour Grid Demand & Temperature Profile</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Citywide aggregate demand curves with modelled temperature overlay. Peak stress at {gridData.peakHour}.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {gridData.stressedSubstationsCount} stressed substations
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gridData.hourlyLabels.map((label, i) => ({
                hour: label,
                demand: gridData.totalDemandMW[i] || 0,
                temp: gridData.temperatureCurveC[i] || 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    name === 'demand' ? `${val} MW` : `${val}°C`,
                    name === 'demand' ? 'Demand' : 'Temperature',
                  ]}
                />
                <Bar yAxisId="left" dataKey="demand" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="temp" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Search & Filters Toolbar */}
      <div className="p-3 bg-white dark:bg-[#121C20] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Ward Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ward (e.g. Charminar, చార్మినార్)..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E4572E] text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zone filter */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Zones</option>
            <option value="Central">Central Zone</option>
            <option value="East">East Zone</option>
            <option value="West">West Zone</option>
            <option value="North">North Zone</option>
            <option value="South">South Zone</option>
          </select>

          {/* Risk Level filter */}
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Risk Tiers</option>
            <option value="Severe">Severe (76-100)</option>
            <option value="High">High (51-75)</option>
            <option value="Moderate">Moderate (26-50)</option>
            <option value="Low">Low (0-25)</option>
          </select>

          {/* Severe & High toggle */}
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlySevereHigh}
              onChange={(e) => setOnlySevereHigh(e.target.checked)}
              className="rounded text-[#E4572E] focus:ring-[#E4572E]"
            />
            <span className="font-semibold text-rose-600 dark:text-rose-400">Severe & High Only</span>
          </label>
        </div>
      </div>

      {/* Main Content Area: Large Map (60%) + Details Panel (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Large Interactive Heat Map */}
        <div className="lg:col-span-7">
          <WardMap
            wards={filteredWards}
            selectedWard={activeWard}
            onSelectWard={(w) => setSelectedWardId(w.id)}
          />

          {/* Results count & clear selection indicator */}
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong>{filteredWards.length}</strong> of 40 wards
            </span>
            {selectedWardId && (
              <button
                onClick={() => setSelectedWardId(null)}
                className="text-[#E4572E] font-semibold hover:underline"
              >
                Clear Ward Selection (Show City Summary)
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Details Panel or City Summary */}
        <div className="lg:col-span-5 space-y-4">
          {activeWard ? (
            /* WARD SELECTED PANEL */
            <Card className="p-5 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800 shadow-md space-y-5 animate-slide-up">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                      {getWardDisplayName(activeWard)}
                    </h2>
                    <Badge variant="risk" riskLevel={activeWard.riskLevel}>
                      {activeWard.riskLevel}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeWard.zone} Zone • Population: {activeWard.population.toLocaleString('en-IN')} (
                    {activeWard.populationDensityPerSqKm.toLocaleString('en-IN')} / km²)
                  </p>
                </div>
                <button
                  onClick={() => setSelectedWardId(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Gauge & Key Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-5 flex justify-center">
                  <RiskScoreGauge score={activeWard.heatRiskScore} size="md" />
                </div>
                <div className="sm:col-span-7 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Peak Surface</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
                      {formatTemp(activeWard.landSurfaceTempC, tempUnit)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Night Temp</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
                      {formatTemp(activeWard.nightTempC, tempUnit)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Tree Canopy</span>
                    <span className="font-extrabold text-[#0F766E] text-base">
                      {activeWard.treeCoverPercent}%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Built-up</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
                      {activeWard.builtUpPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Driver Breakdown: Why this score? */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Top Risk Drivers:
                </span>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {activeWard.topDrivers.map((driver, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E4572E] mt-1.5 shrink-0" />
                      <span>{driver}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Demographic Vulnerability Breakdown */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Vulnerability Profile:
                </span>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span>Low-Income / Tin Roof Housing</span>
                      <span className="font-bold">{activeWard.vulnerability.lowIncomeHousingPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${activeWard.vulnerability.lowIncomeHousingPercent}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span>Outdoor & Gig Workers</span>
                      <span className="font-bold">{activeWard.vulnerability.outdoorWorkersPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${activeWard.vulnerability.outdoorWorkersPercent}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span>Households Without AC</span>
                      <span className="font-bold">{activeWard.vulnerability.noAirConditioningPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${activeWard.vulnerability.noAirConditioningPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommended Top Actions with Add to Plan */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Priority Interventions:
                </span>
                <div className="space-y-2">
                  {activeWardInterventions.map((action) => {
                    const isAdded = planItems.some((p) => p.id === action.id);
                    return (
                      <div
                        key={action.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs flex items-start justify-between gap-3"
                      >
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 dark:text-white">{action.title}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{action.description}</p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-semibold text-[#E4572E]">
                              {formatCurrencyLakh(action.costLakhINR)}
                            </span>
                            <span>•</span>
                            <span className="text-[#0F766E] font-semibold">-{action.coolingBenefitC}°C</span>
                            <span>•</span>
                            <span>{action.peopleBenefited.toLocaleString('en-IN')} people</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isAdded ? 'outline' : 'primary'}
                          onClick={() => handleAddActionToPlan(action)}
                          className="text-[11px] h-7 px-2.5 shrink-0 gap-1"
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail Navigation Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/wards/${activeWard.id}`)}
                  className="flex-1 text-xs gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Full Ward Details</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/alerts?ward=${activeWard.id}`)}
                  className="flex-1 text-xs gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Alert</span>
                </Button>
              </div>
            </Card>
          ) : (
            /* NO WARD SELECTED: CITY SUMMARY & TOP 5 PRIORITY WARDS */
            <Card className="p-5 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800 shadow-md space-y-5">
              <div>
                <h2 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                  Hyderabad City Thermal Summary
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any ward polygon on the map to inspect its diagnostic risk dial and recommendations.
                </p>
              </div>

              {/* Informative Alert box */}
              <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Info className="w-4 h-4 text-[#E4572E] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Active Heat Stress:</strong> 12 wards have crossed the Severe threshold (score &gt; 75). Immediate shaded water kiosks and reflective roof painting are prioritized for Old City & Industrial pockets.
                </p>
              </div>

              {/* Top 5 Priority Wards List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Top 5 Priority Wards
                  </span>
                  <button
                    onClick={() => navigate('/wards')}
                    className="text-xs text-[#E4572E] font-semibold hover:underline"
                  >
                    View All 40 →
                  </button>
                </div>

                <div className="space-y-2">
                  {topPriorityWards.map((ward, rank) => (
                    <button
                      key={ward.id}
                      onClick={() => setSelectedWardId(ward.id)}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 hover:border-[#E4572E]/40 text-left flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center">
                          #{rank + 1}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-[#E4572E] transition-colors">
                            {getWardDisplayName(ward)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {ward.zone} Zone • {formatTemp(ward.landSurfaceTempC, tempUnit)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span
                            className="font-heading font-extrabold text-sm block"
                            style={{ color: getRiskColor(ward.riskLevel) }}
                          >
                            {ward.heatRiskScore}/100
                          </span>
                          <span className="text-[10px] text-slate-400">{ward.riskLevel}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#E4572E] transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/wards')}
                  className="w-full text-xs font-semibold gap-1.5"
                >
                  <span>Explore Full Ward Ranking Table</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
