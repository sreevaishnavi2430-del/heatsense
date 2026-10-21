import { GOOGLE_MAPS_API_KEY } from '../../config';

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('Add VITE_GOOGLE_MAPS_API_KEY to .env.development and restart Vite.'));
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__heatSenseGoogleMapsReady';
    let settled = false;
    let authTimer: ReturnType<typeof setTimeout>;
    const previousAuthFailure = (window as any).gm_authFailure;
    const cleanup = () => {
      clearTimeout(authTimer);
      delete (window as any)[callbackName];
      if ((window as any).gm_authFailure === onAuthFailure) {
        if (previousAuthFailure) (window as any).gm_authFailure = previousAuthFailure;
        else delete (window as any).gm_authFailure;
      }
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      loadPromise = null;
      reject(new Error(message));
    };
    const onAuthFailure = () => {
      previousAuthFailure?.();
      window.dispatchEvent(new CustomEvent('heatsense:maps-auth-failure'));
      fail('Google Maps rejected this key. Check the Maps JavaScript API and allowed website referrers.');
    };
    (window as any).gm_authFailure = onAuthFailure;
    (window as any)[callbackName] = () => {
      if (settled) return;
      settled = true;
      clearTimeout(authTimer);
      delete (window as any)[callbackName];
      resolve();
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.onerror = () => {
      fail('Google Maps could not load. Check your internet connection, key, enabled Maps JavaScript API, and allowed website referrers.');
    };
    document.head.appendChild(script);
    authTimer = setTimeout(() => fail('Google Maps did not respond. Check your internet connection and API key configuration.'), 12000);
  });
  return loadPromise;
}

declare global {
  interface Window { google?: any; }
}
