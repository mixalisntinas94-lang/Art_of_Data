import React from 'react';
import { Layers, Rocket, Target, Calendar, CheckCircle2 } from 'lucide-react';

/**
 * ProjectReleaseView - Middle-Tier Milestone & Release Planning Scope (Scaffold)
 *
 * Prepared for Manager-level roadmaps, epic burndowns, and release forecasting.
 */
export default function ProjectReleaseView({ projectKey }) {
  return (
    <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4 my-6">
      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 shadow-lg shadow-blue-500/20">
        <Rocket className="w-7 h-7" />
      </div>
      <div>
        <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-2">
          Project & Release Scope
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">
          Release Readiness & Milestone Forecast
        </h3>
        <p className="text-sm text-slate-400 max-w-lg mx-auto mt-1">
          Engineering managers will track cross-epic burnup, version release confidence, and milestone velocity for <strong>{projectKey}</strong>.
        </p>
      </div>

      <div className="pt-4 flex items-center justify-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Epic Health
        </span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-400" /> Release Dates
        </span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-blue-400" /> Milestone Burnup
        </span>
      </div>
    </div>
  );
}
