import React, { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Radar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  UserCheck,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
  Layers,
  ArrowRightCircle,
  UserPlus,
} from 'lucide-react';
import { useFilterStore } from '../../store/useFilterStore';
import {
  getSemanticColor,
  getSemanticIcon,
  getInitialsAvatar,
  COLOR_DICTIONARY,
} from '../../utils/colorDictionary';
import { invoke } from '@forge/bridge';

/**
 * Standard Status Categories helper
 */
function getStatusCategoryKey(statusName) {
  const s = String(statusName || '').toLowerCase();
  if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'done';
  if (s.includes('progress') || s.includes('review') || s.includes('testing')) return 'indeterminate';
  return 'new';
}

/**
 * DrillDownInspectorTable - Reactive Master-Detail Inspector Component
 *
 * Implements:
 * 1. Immediate Zustand Global State binding (re-renders on chart clicks)
 * 2. Default Idle "Radar" mode for high-risk / blocker / stale tickets
 * 3. TanStack Table with native multi-column sorting, search & pagination
 * 4. Inline actionability (Status transition & Re-assigning with optimistic UI updates)
 */
export default function DrillDownInspectorTable({
  issues = [],
  onUpdateIssue,
  projectKey,
  assigneesList = [],
  statusesList = ['To Do', 'In Progress', 'Done'],
}) {
  // Global cross-filtering state
  const {
    selectedType,
    selectedStatus,
    selectedAssignee,
    selectedPriority,
    setSelectedType,
    setSelectedStatus,
    setSelectedAssignee,
    setSelectedPriority,
    resetFilters,
    hasActiveFilters,
  } = useFilterStore();

  const isCrossFiltered = hasActiveFilters();

  // Component UI State
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [idleMode, setIdleMode] = useState('radar'); // 'radar' | 'all'
  const [sorting, setSorting] = useState([{ id: 'priorityRank', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [activeDropdown, setActiveDropdown] = useState(null); // { type: 'status' | 'assignee', issueKey }
  const [actionSuccess, setActionSuccess] = useState({}); // { [issueKey]: message }

  // Auto-expand whenever user clicks on an ECharts slice / cross-filter
  useEffect(() => {
    if (isCrossFiltered) {
      setIsCollapsed(false);
    }
  }, [isCrossFiltered, selectedType, selectedStatus, selectedAssignee, selectedPriority]);

  // Derive unique assignees if list not supplied
  const availableAssignees = useMemo(() => {
    if (assigneesList && assigneesList.length > 0) return assigneesList;
    const names = new Set();
    issues.forEach((i) => {
      if (i.assignee) names.add(i.assignee);
    });
    return Array.from(names);
  }, [assigneesList, issues]);

  // Map assignees to avatar URLs
  const assigneeAvatarMap = useMemo(() => {
    const map = {};
    issues.forEach((i) => {
      if (i.assignee && i.avatarUrl) {
        map[i.assignee] = i.avatarUrl;
      }
    });
    return map;
  }, [issues]);

  // ── 1. COMPUTE DISPLAY ISSUES (Cross-Filtered vs Radar vs All) ──
  const displayIssues = useMemo(() => {
    // When cross-filtered by canvas charts: STRICT ISOLATION
    if (isCrossFiltered) {
      return issues.filter((issue) => {
        if (selectedType && issue.type !== selectedType) return false;
        if (selectedAssignee && issue.assignee !== selectedAssignee) return false;
        if (selectedPriority && (issue.priority || 'Medium') !== selectedPriority) return false;
        if (selectedStatus) {
          const cat = issue.statusCategory;
          const sName = (issue.status || '').toLowerCase();
          if (selectedStatus === 'Done' && cat !== 'done' && !sName.includes('done')) return false;
          if (selectedStatus === 'In Progress' && cat !== 'indeterminate' && !sName.includes('progress')) return false;
          if (selectedStatus === 'To Do' && cat !== 'new' && cat !== 'undefined' && !sName.includes('to do')) return false;
        }
        return true;
      });
    }

    // Default Idle State: RADAR Mode (Blockers, Stale, High Risk)
    if (idleMode === 'radar') {
      return issues.filter((issue) => {
        const isStale = issue.isStale || (issue.daysInactive !== undefined && issue.daysInactive >= 3);
        const p = (issue.priority || '').toLowerCase();
        const isHighRiskPriority = p === 'highest' || p === 'high';
        const isBug = (issue.type || '').toLowerCase().includes('bug');
        const notDone = issue.statusCategory !== 'done';
        return isStale || (isHighRiskPriority && notDone) || (isBug && notDone);
      });
    }

    // Default Idle State: All issues
    return issues;
  }, [issues, isCrossFiltered, idleMode, selectedType, selectedAssignee, selectedStatus, selectedPriority]);

  // Radar count for badge
  const radarTotalCount = useMemo(() => {
    return issues.filter((issue) => {
      const isStale = issue.isStale || (issue.daysInactive !== undefined && issue.daysInactive >= 3);
      const p = (issue.priority || '').toLowerCase();
      const isHighRiskPriority = p === 'highest' || p === 'high';
      const isBug = (issue.type || '').toLowerCase().includes('bug');
      const notDone = issue.statusCategory !== 'done';
      return isStale || (isHighRiskPriority && notDone) || (isBug && notDone);
    }).length;
  }, [issues]);

  // Priority numeric rank for sorting
  const enrichedIssues = useMemo(() => {
    const rankMap = { highest: 5, high: 4, medium: 3, low: 2, lowest: 1 };
    return displayIssues.map((issue) => {
      const p = (issue.priority || 'Medium').toLowerCase();
      return {
        ...issue,
        priorityRank: rankMap[p] || 3,
      };
    });
  }, [displayIssues]);

  // ── INLINE ACTION HANDLERS ──
  const handleStatusChange = async (issue, newStatus) => {
    setActiveDropdown(null);
    const newCat = getStatusCategoryKey(newStatus);

    // 1. Optimistic update
    if (onUpdateIssue) {
      onUpdateIssue(issue.id, {
        status: newStatus,
        statusCategory: newCat,
      });
    }

    setActionSuccess((prev) => ({ ...prev, [issue.key]: `Status: ${newStatus}` }));
    setTimeout(() => {
      setActionSuccess((prev) => {
        const next = { ...prev };
        delete next[issue.key];
        return next;
      });
    }, 3000);

    // 2. Persist to backend resolver
    try {
      await invoke('updateIssueStatus', {
        issueKey: issue.key,
        statusName: newStatus,
      });
    } catch (err) {
      console.warn('Status change backend notice:', err.message);
    }
  };

  const handleAssigneeChange = async (issue, newAssignee) => {
    setActiveDropdown(null);

    // 1. Optimistic update
    if (onUpdateIssue) {
      onUpdateIssue(issue.id, {
        assignee: newAssignee,
        avatarUrl: assigneeAvatarMap[newAssignee] || null,
      });
    }

    setActionSuccess((prev) => ({ ...prev, [issue.key]: `Assigned: ${newAssignee}` }));
    setTimeout(() => {
      setActionSuccess((prev) => {
        const next = { ...prev };
        delete next[issue.key];
        return next;
      });
    }, 3000);

    // 2. Persist to backend resolver
    try {
      await invoke('updateIssueAssignee', {
        issueKey: issue.key,
        assigneeName: newAssignee,
      });
    } catch (err) {
      console.warn('Assignee change backend notice:', err.message);
    }
  };

  // ── 2. TANSTACK TABLE COLUMN DEFINITIONS ──
  const columns = useMemo(
    () => [
      // 1. Key Column
      {
        accessorKey: 'key',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold text-slate-300 hover:text-cyan-400 select-none uppercase tracking-wider text-[10px]"
          >
            <span>Key</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-cyan-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-slate-600" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const issue = row.original;
          const typeIcon = getSemanticIcon('type', issue.type);
          return (
            <div className="flex items-center gap-2">
              {typeIcon && (
                <img src={typeIcon} alt="" className="w-3.5 h-3.5 shrink-0 object-contain" />
              )}
              <span className="font-mono text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
                {issue.key}
              </span>
            </div>
          );
        },
      },

      // 2. Summary Column
      {
        accessorKey: 'summary',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold text-slate-300 hover:text-cyan-400 select-none uppercase tracking-wider text-[10px]"
          >
            <span>Summary</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-cyan-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-slate-600" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const issue = row.original;
          const isStale = issue.isStale || (issue.daysInactive !== undefined && issue.daysInactive >= 3);
          const feedback = actionSuccess[issue.key];

          return (
            <div className="min-w-0 max-w-md">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-200 truncate font-medium group-hover:text-white transition-colors">
                  {issue.summary}
                </span>
                {isStale && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                    <span>{issue.daysInactive || 3}d stale</span>
                  </span>
                )}
                {feedback && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-in fade-in shrink-0">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>{feedback}</span>
                  </span>
                )}
              </div>
            </div>
          );
        },
      },

      // 3. Issue Type Column
      {
        accessorKey: 'type',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold text-slate-300 hover:text-cyan-400 select-none uppercase tracking-wider text-[10px]"
          >
            <span>Type</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-cyan-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-slate-600" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const type = row.getValue('type') || 'Task';
          const icon = getSemanticIcon('type', type);
          const isSelected = selectedType === type;

          return (
            <button
              type="button"
              onClick={() => setSelectedType(isSelected ? null : type)}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-all ${
                isSelected
                  ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
              title="Click to cross-filter by this type"
            >
              {icon && <img src={icon} alt="" className="w-3 h-3 shrink-0 object-contain" />}
              <span>{type}</span>
            </button>
          );
        },
      },

      // 4. Status Column with INLINE ACTIONABILITY (Dropdown)
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold text-slate-300 hover:text-cyan-400 select-none uppercase tracking-wider text-[10px]"
          >
            <span>Status</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-cyan-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-slate-600" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const issue = row.original;
          const status = issue.status || 'To Do';
          const sem = getSemanticColor('status', status);
          const isDropdownOpen =
            activeDropdown?.type === 'status' && activeDropdown?.issueKey === issue.key;

          return (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setActiveDropdown(
                    isDropdownOpen ? null : { type: 'status', issueKey: issue.key }
                  )
                }
                style={{
                  backgroundColor: sem.bg,
                  color: sem.border,
                  borderColor: sem.color,
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition-all hover:brightness-125 group/status"
                title="Click to change status inline"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sem.color }} />
                <span>{status}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60 group-hover/status:opacity-100 transition-opacity" />
              </button>

              {/* Status Change Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-30 w-36 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                    Transition Status:
                  </div>
                  {statusesList.map((st) => {
                    const stSem = getSemanticColor('status', st);
                    const isCurrent = st.toLowerCase() === status.toLowerCase();

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(issue, st)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors ${
                          isCurrent
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: stSem.color }}
                          />
                          <span>{st}</span>
                        </span>
                        {isCurrent && <Check className="w-3 h-3 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        },
      },

      // 5. Priority Column
      {
        accessorKey: 'priorityRank',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold text-slate-300 hover:text-cyan-400 select-none uppercase tracking-wider text-[10px]"
          >
            <span>Priority</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-cyan-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-slate-600" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const issue = row.original;
          const priority = issue.priority || 'Medium';
          const icon = getSemanticIcon('priority', priority);
          const sem = getSemanticColor('priority', priority);
          const isSelected = selectedPriority === priority;

          return (
            <button
              type="button"
              onClick={() => setSelectedPriority(isSelected ? null : priority)}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-all ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
              title="Click to cross-filter by this priority"
            >
              {icon && <img src={icon} alt="" className="w-3 h-3 shrink-0 object-contain" />}
              <span style={{ color: sem.color }}>{priority}</span>
            </button>
          );
        },
      },

      // 6. Assignee Column with INLINE ACTIONABILITY (Re-assign Dropdown)
      {
        accessorKey: 'assignee',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-bold text-slate-300 hover:text-cyan-400 select-none uppercase tracking-wider text-[10px]"
          >
            <span>Assignee</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-cyan-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-slate-600" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const issue = row.original;
          const name = issue.assignee || 'Unassigned';
          const avatar = issue.avatarUrl || getInitialsAvatar(name);
          const isDropdownOpen =
            activeDropdown?.type === 'assignee' && activeDropdown?.issueKey === issue.key;

          return (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setActiveDropdown(
                    isDropdownOpen ? null : { type: 'assignee', issueKey: issue.key }
                  )
                }
                className="inline-flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800/70 border border-transparent hover:border-slate-700 transition-all text-left group/assignee"
                title="Click to re-assign issue inline"
              >
                {avatar && (
                  <img
                    src={avatar}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                )}
                <span className="text-xs text-slate-300 group-hover/assignee:text-white truncate max-w-[110px]">
                  {name}
                </span>
                <UserPlus className="w-3 h-3 text-slate-500 opacity-0 group-hover/assignee:opacity-100 transition-opacity" />
              </button>

              {/* Re-Assign Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-30 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                    Re-assign Issue:
                  </div>
                  {availableAssignees.map((user) => {
                    const uName = typeof user === 'string' ? user : user.label || user.displayName;
                    const uAvatar = assigneeAvatarMap[uName] || getInitialsAvatar(uName);
                    const isCurrent = uName === name;

                    return (
                      <button
                        key={uName}
                        type="button"
                        onClick={() => handleAssigneeChange(issue, uName)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors ${
                          isCurrent
                            ? 'bg-slate-800 text-cyan-300'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <img
                            src={uAvatar}
                            alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                          />
                          <span className="truncate">{uName}</span>
                        </span>
                        {isCurrent && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        },
      },

      // 7. Story Points / Estimate
      {
        accessorKey: 'storyPoints',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center justify-center gap-1 font-bold text-slate-300 hover:text-cyan-400 select-none uppercase tracking-wider text-[10px] w-full"
          >
            <span>Story Points</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-cyan-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-slate-600" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const sp = row.getValue('storyPoints');
          return (
            <div className="text-center font-mono">
              {sp !== undefined && sp !== null && sp > 0 ? (
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-cyan-300 font-bold text-xs">
                  {sp} SP
                </span>
              ) : (
                <span className="text-slate-600 text-xs">—</span>
              )}
            </div>
          );
        },
      },
    ],
    [
      selectedType,
      selectedStatus,
      selectedAssignee,
      selectedPriority,
      availableAssignees,
      assigneeAvatarMap,
      activeDropdown,
      actionSuccess,
      statusesList,
    ]
  );

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveDropdown(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // ── 3. TANSTACK TABLE INSTANCE ──
  const table = useReactTable({
    data: enrichedIssues,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-md shadow-2xl overflow-hidden transition-all duration-200">
      {/* ── HEADER & COLLAPSE BANNER ── */}
      <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {isCrossFiltered ? (
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Filter className="w-3.5 h-3.5 animate-pulse" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Radar className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
            )}

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <span>
                  {isCrossFiltered
                    ? 'Drill-Down Inspector (Master-Detail)'
                    : 'Issue Radar: High-Priority & Blockers'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                  {enrichedIssues.length} issues
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isCrossFiltered
                  ? 'Showing live matching tickets filtered by clicked chart elements.'
                  : 'Idle state monitoring blockers, stale tickets and high-risk priorities.'}
              </p>
            </div>
          </div>

          {/* Idle Mode Switcher: Radar vs All */}
          {!isCrossFiltered && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-0.5 flex items-center text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setIdleMode('radar')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                  idleMode === 'radar'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Radar ({radarTotalCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setIdleMode('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  idleMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Issues ({issues.length})
              </button>
            </div>
          )}
        </div>

        {/* Right Action Tools: Search, Filter Reset, Collapse */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Search in Inspector */}
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter inspector..."
              className="w-32 sm:w-48 bg-slate-950 border border-slate-800 focus:border-cyan-500/80 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Clear Cross-Filters Button */}
          {isCrossFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-slate-700 transition-colors"
            >
              Clear Filter
            </button>
          )}

          {/* Collapse / Expand Button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── EXPANDABLE CONTENT BODY ── */}
      {!isCollapsed && (
        <div className="flex flex-col">
          {/* Reactive Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-slate-800 bg-slate-900/50">
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="p-2.5 first:pl-4 last:pr-4">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center p-8 text-slate-500 text-xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-slate-600" />
                        <p className="font-semibold text-slate-400">No issues matching criteria</p>
                        <p className="text-[11px] text-slate-500">
                          {isCrossFiltered
                            ? 'Try selecting another slice from the charts or clear filters.'
                            : 'All tickets are healthy and on track!'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-900/60 transition-colors group"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-2.5 first:pl-4 last:pr-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION CONTROLS ── */}
          <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:border-cyan-500"
              >
                {[10, 20, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
              <span className="font-mono text-slate-500">
                Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())} (
                {table.getFilteredRowModel().rows.length} total)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
