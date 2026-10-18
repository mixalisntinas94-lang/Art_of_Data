import React from 'react';
import {
  Box,
  Stack,
  Heading,
  Text,
  CodeBlock,
} from '@forge/react';
import { sectionCardStyle } from '../../styles';

export const ExecutiveStandupTab = ({ analytics, metricMode }) => {
  if (!analytics) return null;

  return (
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
  );
};
