import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getWardById } from '../services/api';
import { useStore } from '../store/useStore';
import { getWardRiskWithWeights, getRiskColor } from '../lib/risk';
import { MiniWardMap } from '../components/map/MiniWardMap';
import { RiskScoreGauge } from '../components/ui/RiskScoreGauge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { ChartContainer } from '../components/ui/ChartContainer';
import { useToast } from '../components/ui/Toast';
import { generateWardInterventions } from '../lib/interventions';
import { formatNumber, formatCurrencyLakh, formatTemp } from '../lib/utils';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import {
  Send,
  Cpu,
  Download,
  Users,
  Home,
  HardHat,
  Baby,
  PersonStanding,
  Droplets,
  Umbrella,
  Building,
  HeartPulse,
  AlertTriangle,
  Plus,
  Check,
  ArrowLeft,
  ShieldCheck,
  CloudSun,
  Sun,
  Wind,
  CloudRain,
  Thermometer,
} from 'lucide-react';
import jsPDF from 'jspdf';

export const WardDetailPage: React.FC = () => {
  const { wardId = '' } = useParams<{ wardId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { weights, tempUnit, language, addToPlan, planItems } = useStore();

  const { data: rawWard, isLoading, error } = useQuery({
    queryKey: ['ward', wardId],
    queryFn: () => getWardById(wardId),
  });

  // Dynamically recompute risk score with current active weights
  const ward = useMemo(() => {
    if (!rawWard) return null;
    const calc = getWardRiskWithWeights(rawWard, weights);
    return {
      ...rawWard,
      heatRiskScore: calc.score,
      riskLevel: calc.riskLevel,
      components: calc.components,
    };
  }, [rawWard, weights]);

  const interventions = useMemo(() => {
    if (!ward) return [];
    return generateWardInterventions(ward);
  }, [ward]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!ward) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ward Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">Could not find locality with identifier &apos;{wardId}&apos;.</p>
        <Button variant="primary" size="sm" onClick={() => navigate('/wards')} className="mt-4">
          Return to Rankings
        </Button>
      </div>
    );
  }

  const getWardDisplayName = () => {
    if (language === 'te' && ward.nameTelugu) return ward.nameTelugu;
    if (language === 'hi' && ward.nameHindi) return ward.nameHindi;
    return ward.name;
  };

  // 24-Hour Temperature Curve with Danger Zone
  const hourlyChartData = ward.hourlyTemp.map((temp, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    temperature: temp,
    isDanger: temp >= 40,
  }));

  // Power Demand Hourly Curve
  const powerChartData = ward.hourlyDemandMW.map((mw, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    demandMW: mw,
  }));

  // Facility Gap Benchmarks (Benchmark: 1 water kiosk per 25,000 people; 1 shade shelter per 30,000)
  const requiredWaterPoints = Math.ceil(ward.population / 25000);
  const waterGap = Math.max(0, requiredWaterPoints - ward.amenities.waterPoints);

  const requiredShadeShelters = Math.ceil(ward.population / 30000);
  const shadeGap = Math.max(0, requiredShadeShelters - ward.amenities.shadeShelters);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`HeatSense Ward Report: ${ward.name}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Zone: ${ward.zone} | Generated: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    doc.text(`Heat-Risk Score: ${ward.heatRiskScore}/100 (${ward.riskLevel}) | Peak Surface Temp: ${ward.landSurfaceTempC}°C`, 14, 34);
    doc.text(`Population: ${ward.population.toLocaleString('en-IN')} | Tree Canopy: ${ward.treeCoverPercent}% | Built-Up: ${ward.builtUpPercent}%`, 14, 40);

    doc.setFont('helvetica', 'bold');
    doc.text('Key Vulnerabilities:', 14, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(`- Low Income / Tin Roofs: ${ward.vulnerability.lowIncomeHousingPercent}%`, 14, 58);
    doc.text(`- Outdoor & Gig Workers: ${ward.vulnerability.outdoorWorkersPercent}%`, 14, 64);
    doc.text(`- Households Without AC: ${ward.vulnerability.noAirConditioningPercent}%`, 14, 70);

    doc.setFont('helvetica', 'bold');
    doc.text('Recommended Priority Actions:', 14, 82);
    doc.setFont('helvetica', 'normal');
    let y = 88;
    interventions.slice(0, 4).forEach((act, idx) => {
      doc.text(`${idx + 1}. ${act.title} (Cost: ₹${act.costLakhINR}L, Benefit: -${act.coolingBenefitC}°C)`, 14, y);
      y += 8;
    });

    doc.save(`HeatSense-Ward-${ward.id}.pdf`);
    toast('PDF Exported', 'Ward scorecard PDF saved.', 'success');
  };

  const handleAddAction = (action: any) => {
    const added = addToPlan(action);
    if (added) {
      toast('Added to Plan', `${action.title} added to your basket.`, 'success');
    } else {
      toast('Already in Plan', `${action.title} is already in your basket.`, 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            onClick={() => navigate('/wards')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#E4572E] font-semibold mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Ward Rankings</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-extrabold text-3xl text-slate-900 dark:text-white">
              {getWardDisplayName()}
            </h1>
            <Badge variant="risk" riskLevel={ward.riskLevel} size="lg">
              {ward.riskLevel} Risk
            </Badge>
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-400">
              {ward.zone} Zone
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ward ID: <span className="font-mono">{ward.id}</span> • Population: {ward.population.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/simulator?ward=${ward.id}`)}
            className="text-xs gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5 text-teal-600" />
            <span>Open in Simulator</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report (PDF)</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/alerts?ward=${ward.id}`)}
            className="text-xs gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Alert to Ward</span>
          </Button>
        </div>
      </div>

      {/* Top Diagnostic Grid: Mini Map + Risk Gauge & Driver Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Mini Ward Polygon Map */}
        <div className="lg:col-span-5">
          <Card className="p-4 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500">
                  Ward Boundary & Center
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {ward.centroid[0].toFixed(4)}, {ward.centroid[1].toFixed(4)}
                </span>
              </div>
              <MiniWardMap ward={ward} height="220px" />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Density</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100">
                  {ward.populationDensityPerSqKm.toLocaleString('en-IN')} / km²
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Night Temp</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100">
                  {formatTemp(ward.nightTempC, tempUnit)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Center: Risk Gauge & Score Driver Decomposition */}
        <div className="lg:col-span-7">
          <Card className="p-5 h-full flex flex-col justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-5 flex justify-center">
                <RiskScoreGauge score={ward.heatRiskScore} size="lg" />
              </div>
              <div className="sm:col-span-7 space-y-3">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Diagnostic Factor Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Weighted contributions matching active policy weights (wTemp: {Math.round(weights.wTemp * 100)}%, wTree: {Math.round(weights.wTree * 100)}%, wBuilt: {Math.round(weights.wBuilt * 100)}%, wVuln: {Math.round(weights.wVuln * 100)}%):
                </p>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span>Surface Thermal Exposure</span>
                      <span className="font-bold">{ward.components?.tempComponent || 30} pts</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${(ward.components?.tempComponent || 30) * 2.5}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span>Demographic Vulnerability</span>
                      <span className="font-bold">{ward.components?.vulnComponent || 25} pts</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${(ward.components?.vulnComponent || 25) * 2.5}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span>Canopy Deficit Impact</span>
                      <span className="font-bold">{ward.components?.treeComponent || 18} pts</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${(ward.components?.treeComponent || 18) * 2.5}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span>Built Density & Concrete Trapping</span>
                      <span className="font-bold">{ward.components?.builtComponent || 15} pts</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-600" style={{ width: `${(ward.components?.builtComponent || 15) * 2.5}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Drivers */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Dominant Local Stressors:</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {ward.topDrivers.map((driver, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-[#E4572E] font-medium border border-orange-200 dark:border-orange-900/50"
                  >
                    {driver}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Live Current Conditions (ward centroid, modelled) */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-sky-500" />
              <span>Current Conditions at Ward Centroid</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ward.currentWeather
                ? `${ward.currentWeather.source}${ward.currentWeather.observedAt ? ` · observed ${ward.currentWeather.observedAt}` : ''}`
                : 'Modelled conditions are unavailable for this ward.'}
            </p>
          </div>
          {ward.currentWeather && (
            <span className="text-[10px] px-2 py-1 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold uppercase tracking-wider">
              Modelled · not a station reading
            </span>
          )}
        </div>

        {ward.currentWeather ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Thermometer className="w-4 h-4 text-rose-500" />
                <span className="font-semibold">Air Temp</span>
              </div>
              <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                {formatTemp(ward.currentWeather.temperatureC, tempUnit)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="font-semibold">Feels Like</span>
              </div>
              <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                {ward.currentWeather.apparentTemperatureC != null
                  ? formatTemp(ward.currentWeather.apparentTemperatureC, tempUnit)
                  : '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Droplets className="w-4 h-4 text-sky-500" />
                <span className="font-semibold">Humidity</span>
              </div>
              <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                {ward.currentWeather.relativeHumidityPct != null ? `${ward.currentWeather.relativeHumidityPct}%` : '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Wind className="w-4 h-4 text-teal-500" />
                <span className="font-semibold">Wind</span>
              </div>
              <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                {ward.currentWeather.windSpeedKmh != null ? `${ward.currentWeather.windSpeedKmh} km/h` : '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <CloudRain className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold">Precipitation</span>
              </div>
              <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                {ward.currentWeather.precipitationMm != null ? `${ward.currentWeather.precipitationMm} mm` : '—'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:amber-900/60 text-xs text-amber-800 dark:text-amber-300">
            Live modelled conditions are unavailable for this ward. The surface-temperature, diurnal
            and 7-day trend panels on this page remain valid.
          </div>
        )}
      </Card>

      {/* Charts Row: 24h Temperature Curve with Heat-Danger Band & 7-Day Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: 24-Hour Temperature Curve */}
        <ChartContainer
          title="24-Hour Diurnal Surface Temperature Profile"
          description="Shaded danger zone indicates temperatures exceeding 40°C threshold."
          tableData={hourlyChartData}
          tableColumns={[
            { header: 'Time', accessor: (d) => d.hour },
            { header: 'Temperature', accessor: (d) => `${d.temperature}°C` },
            {
              header: 'Status',
              accessor: (d) => (d.isDanger ? 'Extreme Danger (>40°C)' : 'Moderate'),
            },
          ]}
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E4572E" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#E4572E" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis domain={[26, 48]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: number) => [`${val}°C`, 'Temperature']}
                  labelFormatter={(lbl) => `Time: ${lbl}`}
                />
                <ReferenceLine y={40} stroke="#D7263D" strokeDasharray="3 3" label={{ value: 'Danger Threshold (40°C)', fill: '#D7263D', fontSize: 10 }} />
                <Area type="monotone" dataKey="temperature" stroke="#E4572E" strokeWidth={2.5} fillOpacity={1} fill="url(#tempGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        {/* Chart 2: 7-Day Temperature & Risk Trend */}
        <ChartContainer
          title="7-Day Microclimate & Heat-Risk Forecast"
          description="Daily peak and minimum surface temperature progression."
          tableData={ward.trend7Day}
          tableColumns={[
            { header: 'Day', accessor: (d) => d.date },
            { header: 'Max Temp', accessor: (d) => `${d.maxTemp}°C` },
            { header: 'Min Temp', accessor: (d) => `${d.minTemp}°C` },
            { header: 'Risk Score', accessor: (d) => `${d.riskScore}/100` },
          ]}
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ward.trend7Day} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[25, 48]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="maxTemp" name="Day Max (°C)" stroke="#D7263D" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="minTemp" name="Night Min (°C)" stroke="#0F766E" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>

      {/* Demographic Profile & Amenities Gap Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Population Panel */}
        <div className="lg:col-span-6">
          <Card className="p-5 h-full">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[#E4572E]" />
              <span>Demographic Exposure & Vulnerability</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <Home className="w-4 h-4 text-rose-500" />
                  <span className="font-semibold">Tin Roof Slums</span>
                </div>
                <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                  {ward.vulnerability.lowIncomeHousingPercent}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">High thermal conduction</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <HardHat className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold">Outdoor Labor</span>
                </div>
                <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                  {ward.vulnerability.outdoorWorkersPercent}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Gig & vendor force</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <Baby className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold">Under 5 Years</span>
                </div>
                <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                  {ward.vulnerability.childrenUnder5Percent}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Rapid dehydration risk</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <PersonStanding className="w-4 h-4 text-purple-500" />
                  <span className="font-semibold">Elderly (&gt;65)</span>
                </div>
                <div className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">
                  {ward.vulnerability.elderlyPercent}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Cardiovascular vulnerability</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 col-span-2 sm:col-span-2">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="font-semibold">Households Without Air Conditioning</span>
                </div>
                <div className="font-heading font-extrabold text-xl text-[#E4572E]">
                  {ward.vulnerability.noAirConditioningPercent}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Over {Math.round((ward.population * (ward.vulnerability.noAirConditioningPercent / 100))).toLocaleString('en-IN')} residents have no mechanical indoor cooling.
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Amenities & Gap Indicator Panel */}
        <div className="lg:col-span-6">
          <Card className="p-5 h-full flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-[#0F766E]" />
                <span>Public Heat Relief Infrastructure & Deficits</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Water points */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Droplets className="w-4 h-4 text-sky-500" />
                      Water Points
                    </span>
                    <span className="font-extrabold text-base">{ward.amenities.waterPoints}</span>
                  </div>
                  {waterGap > 0 ? (
                    <div className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <span>Deficit: Needs {waterGap} more kiosks</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-emerald-600 font-semibold">Adequate density</div>
                  )}
                </div>

                {/* Shade shelters */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Umbrella className="w-4 h-4 text-teal-500" />
                      Shade Shelters
                    </span>
                    <span className="font-extrabold text-base">{ward.amenities.shadeShelters}</span>
                  </div>
                  {shadeGap > 0 ? (
                    <div className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <span>Deficit: Needs {shadeGap} more shelters</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-emerald-600 font-semibold">Adequate coverage</div>
                  )}
                </div>

                {/* Cooling centres */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-green-500" />
                      Cooling Centres
                    </span>
                    <span className="font-extrabold text-base">{ward.amenities.coolingCentres}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {ward.amenities.coolingCentres === 0 ? 'No public refuge designated' : 'AC emergency refuge active'}
                  </div>
                </div>

                {/* Hospitals nearby */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <HeartPulse className="w-4 h-4 text-rose-500" />
                      Clinics / Hospitals
                    </span>
                    <span className="font-extrabold text-base">{ward.amenities.hospitalsNearby}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">Equipped for ORS heat triage</div>
                </div>
              </div>
            </div>

            {/* Benchmark Note */}
            <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-[11px] text-slate-500 leading-relaxed">
              <strong>GHMC Resilience Benchmark:</strong> Minimum 1 free drinking water point per 25,000 residents and 1 transit shade canopy per 30,000 residents.
            </div>
          </Card>
        </div>
      </div>

      {/* Recommended Interventions Portfolio Table */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
              Recommended Municipal Action Portfolio
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ranked interventions tailored to {ward.name}&apos;s specific built-environment and vulnerability profile.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {interventions.length} actions generated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Intervention</th>
                <th className="px-3 py-2.5">Cost Band</th>
                <th className="px-3 py-2.5">Est. Cost</th>
                <th className="px-3 py-2.5">Cooling (°C)</th>
                <th className="px-3 py-2.5">Beneficiaries</th>
                <th className="px-4 py-2.5">Diagnostic Rationale</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {interventions.map((action, idx) => {
                const isAdded = planItems.some((p) => p.id === action.id);
                return (
                  <tr key={action.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-3 font-bold text-[#E4572E]">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white">{action.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{action.description}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800">
                        {action.costBand}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-bold text-[#E4572E]">
                      {formatCurrencyLakh(action.costLakhINR)}
                    </td>
                    <td className="px-3 py-3 font-bold text-[#0F766E]">
                      -{action.coolingBenefitC}°C
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {action.peopleBenefited.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-sm">
                      {action.reason}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        size="sm"
                        variant={isAdded ? 'outline' : 'primary'}
                        onClick={() => handleAddAction(action)}
                        className="text-xs h-7 px-2.5 gap-1 shrink-0"
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Safety Advice Card for Field Officers & Public Health Workers */}
      <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex flex-col md:flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-heading font-bold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Field Health Protocol for {ward.name}</span>
          </h4>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed max-w-3xl">
            Because {ward.name} has {ward.vulnerability.outdoorWorkersPercent}% outdoor workers and surface temps reaching {ward.landSurfaceTempC}°C, mandatory ORS distribution and scheduled transit halts must be enforced by GHMC health inspectors between 12:00 PM and 3:30 PM.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/alerts?ward=${ward.id}`)}
          className="text-xs font-semibold shrink-0 bg-white dark:bg-slate-900"
        >
          Dispatch Field Alert
        </Button>
      </div>
    </div>
  );
};
