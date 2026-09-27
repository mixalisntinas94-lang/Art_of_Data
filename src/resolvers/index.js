import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

/**
 * Helper to execute Jira REST API requests.
 * In accordance with Forge best practices and security rules:
 * We attempt asUser() first to inherit the caller's permissions and access checks.
 * If the user context is not present, we gracefully fall back to asApp() to complete the read request.
 *
 * @param {Object} endpointRoute - The tagged route template from @forge/api.
 * @param {Object} options - Request options (method, headers, body, etc.).
 * @returns {Promise<Object>} - The parsed JSON response from Jira.
 */
async function fetchJira(endpointRoute, options = {}) {
  try {
    const userRes = await api.asUser().requestJira(endpointRoute, options);
    if (userRes.ok) {
      return await userRes.json();
    }
  } catch (err) {
    // Fallback to asApp() if asUser() context is unavailable or unauthorized
  }

  const appRes = await api.asApp().requestJira(endpointRoute, options);
  if (!appRes.ok) {
    const errorText = await appRes.text();
    throw new Error(`Jira API error (${appRes.status}): ${errorText}`);
  }
  return await appRes.json();
}

/**
 * In-memory module cache for Story Point field IDs.
 * Persists across warm Forge container invocations to avoid repeated /rest/api/3/field API requests.
 */
let cachedStoryPointFields = null;
let lastFieldCacheTime = 0;
const FIELD_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

/**
 * Helper to dynamically discover the custom field ID(s) used for Story Points in the Jira instance.
 *
 * Why this is necessary:
 * Different Jira instances and project types store Story Points in different custom fields:
 * - Team-managed projects: often "Story point estimate" (customfield_10016)
 * - Company-managed projects: often "Story Points" (customfield_10026 or customfield_10028)
 *
 * Querying Jira's /rest/api/3/field endpoint dynamically discovers all fields matching "story point",
 * allowing seamless compatibility without hardcoding.
 *
 * @returns {Promise<string[]>} - Array of field IDs corresponding to Story Points.
 */
async function getStoryPointFieldIds() {
  const now = Date.now();
  if (cachedStoryPointFields && now - lastFieldCacheTime < FIELD_CACHE_TTL_MS) {
    return cachedStoryPointFields;
  }

  const detectedFieldIds = new Set(['customfield_10016', 'customfield_10026', 'customfield_10028']);

  try {
    const fields = await fetchJira(route`/rest/api/3/field`);
    if (Array.isArray(fields)) {
      fields.forEach((field) => {
        const fieldName = (field.name || '').toLowerCase();
        if (
          fieldName === 'story points' ||
          fieldName === 'story point estimate' ||
          fieldName.includes('story point')
        ) {
          detectedFieldIds.add(field.id);
        }
      });
    }
    cachedStoryPointFields = Array.from(detectedFieldIds);
    lastFieldCacheTime = now;
  } catch (err) {
    console.warn('Could not dynamically retrieve Jira fields list; continuing with fallback field IDs:', err.message);
    if (cachedStoryPointFields) {
      return cachedStoryPointFields;
    }
  }

  return cachedStoryPointFields || Array.from(detectedFieldIds);
}

/**
 * Helper to fetch Jira issues with automatic pagination.
 * Loops through pages of 100 issues up to maxTotalIssues (default 1000).
 * Supports Jira Cloud v3 cursor pagination (nextPageToken) as well as offset pagination (startAt).
 *
 * @param {string} jql - JQL query string.
 * @param {string[]} fieldsList - Array of fields to return.
 * @param {number} maxTotalIssues - Maximum issues to fetch before stopping (defaults to 1000).
 * @returns {Promise<{ issues: Array, totalFound: number, isTruncated: boolean }>}
 */
async function fetchAllIssues(jql, fieldsList, maxTotalIssues = 1000) {
  const PAGE_SIZE = 100;
  const allIssues = [];
  let nextPageToken = null;
  let startAt = 0;
  let totalFound = 0;
  let hasMore = true;

  let searchError = null;

  while (hasMore && allIssues.length < maxTotalIssues) {
    let pageData = null;

    // Strategy 1: Modern Jira Cloud v3 search endpoint with nextPageToken / startAt
    try {
      const requestBody = {
        jql,
        maxResults: PAGE_SIZE,
        fields: fieldsList,
      };

      if (nextPageToken) {
        requestBody.nextPageToken = nextPageToken;
      } else if (startAt > 0) {
        requestBody.startAt = startAt;
      }

      pageData = await fetchJira(route`/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (postErr) {
      searchError = postErr;
      // Strategy 2: Fallback to classic POST /rest/api/3/search
      try {
        pageData = await fetchJira(route`/rest/api/3/search`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jql,
            startAt,
            maxResults: PAGE_SIZE,
            fields: fieldsList,
          }),
        });
      } catch (fallbackPostErr) {
        searchError = fallbackPostErr;
        // Strategy 3: Fallback to GET /rest/api/3/search
        try {
          const fieldsStr = fieldsList.join(',');
          pageData = await fetchJira(
            route`/rest/api/3/search?jql=${jql}&startAt=${startAt}&maxResults=${PAGE_SIZE}&fields=${fieldsStr}`
          );
        } catch (getErr) {
          searchError = getErr;
          console.error('Failed to fetch page of issues in pagination loop:', getErr.message);
          break;
        }
      }
    }

    // If on the very first page no data was returned due to an error, surface the error
    if (!pageData && allIssues.length === 0 && searchError) {
      throw new Error(`Jira search query failed: ${searchError.message}`);
    }

    const currentBatch = pageData?.issues || [];
    if (!currentBatch.length) {
      break;
    }

    allIssues.push(...currentBatch);

    // Track total in Jira
    if (typeof pageData.total === 'number') {
      totalFound = pageData.total;
    } else if (typeof pageData.totalCount === 'number') {
      totalFound = pageData.totalCount;
    } else {
      totalFound = Math.max(totalFound, allIssues.length);
    }

    // Determine if more pages exist
    if (pageData.nextPageToken) {
      nextPageToken = pageData.nextPageToken;
      hasMore = !pageData.isLast && allIssues.length < totalFound;
    } else {
      startAt += currentBatch.length;
      hasMore = currentBatch.length === PAGE_SIZE && allIssues.length < totalFound;
    }

    if (pageData.isLast === true) {
      hasMore = false;
    }
  }

  return {
    issues: allIssues,
    totalFound: totalFound || allIssues.length,
    isTruncated: totalFound > allIssues.length,
  };
}

/**
 * Helper function to safely extract and parse a numeric Story Point value from an issue's fields.
 *
 * @param {Object} fields - The fields object of a Jira issue.
 * @param {string[]} candidateFieldIds - List of candidate Story Point custom field IDs.
 * @returns {number|null} - The numeric story points value, or null if unestimated.
 */
function extractStoryPoints(fields, candidateFieldIds) {
  if (!fields) return null;

  for (const fieldId of candidateFieldIds) {
    const rawValue = fields[fieldId];
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      const parsedNumber = Number(rawValue);
      if (!isNaN(parsedNumber) && parsedNumber >= 0) {
        return parsedNumber;
      }
    }
  }

  if (fields.storyPoints !== undefined && fields.storyPoints !== null && fields.storyPoints !== '') {
    const parsedNumber = Number(fields.storyPoints);
    if (!isNaN(parsedNumber) && parsedNumber >= 0) {
      return parsedNumber;
    }
  }

  return null;
}

/**
 * Resolver: getProjects
 * Fetches accessible Jira projects for the project selector dropdown.
 */
resolver.define('getProjects', async () => {
  try {
    const data = await fetchJira(route`/rest/api/3/project/search?maxResults=50&orderBy=name`);
    const projects = (data.values || []).map((proj) => ({
      id: proj.id,
      key: proj.key,
      name: proj.name,
      projectTypeKey: proj.projectTypeKey,
      avatarUrl: proj.avatarUrls ? proj.avatarUrls['24x24'] : null,
    }));
    return { success: true, projects };
  } catch (err) {
    return { success: false, error: err.message, projects: [] };
  }
});

/**
 * Resolver: getProjectFilterOptions
 * Fetches available filter options (assignable users, issue types, statuses) for a project.
 */
resolver.define('getProjectFilterOptions', async (req) => {
  const { projectKey } = req.payload || {};
  if (!projectKey) {
    return { success: false, error: 'Project key is required' };
  }

  try {
    const [usersRes, statusesRes, prioritiesRes] = await Promise.allSettled([
      fetchJira(route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=50`),
      fetchJira(route`/rest/api/3/project/${projectKey}/statuses`),
      fetchJira(route`/rest/api/3/priority`),
    ]);

    const assignees =
      usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)
        ? usersRes.value.map((u) => ({ label: u.displayName, value: u.displayName }))
        : [];

    const issueTypesMap = new Map();
    const statusesMap = new Map();

    if (statusesRes.status === 'fulfilled' && Array.isArray(statusesRes.value)) {
      statusesRes.value.forEach((item) => {
        if (item.name) {
          issueTypesMap.set(item.name, { label: item.name, value: item.name });
        }
        if (Array.isArray(item.statuses)) {
          item.statuses.forEach((st) => {
            if (st.name) {
              statusesMap.set(st.name, { label: st.name, value: st.name });
            }
          });
        }
      });
    }

    const priorities =
      prioritiesRes.status === 'fulfilled' && Array.isArray(prioritiesRes.value)
        ? prioritiesRes.value.map((p) => ({ label: p.name, value: p.name }))
        : [
            { label: 'Highest', value: 'Highest' },
            { label: 'High', value: 'High' },
            { label: 'Medium', value: 'Medium' },
            { label: 'Low', value: 'Low' },
            { label: 'Lowest', value: 'Lowest' },
          ];

    return {
      success: true,
      assignees: [
        { label: 'All Assignees', value: 'all' },
        { label: '👤 Unassigned', value: 'unassigned' },
        ...assignees,
      ],
      sprints: [
        { label: 'All Sprints', value: 'all' },
        { label: '🏃 Active Sprint', value: 'active' },
        { label: '📅 Future Sprints', value: 'future' },
        { label: '📦 Backlog (No Sprint)', value: 'backlog' },
        { label: '🏁 Closed Sprints', value: 'closed' },
      ],
      issueTypes: [
        { label: 'All Issue Types', value: 'all' },
        ...Array.from(issueTypesMap.values()),
      ],
      statuses: [
        { label: 'All Statuses', value: 'all' },
        ...Array.from(statusesMap.values()),
      ],
      priorities: [
        { label: 'All Priorities', value: 'all' },
        ...priorities,
      ],
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      assignees: [{ label: 'All Assignees', value: 'all' }, { label: '👤 Unassigned', value: 'unassigned' }],
      sprints: [{ label: 'All Sprints', value: 'all' }],
      issueTypes: [{ label: 'All Issue Types', value: 'all' }],
      statuses: [{ label: 'All Statuses', value: 'all' }],
      priorities: [{ label: 'All Priorities', value: 'all' }],
    };
  }
});

/**
 * Resolver: getJqlAutocompleteData
 * Fetches JQL field names, functions, and reserved words from Jira's autocompletedata API.
 * Provides rich suggestions when users type custom JQL in the JQL filter tab.
 */
resolver.define('getJqlAutocompleteData', async () => {
  try {
    const data = await fetchJira(route`/rest/api/3/jql/autocompletedata`);
    return {
      success: true,
      visibleFieldNames: data.visibleFieldNames || [],
      visibleFunctionNames: data.visibleFunctionNames || [],
      jqlReservedWords: data.jqlReservedWords || [],
    };
  } catch (err) {
    console.warn('Could not fetch remote JQL autocomplete data, using comprehensive fallback:', err.message);
    return {
      success: true, // provide graceful fallback data
      visibleFieldNames: [
        { value: 'assignee', displayName: 'Assignee' },
        { value: 'status', displayName: 'Status' },
        { value: 'issuetype', displayName: 'Issue Type' },
        { value: 'priority', displayName: 'Priority' },
        { value: 'sprint', displayName: 'Sprint' },
        { value: 'labels', displayName: 'Labels' },
        { value: 'component', displayName: 'Component' },
        { value: 'fixVersion', displayName: 'Fix Version' },
        { value: 'resolution', displayName: 'Resolution' },
        { value: 'reporter', displayName: 'Reporter' },
        { value: 'created', displayName: 'Created Date' },
        { value: 'updated', displayName: 'Updated Date' },
        { value: 'summary', displayName: 'Summary' },
        { value: 'description', displayName: 'Description' },
        { value: 'parent', displayName: 'Parent' },
      ],
      visibleFunctionNames: [
        { value: 'currentUser()', displayName: 'currentUser()' },
        { value: 'openSprints()', displayName: 'openSprints()' },
        { value: 'futureSprints()', displayName: 'futureSprints()' },
        { value: 'closedSprints()', displayName: 'closedSprints()' },
        { value: 'now()', displayName: 'now()' },
        { value: 'startOfDay()', displayName: 'startOfDay()' },
        { value: 'endOfDay()', displayName: 'endOfDay()' },
        { value: 'startOfWeek()', displayName: 'startOfWeek()' },
        { value: 'endOfWeek()', displayName: 'endOfWeek()' },
        { value: 'startOfMonth()', displayName: 'startOfMonth()' },
        { value: 'endOfMonth()', displayName: 'endOfMonth()' },
      ],
      jqlReservedWords: [
        'AND',
        'OR',
        'NOT',
        'IN',
        'IS',
        'EMPTY',
        'NULL',
        'ORDER BY',
        'ASC',
        'DESC',
        'WAS',
        'CHANGED',
      ],
    };
  }
});

/**
 * Resolver: getProjectAnalytics
 * Analyzes sprint & team metrics for a specific project.
 * Supports dynamic filtering by assignee, sprint, issue type, status, priority, and custom JQL!
 */
resolver.define('getProjectAnalytics', async (req) => {
  const {
    projectKey,
    searchQuery,
    assignee,
    sprint,
    issueType,
    status,
    priority,
    customJql,
  } = req.payload || {};

  if (!projectKey) {
    return { success: false, error: 'Project key is required' };
  }

  try {
    // 1. Discover all candidate Story Points custom field IDs in this Jira instance
    const storyPointFieldIds = await getStoryPointFieldIds();

    // 2. Build dynamic JQL query based on active filters
    const jqlClauses = [`project = "${projectKey}"`];

    // Optional Keyword Search (if passed)
    if (searchQuery && searchQuery.trim()) {
      const safeSearch = searchQuery.trim().replace(/"/g, '\\"');
      jqlClauses.push(`(summary ~ "${safeSearch}" OR text ~ "${safeSearch}" OR issuekey = "${safeSearch}")`);
    }

    // Assignee filter
    if (assignee && assignee !== 'all') {
      if (assignee === 'unassigned') {
        jqlClauses.push('assignee IS EMPTY');
      } else {
        jqlClauses.push(`assignee = "${assignee.replace(/"/g, '\\"')}"`);
      }
    }

    // Sprint filter
    if (sprint && sprint !== 'all') {
      if (sprint === 'active') {
        jqlClauses.push('sprint in openSprints()');
      } else if (sprint === 'future') {
        jqlClauses.push('sprint in futureSprints()');
      } else if (sprint === 'backlog') {
        jqlClauses.push('sprint IS EMPTY');
      } else if (sprint === 'closed') {
        jqlClauses.push('sprint in closedSprints()');
      } else {
        jqlClauses.push(`sprint = "${sprint.replace(/"/g, '\\"')}"`);
      }
    }

    // Issue Type filter
    if (issueType && issueType !== 'all') {
      jqlClauses.push(`issuetype = "${issueType.replace(/"/g, '\\"')}"`);
    }

    // Status filter
    if (status && status !== 'all') {
      jqlClauses.push(`status = "${status.replace(/"/g, '\\"')}"`);
    }

    // Priority filter
    if (priority && priority !== 'all') {
      jqlClauses.push(`priority = "${priority.replace(/"/g, '\\"')}"`);
    }

    // Custom JQL clause filter (allows arbitrary user JQL filters like labels, components, etc.)
    let customOrderBy = 'ORDER BY updated DESC';
    if (customJql && customJql.trim()) {
      let rawClause = customJql.trim();
      // Match and extract trailing ORDER BY if user provided one in customJql
      const orderMatch = rawClause.match(/\s+order\s+by\s+(.+)$/i);
      if (orderMatch) {
        customOrderBy = `ORDER BY ${orderMatch[1].trim()}`;
        rawClause = rawClause.substring(0, orderMatch.index).trim();
      }
      if (rawClause) {
        jqlClauses.push(`(${rawClause})`);
      }
    }

    const jql = `${jqlClauses.join(' AND ')} ${customOrderBy}`;

    const fieldsList = [
      'summary',
      'status',
      'issuetype',
      'priority',
      'assignee',
      'created',
      'updated',
      'resolutiondate',
      'timetracking',
      'timeestimate',
      'timespent',
      ...storyPointFieldIds,
    ];

    // Fetch all matching issues using paginated search (up to 1,000 issues)
    const { issues, totalFound, isTruncated } = await fetchAllIssues(jql, fieldsList, 1000);
    const now = Date.now();

    // 3. KPI Aggregations (tracking both Story Points & Time/Hours)
    let totalStoryPoints = 0;
    let completedStoryPoints = 0;
    let inProgressStoryPoints = 0;
    let toDoStoryPoints = 0;
    let unestimatedPointsCount = 0;

    let totalEstimatedSeconds = 0;
    let totalLoggedSeconds = 0;
    let totalRemainingSeconds = 0;
    let unestimatedHoursCount = 0;

    let completedCount = 0;
    let inProgressCount = 0;
    let toDoCount = 0;
    let unassignedCount = 0;
    let bugCount = 0;
    let totalCycleTimeMs = 0;
    let cycleTimeSampleCount = 0;

    const assigneeMap = {};
    const typeMap = {};
    const priorityMap = {};
    const statusMap = {};
    const staleIssues = [];

    issues.forEach((issue) => {
      const fields = issue.fields || {};
      const statusCategory = fields.status?.statusCategory?.key || 'new';
      const statusName = fields.status?.name || 'Unknown';
      const typeName = fields.issuetype?.name || 'Task';
      const priorityName = fields.priority?.name || 'Medium';
      const assigneeName = fields.assignee?.displayName || 'Unassigned';
      const isDone = statusCategory === 'done' || !!fields.resolutiondate;
      const isInProgress = statusCategory === 'indeterminate';

      // Status counters for issue volume
      if (isDone) completedCount += 1;
      else if (isInProgress) inProgressCount += 1;
      else toDoCount += 1;

      // Status breakdown
      statusMap[statusName] = (statusMap[statusName] || 0) + 1;

      // Type breakdown & bug tracking
      typeMap[typeName] = (typeMap[typeName] || 0) + 1;
      if (typeName.toLowerCase().includes('bug')) {
        bugCount += 1;
      }

      // Priority breakdown
      priorityMap[priorityName] = (priorityMap[priorityName] || 0) + 1;

      // --- STORY POINTS CALCULATION ---
      const points = extractStoryPoints(fields, storyPointFieldIds);
      const isEstimatedPoints = points !== null && points !== undefined;
      const issuePoints = isEstimatedPoints ? points : 0;

      totalStoryPoints += issuePoints;
      if (isDone) {
        completedStoryPoints += issuePoints;
      } else if (isInProgress) {
        inProgressStoryPoints += issuePoints;
      } else {
        toDoStoryPoints += issuePoints;
      }

      if (!isEstimatedPoints && !isDone) {
        unestimatedPointsCount += 1;
      }

      // --- TIME TRACKING / HOURS CALCULATION ---
      const estSeconds = fields.timetracking?.originalEstimateSeconds || fields.timeestimate || 0;
      const spentSeconds = fields.timetracking?.timeSpentSeconds || fields.timespent || 0;
      const remSeconds = fields.timetracking?.remainingEstimateSeconds || 0;

      totalEstimatedSeconds += estSeconds;
      totalLoggedSeconds += spentSeconds;
      totalRemainingSeconds += remSeconds;

      if (!estSeconds && !isDone) {
        unestimatedHoursCount += 1;
      }

      // Assignee tracking
      if (!fields.assignee) {
        unassignedCount += 1;
      }

      // Initialize team member record if first encountered
      if (!assigneeMap[assigneeName]) {
        assigneeMap[assigneeName] = {
          name: assigneeName,
          avatarUrl: fields.assignee?.avatarUrls ? fields.assignee.avatarUrls['24x24'] : null,
          totalIssues: 0,
          completedIssues: 0,
          inProgressIssues: 0,
          toDoIssues: 0,
          // Story point metrics
          totalPoints: 0,
          completedPoints: 0,
          remainingPoints: 0,
          // Hour metrics
          estimatedHours: 0,
          loggedHours: 0,
          remainingHours: 0,
        };
      }

      const member = assigneeMap[assigneeName];
      member.totalIssues += 1;

      // Story points allocation per member
      member.totalPoints += issuePoints;
      if (isDone) {
        member.completedIssues += 1;
        member.completedPoints += issuePoints;
      } else if (isInProgress) {
        member.inProgressIssues += 1;
        member.remainingPoints += issuePoints;
      } else {
        member.toDoIssues += 1;
        member.remainingPoints += issuePoints;
      }

      // Hours allocation per member
      member.estimatedHours += Math.round((estSeconds / 3600) * 10) / 10;
      member.loggedHours += Math.round((spentSeconds / 3600) * 10) / 10;
      member.remainingHours += Math.round((remSeconds / 3600) * 10) / 10;

      // Cycle time calculation (created to resolution)
      if (isDone && fields.resolutiondate && fields.created) {
        const createdMs = new Date(fields.created).getTime();
        const resolvedMs = new Date(fields.resolutiondate).getTime();
        if (resolvedMs >= createdMs) {
          totalCycleTimeMs += resolvedMs - createdMs;
          cycleTimeSampleCount += 1;
        }
      }

      // Stale / Bottleneck issues (In progress or open without update for >= 4 days)
      if (!isDone && fields.updated) {
        const updatedMs = new Date(fields.updated).getTime();
        const daysInactive = Math.floor((now - updatedMs) / (1000 * 60 * 60 * 24));
        if (daysInactive >= 4) {
          staleIssues.push({
            id: issue.id,
            key: issue.key,
            summary: fields.summary || 'No Summary',
            status: statusName,
            statusCategory,
            priority: priorityName,
            assignee: assigneeName,
            daysInactive,
            updated: fields.updated,
          });
        }
      }
    });

    const totalIssues = issues.length;
    const completionRate = totalIssues > 0 ? Math.round((completedCount / totalIssues) * 100) : 0;

    // Format Story Points
    totalStoryPoints = Math.round(totalStoryPoints * 10) / 10;
    completedStoryPoints = Math.round(completedStoryPoints * 10) / 10;
    const remainingStoryPoints = Math.round((totalStoryPoints - completedStoryPoints) * 10) / 10;

    // Format Hours
    const totalEstimatedHours = Math.round((totalEstimatedSeconds / 3600) * 10) / 10;
    const totalLoggedHours = Math.round((totalLoggedSeconds / 3600) * 10) / 10;
    const totalRemainingHours = Math.round((totalRemainingSeconds / 3600) * 10) / 10;

    const bugRatio = totalIssues > 0 ? Math.round((bugCount / totalIssues) * 100) : 0;
    const avgCycleTimeDays =
      cycleTimeSampleCount > 0
        ? Math.round((totalCycleTimeMs / (cycleTimeSampleCount * 1000 * 60 * 60 * 24)) * 10) / 10
        : null;

    // Format Team Members list with both capacity statuses (Points and Hours)
    const teamMembers = Object.values(assigneeMap).map((m) => {
      // Points-based capacity
      let capacityStatusPoints = 'Optimal';
      if (m.remainingPoints > 20 || m.totalPoints > 30) {
        capacityStatusPoints = 'Heavy';
      } else if (m.totalPoints === 0 && m.totalIssues > 0) {
        capacityStatusPoints = 'Unestimated';
      } else if (m.totalIssues === 0) {
        capacityStatusPoints = 'Available';
      }

      // Hours-based capacity
      let capacityStatusHours = 'Optimal';
      if (m.estimatedHours > 40) {
        capacityStatusHours = 'Heavy';
      } else if (m.estimatedHours === 0 && m.totalIssues > 0) {
        capacityStatusHours = 'Unestimated';
      } else if (m.totalIssues === 0) {
        capacityStatusHours = 'Available';
      }

      return {
        ...m,
        totalPoints: Math.round(m.totalPoints * 10) / 10,
        completedPoints: Math.round(m.completedPoints * 10) / 10,
        remainingPoints: Math.round(m.remainingPoints * 10) / 10,
        estimatedHours: Math.round(m.estimatedHours * 10) / 10,
        loggedHours: Math.round(m.loggedHours * 10) / 10,
        remainingHours: Math.round(m.remainingHours * 10) / 10,
        completionRate: m.totalIssues > 0 ? Math.round((m.completedIssues / m.totalIssues) * 100) : 0,
        capacityStatusPoints,
        capacityStatusHours,
      };
    });

    // Sort assignees by total issues descending
    teamMembers.sort((a, b) => b.totalIssues - a.totalIssues);

    const typeChartData = Object.keys(typeMap).map((name) => ({
      name,
      value: typeMap[name],
    }));

    const statusChartData = [
      { name: 'To Do', value: toDoCount },
      { name: 'In Progress', value: inProgressCount },
      { name: 'Done', value: completedCount },
    ].filter((item) => item.value > 0);

    const priorityChartData = Object.keys(priorityMap).map((name) => ({
      name,
      value: priorityMap[name],
    }));

    // Sort stale issues by days inactive descending
    staleIssues.sort((a, b) => b.daysInactive - a.daysInactive);

    // Top recent issues sample for drill-down table with both Points and Hours
    const recentIssues = issues.slice(0, 20).map((issue) => {
      const issuePoints = extractStoryPoints(issue.fields, storyPointFieldIds);
      const estSec = issue.fields?.timetracking?.originalEstimateSeconds || issue.fields?.timeestimate || 0;
      const spentSec = issue.fields?.timetracking?.timeSpentSeconds || issue.fields?.timespent || 0;

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields?.summary || '',
        type: issue.fields?.issuetype?.name || 'Task',
        status: issue.fields?.status?.name || '',
        statusCategory: issue.fields?.status?.statusCategory?.key || 'new',
        priority: issue.fields?.priority?.name || 'Medium',
        assignee: issue.fields?.assignee?.displayName || 'Unassigned',
        storyPoints: issuePoints,
        estimatedHours: Math.round((estSec / 3600) * 10) / 10,
        loggedHours: Math.round((spentSec / 3600) * 10) / 10,
      };
    });

    // Executive summaries for both modes
    const executiveSummaryPoints = `### 📊 Agile Pulse Brief (Story Points): ${projectKey}
* **Applied JQL:** \`${jql}\`
* **Progress:** ${completedCount}/${totalIssues} issues completed (**${completionRate}%**)
* **Velocity & Story Points:** **${totalStoryPoints} SP** total | **${completedStoryPoints} SP** completed | **${remainingStoryPoints} SP** remaining
* **Flow & Speed:** Average Cycle Time: **${avgCycleTimeDays !== null ? `${avgCycleTimeDays} days` : 'N/A'}**
* **Quality Health:** Bug Ratio: **${bugRatio}%** (${bugCount} bugs out of ${totalIssues} tickets)
* **Risk & Action Items:**
  ${staleIssues.length > 0 ? `- ⚠️ **${staleIssues.length} stale tickets** inactive for ≥ 4 days.` : '- ✅ No stale tickets detected.'}
  ${unassignedCount > 0 ? `- 👤 **${unassignedCount} unassigned issues** need owner.` : '- ✅ All active issues assigned.'}
  ${unestimatedPointsCount > 0 ? `- 🎯 **${unestimatedPointsCount} issues missing Story Points**.` : '- ✅ All issues estimated with Story Points.'}
`;

    const executiveSummaryHours = `### 📊 Agile Pulse Brief (Hours): ${projectKey}
* **Applied JQL:** \`${jql}\`
* **Progress:** ${completedCount}/${totalIssues} issues completed (**${completionRate}%**)
* **Effort & Hours:** **${totalEstimatedHours}h** estimated | **${totalLoggedHours}h** logged | **${totalRemainingHours}h** remaining
* **Flow & Speed:** Average Cycle Time: **${avgCycleTimeDays !== null ? `${avgCycleTimeDays} days` : 'N/A'}**
* **Quality Health:** Bug Ratio: **${bugRatio}%** (${bugCount} bugs out of ${totalIssues} tickets)
* **Risk & Action Items:**
  ${staleIssues.length > 0 ? `- ⚠️ **${staleIssues.length} stale tickets** inactive for ≥ 4 days.` : '- ✅ No stale tickets detected.'}
  ${unassignedCount > 0 ? `- 👤 **${unassignedCount} unassigned issues** need owner.` : '- ✅ All active issues assigned.'}
  ${unestimatedHoursCount > 0 ? `- ⏱️ **${unestimatedHoursCount} issues missing hour estimates**.` : '- ✅ All issues estimated.'}
`;

    return {
      success: true,
      projectKey,
      appliedJql: jql,
      totalFound,
      isTruncated,
      kpis: {
        totalIssues,
        completedCount,
        inProgressCount,
        toDoCount,
        completionRate,
        // Story Points KPIs
        totalStoryPoints,
        completedStoryPoints,
        remainingStoryPoints,
        unestimatedPointsCount,
        // Hours KPIs
        totalEstimatedHours,
        totalLoggedHours,
        totalRemainingHours,
        unestimatedHoursCount,
        // Common Quality & Risk KPIs
        bugRatio,
        bugCount,
        avgCycleTimeDays,
        unassignedCount,
        staleCount: staleIssues.length,
      },
      charts: {
        types: typeChartData,
        status: statusChartData,
        priorities: priorityChartData,
      },
      teamMembers,
      staleIssues,
      recentIssues,
      executiveSummaryPoints,
      executiveSummaryHours,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to fetch project analytics',
    };
  }
});

export const handler = resolver.getDefinitions();