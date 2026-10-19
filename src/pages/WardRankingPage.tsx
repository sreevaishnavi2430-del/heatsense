import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getWards } from '../services/api';
import { Ward, RiskLevel, Zone } from '../types';
import { useStore } from '../store/useStore';
import { getWardRiskWithWeights, getRiskColor } from '../lib/risk';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import {
  Search,
  Filter,
  Download,
  Eye,
  Send,
  Plus,
  Check,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  Split,
  TreePine,
  Thermometer,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { formatNumber, formatCurrencyLakh, formatTemp } from '../lib/utils';
import { generateWardInterventions } from '../lib/interventions';
import Papa from 'papaparse';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

export const WardRankingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    weights,
    tempUnit,
    language,
    addToPlan,
    planItems,
    compareWardIds,
    toggleCompareWard,
    clearCompare,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof Ward | 'vulnerabilityPct'>('heatRiskScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    zone: true,
    temp: true,
    tree: true,
    pop: true,
    vuln: true,
    power: true,
    driver: true,
  });
  const [colModalOpen, setColModalOpen] = useState(false);
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);

  const { data: wardsData = [], isLoading, isFetching, refetch, dataUpdatedAt, error } = useQuery({
    queryKey: ['wards'],
    queryFn: getWards,
    staleTime: 0,
  });

  // Recompute scores dynamically with active weights
  const enrichedWards = useMemo(() => {
    return wardsData.map((ward) => {
      const riskCalc = getWardRiskWithWeights(ward, weights);
      return {
        ...ward,
        heatRiskScore: riskCalc.score,
        riskLevel: riskCalc.riskLevel,
      };
    });
  }, [wardsData, weights]);

  // Filter & Sort
  const processedWards = useMemo(() => {
    let list = enrichedWards.filter((w) => {
      const matchesSearch =
        searchQuery === '' ||
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.nameTelugu.includes(searchQuery) ||
        w.nameHindi.includes(searchQuery);

      const matchesZone = selectedZone === 'all' || w.zone === selectedZone;
      const matchesRisk = selectedRisk === 'all' || w.riskLevel === selectedRisk;
      return matchesSearch && matchesZone && matchesRisk;
    });

    list.sort((a, b) => {
      let valA: any = a[sortField as keyof Ward];
      let valB: any = b[sortField as keyof Ward];

      if (sortField === 'vulnerabilityPct') {
        valA = a.vulnerability.lowIncomeHousingPercent + a.vulnerability.outdoorWorkersPercent;
        valB = b.vulnerability.lowIncomeHousingPercent + b.vulnerability.outdoorWorkersPercent;
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [enrichedWards, searchQuery, selectedZone, selectedRisk, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedWards.length / pageSize);
  useEffect(() => {
    setPage((current) => Math.max(1, Math.min(current, totalPages || 1)));
  }, [totalPages]);
  const paginatedWards = processedWards.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: keyof Ward | 'vulnerabilityPct') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExportCSV = () => {
    const csvRows = processedWards.map((w, index) => ({
      Rank: index + 1,
      Ward_Name: w.name,
      Zone: w.zone,
      Heat_Risk_Score: w.heatRiskScore,
      Risk_Level: w.riskLevel,
      Day_Surface_Temp_C: w.landSurfaceTempC,
      Current_Air_Temp_C: w.currentWeather?.temperatureC ?? '',
      Night_Temp_C: w.nightTempC,
      Tree_Cover_Percent: w.treeCoverPercent,
      Built_Up_Percent: w.builtUpPercent,
      Population: w.population,
      Density_SqKm: w.populationDensityPerSqKm,
      Outdoor_Workers_Percent: w.vulnerability.outdoorWorkersPercent,
      Low_Income_Housing_Percent: w.vulnerability.lowIncomeHousingPercent,
      No_AC_Percent: w.vulnerability.noAirConditioningPercent,
      Peak_Demand_MW: w.peakPowerDemandMW,
      Primary_Driver: w.topDrivers?.[0] || '',
    }));

    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Hyderabad-Ward-Heat-Rankings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast('CSV Exported', 'Downloaded complete ward ranking dataset.', 'success');
  };

  const getWardDisplayName = (w: Ward) => {
    if (language === 'te' && w.nameTelugu) return w.nameTelugu;
    if (language === 'hi' && w.nameHindi) return w.nameHindi;
    return w.name;
  };

  // Compare wards data for radar chart
  const comparedWards = useMemo(() => {
    return enrichedWards.filter((w) => compareWardIds.includes(w.id));
  }, [enrichedWards, compareWardIds]);

  const radarData = useMemo(() => {
    if (comparedWards.length === 0) return [];
    const axes = [
      { key: 'temp', label: 'Surface Heat', calc: (w: Ward) => Math.min(100, (w.landSurfaceTempC / 48) * 100) },
      { key: 'canopy', label: 'Canopy Deficit', calc: (w: Ward) => Math.max(0, 100 - w.treeCoverPercent * 3) },
      { key: 'built', label: 'Built Density', calc: (w: Ward) => w.builtUpPercent },
      { key: 'vuln', label: 'Vulnerability', calc: (w: Ward) => (w.vulnerability.lowIncomeHousingPercent + w.vulnerability.outdoorWorkersPercent) / 1.2 },
      { key: 'power', label: 'Power Stress', calc: (w: Ward) => w.peakDemandStressIndex },
    ];

    return axes.map((axis) => {
      const entry: any = { subject: axis.label };
      comparedWards.forEach((w) => {
        entry[w.name] = Math.round(axis.calc(w));
      });
      return entry;
    });
  }, [comparedWards]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Ward Heat-Risk Rankings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Ranked hierarchy of all 40 Hyderabad localities with diagnostic indicators and compare mode.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="text-xs gap-1.5"
            title="Reload ward data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Reloading' : 'Reload'}</span>
          </Button>
          {compareWardIds.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCompareDrawerOpen(true)}
              className="text-xs gap-1.5 font-semibold"
            >
              <Split className="w-3.5 h-3.5" />
              <span>Compare ({compareWardIds.length}/3)</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setColModalOpen(true)}
            className="text-xs gap-1.5"
            title="Toggle Columns"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Columns</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs gap-1.5"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
          Could not refresh ward data. Showing the last successfully loaded results. Please check the API connection and retry.
        </div>
      )}
      {isLoading && (
        <div role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-[#121C20]">
          Loading ward rankings from the API…
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <Card className="p-4 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by ward name (Charminar, ఉప్పల్, कुकटपल्ली)..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedZone}
              onChange={(e) => {
                setSelectedZone(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="all">All Zones</option>
              <option value="Central">Central</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="North">North</option>
              <option value="South">South</option>
            </select>

            <select
              value={selectedRisk}
              onChange={(e) => {
                setSelectedRisk(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="all">All Risk Levels</option>
              <option value="Severe">Severe Risk</option>
              <option value="High">High Risk</option>
              <option value="Moderate">Moderate Risk</option>
              <option value="Low">Low Risk</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Sortable Table */}
      <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
        {dataUpdatedAt > 0 && (
          <div className="border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800">
            Ward data last loaded: {new Date(dataUpdatedAt).toLocaleString()}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800 select-none">
              <tr>
                <th scope="col" className="px-3 py-3 w-10 text-center">
                  Compare
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort('heatRiskScore')}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Rank</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Ward Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                {visibleColumns.zone && <th scope="col" className="px-3 py-3">Zone</th>}
                <th
                  scope="col"
                  onClick={() => handleSort('heatRiskScore')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk Score</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th scope="col" className="px-3 py-3">Level</th>
                {visibleColumns.temp && (
                  <th
                    scope="col"
                    onClick={() => handleSort('landSurfaceTempC')}
                    className="px-3 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <div className="flex items-center gap-1">
                      <span>Surface Temp</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                <th scope="col" className="px-3 py-3">Current Air Temp</th>
                {visibleColumns.tree && (
                  <th
                    scope="col"
                    onClick={() => handleSort('treeCoverPercent')}
                    className="px-3 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <div className="flex items-center gap-1">
                      <span>Canopy %</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {visibleColumns.pop && (
                  <th
                    scope="col"
                    onClick={() => handleSort('population')}
                    className="px-3 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <div className="flex items-center gap-1">
                      <span>Population</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}
                {visibleColumns.vuln && <th scope="col" className="px-3 py-3">Vulnerable %</th>}
                {visibleColumns.power && <th scope="col" className="px-3 py-3">Power Stress</th>}
                {visibleColumns.driver && <th scope="col" className="px-4 py-3">Primary Driver</th>}
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedWards.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                    {isLoading ? 'Loading wards…' : error ? 'Ward data could not be loaded. Use Reload to retry.' : 'No matching wards found.'}
                  </td>
                </tr>
              ) : (
                paginatedWards.map((ward, idx) => {
                  const globalRank = (page - 1) * pageSize + idx + 1;
                  const isCompared = compareWardIds.includes(ward.id);
                  const isSevere = ward.riskLevel === 'Severe';
                  const vulnSummary = Math.round(
                    (ward.vulnerability.lowIncomeHousingPercent + ward.vulnerability.outdoorWorkersPercent) / 2
                  );

                  return (
                    <tr
                      key={ward.id}
                      onClick={() => navigate(`/wards/${ward.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      {/* Compare Checkbox */}
                      <td
                        className="px-3 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isCompared}
                          onChange={() => toggleCompareWard(ward.id)}
                          aria-label={`Select ${ward.name} for side-by-side comparison`}
                          className="rounded text-[#0F766E] focus:ring-[#0F766E]"
                        />
                      </td>

                      {/* Rank */}
                      <td className="px-3 py-3 font-bold text-slate-500">
                        #{globalRank}
                      </td>

                      {/* Ward Name */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {getWardDisplayName(ward)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {ward.name}
                        </div>
                      </td>

                      {/* Zone */}
                      {visibleColumns.zone && (
                        <td className="px-3 py-3 font-medium text-slate-600 dark:text-slate-400">
                          {ward.zone}
                        </td>
                      )}

                      {/* Risk Score with visual progress bar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-extrabold text-sm font-mono w-7"
                            style={{ color: getRiskColor(ward.riskLevel) }}
                          >
                            {ward.heatRiskScore}
                          </span>
                          <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${ward.heatRiskScore}%`,
                                backgroundColor: getRiskColor(ward.riskLevel),
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Level Badge */}
                      <td className="px-3 py-3">
                        <Badge variant="risk" riskLevel={ward.riskLevel} size="sm">
                          {ward.riskLevel}
                        </Badge>
                      </td>

                      {/* Surface Temp */}
                      {visibleColumns.temp && (
                        <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">
                          {formatTemp(ward.landSurfaceTempC, tempUnit)}
                        </td>
                      )}
                      <td className="px-3 py-3 font-semibold text-sky-700 dark:text-sky-300" title={ward.currentWeather ? `${ward.currentWeather.source}${ward.currentWeather.observedAt ? ` · ${ward.currentWeather.observedAt}` : ''}` : 'Live weather unavailable'}>
                        {ward.currentWeather ? `${formatTemp(ward.currentWeather.temperatureC, tempUnit)} air` : 'Unavailable'}
                      </td>

                      {/* Tree Cover */}
                      {visibleColumns.tree && (
                        <td className="px-3 py-3 font-semibold text-[#0F766E]">
                          {ward.treeCoverPercent}%
                        </td>
                      )}

                      {/* Population */}
                      {visibleColumns.pop && (
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {ward.population.toLocaleString('en-IN')}
                        </td>
                      )}

                      {/* Vulnerable % */}
                      {visibleColumns.vuln && (
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {vulnSummary}%
                        </td>
                      )}

                      {/* Power Stress */}
                      {visibleColumns.power && (
                        <td className="px-3 py-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ward.transformerOverloadRisk === 'High'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {ward.peakDemandStressIndex}/100
                          </span>
                        </td>
                      )}

                      {/* Primary Driver */}
                      {visibleColumns.driver && (
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={ward.topDrivers?.[0] || 'Not available'}>
                          {ward.topDrivers?.[0] || 'Not available'}
                        </td>
                      )}

                      {/* Actions */}
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/wards/${ward.id}`)}
                            className="h-7 w-7 p-0"
                            title="View Ward Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/alerts?ward=${ward.id}`)}
                            className="h-7 w-7 p-0"
                            title="Send Heat Alert"
                          >
                            <Send className="w-3.5 h-3.5 text-amber-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            {processedWards.length === 0 ? 'Showing 0 wards' : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, processedWards.length)} of ${processedWards.length} wards`}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="text-xs h-8 px-2.5"
            >
              Previous
            </Button>
            <span className="px-2 font-semibold">
              {page} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs h-8 px-2.5"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Column Visibility Modal */}
      <Modal
        isOpen={colModalOpen}
        onClose={() => setColModalOpen(false)}
        title="Customise Table Columns"
        description="Select the environmental and demographic indicators to display."
      >
        <div className="space-y-3 text-xs">
          {Object.entries(visibleColumns).map(([key, val]) => (
            <label key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
              <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                {key === 'temp' ? 'Surface Temperature' : key === 'tree' ? 'Tree Canopy %' : key === 'pop' ? 'Total Population' : key === 'vuln' ? 'Vulnerable Population' : key === 'power' ? 'Power Stress Index' : key === 'driver' ? 'Primary Driver' : key}
              </span>
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="rounded text-[#E4572E] focus:ring-[#E4572E]"
              />
            </label>
          ))}
          <Button variant="primary" size="sm" onClick={() => setColModalOpen(false)} className="w-full mt-4">
            Save Preferences
          </Button>
        </div>
      </Modal>

      {/* Compare Mode Side-by-Side Drawer with Radar Chart */}
      {compareDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs animate-fade-in flex justify-end">
          <div className="w-screen max-w-2xl bg-white dark:bg-[#121C20] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col h-full">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Split className="w-5 h-5 text-[#0F766E]" />
                  <span>Ward Microclimate Comparison ({comparedWards.length}/3)</span>
                </h2>
                <p className="text-xs text-slate-500">Multidimensional vulnerability radar & comparative matrix</p>
              </div>
              <button
                onClick={() => setCompareDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {comparedWards.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Select 2 or 3 wards using the checkbox column to see side-by-side radar and matrix analysis.
                </div>
              ) : (
                <>
                  {/* Radar Chart */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="font-heading font-semibold text-xs text-slate-800 dark:text-slate-200 mb-2 text-center uppercase tracking-wider">
                      Thermal & Vulnerability Radar Dimensions
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                          {comparedWards.map((w, i) => {
                            const colors = ['#E4572E', '#0F766E', '#8b5cf6'];
                            return (
                              <Radar
                                key={w.id}
                                name={w.name}
                                dataKey={w.name}
                                stroke={colors[i]}
                                fill={colors[i]}
                                fillOpacity={0.25}
                              />
                            );
                          })}
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Comparison Metric Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {comparedWards.map((w) => (
                      <div
                        key={w.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{w.name}</h4>
                          <button
                            onClick={() => toggleCompareWard(w.id)}
                            className="text-slate-400 hover:text-rose-500"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Risk Score:</span>
                            <span className="font-extrabold" style={{ color: getRiskColor(w.riskLevel) }}>
                              {w.heatRiskScore}/100 ({w.riskLevel})
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Surface Temp:</span>
                            <span className="font-semibold">{formatTemp(w.landSurfaceTempC, tempUnit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Canopy Cover:</span>
                            <span className="font-semibold text-[#0F766E]">{w.treeCoverPercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Built Density:</span>
                            <span className="font-semibold">{w.builtUpPercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Population:</span>
                            <span className="font-semibold">{w.population.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">No AC Share:</span>
                            <span className="font-semibold text-amber-600">{w.vulnerability.noAirConditioningPercent}%</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCompareDrawerOpen(false);
                            navigate(`/wards/${w.id}`);
                          }}
                          className="w-full text-xs"
                        >
                          View Full Details
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60">
              <button
                onClick={clearCompare}
                className="text-xs text-rose-500 hover:underline font-semibold"
              >
                Clear Selected ({compareWardIds.length})
              </button>
              <Button size="sm" variant="primary" onClick={() => setCompareDrawerOpen(false)} className="text-xs">
                Done Comparing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
