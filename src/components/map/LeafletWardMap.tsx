import React, { useEffect } from 'react';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap } from 'react-leaflet';
import { HYDERABAD_CENTER, DEFAULT_MAP_ZOOM } from '../../config';
import { Ward } from '../../types';

interface LeafletWardMapProps {
  wards: Ward[];
  selectedWard: Ward | null;
  onSelectWard: (ward: Ward) => void;
  getFeatureColor: (ward: Ward) => string;
  showWater: boolean;
  showShade: boolean;
  showCooling: boolean;
  showHospitals: boolean;
  resetTrigger: number;
  locateTrigger: number;
  heightClassName: string;
}

function MapCamera({ selectedWard, resetTrigger, locateTrigger }: Pick<LeafletWardMapProps, 'selectedWard' | 'resetTrigger' | 'locateTrigger'>) {
  const map = useMap();

  useEffect(() => {
    if (selectedWard) map.flyTo(selectedWard.centroid, 13, { duration: 0.5 });
  }, [map, selectedWard]);

  useEffect(() => {
    if (resetTrigger > 0) map.flyTo(HYDERABAD_CENTER, DEFAULT_MAP_ZOOM, { duration: 0.5 });
  }, [map, resetTrigger]);

  useEffect(() => {
    if (!locateTrigger || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      map.flyTo([coords.latitude, coords.longitude], 14, { duration: 0.5 });
    }, () => undefined, { enableHighAccuracy: true, timeout: 8000 });
  }, [map, locateTrigger]);

  return null;
}

const amenityOverlays = (wards: Ward[], flags: Pick<LeafletWardMapProps, 'showWater' | 'showShade' | 'showCooling' | 'showHospitals'>) => {
  const markers: { ward: Ward; label: string; position: [number, number]; color: string }[] = [];
  if (flags.showWater) wards.slice(0, 15).forEach((ward) => markers.push({ ward, label: 'Water point · sample location', position: [ward.centroid[0] + 0.003, ward.centroid[1] - 0.002], color: '#0284c7' }));
  if (flags.showShade) wards.slice(0, 15).forEach((ward) => markers.push({ ward, label: 'Shade shelter · sample location', position: [ward.centroid[0] - 0.003, ward.centroid[1] + 0.003], color: '#0d9488' }));
  if (flags.showCooling) wards.filter((ward) => ward.amenities.coolingCentres > 0).forEach((ward) => markers.push({ ward, label: 'Cooling centre · sample location', position: [ward.centroid[0] + 0.002, ward.centroid[1] + 0.004], color: '#16a34a' }));
  if (flags.showHospitals) wards.slice(0, 12).forEach((ward) => markers.push({ ward, label: 'Hospital · sample location', position: [ward.centroid[0] - 0.002, ward.centroid[1] - 0.004], color: '#e11d48' }));
  return markers;
}

export const LeafletWardMap: React.FC<LeafletWardMapProps> = ({
  wards,
  selectedWard,
  onSelectWard,
  getFeatureColor,
  showWater,
  showShade,
  showCooling,
  showHospitals,
  resetTrigger,
  locateTrigger,
  heightClassName,
}) => {
  const markers = amenityOverlays(wards, { showWater, showShade, showCooling, showHospitals });

  return (
    <div className={heightClassName}>
      <MapContainer center={HYDERABAD_CENTER} zoom={DEFAULT_MAP_ZOOM} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapCamera selectedWard={selectedWard} resetTrigger={resetTrigger} locateTrigger={locateTrigger} />
        {wards.map((ward) => (
          <Polygon
            key={ward.id}
            positions={ward.polygon}
            pathOptions={{ color: selectedWard?.id === ward.id ? '#1E293B' : getFeatureColor(ward), weight: selectedWard?.id === ward.id ? 4 : 2, fillColor: getFeatureColor(ward), fillOpacity: selectedWard?.id === ward.id ? 0.7 : 0.5 }}
            eventHandlers={{ click: () => onSelectWard(ward) }}
          >
            <Popup>
              <strong>{ward.name}</strong><br />
              {ward.zone} Zone · Risk {ward.heatRiskScore}/100<br />
              Sample surface temperature: {ward.landSurfaceTempC}°C<br />
              Population fixture: {ward.population.toLocaleString('en-IN')}
            </Popup>
          </Polygon>
        ))}
        {markers.map(({ ward, label, position, color }, index) => (
          <CircleMarker key={`${ward.id}-${label}-${index}`} center={position} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }}>
            <Popup>{label}<br />{ward.name}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};
