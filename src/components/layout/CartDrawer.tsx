import React from 'react';
import { useStore } from '../../store/useStore';
import { useTranslation } from 'react-i18next';
import { X, Trash2, ArrowUp, ArrowDown, Share2, Download, FileText, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatCurrencyLakh } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import Papa from 'papaparse';
import jsPDF from 'jspdf';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { planItems, removeFromPlan, clearPlan, reorderPlan } = useStore();
  const { t } = useTranslation();
  const { toast } = useToast();

  if (!isOpen) return null;

  const totalCost = planItems.reduce((acc, cur) => acc + cur.costLakhINR, 0);
  const peopleProtected = planItems.reduce((acc, cur) => acc + cur.peopleBenefited, 0);
  const avgCooling =
    planItems.length > 0
      ? (planItems.reduce((acc, cur) => acc + cur.coolingBenefitC, 0) / planItems.length).toFixed(1)
      : '0.0';

  const handleShareLink = () => {
    const ids = planItems.map((p) => p.id).join(',');
    const url = `${window.location.origin}/planner?savedPlan=${encodeURIComponent(ids)}`;
    navigator.clipboard.writeText(url);
    toast(t('planner.linkCopied'), 'Action plan URL copied to clipboard!', 'success');
  };

  const handleExportCSV = () => {
    if (planItems.length === 0) return;
    const csvData = planItems.map((item, idx) => ({
      Rank: idx + 1,
      Ward: item.wardName,
      Intervention: item.title,
      Type: item.type,
      Cost_INR_Lakh: item.costLakhINR,
      Cooling_Benefit_C: item.coolingBenefitC,
      People_Benefited: item.peopleBenefited,
      Priority_Score: item.priorityScore,
      Rationale: item.reason,
    }));
    const csvString = Papa.unparse(csvData);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HeatSense-Plan-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast('CSV Exported', 'Plan exported successfully.', 'success');
  };

  const handleExportPDF = () => {
    if (planItems.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('HeatSense Hyderabad - Municipal Cooling Action Plan', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Target Budget: ${formatCurrencyLakh(totalCost)}`, 14, 28);
    doc.text(`People Protected: ${peopleProtected.toLocaleString('en-IN')} | Avg Cooling: ${avgCooling}°C`, 14, 34);

    let y = 46;
    planItems.forEach((item, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. [${item.wardName}] ${item.title}`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cost: ${formatCurrencyLakh(item.costLakhINR)} | Cooling: -${item.coolingBenefitC}°C | Benefited: ${item.peopleBenefited.toLocaleString('en-IN')}`, 14, y + 6);
      doc.text(`Reason: ${item.reason.slice(0, 95)}`, 14, y + 12);
      y += 18;
    });

    doc.save(`HeatSense-Intervention-Plan-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast('PDF Exported', 'Plan PDF generated successfully.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-[#121C20] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                {t('planner.myCart')} ({planItems.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Prioritized municipal cooling portfolio</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Close basket"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-white dark:bg-[#121C20] border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Cost</span>
              <span className="font-extrabold text-[#E4572E] text-sm">{formatCurrencyLakh(totalCost)}</span>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-[#121C20] border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Protected</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                {peopleProtected.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-[#121C20] border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Cooling</span>
              <span className="font-extrabold text-[#0F766E] text-sm">-{avgCooling}°C</span>
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {planItems.length === 0 ? (
              <div className="text-center py-16 px-4">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Your basket is empty</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Click &apos;Add to Plan&apos; on any ward card or run the optimizer in the Intervention Planner.
                </p>
              </div>
            ) : (
              planItems.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 text-xs shadow-xs relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#E4572E] uppercase text-[10px] tracking-wider block">
                        #{index + 1} • {item.wardName}
                      </span>
                      <h4 className="font-semibold text-slate-900 dark:text-white mt-0.5">{item.title}</h4>
                    </div>
                    <button
                      onClick={() => removeFromPlan(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                      title="Remove action"
                      aria-label={`Remove ${item.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{item.reason}</p>
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#E4572E]">{formatCurrencyLakh(item.costLakhINR)}</span>
                    <span className="text-[#0F766E] font-semibold">-{item.coolingBenefitC}°C benefit</span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={index === 0}
                        onClick={() => reorderPlan(index, index - 1)}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                        title="Move Up"
                        aria-label="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        disabled={index === planItems.length - 1}
                        onClick={() => reorderPlan(index, index + 1)}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                        title="Move Down"
                        aria-label="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          {planItems.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  PDF Report
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  CSV Data
                </Button>
              </div>
              <Button variant="secondary" size="sm" onClick={handleShareLink} className="w-full gap-1.5 text-xs font-semibold">
                <Share2 className="w-3.5 h-3.5" />
                {t('planner.shareLink')}
              </Button>
              <button
                onClick={clearPlan}
                className="w-full py-1.5 text-center text-xs text-rose-500 hover:underline"
              >
                {t('planner.clearAll')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
