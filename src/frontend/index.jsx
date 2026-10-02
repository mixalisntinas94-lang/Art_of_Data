import React, { useEffect, useState, useCallback, useRef } from 'react';
import ForgeReconciler, {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  Badge,
  Lozenge,
  ProgressBar,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  DynamicTable,
  Select,
  Textfield,
  Button,
  Spinner,
  SectionMessage,
  EmptyState,
  CodeBlock,
  Strong,
  Em,
  Tag,
  TagGroup,
  useProductContext,
  xcss,
  BarChart,
  HorizontalBarChart,
} from '@forge/react';
import { invoke } from '@forge/bridge';

/**
 * Modern Design Tokens & Card Styles
 * Powered by Atlassian Design System tokens for flawless Light and Dark mode rendering.
 */
const kpiCardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.200',
  boxShadow: 'elevation.shadow.raised',
  flexGrow: 1,
  width: '19%',
});

const sectionCardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.250',
  boxShadow: 'elevation.shadow.raised',
});

const fullWidthBoxStyle = xcss({
  width: '100%',
});

const chartCardHalfStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.250',
  boxShadow: 'elevation.shadow.raised',
  flexGrow: 1,
  width: '49%',
});

const chartCardWideStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.250',
  boxShadow: 'elevation.shadow.raised',
  flexGrow: 1,
  width: '100%',
});


const headerContainerStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.200',
  boxShadow: 'elevation.shadow.raised',
});

const filterToolbarStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.150',
  boxShadow: 'elevation.shadow.raised',
});

const filterPanelContainerStyle = xcss({
  backgroundColor: 'elevation.surface.overlay',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.large',
  padding: 'space.200',
  boxShadow: 'elevation.shadow.overlay',
});

const filterLeftColStyle = xcss({
  borderColor: 'color.border',
  borderRightWidth: 'border.width',
  borderRightStyle: 'solid',
  paddingRight: 'space.150',
  minWidth: '200px',
});

const filterRightColStyle = xcss({
  paddingLeft: 'space.200',
  flexGrow: 1,
  minHeight: '220px',
});

/**
 * Main application component for Agile Pulse Analytics.
 * Built using native Atlassian Forge UI Kit components (@forge/react).
 * Features a dynamic Metric Filter (Story Points vs Hours) and an Advanced Dynamic Filter Toolbar.
 */
const App = () => {
  const context = useProductContext();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Metric Filter state: 'points' (Story Points - default) or 'hours' (Hours)
  const [metricMode, setMetricMode] = useState('points');

  // Dynamic Filters State
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedIssueType, setSelectedIssueType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedSprint, setSelectedSprint] = useState('all');
  const [customJql, setCustomJql] = useState('');
  const [jqlDraft, setJqlDraft] = useState(''); // draft text before user hits Apply

  // Filter panel state: open/closed, active tab ('basic' or 'jql'), and selected field on left
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterTab, setFilterTab] = useState('basic'); // 'basic' or 'jql'
  const [activeFilterField, setActiveFilterField] = useState('sprint'); // 'sprint' | 'assignee' | 'status' | 'issueType' | 'priority'
  const [activeFieldList, setActiveFieldList] = useState(['sprint', 'assignee', 'status', 'issueType', 'priority']);
  const [showAddFieldSelect, setShowAddFieldSelect] = useState(false);

  // JQL Autocomplete dictionary from Jira
  const [jqlAutocompleteData, setJqlAutocompleteData] = useState({
    visibleFieldNames: [],
    visibleFunctionNames: [],
    jqlReservedWords: [],
  });

  // Dynamic filter options populated from project
  const [filterOptions, setFilterOptions] = useState({
    assignees: [{ label: 'All Assignees', value: 'all' }],
    issueTypes: [{ label: 'All Issue Types', value: 'all' }],
    statuses: [{ label: 'All Statuses', value: 'all' }],
    priorities: [{ label: 'All Priorities', value: 'all' }],
    sprints: [{ label: 'All Sprints', value: 'all' }],
  });

  // Ref to track active request counter and prevent out-of-order race conditions
  const activeRequestIdRef = useRef(0);
  // Ref to debounce rapid filter changes
  const debounceTimerRef = useRef(null);

  // Fetch JQL autocomplete schema on initial mount
  useEffect(() => {
    invoke('getJqlAutocompleteData')
      .then((res) => {
        if (res && res.success) {
          setJqlAutocompleteData({
            visibleFieldNames: res.visibleFieldNames || [],
            visibleFunctionNames: res.visibleFunctionNames || [],
            jqlReservedWords: res.jqlReservedWords || [],
          });
        }
      })
      .catch((err) => console.warn('Could not load JQL autocomplete data:', err.message));
  }, []);

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Loads accessible Jira projects from the backend resolver.
   */
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError(null);
    try {
      const res = await invoke('getProjects');
      if (res.success && res.projects && res.projects.length > 0) {
        setProjects(res.projects);

        const contextProjectKey =
          context?.extension?.project?.key ||
          context?.platformContext?.projectKey ||
          context?.project?.key;

        const defaultProj =
          res.projects.find((p) => p.key === contextProjectKey) || res.projects[0];

        setSelectedProject(defaultProj);
      } else if (res.error) {
        setError(`Failed to load projects: ${res.error}`);
      } else {
        setError('No Jira projects found in this instance.');
      }
    } catch (err) {
      setError(`Error fetching projects: ${err.message}`);
    } finally {
      setLoadingProjects(false);
    }
  }, [context]);

  /**
   * Loads dynamic filter options (assignees, types, statuses) for the current project.
   */
  const loadFilterOptions = useCallback(async (projectKey) => {
    if (!projectKey) return;
    try {
      const res = await invoke('getProjectFilterOptions', { projectKey });
      if (res.success) {
        setFilterOptions({
          assignees: res.assignees || [{ label: 'All Assignees', value: 'all' }],
          issueTypes: res.issueTypes || [{ label: 'All Issue Types', value: 'all' }],
          statuses: res.statuses || [{ label: 'All Statuses', value: 'all' }],
          priorities: res.priorities || [{ label: 'All Priorities', value: 'all' }],
          sprints: res.sprints || [{ label: 'All Sprints', value: 'all' }],
        });
      }
    } catch (err) {
      console.warn('Could not load filter options:', err.message);
    }
  }, []);

  /**
   * Loads analytics for the selected project applying all active dynamic filters.
   * Uses activeRequestIdRef to discard any responses from earlier requests that arrive late.
   */
  const loadAnalytics = useCallback(
    async (projectKey, overrideFilters = {}) => {
      if (!projectKey) return;
      const currentRequestId = ++activeRequestIdRef.current;
      setLoadingAnalytics(true);
      setError(null);
      try {
        const payload = {
          projectKey,
          assignee:
            overrideFilters.assignee !== undefined ? overrideFilters.assignee : selectedAssignee,
          issueType:
            overrideFilters.issueType !== undefined ? overrideFilters.issueType : selectedIssueType,
          status:
            overrideFilters.status !== undefined ? overrideFilters.status : selectedStatus,
          priority:
            overrideFilters.priority !== undefined ? overrideFilters.priority : selectedPriority,
          sprint:
            overrideFilters.sprint !== undefined ? overrideFilters.sprint : selectedSprint,
          customJql:
            overrideFilters.customJql !== undefined ? overrideFilters.customJql : customJql,
        };

        const res = await invoke('getProjectAnalytics', payload);

        // Discard result if another newer request was dispatched while this was in-flight
        if (activeRequestIdRef.current !== currentRequestId) {
          return;
        }

        if (res.success) {
          setAnalytics(res);
          setLastRefreshed(new Date().toLocaleTimeString());
        } else {
          setError(res.error || 'Failed to load project analytics.');
          setAnalytics(null);
        }
      } catch (err) {
        if (activeRequestIdRef.current === currentRequestId) {
          setError(`Error fetching analytics: ${err.message}`);
          setAnalytics(null);
        }
      } finally {
        if (activeRequestIdRef.current === currentRequestId) {
          setLoadingAnalytics(false);
        }
      }
    },
    [selectedAssignee, selectedIssueType, selectedStatus, selectedPriority, selectedSprint, customJql]
  );

  /**
   * Debounced version of loadAnalytics for filter dropdowns.
   * Cancels any pending requests and waits for delayMs before querying the backend.
   */
  const debouncedLoadAnalytics = useCallback(
    (projectKey, overrideFilters = {}, delayMs = 300) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        loadAnalytics(projectKey, overrideFilters);
      }, delayMs);
    },
    [loadAnalytics]
  );

  // Initial load of Jira projects
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // When selected project changes, fetch filter options and reload analytics immediately
  useEffect(() => {
    if (selectedProject?.key) {
      loadFilterOptions(selectedProject.key);
      loadAnalytics(selectedProject.key, {
        searchQuery: '',
        assignee: 'all',
        issueType: 'all',
        status: 'all',
        customJql: '',
      });
    }
  }, [selectedProject?.key, loadFilterOptions]);

  const handleProjectSelect = (option) => {
    if (!option) return;
    const proj = projects.find((p) => p.key === option.value);
    if (proj) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Reset all active filters when changing project
      setSelectedAssignee('all');
      setSelectedIssueType('all');
      setSelectedStatus('all');
      setSelectedPriority('all');
      setSelectedSprint('all');
      setCustomJql('');
      setJqlDraft('');
      setFilterPanelOpen(false);
      setSelectedProject(proj);
    }
  };

  const projectOptions = projects.map((p) => ({
    label: `${p.name} (${p.key})`,
    value: p.key,
  }));

  const selectedOption = selectedProject
    ? { label: `${selectedProject.name} (${selectedProject.key})`, value: selectedProject.key }
    : null;

  // Metric Filter dropdown options
  const metricOptions = [
    { label: '🎯 Story Points (SP)', value: 'points' },
    { label: '⏱️ Hours (h)', value: 'hours' },
  ];

  const selectedMetricOption =
    metricOptions.find((opt) => opt.value === metricMode) || metricOptions[0];

  // Helper for Status Lozenge appearances
  const getStatusAppearance = (statusCategory) => {
    switch (statusCategory) {
      case 'done':
        return 'success';
      case 'indeterminate':
        return 'inprogress';
      case 'new':
      default:
        return 'default';
    }
  };

  // Helper for Capacity Lozenge
  const getCapacityAppearance = (status) => {
    switch (status) {
      case 'Optimal':
        return 'success';
      case 'Heavy':
        return 'removed';
      case 'Unestimated':
        return 'moved';
      default:
        return 'default';
    }
  };

  // Helper for Priority Lozenge
  const getPriorityAppearance = (priority) => {
    const p = (priority || '').toLowerCase();
    if (p.includes('highest') || p.includes('high') || p.includes('blocker') || p.includes('critical')) {
      return 'removed';
    }
    if (p.includes('medium')) {
      return 'inprogress';
    }
    return 'default';
  };

  /**
   * Generic handler for Basic filter dropdowns.
   * Immediately updates state and triggers a debounced analytics reload.
   */
  const handleBasicFilterChange = (filterKey, setterFn) => (option) => {
    const val = option?.value || 'all';
    setterFn(val);
    if (selectedProject?.key) {
      debouncedLoadAnalytics(selectedProject.key, { [filterKey]: val }, 300);
    }
  };

  const handleAssigneeFilterChange = handleBasicFilterChange('assignee', setSelectedAssignee);
  const handleIssueTypeFilterChange = handleBasicFilterChange('issueType', setSelectedIssueType);
  const handleStatusFilterChange = handleBasicFilterChange('status', setSelectedStatus);
  const handlePriorityFilterChange = handleBasicFilterChange('priority', setSelectedPriority);
  const handleSprintFilterChange = handleBasicFilterChange('sprint', setSelectedSprint);

  /**
   * Applies the JQL draft to the active customJql state and triggers an immediate analytics reload.
   * This is the correct behaviour: user edits the draft, clicks Apply, THEN the query runs.
   */
  const handleApplyJql = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const trimmedJql = jqlDraft.trim();
    setCustomJql(trimmedJql);
    if (selectedProject?.key) {
      loadAnalytics(selectedProject.key, { customJql: trimmedJql });
    }
  };

  /**
   * Generates context-aware JQL autocomplete suggestions based on the last typed token.
   */
  const getJqlSuggestions = () => {
    const draft = jqlDraft;
    if (!draft || !draft.trim()) {
      return [
        { label: 'sprint in openSprints()', insert: 'sprint in openSprints() ' },
        { label: 'priority = High', insert: 'priority = High ' },
        { label: 'assignee = currentUser()', insert: 'assignee = currentUser() ' },
        { label: 'status != Done', insert: 'status != Done ' },
      ];
    }
    const tokens = draft.trim().split(/\s+/);
    const lastToken = tokens[tokens.length - 1] || '';
    if (!lastToken) return [];
    const search = lastToken.toLowerCase();

    const matches = [];
    (jqlAutocompleteData.visibleFieldNames || []).forEach((f) => {
      if (
        f.value.toLowerCase().startsWith(search) ||
        (f.displayName && f.displayName.toLowerCase().startsWith(search))
      ) {
        matches.push({ label: `${f.displayName || f.value}`, insert: `${f.value} ` });
      }
    });
    (jqlAutocompleteData.visibleFunctionNames || []).forEach((fn) => {
      if (fn.value.toLowerCase().includes(search)) {
        matches.push({ label: `${fn.value}`, insert: `${fn.value} ` });
      }
    });
    (jqlAutocompleteData.jqlReservedWords || []).forEach((w) => {
      if (w.toLowerCase().startsWith(search)) {
        matches.push({ label: `${w}`, insert: `${w} ` });
      }
    });
    return matches.slice(0, 8);
  };

  /**
   * Replaces the currently typed partial word with the chosen autocomplete suggestion.
   */
  const handleInsertSuggestion = (insertText) => {
    const trimmed = jqlDraft.trimEnd();
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace === -1) {
      setJqlDraft(insertText);
    } else {
      setJqlDraft(trimmed.substring(0, lastSpace + 1) + insertText);
    }
  };

  const handleClearAllFilters = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSelectedAssignee('all');
    setSelectedIssueType('all');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setSelectedSprint('all');
    setCustomJql('');
    setJqlDraft('');
    if (selectedProject?.key) {
      loadAnalytics(selectedProject.key, {
        assignee: 'all',
        issueType: 'all',
        status: 'all',
        priority: 'all',
        sprint: 'all',
        customJql: '',
      });
    }
  };

  const hasActiveFilters =
    selectedAssignee !== 'all' ||
    selectedIssueType !== 'all' ||
    selectedStatus !== 'all' ||
    selectedPriority !== 'all' ||
    selectedSprint !== 'all' ||
    customJql.trim() !== '';

  // Table row mappings
  const staleTableRows = (analytics?.staleIssues || []).map((issue) => ({
    key: `stale-${issue.id}`,
    cells: [
      { key: 'key', content: <Strong>{issue.key}</Strong> },
      { key: 'summary', content: <Text>{issue.summary}</Text> },
      {
        key: 'status',
        content: <Lozenge appearance={getStatusAppearance(issue.statusCategory)}>{issue.status}</Lozenge>,
      },
      {
        key: 'priority',
        content: <Lozenge appearance={getPriorityAppearance(issue.priority)}>{issue.priority}</Lozenge>,
      },
      { key: 'assignee', content: <Text>{issue.assignee}</Text> },
      {
        key: 'inactive',
        content: (
          <Badge appearance={issue.daysInactive >= 7 ? 'removed' : 'important'}>
            {`${issue.daysInactive} days inactive`}
          </Badge>
        ),
      },
    ],
  }));

  const teamTableRows = (analytics?.teamMembers || []).map((member, idx) => {
    const capacityStatus =
      metricMode === 'points' ? member.capacityStatusPoints : member.capacityStatusHours;

    const metricText =
      metricMode === 'points'
        ? `${member.completedPoints} SP done / ${member.totalPoints} SP total`
        : `${member.loggedHours}h spent / ${member.estimatedHours}h est.`;

    return {
      key: `team-${idx}`,
      cells: [
        { key: 'name', content: <Strong>{member.name}</Strong> },
        { key: 'total', content: <Text>{`${member.totalIssues} issues`}</Text> },
        {
          key: 'completed',
          content: (
            <Inline space="space.050" alignBlock="center">
              <Lozenge appearance="success">{`${member.completedIssues} done`}</Lozenge>
              <Text>{`(${member.completionRate}%)`}</Text>
            </Inline>
          ),
        },
        { key: 'metrics', content: <Text>{metricText}</Text> },
        {
          key: 'capacity',
          content: <Lozenge appearance={getCapacityAppearance(capacityStatus)}>{capacityStatus}</Lozenge>,
        },
      ],
    };
  });

  const explorerTableRows = (analytics?.recentIssues || []).map((issue) => {
    let metricDisplay;
    if (metricMode === 'points') {
      metricDisplay =
        issue.storyPoints !== null && issue.storyPoints !== undefined
          ? `${issue.storyPoints} SP`
          : '-';
    } else {
      metricDisplay = `${issue.estimatedHours}h / ${issue.loggedHours}h`;
    }

    return {
      key: `issue-${issue.id}`,
      cells: [
        { key: 'key', content: <Strong>{issue.key}</Strong> },
        {
          key: 'type',
          content: (
            <Lozenge appearance={issue.type.toLowerCase().includes('bug') ? 'removed' : 'default'}>
              {issue.type}
            </Lozenge>
          ),
        },
        { key: 'summary', content: <Text>{issue.summary}</Text> },
        {
          key: 'status',
          content: <Lozenge appearance={getStatusAppearance(issue.statusCategory)}>{issue.status}</Lozenge>,
        },
        {
          key: 'priority',
          content: <Lozenge appearance={getPriorityAppearance(issue.priority)}>{issue.priority}</Lozenge>,
        },
        { key: 'assignee', content: <Text>{issue.assignee}</Text> },
        { key: 'metric', content: <Text>{metricDisplay}</Text> },
      ],
    };
  });

  const kpis = analytics?.kpis;

  // statusPieData was used for the old PieChart; kept as unused variable in case needed later.
  // The new dashboard uses LineChart and StackBarChart instead.
  // const statusPieData = [...]

  return (
    <Box padding="space.200" xcss={fullWidthBoxStyle}>
      <Stack space="space.200" alignInline="stretch" grow="fill">
        {/* Modern Header Bar */}
        <Box xcss={headerContainerStyle}>
          <Inline space="space.200" spread="space-between" alignBlock="center">
            <Stack space="space.050">
              <Inline space="space.100" alignBlock="center">
                <Heading as="h1">📊 Agile Pulse Analytics</Heading>
                <Lozenge appearance="inprogress">Marketplace Edition</Lozenge>
              </Inline>
              <Text>
                <Em>Enterprise sprint velocity, real-time workload capacity & bottleneck intelligence</Em>
              </Text>
            </Stack>

            <Inline space="space.150" alignBlock="center">
              {/* Metric Mode Filter (Story Points vs Hours) */}
              <Box style={{ minWidth: '185px' }}>
                <Select
                  spacing="compact"
                  isSearchable={false}
                  options={metricOptions}
                  value={selectedMetricOption}
                  onChange={(opt) => opt && setMetricMode(opt.value)}
                  isDisabled={loadingAnalytics}
                />
              </Box>

              {/* Project Selector */}
              {projects.length > 0 && (
                <Box style={{ minWidth: '240px' }}>
                  <Select
                    spacing="compact"
                    isSearchable={false}
                    options={projectOptions}
                    value={selectedOption}
                    onChange={handleProjectSelect}
                    placeholder="Select a Project"
                    isDisabled={loadingAnalytics}
                  />
                </Box>
              )}

              {/* Refresh Button */}
              <Button
                appearance="primary"
                spacing="compact"
                onClick={() => selectedProject && loadAnalytics(selectedProject.key)}
                isDisabled={loadingAnalytics || !selectedProject}
              >
                {loadingAnalytics ? 'Refreshing...' : '🔄 Refresh'}
              </Button>
            </Inline>
          </Inline>
        </Box>

        {/* Filter Bar: shows active lozenges + "Filters" toggle button */}
        {selectedProject && (
          <Box xcss={filterToolbarStyle}>
            <Stack space="space.100">

              {/* Top row: active filter lozenges (left) + action buttons (right) */}
              <Inline space="space.100" alignBlock="center" spread="space-between">
                {/* Active Filter Lozenges */}
                <Inline space="space.050" alignBlock="center">
                  {!hasActiveFilters && !filterPanelOpen && (
                    <Text><Em>No filters applied. All issues shown.</Em></Text>
                  )}
                  {selectedSprint !== 'all' && (
                    <Lozenge appearance="inprogress">{`Sprint: ${selectedSprint}`}</Lozenge>
                  )}
                  {selectedAssignee !== 'all' && (
                    <Lozenge appearance="inprogress">{`Assignee: ${selectedAssignee}`}</Lozenge>
                  )}
                  {selectedIssueType !== 'all' && (
                    <Lozenge appearance="inprogress">{`Work type: ${selectedIssueType}`}</Lozenge>
                  )}
                  {selectedStatus !== 'all' && (
                    <Lozenge appearance="inprogress">{`Status: ${selectedStatus}`}</Lozenge>
                  )}
                  {selectedPriority !== 'all' && (
                    <Lozenge appearance="inprogress">{`Priority: ${selectedPriority}`}</Lozenge>
                  )}
                  {customJql.trim() !== '' && (
                    <Lozenge appearance="moved">{`JQL: ${customJql.length > 40 ? customJql.substring(0, 40) + '…' : customJql}`}</Lozenge>
                  )}
                </Inline>

                {/* Right side buttons */}
                <Inline space="space.100" alignBlock="center">
                  <Button
                    appearance={filterPanelOpen ? 'primary' : 'default'}
                    spacing="compact"
                    onClick={() => {
                      setFilterPanelOpen(!filterPanelOpen);
                      if (!filterPanelOpen) {
                        setJqlDraft(customJql);
                      }
                    }}
                    isDisabled={loadingAnalytics}
                  >
                    {filterPanelOpen ? '▲ Hide Filters' : '⚡ Filter'}
                  </Button>

                  {hasActiveFilters && (
                    <Button
                      appearance="danger"
                      spacing="compact"
                      onClick={handleClearAllFilters}
                      isDisabled={loadingAnalytics}
                    >
                      🧹 Clear All
                    </Button>
                  )}
                </Inline>
              </Inline>

              {/* Jira Lists-Style Filter Panel */}
              {filterPanelOpen && (
                <Box xcss={filterPanelContainerStyle}>
                  <Stack space="space.150">

                    {/* Mode Tabs: Basic | JQL */}
                    <Inline space="space.100" alignBlock="center">
                      <Button
                        appearance={filterTab === 'basic' ? 'primary' : 'subtle'}
                        spacing="compact"
                        onClick={() => setFilterTab('basic')}
                      >
                        Basic
                      </Button>
                      <Button
                        appearance={filterTab === 'jql' ? 'primary' : 'subtle'}
                        spacing="compact"
                        onClick={() => {
                          setFilterTab('jql');
                          setJqlDraft(customJql);
                        }}
                      >
                        JQL
                      </Button>
                    </Inline>

                    {/* ── BASIC TAB: Two-Column Layout (Jira Lists Filter Card) ── */}
                    {filterTab === 'basic' && (
                      <Inline space="space.0" alignBlock="stretch">
                        {/* Left Column: Field selection list */}
                        <Box xcss={filterLeftColStyle}>
                          <Stack space="space.075">
                            <Text><Strong>Filter by Field</Strong></Text>

                            {/* Sprint */}
                            <Button
                              appearance={activeFilterField === 'sprint' ? 'primary' : 'subtle'}
                              spacing="compact"
                              onClick={() => setActiveFilterField('sprint')}
                            >
                              {selectedSprint !== 'all' ? `Sprint: ${selectedSprint}` : 'Sprint'}
                            </Button>

                            {/* Assignee */}
                            <Button
                              appearance={activeFilterField === 'assignee' ? 'primary' : 'subtle'}
                              spacing="compact"
                              onClick={() => setActiveFilterField('assignee')}
                            >
                              {selectedAssignee !== 'all' ? `Assignee: ${selectedAssignee}` : 'Assignee'}
                            </Button>

                            {/* Status */}
                            <Button
                              appearance={activeFilterField === 'status' ? 'primary' : 'subtle'}
                              spacing="compact"
                              onClick={() => setActiveFilterField('status')}
                            >
                              {selectedStatus !== 'all' ? `Status: ${selectedStatus}` : 'Status'}
                            </Button>

                            {/* Work type */}
                            <Button
                              appearance={activeFilterField === 'issueType' ? 'primary' : 'subtle'}
                              spacing="compact"
                              onClick={() => setActiveFilterField('issueType')}
                            >
                              {selectedIssueType !== 'all' ? `Work type: ${selectedIssueType}` : 'Work type'}
                            </Button>

                            {/* Priority */}
                            <Button
                              appearance={activeFilterField === 'priority' ? 'primary' : 'subtle'}
                              spacing="compact"
                              onClick={() => setActiveFilterField('priority')}
                            >
                              {selectedPriority !== 'all' ? `Priority: ${selectedPriority}` : 'Priority'}
                            </Button>

                            {/* Extra field: Labels if added */}
                            {activeFieldList.includes('labels') && (
                              <Button
                                appearance={activeFilterField === 'labels' ? 'primary' : 'subtle'}
                                spacing="compact"
                                onClick={() => setActiveFilterField('labels')}
                              >
                                Labels
                              </Button>
                            )}

                            {/* + Add field */}
                            {!activeFieldList.includes('labels') && (
                              <Button
                                appearance="subtle"
                                spacing="compact"
                                onClick={() => {
                                  setActiveFieldList([...activeFieldList, 'labels']);
                                  setActiveFilterField('labels');
                                }}
                              >
                                ➕ Add field
                              </Button>
                            )}

                            {/* Clear All at bottom of left column */}
                            <Box paddingBlockStart="space.150">
                              <Button
                                appearance="subtle"
                                spacing="compact"
                                onClick={handleClearAllFilters}
                                isDisabled={!hasActiveFilters || loadingAnalytics}
                              >
                                Clear all
                              </Button>
                            </Box>
                          </Stack>
                        </Box>

                        {/* Right Column: Values for currently active field */}
                        <Box xcss={filterRightColStyle}>
                          <Stack space="space.150">
                            {/* SPRINT EDITOR */}
                            {activeFilterField === 'sprint' && (
                              <Stack space="space.100">
                                <Inline space="space.100" spread="space-between" alignBlock="center">
                                  <Heading as="h4">🏃 Sprint Filter</Heading>
                                  {selectedSprint !== 'all' && (
                                    <Button
                                      appearance="subtle"
                                      spacing="compact"
                                      onClick={() => handleSprintFilterChange({ value: 'all' })}
                                    >
                                      Clear field
                                    </Button>
                                  )}
                                </Inline>
                                <Text>Filter issues belonging to a specific sprint or backlog.</Text>
                                <Box style={{ maxWidth: '320px' }}>
                                  <Select
                                    spacing="compact"
                                    isSearchable={false}
                                    options={filterOptions.sprints}
                                    value={
                                      filterOptions.sprints.find((s) => s.value === selectedSprint) ||
                                      filterOptions.sprints[0]
                                    }
                                    onChange={handleSprintFilterChange}
                                    isDisabled={loadingAnalytics}
                                  />
                                </Box>
                              </Stack>
                            )}

                            {/* ASSIGNEE EDITOR */}
                            {activeFilterField === 'assignee' && (
                              <Stack space="space.100">
                                <Inline space="space.100" spread="space-between" alignBlock="center">
                                  <Heading as="h4">👤 Assignee Filter</Heading>
                                  {selectedAssignee !== 'all' && (
                                    <Button
                                      appearance="subtle"
                                      spacing="compact"
                                      onClick={() => handleAssigneeFilterChange({ value: 'all' })}
                                    >
                                      Clear field
                                    </Button>
                                  )}
                                </Inline>
                                <Text>Filter by assigned team member or find unassigned issues.</Text>
                                <Box style={{ maxWidth: '320px' }}>
                                  <Select
                                    spacing="compact"
                                    isSearchable={true}
                                    options={filterOptions.assignees}
                                    value={
                                      filterOptions.assignees.find((a) => a.value === selectedAssignee) ||
                                      filterOptions.assignees[0]
                                    }
                                    onChange={handleAssigneeFilterChange}
                                    isDisabled={loadingAnalytics}
                                  />
                                </Box>
                              </Stack>
                            )}

                            {/* STATUS EDITOR */}
                            {activeFilterField === 'status' && (
                              <Stack space="space.100">
                                <Inline space="space.100" spread="space-between" alignBlock="center">
                                  <Heading as="h4">📋 Status Filter</Heading>
                                  {selectedStatus !== 'all' && (
                                    <Button
                                      appearance="subtle"
                                      spacing="compact"
                                      onClick={() => handleStatusFilterChange({ value: 'all' })}
                                    >
                                      Clear field
                                    </Button>
                                  )}
                                </Inline>
                                <Text>Filter issues currently in a specific workflow status.</Text>
                                <Box style={{ maxWidth: '320px' }}>
                                  <Select
                                    spacing="compact"
                                    isSearchable={false}
                                    options={filterOptions.statuses}
                                    value={
                                      filterOptions.statuses.find((s) => s.value === selectedStatus) ||
                                      filterOptions.statuses[0]
                                    }
                                    onChange={handleStatusFilterChange}
                                    isDisabled={loadingAnalytics}
                                  />
                                </Box>
                              </Stack>
                            )}

                            {/* WORK TYPE EDITOR */}
                            {activeFilterField === 'issueType' && (
                              <Stack space="space.100">
                                <Inline space="space.100" spread="space-between" alignBlock="center">
                                  <Heading as="h4">🏷️ Work Type Filter</Heading>
                                  {selectedIssueType !== 'all' && (
                                    <Button
                                      appearance="subtle"
                                      spacing="compact"
                                      onClick={() => handleIssueTypeFilterChange({ value: 'all' })}
                                    >
                                      Clear field
                                    </Button>
                                  )}
                                </Inline>
                                <Text>Filter by Story, Task, Bug, Epic or sub-task types.</Text>
                                <Box style={{ maxWidth: '320px' }}>
                                  <Select
                                    spacing="compact"
                                    isSearchable={false}
                                    options={filterOptions.issueTypes}
                                    value={
                                      filterOptions.issueTypes.find((t) => t.value === selectedIssueType) ||
                                      filterOptions.issueTypes[0]
                                    }
                                    onChange={handleIssueTypeFilterChange}
                                    isDisabled={loadingAnalytics}
                                  />
                                </Box>
                              </Stack>
                            )}

                            {/* PRIORITY EDITOR */}
                            {activeFilterField === 'priority' && (
                              <Stack space="space.100">
                                <Inline space="space.100" spread="space-between" alignBlock="center">
                                  <Heading as="h4">🚨 Priority Filter</Heading>
                                  {selectedPriority !== 'all' && (
                                    <Button
                                      appearance="subtle"
                                      spacing="compact"
                                      onClick={() => handlePriorityFilterChange({ value: 'all' })}
                                    >
                                      Clear field
                                    </Button>
                                  )}
                                </Inline>
                                <Text>Filter by issue urgency (Highest, High, Medium, Low, Lowest).</Text>
                                <Box style={{ maxWidth: '320px' }}>
                                  <Select
                                    spacing="compact"
                                    isSearchable={false}
                                    options={filterOptions.priorities}
                                    value={
                                      filterOptions.priorities.find((p) => p.value === selectedPriority) ||
                                      filterOptions.priorities[0]
                                    }
                                    onChange={handlePriorityFilterChange}
                                    isDisabled={loadingAnalytics}
                                  />
                                </Box>
                              </Stack>
                            )}

                            {/* LABELS / ADVANCED FIELD EDITOR */}
                            {activeFilterField === 'labels' && (
                              <Stack space="space.100">
                                <Heading as="h4">🏷️ Labels / Tags</Heading>
                                <Text>To filter by label or tag, use the JQL tab with: <Strong>labels = "your-label"</Strong></Text>
                                <Button
                                  appearance="primary"
                                  spacing="compact"
                                  onClick={() => {
                                    setFilterTab('jql');
                                    setJqlDraft(customJql ? `${customJql} AND labels = ""` : 'labels = ""');
                                  }}
                                >
                                  Open in JQL
                                </Button>
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                      </Inline>
                    )}

                    {/* ── JQL TAB with Live Autocomplete ── */}
                    {filterTab === 'jql' && (
                      <Stack space="space.100">
                        <Text>
                          Type any JQL query. Use the interactive autocomplete suggestions below to quickly build queries. Changes apply when clicking <Strong>Apply</Strong>.
                        </Text>

                        {/* JQL Input */}
                        <Textfield
                          isCompact
                          isMonospaced
                          placeholder="e.g. priority = High AND sprint in openSprints() AND status != Done"
                          value={jqlDraft}
                          onChange={(e) => setJqlDraft(e.target.value)}
                        />

                        {/* Interactive Autocomplete Suggestions */}
                        <Stack space="space.050">
                          <Text><Strong>Suggestions (click to insert):</Strong></Text>
                          <Inline space="space.050" alignBlock="center">
                            {getJqlSuggestions().map((sug, idx) => (
                              <Button
                                key={`sug-${idx}`}
                                appearance="subtle"
                                spacing="compact"
                                onClick={() => handleInsertSuggestion(sug.insert)}
                              >
                                {sug.label}
                              </Button>
                            ))}
                          </Inline>
                        </Stack>

                        {/* Apply & Reset Buttons */}
                        <Inline space="space.100" alignBlock="center">
                          <Button
                            appearance="primary"
                            spacing="compact"
                            onClick={handleApplyJql}
                            isDisabled={loadingAnalytics}
                          >
                            Apply
                          </Button>
                          {customJql.trim() !== '' && (
                            <Button
                              appearance="subtle"
                              spacing="compact"
                              onClick={() => {
                                setJqlDraft('');
                                setCustomJql('');
                                if (selectedProject?.key) {
                                  loadAnalytics(selectedProject.key, { customJql: '' });
                                }
                              }}
                              isDisabled={loadingAnalytics}
                            >
                              Clear JQL
                            </Button>
                          )}
                          {customJql.trim() !== '' && (
                            <Lozenge appearance="moved">{`Applied: ${customJql}`}</Lozenge>
                          )}
                        </Inline>
                      </Stack>
                    )}

                  </Stack>
                </Box>
              )}

            </Stack>
          </Box>
        )}

        {/* Global Loading Spinner */}
        {loadingProjects && (
          <Box padding="space.300">
            <Inline space="space.100" alignBlock="center" alignInline="center">
              <Spinner size="medium" />
              <Text>Loading your Jira projects...</Text>
            </Inline>
          </Box>
        )}

        {/* Error Notification */}
        {error && (
          <SectionMessage appearance="error" title="Notice">
            <Text>{error}</Text>
          </SectionMessage>
        )}

        {/* Large Project Pagination Notice */}
        {!loadingProjects && analytics?.isTruncated && (
          <SectionMessage appearance="warning" title="Large Project Notice">
            <Text>
              Displaying analytics calculated from the most recent 1,000 issues (out of {analytics.totalFound} total).
              To inspect specific subsets, refine using Sprint, Assignee, or Custom JQL filters above.
            </Text>
          </SectionMessage>
        )}

        {/* Main Analytics Content */}
        {!loadingProjects && analytics && (
          <Stack space="space.250" alignInline="stretch" grow="fill">
            {/* ═══════════════════════════════════════════════════════
             *  ROW 1 — FIVE KPI HERO CARDS
             *  Shows the key pulse metrics at a glance.
             * ═══════════════════════════════════════════════════════ */}
            <Inline space="space.150" spread="space-between" alignBlock="stretch">

              {/* Card 1: Sprint Completion Rate */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text><Strong>🎯 Completion Rate</Strong></Text>
                    <Lozenge
                      appearance={
                        kpis.completionRate === 100 ? 'success'
                          : kpis.completionRate > 0 ? 'inprogress'
                            : 'default'
                      }
                    >
                      {kpis.completionRate === 100 ? 'Done' : 'Active'}
                    </Lozenge>
                  </Inline>
                  <Heading as="h1">{`${kpis.completionRate}%`}</Heading>
                  <ProgressBar
                    value={kpis.completionRate / 100}
                    appearance="success"
                  />
                  <Text>
                    <Strong>{kpis.completedCount}</Strong>{' of '}<Strong>{kpis.totalIssues}</Strong>{' issues done'}
                  </Text>
                </Stack>
              </Box>

              {/* Card 2: Sprint Velocity (Story Points Done) */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text><Strong>⚡ Sprint Velocity</Strong></Text>
                    <Badge appearance="primary">SP Done</Badge>
                  </Inline>
                  <Heading as="h1">{`${kpis.completedStoryPoints} SP`}</Heading>
                  <Inline space="space.100" alignBlock="center">
                    <Lozenge appearance="default">{`${kpis.totalStoryPoints} SP Total`}</Lozenge>
                    <Lozenge appearance="inprogress">{`${kpis.remainingStoryPoints} SP Left`}</Lozenge>
                  </Inline>
                  <Text>
                    {metricMode === 'hours'
                      ? `${kpis.totalLoggedHours}h logged / ${kpis.totalEstimatedHours}h est.`
                      : `Completion: ${kpis.completedStoryPoints} of ${kpis.totalStoryPoints} SP`}
                  </Text>
                </Stack>
              </Box>

              {/* Card 3: Bug Ratio */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text><Strong>🐛 Bug Ratio</Strong></Text>
                    <Lozenge appearance={kpis.bugRatio > 25 ? 'removed' : kpis.bugRatio > 10 ? 'moved' : 'success'}>
                      {kpis.bugRatio > 25 ? 'High' : kpis.bugRatio > 10 ? 'Watch' : 'Healthy'}
                    </Lozenge>
                  </Inline>
                  <Heading as="h1">{`${kpis.bugRatio}%`}</Heading>
                  <Inline space="space.100" alignBlock="center">
                    <Lozenge appearance={kpis.bugCount > 0 ? 'removed' : 'success'}>
                      {`${kpis.bugCount} bug${kpis.bugCount !== 1 ? 's' : ''}`}
                    </Lozenge>
                    <Lozenge appearance={kpis.staleCount > 0 ? 'moved' : 'default'}>
                      {kpis.staleCount > 0 ? `${kpis.staleCount} stale` : 'No stale'}
                    </Lozenge>
                  </Inline>
                  <Text>
                    {kpis.bugRatio > 30
                      ? '⚠️ Elevated — review quality allocation'
                      : '✅ Within acceptable range'}
                  </Text>
                </Stack>
              </Box>

              {/* Card 4: Story Points Done vs Planned */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text><Strong>📦 SP Done / Planned</Strong></Text>
                    <Badge appearance={kpis.completedStoryPoints >= kpis.totalStoryPoints * 0.8 ? 'added' : 'default'}>
                      {kpis.completedStoryPoints >= kpis.totalStoryPoints * 0.8 ? 'On Track' : 'Behind'}
                    </Badge>
                  </Inline>
                  <Heading as="h1">
                    {`${kpis.completedStoryPoints} / ${kpis.totalStoryPoints}`}
                  </Heading>
                  <ProgressBar
                    value={kpis.totalStoryPoints > 0 ? kpis.completedStoryPoints / kpis.totalStoryPoints : 0}
                    appearance="success"
                  />
                  <Text>
                    {kpis.unestimatedPointsCount > 0
                      ? `⚠️ ${kpis.unestimatedPointsCount} unestimated issues`
                      : '✅ All issues estimated'}
                  </Text>
                </Stack>
              </Box>

              {/* Card 5: Average Cycle Time */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text><Strong>⏱️ Avg Cycle Time</Strong></Text>
                    <Badge appearance="default">Days</Badge>
                  </Inline>
                  <Heading as="h1">
                    {kpis.avgCycleTimeDays !== null && kpis.avgCycleTimeDays > 0 ? `${kpis.avgCycleTimeDays}d` : 'N/A'}
                  </Heading>
                  <Inline space="space.100" alignBlock="center">
                    <Lozenge appearance="default">{`${analytics.teamMembers.filter((m) => m.name !== 'Unassigned').length} active members`}</Lozenge>
                  </Inline>
                  <Text>
                    <Em>{lastRefreshed ? `Synced at ${lastRefreshed}` : 'Real-time sync'}</Em>
                  </Text>
                </Stack>
              </Box>

            </Inline>

            {/* Navigation Tabs */}
            <Tabs id="agile-pulse-main-tabs">
              <TabList>
                <Tab>📈 Overview & Breakdown</Tab>
                <Tab>👥 Team Workload ({analytics.teamMembers.length})</Tab>
                <Tab>
                  ⚠️ Bottlenecks & Stale Issues{' '}
                  {kpis.staleCount > 0 ? `(${kpis.staleCount})` : ''}
                </Tab>
                <Tab>📋 Issue Explorer</Tab>
                <Tab>📑 Executive Standup</Tab>
              </TabList>

              {/* ═══════════════════════════════════════════════════════
               *  TAB 1: Overview & Breakdown — NEW 3-ROW DASHBOARD
               * ═══════════════════════════════════════════════════════ */}
              <TabPanel>
                <Box padding="space.100" xcss={fullWidthBoxStyle}>
                  <Stack space="space.250" alignInline="stretch" grow="fill">
                    {/* ════════════════════════════════════════════════════
                     *  ROW 2: Status Breakdown + Issue Type Breakdown
                     *  50/50 split using explicit xcss width: '49%'
                     * ════════════════════════════════════════════════════ */}
                    <Inline space="space.200" spread="space-between" alignBlock="stretch">

                      {/* LEFT: Status Breakdown — BarChart */}
                      <Box xcss={chartCardHalfStyle}>
                        <Stack space="space.150">
                          <Inline spread="space-between" alignBlock="center">
                            <Heading as="h3">📊 Status Breakdown</Heading>
                            <Lozenge appearance={kpis.completionRate >= 50 ? 'success' : 'inprogress'}>
                              {kpis.completionRate >= 50 ? 'On Track' : 'Below Target'}
                            </Lozenge>
                          </Inline>
                          <Text>
                            Issue counts per status category — discrete categories, not a time series.
                          </Text>

                          {kpis.totalIssues > 0 ? (
                            <BarChart
                              data={[
                                { status: 'To Do', count: kpis.toDoCount },
                                { status: 'In Progress', count: kpis.inProgressCount },
                                { status: 'Done', count: kpis.completedCount },
                              ]}
                              xAccessor="status"
                              yAccessor="count"
                              height={280}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState header="No data" description="No issues match the current filter." />
                          )}

                          <Inline space="space.100">
                            <Lozenge appearance="default">{`To Do: ${kpis.toDoCount}`}</Lozenge>
                            <Lozenge appearance="inprogress">{`In Progress: ${kpis.inProgressCount}`}</Lozenge>
                            <Lozenge appearance="success">{`Done: ${kpis.completedCount}`}</Lozenge>
                          </Inline>
                        </Stack>
                      </Box>

                      {/* RIGHT: Issue Type Breakdown — BarChart */}
                      <Box xcss={chartCardHalfStyle}>
                        <Stack space="space.150">
                          <Inline spread="space-between" alignBlock="center">
                            <Heading as="h3">🐛 Issue Type Breakdown</Heading>
                            <Lozenge appearance={kpis.bugRatio > 25 ? 'removed' : 'success'}>
                              {`Bug Ratio: ${kpis.bugRatio}%`}
                            </Lozenge>
                          </Inline>
                          <Text>
                            Distribution of issue types in the current filter scope.
                          </Text>

                          {(analytics.charts?.types || []).length > 0 ? (
                            <BarChart
                              data={(analytics.charts?.types || []).map((t) => ({
                                type: t.name,
                                count: t.value,
                              }))}
                              xAccessor="type"
                              yAccessor="count"
                              height={280}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState header="No data" description="No issue type data available." />
                          )}

                          <Stack space="space.050">
                            <Text><Strong>🎯 Priority Levels:</Strong></Text>
                            <Inline space="space.075">
                              {(analytics.charts?.priorities || []).map((p, idx) => (
                                <Lozenge key={`prio-${idx}`} appearance={getPriorityAppearance(p.name)}>
                                  {`${p.name}: ${p.value}`}
                                </Lozenge>
                              ))}
                            </Inline>
                          </Stack>
                        </Stack>
                      </Box>

                    </Inline>

                    {/* ════════════════════════════════════════════════════
                     *  ROW 3: Team Distribution (50%) + Status Funnel (50%)
                     *  (Using 50/50 split to match the mockup 2x2 grid exactly)
                     * ════════════════════════════════════════════════════ */}
                    <Inline space="space.200" spread="space-between" alignBlock="stretch">

                      {/* LEFT (50%): Team Member Distribution */}
                      <Box xcss={chartCardHalfStyle}>
                        <Stack space="space.150">
                          <Inline spread="space-between" alignBlock="center">
                            <Heading as="h3">👥 Team Member Distribution</Heading>
                            <Badge appearance="default">
                              {`${analytics.teamMembers.filter((m) => m.name !== 'Unassigned').length} Members`}
                            </Badge>
                          </Inline>
                          <Text>
                            {metricMode === 'points'
                              ? 'SP per member — falls back to issue count if unestimated.'
                              : 'Hours per member — falls back to issue count if untracked.'}
                          </Text>

                          {analytics.teamMembers.filter((m) => m.name !== 'Unassigned').length > 0 ? (
                            <HorizontalBarChart
                              data={analytics.teamMembers
                                .filter((m) => m.name !== 'Unassigned')
                                .slice(0, 10)
                                .map((m) => {
                                  const primaryValue = metricMode === 'points'
                                    ? m.completedPoints
                                    : m.loggedHours;
                                  const displayValue = primaryValue > 0
                                    ? primaryValue
                                    : m.completedIssues > 0
                                      ? m.completedIssues
                                      : m.totalIssues;
                                  return { name: m.name, value: displayValue };
                                })}
                              xAccessor="value"
                              yAccessor="name"
                              height={Math.max(
                                260,
                                analytics.teamMembers.filter((m) => m.name !== 'Unassigned').length * 48
                              )}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState
                              header="No team data"
                              description="No assigned members in this filter scope."
                            />
                          )}

                          <Text>
                            <Em>
                              {metricMode === 'points'
                                ? 'SP completed per member (falls back to issue count if unestimated)'
                                : 'Hours logged per member (falls back to issue count if untracked)'}
                            </Em>
                          </Text>
                        </Stack>
                      </Box>

                      {/* RIGHT (50%): Status Funnel */}
                      <Box xcss={chartCardHalfStyle}>
                        <Stack space="space.150">
                          <Inline spread="space-between" alignBlock="center">
                            <Heading as="h3">🔽 Status Funnel</Heading>
                            <Lozenge appearance={kpis.inProgressCount > kpis.completedCount ? 'moved' : 'success'}>
                              {kpis.inProgressCount > kpis.completedCount ? 'Bottleneck Risk' : 'Flowing'}
                            </Lozenge>
                          </Inline>
                          <Text>
                            Issue flow through workflow stages. Large In Progress vs Done gap = bottleneck.
                          </Text>

                          {kpis.totalIssues > 0 ? (
                            <BarChart
                              data={[
                                { stage: 'To Do', issues: kpis.toDoCount },
                                { stage: 'In Progress', issues: kpis.inProgressCount },
                                { stage: 'Done', issues: kpis.completedCount },
                              ]}
                              xAccessor="stage"
                              yAccessor="issues"
                              height={280}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState header="No data" description="No issues to display." />
                          )}

                          <Stack space="space.075">
                            <Inline space="space.100" spread="space-between">
                              <Text>To Do</Text>
                              <Badge appearance="default">{kpis.toDoCount}</Badge>
                            </Inline>
                            <Inline space="space.100" spread="space-between">
                              <Text>In Progress</Text>
                              <Badge appearance="primary">{kpis.inProgressCount}</Badge>
                            </Inline>
                            <Inline space="space.100" spread="space-between">
                              <Text>Done</Text>
                              <Badge appearance="added">{kpis.completedCount}</Badge>
                            </Inline>
                            {kpis.staleCount > 0 && (
                              <Inline space="space.100" spread="space-between">
                                <Text>⚠️ Stale (&ge;4 days)</Text>
                                <Badge appearance="removed">{kpis.staleCount}</Badge>
                              </Inline>
                            )}
                          </Stack>
                        </Stack>
                      </Box>

                    </Inline>

                  </Stack>
                </Box>
              </TabPanel>

              {/* TAB 2: Team Workload & Capacity Balancer */}
              <TabPanel>
                <Box padding="space.100">
                  <Box xcss={sectionCardStyle}>
                    <Stack space="space.200">
                      <Inline spread="space-between" alignBlock="center">
                        <Stack space="space.050">
                          <Heading as="h3">
                            👥 Team Workload &{' '}
                            {metricMode === 'points' ? 'Story Points' : 'Hours'} Capacity Balancer
                          </Heading>
                          <Text>
                            {metricMode === 'points'
                              ? 'Track active issue distribution and estimated Story Points per team member to prevent developer burnout.'
                              : 'Track active issue distribution and estimated hours per team member to prevent developer burnout.'}
                          </Text>
                        </Stack>
                      </Inline>

                      {analytics.teamMembers.length > 0 ? (
                        <DynamicTable
                          caption={
                            metricMode === 'points'
                              ? 'Team Story Points Allocation'
                              : 'Team Hours Allocation'
                          }
                          head={{
                            cells: [
                              { key: 'name', content: 'Team Member', isSortable: true },
                              { key: 'total', content: 'Assigned Issues', isSortable: true },
                              { key: 'completed', content: 'Completed' },
                              {
                                key: 'metrics',
                                content:
                                  metricMode === 'points'
                                    ? 'Story Points (Done / Total)'
                                    : 'Effort (Spent / Est. Hours)',
                              },
                              { key: 'capacity', content: 'Capacity Status' },
                            ],
                          }}
                          rows={teamTableRows}
                        />
                      ) : (
                        <EmptyState
                          header="No Team Members Found"
                          description="No assignees match the current filters in this project."
                        />
                      )}
                    </Stack>
                  </Box>
                </Box>
              </TabPanel>

              {/* TAB 3: Bottlenecks & Stale Issues */}
              <TabPanel>
                <Box padding="space.100">
                  <Box xcss={sectionCardStyle}>
                    <Stack space="space.200">
                      <Stack space="space.050">
                        <Heading as="h3">⚠️ Bottleneck Detector & Stale Tickets</Heading>
                        <Text>
                          Tickets in open or in-progress statuses with no updates for ≥ 4 days are
                          flagged as potential blockers.
                        </Text>
                      </Stack>

                      {analytics.staleIssues && analytics.staleIssues.length > 0 ? (
                        <>
                          <SectionMessage appearance="warning" title="Action Recommended">
                            <Text>
                              {analytics.staleIssues.length} tickets appear stalled. Review them in
                              daily standup to unblock team members.
                            </Text>
                          </SectionMessage>

                          <DynamicTable
                            caption="Stalled & Inactive Tickets"
                            head={{
                              cells: [
                                { key: 'key', content: 'Key', isSortable: true },
                                { key: 'summary', content: 'Summary' },
                                { key: 'status', content: 'Status' },
                                { key: 'priority', content: 'Priority' },
                                { key: 'assignee', content: 'Assignee' },
                                { key: 'inactive', content: 'Inactivity Alert', isSortable: true },
                              ],
                            }}
                            rows={staleTableRows}
                          />
                        </>
                      ) : (
                        <SectionMessage appearance="confirmation" title="Smooth Flow">
                          <Text>
                            🎉 Outstanding! No stale or blocked issues detected with the current filters.
                          </Text>
                        </SectionMessage>
                      )}
                    </Stack>
                  </Box>
                </Box>
              </TabPanel>

              {/* TAB 4: Issue Explorer Drill-down */}
              <TabPanel>
                <Box padding="space.100">
                  <Box xcss={sectionCardStyle}>
                    <Stack space="space.200">
                      <Heading as="h3">📋 Project Issue Explorer</Heading>
                      <Text>
                        Recent active issues with{' '}
                        {metricMode === 'points' ? 'Story Point estimates' : 'Hours logged & estimated'}{' '}
                        for {selectedProject?.name}.
                      </Text>

                      {analytics.recentIssues && analytics.recentIssues.length > 0 ? (
                        <DynamicTable
                          caption="Recent Issues Drill-down"
                          head={{
                            cells: [
                              { key: 'key', content: 'Key' },
                              { key: 'type', content: 'Type' },
                              { key: 'summary', content: 'Summary' },
                              { key: 'status', content: 'Status' },
                              { key: 'priority', content: 'Priority' },
                              { key: 'assignee', content: 'Assignee' },
                              {
                                key: 'metric',
                                content:
                                  metricMode === 'points' ? 'Story Points' : 'Est / Spent (Hours)',
                              },
                            ],
                          }}
                          rows={explorerTableRows}
                        />
                      ) : (
                        <EmptyState
                          header="No Issues Found"
                          description="No issues match the current search or filter criteria."
                        />
                      )}
                    </Stack>
                  </Box>
                </Box>
              </TabPanel>

              {/* TAB 5: Executive Standup Brief */}
              <TabPanel>
                <Box padding="space.100">
                  <Box xcss={sectionCardStyle}>
                    <Stack space="space.200">
                      <Heading as="h3">📑 Executive Standup & Stakeholder Summary</Heading>
                      <Text>
                        Copy and paste this structured status report directly into Slack, MS Teams,
                        or Confluence for your team standup.
                      </Text>

                      <CodeBlock
                        language="markdown"
                        text={
                          metricMode === 'points'
                            ? analytics.executiveSummaryPoints || 'No summary available.'
                            : analytics.executiveSummaryHours || 'No summary available.'
                        }
                      />
                    </Stack>
                  </Box>
                </Box>
              </TabPanel>
            </Tabs>
          </Stack>
        )}

        {/* Empty state when no project is loaded or available */}
        {!loadingProjects && !analytics && !error && (
          <EmptyState
            header="Select a Project"
            description="Choose a Jira project from the dropdown above to generate full Agile analytics."
          />
        )}
      </Stack>
    </Box>
  );
};

// Render using native Forge UI Kit Reconciler
ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);