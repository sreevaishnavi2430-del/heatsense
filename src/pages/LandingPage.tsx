import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Flame,
  ArrowRight,
  ShieldAlert,
  ThermometerSun,
  Activity,
  DollarSign,
  Home,
  HardHat,
  Users,
  Compass,
  Zap,
  Layers,
  Sliders,
  BellRing,
  Cpu,
  FileText,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { MiniWardMap } from '../components/map/MiniWardMap';
import { MOCK_WARDS } from '../data/mockData';

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Representative ward for hero preview
  const previewWard = MOCK_WARDS[0]; // Charminar

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1215] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#E4572E]/20 selection:text-[#E4572E]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headlines & CTAs */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-xs font-bold text-[#E4572E] tracking-wide uppercase">
                <Flame className="w-3.5 h-3.5 fill-[#E4572E]" />
                {t('hero.badge')}
              </div>

              <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                {t('hero.headline')}
              </h1>

              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                {t('hero.subheading')}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  className="font-semibold text-base gap-2 shadow-lg shadow-[#E4572E]/25"
                >
                  <span>{t('nav.openDashboard')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/check-my-area')}
                  className="font-semibold text-base gap-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ShieldAlert className="w-4 h-4 text-[#0F766E]" />
                  <span>{t('nav.checkAreaBtn')}</span>
                </Button>
              </div>

              {/* Quick trust metrics */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 text-xs text-slate-500">
                <div>
                  <div className="font-heading font-bold text-lg text-slate-900 dark:text-white">40 Wards</div>
                  <div>Hyderabad GHMC</div>
                </div>
                <div>
                  <div className="font-heading font-bold text-lg text-[#E4572E]">0 - 100</div>
                  <div>Standardized Risk Scale</div>
                </div>
                <div>
                  <div className="font-heading font-bold text-lg text-[#0F766E]">3 Languages</div>
                  <div>English, Telugu, Hindi</div>
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Live Heat Preview Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl p-5 bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Live Telemetry • Old City Core
                    </span>
                  </div>
                  <Badge variant="risk" riskLevel="Severe">
                    Severe Risk
                  </Badge>
                </div>

                {/* Ward map graphic */}
                <div className="mt-3 rounded-xl overflow-hidden shadow-inner">
                  <MiniWardMap ward={previewWard} height="240px" />
                </div>

                {/* Score & quick stats */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-orange-50/70 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Heat-Risk Score</div>
                    <div className="font-heading font-extrabold text-2xl text-[#E4572E] mt-0.5">88 / 100</div>
                    <div className="text-[11px] text-slate-500 mt-1">Severe thermal exposure</div>
                  </div>
                  <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Peak Surface Temp</div>
                    <div className="font-heading font-extrabold text-2xl text-[#0F766E] mt-0.5">45.8°C</div>
                    <div className="text-[11px] text-slate-500 mt-1">Landsat 8/9 Thermal Band</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Key Intervention:</span>
                  <span className="font-bold text-[#E4572E]">Cool Roofs + Shade Corridors</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section (Lancet Statistics) */}
      <section className="py-16 bg-white dark:bg-[#121C20] border-y border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="font-heading font-bold text-3xl text-slate-900 dark:text-white">
              The Reality of Urban Heat in India
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
              Independent climate telemetry proves that extreme heatwaves are no longer future risks — they are active economic and public health emergencies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#FAFAF9] dark:bg-[#0B1215] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/50 text-[#E4572E] flex items-center justify-center mb-4">
                  <ThermometerSun className="w-6 h-6" />
                </div>
                <div className="font-heading font-extrabold text-3xl text-slate-900 dark:text-white">
                  {t('stats.stat1Value')}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                  {t('stats.stat1Desc')}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
                {t('stats.stat1Source')}
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#FAFAF9] dark:bg-[#0B1215] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mb-4">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="font-heading font-extrabold text-3xl text-slate-900 dark:text-white">
                  {t('stats.stat2Value')}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                  {t('stats.stat2Desc')}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
                {t('stats.stat2Source')}
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#FAFAF9] dark:bg-[#0B1215] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-950/50 text-[#0F766E] flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="font-heading font-extrabold text-3xl text-slate-900 dark:text-white">
                  {t('stats.stat3Value')}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                  {t('stats.stat3Desc')}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
                {t('stats.stat3Source')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who Faces This Problem */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="font-heading font-bold text-3xl text-slate-900 dark:text-white">
              {t('whoFaces.title')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
              {t('whoFaces.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-[#E4572E]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-[#E4572E] flex items-center justify-center mb-3">
                <Home className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('whoFaces.group1Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('whoFaces.group1Desc')}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-[#E4572E]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-3">
                <HardHat className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('whoFaces.group2Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('whoFaces.group2Desc')}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-[#E4572E]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('whoFaces.group3Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('whoFaces.group3Desc')}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-[#0F766E]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/40 text-[#0F766E] flex items-center justify-center mb-3">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('whoFaces.group4Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('whoFaces.group4Desc')}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-purple-500/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('whoFaces.group5Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('whoFaces.group5Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How HeatSense Works (4 Steps) */}
      <section id="how-it-works" className="py-20 bg-white dark:bg-[#121C20] border-y border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-heading font-bold text-3xl text-slate-900 dark:text-white">
              {t('howWorks.title')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
              {t('howWorks.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="relative space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E4572E] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-[#E4572E]/30">
                1
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                {t('howWorks.step1Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('howWorks.step1Desc')}
              </p>
            </div>

            <div className="relative space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-amber-500/30">
                2
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                {t('howWorks.step2Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('howWorks.step2Desc')}
              </p>
            </div>

            <div className="relative space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-[#0F766E]/30">
                3
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                {t('howWorks.step3Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('howWorks.step3Desc')}
              </p>
            </div>

            <div className="relative space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-600/30">
                4
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                {t('howWorks.step4Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('howWorks.step4Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="font-heading font-bold text-3xl text-slate-900 dark:text-white">
              {t('features.title')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm">
              <Layers className="w-8 h-8 text-[#E4572E] mb-3" />
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('features.feat1Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('features.feat1Desc')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm">
              <Sliders className="w-8 h-8 text-[#0F766E] mb-3" />
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('features.feat2Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('features.feat2Desc')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm">
              <Cpu className="w-8 h-8 text-amber-500 mb-3" />
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('features.feat3Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('features.feat3Desc')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm">
              <BellRing className="w-8 h-8 text-rose-500 mb-3" />
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('features.feat4Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('features.feat4Desc')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm">
              <Zap className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('features.feat5Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('features.feat5Desc')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-sm">
              <FileText className="w-8 h-8 text-sky-600 mb-3" />
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                {t('features.feat6Title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t('features.feat6Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Outcomes Section */}
      <section id="impact" className="py-20 bg-gradient-to-b from-white to-slate-50 dark:from-[#121C20] dark:to-[#0B1215] border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-slate-900 dark:text-white">
              Demonstrated Municipal Impact
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Transforming urban heat governance from reactive disaster management into predictive resilience.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-3xl font-heading font-extrabold text-[#E4572E]">3.4M+</div>
              <div className="font-bold text-sm text-slate-900 dark:text-white mt-1">High-Risk Citizens Shielded</div>
              <p className="text-xs text-slate-500 mt-2">Targeted shade, cooling centers & water points placed within 400m of vulnerable clusters.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-3xl font-heading font-extrabold text-[#0F766E]">-1.8°C</div>
              <div className="font-bold text-sm text-slate-900 dark:text-white mt-1">Simulated Surface Cooling</div>
              <p className="text-xs text-slate-500 mt-2">Achieved through reflective cool roofs and strategic tree canopy expansion in high-density wards.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-3xl font-heading font-extrabold text-amber-500">140 MW</div>
              <div className="font-bold text-sm text-slate-900 dark:text-white mt-1">Peak Grid Strain Avoided</div>
              <p className="text-xs text-slate-500 mt-2">By lowering indoor thermal load and timing demand response alerts in high-AC neighborhoods.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-3xl font-heading font-extrabold text-indigo-500">100%</div>
              <div className="font-bold text-sm text-slate-900 dark:text-white mt-1">Scalable Architecture</div>
              <p className="text-xs text-slate-500 mt-2">Configurable weights, open satellite telemetry, ready to deploy across 100+ Indian cities.</p>
            </div>
          </div>

          {/* CTA Box */}
          <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-[#E4572E] to-[#C7411B] text-white text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div>
              <h3 className="font-heading font-extrabold text-2xl">Ready to test municipal heat planning?</h3>
              <p className="text-sm opacity-90 mt-1 max-w-xl">
                Explore Hyderabad&apos;s heat risk dashboard or test what-if cooling scenarios with our interactive planner.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="bg-white text-[#E4572E] hover:bg-slate-100 font-bold border-none"
              >
                Launch Dashboard
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
