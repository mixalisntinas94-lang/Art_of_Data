/**
 * KPI Dynamic Theming & Thresholds Engine
 *
 * Evaluates performance thresholds and returns dynamic colors, borders, glows,
 * and icons across all dashboard cards.
 *
 * Rules:
 * - Pacing & Velocity: Green (on track), Orange (behind schedule, e.g. -9%), Red (critical)
 * - Defect Density: Red (when bugs > 0 or increasing trend), Green (absolute 0)
 * - Estimation Health: Green (at 100%), Orange (when unestimated items exist)
 * - Cycle Time: Green (<= 5 days or fast flow), Orange (> 5 days)
 */

export function getKpiTheme(kpiType, kpis, meta = {}) {
  const sprintTimeElapsed = meta.sprintTimeElapsed ?? 50;
  const completionRate = kpis?.completionRate ?? 0;
  const paceGap = sprintTimeElapsed - completionRate;

  switch (kpiType) {
    case 'completion': {
      if (paceGap > 15 || (completionRate === 0 && sprintTimeElapsed >= 25)) {
        // Red - Critical Pacing Gap
        return {
          status: 'danger',
          colorHex: '#f43f5e',
          topBorderClass: 'border-t-rose-500',
          glowBgClass: 'bg-rose-500/25',
          iconColorClass: 'text-rose-400',
          textColorClass: 'text-rose-400',
          badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
          barClass: 'bg-rose-500',
          label: 'Behind Schedule',
          gap: paceGap,
        };
      } else if (paceGap > 0) {
        // Orange - Behind Schedule (e.g. -9%)
        return {
          status: 'warning',
          colorHex: '#f59e0b',
          topBorderClass: 'border-t-amber-500',
          glowBgClass: 'bg-amber-500/20',
          iconColorClass: 'text-amber-400',
          textColorClass: 'text-amber-400',
          badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          barClass: 'bg-amber-500',
          label: 'Behind Schedule',
          gap: paceGap,
        };
      } else {
        // Green - On Track or Ahead
        return {
          status: 'good',
          colorHex: '#10b981',
          topBorderClass: 'border-t-emerald-500',
          glowBgClass: 'bg-emerald-500/15',
          iconColorClass: 'text-emerald-400',
          textColorClass: 'text-white',
          badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          barClass: 'bg-emerald-500',
          label: 'On Track',
          gap: paceGap,
        };
      }
    }

    case 'velocity': {
      // Dynamic color follows delivery pace
      if (paceGap > 15 || (completionRate === 0 && sprintTimeElapsed >= 25)) {
        return {
          status: 'danger',
          colorHex: '#f43f5e',
          topBorderClass: 'border-t-rose-500',
          glowBgClass: 'bg-rose-500/20',
          iconColorClass: 'text-rose-400',
          textColorClass: 'text-rose-400',
          badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        };
      } else if (paceGap > 0) {
        return {
          status: 'warning',
          colorHex: '#f59e0b',
          topBorderClass: 'border-t-amber-500',
          glowBgClass: 'bg-amber-500/20',
          iconColorClass: 'text-amber-400',
          textColorClass: 'text-amber-400',
          badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        };
      } else {
        return {
          status: 'good',
          colorHex: '#10b981',
          topBorderClass: 'border-t-emerald-500',
          glowBgClass: 'bg-emerald-500/15',
          iconColorClass: 'text-emerald-400',
          textColorClass: 'text-white',
          badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
      }
    }

    case 'defect': {
      const bugCount = kpis?.bugCount ?? 0;
      const bugRatio = kpis?.bugRatio ?? 0;
      if (bugCount > 0 || bugRatio > 0) {
        // Red when any bug exists
        return {
          status: 'danger',
          colorHex: '#f43f5e',
          topBorderClass: 'border-t-rose-500',
          glowBgClass: 'bg-rose-500/25',
          iconColorClass: 'text-rose-400',
          textColorClass: 'text-rose-400',
          badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        };
      } else {
        // Green at absolute 0
        return {
          status: 'good',
          colorHex: '#10b981',
          topBorderClass: 'border-t-emerald-500',
          glowBgClass: 'bg-emerald-500/15',
          iconColorClass: 'text-emerald-400',
          textColorClass: 'text-white',
          badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
      }
    }

    case 'estimation': {
      const unestimated = kpis?.unestimatedPointsCount ?? 0;
      if (unestimated === 0) {
        // Green at 100%
        return {
          status: 'good',
          colorHex: '#10b981',
          topBorderClass: 'border-t-emerald-500',
          glowBgClass: 'bg-emerald-500/20',
          iconColorClass: 'text-emerald-400',
          textColorClass: 'text-white',
          badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
      } else {
        // Orange when unestimated items exist
        return {
          status: 'warning',
          colorHex: '#f59e0b',
          topBorderClass: 'border-t-amber-500',
          glowBgClass: 'bg-amber-500/20',
          iconColorClass: 'text-amber-400',
          textColorClass: 'text-amber-400',
          badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        };
      }
    }

    case 'cycleTime': {
      const avgDays = kpis?.avgCycleTimeDays;
      if (avgDays !== null && avgDays > 5) {
        return {
          status: 'warning',
          colorHex: '#f59e0b',
          topBorderClass: 'border-t-amber-500',
          glowBgClass: 'bg-amber-500/20',
          iconColorClass: 'text-amber-400',
          textColorClass: 'text-amber-400',
          badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        };
      } else {
        return {
          status: 'good',
          colorHex: '#10b981',
          topBorderClass: 'border-t-emerald-500',
          glowBgClass: 'bg-emerald-500/15',
          iconColorClass: 'text-emerald-400',
          textColorClass: 'text-white',
          badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
      }
    }

    default:
      return {
        status: 'neutral',
        colorHex: '#3b82f6',
        topBorderClass: 'border-t-blue-500',
        glowBgClass: 'bg-blue-500/15',
        iconColorClass: 'text-blue-400',
        textColorClass: 'text-white',
        badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      };
  }
}

/**
 * Computes a strictly bound 1:1 timeline sparkline array from live Jira issues.
 * If data is 0 or unchanged throughout the timeline, returns a flat array of identical values.
 */
export function computeLiveSparkline(issues = [], metricType, meta = {}) {
  const pointsCount = 7;
  const now = Date.now();

  // Determine chronological boundaries
  let startMs = meta.startDate ? new Date(meta.startDate).getTime() : null;
  if (!startMs || isNaN(startMs)) {
    // Fallback: earliest issue created date or 14 days ago
    const issueDates = issues
      .map((i) => (i.created ? new Date(i.created).getTime() : null))
      .filter(Boolean);
    startMs = issueDates.length > 0 ? Math.min(...issueDates) : now - 14 * 24 * 3600 * 1000;
  }

  const endMs = meta.endDate ? new Date(meta.endDate).getTime() : now + 7 * 24 * 3600 * 1000;
  const progressEndMs = Math.min(now, endMs);
  const timeSpan = Math.max(1000, progressEndMs - startMs);

  // Generate 7 chronological checkpoints
  const checkpoints = Array.from({ length: pointsCount }, (_, idx) => {
    return startMs + (idx / (pointsCount - 1)) * timeSpan;
  });

  switch (metricType) {
    case 'completion': {
      // Cumulative completion percentage over time
      const totalIssues = issues.length;
      if (totalIssues === 0) return [0, 0, 0, 0, 0, 0, 0];

      const trend = checkpoints.map((chk) => {
        const doneAtChk = issues.filter((i) => {
          if (i.statusCategory !== 'done') return false;
          const resTime = i.resolutiondate
            ? new Date(i.resolutiondate).getTime()
            : i.updated
            ? new Date(i.updated).getTime()
            : null;
          return resTime && resTime <= chk;
        }).length;
        return Math.round((doneAtChk / totalIssues) * 100);
      });

      return trend;
    }

    case 'velocity': {
      // Cumulative delivered Story Points over time
      const trend = checkpoints.map((chk) => {
        let sp = 0;
        issues.forEach((i) => {
          if (i.statusCategory !== 'done') return;
          const resTime = i.resolutiondate
            ? new Date(i.resolutiondate).getTime()
            : i.updated
            ? new Date(i.updated).getTime()
            : null;
          if (resTime && resTime <= chk) {
            sp += Number(i.storyPoints) || 0;
          }
        });
        return Math.round(sp * 10) / 10;
      });

      return trend;
    }

    case 'defects': {
      // Active bugs count over time
      const trend = checkpoints.map((chk) => {
        return issues.filter((i) => {
          const isBug = (i.type || '').toLowerCase().includes('bug');
          if (!isBug) return false;
          const createdTime = i.created ? new Date(i.created).getTime() : startMs;
          if (createdTime > chk) return false;
          // Check if resolved before chk
          if (i.statusCategory === 'done' && i.resolutiondate) {
            const resTime = new Date(i.resolutiondate).getTime();
            if (resTime <= chk) return false;
          }
          return true;
        }).length;
      });

      return trend;
    }

    case 'estimation': {
      // Percentage of issues with story points assigned
      const totalIssues = issues.length;
      if (totalIssues === 0) return [100, 100, 100, 100, 100, 100, 100];

      const trend = checkpoints.map((chk) => {
        const issuesCreated = issues.filter((i) => {
          const createdTime = i.created ? new Date(i.created).getTime() : startMs;
          return createdTime <= chk;
        });
        if (issuesCreated.length === 0) return 100;
        const estimated = issuesCreated.filter(
          (i) => i.storyPoints !== null && i.storyPoints !== undefined && Number(i.storyPoints) >= 0
        ).length;
        return Math.round((estimated / issuesCreated.length) * 100);
      });

      return trend;
    }

    case 'cycleTime': {
      // Running average cycle time in days of completed issues
      const trend = checkpoints.map((chk) => {
        let totalDays = 0;
        let count = 0;
        issues.forEach((i) => {
          if (i.statusCategory !== 'done' || !i.resolutiondate || !i.created) return;
          const resTime = new Date(i.resolutiondate).getTime();
          const createdTime = new Date(i.created).getTime();
          if (resTime <= chk && resTime >= createdTime) {
            totalDays += (resTime - createdTime) / (1000 * 60 * 60 * 24);
            count++;
          }
        });
        return count > 0 ? Math.round((totalDays / count) * 10) / 10 : 0;
      });

      return trend;
    }

    default:
      return [0, 0, 0, 0, 0, 0, 0];
  }
}
