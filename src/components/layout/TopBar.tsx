import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { SUPPORTED_CITIES } from '../../config';
import {
  Flame,
  Globe,
  Sun,
  Moon,
  Bell,
  RefreshCw,
  Search,
  ShoppingCart,
  ChevronDown,
  User,
  LogOut,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { MOCK_ALERTS } from '../../data/mockData';

interface TopBarProps {
  onOpenSearch: () => void;
  onOpenCart: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSearch, onOpenCart }) => {
  const { t, i18n } = useTranslation();
  const {
    theme,
    toggleTheme,
    language,
    setLanguage,
    session,
    logout,
    planItems,
    lastRefreshed,
    triggerRefresh,
  } = useStore();

  const navigate = useNavigate();
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [alertsDropdownOpen, setAlertsDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeAlerts = MOCK_ALERTS.filter((a) => a.status === 'sent' && a.level !== 'Green');

  const handleRefresh = () => {
    setIsRefreshing(true);
    triggerRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleLangChange = (lang: 'en' | 'te' | 'hi') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('heatsense-language', lang);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#121C20] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Logo & Scalable City Selector */}
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-[#E4572E] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Flame className="w-5 h-5 fill-white" />
          </div>
          <span className="font-heading font-extrabold text-lg text-slate-900 dark:text-white hidden sm:inline">
            Heat<span className="text-[#E4572E]">Sense</span>
          </span>
        </Link>

        {/* City Selector with Scalability Indicator */}
        <div className="relative">
          <button
            onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
            aria-expanded={cityDropdownOpen}
            aria-haspopup="true"
          >
            <Building2 className="w-3.5 h-3.5 text-[#0F766E]" />
            <span>Hyderabad</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {cityDropdownOpen && (
            <div className="absolute left-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50 animate-fade-in">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select City / Municipal Corp
              </div>
              {SUPPORTED_CITIES.map((c) => (
                <button
                  key={c.id}
                  disabled={!c.active}
                  onClick={() => setCityDropdownOpen(false)}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between ${
                    c.active
                      ? 'bg-orange-50/60 dark:bg-orange-950/20 text-[#E4572E] font-bold'
                      : 'text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>
                    {c.name}, <span className="text-[10px] opacity-75">{c.state}</span>
                  </span>
                  {c.active ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E4572E] text-white">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Global Search shortcut (Ctrl+K) */}
        <button
          onClick={onOpenSearch}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:border-slate-300 transition-colors w-44 lg:w-56"
          title="Search wards or commands (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="truncate">Search wards...</span>
          <kbd className="ml-auto font-mono text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Refresh time, Alerts bell, Cart drawer, Lang, Theme, User profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Last Refreshed & Sync Button */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <span>Refreshed: {lastRefreshed}</span>
          <button
            onClick={handleRefresh}
            aria-label="Refresh live data"
            className="p-1 hover:text-[#E4572E] transition-colors"
            title="Refresh heat telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#E4572E]' : ''}`} />
          </button>
        </div>

        {/* Action Plan Basket Cart */}
        <button
          onClick={onOpenCart}
          className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          title="Open Action Plan Basket"
          aria-label={`Open Action Plan Basket with ${planItems.length} items`}
        >
          <ShoppingCart className="w-4 h-4 text-[#0F766E]" />
          {planItems.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E4572E] text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {planItems.length}
            </span>
          )}
        </button>

        {/* Active Alerts Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setAlertsDropdownOpen(!alertsDropdownOpen)}
            className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            aria-label="Active heat warnings"
            aria-expanded={alertsDropdownOpen}
          >
            <Bell className="w-4 h-4 text-amber-500" />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {alertsDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="font-heading font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Active Heat Alerts ({activeAlerts.length})
                </span>
                <Link
                  to="/alerts"
                  onClick={() => setAlertsDropdownOpen(false)}
                  className="text-xs text-[#E4572E] font-medium hover:underline"
                >
                  View All
                </Link>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {activeAlerts.map((alt) => (
                  <div key={alt.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-xs">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          alt.level === 'Red' ? 'text-red-500' : 'text-amber-500'
                        }`}
                      />
                      <span className="font-bold text-slate-800 dark:text-slate-100">{alt.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{alt.message}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Wards: {alt.wardNames.slice(0, 2).join(', ')}...</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {alt.deliveredPercent}% delivered
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Language Switcher */}
        <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
          <Globe className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
          {(['en', 'te', 'hi'] as const).map((l) => (
            <button
              key={l}
              onClick={() => handleLangChange(l)}
              className={`px-1.5 py-0.5 text-xs rounded font-medium transition-colors ${
                language === l
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {l === 'en' ? 'EN' : l === 'te' ? 'తె' : 'हि'}
            </button>
          ))}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile Avatar Menu */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="User account menu"
            aria-expanded={userDropdownOpen}
          >
            {session.user?.avatarUrl ? (
              <img
                src={session.user.avatarUrl}
                alt={session.user.name}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <User className="w-4 h-4" />
              </div>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-[#121C20] border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  {session.user?.name || 'Officer'}
                </div>
                <div className="text-[11px] text-[#0F766E] font-medium truncate">
                  {session.user?.department || 'GHMC Resilience'}
                </div>
              </div>
              <div className="py-1 text-xs">
                <Link
                  to="/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300"
                >
                  <span>Platform Settings</span>
                </Link>
                <Link
                  to="/reports"
                  onClick={() => setUserDropdownOpen(false)}
                  className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300"
                >
                  <span>Report Builder</span>
                </Link>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
