import React, { useEffect, useState, useCallback, useRef } from 'react';
import ForgeReconciler, {
  Box,
  Stack,
  Inline,
  Text,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Spinner,
  SectionMessage,
  EmptyState,
  Strong,
  Lozenge,
  Badge,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

import {
  fullWidthBoxStyle,
  getStatusAppearance,
  getCapacityAppearance,
  getPriorityAppearance,
} from './styles';
import { HeaderBar } from './components/HeaderBar';
import { FilterToolbar } from './components/FilterToolbar';
import { KpiHeroCards } from './components/KpiHeroCards';
import { OverviewTab } from './components/tabs/OverviewTab';
import { TeamWorkloadTab } from './components/tabs/TeamWorkloadTab';
import { BottlenecksTab } from './components/tabs/BottlenecksTab';
import { IssueExplorerTab } from './components/tabs/IssueExplorerTab';
import { ExecutiveStandupTab } from './components/tabs/ExecutiveStandupTab';
import { CustomAnalyticsTab } from './components/tabs/CustomAnalyticsTab';

/**
 * Main application component for Agile Pulse Analytics.
 * Built using native Atlassian Forge UI Kit components (@forge/react)
 * following a clean, modular component architecture.
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
  const [selectedSprint, setSelectedSprint] = useState('active');
  const [customJql, setCustomJql] = useState('');
  const [jqlDraft, setJqlDraft] = useState(''); // draft text before user hits Apply

  // Filter panel state: open/closed, active tab ('basic' or 'jql'), and selected field on left
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterTab, setFilterTab] = useState('basic'); // 'basic', 'advanced', or 'jql'
  const [activeFilterField, setActiveFilterField] = useState(null);
  const [activeFieldList, setActiveFieldList] = useState(['parent', 'assignee', 'status', 'issueType', 'labels', 'sprint', 'priority']);



  // Custom Analytics Engine State
  const [customWidgets, setCustomWidgets] = useState([]);

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
    sprints: [
      { label: 'Active Sprint (Current)', value: 'active' },
      { label: 'All Sprints & Project Scope', value: 'all' },
    ],
  });

  const activeRequestIdRef = useRef(0);
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

        if (activeRequestIdRef.current !== currentRequestId) {
          return;
        }

        if (res.success) {
          setAnalytics(res);
          setLastRefreshed(new Date().toLocaleTimeString());

          // Merge any newly detected sprints into the sprint filter dropdown
          if (Array.isArray(res.detectedSprints) && res.detectedSprints.length > 0) {
            setFilterOptions((prev) => {
              const currentSprints = prev.sprints || [];
              const existingVals = new Set(currentSprints.map((s) => s.value));
              const additions = [];

              res.detectedSprints.forEach((ds) => {
                if (ds.name && !existingVals.has(ds.name)) {
                  const stateBadge =
                    ds.state === 'active'
                      ? ' (Active)'
                      : ds.state === 'future'
                      ? ' (Future)'
                      : ds.state === 'closed'
                      ? ' (Closed)'
                      : '';
                  additions.push({
                    label: `${ds.name}${stateBadge}`,
                    value: ds.name,
                    state: ds.state,
                  });
                }
              });

              if (additions.length > 0) {
                const updatedList = [...currentSprints];
                // Insert right below 'active' preset
                const activeIndex = updatedList.findIndex((s) => s.value === 'active');
                if (activeIndex !== -1) {
                  updatedList.splice(activeIndex + 1, 0, ...additions);
                } else {
                  updatedList.unshift(...additions);
                }
                return { ...prev, sprints: updatedList };
              }
              return prev;
            });
          }
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

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProject?.key) {
      loadFilterOptions(selectedProject.key);
      loadAnalytics(selectedProject.key, {
        searchQuery: '',
        assignee: 'all',
        issueType: 'all',
        status: 'all',
        priority: 'all',
        sprint: 'active',
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
      setSelectedAssignee('all');
      setSelectedIssueType('all');
      setSelectedStatus('all');
      setSelectedPriority('all');
      setSelectedSprint('active');
      setCustomJql('');
      setJqlDraft('');
      setFilterPanelOpen(false);
      setSelectedProject(proj);
    }
  };

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

  // Table row calculations
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





  return (
    <Box padding="space.200" xcss={fullWidthBoxStyle}>
      <Stack space="space.200" alignInline="stretch" grow="fill">
        {/* Header Bar */}
        <HeaderBar
          metricMode={metricMode}
          setMetricMode={setMetricMode}
          projects={projects}
          selectedProject={selectedProject}
          handleProjectSelect={handleProjectSelect}
          loadingAnalytics={loadingAnalytics}
          loadAnalytics={loadAnalytics}
        />

        {/* Filter Bar */}
        <FilterToolbar
          selectedProject={selectedProject}
          hasActiveFilters={hasActiveFilters}
          filterPanelOpen={filterPanelOpen}
          setFilterPanelOpen={setFilterPanelOpen}
          selectedSprint={selectedSprint}
          selectedAssignee={selectedAssignee}
          selectedIssueType={selectedIssueType}
          selectedStatus={selectedStatus}
          selectedPriority={selectedPriority}
          customJql={customJql}
          setCustomJql={setCustomJql}
          jqlDraft={jqlDraft}
          setJqlDraft={setJqlDraft}
          loadingAnalytics={loadingAnalytics}
          handleClearAllFilters={handleClearAllFilters}
          filterTab={filterTab}
          setFilterTab={setFilterTab}
          activeFilterField={activeFilterField}
          setActiveFilterField={setActiveFilterField}
          activeFieldList={activeFieldList}
          setActiveFieldList={setActiveFieldList}
          filterOptions={filterOptions}
          handleSprintFilterChange={handleSprintFilterChange}
          handleAssigneeFilterChange={handleAssigneeFilterChange}
          handleStatusFilterChange={handleStatusFilterChange}
          handleIssueTypeFilterChange={handleIssueTypeFilterChange}
          handlePriorityFilterChange={handlePriorityFilterChange}
          getJqlSuggestions={getJqlSuggestions}
          handleInsertSuggestion={handleInsertSuggestion}
          handleApplyJql={handleApplyJql}
          loadAnalytics={loadAnalytics}
        />

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
            {/* 5 KPI Hero Cards */}
            <KpiHeroCards
              kpis={kpis}
              metricMode={metricMode}
              analytics={analytics}
              selectedSprint={selectedSprint}
              lastRefreshed={lastRefreshed}
            />

            {/* Navigation Tabs */}
            <Tabs id="agile-pulse-main-tabs">
              <TabList>
                <Tab>Current Sprint Overview</Tab>
                <Tab>👥 Team Workload ({analytics.teamMembers.length})</Tab>
                <Tab>
                  ⚠️ Bottlenecks & Stale Issues{' '}
                  {kpis.staleCount > 0 ? `(${kpis.staleCount})` : ''}
                </Tab>
                <Tab>📋 Issue Explorer</Tab>
                <Tab>📑 Executive Standup</Tab>
                <Tab>🪄 Custom Analytics Engine</Tab>
              </TabList>

              {/* TAB 1 */}
              <TabPanel>
                <OverviewTab
                  kpis={kpis}
                  analytics={analytics}
                  metricMode={metricMode}
                  selectedSprint={selectedSprint}
                />
              </TabPanel>

              {/* TAB 2 */}
              <TabPanel>
                <TeamWorkloadTab analytics={analytics} metricMode={metricMode} teamTableRows={teamTableRows} />
              </TabPanel>

              {/* TAB 3 */}
              <TabPanel>
                <BottlenecksTab analytics={analytics} staleTableRows={staleTableRows} />
              </TabPanel>

              {/* TAB 4 */}
              <TabPanel>
                <IssueExplorerTab
                  analytics={analytics}
                  metricMode={metricMode}
                  selectedProject={selectedProject}
                  explorerTableRows={explorerTableRows}
                />
              </TabPanel>

              {/* TAB 5 */}
              <TabPanel>
                <ExecutiveStandupTab analytics={analytics} metricMode={metricMode} />
              </TabPanel>



              {/* TAB 7 */}
              <TabPanel>
                <CustomAnalyticsTab
                  rawIssues={analytics?.rawIssues || []}
                  customWidgets={customWidgets}
                  setCustomWidgets={setCustomWidgets}
                />
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