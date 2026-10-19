import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getWards, checkMyArea } from '../services/api';
import { Ward } from '../types';
import { useStore } from '../store/useStore';
import { getRiskColor, getRiskLevel } from '../lib/risk';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { MiniWardMap } from '../components/map/MiniWardMap';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Search,
  Navigation,
  ThermometerSun,
  Droplets,
  Umbrella,
  Building,
  Bell,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { formatTemp } from '../lib/utils';

export const CheckMyAreaPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tempUnit, language } = useStore();

  const { data: wards = [], isLoading } = useQuery({
    queryKey: ['wards'],
    queryFn: getWards,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWardId, setSelectedWardId] = useState<string>('charminar');
  const [isLocating, setIsLocating] = useState(false);
  const [apiAreaResult, setApiAreaResult] = useState<any>(null);

  // Matched ward
  const currentWard = useMemo(() => {
    if (!searchQuery.trim()) {
      return wards.find((w) => w.id === selectedWardId) || wards[0] || null;
    }
    const match = wards.find(
      (w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.nameTelugu.includes(searchQuery) ||
        w.nameHindi.includes(searchQuery)
    );
    return match || wards.find((w) => w.id === selectedWardId) || wards[0] || null;
  }, [wards, searchQuery, selectedWardId]);

  const handleUseLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setIsLocating(false);
          try {
            const res = await checkMyArea({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            if (res && res.ward) {
              setApiAreaResult(res);
              setSelectedWardId(res.ward.id);
              setSearchQuery('');
              return;
            }
          } catch {
            // fallback
          }
          setSelectedWardId('khairatabad');
          setSearchQuery('');
        },
        () => {
          setIsLocating(false);
          setSelectedWardId('charminar');
        }
      );
    } else {
      setIsLocating(false);
    }
  };

  const getWardDisplayName = (w: Ward) => {
    if (language === 'te' && w.nameTelugu) return w.nameTelugu;
    if (language === 'hi' && w.nameHindi) return w.nameHindi;
    return w.name;
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1215] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-fade-in">
        {/* Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('checkMyArea.badge')}</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
            {t('checkMyArea.title')}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            {t('checkMyArea.subtitle')}
          </p>
        </div>

        {/* Search Bar & Use Location Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-[#121C20] p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('checkMyArea.searchPlaceholder')}
              className="w-full pl-11 pr-4 py-2.5 bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          <Button
            variant="outline"
            size="md"
            isLoading={isLocating}
            onClick={handleUseLocation}
            className="w-full sm:w-auto text-xs sm:text-sm font-semibold gap-2 border-slate-300 dark:border-slate-700 whitespace-nowrap"
          >
            <Navigation className="w-4 h-4 text-[#0F766E]" />
            <span>{t('checkMyArea.useLocation')}</span>
          </Button>
        </div>

        {/* Quick Area Pill Suggestions */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-400">Popular localities:</span>
          {['Charminar', 'Uppal', 'Dilsukhnagar', 'Kukatpally', 'Madhapur', 'Secunderabad'].map((name) => (
            <button
              key={name}
              onClick={() => {
                setSearchQuery(name);
              }}
              className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#E4572E] hover:text-white transition-colors"
            >
              {name}
            </button>
          ))}
        </div>

        {/* Big Result Card */}
        {currentWard && (
          <div className="bg-white dark:bg-[#121C20] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-slide-up">
            {/* Top Card Banner */}
            <div
              className="p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              style={{
                backgroundColor:
                  currentWard.riskLevel === 'Severe'
                    ? '#D7263D'
                    : currentWard.riskLevel === 'High'
                    ? '#F2994A'
                    : currentWard.riskLevel === 'Moderate'
                    ? '#d97706'
                    : '#2E9E6B',
              }}
            >
              <div>
                <span className="text-xs uppercase font-bold tracking-widest opacity-90 block">
                  {currentWard.zone} Zone, Hyderabad
                </span>
                <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mt-1">
                  {getWardDisplayName(currentWard)}
                </h2>
                <p className="text-sm opacity-95 mt-1 font-medium">
                  {t('checkMyArea.todayLevel')}: <strong>{currentWard.riskLevel} Danger</strong>
                </p>
              </div>

              <div className="text-left sm:text-right bg-black/15 p-4 rounded-2xl backdrop-blur-xs">
                <span className="text-[11px] uppercase font-bold tracking-wider opacity-90 block">
                  {t('checkMyArea.peakTemp')}
                </span>
                <span className="font-heading font-extrabold text-3xl sm:text-4xl">
                  {formatTemp(currentWard.landSurfaceTempC, tempUnit)}
                </span>
                <span className="text-xs block opacity-90 mt-0.5">
                  Hottest: 12:00 PM – 4:00 PM
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-8">
              {/* Safety Tips (Plain Language in Selected Language) */}
              <div className="space-y-3">
                <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{t('checkMyArea.safetyTips')}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="leading-relaxed">{t('safety.tip1')}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="leading-relaxed">{t('safety.tip2')}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="leading-relaxed">{t('safety.tip3')}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <p className="leading-relaxed">{t('safety.tip5')}</p>
                  </div>
                </div>
              </div>

              {/* Nearest Cooling & Hydration Amenities */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                  {t('checkMyArea.nearestCooling')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 space-y-1">
                    <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-bold text-sm">
                      <Droplets className="w-4 h-4" />
                      <span>Free Water Kiosk</span>
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {currentWard.name} Bus Depot Junction
                    </div>
                    <div className="text-[11px] text-sky-600 font-medium">180m {t('checkMyArea.distance')} • Free Ro Water</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50 space-y-1">
                    <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300 font-bold text-sm">
                      <Umbrella className="w-4 h-4" />
                      <span>Shade Canopy</span>
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      Auto Stand & Market Road
                    </div>
                    <div className="text-[11px] text-teal-600 font-medium">320m {t('checkMyArea.distance')} • Benches & Fans</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                      <Building className="w-4 h-4" />
                      <span>Cooling Center</span>
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      GHMC Community Hall
                    </div>
                    <div className="text-[11px] text-emerald-600 font-medium">650m {t('checkMyArea.distance')} • Air Conditioned</div>
                  </div>
                </div>
              </div>

              {/* Ward Mini Map */}
              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Area Map View:
                </span>
                <MiniWardMap ward={currentWard} height="200px" />
              </div>

              {/* CTA to Subscribe */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 text-center sm:text-left">
                  Want early morning SMS or WhatsApp warnings when heat crosses 42°C in {currentWard.name}?
                </div>
                <Button
                  size="md"
                  onClick={() => navigate(`/alerts/subscribe?ward=${currentWard.id}`)}
                  className="font-bold text-xs gap-2 shadow-md shadow-[#E4572E]/20 shrink-0 w-full sm:w-auto"
                >
                  <Bell className="w-4 h-4" />
                  <span>{t('checkMyArea.getAlertsBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
