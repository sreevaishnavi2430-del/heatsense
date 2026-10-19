import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlerts, sendAlert, getWards, getAlertTemplates, getAlertRules, updateAlertRule } from '../services/api';
import { HeatAlert, AlertLevel, Ward } from '../types';
import { getAlertColor } from '../lib/risk';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import {
  Bell,
  Send,
  Calendar,
  History,
  FileCode,
  Sliders,
  Smartphone,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Check,
  Eye,
  Info,
  HeartPulse,
  Plus,
} from 'lucide-react';

export const AlertCentrePage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const preselectedWard = searchParams.get('ward');

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
  });

  const { data: wards = [] } = useQuery({
    queryKey: ['wards'],
    queryFn: getWards,
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState<'compose' | 'scheduled' | 'history' | 'templates' | 'auto'>('compose');

  // Compose State
  const [selectedWardIds, setSelectedWardIds] = useState<string[]>(
    preselectedWard ? [preselectedWard] : ['charminar', 'yakutpura', 'chandrayangutta']
  );
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('Orange');
  const [channel, setChannel] = useState<'SMS' | 'WhatsApp' | 'both'>('both');
  const [language, setLanguage] = useState<'en' | 'te' | 'hi' | 'all'>('all');
  const [audience, setAudience] = useState<('residents' | 'outdoor_workers' | 'elderly_care')[]>([
    'residents',
    'outdoor_workers',
  ]);
  const [alertTitle, setAlertTitle] = useState('Severe Heatwave Advisory');
  const [messageText, setMessageText] = useState(
    'HEAT ADVISORY: Daytime peak surface temperature in {ward} is forecast to reach {temp}°C at {time}. Drink ample water, avoid direct sun between 12 PM - 4 PM. In case of heat stroke symptoms call 108.'
  );

  // Modal confirmation & sending progress
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);

  // Selected Alert for History Drawer
  const [historyDetailAlert, setHistoryDetailAlert] = useState<HeatAlert | null>(null);

  // Auto-alert rules state
  const { data: dbRules = [] } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: getAlertRules,
  });

  const { data: dbTemplates = [] } = useQuery({
    queryKey: ['alert-templates'],
    queryFn: getAlertTemplates,
  });

  const [autoRules, setAutoRules] = useState([
    { id: 'rule-forecast-43', name: 'Consecutive Peak Heatwave Trigger', condition: 'Forecast surface temp > 43°C for 2 consecutive days', action: 'Auto-draft Orange Alert for affected wards', enabled: true },
    { id: 'rule-red-45', name: 'Extreme Heat Forecast Warning', condition: 'Forecast surface temp >= 45°C', action: 'Auto-dispatch Red Alert to all severe wards', enabled: true },
    { id: 'rule-grid-stress', name: 'High Power Grid Stress Nudge', condition: 'Feeder overload risk index > 85 for 3 consecutive hours', action: 'Dispatch Yellow load-staggering alert', enabled: false },
  ]);

  const activeRules = useMemo(() => {
    if (dbRules.length > 0) {
      return dbRules.map((r: any) => ({
        id: r.id,
        name: r.name,
        condition: typeof r.condition === 'string' ? r.condition : `${r.condition?.metric || 'metric'} ${r.condition?.operator || '>'} ${r.condition?.value || ''}`,
        action: `Dispatch ${r.level} Alert to ${r.wardsScope || 'all'} wards`,
        enabled: Boolean(r.enabled),
      }));
    }
    return autoRules;
  }, [dbRules, autoRules]);

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    setAutoRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !currentEnabled } : r))
    );
    try {
      await updateAlertRule(ruleId, { enabled: !currentEnabled });
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      toast('Rule Updated', `Rule status updated on server.`, 'success');
    } catch {
      // optimistic update maintained
    }
  };

  // Pre-written multi-lingual templates
  const templates = [
    {
      level: 'Red' as AlertLevel,
      title: 'Extreme Heatwave Emergency Warning',
      en: 'RED ALERT: Extreme heatwave forecast exceeding 45°C in {ward}. Avoid direct sun between 11 AM - 4 PM. Free chilled water and shade shelters active. Dial 108 for heat emergencies.',
      te: 'రెడ్ అలర్ట్: {ward} లో నేడు 45°C కంటే ఎక్కువ ఉష్ణోగ్రత నమోదయ్యే అవకాశం ఉంది. ఉదయం 11 నుండి సాయంత్రం 4 గంటల వరకు ఎండలో తిరగవద్దు. అత్యవసర సహాయానికి 108 కి కాల్ చేయండి.',
      hi: 'रेड अलर्ट: {ward} में आज 45°C से अधिक तापमान की संभावना। सुबह 11 से शाम 4 बजे तक धूप से बचें। आपातकालीन स्थिति में 108 पर कॉल करें।',
    },
    {
      level: 'Orange' as AlertLevel,
      title: 'Severe Outdoor Worker Thermal Protection',
      en: 'ORANGE ALERT: High radiant heat in {ward}. Gig and construction workers must take mandatory 15-min shade breaks each hour. Drinking water kiosks open at major road junctions.',
      te: 'ఆరెంజ్ అలర్ట్: {ward} లో తీవ్రమైన వేడి. బహిరంగ కార్మికులు ప్రతి గంటకు 15 నిమిషాల నీడ విరామం తీసుకోవాలి.',
      hi: 'ऑरेंज अलर्ट: {ward} में अत्यधिक गर्मी। निर्माण और डिलीवरी श्रमिकों को हर घंटे 15 मिनट की छाया में ब्रेक लेने की सलाह दी जाती है।',
    },
    {
      level: 'Yellow' as AlertLevel,
      title: 'Midday Heat Caution & Hydration Advisory',
      en: 'YELLOW ADVISORY: Moderate heat wave in {ward} ({temp}°C). Drink 3-4 liters of water, wear light cotton clothing and check on elderly neighbors.',
      te: 'ఎల్లో అలర్ట్: {ward} లో వేడి పెరిగింది ({temp}°C). రోజంతా పుష్కలంగా నీరు త్రాగండి మరియు తేలికపాటి కాటన్ దుస్తులు ధరించండి.',
      hi: 'येलो अलर्ट: {ward} में मध्यम गर्मी ({temp}°C)। दिन भर में 3-4 लीटर पानी पिएं और हल्के सूती कपड़े पहनें।',
    },
  ];

  // Estimated mobile recipients calculation
  const selectedWards = wards.filter((w) => selectedWardIds.includes(w.id));
  const estimatedRecipients = useMemo(() => {
    const totalPop = selectedWards.reduce((acc, w) => acc + w.population, 0);
    // ~65% mobile penetration
    return Math.round(totalPop * 0.65);
  }, [selectedWards]);

  // Helper to substitute placeholders in live preview
  const previewMessage = useMemo(() => {
    const wardNameSample = selectedWards.length > 0 ? selectedWards[0].name : 'Charminar';
    const tempSample = selectedWards.length > 0 ? selectedWards[0].landSurfaceTempC.toString() : '44.8';
    return messageText
      .replace('{ward}', wardNameSample)
      .replace('{temp}', tempSample)
      .replace('{time}', '14:30 PM');
  }, [messageText, selectedWards]);

  const handleSelectAllSevere = () => {
    const severeIds = wards.filter((w) => w.riskLevel === 'Severe').map((w) => w.id);
    setSelectedWardIds(severeIds);
  };

  const handleApplyTemplate = (tpl: any) => {
    setAlertLevel(tpl.level);
    setAlertTitle(tpl.title);
    if (language === 'te') setMessageText(tpl.te);
    else if (language === 'hi') setMessageText(tpl.hi);
    else setMessageText(tpl.en);
    toast('Template Applied', `${tpl.title} loaded into composer.`, 'info');
  };

  const handleSendBroadcast = async () => {
    setIsSending(true);
    setSendProgress(20);

    const interval = setInterval(() => {
      setSendProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          return 95;
        }
        return p + 25;
      });
    }, 150);

    try {
      await sendAlert({
        level: alertLevel,
        title: alertTitle,
        message: messageText,
        wardIds: selectedWardIds,
        wardNames: selectedWards.map((w) => w.name),
        channels: channel === 'both' ? ['SMS', 'WhatsApp'] : [channel],
        language,
        targetAudience: audience,
        recipientsCount: estimatedRecipients,
        status: 'sent',
      });

      clearInterval(interval);
      setSendProgress(100);

      setTimeout(() => {
        setIsSending(false);
        setConfirmModalOpen(false);
        setSendProgress(0);
        queryClient.invalidateQueries({ queryKey: ['alerts'] });
        toast('Alert Broadcasted', `Successfully sent alert to ~${estimatedRecipients.toLocaleString('en-IN')} mobile users.`, 'success');
        setActiveTab('history');
      }, 400);
    } catch (e) {
      clearInterval(interval);
      setIsSending(false);
      toast('Dispatch Failed', 'Telecom gateway error. Please retry.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white flex items-center gap-2">
            <span>Heat Alert Command Centre</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold border border-red-300 dark:border-red-800">
              Telecom Broadcast Gateway
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Compose and dispatch targeted SMS and WhatsApp heatwave advisories in English, Telugu and Hindi.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'compose', label: 'Compose Alert', icon: Send },
          { id: 'scheduled', label: 'Scheduled Alerts (2)', icon: Calendar },
          { id: 'history', label: 'Alert History (10)', icon: History },
          { id: 'templates', label: 'Safety Templates', icon: FileCode },
          { id: 'auto', label: 'Auto-Alert Rules', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-[#E4572E] text-[#E4572E]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: COMPOSE */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Ward selection, level, channels, audience, message */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-5 space-y-5">
              {/* Target Wards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Target Wards ({selectedWardIds.length} selected):
                  </span>
                  <button
                    onClick={handleSelectAllSevere}
                    className="text-xs text-[#E4572E] font-bold hover:underline"
                  >
                    Select All Severe Wards
                  </button>
                </div>

                {/* Multiselect Ward Chips */}
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 max-h-36 overflow-y-auto text-xs">
                  {wards.map((w) => {
                    const isSelected = selectedWardIds.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        onClick={() =>
                          setSelectedWardIds((prev) =>
                            isSelected ? prev.filter((id) => id !== w.id) : [...prev, w.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-[#E4572E] text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{w.name}</span>
                        <span className="text-[9px] opacity-75">({w.riskLevel})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alert Level Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Alert Severity Level:
                </label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {(['Green', 'Yellow', 'Orange', 'Red'] as AlertLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setAlertLevel(lvl)}
                      className={`py-2 rounded-xl font-bold uppercase tracking-wider border transition-all ${
                        alertLevel === lvl
                          ? 'ring-2 ring-offset-2'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: `${getAlertColor(lvl)}20`,
                        color: getAlertColor(lvl),
                        borderColor: getAlertColor(lvl),
                        boxShadow: alertLevel === lvl ? `0 0 10px ${getAlertColor(lvl)}40` : undefined,
                      }}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channels & Language */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Broadcast Channel:
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                  >
                    <option value="both">SMS & WhatsApp (Recommended)</option>
                    <option value="WhatsApp">WhatsApp Broadcast Only</option>
                    <option value="SMS">SMS Gateway Only</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Message Language:
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                  >
                    <option value="all">Multilingual (Auto-routes by user preference)</option>
                    <option value="en">English Only</option>
                    <option value="te">తెలుగు (Telugu Only)</option>
                    <option value="hi">हिन्दी (Hindi Only)</option>
                  </select>
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Target Recipient Segment:
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { id: 'residents', label: 'General Residents', icon: Users },
                    { id: 'outdoor_workers', label: 'Outdoor & Gig Workers', icon: AlertTriangle },
                    { id: 'elderly_care', label: 'Elderly Caregivers & Clinics', icon: HeartPulse },
                  ].map((aud) => {
                    const active = audience.includes(aud.id as any);
                    return (
                      <button
                        key={aud.id}
                        onClick={() =>
                          setAudience((prev) =>
                            active ? prev.filter((a) => a !== aud.id) : [...prev, aud.id as any]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                          active
                            ? 'bg-orange-50 dark:bg-orange-950/40 border-[#E4572E] text-[#E4572E] font-bold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        <span>{aud.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Content with Character Counter */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-800 dark:text-slate-200">
                    Advisory Message Text:
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {messageText.length} characters (approx. {Math.ceil(messageText.length / 160)} SMS segment)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Draft heat advisory with placeholders like {ward}, {temp}, {time}..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                />
                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                  <span>Available placeholders:</span>
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">&#123;ward&#125;</span>
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">&#123;temp&#125;</span>
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">&#123;time&#125;</span>
                </div>
              </div>

              {/* Broadcast Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Estimated Recipients: <strong className="text-slate-900 dark:text-white">{estimatedRecipients.toLocaleString('en-IN')}</strong> mobile devices
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast('Scheduled', 'Alert saved to scheduled dispatch queue.', 'info')}
                    className="text-xs"
                  >
                    Schedule Later
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setConfirmModalOpen(true)}
                    className="text-xs font-bold gap-1.5 shadow-md shadow-[#E4572E]/25"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Broadcast Now</span>
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Preview: Live Phone Mockup with SMS / WhatsApp Toggle */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-[320px] rounded-[36px] bg-slate-900 text-white p-4 shadow-2xl border-4 border-slate-700 relative overflow-hidden">
              {/* Phone Speaker & Camera Notch */}
              <div className="w-32 h-4 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900 mr-2" />
                <div className="w-8 h-1 bg-slate-700 rounded-full" />
              </div>

              {/* Phone Header */}
              <div className="text-center pb-2 border-b border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#E4572E]">
                  GHMC HEAT ALERT SYSTEM
                </span>
                <div className="text-xs font-bold text-slate-300 mt-0.5">
                  {channel === 'WhatsApp' ? 'WhatsApp Verified' : 'SMS Flash Alert'}
                </div>
              </div>

              {/* Message Bubble inside Phone */}
              <div className="mt-4 p-3 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="imd" alertLevel={alertLevel} size="sm">
                    {alertLevel} ALERT
                  </Badge>
                  <span className="text-[10px] text-slate-400">Now</span>
                </div>

                <div className="font-bold text-white text-xs">{alertTitle}</div>

                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {previewMessage}
                </p>

                <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Helpline: 108 / 040-21111111</span>
                  <span>GHMC Disaster Wing</span>
                </div>
              </div>

              {/* Simulated recipient count on phone footer */}
              <div className="mt-8 text-center text-[10px] text-slate-400">
                Audience: {audience.join(', ')} • {channel}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULED ALERTS */}
      {activeTab === 'scheduled' && (
        <Card className="p-5">
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
              Upcoming Scheduled Dispatches
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts
                .filter((a) => a.status === 'scheduled')
                .map((alt) => (
                  <div key={alt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="imd" alertLevel={alt.level} size="sm" />
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{alt.title}</span>
                      </div>
                      <p className="text-slate-500 max-w-2xl">{alt.message}</p>
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          Scheduled for: <strong>{alt.scheduledFor}</strong>
                        </span>
                        <span>•</span>
                        <span>Wards: {alt.wardNames.join(', ')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs text-rose-500">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      {/* TAB 3: ALERT HISTORY */}
      {activeTab === 'history' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-3 py-3">Level</th>
                  <th className="px-4 py-3">Alert Title</th>
                  <th className="px-3 py-3">Channels</th>
                  <th className="px-3 py-3">Wards</th>
                  <th className="px-3 py-3">Recipients</th>
                  <th className="px-3 py-3">Delivered</th>
                  <th className="px-3 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {alerts.map((alt) => (
                  <tr
                    key={alt.id}
                    onClick={() => setHistoryDetailAlert(alt)}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(alt.timestamp).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="imd" alertLevel={alt.level} size="sm" />
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {alt.title}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {alt.channels.join(' + ')}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {alt.wardNames.length} wards
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {alt.recipientsCount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {alt.deliveredPercent}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((tpl, i) => (
            <Card key={i} className="p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="imd" alertLevel={tpl.level} size="sm" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Standard SOP</span>
                </div>
                <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">{tpl.title}</h4>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">English:</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{tpl.en}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">తెలుగు (Telugu):</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{tpl.te}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">हिन्दी (Hindi):</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{tpl.hi}</p>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  handleApplyTemplate(tpl);
                  setActiveTab('compose');
                }}
                className="w-full text-xs font-semibold"
              >
                Use This Template
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 5: AUTO-ALERT RULES */}
      {activeTab === 'auto' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b">
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                Automated Forecast-Triggered Alert Rules
              </h3>
              <p className="text-xs text-slate-500">
                Rule engine automatically drafts or dispatches heat bulletins when threshold conditions are met.
              </p>
            </div>
            <Button size="sm" variant="outline" className="text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Create Rule</span>
            </Button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeRules.map((rule) => (
              <div key={rule.id} className="py-4 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{rule.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rule.enabled
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {rule.enabled ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-300">Trigger:</strong> {rule.condition}
                  </p>
                  <p className="text-[#0F766E] font-medium">
                    <strong className="text-slate-700 dark:text-slate-300">Action:</strong> {rule.action}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggleRule(rule.id, rule.enabled)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0F766E]" />
                </label>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => !isSending && setConfirmModalOpen(false)}
        title="Confirm Emergency Heat Alert Broadcast"
        description="Verify transmission parameters before sending live advisories to municipal telecom gateways."
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Alert Severity:</span>
              <Badge variant="imd" alertLevel={alertLevel} size="sm" />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Target Wards:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{selectedWards.map((w) => w.name).join(', ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Est. Mobile Devices:</span>
              <span className="font-extrabold text-[#E4572E]">{estimatedRecipients.toLocaleString('en-IN')} recipients</span>
            </div>
          </div>

          {isSending && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Broadcasting to network towers...</span>
                <span>{sendProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E4572E] transition-all duration-200"
                  style={{ width: `${sendProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSending}
              onClick={() => setConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSending}
              onClick={handleSendBroadcast}
              className="gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Confirm & Send Broadcast</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* History Detail Drawer */}
      {historyDetailAlert && (
        <Modal
          isOpen={true}
          onClose={() => setHistoryDetailAlert(null)}
          title={historyDetailAlert.title}
          description={`Broadcast Log: ${new Date(historyDetailAlert.timestamp).toLocaleString('en-IN')}`}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="imd" alertLevel={historyDetailAlert.level} />
              <span className="font-bold text-emerald-600">{historyDetailAlert.deliveredPercent}% Delivery Success</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border font-mono">
              {historyDetailAlert.message}
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-500">
              <div>
                <strong>Recipients:</strong> {historyDetailAlert.recipientsCount.toLocaleString('en-IN')}
              </div>
              <div>
                <strong>Channels:</strong> {historyDetailAlert.channels.join(', ')}
              </div>
              <div>
                <strong>Wards:</strong> {historyDetailAlert.wardNames.join(', ')}
              </div>
              <div>
                <strong>Target Audience:</strong> {historyDetailAlert.targetAudience.join(', ')}
              </div>
            </div>

            <Button size="sm" variant="outline" onClick={() => setHistoryDetailAlert(null)} className="w-full">
              Close Audit Log
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
