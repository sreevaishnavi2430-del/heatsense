import { GOOGLE_MAPS_API_KEY } from '../../config';

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('Add VITE_GOOGLE_MAPS_API_KEY to .env.development and restart Vite.'));
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__heatSenseGoogleMapsReady';
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      resolve();
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      delete (window as any)[callbackName];
      reject(new Error('Google Maps could not load. Check the key, enabled Maps JavaScript API, and allowed website referrers.'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

declare global {
  interface Window { google?: any; }
}
