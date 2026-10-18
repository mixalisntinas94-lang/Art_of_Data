import React from 'react';
import {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  Lozenge,
  Select,
  Button,
  Em,
} from '@forge/react';
import { headerContainerStyle } from '../styles';

export const HeaderBar = ({
  metricMode,
  setMetricMode,
  projects,
  selectedProject,
  handleProjectSelect,
  loadingAnalytics,
  loadAnalytics,
}) => {
  const metricOptions = [
    { label: '🎯 Story Points (SP)', value: 'points' },
    { label: '⏱️ Hours (h)', value: 'hours' },
  ];

  const selectedMetricOption =
    metricOptions.find((opt) => opt.value === metricMode) || metricOptions[0];

  const projectOptions = projects.map((p) => ({
    label: `${p.name} (${p.key})`,
    value: p.key,
  }));

  const selectedOption = selectedProject
    ? { label: `${selectedProject.name} (${selectedProject.key})`, value: selectedProject.key }
    : null;

  return (
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
          <Box style={{ minWidth: '175px' }}>
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
            <Box style={{ minWidth: '220px' }}>
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
  );
};
