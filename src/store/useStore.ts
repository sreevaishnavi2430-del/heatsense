import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RiskWeights, PlanItem, RecommendedAction, UserSession } from '../types';
import { DEFAULT_WEIGHTS } from '../config';
import i18n, { LANGUAGE_STORAGE_KEY, SupportedLanguage } from '../i18n';

/** Applies the persisted theme to the document so it survives a page reload. */
function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface AppState {
  // Theme & Language
  theme: 'light' | 'dark';
  language: SupportedLanguage;
  tempUnit: 'C' | 'F';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleTempUnit: () => void;

  // Officer Session
  session: UserSession;
  login: (name?: string, department?: string) => void;
  logout: () => void;

  // Custom Heat-Risk Weights
  weights: RiskWeights;
  setWeights: (weights: Partial<RiskWeights>) => void;
  resetWeights: () => void;

  // Active Dashboard Selection
  selectedWardId: string | null;
  setSelectedWardId: (wardId: string | null) => void;

  // Cart / Intervention Plan Drawer
  planItems: PlanItem[];
  addToPlan: (action: RecommendedAction) => boolean;
  removeFromPlan: (actionId: string) => void;
  clearPlan: () => void;
  reorderPlan: (startIndex: number, endIndex: number) => void;

  // Comparison Tray (up to 3 wards)
  compareWardIds: string[];
  toggleCompareWard: (wardId: string) => void;
  clearCompare: () => void;

  // System status
  refreshInterval: number; // in seconds
  setRefreshInterval: (interval: number) => void;
  lastRefreshed: string;
  triggerRefresh: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      language: 'en',
      tempUnit: 'C',

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        get().setTheme(next);
      },

      setLanguage: (language) => {
        set({ language });
        // Keep i18next in lockstep with the store so translated copy and locale-aware
        // content (ward names, risk labels) never disagree.
        try {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        } catch {
          // Storage can be unavailable in private browsing modes; the in-memory state still applies.
        }
        void i18n.changeLanguage(language);
      },

      toggleTempUnit: () => {
        set((state) => ({ tempUnit: state.tempUnit === 'C' ? 'F' : 'C' }));
      },

      // Fake officer session (initially logged in for smooth demo experience)
      session: {
        isAuthenticated: true,
        user: {
          name: 'Dr. Ramesh Rao, IAS',
          email: 'r.rao@ghmc.gov.in',
          department: 'Disaster Management & Urban Resilience, GHMC',
          role: 'Chief Resilience Officer',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
      },

      login: (name = 'Officer In-Charge', department = 'GHMC Disaster Management') => {
        set({
          session: {
            isAuthenticated: true,
            user: {
              name,
              email: 'officer@ghmc.gov.in',
              department,
              role: 'Municipal Officer',
            },
          },
        });
      },

      logout: () => {
        set({
          session: {
            isAuthenticated: false,
            user: null,
          },
        });
      },

      weights: { ...DEFAULT_WEIGHTS },

      setWeights: (newWeights) => {
        set((state) => ({
          weights: { ...state.weights, ...newWeights },
        }));
      },

      resetWeights: () => {
        set({ weights: { ...DEFAULT_WEIGHTS } });
      },

      selectedWardId: null,
      setSelectedWardId: (selectedWardId) => set({ selectedWardId }),

      planItems: [],

      addToPlan: (action) => {
        const current = get().planItems;
        if (current.some((item) => item.id === action.id)) {
          return false; // already exists
        }
        const planItem: PlanItem = {
          ...action,
          addedAt: new Date().toISOString(),
        };
        set({ planItems: [planItem, ...current] });
        return true;
      },

      removeFromPlan: (actionId) => {
        set((state) => ({
          planItems: state.planItems.filter((i) => i.id !== actionId),
        }));
      },

      clearPlan: () => {
        set({ planItems: [] });
      },

      reorderPlan: (startIndex, endIndex) => {
        set((state) => {
          const result = Array.from(state.planItems);
          const [removed] = result.splice(startIndex, 1);
          result.splice(endIndex, 0, removed);
          return { planItems: result };
        });
      },

      compareWardIds: [],

      toggleCompareWard: (wardId) => {
        set((state) => {
          const exists = state.compareWardIds.includes(wardId);
          if (exists) {
            return { compareWardIds: state.compareWardIds.filter((id) => id !== wardId) };
          }
          if (state.compareWardIds.length >= 3) {
            // max 3
            return state;
          }
          return { compareWardIds: [...state.compareWardIds, wardId] };
        });
      },

      clearCompare: () => {
        set({ compareWardIds: [] });
      },

      refreshInterval: 60,
      setRefreshInterval: (interval) => set({ refreshInterval: interval }),

      lastRefreshed: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      triggerRefresh: () =>
        set({
          lastRefreshed: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        }),
    }),
    {
      name: 'heatsense-storage',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        tempUnit: state.tempUnit,
        weights: state.weights,
        planItems: state.planItems,
        session: state.session,
      }),
      // Rehydrating from localStorage bypasses the action creators, so the theme class
      // and the i18next language have to be re-applied explicitly. Without this, a
      // reload silently resets the dark mode and the active locale.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyTheme(state.theme);
        const language = state.language as SupportedLanguage;
        if (language && i18n.language !== language) {
          try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
          } catch {
            // Ignore storage failures; the in-memory state remains authoritative.
          }
          void i18n.changeLanguage(language);
        }
      },
    }
  )
);
