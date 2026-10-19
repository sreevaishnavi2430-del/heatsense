import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { OfficerShell } from './components/layout/OfficerShell';
import { useStore } from './store/useStore';
import { Loader2 } from 'lucide-react';

// Lazy loaded page components
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const CheckMyAreaPage = lazy(() => import('./pages/CheckMyAreaPage').then((m) => ({ default: m.CheckMyAreaPage })));
const AlertSubscribePage = lazy(() => import('./pages/AlertSubscribePage').then((m) => ({ default: m.AlertSubscribePage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const WardRankingPage = lazy(() => import('./pages/WardRankingPage').then((m) => ({ default: m.WardRankingPage })));
const WardDetailPage = lazy(() => import('./pages/WardDetailPage').then((m) => ({ default: m.WardDetailPage })));
const InterventionPlannerPage = lazy(() => import('./pages/InterventionPlannerPage').then((m) => ({ default: m.InterventionPlannerPage })));
const CoolingSimulatorPage = lazy(() => import('./pages/CoolingSimulatorPage').then((m) => ({ default: m.CoolingSimulatorPage })));
const AlertCentrePage = lazy(() => import('./pages/AlertCentrePage').then((m) => ({ default: m.AlertCentrePage })));
const PowerGridView = lazy(() => import('./pages/PowerGridView').then((m) => ({ default: m.PowerGridView })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SensorValidationPage = lazy(() => import('./pages/SensorValidationPage').then((m) => ({ default: m.SensorValidationPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 1000 * 30,
    },
  },
});

const PageLoadingFallback = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-slate-400 gap-3">
    <Loader2 className="w-8 h-8 animate-spin text-[#E4572E]" />
    <span className="text-xs font-semibold tracking-wider uppercase">Loading HeatSense Telemetry...</span>
  </div>
);

export const App: React.FC = () => {
  const { theme } = useStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/check-my-area" element={<CheckMyAreaPage />} />
                <Route path="/alerts/subscribe" element={<AlertSubscribePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/login" element={<LoginPage />} />

                {/* Officer Routes (wrapped in Shell with Sidebar + Topbar) */}
                <Route element={<OfficerShell />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/wards" element={<ErrorBoundary pageName="Ward Rankings"><WardRankingPage /></ErrorBoundary>} />
                  <Route path="/wards/:wardId" element={<WardDetailPage />} />
                  <Route path="/planner" element={<InterventionPlannerPage />} />
                  <Route path="/simulator" element={<CoolingSimulatorPage />} />
                  <Route path="/alerts" element={<AlertCentrePage />} />
                  <Route path="/grid" element={<PowerGridView />} />
                  <Route path="/sensors" element={<SensorValidationPage />} />
                  <Route path="/reports" element={<ErrorBoundary pageName="Report Builder"><ReportsPage /></ErrorBoundary>} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                {/* 404 Catch-All */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
