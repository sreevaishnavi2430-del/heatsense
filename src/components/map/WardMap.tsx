import React, { useState, useEffect, useMemo, useRef } from 'react';
import { loadGoogleMaps } from './googleMaps';
import { Ward, RiskLevel } from '../../types';
import { HYDERABAD_CENTER, DEFAULT_MAP_ZOOM, GOOGLE_MAPS_API_KEY } from '../../config';
import { getRiskColor, getRiskLevel } from '../../lib/risk';
import { useStore } from '../../store/useStore';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Pause,
  RotateCcw,
  Navigation,
  Droplets,
  Umbrella,
  Building,
  HeartPulse,
  Layers,
  SunMedium,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { LeafletWardMap } from './LeafletWardMap';

export type MapLayerType =
  | 'heat_risk'
  | 'surface_temp'
  | 'tree_cover'
  | 'built_up'
  | 'vulnerable_pop'
  | 'power_stress';

interface WardMapProps {
  wards: Ward[];
  selectedWard: Ward | null;
  onSelectWard: (ward: Ward) => void;
  className?: string;
  hideControls?: boolean;
}

// Custom SVG icon generator for amenities
function createAmenityIcon(type: 'water' | 'shade' | 'cooling' | 'hospital', color: string) {
  const icons = {
    water: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
    shade: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M22 12A10 10 0 0 0 12 2v20a2 2 0 0 0 2-2"/></svg>`,
    cooling: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/></svg>`,
    hospital: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M19 14h-4v4h-6v-4H5v-4h4V6h6v4h4z"/></svg>`,
  };

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="${color}" stroke="white" stroke-width="3"/>${icons[type]}</svg>`)}`;
}

export const WardMap: React.FC<WardMapProps> = ({
  wards,
  selectedWard,
  onSelectWard,
  className,
  hideControls = false,
}) => {
  const { language, weights } = useStore();
  const { t } = useTranslation();

  // Layer selection
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('heat_risk');

  // Amenity overlays
  const [showWater, setShowWater] = useState(false);
  const [showShade, setShowShade] = useState(false);
  const [showCooling, setShowCooling] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);

  // Time of day slider (6 AM to 22 PM -> 6 to 22)
  const [timeHour, setTimeHour] = useState<number>(14); // default 2 PM peak
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [locateTrigger, setLocateTrigger] = useState<number>(0);
  const mapElementRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const polygonRefs = useRef<any[]>([]);
  const markerRefs = useRef<any[]>([]);
  const [mapError, setMapError] = useState('');
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle play/pause of time animation
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setTimeHour((prev) => (prev >= 22 ? 6 : prev + 1));
      }, 1000);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying]);

  // Color mapping based on selected layer
  const getFeatureColor = (ward: Ward) => {
    if (activeLayer === 'heat_risk') {
      return getRiskColor(ward.riskLevel);
    }
    if (activeLayer === 'surface_temp') {
      // Dynamic temperature based on hour
      const tempAtHour = ward.hourlyTemp[timeHour] || ward.landSurfaceTempC;
      if (tempAtHour >= 45) return '#990000';
      if (tempAtHour >= 42) return '#D7263D';
      if (tempAtHour >= 39) return '#F2994A';
      if (tempAtHour >= 36) return '#F2C94C';
      return '#2E9E6B';
    }
    if (activeLayer === 'tree_cover') {
      if (ward.treeCoverPercent >= 20) return '#15803d'; // deep green
      if (ward.treeCoverPercent >= 12) return '#22c55e'; // light green
      if (ward.treeCoverPercent >= 6) return '#eab308'; // yellow
      return '#ef4444'; // low canopy
    }
    if (activeLayer === 'built_up') {
      if (ward.builtUpPercent >= 88) return '#7f1d1d'; // extreme built
      if (ward.builtUpPercent >= 80) return '#b91c1c';
      if (ward.builtUpPercent >= 70) return '#f97316';
      return '#eab308';
    }
    if (activeLayer === 'vulnerable_pop') {
      const vulnScore = (ward.vulnerability.elderlyPercent + ward.vulnerability.outdoorWorkersPercent + ward.vulnerability.lowIncomeHousingPercent) / 3;
      if (vulnScore >= 45) return '#D7263D';
      if (vulnScore >= 35) return '#F2994A';
      if (vulnScore >= 25) return '#F2C94C';
      return '#2E9E6B';
    }
    if (activeLayer === 'power_stress') {
      if (ward.peakDemandStressIndex >= 85) return '#7c3aed';
      if (ward.peakDemandStressIndex >= 70) return '#a855f7';
      if (ward.peakDemandStressIndex >= 55) return '#c084fc';
      return '#94a3b8';
    }
    return '#E4572E';
  };

  useEffect(() => {
    let cancelled = false;
    const handleGoogleAuthFailure = () => setMapError('Google Maps rejected this key; using the OpenStreetMap fallback.');
    window.addEventListener('heatsense:maps-auth-failure', handleGoogleAuthFailure);
    loadGoogleMaps().then(() => {
      if (cancelled || !mapElementRef.current) return;
      googleMapRef.current = new window.google!.maps.Map(mapElementRef.current, {
        center: { lat: HYDERABAD_CENTER[0], lng: HYDERABAD_CENTER[1] },
        zoom: DEFAULT_MAP_ZOOM,
        mapTypeId: 'roadmap',
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
      });
      setMapError('');
    }).catch((error: Error) => { if (!cancelled) setMapError(error.message); });
    return () => { cancelled = true; window.removeEventListener('heatsense:maps-auth-failure', handleGoogleAuthFailure); };
  }, []);

  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;
    polygonRefs.current.forEach((polygon) => polygon.setMap(null));
    polygonRefs.current = wards.map((ward) => {
      const selected = selectedWard?.id === ward.id;
      const color = getFeatureColor(ward);
      const polygon = new window.google!.maps.Polygon({
        paths: ward.polygon.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: selected ? '#1E293B' : color,
        strokeWeight: selected ? 4 : 2,
        fillColor: color,
        fillOpacity: selected ? 0.7 : 0.5,
        map,
      });
      const info = new window.google!.maps.InfoWindow({ content: `<div style="font:13px sans-serif"><b>${ward.name}</b><br/>${ward.zone} Zone · Risk ${ward.heatRiskScore}/100<br/>Surface temperature: ${ward.landSurfaceTempC}°C<br/>Population: ${ward.population.toLocaleString('en-IN')}</div>` });
      polygon.addListener('click', (event: any) => {
        onSelectWard(ward);
        info.setPosition(event.latLng);
        info.open({ map });
      });
      return polygon;
    });
    return () => polygonRefs.current.forEach((polygon) => polygon.setMap(null));
  }, [wards, selectedWard, activeLayer, timeHour, weights, onSelectWard]);

  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;
    markerRefs.current.forEach((marker) => marker.setMap(null));
    const entries: { ward: Ward; type: 'water' | 'shade' | 'cooling' | 'hospital'; lat: number; lng: number }[] = [];
    if (showWater) wards.slice(0, 15).forEach((ward) => entries.push({ ward, type: 'water', lat: ward.centroid[0] + 0.003, lng: ward.centroid[1] - 0.002 }));
    if (showShade) wards.slice(0, 15).forEach((ward) => entries.push({ ward, type: 'shade', lat: ward.centroid[0] - 0.003, lng: ward.centroid[1] + 0.003 }));
    if (showCooling) wards.filter((ward) => ward.amenities.coolingCentres > 0).forEach((ward) => entries.push({ ward, type: 'cooling', lat: ward.centroid[0] + 0.002, lng: ward.centroid[1] + 0.004 }));
    if (showHospitals) wards.slice(0, 12).forEach((ward) => entries.push({ ward, type: 'hospital', lat: ward.centroid[0] - 0.002, lng: ward.centroid[1] - 0.004 }));
    markerRefs.current = entries.map(({ ward, type, lat, lng }) => new window.google!.maps.Marker({
      map, position: { lat, lng }, title: `${type} · ${ward.name}`,
      icon: { url: createAmenityIcon(type, type === 'water' ? '#0284c7' : type === 'shade' ? '#0d9488' : type === 'cooling' ? '#16a34a' : '#e11d48'), scaledSize: new window.google!.maps.Size(32, 32) },
    }));
    return () => markerRefs.current.forEach((marker) => marker.setMap(null));
  }, [wards, showWater, showShade, showCooling, showHospitals]);

  useEffect(() => {
    const map = googleMapRef.current;
    if (map && selectedWard) {
      map.panTo({ lat: selectedWard.centroid[0], lng: selectedWard.centroid[1] });
      map.setZoom(13);
    }
  }, [selectedWard]);

  useEffect(() => {
    if (resetTrigger > 0 && googleMapRef.current) {
      googleMapRef.current.panTo({ lat: HYDERABAD_CENTER[0], lng: HYDERABAD_CENTER[1] });
      googleMapRef.current.setZoom(DEFAULT_MAP_ZOOM);
    }
  }, [resetTrigger]);

  const formatHourString = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayH = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayH}:00 ${period}`;
  };

  const getWardDisplayName = (w: Ward) => {
    if (language === 'te' && w.nameTelugu) return w.nameTelugu;
    if (language === 'hi' && w.nameHindi) return w.nameHindi;
    return w.name;
  };

  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md', className)}>
      {!hideControls && (
        <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Layer Switcher */}
          <div className="bg-white/95 dark:bg-[#121C20]/95 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-auto flex items-center gap-1 overflow-x-auto max-w-full">
            <span className="text-xs font-semibold px-2 text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[#E4572E]" />
              <span className="hidden sm:inline">Layer:</span>
            </span>
            {[
              { id: 'heat_risk', label: 'Heat-Risk' },
              { id: 'surface_temp', label: 'Temperature' },
              { id: 'tree_cover', label: 'Tree Cover' },
              { id: 'built_up', label: 'Built-up' },
              { id: 'vulnerable_pop', label: 'Vulnerability' },
              { id: 'power_stress', label: 'Power Stress' },
            ].map((layer) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id as MapLayerType)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap',
                  activeLayer === layer.id
                    ? 'bg-[#E4572E] text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
                aria-pressed={activeLayer === layer.id}
              >
                {layer.label}
              </button>
            ))}
          </div>

          {/* Quick Map Action Buttons */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetTrigger((prev) => prev + 1)}
              className="bg-white/95 dark:bg-[#121C20]/95 backdrop-blur shadow-md h-8 px-2.5 text-xs gap-1"
              title="Reset Map to Hyderabad Center"
              aria-label="Reset Map to Hyderabad Center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocateTrigger((prev) => prev + 1);
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      googleMapRef.current?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      googleMapRef.current?.setZoom(14);
                    },
                    () => {}
                  );
                }
              }}
              className="bg-white/95 dark:bg-[#121C20]/95 backdrop-blur shadow-md h-8 px-2.5 text-xs gap-1"
              title="Locate Me"
              aria-label="Locate Me"
            >
              <Navigation className="w-3.5 h-3.5 text-[#0F766E]" />
              <span className="hidden sm:inline">Locate</span>
            </Button>
          </div>
        </div>
      )}

      {/* Map Canvas */}
      <div className="relative">
        {(!GOOGLE_MAPS_API_KEY || mapError) ? (
          <>
            <LeafletWardMap
              wards={wards}
              selectedWard={selectedWard}
              onSelectWard={onSelectWard}
              getFeatureColor={getFeatureColor}
              showWater={showWater}
              showShade={showShade}
              showCooling={showCooling}
              showHospitals={showHospitals}
              resetTrigger={resetTrigger}
              locateTrigger={locateTrigger}
              heightClassName="w-full h-[520px] lg:h-[620px] bg-slate-100 dark:bg-slate-900"
            />
            <div className="absolute bottom-2 left-2 z-[500] rounded-md bg-white/95 px-2 py-1 text-[10px] text-slate-600 shadow">
              {mapError ? 'Google Maps unavailable · OpenStreetMap fallback' : 'OpenStreetMap · add a Google key for Google Maps'}
            </div>
          </>
        ) : <div ref={mapElementRef} className="w-full h-[520px] lg:h-[620px] bg-slate-100 dark:bg-slate-900" />}
      </div>

      {/* Floating Bottom Overlays: Time of Day Slider & Amenity Toggles */}
      {!hideControls && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 pointer-events-none">
          {/* Time of Day Slider */}
          <div className="bg-white/95 dark:bg-[#121C20]/95 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-auto flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-lg bg-[#E4572E] text-white hover:bg-[#C7411B] transition-colors"
              aria-label={isPlaying ? 'Pause hourly heat animation' : 'Play hourly heat animation'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <div className="flex flex-col">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <SunMedium className="w-3 h-3 text-amber-500" />
                  Time of Day:
                </span>
                <span className="text-[#E4572E] font-bold">{formatHourString(timeHour)}</span>
              </div>
              <input
                type="range"
                min={6}
                max={22}
                value={timeHour}
                onChange={(e) => setTimeHour(Number(e.target.value))}
                aria-label="Time of Day Slider (6 AM to 10 PM)"
                className="w-36 sm:w-44 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E4572E]"
              />
            </div>
          </div>

          {/* Amenity Overlays Checklist */}
          <div className="bg-white/95 dark:bg-[#121C20]/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-auto flex items-center gap-3 text-xs overflow-x-auto">
            <span className="font-semibold text-slate-500 hidden sm:inline">Amenities:</span>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showWater}
                onChange={(e) => setShowWater(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <Droplets className="w-3.5 h-3.5 text-sky-500" />
              <span>Water</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showShade}
                onChange={(e) => setShowShade(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <Umbrella className="w-3.5 h-3.5 text-teal-500" />
              <span>Shade</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCooling}
                onChange={(e) => setShowCooling(e.target.checked)}
                className="rounded text-green-600 focus:ring-green-500"
              />
              <Building className="w-3.5 h-3.5 text-green-500" />
              <span>Cooling Centers</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showHospitals}
                onChange={(e) => setShowHospitals(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500"
              />
              <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
              <span>Hospitals</span>
            </label>
          </div>

          {/* Dynamic Legend */}
          <div className="bg-white/95 dark:bg-[#121C20]/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-auto flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-slate-500">Scale:</span>
            {activeLayer === 'heat_risk' && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#2E9E6B]" />Low</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#F2C94C]" />Mod</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#F2994A]" />High</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#D7263D]" />Severe</span>
              </div>
            )}
            {activeLayer === 'surface_temp' && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#2E9E6B]" />&lt;36°C</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#F2C94C]" />39°C</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#F2994A]" />42°C</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#D7263D]" />&gt;45°C</span>
              </div>
            )}
            {activeLayer === 'tree_cover' && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />&lt;6%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />12%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />&gt;20%</span>
              </div>
            )}
            {activeLayer === 'built_up' && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />&lt;70%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />80%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#7f1d1d]" />&gt;90%</span>
              </div>
            )}
            {activeLayer === 'power_stress' && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />Low</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />Med</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed]" />Peak</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
