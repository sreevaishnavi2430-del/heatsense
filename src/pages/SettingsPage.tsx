import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import { DEFAULT_WEIGHTS } from '../config';
import { getSettings, updateSettings, getHealthReady } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import {
  Sliders,
  Globe,
  Sun,
  Moon,
  Thermometer,
  RefreshCw,
  RotateCcw,
  Info,
  CheckCircle2,
  ShieldCheck,
  Database,
  Radio,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    tempUnit,
    toggleTempUnit,
    weights,
    setWeights,
    resetWeights,
    refreshInterval,
    setRefreshInterval,
  } = useStore();

  const { data: dbSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data: healthStatus } = useQuery({
    queryKey: ['health-ready'],
    queryFn: getHealthReady,
  });

  // Local state for weight sliders (in percent 0 - 100)
  const [wTempPct, setWTempPct] = useState(Math.round(weights.wTemp * 100));
  const [wTreePct, setWTreePct] = useState(Math.round(weights.wTree * 100));
  const [wBuiltPct, setWBuiltPct] = useState(Math.round(weights.wBuilt * 100));
  const [wVulnPct, setWVulnPct] = useState(Math.round(weights.wVuln * 100));

  // Sync from backend if available
  useEffect(() => {
    if (dbSettings?.weights) {
      setWTempPct(Math.round(dbSettings.weights.wTemp * 100));
      setWTreePct(Math.round(dbSettings.weights.wTree * 100));
      setWBuiltPct(Math.round(dbSettings.weights.wBuilt * 100));
      setWVulnPct(Math.round(dbSettings.weights.wVuln * 100));
      setWeights(dbSettings.weights);
    }
  }, [dbSettings, setWeights]);

  const totalSum = wTempPct + wTreePct + wBuiltPct + wVulnPct;
  const isBalanced = totalSum === 100;

  const handleSaveWeights = async () => {
    if (!isBalanced) {
      toast('Invalid Weight Sum', 'Total weights must equal 100%. Please adjust sliders.', 'warning');
      return;
    }

    const newWeights = {
      wTemp: wTempPct / 100,
      wTree: wTreePct / 100,
      wBuilt: wBuiltPct / 100,
      wVuln: wVulnPct / 100,
    };

    setWeights(newWeights);

    try {
      await updateSettings({ weights: newWeights });
      toast(
        'Weights Persisted',
        'Weights saved to persistent database and recalculated for all 40 wards.',
        'success'
      );
    } catch {
      toast(
        'Weights Updated Locally',
        'All 40 ward heat scores recalculated in client state.',
        'info'
      );
    }
  };

  const handleReset = () => {
    resetWeights();
    setWTempPct(Math.round(DEFAULT_WEIGHTS.wTemp * 100));
    setWTreePct(Math.round(DEFAULT_WEIGHTS.wTree * 100));
    setWBuiltPct(Math.round(DEFAULT_WEIGHTS.wBuilt * 100));
    setWVulnPct(Math.round(DEFAULT_WEIGHTS.wVuln * 100));
    toast('Weights Reset', 'Restored to NDMA / Lancet default weights.', 'info');
  };

  const handleLanguageChange = (lang: 'en' | 'te' | 'hi') => {
    setLanguage(lang);
    toast('Language Updated', `Switched interface language to ${lang.toUpperCase()}.`, 'success');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
          Platform Settings & Policy Tuning
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure Heat-Risk Score algorithmic weights, telemetry refresh periods, and display preferences.
        </p>
      </div>

      {/* 1. Heat-Risk Score Formula Weights Card */}
      <Card className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-[#E4572E] flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('settings.weightsTitle')}
              </h2>
              <p className="text-xs text-slate-500">{t('settings.weightsDesc')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                isBalanced
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              }`}
            >
              Sum: {totalSum}% / 100%
            </span>

            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs gap-1">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </Button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="space-y-5 text-xs">
          {/* Slider 1: Temperature */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Land Surface Temperature Weight (wTemp):
              </span>
              <span className="font-mono font-bold text-red-600 text-sm">{wTempPct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              value={wTempPct}
              onChange={(e) => setWTempPct(Number(e.target.value))}
              aria-label="Surface temperature weight slider"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Low thermal weight (10%)</span>
              <span>Default: 35%</span>
              <span>High thermal weight (60%)</span>
            </div>
          </div>

          {/* Slider 2: Tree Canopy */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Canopy Deficit Weight (wTree):
              </span>
              <span className="font-mono font-bold text-[#0F766E] text-sm">{wTreePct}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={40}
              value={wTreePct}
              onChange={(e) => setWTreePct(Number(e.target.value))}
              aria-label="Canopy deficit weight slider"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0F766E]"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>5%</span>
              <span>Default: 20%</span>
              <span>40%</span>
            </div>
          </div>

          {/* Slider 3: Built-Up Density */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Built-Up Density & Impervious Surface Weight (wBuilt):
              </span>
              <span className="font-mono font-bold text-purple-600 text-sm">{wBuiltPct}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={35}
              value={wBuiltPct}
              onChange={(e) => setWBuiltPct(Number(e.target.value))}
              aria-label="Built up density weight slider"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>5%</span>
              <span>Default: 15%</span>
              <span>35%</span>
            </div>
          </div>

          {/* Slider 4: Demographic Vulnerability */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Demographic Vulnerability Weight (wVuln):
              </span>
              <span className="font-mono font-bold text-pink-600 text-sm">{wVulnPct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              value={wVulnPct}
              onChange={(e) => setWVulnPct(Number(e.target.value))}
              aria-label="Demographic vulnerability weight slider"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>10%</span>
              <span>Default: 30%</span>
              <span>50%</span>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            variant="primary"
            size="md"
            disabled={!isBalanced}
            onClick={handleSaveWeights}
            className="text-xs font-bold gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply Weights & Recompute Platform</span>
          </Button>
        </div>
      </Card>

      {/* 2. Localization, Units & Appearance */}
      <Card className="p-6 space-y-6">
        <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white uppercase tracking-wider">
          Localization & Display Preferences
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          {/* Language */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-slate-400" />
              <span>{t('settings.language')}</span>
            </label>
            <div className="space-y-1.5">
              {[
                { id: 'en', label: 'English' },
                { id: 'te', label: 'తెలుగు (Telugu)' },
                { id: 'hi', label: 'हिन्दी (Hindi)' },
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleLanguageChange(l.id as any)}
                  className={`w-full p-2 rounded-lg text-left font-medium border flex items-center justify-between ${
                    language === l.id
                      ? 'bg-orange-50 dark:bg-orange-950/40 border-[#E4572E] text-[#E4572E] font-bold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{l.label}</span>
                  {language === l.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-slate-400" />
              <span>{t('settings.theme')}</span>
            </label>
            <div className="space-y-1.5">
              <button
                onClick={() => setTheme('light')}
                className={`w-full p-2 rounded-lg text-left font-medium border flex items-center justify-between ${
                  theme === 'light'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-[#E4572E] text-[#E4572E] font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>Light Mode</span>
                {theme === 'light' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`w-full p-2 rounded-lg text-left font-medium border flex items-center justify-between ${
                  theme === 'dark'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-[#E4572E] text-[#E4572E] font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>Dark Mode</span>
                {theme === 'dark' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Temperature Unit */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-slate-400" />
              <span>{t('settings.tempUnit')}</span>
            </label>
            <div className="space-y-1.5">
              <button
                onClick={() => tempUnit !== 'C' && toggleTempUnit()}
                className={`w-full p-2 rounded-lg text-left font-medium border flex items-center justify-between ${
                  tempUnit === 'C'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-[#E4572E] text-[#E4572E] font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>Celsius (°C)</span>
                {tempUnit === 'C' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => tempUnit !== 'F' && toggleTempUnit()}
                className={`w-full p-2 rounded-lg text-left font-medium border flex items-center justify-between ${
                  tempUnit === 'F'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-[#E4572E] text-[#E4572E] font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>Fahrenheit (°F)</span>
                {tempUnit === 'F' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Telemetry Refresh Interval */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Automated Telemetry Polling Frequency:
            </span>
            <span className="text-slate-500 text-[11px]">
              Simulates periodic satellite pass-overs and automated ground weather station sync.
            </span>
          </div>

          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
          >
            <option value={30}>Every 30 seconds</option>
            <option value={60}>Every 1 minute (Recommended)</option>
            <option value={300}>Every 5 minutes</option>
            <option value={900}>Every 15 minutes</option>
          </select>
        </div>
      </Card>

      {/* 3. Database & Storage Architecture Card */}
      <Card className="p-6 space-y-4 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950/50 text-[#0F766E] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                Database & Backend Architecture
              </h2>
              <p className="text-xs text-slate-500">Persistent storage, schema migrations, and sensor calibration status.</p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
            healthStatus?.status === 'ready'
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {healthStatus?.database === 'connected' ? 'PostGIS / DB Connected' : 'Ready'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Storage Engine</span>
            <div className="font-bold text-slate-900 dark:text-white text-sm">PostgreSQL 15 / SQLite</div>
            <div className="text-[11px] text-teal-600 font-semibold">Async SQLAlchemy + Alembic</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">Data Quality Standards</span>
            <div className="font-bold text-slate-900 dark:text-white text-sm">NDMA & IMD Strict</div>
            <div className="text-[11px] text-slate-500">Explicit sample/proxy badges</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium">IoT Sensor Calibration</span>
            <div className="font-bold text-slate-900 dark:text-white text-sm">ESP32 REST Gateway</div>
            <div className="text-[11px] text-teal-600 font-semibold">MAE 1.2°C • RMSE 1.5°C</div>
          </div>
        </div>
      </Card>

      {/* 4. About Sample Data Notice Card */}
      <Card className="p-5 border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Info className="w-4 h-4 text-amber-600" />
          <span>Notice on Demonstration Sample Data</span>
        </div>
        <p className="leading-relaxed">
          HeatSense displays calibrated fixtures for 40 GHMC Hyderabad wards. Surface temperature measurements reflect thermal infrared observations and must not be confused with human-experienced ambient air temperature. Vulnerability factors represent ward-level proxies.
        </p>
      </Card>
    </div>
  );
};
