import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  Satellite,
  Compass,
  Cpu,
  Layers,
  Thermometer,
  Trees,
  Building,
  Users,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { DEFAULT_WEIGHTS } from '../config';

export const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1215] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 space-y-12 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            <span>Scientific Framework & Governance</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
            {t('about.title')}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('about.subtitle')}
          </p>
        </div>

        {/* 1. Heat-Risk Score Formula Explanation */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-[#E4572E] flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-slate-900 dark:text-white">
                {t('about.formulaTitle')}
              </h2>
              <p className="text-xs text-slate-500">Pure multi-criteria weighted spatial indexing model</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 text-white font-mono text-xs sm:text-sm overflow-x-auto leading-relaxed border border-slate-800 shadow-inner">
            <span className="text-amber-400">Score</span> = (
            <span className="text-red-400">wTemp</span> × <span className="text-sky-300">Norm(LST)</span> +{' '}
            <span className="text-emerald-400">wTree</span> × (1 - <span className="text-sky-300">Norm(TreeCover)</span>) +{' '}
            <span className="text-purple-400">wBuilt</span> × <span className="text-sky-300">Norm(BuiltUp)</span> +{' '}
            <span className="text-pink-400">wVuln</span> × <span className="text-sky-300">VulnerabilityIndex</span>) × 100
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            The Heat-Risk Score balances physical environmental exposure with socio-demographic sensitivity. A ward with extreme surface temperatures but wealthy air-conditioned housing will score lower on physiological crisis than an informal settlement where tin roofing and outdoor labor amplify vulnerability.
          </p>

          {/* Default Weights Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Thermal (wTemp)</span>
              <span className="font-heading font-extrabold text-xl text-red-600">35%</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Satellite peak surface temperature</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Canopy Deficit (wTree)</span>
              <span className="font-heading font-extrabold text-xl text-emerald-600">20%</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Lack of vegetative shade</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Built Density (wBuilt)</span>
              <span className="font-heading font-extrabold text-xl text-purple-600">15%</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Impervious asphalt & concrete</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Vulnerability (wVuln)</span>
              <span className="font-heading font-extrabold text-xl text-pink-600">30%</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Elderly, outdoor workers, non-AC</span>
            </div>
          </div>
        </Card>

        {/* 2. Data Sources Grid */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/50 text-[#0F766E] flex items-center justify-center">
              <Satellite className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-slate-900 dark:text-white">
                {t('about.sourcesTitle')}
              </h2>
              <p className="text-xs text-slate-500">Multispectral satellite observation and ground demographics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1.5">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Satellite className="w-4 h-4 text-[#E4572E]" />
                <span>Landsat 8 & 9 Thermal Infrared (TIRS)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Measures true Land Surface Temperature (LST) across Bands 10 & 11 at 100m spatial resolution with atmospheric split-window correction.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1.5">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Trees className="w-4 h-4 text-emerald-600" />
                <span>Sentinel-2 Multispectral Instrument (MSI)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Derives Normalized Difference Vegetation Index (NDVI) and urban tree canopy fraction at 10m spatial resolution.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1.5">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <span>WorldPop & GHMC Census Data</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Provides 100m disaggregated population grids with age cohorts (under 5, over 65) and informal tin roof settlement mapping.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1.5">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-sky-600" />
                <span>OpenStreetMap & Municipal Asset Registries</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Locations of existing drinking water kiosks, transit shade shelters, bus terminals, and government hospitals.
              </p>
            </div>
          </div>
        </Card>

        {/* 3. Validation & Ground Truthing */}
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-slate-900 dark:text-white">
                {t('about.validationTitle')}
              </h2>
              <p className="text-xs text-slate-500">Cross-referencing satellite models against ground measurements</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Satellite thermal imagery measures the skin temperature of rooftops and asphalt roads, which can be 5°C to 12°C hotter than the ambient air people breathe. To validate HeatSense predictions:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border">
              <strong className="block text-slate-900 dark:text-white mb-1">IMD Weather Stations</strong>
              <p className="text-slate-500">Compared against official Begumpet and Shamshabad automated weather stations.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border">
              <strong className="block text-slate-900 dark:text-white mb-1">Low-Cost IoT Ground Sensors</strong>
              <p className="text-slate-500">Pilot solar micro-weather stations deployed at auto stands in Charminar and Uppal.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border">
              <strong className="block text-slate-900 dark:text-white mb-1">Hospital Heat Triage Audits</strong>
              <p className="text-slate-500">Correlated against weekly 108 emergency heat stroke dispatch volumes.</p>
            </div>
          </div>
        </Card>

        {/* 4. Honest Scientific Limitations */}
        <Card className="p-6 sm:p-8 border-amber-300 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/10 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
              {t('about.limitationsTitle')}
            </h2>
          </div>

          <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 list-disc list-inside leading-relaxed">
            <li>
              <strong>Surface vs Air Temperature:</strong> Satellite Land Surface Temperature (LST) is not identical to 2-meter air temperature or wet-bulb heat index. Air temps are estimated via linear regression with ground stations.
            </li>
            <li>
              <strong>Temporal Revisit Frequency:</strong> Landsat satellites overpass every 8 to 16 days. Diurnal curves between overpasses are modeled using solar radiation and hourly weather feeds.
            </li>
            <li>
              <strong>Demonstration Mock Data:</strong> Data currently loaded represents realistic, calibrated sample telemetry generated for the Hack-A-Throne competition. Production deployments integrate live GEOTIFF ingestion.
            </li>
          </ul>
        </Card>

        {/* 5. National Scaling Roadmap */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-slate-900 dark:text-white">
                {t('about.roadmapTitle')}
              </h2>
              <p className="text-xs text-slate-500">Blueprint for scaling HeatSense to 100+ Indian urban agglomerations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl border-2 border-[#E4572E] bg-orange-50/50 dark:bg-orange-950/20 space-y-1.5">
              <Badge variant="risk" riskLevel="High">Phase 1: LIVE</Badge>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1">Hyderabad (GHMC)</h4>
              <p className="text-slate-600 dark:text-slate-400">40 wards, live mock layer, intervention planning, multilingual alerts.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1.5 opacity-85">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Phase 2: Q3 2025</span>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Ahmedabad & Delhi</h4>
              <p className="text-slate-600 dark:text-slate-400">North & West India extreme heatwave corridors with established Heat Action Plans.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1.5 opacity-75">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Phase 3: Q4 2025</span>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Chennai & Mumbai</h4>
              <p className="text-slate-600 dark:text-slate-400">Coastal cities with severe humidity and dangerous wet-bulb temperature spikes.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1.5 opacity-65">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Phase 4: 2026</span>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">National NDMA Integration</h4>
              <p className="text-slate-600 dark:text-slate-400">Standardized API platform for municipal corporations across all Indian states.</p>
            </div>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
};
