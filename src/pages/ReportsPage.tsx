import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getWards, getCityOverview, getAlerts, getWardsCsv, getAlertsCsv, getForecast } from '../services/api';
import { Ward } from '../types';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { formatCurrencyLakh, formatNumber, formatTemp } from '../lib/utils';
import { generateWardInterventions } from '../lib/interventions';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Layers,
  Flame,
  ShieldCheck,
  Building,
  Check,
} from 'lucide-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';

export const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { tempUnit, planItems } = useStore();
  const reportRef = useRef<HTMLDivElement>(null);

  const wardsQuery = useQuery({ queryKey: ['wards'], queryFn: getWards, staleTime: 0 });
  const overviewQuery = useQuery({ queryKey: ['city-overview'], queryFn: getCityOverview, staleTime: 0 });
  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: getAlerts, staleTime: 0 });
  const weatherQuery = useQuery({ queryKey: ['live-weather'], queryFn: getForecast, staleTime: 10 * 60 * 1000, refetchInterval: 15 * 60 * 1000 });
  const wards = wardsQuery.data ?? [];
  const overview = overviewQuery.data;
  const alerts = alertsQuery.data ?? [];
  const isRefreshing = wardsQuery.isFetching || overviewQuery.isFetching || alertsQuery.isFetching;
  const refreshReport = () => void Promise.all([wardsQuery.refetch(), overviewQuery.refetch(), alertsQuery.refetch()]);

  // Report Builder Controls
  const [reportType, setReportType] = useState<'city' | 'ward' | 'planner' | 'alerts'>('city');
  const [selectedWardId, setSelectedWardId] = useState<string>('charminar');
  const [dateRange, setDateRange] = useState<string>('last7days');

  // Included sections
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includeRankings, setIncludeRankings] = useState(true);
  const [includeInterventions, setIncludeInterventions] = useState(true);
  const [includeMethodology, setIncludeMethodology] = useState(true);

  const targetWard = useMemo(() => {
    return wards.find((w) => w.id === selectedWardId) || wards[0] || null;
  }, [wards, selectedWardId]);

  const reportAlerts = useMemo(() => {
    const cutoff = dateRange === 'last7days' ? Date.now() - 7 * 86400000 : dateRange === 'last30days' ? Date.now() - 30 * 86400000 : 0;
    return alerts.filter((alert) => !cutoff || new Date(alert.timestamp).getTime() >= cutoff);
  }, [alerts, dateRange]);

  const topSevereWards = useMemo(() => {
    return [...wards].sort((a, b) => b.heatRiskScore - a.heatRiskScore).slice(0, 10);
  }, [wards]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = async () => {
    try {
      const csv = reportType === 'alerts' ? await getAlertsCsv() : await getWardsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HeatSense-Server-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast('Server CSV Downloaded', 'Dataset exported directly from backend API.', 'success');
      return;
    } catch {
      toast('Server export unavailable', 'The API CSV export failed; downloading the currently loaded ward data instead.', 'warning');
    }

    const csvData = wards.map((w, i) => ({
      Rank: i + 1,
      Ward: w.name,
      Zone: w.zone,
      Risk_Score: w.heatRiskScore,
      Risk_Level: w.riskLevel,
      Surface_Temp_C: w.landSurfaceTempC,
      Current_Air_Temp_C: w.currentWeather?.temperatureC ?? '',
      Canopy_Percent: w.treeCoverPercent,
      Population: w.population,
      Top_Driver: w.topDrivers?.[0] || '',
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HeatSense-Report-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast('CSV Downloaded', 'Dataset exported successfully.', 'success');
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('HeatSense Hyderabad - Heat Resilience Brief', 14, 20);
    doc.setFontSize(10);
    doc.text(`Report Type: ${reportType.toUpperCase()} | Generated: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    doc.text('Data Status: Ward metrics are sample / modelled; verify source labels before operational use.', 14, 34);

    let y = 48;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Executive Overview & Critical Severity Wards', 14, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    y += 8;
    doc.text(`Total Wards: ${overview?.totalWards ?? 0} | Severe Risk Wards: ${overview?.severeRiskWards ?? 0} | High/Severe Exposed: ${formatNumber(overview?.peopleAtHighOrSevereRisk ?? 0)}`, 14, y);
    y += 6;
    doc.text(`Avg City Surface Temperature: ${overview?.avgCitySurfaceTempC ?? 'Unavailable'}°C | Hottest Ward: ${overview?.hottestWard?.name ?? 'Unavailable'} (${overview?.hottestWard?.tempC ?? '—'}°C)`, 14, y);

    y += 16;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Top 5 Urgent Intervention Priority Localities', 14, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    y += 8;

    topSevereWards.slice(0, 5).forEach((w, idx) => {
      doc.text(`${idx + 1}. ${w.name} [${w.zone} Zone] - Score: ${w.heatRiskScore}/100 (${w.riskLevel}) - Sample LST: ${w.landSurfaceTempC}°C`, 14, y);
      doc.text(`   Driver: ${w.topDrivers?.[0] || 'Not available'}`, 14, y + 5);
      y += 12;
    });

    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Data Sources & Attribution:', 14, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text('Satellite Thermal Imagery: Landsat 8/9 & Sentinel-2. Census: GHMC Demographics & WorldPop.', 14, y);
    y += 5;
    doc.text('Health Benchmarks: Lancet Countdown 2025 & NDMA National Heat Action Guidelines.', 14, y);

    doc.save(`HeatSense-Executive-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast('PDF Generated', 'Report downloaded in PDF format.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white flex items-center gap-2">
            <span>Executive Resilience Report Builder</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-300 dark:border-sky-800">
              Publication Studio
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Assemble publication-ready council memos, diagnostic ward scorecards, and intervention funding proposals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshReport} disabled={isRefreshing} className="text-xs gap-1.5">
            <Calendar className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing' : 'Refresh data'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint} className="text-xs gap-1.5 shadow-sm">
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report (A4)</span>
          </Button>
        </div>
      </div>

      {(wardsQuery.error || overviewQuery.error || alertsQuery.error) && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
          Report data could not be fully refreshed. Check that you are signed in and the backend is running, then select Refresh data to retry.
        </div>
      )}
      {isRefreshing && !wards.length && (
        <div role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          Loading report data from the API…
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Report Configurator Panel */}
        <div className="lg:col-span-4 space-y-4 print:hidden">
          <Card className="p-5 space-y-5">
            <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Report Parameters
            </h3>

            {/* Report Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Template Type:
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
              >
                <option value="city">Citywide Heat Summary Brief</option>
                <option value="ward">Specific Ward Diagnostic Scorecard</option>
                <option value="planner">Municipal Intervention Capital Plan</option>
                <option value="alerts">Heat Alert & Warning Audit</option>
              </select>
            </div>

            {/* Ward Selector if ward report chosen */}
            {reportType === 'ward' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Select Target Ward:
                </label>
                <select
                  value={selectedWardId}
                  onChange={(e) => setSelectedWardId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                >
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.zone} Zone, {w.riskLevel} Risk)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Telemetry Date Range:
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
              >
                <option value="last7days">Last 7 days</option>
                <option value="last30days">Last 30 days</option>
                <option value="all">All available records</option>
              </select>
            </div>

            {/* Sections to Include Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Sections to Include:
              </span>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeKpis}
                    onChange={(e) => setIncludeKpis(e.target.checked)}
                    className="rounded text-[#E4572E] focus:ring-[#E4572E]"
                  />
                  <span>Executive KPIs & Thermal Extremes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRankings}
                    onChange={(e) => setIncludeRankings(e.target.checked)}
                    className="rounded text-[#E4572E] focus:ring-[#E4572E]"
                  />
                  <span>Priority Localities Ranking Table</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInterventions}
                    onChange={(e) => setIncludeInterventions(e.target.checked)}
                    className="rounded text-[#E4572E] focus:ring-[#E4572E]"
                  />
                  <span>Budgeted Action Recommendations</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMethodology}
                    onChange={(e) => setIncludeMethodology(e.target.checked)}
                    className="rounded text-[#E4572E] focus:ring-[#E4572E]"
                  />
                  <span>Data Sources & Disclaimer Notice</span>
                </label>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Live A4 Printable Preview */}
        <div className="lg:col-span-8">
          <div
            ref={reportRef}
            className="w-full bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-xl border border-slate-200 space-y-8 font-sans print:p-0 print:border-none print:shadow-none"
            style={{ minHeight: '1050px' }}
          >
            {/* Report Header & Emblems */}
            <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E4572E] flex items-center justify-center text-white">
                    <Flame className="w-5 h-5 fill-white" />
                  </div>
                  <span className="font-heading font-extrabold text-xl text-slate-900">
                    Heat<span className="text-[#E4572E]">Sense</span> Hyderabad
                  </span>
                </div>
                <h2 className="font-heading font-bold text-2xl text-slate-900 mt-2">
                  {reportType === 'city'
                    ? 'Citywide Heat Resilience & Disaster Prevention Brief'
                    : reportType === 'ward'
                    ? `Diagnostic Ward Heat Profile: ${targetWard?.name ?? 'Select a ward'}`
                    : reportType === 'planner'
                    ? 'Municipal Cooling Capital Allocation Portfolio'
                    : 'Emergency Heatwave Alert Broadcast Audit'}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Prepared for: Greater Hyderabad Municipal Corporation (GHMC) Disaster Management Authority
                </p>
              </div>

              <div className="text-right text-xs text-slate-500 font-mono">
                <div>Document ID: HS-HYD-{new Date().getFullYear()}-042</div>
                <div>Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div className="font-bold text-[#E4572E] mt-1">OFFICIAL MEMO</div>
              </div>
            </div>

            {/* Data provenance watermark */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
              <span className="font-bold">STATUS: SAMPLE / MODELLED WARD DATA</span>
              <span className="text-[11px] text-amber-700">Weather is a live forecast-model feed when available; ward risk, surface temperature and canopy are sample/proxy data</span>
            </div>

            {/* Section 1: Executive KPIs */}
            {includeKpis && (
              <div className="space-y-3">
                <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-slate-900 border-b pb-1">
                  1. Executive Thermal Summary
                </h3>
                <div className="grid grid-cols-4 gap-3 text-center text-xs">
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Severe Wards</span>
                    <span className="font-heading font-extrabold text-2xl text-red-600">
                      {overview?.severeRiskWards ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Score &gt; 75</span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Exposed Population</span>
                    <span className="font-heading font-extrabold text-2xl text-slate-900">
                      {formatNumber(overview?.peopleAtHighOrSevereRisk ?? 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">High/Severe Tiers</span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Current Air Temp (city)</span>
                    <span className="font-heading font-extrabold text-2xl text-[#E4572E]">
                      {weatherQuery.data?.current?.temperature_2m != null ? `${weatherQuery.data.current.temperature_2m}°C` : '—'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Open-Meteo · {weatherQuery.data?.current?.time ?? weatherQuery.data?.error ?? 'Unavailable'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Peak Power Draw</span>
                    <span className="font-heading font-extrabold text-2xl text-purple-600">
                      —
                    </span>
                    <span className="text-[10px] text-slate-400 block">No measured utility feed</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Priority Localities Ranking */}
            {includeRankings && (
              <div className="space-y-3">
                <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-slate-900 border-b pb-1">
                  {reportType === 'alerts' ? '2. Heat Alert Delivery Audit' : reportType === 'ward' ? '2. Selected Ward Profile' : '2. Priority Localities Requiring Municipal Action'}
                </h3>
                <div className="border rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    {reportType === 'alerts' ? (
                      <>
                        <thead className="bg-slate-100 font-semibold text-slate-700 border-b"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Alert</th><th className="px-3 py-2">Level</th><th className="px-3 py-2">Wards</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Recipients</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{reportAlerts.length ? reportAlerts.map((alert) => <tr key={alert.id}><td className="px-3 py-2">{new Date(alert.timestamp).toLocaleDateString('en-IN')}</td><td className="px-3 py-2 font-semibold">{alert.title}</td><td className="px-3 py-2">{alert.level}</td><td className="px-3 py-2">{alert.wardNames?.join(', ') || '—'}</td><td className="px-3 py-2">{alert.status}</td><td className="px-3 py-2">{formatNumber(alert.recipientsCount)}</td></tr>) : <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No alerts found for this date range.</td></tr>}</tbody>
                      </>
                    ) : (
                      <>
                    <thead className="bg-slate-100 font-semibold text-slate-700 border-b">
                      <tr>
                        <th className="px-3 py-2">Rank</th>
                        <th className="px-3 py-2">Ward Name</th>
                        <th className="px-3 py-2">Zone</th>
                        <th className="px-3 py-2">Risk Score</th>
                        <th className="px-3 py-2">Surface Temp</th>
                        <th className="px-3 py-2">Current Air</th>
                        <th className="px-3 py-2">Canopy %</th>
                        <th className="px-4 py-2">Primary Environmental Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportType === 'ward' && targetWard ? [targetWard] : topSevereWards).slice(0, 6).map((w, idx) => (
                        <tr key={w.id}>
                          <td className="px-3 py-2 font-bold text-red-600">#{idx + 1}</td>
                          <td className="px-3 py-2 font-bold text-slate-900">{w.name}</td>
                          <td className="px-3 py-2 text-slate-500">{w.zone}</td>
                          <td className="px-3 py-2 font-extrabold text-red-600">{w.heatRiskScore}/100</td>
                          <td className="px-3 py-2 font-semibold">{w.landSurfaceTempC}°C</td>
                          <td className="px-3 py-2">{w.currentWeather ? `${w.currentWeather.temperatureC}°C` : 'Unavailable'}</td>
                          <td className="px-3 py-2">{w.treeCoverPercent}%</td>
                          <td className="px-4 py-2 text-slate-600">{w.topDrivers?.[0] || 'Not available'}</td>
                        </tr>
                      ))}
                    </tbody>
                      </>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* Section 3: Recommended Municipal Interventions */}
            {includeInterventions && (
              <div className="space-y-3">
                <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-slate-900 border-b pb-1">
                  3. Priority Resilience Investments & Deployment Recommendations
                </h3>
                {reportType === 'planner' && planItems.length > 0 ? (
                  <div className="border rounded-xl overflow-hidden text-xs"><table className="w-full text-left"><thead className="bg-slate-100"><tr><th className="p-2">Action</th><th className="p-2">Ward</th><th className="p-2">Cost (₹ lakh)</th><th className="p-2">People reached (est.)</th></tr></thead><tbody>{planItems.map((item) => <tr key={item.id} className="border-t"><td className="p-2">{item.title}</td><td className="p-2">{item.wardName}</td><td className="p-2">{item.costLakhINR}</td><td className="p-2">{formatNumber(item.peopleBenefited)}</td></tr>)}</tbody></table></div>
                ) : reportType === 'planner' ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">Your intervention plan is empty. Add actions in Intervention Planner to include the budget and coverage here.</div>
                ) : reportType === 'ward' && targetWard ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">{generateWardInterventions(targetWard).slice(0, 6).map((action) => <div key={action.id} className="p-3 border rounded-xl bg-slate-50 space-y-1"><div className="font-bold text-slate-900">{action.title}</div><div className="text-[11px] text-slate-600">{action.reason} Estimated cost: ₹{action.costLakhINR} lakh.</div></div>)}</div>
                ) : (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 border rounded-xl bg-slate-50 space-y-1">
                    <div className="font-bold text-slate-900">Reflective Cool Roofs Coating</div>
                    <div className="text-[11px] text-slate-600">
                      Target 30% of informal tin/concrete roofs across Charminar, Yakutpura and Karwan. Projected cooling: -1.0°C to -1.5°C indoor temperature drop.
                    </div>
                  </div>
                  <div className="p-3 border rounded-xl bg-slate-50 space-y-1">
                    <div className="font-bold text-slate-900">Transit Tension Shade Shelters</div>
                    <div className="text-[11px] text-slate-600">
                      Install 45 UV-resistant tensile canopies at major auto/bus halts and wholesale markets (Dilsukhnagar, LB Nagar, Secunderabad).
                    </div>
                  </div>
                  <div className="p-3 border rounded-xl bg-slate-50 space-y-1">
                    <div className="font-bold text-slate-900">Chilled Drinking Water Refill Points</div>
                    <div className="text-[11px] text-slate-600">
                      Replenish 60 solar-powered RO water kiosks to eliminate the 8-kiosk deficit identified in South and Central zones.
                    </div>
                  </div>
                  <div className="p-3 border rounded-xl bg-slate-50 space-y-1">
                    <div className="font-bold text-slate-900">Automated SMS/WhatsApp Heat Alerts</div>
                    <div className="text-[11px] text-slate-600">
                      Trigger hyperlocal heatwave bulletins to registered gig and delivery workers when forecast surface temps exceed 43°C.
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Section 4: Methodology & Legal Disclaimers */}
            {includeMethodology && (
              <div className="pt-4 border-t-2 border-slate-200 text-[10px] text-slate-500 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span>SCIENTIFIC ATTRIBUTION & METHODOLOGY</span>
                  <span>GHMC RESILIENCE OFFICE</span>
                </div>
                <p className="leading-relaxed">
                  Data telemetry ingested from Landsat 8/9 Thermal Infrared Sensor (TIRS), Sentinel-2 MSI, OpenStreetMap, and WorldPop socio-demographic grids. Heat-Risk Scores are computed via multi-criteria weighted normalization in compliance with NDMA guidelines. Notice: Sample data shown for platform demonstration and municipal planning simulation.
                </p>
                <div className="flex items-center justify-between pt-2">
                  <span>Signatory: Dr. Ramesh Rao, IAS (Chief Resilience Officer)</span>
                  <span>Page 1 of 1</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
