import React, { useEffect, useState, useCallback } from 'react';
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
  useProductContext,
  xcss,
  PieChart,
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
  minWidth: '220px',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedIssueType, setSelectedIssueType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [customJql, setCustomJql] = useState('');
  const [showAdvancedJql, setShowAdvancedJql] = useState(false);

  // Dynamic filter options populated from project
  const [filterOptions, setFilterOptions] = useState({
    assignees: [{ label: 'All Assignees', value: 'all' }],
    issueTypes: [{ label: 'All Issue Types', value: 'all' }],
    statuses: [{ label: 'All Statuses', value: 'all' }],
  });

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
        });
      }
    } catch (err) {
      console.warn('Could not load filter options:', err.message);
    }
  }, []);

  /**
   * Loads analytics for the selected project applying all active dynamic filters.
   */
  const loadAnalytics = useCallback(
    async (projectKey, overrideFilters = {}) => {
      if (!projectKey) return;
      setLoadingAnalytics(true);
      setError(null);
      try {
        const payload = {
          projectKey,
          searchQuery:
            overrideFilters.searchQuery !== undefined ? overrideFilters.searchQuery : searchQuery,
          assignee:
            overrideFilters.assignee !== undefined ? overrideFilters.assignee : selectedAssignee,
          issueType:
            overrideFilters.issueType !== undefined ? overrideFilters.issueType : selectedIssueType,
          status:
            overrideFilters.status !== undefined ? overrideFilters.status : selectedStatus,
          customJql:
            overrideFilters.customJql !== undefined ? overrideFilters.customJql : customJql,
        };

        const res = await invoke('getProjectAnalytics', payload);
        if (res.success) {
          setAnalytics(res);
          setLastRefreshed(new Date().toLocaleTimeString());
        } else {
          setError(res.error || 'Failed to load project analytics.');
          setAnalytics(null);
        }
      } catch (err) {
        setError(`Error fetching analytics: ${err.message}`);
        setAnalytics(null);
      } finally {
        setLoadingAnalytics(false);
      }
    },
    [searchQuery, selectedAssignee, selectedIssueType, selectedStatus, customJql]
  );

  // Initial load of Jira projects
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // When selected project changes, fetch filter options and reload analytics
  useEffect(() => {
    if (selectedProject?.key) {
      loadFilterOptions(selectedProject.key);
      loadAnalytics(selectedProject.key);
    }
  }, [selectedProject, loadFilterOptions, loadAnalytics]);

  const handleProjectSelect = (option) => {
    if (!option) return;
    const proj = projects.find((p) => p.key === option.value);
    if (proj) {
      // Reset active filters when changing project
      setSearchQuery('');
      setSelectedAssignee('all');
      setSelectedIssueType('all');
      setSelectedStatus('all');
      setCustomJql('');
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

  // Filter Handlers
  const handleAssigneeFilterChange = (option) => {
    const val = option?.value || 'all';
    setSelectedAssignee(val);
    if (selectedProject?.key) {
      loadAnalytics(selectedProject.key, { assignee: val });
    }
  };

  const handleIssueTypeFilterChange = (option) => {
    const val = option?.value || 'all';
    setSelectedIssueType(val);
    if (selectedProject?.key) {
      loadAnalytics(selectedProject.key, { issueType: val });
    }
  };

  const handleStatusFilterChange = (option) => {
    const val = option?.value || 'all';
    setSelectedStatus(val);
    if (selectedProject?.key) {
      loadAnalytics(selectedProject.key, { status: val });
    }
  };

  const handleApplySearch = () => {
    if (selectedProject?.key) {
      loadAnalytics(selectedProject.key);
    }
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedAssignee('all');
    setSelectedIssueType('all');
    setSelectedStatus('all');
    setCustomJql('');
    if (selectedProject?.key) {
      loadAnalytics(selectedProject.key, {
        searchQuery: '',
        assignee: 'all',
        issueType: 'all',
        status: 'all',
        customJql: '',
      });
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedAssignee !== 'all' ||
    selectedIssueType !== 'all' ||
    selectedStatus !== 'all' ||
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

  const statusPieData = [
    { label: 'To Do', value: kpis?.toDoCount || 0 },
    { label: 'In Progress', value: kpis?.inProgressCount || 0 },
    { label: 'Done', value: kpis?.completedCount || 0 },
  ].filter((item) => item.value > 0);

  return (
    <Box padding="space.200">
      <Stack space="space.200">
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

        {/* Dynamic Filter Toolbar */}
        {selectedProject && (
          <Box xcss={filterToolbarStyle}>
            <Stack space="space.100">
              <Inline space="space.150" alignBlock="center" spread="space-between">
                {/* Search & Select Filters */}
                <Inline space="space.100" alignBlock="center">
                  {/* Keyword / Summary Search */}
                  <Box style={{ minWidth: '220px' }}>
                    <Textfield
                      isCompact
                      placeholder="🔍 Search issue key, summary..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </Box>

                  {/* Assignee Filter Dropdown */}
                  <Box style={{ minWidth: '170px' }}>
                    <Select
                      spacing="compact"
                      isSearchable={false}
                      options={filterOptions.assignees}
                      value={
                        filterOptions.assignees.find((a) => a.value === selectedAssignee) ||
                        filterOptions.assignees[0]
                      }
                      onChange={handleAssigneeFilterChange}
                      isDisabled={loadingAnalytics}
                    />
                  </Box>

                  {/* Issue Type Filter Dropdown */}
                  <Box style={{ minWidth: '160px' }}>
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

                  {/* Status Filter Dropdown */}
                  <Box style={{ minWidth: '150px' }}>
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

                  <Button
                    appearance="default"
                    spacing="compact"
                    onClick={handleApplySearch}
                    isDisabled={loadingAnalytics}
                  >
                    🔍 Filter
                  </Button>
                </Inline>

                {/* Advanced JQL toggle & Clear button */}
                <Inline space="space.100" alignBlock="center">
                  <Button
                    appearance="subtle"
                    spacing="compact"
                    onClick={() => setShowAdvancedJql(!showAdvancedJql)}
                  >
                    {showAdvancedJql ? '🔼 Hide JQL' : '⚙️ Custom JQL'}
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

              {/* Advanced Custom JQL Input Panel */}
              {showAdvancedJql && (
                <Box padding="space.100">
                  <Inline space="space.100" alignBlock="center">
                    <Box style={{ flexGrow: 1 }}>
                      <Textfield
                        isCompact
                        isMonospaced
                        placeholder="Enter custom JQL (e.g. priority = High AND sprint in openSprints()...)"
                        value={customJql}
                        onChange={(e) => setCustomJql(e.target.value)}
                      />
                    </Box>
                    <Button
                      appearance="primary"
                      spacing="compact"
                      onClick={handleApplySearch}
                      isDisabled={loadingAnalytics}
                    >
                      Apply JQL
                    </Button>
                  </Inline>
                </Box>
              )}

              {/* Active Filter Indicators */}
              {hasActiveFilters && (
                <Inline space="space.050" alignBlock="center">
                  <Text><Strong>Active Filters:</Strong></Text>
                  {searchQuery.trim() !== '' && (
                    <Lozenge appearance="inprogress">{`Search: "${searchQuery}"`}</Lozenge>
                  )}
                  {selectedAssignee !== 'all' && (
                    <Lozenge appearance="inprogress">{`Assignee: ${selectedAssignee}`}</Lozenge>
                  )}
                  {selectedIssueType !== 'all' && (
                    <Lozenge appearance="inprogress">{`Type: ${selectedIssueType}`}</Lozenge>
                  )}
                  {selectedStatus !== 'all' && (
                    <Lozenge appearance="inprogress">{`Status: ${selectedStatus}`}</Lozenge>
                  )}
                  {customJql.trim() !== '' && (
                    <Lozenge appearance="inprogress">{`JQL: ${customJql}`}</Lozenge>
                  )}
                </Inline>
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

        {/* Main Analytics Content */}
        {!loadingProjects && analytics && (
          <Stack space="space.250">
            {/* Elevated Hero KPI Scorecards Grid */}
            <Inline space="space.150" spread="space-between">
              {/* Card 1: Sprint Completion */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text>
                      <Strong>🎯 Sprint Completion</Strong>
                    </Text>
                    <Lozenge
                      appearance={
                        kpis.completionRate === 100
                          ? 'success'
                          : kpis.completionRate > 0
                          ? 'inprogress'
                          : 'default'
                      }
                    >
                      {kpis.completionRate === 100 ? 'Completed' : 'In Progress'}
                    </Lozenge>
                  </Inline>

                  <Heading as="h1">{`${kpis.completionRate}%`}</Heading>

                  <ProgressBar
                    value={kpis.completionRate / 100}
                    appearance={kpis.completionRate >= 50 ? 'success' : 'inprogress'}
                  />

                  <Text>
                    <Strong>{kpis.completedCount}</Strong> of <Strong>{kpis.totalIssues}</Strong> issues resolved
                  </Text>
                </Stack>
              </Box>

              {/* Card 2: Velocity & Effort */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text>
                      <Strong>
                        {metricMode === 'points' ? '⚡ Story Points' : '⏱️ Total Effort'}
                      </Strong>
                    </Text>
                    <Badge appearance="primary">
                      {metricMode === 'points' ? 'Velocity' : 'Worklog'}
                    </Badge>
                  </Inline>

                  <Heading as="h1">
                    {metricMode === 'points'
                      ? `${kpis.totalStoryPoints} SP`
                      : `${kpis.totalEstimatedHours}h`}
                  </Heading>

                  <Inline space="space.100" alignBlock="center">
                    {metricMode === 'points' ? (
                      <>
                        <Lozenge appearance="success">{`${kpis.completedStoryPoints} SP Done`}</Lozenge>
                        <Lozenge appearance="inprogress">{`${kpis.remainingStoryPoints} SP Left`}</Lozenge>
                      </>
                    ) : (
                      <>
                        <Lozenge appearance="success">{`${kpis.totalLoggedHours}h Logged`}</Lozenge>
                        <Lozenge appearance="inprogress">{`${kpis.totalRemainingHours}h Left`}</Lozenge>
                      </>
                    )}
                  </Inline>

                  <Text>
                    {kpis.avgCycleTimeDays !== null
                      ? `⚡ Cycle Time: ${kpis.avgCycleTimeDays} days avg`
                      : 'Cycle time tracking active'}
                  </Text>
                </Stack>
              </Box>

              {/* Card 3: Team Health & Capacity */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text>
                      <Strong>👥 Active Team</Strong>
                    </Text>
                    <Badge appearance="default">{`${analytics.teamMembers.length} Members`}</Badge>
                  </Inline>

                  <Heading as="h1">
                    {`${analytics.teamMembers.filter((m) => m.name !== 'Unassigned').length} Active`}
                  </Heading>

                  <Inline space="space.100" alignBlock="center">
                    {kpis.unassignedCount > 0 ? (
                      <Lozenge appearance="removed">{`${kpis.unassignedCount} Unassigned`}</Lozenge>
                    ) : (
                      <Lozenge appearance="success">All Assigned</Lozenge>
                    )}
                  </Inline>

                  <Text>
                    {metricMode === 'points' ? (
                      kpis.unestimatedPointsCount > 0
                        ? `⚠️ ${kpis.unestimatedPointsCount} tickets missing SP`
                        : '✅ All tickets estimated'
                    ) : (
                      kpis.unestimatedHoursCount > 0
                        ? `⚠️ ${kpis.unestimatedHoursCount} tickets missing hours`
                        : '✅ All tickets estimated'
                    )}
                  </Text>
                </Stack>
              </Box>

              {/* Card 4: Risks & Quality */}
              <Box xcss={kpiCardStyle}>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center">
                    <Text>
                      <Strong>🚦 Risk & Quality</Strong>
                    </Text>
                    {kpis.staleCount > 0 ? (
                      <Badge appearance="removed">{`${kpis.staleCount} Stale`}</Badge>
                    ) : (
                      <Badge appearance="added">0 Stale</Badge>
                    )}
                  </Inline>

                  <Heading as="h1">{`${kpis.bugRatio}%`}</Heading>

                  <Inline space="space.100" alignBlock="center">
                    <Lozenge appearance={kpis.bugCount > 0 ? 'removed' : 'success'}>
                      {`${kpis.bugCount} bugs detected`}
                    </Lozenge>
                    <Lozenge appearance={kpis.staleCount > 0 ? 'moved' : 'default'}>
                      {kpis.staleCount > 0 ? 'Action Needed' : 'Smooth Flow'}
                    </Lozenge>
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

              {/* TAB 1: Overview & Distribution */}
              <TabPanel>
                <Box padding="space.100">
                  <Stack space="space.200">
                    <Inline space="space.200" spread="space-between">
                      {/* Status Breakdown with Visual Chart */}
                      <Box xcss={sectionCardStyle} style={{ flex: '1 1 0' }}>
                        <Stack space="space.150">
                          <Inline spread="space-between" alignBlock="center">
                            <Heading as="h3">📊 Status Distribution</Heading>
                            <Badge appearance="primary">{`${kpis.totalIssues} Total Tickets`}</Badge>
                          </Inline>

                          {statusPieData.length > 0 ? (
                            <PieChart
                              data={statusPieData}
                              valueAccessor="value"
                              labelAccessor="label"
                              colorAccessor="label"
                              height={220}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState header="No tickets" description="No tickets match the current filter." />
                          )}

                          <Inline space="space.100">
                            <Lozenge appearance="default">{`To Do: ${kpis.toDoCount}`}</Lozenge>
                            <Lozenge appearance="inprogress">{`In Progress: ${kpis.inProgressCount}`}</Lozenge>
                            <Lozenge appearance="success">{`Done: ${kpis.completedCount}`}</Lozenge>
                          </Inline>
                        </Stack>
                      </Box>

                      {/* Issue Types & Bug Ratio */}
                      <Box xcss={sectionCardStyle} style={{ flex: '1 1 0' }}>
                        <Stack space="space.150">
                          <Inline spread="space-between" alignBlock="center">
                            <Heading as="h3">🐛 Quality & Types</Heading>
                            <Lozenge appearance={kpis.bugRatio > 25 ? 'removed' : 'success'}>
                              {`Bug Ratio: ${kpis.bugRatio}%`}
                            </Lozenge>
                          </Inline>

                          <Inline space="space.100">
                            {(analytics.charts?.types || []).map((t, idx) => (
                              <Badge key={`type-${idx}`} appearance="primary">
                                {`${t.name}: ${t.value}`}
                              </Badge>
                            ))}
                          </Inline>

                          <Text>
                            {kpis.bugRatio > 30
                              ? '⚠️ Bug ratio is elevated. Consider allocating more sprint capacity to quality and tech debt.'
                              : '✅ Healthy balance between feature development and bug fixes.'}
                          </Text>

                          {/* Priority Breakdown Pills */}
                          <Stack space="space.050">
                            <Text><Strong>🎯 Priority Levels:</Strong></Text>
                            <Inline space="space.100">
                              {(analytics.charts?.priorities || []).map((p, idx) => (
                                <Lozenge
                                  key={`prio-${idx}`}
                                  appearance={getPriorityAppearance(p.name)}
                                >
                                  {`${p.name}: ${p.value}`}
                                </Lozenge>
                              ))}
                            </Inline>
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