import { create } from 'zustand';

/**
 * Global Cross-Filtering & Executive Scope Store (Zustand)
 *
 * Manages:
 * - currentScope: Context Switching level ('sprint', 'project', 'portfolio')
 * - selectedType: Issue type filter (e.g. 'Bug', 'Story', 'Task')
 * - selectedAssignee: Assignee name filter (e.g. 'Mixalis', 'Unassigned')
 * - selectedStatus: Status category filter (e.g. 'Done', 'In Progress', 'To Do')
 * - activityFilter: Stream mode ('all' vs 'stale' for Blockers & Stale tickets)
 */
export const useFilterStore = create((set, get) => ({
  // Executive Scope Context ('sprint', 'project', 'portfolio')
  currentScope: 'sprint',
  setCurrentScope: (scope) => set({ currentScope: scope }),

  // Cross-filters
  selectedType: null,
  selectedAssignee: null,
  selectedStatus: null,
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
      activityFilter: 'all',
    }),

  // Helper to determine if any cross-filter is active
  hasActiveFilters: () => {
    const { selectedType, selectedAssignee, selectedStatus, activityFilter } = get();
    return Boolean(selectedType || selectedAssignee || selectedStatus || activityFilter === 'stale');
  },
}));
