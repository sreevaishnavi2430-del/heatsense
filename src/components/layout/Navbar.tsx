import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Flame, Sun, Moon, Globe, Menu, X, ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const { theme, toggleTheme, language, setLanguage } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLangChange = (lang: 'en' | 'te' | 'hi') => {
    setLanguage(lang);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B1215]/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E4572E] to-[#F2994A] flex items-center justify-center text-white shadow-md shadow-[#E4572E]/20 group-hover:scale-105 transition-transform">
            <Flame className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="font-heading font-extrabold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
              Heat<span className="text-[#E4572E]">Sense</span>
            </span>
            <span className="block text-[10px] uppercase font-bold tracking-widest text-[#0F766E] dark:text-[#2dd4bf] -mt-1">
              Hyderabad
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-[#E4572E] transition-colors">
            {t('nav.features')}
          </a>
          <a href="#how-it-works" className="hover:text-[#E4572E] transition-colors">
            {t('nav.howItWorks')}
          </a>
          <a href="#impact" className="hover:text-[#E4572E] transition-colors">
            {t('nav.impact')}
          </a>
          <Link to="/about" className="hover:text-[#E4572E] transition-colors">
            {t('nav.about')}
          </Link>
        </nav>

        {/* Right Tools: Lang, Theme, CTAs */}
        <div className="hidden lg:flex items-center space-x-3">
          {/* Language Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <Globe className="w-3.5 h-3.5 ml-2 text-slate-400" />
            <button
              onClick={() => handleLangChange('en')}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                language === 'en'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => handleLangChange('te')}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                language === 'te'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              తెలుగు
            </button>
            <button
              onClick={() => handleLangChange('hi')}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                language === 'hi'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              हिन्दी
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Public Check My Area */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/check-my-area')}
            className="text-xs font-semibold gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#0F766E]" />
            {t('nav.checkAreaBtn')}
          </Button>

          {/* Officer Dashboard Entry */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-xs font-semibold gap-1.5"
          >
            {t('nav.openDashboard')}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Mobile menu toggle button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121C20] px-4 pt-2 pb-6 space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">Language:</span>
            <div className="flex items-center gap-1">
              {(['en', 'te', 'hi'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLangChange(l)}
                  className={`px-2.5 py-1 text-xs rounded-md font-semibold ${
                    language === l ? 'bg-[#E4572E] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700'
                  }`}
                >
                  {l === 'en' ? 'EN' : l === 'te' ? 'తెలుగు' : 'हिन्दी'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1 text-sm font-medium">
            <Link
              to="/check-my-area"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 font-semibold flex items-center justify-between"
            >
              <span>{t('nav.checkMyArea')}</span>
              <ShieldAlert className="w-4 h-4" />
            </Link>
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg bg-[#E4572E] text-white font-semibold flex items-center justify-between"
            >
              <span>{t('nav.openDashboard')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
              {t('nav.about')}
            </Link>
            <Link to="/alerts/subscribe" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
              {t('nav.subscribe')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
