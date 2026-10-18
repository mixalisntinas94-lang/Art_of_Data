import React from 'react';
import {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  Badge,
  Select,
  BarChart,
  DynamicTable,
  EmptyState,
  Strong,
} from '@forge/react';
import {
  fullWidthBoxStyle,
  sectionCardStyle,
  chartCardHalfStyle,
} from '../../styles';

export const DynamicExplorerTab = ({
  explorerDimension,
  setExplorerDimension,
  explorerMeasure,
  setExplorerMeasure,
  explorerFilterDim,
  setExplorerFilterDim,
  explorerFilterVal,
  setExplorerFilterVal,
  expFilterOptions,
  expFiltered,
  expChart,
  expTableRows,
}) => {
  return (
    <Box padding="space.100" xcss={fullWidthBoxStyle}>
      <Stack space="space.250">
        {/* Control Bar */}
        <Box xcss={sectionCardStyle}>
          <Stack space="space.150">
            <Heading as="h3">🎛️ Data Controls</Heading>
            <Inline space="space.200" alignBlock="center">
              <Stack space="space.050">
                <Text><Strong>Group By (Dimension)</Strong></Text>
                <Select
                  options={[
                    { label: 'Status', value: 'status' },
                    { label: 'Assignee', value: 'assignee' },
                    { label: 'Issue Type', value: 'type' },
                    { label: 'Priority', value: 'priority' },
                  ]}
                  onChange={(option) => setExplorerDimension(option.value)}
                  value={{
                    label:
                      explorerDimension.charAt(0).toUpperCase() +
                      explorerDimension.slice(1),
                    value: explorerDimension,
                  }}
                />
              </Stack>

              <Stack space="space.050">
                <Text><Strong>Measure (Metric)</Strong></Text>
                <Select
                  options={[
                    { label: 'Issue Count', value: 'count' },
                    { label: 'Story Points', value: 'storyPoints' },
                    { label: 'Estimated Hours', value: 'estimatedHours' },
                    { label: 'Logged Hours', value: 'loggedHours' },
                  ]}
                  onChange={(option) => setExplorerMeasure(option.value)}
                  value={{
                    label:
                      explorerMeasure === 'count'
                        ? 'Issue Count'
                        : explorerMeasure === 'storyPoints'
                        ? 'Story Points'
                        : explorerMeasure === 'estimatedHours'
                        ? 'Estimated Hours'
                        : 'Logged Hours',
                    value: explorerMeasure,
                  }}
                />
              </Stack>

              <Stack space="space.050">
                <Text><Strong>Filter By</Strong></Text>
                <Select
                  options={[
                    { label: 'None', value: 'none' },
                    { label: 'Status', value: 'status' },
                    { label: 'Assignee', value: 'assignee' },
                    { label: 'Issue Type', value: 'type' },
                    { label: 'Priority', value: 'priority' },
                  ]}
                  onChange={(option) => {
                    setExplorerFilterDim(option.value);
                    setExplorerFilterVal('all');
                  }}
                  value={{
                    label:
                      explorerFilterDim === 'none'
                        ? 'None'
                        : explorerFilterDim.charAt(0).toUpperCase() +
                          explorerFilterDim.slice(1),
                    value: explorerFilterDim,
                  }}
                />
              </Stack>

              {explorerFilterDim !== 'none' && (
                <Stack space="space.050">
                  <Text><Strong>Filter Value</Strong></Text>
                  <Select
                    options={expFilterOptions}
                    onChange={(option) => setExplorerFilterVal(option.value)}
                    value={{
                      label: explorerFilterVal === 'all' ? 'All' : explorerFilterVal,
                      value: explorerFilterVal,
                    }}
                  />
                </Stack>
              )}
            </Inline>
          </Stack>
        </Box>

        <Inline space="space.200" spread="space-between" alignBlock="stretch">
          {/* Chart */}
          <Box xcss={chartCardHalfStyle}>
            <Stack space="space.150">
              <Inline spread="space-between" alignBlock="center">
                <Heading as="h3">📊 Aggregated Results</Heading>
                <Badge appearance="added">{expFiltered.length} issues</Badge>
              </Inline>
              {expChart.length > 0 ? (
                <BarChart
                  data={expChart}
                  xAccessor="name"
                  yAccessor="value"
                  height={300}
                  showBorder={false}
                  showMarkLabels={true}
                />
              ) : (
                <EmptyState header="No data" description="No issues match the selected filters." />
              )}
            </Stack>
          </Box>

          {/* Data Table */}
          <Box xcss={chartCardHalfStyle}>
            <Stack space="space.150">
              <Heading as="h3">📋 Raw Data Drilldown</Heading>
              {expTableRows.length > 0 ? (
                <DynamicTable
                  head={{
                    cells: [
                      { key: 'key', content: 'Key', isSortable: false },
                      { key: 'summary', content: 'Summary', isSortable: false },
                      { key: 'status', content: 'Status', isSortable: false },
                      { key: 'assignee', content: 'Assignee', isSortable: false },
                      { key: 'priority', content: 'Priority', isSortable: false },
                      { key: 'type', content: 'Type', isSortable: false },
                      {
                        key: 'measure',
                        content:
                          explorerMeasure === 'count'
                            ? 'Metric'
                            : explorerMeasure === 'storyPoints'
                            ? 'SP'
                            : 'Hours',
                        isSortable: false,
                      },
                    ],
                  }}
                  rows={expTableRows.slice(0, 100)} // show top 100
                  rowsPerPage={5}
                />
              ) : (
                <EmptyState header="No data" description="Try changing filters." />
              )}
            </Stack>
          </Box>
        </Inline>
      </Stack>
    </Box>
  );
};
