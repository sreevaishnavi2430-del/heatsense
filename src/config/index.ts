/// <reference types="vite/client" />
import { RiskWeights } from '../types';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const HYDERABAD_CENTER: [number, number] = [17.3850, 78.4867];
export const DEFAULT_MAP_ZOOM = 11;

export const DEFAULT_WEIGHTS: RiskWeights = {
  wTemp: 0.35,
  wTree: 0.20,
  wBuilt: 0.15,
  wVuln: 0.30,
};

export const SUPPORTED_CITIES = [
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', active: true },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', active: false, badge: 'Coming soon' },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', active: false, badge: 'Coming soon' },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', active: false, badge: 'Coming soon' },
  { id: 'delhi', name: 'Delhi NCR', state: 'Delhi', active: false, badge: 'Coming soon' },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', active: false, badge: 'Coming soon' },
];

export const DEMO_NOTICE = 'Sample data shown for demonstration and planning simulation.';
