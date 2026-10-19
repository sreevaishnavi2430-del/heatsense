import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Flame, ArrowLeft, Home, Compass } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1215] flex flex-col justify-center items-center px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/50 text-[#E4572E] flex items-center justify-center mb-6 shadow-md shadow-[#E4572E]/20">
        <Flame className="w-8 h-8 fill-[#E4572E]" />
      </div>

      <h1 className="font-heading font-extrabold text-7xl text-slate-900 dark:text-white tracking-tight">
        404
      </h1>
      <h2 className="font-heading font-bold text-xl sm:text-2xl text-slate-800 dark:text-slate-200 mt-2">
        Ward or Page Not Found
      </h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
        The municipal thermal map or administrative route you requested could not be located in the current Hyderabad geospatial registry.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <Button variant="outline" size="md" onClick={() => navigate(-1)} className="text-xs font-semibold gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </Button>
        <Button variant="primary" size="md" onClick={() => navigate('/dashboard')} className="text-xs font-semibold gap-1.5">
          <Home className="w-4 h-4" />
          <span>Officer Dashboard</span>
        </Button>
      </div>
    </div>
  );
};
