import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Info, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1215] text-slate-600 dark:text-slate-400 py-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & Purpose */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#E4572E] flex items-center justify-center text-white">
                <Flame className="w-4 h-4 fill-white" />
              </div>
              <span className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                Heat<span className="text-[#E4572E]">Sense</span>
              </span>
            </div>
            <p className="text-sm max-w-md text-slate-500 dark:text-slate-400 leading-relaxed">
              From heat maps to heat action. Hyperlocal heat-risk intelligence and prioritized urban cooling planning for Hyderabad, India. Built for the Hack-A-Throne 2025 competition.
            </p>
            {/* Persistent Sample Data Notice */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Sample Data Status:</strong> Satellite telemetry, demographic layers, and cooling models shown are realistic demonstrations for Hyderabad municipal planning.
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/dashboard" className="hover:text-[#E4572E] transition-colors">
                  Officer Dashboard
                </Link>
              </li>
              <li>
                <Link to="/wards" className="hover:text-[#E4572E] transition-colors">
                  Ward Rankings
                </Link>
              </li>
              <li>
                <Link to="/planner" className="hover:text-[#E4572E] transition-colors">
                  Intervention Planner
                </Link>
              </li>
              <li>
                <Link to="/simulator" className="hover:text-[#E4572E] transition-colors">
                  Cooling Simulator
                </Link>
              </li>
              <li>
                <Link to="/grid" className="hover:text-[#E4572E] transition-colors">
                  Power Grid View
                </Link>
              </li>
            </ul>
          </div>

          {/* Public & Transparency */}
          <div>
            <h4 className="font-heading font-semibold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Citizen & Science
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/check-my-area" className="hover:text-[#0F766E] transition-colors">
                  Check My Area
                </Link>
              </li>
              <li>
                <Link to="/alerts/subscribe" className="hover:text-[#0F766E] transition-colors">
                  Subscribe to Alerts
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#0F766E] transition-colors">
                  Scientific Methodology
                </Link>
              </li>
              <li>
                <a
                  href="https://www.thelancet.com/countdown-on-health-and-climate-change"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#0F766E] transition-colors inline-flex items-center gap-1"
                >
                  <span>Lancet Countdown 2025</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>© 2025 HeatSense • GHMC Urban Heat Resilience Mission • Hack-A-Throne</p>
          <div className="flex items-center gap-4">
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">
              v1.0.0 (Front-End Prototype)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
