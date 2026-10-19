import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getGridDemand, getWards } from '../services/api';
import { Ward } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { ChartContainer } from '../components/ui/ChartContainer';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { WardMap } from '../components/map/WardMap';
import { formatNumber, formatCurrencyLakh } from '../lib/utils';
import {
  Zap,
  AlertTriangle,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Info,
  Building,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';

export const PowerGridView: React.FC = () => {
  const { t } = useTranslation();

  const { data: gridData, isLoading: gridLoading } = useQuery({
    queryKey: ['grid-demand'],
    queryFn: getGridDemand,
  });

  const { data: wards = [] } = useQuery({
    queryKey: ['wards'],
    queryFn: getWards,
  });

  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);

  // Top 10 wards by transformer overload risk
  const top10StressedWards = useMemo(() => {
    return [...wards]
      .sort((a, b) => b.peakDemandStressIndex - a.peakDemandStressIndex)
      .slice(0, 10);
  }, [wards]);

  // Hourly demand curve table data
  const hourlyDemandTableData = useMemo(() => {
    if (!gridData) return [];
    return gridData.hourlyLabels.map((label, i) => ({
      hour: label,
      totalMW: gridData.totalDemandMW[i],
      tempC: gridData.temperatureCurveC[i],
      isPeak: ['18:00', '20:00', '22:00'].includes(label),
    }));
  }, [gridData]);

  // Stacked Area zone chart data
  const zoneStackedData = useMemo(() => {
    if (!gridData) return [];
    return gridData.hourlyLabels.map((label, i) => ({
      hour: label,
      Central: gridData.zoneDemand.Central[i],
      East: gridData.zoneDemand.East[i],
      West: gridData.zoneDemand.West[i],
      North: gridData.zoneDemand.North[i],
      South: gridData.zoneDemand.South[i],
    }));
  }, [gridData]);

  // Scatter plot data correlating surface temp vs peak power demand
  const scatterData = useMemo(() => {
    return wards.map((w) => ({
      name: w.name,
      temp: w.landSurfaceTempC,
      demandMW: w.peakPowerDemandMW,
      stress: w.peakDemandStressIndex,
    }));
  }, [wards]);

  if (gridLoading || !gridData) {
    return <div className="h-96 flex items-center justify-center text-slate-400">Loading Power Grid Data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white flex items-center gap-2">
            <span>Peak Power-Demand Stress Monitor</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-300 dark:border-purple-800">
              DISCOM Grid Intelligence
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time correlation between extreme municipal heat and domestic/commercial AC electrical surges.
          </p>
        </div>
      </div>

      {/* Grid Status Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-purple-600 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>City Peak Demand</span>
            <Zap className="w-4 h-4 text-purple-600" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            {formatNumber(gridData.peakDemandMW)} <span className="text-xs font-normal text-slate-400">MW</span>
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
            Peak window: {gridData.peakHour}
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-rose-600 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Stressed Substations</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            {gridData.stressedSubstationsCount} <span className="text-xs font-normal text-slate-400">/ 84</span>
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
            Thermal overload risk &gt; 85%
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-teal-600 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>AC Cooling Load Share</span>
            <Activity className="w-4 h-4 text-teal-600" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            44.2%
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Of total city electrical draw during 8 PM peak</div>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#121C20] border-l-4 border-l-amber-600 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Demand-Response Potential</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mt-1">
            180 MW
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
            Via 24°C thermostat nudges & cool roofs
          </div>
        </Card>
      </div>

      {/* Main Charts: City Hourly Demand Curve + Zone Stacked Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Hourly Demand with Peak Highlight */}
        <ChartContainer
          title="24-Hour City Demand Curve & Temperature Tracking"
          description="High AC cooling creates peak evening stress window (18:00 - 22:00)."
          tableData={hourlyDemandTableData}
          tableColumns={[
            { header: 'Time', accessor: (d) => d.hour },
            { header: 'Demand (MW)', accessor: (d) => `${d.totalMW} MW` },
            { header: 'Temp (°C)', accessor: (d) => `${d.tempC}°C` },
            {
              header: 'Window',
              accessor: (d) => (d.isPeak ? 'Critical Evening Peak' : 'Standard'),
            },
          ]}
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyDemandTableData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <ReferenceArea x1="18:00" x2="22:00" stroke="#f43f5e" strokeOpacity={0.4} fill="#f43f5e" fillOpacity={0.08} />
                <Area type="monotone" dataKey="totalMW" stroke="#7c3aed" strokeWidth={2.5} fill="url(#powerGrad)" name="Demand (MW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        {/* Chart 2: Stacked Area by Zone */}
        <ChartContainer
          title="Hourly Electrical Load Breakdown by Municipal Zone"
          description="West Zone (IT corridor & high-rise apartments) dominates peak cooling draw."
          tableData={zoneStackedData}
          tableColumns={[
            { header: 'Hour', accessor: (d) => d.hour },
            { header: 'West (MW)', accessor: (d) => `${d.West} MW` },
            { header: 'Central (MW)', accessor: (d) => `${d.Central} MW` },
            { header: 'East (MW)', accessor: (d) => `${d.East} MW` },
            { header: 'North (MW)', accessor: (d) => `${d.North} MW` },
            { header: 'South (MW)', accessor: (d) => `${d.South} MW` },
          ]}
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={zoneStackedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Area type="monotone" dataKey="West" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.7} />
                <Area type="monotone" dataKey="Central" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.7} />
                <Area type="monotone" dataKey="North" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.7} />
                <Area type="monotone" dataKey="East" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.7} />
                <Area type="monotone" dataKey="South" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.7} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>

      {/* Spatial Map & Scatter Plot Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Map Layer showing Power Stress */}
        <div className="lg:col-span-7">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Peak Power Stress Index Map Layer
                </h3>
                <p className="text-xs text-slate-500">Purple shading indicates high AC power draw and local transformer tripping risk.</p>
              </div>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-950 px-2 py-1 rounded">
                Active Layer: Power Stress
              </span>
            </div>
            <WardMap
              wards={wards}
              selectedWard={selectedWard}
              onSelectWard={(w) => setSelectedWard(w)}
              hideControls={true}
              className="h-[440px]"
            />
          </Card>
        </div>

        {/* Link to Heat: Scatter Plot Correlation Card */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Correlation: Temperature vs Peak Power
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Every 1°C increase in daytime surface temperature drives an average <strong>4.2% increase</strong> in localized transformer demand due to sustained AC cooling.
            </p>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    dataKey="temp"
                    name="Surface Temp (°C)"
                    domain={[38, 48]}
                    tick={{ fontSize: 10 }}
                    unit="°C"
                  />
                  <YAxis
                    type="number"
                    dataKey="demandMW"
                    name="Peak Demand (MW)"
                    domain={[30, 110]}
                    tick={{ fontSize: 10 }}
                    unit=" MW"
                  />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Wards" data={scatterData} fill="#7c3aed" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 text-[11px] text-purple-900 dark:text-purple-300 leading-relaxed">
              <strong>Key Finding:</strong> Affluent high-AC wards (Banjara Hills, Jubilee Hills, Madhapur) generate extreme power stress despite lower demographic vulnerability. Cool roof retrofits reduce AC draw by up to 18%.
            </div>
          </Card>
        </div>
      </div>

      {/* Top 10 Wards by Overload Risk Table */}
      <Card className="p-5">
        <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white mb-1">
          Top 10 Wards by Feeder Overload Risk
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Recommended grid protection and demand-side management interventions for TSSPDCL / GHMC.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Rank</th>
                <th className="px-4 py-2.5">Ward Name</th>
                <th className="px-3 py-2.5">Zone</th>
                <th className="px-3 py-2.5">Stress Index</th>
                <th className="px-3 py-2.5">Peak Demand</th>
                <th className="px-3 py-2.5">Transformer Status</th>
                <th className="px-4 py-2.5">Recommended Grid Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {top10StressedWards.map((w, idx) => (
                <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-3 font-bold text-purple-600">#{idx + 1}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{w.name}</td>
                  <td className="px-3 py-3 text-slate-500">{w.zone}</td>
                  <td className="px-3 py-3 font-mono font-bold text-purple-700 dark:text-purple-300">
                    {w.peakDemandStressIndex}/100
                  </td>
                  <td className="px-3 py-3 font-semibold">{w.peakPowerDemandMW} MW</td>
                  <td className="px-3 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        w.transformerOverloadRisk === 'High'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {w.transformerOverloadRisk} Risk
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {w.peakDemandStressIndex > 85
                      ? 'Automated WhatsApp thermostat 24°C nudge + Cool roof subsidy'
                      : 'Shift flexible commercial chiller loads past 21:30 PM'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
