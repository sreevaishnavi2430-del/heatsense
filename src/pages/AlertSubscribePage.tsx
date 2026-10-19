import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import { getWards, subscribeToAlerts } from '../services/api';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import {
  BellRing,
  CheckCircle2,
  Phone,
  ShieldCheck,
  User,
  MapPin,
  Globe,
  Radio,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const subscriptionSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)' }),
  wardId: z.string().min(1, { message: 'Please select your area/ward' }),
  language: z.enum(['en', 'te', 'hi']),
  userType: z.enum(['resident', 'outdoor_worker', 'caregiver']),
  channel: z.enum(['SMS', 'WhatsApp', 'both']),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must consent to receive emergency heat advisories' }),
  }),
});

type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

export const AlertSubscribePage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const defaultWardId = searchParams.get('ward') || 'charminar';

  const { data: wards = [] } = useQuery({ queryKey: ['wards'], queryFn: getWards });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<SubscriptionFormData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      name: '',
      mobile: '',
      wardId: defaultWardId,
      language: 'en',
      userType: 'resident',
      channel: 'both',
      consent: true,
    },
  });

  const onSubmit = async (data: SubscriptionFormData) => {
    try {
      await subscribeToAlerts(data);
      setSubmittedData(data);
      setIsSubmitted(true);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      toast('Alert Registration Successful', 'You are now subscribed to heat warnings.', 'success');
    } catch (err) {
      toast('Registration Failed', 'Network error. Please try again.', 'error');
    }
  };

  const selectedWardObj = wards.find((w) => w.id === submittedData?.wardId);

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1215] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 space-y-8 animate-fade-in">
        {!isSubmitted ? (
          <>
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E4572E] to-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-[#E4572E]/25">
                <BellRing className="w-6 h-6" />
              </div>
              <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-slate-900 dark:text-white">
                {t('subscribe.title')}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                {t('subscribe.subtitle')}
              </p>
            </div>

            {/* Form Card */}
            <Card className="p-6 sm:p-8 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800 shadow-xl">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-xs">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('subscribe.name')}</span>
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    placeholder="Enter your full name..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                  />
                  {errors.name && <p className="text-rose-500 text-[11px] font-medium">{errors.name.message}</p>}
                </div>

                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('subscribe.mobile')}</span>
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold text-xs">
                      +91
                    </span>
                    <input
                      type="tel"
                      {...register('mobile')}
                      placeholder="98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-r-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                    />
                  </div>
                  {errors.mobile && <p className="text-rose-500 text-[11px] font-medium">{errors.mobile.message}</p>}
                </div>

                {/* Ward Autocomplete Dropdown */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('subscribe.ward')}</span>
                  </label>
                  <select
                    {...register('wardId')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.nameTelugu} • {w.zone} Zone)
                      </option>
                    ))}
                  </select>
                  {errors.wardId && <p className="text-rose-500 text-[11px] font-medium">{errors.wardId.message}</p>}
                </div>

                {/* Language Selection */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('subscribe.language')}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'en', label: 'English' },
                      { id: 'te', label: 'తెలుగు (Telugu)' },
                      { id: 'hi', label: 'हिन्दी (Hindi)' },
                    ].map((l) => (
                      <label
                        key={l.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-2 cursor-pointer font-semibold"
                      >
                        <input
                          type="radio"
                          value={l.id}
                          {...register('language')}
                          className="text-[#E4572E] focus:ring-[#E4572E]"
                        />
                        <span>{l.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Who Are You? */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    {t('subscribe.whoAreYou')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'resident', label: t('subscribe.resident') },
                      { id: 'outdoor_worker', label: t('subscribe.worker') },
                      { id: 'caregiver', label: t('subscribe.caregiver') },
                    ].map((item) => (
                      <label
                        key={item.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          value={item.id}
                          {...register('userType')}
                          className="text-[#E4572E] focus:ring-[#E4572E]"
                        />
                        <span className="font-medium text-[11px]">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Communication Channel */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    {t('subscribe.channel')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'both', label: 'SMS & WhatsApp' },
                      { id: 'WhatsApp', label: 'WhatsApp Only' },
                      { id: 'SMS', label: 'SMS Only' },
                    ].map((c) => (
                      <label
                        key={c.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-2 cursor-pointer font-semibold"
                      >
                        <input
                          type="radio"
                          value={c.id}
                          {...register('channel')}
                          className="text-[#E4572E] focus:ring-[#E4572E]"
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('consent')}
                      className="mt-0.5 rounded text-[#E4572E] focus:ring-[#E4572E]"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t('subscribe.consent')}
                    </span>
                  </label>
                  {errors.consent && (
                    <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.consent.message}</p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  isLoading={isSubmitting}
                  className="w-full font-bold text-sm shadow-md shadow-[#E4572E]/25 mt-4"
                >
                  {t('subscribe.submit')}
                </Button>
              </form>
            </Card>
          </>
        ) : (
          /* SUCCESS CONFIRMATION SCREEN */
          <Card className="p-8 sm:p-12 text-center space-y-6 bg-white dark:bg-[#121C20] border-slate-200 dark:border-slate-800 shadow-2xl animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
                {t('subscribe.successTitle')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                {t('subscribe.successDesc')}
              </p>
            </div>

            {/* Simulated Confirmation SMS Preview */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-left max-w-md mx-auto font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Sender: GHMC-HEAT</span>
                <span>Just now</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                Namaste {submittedData?.name}! You have successfully registered for GHMC HeatSense alerts for {selectedWardObj?.name}. You will receive proactive warnings prior to severe heat spikes. Stay cool!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/check-my-area')}
                className="text-xs font-semibold gap-1.5"
              >
                <span>Check Heat Risk for Another Area</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsSubmitted(false)}
                className="text-xs"
              >
                Subscribe Another Number
              </Button>
            </div>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
};
