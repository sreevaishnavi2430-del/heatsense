import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, ArrowRight, X, LayoutDashboard, Sliders, FileText, Bell, Zap, Cpu } from 'lucide-react';
import { MOCK_WARDS } from '../../data/mockData';
import { Ward } from '../../types';
import { useStore } from '../../store/useStore';
import { getRiskColor } from '../../lib/risk';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSelectedWardId, language } = useStore();

  const pages = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Ward Ranking Table', path: '/wards', icon: MapPin },
    { name: 'Intervention Planner', path: '/planner', icon: ArrowRight },
    { name: 'What-If Cooling Simulator', path: '/simulator', icon: Cpu },
    { name: 'Heat Alert Centre', path: '/alerts', icon: Bell },
    { name: 'Power Grid Stress Monitor', path: '/grid', icon: Zap },
    { name: 'Resilience Report Builder', path: '/reports', icon: FileText },
    { name: 'Settings & Weights', path: '/settings', icon: Sliders },
    { name: 'Public Check My Area', path: '/check-my-area', icon: Search },
    { name: 'Scientific Methodology', path: '/about', icon: FileText },
  ];

  // Filter wards by English, Telugu, Hindi or Zone
  const filteredWards = query.trim()
    ? MOCK_WARDS.filter(
        (w) =>
          w.name.toLowerCase().includes(query.toLowerCase()) ||
          w.nameTelugu.includes(query) ||
          w.nameHindi.includes(query) ||
          w.zone.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const filteredPages = query.trim()
    ? pages.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : pages.slice(0, 4);

  const totalItems = filteredPages.length + filteredWards.length;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open through window event or parent
          window.dispatchEvent(new CustomEvent('toggle-command-palette'));
        }
      }
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectCurrent();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSelectWard = (ward: Ward) => {
    setSelectedWardId(ward.id);
    navigate(`/wards/${ward.id}`);
    onClose();
  };

  const handleSelectPage = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleSelectCurrent = () => {
    if (selectedIndex < filteredPages.length) {
      handleSelectPage(filteredPages[selectedIndex].path);
    } else {
      const wardIndex = selectedIndex - filteredPages.length;
      if (filteredWards[wardIndex]) {
        handleSelectWard(filteredWards[wardIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Global search command palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#121C20] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a ward name (Charminar, చార్మినార్, चारमीनार) or page..."
            aria-label="Search wards or pages"
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {/* Quick Pages */}
          {filteredPages.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Pages & Portals
              </div>
              {filteredPages.map((page, idx) => {
                const isSelected = selectedIndex === idx;
                const Icon = page.icon;
                return (
                  <button
                    key={page.path}
                    onClick={() => handleSelectPage(page.path)}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#E4572E] text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{page.name}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Wards Search Results */}
          {filteredWards.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Wards ({filteredWards.length})
              </div>
              {filteredWards.map((w, idx) => {
                const globalIdx = filteredPages.length + idx;
                const isSelected = selectedIndex === globalIdx;
                const displayName =
                  language === 'te'
                    ? `${w.nameTelugu} (${w.name})`
                    : language === 'hi'
                    ? `${w.nameHindi} (${w.name})`
                    : w.name;

                return (
                  <button
                    key={w.id}
                    onClick={() => handleSelectWard(w)}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#E4572E] text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                      <div>
                        <span className="font-bold">{displayName}</span>
                        <span className="text-[10px] opacity-75 ml-2">[{w.zone} Zone]</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold" style={{ color: isSelected ? 'white' : getRiskColor(w.riskLevel) }}>
                        {w.heatRiskScore}/100
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                        {w.riskLevel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {filteredPages.length === 0 && filteredWards.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching wards or pages found for &quot;{query}&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
