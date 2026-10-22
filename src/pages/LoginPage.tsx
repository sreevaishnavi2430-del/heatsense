import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { loginOfficer } from '../services/api';
import { USE_MOCK } from '../config';
import { Flame, Lock, User, ShieldCheck, ArrowRight, Building } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useStore();
  const { toast } = useToast();

  const [name, setName] = useState('Dr. Ramesh Rao, IAS');
  const [department, setDepartment] = useState('GHMC Disaster Management & Urban Resilience');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginOfficer('officer@heatsense.demo', password);
      login(name, department);
      setIsLoading(false);
      toast('Signed In', `Welcome back, ${name}.`, 'success');
      navigate('/dashboard');
    } catch (error) {
      setIsLoading(false);
      toast('Sign In Failed', error instanceof Error ? error.message : 'Unable to sign in.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1215] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Brand */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E4572E] to-amber-500 flex items-center justify-center text-white shadow-lg shadow-[#E4572E]/25">
              <Flame className="w-7 h-7 fill-white" />
            </div>
          </Link>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Heat<span className="text-[#E4572E]">Sense</span> Officer Portal
          </h1>
          <p className="text-xs text-slate-500">
            Greater Hyderabad Municipal Corporation (GHMC) Heat Resilience Platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6 sm:p-8 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-800 dark:text-teal-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#0F766E]" />
            <span>{USE_MOCK ? 'Demo Mode: Any credentials will grant access.' : 'Sign in with your authorized officer account.'}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Officer Name */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Officer Name:</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
              />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>Department / Division:</span>
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Security PIN / Passcode:</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full font-bold text-sm shadow-md shadow-[#E4572E]/25 mt-2"
            >
              <span>Access Heat Dashboard</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="text-center pt-2">
            <Link to="/" className="text-xs text-[#0F766E] hover:underline font-semibold">
              ← Return to Public Landing Page
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
