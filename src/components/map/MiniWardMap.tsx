import React, { useEffect, useRef, useState } from 'react';
import { Ward } from '../../types';
import { getRiskColor } from '../../lib/risk';
import { loadGoogleMaps } from './googleMaps';

interface MiniWardMapProps {
  ward: Ward;
  height?: string;
  showNearbyAmenities?: boolean;
}

export const MiniWardMap: React.FC<MiniWardMapProps> = ({ ward, height = '240px' }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let polygon: any;
    let marker: any;
    loadGoogleMaps().then(() => {
      if (cancelled || !elementRef.current) return;
      const center = { lat: ward.centroid[0], lng: ward.centroid[1] };
      const map = new window.google!.maps.Map(elementRef.current, { center, zoom: 13, streetViewControl: false, fullscreenControl: false, mapTypeControl: false });
      const color = getRiskColor(ward.riskLevel);
      polygon = new window.google!.maps.Polygon({ map, paths: ward.polygon.map(([lat, lng]) => ({ lat, lng })), strokeColor: '#1E293B', strokeWeight: 2, fillColor: color, fillOpacity: 0.55 });
      marker = new window.google!.maps.Marker({ map, position: center, title: ward.name });
      setError('');
    }).catch((reason: Error) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; polygon?.setMap(null); marker?.setMap(null); };
  }, [ward]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm" style={{ height }}>
      <div ref={elementRef} className="h-full w-full bg-slate-100 dark:bg-slate-900" />
      {error && <div role="alert" className="absolute inset-0 flex items-center justify-center bg-white/95 p-4 text-center text-xs text-red-700">{error}</div>}
    </div>
  );
};
