import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  MapPin,
  ListTodo,
  Cpu,
  BellRing,
  Zap,
  FileText,
  Sliders,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { planItems } = useStore();

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/wards', label: t('nav.wards'), icon: MapPin },
    {
      to: '/planner',
      label: t('nav.planner'),
      icon: ListTodo,
      badge: planItems.length > 0 ? planItems.length : undefined,
    },
    { to: '/simulator', label: t('nav.simulator'), icon: Cpu },
    { to: '/alerts', label: t('nav.alerts'), icon: BellRing },
    { to: '/grid', label: t('nav.grid'), icon: Zap },
    { to: '/sensors', label: 'IoT Sensors', icon: Radio },
    { to: '/reports', label: t('nav.reports'), icon: FileText },
    { to: '/settings', label: t('nav.settings'), icon: Sliders },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-[#121C20] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      {/* Officer Mission Tag */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-[#0F766E] shrink-0" />
          <span>GHMC Heat Resilience 2025</span>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group',
                isActive
                  ? 'bg-[#E4572E] text-white shadow-sm shadow-[#E4572E]/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      'w-5 h-5 transition-transform group-hover:scale-110',
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded-full',
                      isActive ? 'bg-white text-[#E4572E]' : 'bg-[#E4572E] text-white'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Quick stats footer on sidebar */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 space-y-1">
        <div className="flex justify-between">
          <span>Active Wards:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">40 Localities</span>
        </div>
        <div className="flex justify-between">
          <span>Model Standard:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">NDMA / IMD 2025</span>
        </div>
      </div>
    </aside>
  );
};
