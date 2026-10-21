import React, { useEffect, useRef, useState } from 'react';
import { Ward } from '../../types';
import { getRiskColor } from '../../lib/risk';
import { loadGoogleMaps } from './googleMaps';
import { GOOGLE_MAPS_API_KEY } from '../../config';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer } from 'react-leaflet';

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
    const handleGoogleAuthFailure = () => setError('Google Maps rejected this key.');
    window.addEventListener('heatsense:maps-auth-failure', handleGoogleAuthFailure);
    loadGoogleMaps().then(() => {
      if (cancelled || !elementRef.current) return;
      const center = { lat: ward.centroid[0], lng: ward.centroid[1] };
      const map = new window.google!.maps.Map(elementRef.current, { center, zoom: 13, streetViewControl: false, fullscreenControl: false, mapTypeControl: false });
      const color = getRiskColor(ward.riskLevel);
      polygon = new window.google!.maps.Polygon({ map, paths: ward.polygon.map(([lat, lng]) => ({ lat, lng })), strokeColor: '#1E293B', strokeWeight: 2, fillColor: color, fillOpacity: 0.55 });
      marker = new window.google!.maps.Marker({ map, position: center, title: ward.name });
      setError('');
    }).catch((reason: Error) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; window.removeEventListener('heatsense:maps-auth-failure', handleGoogleAuthFailure); polygon?.setMap(null); marker?.setMap(null); };
  }, [ward]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm" style={{ height }}>
      {(!GOOGLE_MAPS_API_KEY || error) ? (
        <>
          <MapContainer center={ward.centroid} zoom={13} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polygon positions={ward.polygon} pathOptions={{ color: '#1E293B', weight: 2, fillColor: getRiskColor(ward.riskLevel), fillOpacity: 0.55 }}>
              <Popup>{ward.name} · {ward.riskLevel} risk (sample indicators)</Popup>
            </Polygon>
            <CircleMarker center={ward.centroid} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: getRiskColor(ward.riskLevel), fillOpacity: 1 }}>
              <Popup>{ward.name}</Popup>
            </CircleMarker>
          </MapContainer>
          <div className="absolute bottom-1 left-1 z-[500] rounded bg-white/90 px-1.5 py-0.5 text-[9px] text-slate-600">OpenStreetMap fallback</div>
        </>
      ) : <div ref={elementRef} className="h-full w-full bg-slate-100 dark:bg-slate-900" />}
    </div>
  );
};
