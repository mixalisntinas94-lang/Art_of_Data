import React, { useState } from 'react';
import {
  Box,
  Stack,
  Inline,
  Heading,
  Text,
  Select,
  Textfield,
  Button,
  EmptyState,
  Badge,
  Lozenge,
  BarChart,
  HorizontalBarChart,
  PieChart,
  DonutChart,
  LineChart,
  StackBarChart,
  HorizontalStackBarChart,
  Strong,
  Em,
} from '@forge/react';
import {
  fullWidthBoxStyle,
  sectionCardStyle,
  chartCardHalfStyle,
} from '../../styles';

// Safe rendering threshold to guarantee fast load times and avoid browser DOM bloat
const MAX_WIDGETS = 12;

export const CustomAnalyticsTab = ({
  rawIssues = [],
  customWidgets = [],
  setCustomWidgets,
}) => {
  const [widgetForm, setWidgetForm] = useState({
    title: 'Custom Insight',
    type: 'bar',
    dimension: 'status',
    stackDimension: 'type',
    measure: 'count',
  });

  const visualTypes = [
    { label: '📊 Bar Chart (Vertical)', value: 'bar' },
    { label: '📊 Horizontal Bar Chart', value: 'horizontal_bar' },
    { label: '🥧 Pie Chart', value: 'pie' },
    { label: '🍩 Donut Chart', value: 'donut' },
    { label: '📈 Line Chart (Trend)', value: 'line' },
    { label: '📶 Stacked Bar Chart (2D)', value: 'stack_bar' },
    { label: '📋 Horizontal Stacked Bar (2D)', value: 'horizontal_stack_bar' },
    { label: '🎯 KPI Metric Card', value: 'kpi_metric' },
  ];

  const dimensionOptions = [
    { label: 'Status', value: 'status' },
    { label: 'Assignee', value: 'assignee' },
    { label: 'Issue Type', value: 'type' },
    { label: 'Priority', value: 'priority' },
  ];

  const stackDimensionOptions = [
    { label: 'Issue Type', value: 'type' },
    { label: 'Priority', value: 'priority' },
    { label: 'Status', value: 'status' },
    { label: 'Assignee', value: 'assignee' },
  ];

  const measureOptions = [
    { label: 'Issue Count', value: 'count' },
    { label: 'Story Points', value: 'storyPoints' },
    { label: 'Estimated Hours', value: 'estimatedHours' },
    { label: 'Logged Hours', value: 'loggedHours' },
  ];

  const is2DChart =
    widgetForm.type === 'stack_bar' || widgetForm.type === 'horizontal_stack_bar';

  // Compute 1D Aggregation Data (Bar, HorizontalBar, Pie, Donut, Line)
  const get1DWidgetData = (widget) => {
    if (!rawIssues || rawIssues.length === 0) return [];
    const grouped = {};
    rawIssues.forEach((issue) => {
      const dimValue = issue[widget.dimension] || 'Unassigned';
      if (!grouped[dimValue]) grouped[dimValue] = 0;
      if (widget.measure === 'count') {
        grouped[dimValue] += 1;
      } else {
        grouped[dimValue] += issue[widget.measure] || 0;
      }
    });

    return Object.keys(grouped)
      .map((key) => ({
        name: key,
        value: Math.round(grouped[key] * 10) / 10,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  // Compute 2D Stacked Aggregation Data (StackBar, HorizontalStackBar)
  const get2DWidgetData = (widget) => {
    if (!rawIssues || rawIssues.length === 0) return [];
    const primaryKey = widget.dimension;
    const secondaryKey = widget.stackDimension || 'type';

    // Map: primaryVal -> secondaryVal -> accumulated measure
    const grouped = {};
    rawIssues.forEach((issue) => {
      const pVal = issue[primaryKey] || 'Unassigned';
      const sVal = issue[secondaryKey] || 'Other';
      if (!grouped[pVal]) grouped[pVal] = {};
      if (!grouped[pVal][sVal]) grouped[pVal][sVal] = 0;

      if (widget.measure === 'count') {
        grouped[pVal][sVal] += 1;
      } else {
        grouped[pVal][sVal] += issue[widget.measure] || 0;
      }
    });

    const flatList = [];
    Object.keys(grouped).forEach((pVal) => {
      Object.keys(grouped[pVal]).forEach((sVal) => {
        const val = Math.round(grouped[pVal][sVal] * 10) / 10;
        if (val > 0) {
          flatList.push({
            [primaryKey]: pVal,
            [secondaryKey]: sVal,
            value: val,
          });
        }
      });
    });

    return flatList;
  };

  // Compute KPI Single Value metric
  const getKpiWidgetData = (widget) => {
    if (!rawIssues || rawIssues.length === 0) return { total: 0, breakdown: [] };
    let total = 0;
    const grouped = {};

    rawIssues.forEach((issue) => {
      const val = widget.measure === 'count' ? 1 : issue[widget.measure] || 0;
      total += val;
      const dim = issue[widget.dimension] || 'Unassigned';
      grouped[dim] = (grouped[dim] || 0) + val;
    });

    const breakdown = Object.keys(grouped)
      .map((k) => ({ name: k, value: Math.round(grouped[k] * 10) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);

    return { total: Math.round(total * 10) / 10, breakdown };
  };

  const handleAddWidget = () => {
    if (customWidgets.length >= MAX_WIDGETS) return;
    const newWidget = {
      ...widgetForm,
      id: Date.now(),
    };
    setCustomWidgets([...customWidgets, newWidget]);
    setWidgetForm({
      ...widgetForm,
      title: `Insight ${customWidgets.length + 2}`,
    });
  };

  const handleRemoveWidget = (id) => {
    setCustomWidgets(customWidgets.filter((w) => w.id !== id));
  };

  return (
    <Box padding="space.100" xcss={fullWidthBoxStyle}>
      <Stack space="space.250">
        {/* Visual Builder Bar */}
        <Box xcss={sectionCardStyle}>
          <Stack space="space.150">
            <Inline spread="space-between" alignBlock="center">
              <Stack space="space.050">
                <Heading as="h3">🛠️ Custom Visual Studio</Heading>
                <Text>
                  Design custom executive widgets with full chart flexibility (Bar, Horizontal, Pie, Donut, Line, 2D Stacked & KPI Cards).
                </Text>
              </Stack>
              <Badge appearance={customWidgets.length >= MAX_WIDGETS ? 'removed' : 'primary'}>
                {`${customWidgets.length} / ${MAX_WIDGETS} Widgets`}
              </Badge>
            </Inline>

            <Inline space="space.150" alignBlock="center" wrap="wrap">
              {/* Title */}
              <Stack space="space.050">
                <Text><Strong>Widget Title</Strong></Text>
                <Textfield
                  value={widgetForm.title}
                  onChange={(e) => setWidgetForm({ ...widgetForm, title: e.target.value })}
                />
              </Stack>

              {/* Visual Type */}
              <Stack space="space.050">
                <Text><Strong>Visual Type</Strong></Text>
                <Select
                  options={visualTypes}
                  onChange={(opt) => setWidgetForm({ ...widgetForm, type: opt.value })}
                  value={
                    visualTypes.find((t) => t.value === widgetForm.type) || visualTypes[0]
                  }
                />
              </Stack>

              {/* Primary Dimension */}
              <Stack space="space.050">
                <Text><Strong>Dimension</Strong></Text>
                <Select
                  options={dimensionOptions}
                  onChange={(opt) => setWidgetForm({ ...widgetForm, dimension: opt.value })}
                  value={
                    dimensionOptions.find((d) => d.value === widgetForm.dimension) ||
                    dimensionOptions[0]
                  }
                />
              </Stack>

              {/* Stack Dimension (Conditional for 2D charts) */}
              {is2DChart && (
                <Stack space="space.050">
                  <Text><Strong>Stack By (Sub-group)</Strong></Text>
                  <Select
                    options={stackDimensionOptions.filter((d) => d.value !== widgetForm.dimension)}
                    onChange={(opt) =>
                      setWidgetForm({ ...widgetForm, stackDimension: opt.value })
                    }
                    value={
                      stackDimensionOptions.find(
                        (d) => d.value === widgetForm.stackDimension
                      ) || stackDimensionOptions[0]
                    }
                  />
                </Stack>
              )}

              {/* Measure */}
              <Stack space="space.050">
                <Text><Strong>Measure</Strong></Text>
                <Select
                  options={measureOptions}
                  onChange={(opt) => setWidgetForm({ ...widgetForm, measure: opt.value })}
                  value={
                    measureOptions.find((m) => m.value === widgetForm.measure) ||
                    measureOptions[0]
                  }
                />
              </Stack>

              {/* Add Button */}
              <Button
                appearance="primary"
                onClick={handleAddWidget}
                isDisabled={customWidgets.length >= MAX_WIDGETS}
              >
                ➕ Add to Board
              </Button>
            </Inline>

            {customWidgets.length >= MAX_WIDGETS && (
              <Text>
                <Em>⚠️ Safe board capacity reached ({MAX_WIDGETS}/{MAX_WIDGETS} widgets). Remove a widget to add a new one.</Em>
              </Text>
            )}
          </Stack>
        </Box>

        {/* Custom Dashboard Canvas */}
        <Box xcss={sectionCardStyle}>
          <Stack space="space.200">
            <Inline spread="space-between" alignBlock="center">
              <Heading as="h3">🎛️ Custom Board Canvas</Heading>
              <Text size="small">
                <Em>Real-time client aggregation • Safe 12-widget rendering quota</Em>
              </Text>
            </Inline>

            {customWidgets.length === 0 ? (
              <EmptyState
                header="Your board is empty"
                description="Use the Visual Studio above to add your choice of 8 chart types."
              />
            ) : (
              <Inline space="space.200" spread="space-between" alignBlock="stretch" wrap="wrap">
                {customWidgets.map((widget) => {
                  const isStacked =
                    widget.type === 'stack_bar' || widget.type === 'horizontal_stack_bar';
                  const isKpi = widget.type === 'kpi_metric';

                  const data1D = !isStacked && !isKpi ? get1DWidgetData(widget) : [];
                  const data2D = isStacked ? get2DWidgetData(widget) : [];
                  const dataKpi = isKpi ? getKpiWidgetData(widget) : null;

                  return (
                    <Box key={widget.id} xcss={chartCardHalfStyle}>
                      <Stack space="space.150">
                        {/* Widget Header */}
                        <Inline spread="space-between" alignBlock="center">
                          <Heading as="h4">{widget.title}</Heading>
                          <Button
                            appearance="subtle"
                            spacing="compact"
                            onClick={() => handleRemoveWidget(widget.id)}
                          >
                            ❌
                          </Button>
                        </Inline>

                        {/* Widget Meta Description */}
                        <Inline space="space.100" alignBlock="center">
                          <Lozenge appearance="inprogress">
                            {visualTypes.find((t) => t.value === widget.type)?.label || widget.type}
                          </Lozenge>
                          <Text size="small">
                            {isStacked
                              ? `${widget.dimension} stacked by ${widget.stackDimension || 'type'}`
                              : `By ${widget.dimension}`}{' '}
                            | Metric: {widget.measure}
                          </Text>
                        </Inline>

                        {/* 1. Bar Chart (Vertical) */}
                        {widget.type === 'bar' &&
                          (data1D.length > 0 ? (
                            <BarChart
                              data={data1D}
                              xAccessor="name"
                              yAccessor="value"
                              height={260}
                              showBorder={false}
                              showMarkLabels={true}
                            />
                          ) : (
                            <EmptyState header="No data" description="No matching issues found." />
                          ))}

                        {/* 2. Horizontal Bar Chart */}
                        {widget.type === 'horizontal_bar' &&
                          (data1D.length > 0 ? (
                            <HorizontalBarChart
                              data={data1D}
                              xAccessor="value"
                              yAccessor="name"
                              height={Math.max(260, data1D.length * 40)}
                              showBorder={false}
                              showMarkLabels={true}
                            />
                          ) : (
                            <EmptyState header="No data" description="No matching issues found." />
                          ))}

                        {/* 3. Pie Chart */}
                        {widget.type === 'pie' &&
                          (data1D.length > 0 ? (
                            <PieChart
                              data={data1D}
                              labelAccessor="name"
                              valueAccessor="value"
                              colorAccessor="name"
                              height={260}
                              showBorder={false}
                              showMarkLabels={true}
                            />
                          ) : (
                            <EmptyState header="No data" description="No matching issues found." />
                          ))}

                        {/* 4. Donut Chart */}
                        {widget.type === 'donut' &&
                          (data1D.length > 0 ? (
                            <DonutChart
                              data={data1D}
                              labelAccessor="name"
                              valueAccessor="value"
                              colorAccessor="name"
                              height={260}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState header="No data" description="No matching issues found." />
                          ))}

                        {/* 5. Line Chart (Trend) */}
                        {widget.type === 'line' &&
                          (data1D.length > 0 ? (
                            <LineChart
                              data={data1D}
                              xAccessor="name"
                              yAccessor="value"
                              height={260}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState header="No data" description="No matching issues found." />
                          ))}

                        {/* 6. Stacked Bar Chart (2D) */}
                        {widget.type === 'stack_bar' &&
                          (data2D.length > 0 ? (
                            <StackBarChart
                              data={data2D}
                              xAccessor={widget.dimension}
                              yAccessor="value"
                              colorAccessor={widget.stackDimension || 'type'}
                              height={260}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState header="No data" description="No matching 2D data found." />
                          ))}

                        {/* 7. Horizontal Stacked Bar (2D) */}
                        {widget.type === 'horizontal_stack_bar' &&
                          (data2D.length > 0 ? (
                            <HorizontalStackBarChart
                              data={data2D}
                              yAccessor={widget.dimension}
                              xAccessor="value"
                              colorAccessor={widget.stackDimension || 'type'}
                              height={260}
                              showBorder={false}
                            />
                          ) : (
                            <EmptyState header="No data" description="No matching 2D data found." />
                          ))}

                        {/* 8. KPI Metric Card */}
                        {widget.type === 'kpi_metric' && dataKpi && (
                          <Stack space="space.150">
                            <Heading as="h1">{`${dataKpi.total} ${widget.measure === 'count' ? 'Issues' : widget.measure === 'storyPoints' ? 'SP' : 'Hours'}`}</Heading>
                            <Text>Top distribution by {widget.dimension}:</Text>
                            <Inline space="space.100" wrap="wrap">
                              {dataKpi.breakdown.map((item, idx) => (
                                <Lozenge key={`kpi-${idx}`} appearance="default">
                                  {`${item.name}: ${item.value}`}
                                </Lozenge>
                              ))}
                            </Inline>
                          </Stack>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Inline>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};
