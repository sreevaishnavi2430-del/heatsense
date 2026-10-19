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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';

export const MobileNav: React.FC = () => {
  const { t } = useTranslation();
  const { planItems } = useStore();

  const navItems = [
    { to: '/dashboard', label: 'Dash', icon: LayoutDashboard },
    { to: '/wards', label: 'Wards', icon: MapPin },
    {
      to: '/planner',
      label: 'Planner',
      icon: ListTodo,
      badge: planItems.length > 0 ? planItems.length : undefined,
    },
    { to: '/simulator', label: 'Sim', icon: Cpu },
    { to: '/alerts', label: 'Alerts', icon: BellRing },
    { to: '/grid', label: 'Grid', icon: Zap },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#121C20]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-1 py-1.5 shadow-lg">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center p-1 rounded-lg text-[10px] font-semibold transition-all relative min-w-[48px]',
              isActive ? 'text-[#E4572E]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <item.icon className={cn('w-5 h-5 mb-0.5', isActive && 'stroke-[2.5]')} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-[#E4572E] text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[50px]">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
