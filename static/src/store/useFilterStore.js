import { create } from 'zustand';

/**
 * Global Cross-Filtering & Executive Scope Store (Zustand)
 *
 * Manages:
 * - currentScope: Context Switching level ('sprint', 'project', 'portfolio', 'explorer')
 * - selectedType: Issue type filter (e.g. 'Bug', 'Story', 'Task')
 * - selectedAssignee: Assignee name filter (e.g. 'Mixalis', 'Unassigned')
 * - selectedStatus: Status category filter (e.g. 'Done', 'In Progress', 'To Do')
 * - selectedPriority: Priority filter (e.g. 'Highest', 'High', 'Medium', 'Low', 'Lowest')
 * - activityFilter: Stream mode ('all' vs 'stale' for Blockers & Stale tickets)
 */
export const useFilterStore = create((set, get) => ({
  // Executive Scope Context ('sprint', 'project', 'portfolio', 'explorer')
  currentScope: 'sprint',
  setCurrentScope: (scope) => set({ currentScope: scope }),

  // Cross-filters
  selectedType: null,
  selectedAssignee: null,
  selectedStatus: null,
  selectedPriority: null,
  activityFilter: 'all', // 'all' or 'stale'

  // Toggle or set issue type filter
  setSelectedType: (type) =>
    set((state) => ({
      selectedType: state.selectedType === type ? null : type,
    })),

  // Toggle or set assignee filter
  setSelectedAssignee: (assignee) =>
    set((state) => ({
      selectedAssignee: state.selectedAssignee === assignee ? null : assignee,
    })),

  // Toggle or set status category filter
  setSelectedStatus: (status) =>
    set((state) => ({
      selectedStatus: state.selectedStatus === status ? null : status,
    })),

  // Toggle or set priority filter
  setSelectedPriority: (priority) =>
    set((state) => ({
      selectedPriority: state.selectedPriority === priority ? null : priority,
    })),

  // Universal Cross-Filter Dispatcher
  setCrossFilter: (dim, val) => {
    if (dim === 'type') get().setSelectedType(val);
    else if (dim === 'status') get().setSelectedStatus(val);
    else if (dim === 'assignee') get().setSelectedAssignee(val);
    else if (dim === 'priority') get().setSelectedPriority(val);
  },

  // Set activity stream filter mode
  setActivityFilter: (mode) =>
    set({
      activityFilter: mode,
    }),

  // Reset all cross-filters
  resetFilters: () =>
    set({
      selectedType: null,
      selectedAssignee: null,
      selectedStatus: null,
      selectedPriority: null,
      activityFilter: 'all',
    }),

  // Helper to determine if any cross-filter is active
  hasActiveFilters: () => {
    const { selectedType, selectedAssignee, selectedStatus, selectedPriority, activityFilter } = get();
    return Boolean(
      selectedType ||
      selectedAssignee ||
      selectedStatus ||
      selectedPriority ||
      activityFilter === 'stale'
    );
  },
}));
