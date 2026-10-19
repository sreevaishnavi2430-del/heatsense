import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from './CommandPalette';
import { CartDrawer } from './CartDrawer';
import { Footer } from './Footer';

export const OfficerShell: React.FC = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const handleToggleCommand = () => setSearchOpen((prev) => !prev);
    window.addEventListener('toggle-command-palette', handleToggleCommand);
    return () => window.removeEventListener('toggle-command-palette', handleToggleCommand);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1215] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-[#E4572E]/20 selection:text-[#E4572E]">
      {/* Top Bar */}
      <TopBar onOpenSearch={() => setSearchOpen(true)} onOpenCart={() => setCartOpen(true)} />

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-6 focus:outline-none">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Action Plan Basket Drawer */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
};
