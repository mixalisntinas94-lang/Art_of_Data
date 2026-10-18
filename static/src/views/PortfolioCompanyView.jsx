import React from 'react';
import { Briefcase, Building2, TrendingUp, DollarSign, Award } from 'lucide-react';

/**
 * PortfolioCompanyView - C-Level Multi-Project Strategic Scope (Scaffold)
 *
 * Prepared for VP/C-Level cross-project capital allocation and quarterly delivery targets.
 */
export default function PortfolioCompanyView() {
  return (
    <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4 my-6">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 shadow-lg shadow-indigo-500/20">
        <Briefcase className="w-7 h-7" />
      </div>
      <div>
        <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
          Portfolio & Company Scope
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">
          Executive Portfolio & Strategic Capital Allocation
        </h3>
        <p className="text-sm text-slate-400 max-w-lg mx-auto mt-1">
          C-Level leaders will visualize multi-team delivery cadence, quarterly financial burn-downs, and portfolio-wide capacity balance.
        </p>
      </div>

      <div className="pt-4 flex items-center justify-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-indigo-400" /> Multi-Project Rollup
        </span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-indigo-400" /> Investment ROI
        </span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-indigo-400" /> OKR Alignment
        </span>
      </div>
    </div>
  );
}
