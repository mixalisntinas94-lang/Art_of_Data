import React, { useState } from 'react';
import {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  Lozenge,
  Select,
  Textfield,
  Button,
  Strong,
  Em,
} from '@forge/react';
import {
  filterToolbarStyle,
  filterPanelContainerStyle,
  filterLeftColStyle,
  filterRightColStyle,
  filterFooterStyle,
  filterCodeEditorBoxStyle,
  filterSavedMenuBoxStyle,
  filterClauseRowStyle,
} from '../styles';

/**
 * FilterToolbar Component
 *
 * Pixel-accurate implementation of native Jira Cloud List filter popover:
 * - Basic Tab: Left column fields, idle placeholder ("Select a field to start creating a filter."),
 *   + Add field dropdown, and dedicated right-column field editors (with segregated Sprint Scopes vs Named Sprints).
 * - Advanced Tab: Structured clause builder ([ Space = ... ], [ Sprint = ... ], + Add filters, Clear all).
 * - JQL Tab: Dark code editor container with syntax query, action icons (⛶, 🔍), suggestion chips, and Apply.
 * - Saved filters ˅ Dropdown: Interactive presets menu (Assigned to me, My open work items, Reported by me, etc.).
 * - Native Footer: '📣 Give feedback' on left, 'Press [Shift] + [F] to open and close' on right.
 */
export const FilterToolbar = ({
  selectedProject,
  hasActiveFilters,
  filterPanelOpen,
  setFilterPanelOpen,
  selectedSprint,
  selectedAssignee,
  selectedIssueType,
  selectedStatus,
  selectedPriority,
  customJql,
  setCustomJql,
  jqlDraft,
  setJqlDraft,
  loadingAnalytics,
  handleClearAllFilters,
  filterTab,
  setFilterTab,
  activeFilterField,
  setActiveFilterField,
  activeFieldList,
  setActiveFieldList,
  filterOptions,
  handleSprintFilterChange,
  handleAssigneeFilterChange,
  handleStatusFilterChange,
  handleIssueTypeFilterChange,
  handlePriorityFilterChange,
  getJqlSuggestions,
  handleInsertSuggestion,
  handleApplyJql,
  loadAnalytics,
}) => {
  if (!selectedProject) return null;

  // Local state for Saved Filters menu and Add Field dropdown
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false);
  const [savedFilterSearch, setSavedFilterSearch] = useState('');
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [fieldSearchText, setFieldSearchText] = useState('');

  // Sprints separated into Quick Scopes vs Specific Named Sprints
  const sprintQuickScopes = [
    { label: 'Active Sprint (Current)', value: 'active' },
    { label: 'All Sprints & Project Scope', value: 'all' },
    { label: 'All Future Sprints', value: 'future' },
    { label: 'All Closed Sprints', value: 'closed' },
    { label: 'Backlog Only (No Sprint)', value: 'backlog' },
  ];

  const specificNamedSprints = (filterOptions.sprints || []).filter(
    (s) => !['active', 'all', 'future', 'closed', 'backlog'].includes(s.value)
  );

  const isQuickScopeActive = sprintQuickScopes.some((s) => s.value === selectedSprint);
  const isSpecificSprintActive = specificNamedSprints.some((s) => s.value === selectedSprint);

  // Default Saved Filters matching Jira Cloud Native
  const defaultSavedFilters = [
    {
      name: 'Assigned to me',
      jql: 'assignee = currentUser()',
      action: () => {
        handleAssigneeFilterChange({ value: 'currentUser' });
        setCustomJql('assignee = currentUser()');
        loadAnalytics(selectedProject.key, { customJql: 'assignee = currentUser()' });
      },
    },
    {
      name: 'My open work items',
      jql: 'assignee = currentUser() AND statusCategory != Done',
      action: () => {
        setCustomJql('assignee = currentUser() AND statusCategory != Done');
        loadAnalytics(selectedProject.key, { customJql: 'assignee = currentUser() AND statusCategory != Done' });
      },
    },
    {
      name: 'Reported by me',
      jql: 'reporter = currentUser()',
      action: () => {
        setCustomJql('reporter = currentUser()');
        loadAnalytics(selectedProject.key, { customJql: 'reporter = currentUser()' });
      },
    },
    {
      name: 'Open work items',
      jql: 'statusCategory != Done',
      action: () => {
        setCustomJql('statusCategory != Done');
        loadAnalytics(selectedProject.key, { customJql: 'statusCategory != Done' });
      },
    },
    {
      name: 'Done work items',
      jql: 'statusCategory = Done',
      action: () => {
        setCustomJql('statusCategory = Done');
        loadAnalytics(selectedProject.key, { customJql: 'statusCategory = Done' });
      },
    },
    {
      name: 'Viewed recently',
      jql: 'issue in issueHistory() ORDER BY lastViewed DESC',
      action: () => {
        setCustomJql('issue in issueHistory() ORDER BY lastViewed DESC');
        loadAnalytics(selectedProject.key, { customJql: 'issue in issueHistory() ORDER BY lastViewed DESC' });
      },
    },
    {
      name: 'Resolved recently',
      jql: 'resolved >= -1w ORDER BY resolved DESC',
      action: () => {
        setCustomJql('resolved >= -1w ORDER BY resolved DESC');
        loadAnalytics(selectedProject.key, { customJql: 'resolved >= -1w ORDER BY resolved DESC' });
      },
    },
    {
      name: 'Updated recently',
      jql: 'updated >= -1w ORDER BY updated DESC',
      action: () => {
        setCustomJql('updated >= -1w ORDER BY updated DESC');
        loadAnalytics(selectedProject.key, { customJql: 'updated >= -1w ORDER BY updated DESC' });
      },
    },
  ];

  const filteredSavedFilters = defaultSavedFilters.filter((f) =>
    f.name.toLowerCase().includes(savedFilterSearch.toLowerCase())
  );

  // Available fields to add
  const allAvailableFields = [
    { key: 'parent', label: 'Parent' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'status', label: 'Status' },
    { key: 'issueType', label: 'Work type' },
    { key: 'labels', label: 'Labels' },
    { key: 'sprint', label: 'Sprint' },
    { key: 'priority', label: 'Priority' },
    { key: 'reporter', label: 'Reporter' },
    { key: 'dueDate', label: 'Due date' },
    { key: 'created', label: 'Created' },
    { key: 'storyPoints', label: 'Story Points' },
    { key: 'flagged', label: 'Flagged' },
  ];

  const unaddedFields = allAvailableFields.filter(
    (f) =>
      !activeFieldList.includes(f.key) &&
      f.label.toLowerCase().includes(fieldSearchText.toLowerCase())
  );

  // Field display label helper
  const getFieldLabel = (fieldKey) => {
    switch (fieldKey) {
      case 'parent':
        return 'Parent';
      case 'assignee':
        return selectedAssignee !== 'all' ? `Assignee: ${selectedAssignee}` : 'Assignee';
      case 'status':
        return selectedStatus !== 'all' ? `Status: ${selectedStatus}` : 'Status';
      case 'issueType':
        return selectedIssueType !== 'all' ? `Work type: ${selectedIssueType}` : 'Work type';
      case 'labels':
        return 'Labels';
      case 'sprint':
        return selectedSprint !== 'active' && selectedSprint !== 'all'
          ? `Sprint: ${selectedSprint}`
          : 'Sprint';
      case 'priority':
        return selectedPriority !== 'all' ? `Priority: ${selectedPriority}` : 'Priority';
      case 'reporter':
        return 'Reporter';
      case 'dueDate':
        return 'Due date';
      case 'created':
        return 'Created';
      case 'storyPoints':
        return 'Story Points';
      case 'flagged':
        return 'Flagged';
      default:
        return fieldKey;
    }
  };

  return (
    <Box xcss={filterToolbarStyle}>
      <Stack space="space.100">
        {/* ── TOP TOOLBAR: Active pills on left, Native 'Filter' trigger button on right ── */}
        <Inline space="space.100" alignBlock="center" spread="space-between">
          {/* Active Filter Badges */}
          <Inline space="space.050" alignBlock="center" wrap="wrap">
            {!hasActiveFilters && !filterPanelOpen && (
              <Text><Em>No custom filters applied. Showing current active sprint.</Em></Text>
            )}
            {selectedSprint !== 'all' && (
              <Lozenge appearance="inprogress">
                {`Sprint: ${selectedSprint === 'active' ? 'Active Sprint' : selectedSprint}`}
              </Lozenge>
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
              appearance={filterPanelOpen || hasActiveFilters ? 'primary' : 'default'}
              spacing="compact"
              onClick={() => {
                setFilterPanelOpen(!filterPanelOpen);
                if (!filterPanelOpen) {
                  setJqlDraft(customJql);
                }
              }}
              isDisabled={loadingAnalytics}
            >
              Filter
            </Button>

            {hasActiveFilters && (
              <Button
                appearance="subtle"
                spacing="compact"
                onClick={handleClearAllFilters}
                isDisabled={loadingAnalytics}
              >
                Clear all
              </Button>
            )}
          </Inline>
        </Inline>

        {/* ── JIRA NATIVE LISTS-STYLE FILTER DIALOG ── */}
        {filterPanelOpen && (
          <Box xcss={filterPanelContainerStyle}>
            <Stack space="space.150">
              {/* Header: [ Basic ] [ Advanced ] [ JQL ] + Saved filters ˅ */}
              <Inline space="space.100" spread="space-between" alignBlock="center">
                <Inline space="space.050" alignBlock="center">
                  <Button
                    appearance={filterTab === 'basic' ? 'primary' : 'subtle'}
                    spacing="compact"
                    onClick={() => {
                      setFilterTab('basic');
                      setSavedFiltersOpen(false);
                    }}
                  >
                    Basic
                  </Button>
                  <Button
                    appearance={filterTab === 'advanced' ? 'primary' : 'subtle'}
                    spacing="compact"
                    onClick={() => {
                      setFilterTab('advanced');
                      setSavedFiltersOpen(false);
                    }}
                  >
                    Advanced
                  </Button>
                  <Button
                    appearance={filterTab === 'jql' ? 'primary' : 'subtle'}
                    spacing="compact"
                    onClick={() => {
                      setFilterTab('jql');
                      setJqlDraft(
                        customJql.trim() !== ''
                          ? customJql
                          : `project = "${selectedProject.key}"${selectedSprint === 'active' ? ' AND sprint in openSprints()' : ''} ORDER BY rank ASC`
                      );
                      setSavedFiltersOpen(false);
                    }}
                  >
                    JQL
                  </Button>
                </Inline>

                {/* Saved Filters Dropdown Trigger */}
                <Button
                  appearance="subtle"
                  spacing="compact"
                  onClick={() => setSavedFiltersOpen(!savedFiltersOpen)}
                >
                  Saved filters ˅
                </Button>
              </Inline>

              {/* ── SAVED FILTERS POPUP MENU (Screenshot 4) ── */}
              {savedFiltersOpen && (
                <Box xcss={filterSavedMenuBoxStyle}>
                  <Stack space="space.100">
                    <Textfield
                      isCompact
                      placeholder="Search filters"
                      value={savedFilterSearch}
                      onChange={(e) => setSavedFilterSearch(e.target.value)}
                    />
                    <Text><Strong>Default filters</Strong></Text>
                    <Stack space="space.025">
                      {filteredSavedFilters.length > 0 ? (
                        filteredSavedFilters.map((sf, idx) => (
                          <Button
                            key={`sf-${idx}`}
                            appearance="subtle"
                            spacing="compact"
                            onClick={() => {
                              sf.action();
                              setSavedFiltersOpen(false);
                            }}
                          >
                            {sf.name}
                          </Button>
                        ))
                      ) : (
                        <Text><Em>No matching saved filters.</Em></Text>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              )}

              {/* ── 1. BASIC TAB: Two-Column Modal (Screenshot 1 & 5) ── */}
              {filterTab === 'basic' && (
                <Inline space="space.0" alignBlock="stretch">
                  {/* Left Column: Clean field list */}
                  <Box xcss={filterLeftColStyle}>
                    <Stack space="space.050">
                      {activeFieldList.map((fieldKey) => (
                        <Button
                          key={`fld-${fieldKey}`}
                          appearance={activeFilterField === fieldKey ? 'primary' : 'subtle'}
                          spacing="compact"
                          onClick={() => {
                            if (activeFilterField === fieldKey) {
                              setActiveFilterField(null);
                            } else {
                              setActiveFilterField(fieldKey);
                            }
                            setAddFieldOpen(false);
                          }}
                        >
                          {getFieldLabel(fieldKey)}
                        </Button>
                      ))}

                      {/* + Add field trigger (Screenshot 5) */}
                      <Button
                        appearance="subtle"
                        spacing="compact"
                        onClick={() => setAddFieldOpen(!addFieldOpen)}
                      >
                        + Add field
                      </Button>

                      {/* Add Field Sub-menu */}
                      {addFieldOpen && (
                        <Box
                          padding="space.100"
                          xcss={filterClauseRowStyle}
                          style={{ maxWidth: '180px' }}
                        >
                          <Stack space="space.050">
                            <Textfield
                              isCompact
                              placeholder="Search fields"
                              value={fieldSearchText}
                              onChange={(e) => setFieldSearchText(e.target.value)}
                            />
                            {unaddedFields.slice(0, 6).map((uf) => (
                              <Button
                                key={`unadded-${uf.key}`}
                                appearance="subtle"
                                spacing="compact"
                                onClick={() => {
                                  setActiveFieldList([...activeFieldList, uf.key]);
                                  setActiveFilterField(uf.key);
                                  setAddFieldOpen(false);
                                  setFieldSearchText('');
                                }}
                              >
                                {uf.label}
                              </Button>
                            ))}
                          </Stack>
                        </Box>
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

                  {/* Right Column: Active Field Controls OR Idle Placeholder */}
                  <Box xcss={filterRightColStyle}>
                    {!activeFilterField ? (
                      /* Idle Placeholder State (Screenshot 1) */
                      <Box padding="space.300">
                        <Text color="color.text.subtlest">
                          <Em>Select a field to start creating a filter.</Em>
                        </Text>
                      </Box>
                    ) : (
                      <Stack space="space.150">
                        {/* SPRINT EDITOR (Segregated Scope Presets vs Named Sprints) */}
                        {activeFilterField === 'sprint' && (
                          <Stack space="space.150">
                            <Inline space="space.100" spread="space-between" alignBlock="center">
                              <Heading as="h4">Sprint</Heading>
                              {selectedSprint !== 'active' && (
                                <Button
                                  appearance="subtle"
                                  spacing="compact"
                                  onClick={() => handleSprintFilterChange({ value: 'active' })}
                                >
                                  Reset to Active Sprint
                                </Button>
                              )}
                            </Inline>
                            <Text>Select a sprint scope preset or choose an individual sprint.</Text>

                            {/* Section 1: Quick Scope Presets */}
                            <Stack space="space.050">
                              <Text><Strong>Sprint Scope Preset</Strong></Text>
                              <Box style={{ maxWidth: '340px' }}>
                                <Select
                                  spacing="compact"
                                  isSearchable={false}
                                  options={sprintQuickScopes}
                                  value={
                                    isQuickScopeActive
                                      ? sprintQuickScopes.find((s) => s.value === selectedSprint)
                                      : null
                                  }
                                  onChange={(opt) => opt && handleSprintFilterChange(opt)}
                                  placeholder="Choose a scope preset..."
                                  isDisabled={loadingAnalytics}
                                />
                              </Box>
                            </Stack>

                            {/* Section 2: Specific Named Sprints */}
                            <Stack space="space.050">
                              <Text><Strong>Specific Individual Sprint</Strong></Text>
                              <Box style={{ maxWidth: '340px' }}>
                                {specificNamedSprints.length > 0 ? (
                                  <Select
                                    spacing="compact"
                                    isSearchable={true}
                                    options={specificNamedSprints}
                                    value={
                                      isSpecificSprintActive
                                        ? specificNamedSprints.find((s) => s.value === selectedSprint)
                                        : null
                                    }
                                    onChange={(opt) => opt && handleSprintFilterChange(opt)}
                                    placeholder="Select specific sprint..."
                                    isDisabled={loadingAnalytics}
                                  />
                                ) : (
                                  <Text><Em>No additional named sprints detected in this project.</Em></Text>
                                )}
                              </Box>
                            </Stack>
                          </Stack>
                        )}

                        {/* PARENT EDITOR */}
                        {activeFilterField === 'parent' && (
                          <Stack space="space.100">
                            <Heading as="h4">Parent Issue</Heading>
                            <Text>Filter issues by parent issue key (e.g. Epic or Initiative).</Text>
                            <Box style={{ maxWidth: '340px' }}>
                              <Textfield
                                placeholder="e.g. JAPA-100"
                                isCompact
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    setCustomJql(`parent = "${val}"`);
                                    loadAnalytics(selectedProject.key, { customJql: `parent = "${val}"` });
                                  }
                                }}
                              />
                            </Box>
                          </Stack>
                        )}

                        {/* ASSIGNEE EDITOR */}
                        {activeFilterField === 'assignee' && (
                          <Stack space="space.100">
                            <Inline space="space.100" spread="space-between" alignBlock="center">
                              <Heading as="h4">Assignee</Heading>
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
                            <Box style={{ maxWidth: '340px' }}>
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
                              <Heading as="h4">Status</Heading>
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
                            <Box style={{ maxWidth: '340px' }}>
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
                              <Heading as="h4">Work type</Heading>
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
                            <Text>Filter by Story, Task, Bug, Epic, or Sub-task types.</Text>
                            <Box style={{ maxWidth: '340px' }}>
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
                              <Heading as="h4">Priority</Heading>
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
                            <Box style={{ maxWidth: '340px' }}>
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

                        {/* LABELS EDITOR */}
                        {activeFilterField === 'labels' && (
                          <Stack space="space.100">
                            <Heading as="h4">Labels</Heading>
                            <Text>Filter by Jira issue labels and tags.</Text>
                            <Box style={{ maxWidth: '340px' }}>
                              <Textfield
                                placeholder="e.g. backend, mobile"
                                isCompact
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    setCustomJql(`labels = "${val}"`);
                                    loadAnalytics(selectedProject.key, { customJql: `labels = "${val}"` });
                                  }
                                }}
                              />
                            </Box>
                          </Stack>
                        )}
                      </Stack>
                    )}
                  </Box>
                </Inline>
              )}

              {/* ── 2. ADVANCED TAB: Structured Clause Builder (Screenshot 3) ── */}
              {filterTab === 'advanced' && (
                <Stack space="space.150">
                  {/* Space / Project Clause Row */}
                  <Box xcss={filterClauseRowStyle}>
                    <Inline space="space.100" alignBlock="center" spread="space-between">
                      <Inline space="space.050" alignBlock="center">
                        <Lozenge appearance="default">Space / Project</Lozenge>
                        <Text><Strong>=</Strong></Text>
                        <Lozenge appearance="inprogress">{selectedProject.name}</Lozenge>
                      </Inline>
                      <Button
                        appearance="subtle"
                        spacing="compact"
                        onClick={handleClearAllFilters}
                        isDisabled={!hasActiveFilters}
                      >
                        Clear all
                      </Button>
                    </Inline>
                  </Box>

                  {/* Sprint Clause Row */}
                  <Box xcss={filterClauseRowStyle}>
                    <Inline space="space.100" alignBlock="center">
                      <Lozenge appearance="default">Sprint</Lozenge>
                      <Text><Strong>=</Strong></Text>
                      <Box style={{ minWidth: '220px' }}>
                        <Select
                          spacing="compact"
                          isSearchable={false}
                          options={[...sprintQuickScopes, ...specificNamedSprints]}
                          value={
                            [...sprintQuickScopes, ...specificNamedSprints].find(
                              (s) => s.value === selectedSprint
                            ) || sprintQuickScopes[0]
                          }
                          onChange={(opt) => opt && handleSprintFilterChange(opt)}
                          isDisabled={loadingAnalytics}
                        />
                      </Box>
                    </Inline>
                  </Box>

                  {/* Additional active clauses if set */}
                  {selectedAssignee !== 'all' && (
                    <Box xcss={filterClauseRowStyle}>
                      <Inline space="space.100" alignBlock="center" spread="space-between">
                        <Inline space="space.050" alignBlock="center">
                          <Lozenge appearance="default">Assignee</Lozenge>
                          <Text><Strong>=</Strong></Text>
                          <Lozenge appearance="inprogress">{selectedAssignee}</Lozenge>
                        </Inline>
                        <Button
                          appearance="subtle"
                          spacing="compact"
                          onClick={() => handleAssigneeFilterChange({ value: 'all' })}
                        >
                          ✕
                        </Button>
                      </Inline>
                    </Box>
                  )}

                  {selectedStatus !== 'all' && (
                    <Box xcss={filterClauseRowStyle}>
                      <Inline space="space.100" alignBlock="center" spread="space-between">
                        <Inline space="space.050" alignBlock="center">
                          <Lozenge appearance="default">Status</Lozenge>
                          <Text><Strong>=</Strong></Text>
                          <Lozenge appearance="inprogress">{selectedStatus}</Lozenge>
                        </Inline>
                        <Button
                          appearance="subtle"
                          spacing="compact"
                          onClick={() => handleStatusFilterChange({ value: 'all' })}
                        >
                          ✕
                        </Button>
                      </Inline>
                    </Box>
                  )}

                  {selectedIssueType !== 'all' && (
                    <Box xcss={filterClauseRowStyle}>
                      <Inline space="space.100" alignBlock="center" spread="space-between">
                        <Inline space="space.050" alignBlock="center">
                          <Lozenge appearance="default">Work type</Lozenge>
                          <Text><Strong>=</Strong></Text>
                          <Lozenge appearance="inprogress">{selectedIssueType}</Lozenge>
                        </Inline>
                        <Button
                          appearance="subtle"
                          spacing="compact"
                          onClick={() => handleIssueTypeFilterChange({ value: 'all' })}
                        >
                          ✕
                        </Button>
                      </Inline>
                    </Box>
                  )}

                  {/* + Add filters action */}
                  <Inline space="space.100" alignBlock="center">
                    <Button
                      appearance="subtle"
                      spacing="compact"
                      onClick={() => setFilterTab('basic')}
                    >
                      + Add filters
                    </Button>
                  </Inline>
                </Stack>
              )}

              {/* ── 3. JQL TAB: Dark Code Editor Container (Screenshot 2) ── */}
              {filterTab === 'jql' && (
                <Stack space="space.100">
                  {/* Dark Code Block Container */}
                  <Box xcss={filterCodeEditorBoxStyle}>
                    <Stack space="space.050">
                      <Inline space="space.100" spread="space-between" alignBlock="center">
                        <Lozenge appearance="default">JQL Query Editor</Lozenge>
                        <Inline space="space.050" alignBlock="center">
                          <Button
                            appearance="subtle"
                            spacing="compact"
                            onClick={() => {
                              // Expand query format
                              setJqlDraft(
                                `project = "${selectedProject.key}" AND sprint in openSprints() ORDER BY rank ASC`
                              );
                            }}
                          >
                            ⛶
                          </Button>
                          <Button
                            appearance="primary"
                            spacing="compact"
                            onClick={handleApplyJql}
                            isDisabled={loadingAnalytics}
                          >
                            🔍 Apply
                          </Button>
                        </Inline>
                      </Inline>

                      <Textfield
                        isCompact
                        isMonospaced
                        placeholder="e.g. project = JAPA AND sprint in openSprints() ORDER BY rank ASC"
                        value={jqlDraft}
                        onChange={(e) => setJqlDraft(e.target.value)}
                      />
                    </Stack>
                  </Box>

                  {/* Clear All under the editor */}
                  <Inline space="space.100" alignBlock="center" spread="space-between">
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
                      Clear all
                    </Button>

                    {customJql.trim() !== '' && (
                      <Lozenge appearance="moved">{`Applied JQL: ${customJql}`}</Lozenge>
                    )}
                  </Inline>

                  {/* Suggestions Chips */}
                  <Stack space="space.050">
                    <Text><Strong>Suggestions (click to insert):</Strong></Text>
                    <Inline space="space.050" alignBlock="center" wrap="wrap">
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
                </Stack>
              )}

              {/* ── NATIVE JIRA DIALOG FOOTER (Screenshots 1, 2, 3, 4, 5) ── */}
              <Box xcss={filterFooterStyle}>
                <Inline spread="space-between" alignBlock="center">
                  <Inline space="space.050" alignBlock="center">
                    <Text>📣 Give feedback</Text>
                  </Inline>
                  <Inline space="space.050" alignBlock="center">
                    <Text>Press </Text>
                    <Lozenge appearance="default">Shift</Lozenge>
                    <Text> + </Text>
                    <Lozenge appearance="default">F</Lozenge>
                    <Text> to open and close</Text>
                  </Inline>
                </Inline>
              </Box>
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
