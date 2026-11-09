import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

/**
 * Shared constant for stale issue threshold (in days of inactivity).
 * Used consistently across KPI counters, staleIssues list, and rawIssues flags.
 */
const STALE_DAYS_THRESHOLD = 3;

/**
 * FIFO Historical Snapshot Vault Constants.
 * Stored per-project in Jira Project Entity Properties (`asUser()`) with zero additional scopes.
 * When capacity (>104 reports or >28 KB) is reached, ONLY the single oldest chronological
 * snapshot (`snapshots[0]`) is unhooked one-by-one (strict FIFO circular buffer).
 */
const FIFO_VAULT_PROPERTY_KEY = 'agile_pulse_fifo_snapshots_v1';
const MAX_FIFO_SNAPSHOTS = 104; // 2 years of weekly executive snapshots
const MAX_FIFO_BYTES = 28672; // 28 KB safety ceiling inside Jira's 32 KB entity property limit

/**
 * Validation & sanitization helpers for JQL and Jira identifiers.
 */
const PROJECT_KEY_REGEX = /^[A-Z][A-Z0-9_]{1,15}$/i;
const ISSUE_KEY_REGEX = /^[A-Z][A-Z0-9_]+-\d+$/i;
const BUG_TYPE_REGEX = /\b(bug|defect|incident|error|σφάλμα|λάθος)\b/i;

function assertProjectKey(projectKey) {
  const clean = String(projectKey || '').trim();
  if (!PROJECT_KEY_REGEX.test(clean)) {
    throw new Error('Invalid Jira project key format.');
  }
  return clean;
}

function assertIssueKey(issueKey) {
  const clean = String(issueKey || '').trim();
  if (!ISSUE_KEY_REGEX.test(clean)) {
    throw new Error('Invalid Jira issue key format.');
  }
  return clean;
}

/**
 * Safely escapes a string value for inclusion inside a double-quoted JQL literal.
 * Escapes backslashes FIRST, then double quotes, and strips control characters.
 */
function jqlQuote(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

/**
 * Checks that parentheses in a custom JQL snippet are balanced so it cannot
 * break out of its enclosing `( ... )` group.
 */
function hasBalancedParentheses(clause) {
  let depth = 0;
  let inQuotes = false;
  for (let i = 0; i < clause.length; i++) {
    const ch = clause[i];
    if (ch === '\\' && inQuotes) {
      i++; // skip escaped character
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth < 0) return false;
      }
    }
  }
  return depth === 0 && !inQuotes;
}

/**
 * Maps HTTP status codes to safe user-facing messages without leaking raw Jira internals.
 */
function mapJiraStatusToSafeError(status, contextLabel = 'Jira API request') {
  if (status === 400) return `${contextLabel} failed: Invalid query or filter parameters (400).`;
  if (status === 401) return `${contextLabel} failed: Authentication required (401).`;
  if (status === 403) return `${contextLabel} failed: You do not have permission to access or modify this resource (403).`;
  if (status === 404) return `${contextLabel} failed: Requested Jira resource was not found (404).`;
  if (status === 429) return `${contextLabel} failed: Jira rate limit reached. Please wait a moment and retry (429).`;
  return `${contextLabel} failed with status ${status}.`;
}

/**
 * Executes a Jira REST API request strictly under the current user's context (`asUser()`).
 *
 * Security Guarantees:
 * 1. NEVER falls back to `asApp()` — prevents privilege escalation on restricted projects/issues.
 * 2. Handles HTTP 204 No Content responses cleanly.
 * 3. Automatically retries HTTP 429 Too Many Requests (up to 2 retries respecting Retry-After).
 * 4. Logs raw error details server-side only and throws sanitized messages for the client.
 *
 * @param {Object} endpointRoute - The tagged route template from @forge/api.
 * @param {Object} options - Request options (method, headers, body, etc.).
 * @returns {Promise<Object>} - The parsed JSON response from Jira.
 */
async function fetchJira(endpointRoute, options = {}) {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const userRes = await api.asUser().requestJira(endpointRoute, options);

    if (userRes.ok) {
      if (userRes.status === 204) return { success: true };
      const text = await userRes.text();
      return text ? JSON.parse(text) : { success: true };
    }

    // Handle 429 Rate Limiting with backoff
    if (userRes.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = Number(userRes.headers?.get?.('Retry-After'));
      const delayMs = !isNaN(retryAfterHeader) && retryAfterHeader > 0
        ? Math.min(retryAfterHeader * 1000, 4000)
        : (attempt + 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    const rawErrorText = await userRes.text().catch(() => '');
    console.warn(`Jira API error (${userRes.status}):`, rawErrorText.slice(0, 500));

    const err = new Error(mapJiraStatusToSafeError(userRes.status));
    err.status = userRes.status;
    throw err;
  }
}

/**
 * Unified in-memory cache for Jira field metadata (/rest/api/3/field).
 * Populates both Story Point and Sprint custom field IDs in a single API call.
 */
let cachedStoryPointFields = null;
let cachedSprintFields = null;
let lastFieldCacheTime = 0;
let lastFieldFailureTime = 0;
const FIELD_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour positive cache TTL
const FIELD_FAILURE_TTL_MS = 60 * 1000; // 60s negative cache TTL on failure

async function ensureFieldMetadataCached() {
  const now = Date.now();
  if (
    cachedStoryPointFields &&
    cachedSprintFields &&
    now - lastFieldCacheTime < FIELD_CACHE_TTL_MS
  ) {
    return;
  }

  // Respect negative cache window so a transient failure doesn't hammer /field
  if (lastFieldFailureTime && now - lastFieldFailureTime < FIELD_FAILURE_TTL_MS) {
    return;
  }

  const spIds = new Set();
  const sprintIds = new Set(['sprint']);

  try {
    const fields = await fetchJira(route`/rest/api/3/field`);
    if (Array.isArray(fields)) {
      fields.forEach((field) => {
        if (!field || !field.id) return;
        const fieldName = (field.name || '').toLowerCase();
        const customType = (field.schema?.custom || '').toLowerCase();

        if (fieldName.includes('story point')) {
          spIds.add(field.id);
        }
        if (
          fieldName === 'sprint' ||
          customType.includes('sprint') ||
          customType.includes('gh-sprint')
        ) {
          sprintIds.add(field.id);
        }
      });
    }

    cachedStoryPointFields =
      spIds.size > 0
        ? Array.from(spIds)
        : ['customfield_10016', 'customfield_10026', 'customfield_10028'];
    cachedSprintFields =
      sprintIds.size > 1
        ? Array.from(sprintIds)
        : ['sprint', 'customfield_10020'];
    lastFieldCacheTime = now;
    lastFieldFailureTime = 0;
  } catch (err) {
    lastFieldFailureTime = now;
    console.warn('Could not dynamically retrieve Jira fields list; using fallback IDs:', err.message);
  }
}

async function getStoryPointFieldIds() {
  await ensureFieldMetadataCached();
  return cachedStoryPointFields || ['customfield_10016', 'customfield_10026', 'customfield_10028'];
}

async function getSprintFieldIds() {
  await ensureFieldMetadataCached();
  return cachedSprintFields || ['sprint', 'customfield_10020'];
}

/**
 * Helper to fetch Jira issues with cursor pagination via POST /rest/api/3/search/jql.
 * Loops through pages of 100 issues up to maxTotalIssues (default 1000) and respects a
 * 19-second wall-clock deadline so we never exceed Forge's 25s invocation limit.
 *
 * @param {string} jql - JQL query string.
 * @param {string[]} fieldsList - Array of fields to return.
 * @param {number} maxTotalIssues - Maximum issues to fetch before stopping (defaults to 1000).
 * @returns {Promise<{ issues: Array, totalFound: number, isTruncated: boolean }>}
 */
async function fetchAllIssues(jql, fieldsList, maxTotalIssues = 1000) {
  const PAGE_SIZE = 100;
  const DEADLINE_MS = 19000;
  const startWallMs = Date.now();

  const allIssues = [];
  let nextPageToken = null;
  let hasMore = true;
  let stoppedEarly = false;

  // Query approximate total count in parallel (non-blocking fallback if unsupported)
  const cleanJqlForCount = jql.replace(/\s+ORDER\s+BY\s+.+$/i, '').trim();
  const countPromise = fetchJira(route`/rest/api/3/search/approximate-count`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jql: cleanJqlForCount }),
  }).catch(() => null);

  while (hasMore && allIssues.length < maxTotalIssues) {
    if (allIssues.length > 0 && Date.now() - startWallMs > DEADLINE_MS) {
      stoppedEarly = true;
      break;
    }

    const requestBody = {
      jql,
      maxResults: PAGE_SIZE,
      fields: fieldsList,
    };
    if (nextPageToken) {
      requestBody.nextPageToken = nextPageToken;
    }

    let pageData;
    try {
      pageData = await fetchJira(route`/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      if (allIssues.length === 0) {
        throw err;
      }
      console.warn('Pagination stopped early due to error on subsequent page:', err.message);
      stoppedEarly = true;
      break;
    }

    const currentBatch = pageData?.issues || [];
    if (!currentBatch.length) {
      hasMore = false;
      break;
    }

    allIssues.push(...currentBatch);

    nextPageToken = pageData.nextPageToken || null;
    hasMore = Boolean(nextPageToken) && pageData.isLast !== true;
  }

  const countRes = await countPromise;
  const approxTotal = typeof countRes?.count === 'number' ? countRes.count : 0;
  const isTruncated = stoppedEarly || (hasMore && allIssues.length >= maxTotalIssues) || approxTotal > allIssues.length;
  const totalFound = Math.max(approxTotal, allIssues.length);

  return {
    issues: allIssues.slice(0, maxTotalIssues),
    totalFound,
    isTruncated,
  };
}

/**
 * Helper function to safely extract and parse a numeric Story Point value from an issue's fields.
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

  return null;
}

/**
 * Helper to extract sprint objects from an issue's custom sprint fields.
 */
function collectSprintsFromFields(fields, sprintFieldIds, targetMap, onActiveSprint) {
  if (!fields) return;
  for (const fieldId of sprintFieldIds) {
    const val = fields[fieldId];
    const items = Array.isArray(val) ? val : val && typeof val === 'object' ? [val] : [];
    for (const item of items) {
      if (item && item.name) {
        const state = (item.state || '').toLowerCase();
        if (state === 'active' && onActiveSprint) {
          onActiveSprint(item);
        }
        targetMap.set(item.name, {
          name: item.name,
          value: item.name,
          state: state || 'closed',
          startDate: item.startDate || null,
          endDate: item.endDate || null,
        });
      }
    }
  }
}

/**
 * Resolver: getProjects
 * Fetches accessible Jira projects for the project selector dropdown.
 */
resolver.define('getProjects', async (req) => {
  try {
    const contextProjectKey = req.context?.extension?.project?.key || null;
    const data = await fetchJira(route`/rest/api/3/project/search?maxResults=100&orderBy=name`);
    const projects = (data.values || []).map((proj) => ({
      id: proj.id,
      key: proj.key,
      name: proj.name,
      projectTypeKey: proj.projectTypeKey,
      avatarUrl: proj.avatarUrls ? proj.avatarUrls['24x24'] : null,
    }));
    return { success: true, projects, contextProjectKey };
  } catch (err) {
    return { success: false, error: err.message, projects: [] };
  }
});

/**
 * Resolver: getProjectFilterOptions
 * Fetches available filter options (assignable users, issue types, statuses) for a project.
 */
resolver.define('getProjectFilterOptions', async (req) => {
  const rawProjectKey = req.payload?.projectKey || req.context?.extension?.project?.key;
  if (!rawProjectKey) {
    return { success: false, error: 'Project key is required' };
  }

  try {
    const projectKey = assertProjectKey(rawProjectKey);
    const sprintFieldIds = await getSprintFieldIds();

    const [usersRes, statusesRes, prioritiesRes, suggestionsRes, sprintIssuesRes] =
      await Promise.allSettled([
        fetchJira(route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=100`),
        fetchJira(route`/rest/api/3/project/${projectKey}/statuses`),
        fetchJira(route`/rest/api/3/priority`),
        fetchJira(route`/rest/api/3/jql/autocompletedata/suggestions?fieldName=sprint`),
        fetchJira(route`/rest/api/3/search/jql`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jql: `project = "${jqlQuote(projectKey)}" AND sprint is not EMPTY ORDER BY updated DESC`,
            maxResults: 50,
            fields: ['summary', ...sprintFieldIds],
          }),
        }),
      ]);

    const assignees =
      usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)
        ? usersRes.value
            .filter((u) => u && u.displayName)
            .map((u) => ({
              label: u.displayName,
              value: u.displayName,
              accountId: u.accountId || null,
              avatarUrl: u.avatarUrls ? u.avatarUrls['24x24'] || u.avatarUrls['32x32'] : null,
            }))
        : [];

    const issueTypesMap = new Map();
    const statusesMap = new Map();

    if (statusesRes.status === 'fulfilled' && Array.isArray(statusesRes.value)) {
      statusesRes.value.forEach((issueTypeEntry) => {
        if (issueTypeEntry.name) {
          issueTypesMap.set(issueTypeEntry.name, {
            label: issueTypeEntry.name,
            value: issueTypeEntry.name,
          });
        }
        if (Array.isArray(issueTypeEntry.statuses)) {
          issueTypeEntry.statuses.forEach((st) => {
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

    // Discover Sprints from JQL suggestions & recent sprint issues (zero extra agile scopes required)
    const discoveredSprintsMap = new Map();

    if (
      suggestionsRes.status === 'fulfilled' &&
      Array.isArray(suggestionsRes.value?.results)
    ) {
      suggestionsRes.value.results.forEach((s) => {
        if (s.value) {
          discoveredSprintsMap.set(s.value, {
            name: s.displayName || s.value,
            value: s.value,
            state: 'sprint',
          });
        }
      });
    }

    if (
      sprintIssuesRes.status === 'fulfilled' &&
      Array.isArray(sprintIssuesRes.value?.issues)
    ) {
      sprintIssuesRes.value.issues.forEach((issue) => {
        collectSprintsFromFields(issue.fields, sprintFieldIds, discoveredSprintsMap);
      });
    }

    const activeNamedSprints = [];
    const futureNamedSprints = [];
    const closedNamedSprints = [];

    Array.from(discoveredSprintsMap.values()).forEach((s) => {
      const stateBadge =
        s.state === 'active'
          ? ' (Active)'
          : s.state === 'future'
          ? ' (Future)'
          : s.state === 'closed'
          ? ' (Closed)'
          : '';
      const option = {
        label: `${s.name}${stateBadge}`,
        value: s.value,
        state: s.state,
      };
      if (s.state === 'active') {
        activeNamedSprints.push(option);
      } else if (s.state === 'future') {
        futureNamedSprints.push(option);
      } else {
        closedNamedSprints.push(option);
      }
    });

    const sprintsOptions = [
      { label: 'Active Sprint (Current)', value: 'active' },
      ...activeNamedSprints,
      ...futureNamedSprints,
      ...closedNamedSprints,
      { label: 'All Sprints & Project Scope', value: 'all' },
      { label: 'All Future Sprints', value: 'future' },
      { label: 'All Closed Sprints', value: 'closed' },
      { label: 'Backlog Only (No Sprint)', value: 'backlog' },
    ];

    return {
      success: true,
      assignees: [
        { label: 'All Assignees', value: 'all' },
        { label: 'Unassigned', value: 'unassigned' },
        ...assignees,
      ],
      sprints: sprintsOptions,
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
      assignees: [{ label: 'All Assignees', value: 'all' }, { label: 'Unassigned', value: 'unassigned' }],
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
    console.warn('Could not fetch remote JQL autocomplete data, using fallback:', err.message);
    return {
      success: true,
      fallback: true,
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
 */
resolver.define('getProjectAnalytics', async (req) => {
  const {
    projectKey: payloadProjectKey,
    searchQuery,
    assignee,
    sprint,
    issueType,
    status,
    priority,
    customJql,
  } = req.payload || {};

  const rawProjectKey = payloadProjectKey || req.context?.extension?.project?.key;
  if (!rawProjectKey) {
    return { success: false, error: 'Project key is required' };
  }

  try {
    const projectKey = assertProjectKey(rawProjectKey);
    const storyPointFieldIds = await getStoryPointFieldIds();
    const sprintFieldIds = await getSprintFieldIds();

    // Build dynamic JQL query with strict escaping
    const jqlClauses = [`project = "${jqlQuote(projectKey)}"`];

    // Optional Keyword Search (only include issuekey = ... if input is a valid issue key)
    if (searchQuery && searchQuery.trim()) {
      const trimmedSearch = searchQuery.trim();
      const safeSearch = jqlQuote(trimmedSearch);
      if (ISSUE_KEY_REGEX.test(trimmedSearch)) {
        jqlClauses.push(
          `(summary ~ "${safeSearch}" OR text ~ "${safeSearch}" OR issuekey = "${safeSearch}")`
        );
      } else {
        jqlClauses.push(`(summary ~ "${safeSearch}" OR text ~ "${safeSearch}")`);
      }
    }

    // Assignee filter
    if (assignee && assignee !== 'all') {
      if (assignee === 'unassigned') {
        jqlClauses.push('assignee IS EMPTY');
      } else {
        jqlClauses.push(`assignee = "${jqlQuote(assignee)}"`);
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
        jqlClauses.push(`sprint = "${jqlQuote(sprint)}"`);
      }
    }

    // Issue Type filter
    if (issueType && issueType !== 'all') {
      jqlClauses.push(`issuetype = "${jqlQuote(issueType)}"`);
    }

    // Status filter
    if (status && status !== 'all') {
      jqlClauses.push(`status = "${jqlQuote(status)}"`);
    }

    // Priority filter
    if (priority && priority !== 'all') {
      jqlClauses.push(`priority = "${jqlQuote(priority)}"`);
    }

    // Custom JQL clause filter with balanced-parentheses check
    let customOrderBy = 'ORDER BY updated DESC';
    if (customJql && customJql.trim()) {
      let rawClause = customJql.trim();
      if (!hasBalancedParentheses(rawClause)) {
        return {
          success: false,
          error: 'Custom JQL contains unbalanced parentheses or quotes.',
        };
      }
      const orderMatch = rawClause.match(/\s+order\s+by\s+([a-zA-Z0-9_,\s"'[\]-]+)$/i);
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
      'parent',
      ...storyPointFieldIds,
      ...sprintFieldIds,
    ];

    // Fetch all matching issues using cursor pagination (up to 1,000 issues)
    let fetchResult;
    let sprintFallbackOccurred = false;
    try {
      fetchResult = await fetchAllIssues(jql, fieldsList, 1000);
      // If active sprint returned 0 issues (e.g. Kanban board or between sprints), fallback to project scope
      if (sprint === 'active' && fetchResult.issues.length === 0) {
        sprintFallbackOccurred = true;
        const fallbackClauses = jqlClauses.filter((c) => c !== 'sprint in openSprints()');
        const fallbackJql = `${fallbackClauses.join(' AND ')} ${customOrderBy}`;
        fetchResult = await fetchAllIssues(fallbackJql, fieldsList, 1000);
      }
    } catch (fetchErr) {
      if (sprint === 'active' && fetchErr.status === 400) {
        sprintFallbackOccurred = true;
        const fallbackClauses = jqlClauses.filter((c) => c !== 'sprint in openSprints()');
        const fallbackJql = `${fallbackClauses.join(' AND ')} ${customOrderBy}`;
        fetchResult = await fetchAllIssues(fallbackJql, fieldsList, 1000);
      } else {
        throw fetchErr;
      }
    }

    const { issues, totalFound, isTruncated } = fetchResult;
    const now = Date.now();

    // Discover active sprint name and collect all project sprints from issues
    let activeSprintName = null;
    let activeSprintStartDate = null;
    let activeSprintEndDate = null;
    const projectSprintsMap = new Map();

    for (const issue of issues) {
      collectSprintsFromFields(issue.fields, sprintFieldIds, projectSprintsMap, (activeItem) => {
        if (!activeSprintName) {
          activeSprintName = activeItem.name;
          activeSprintStartDate = activeItem.startDate || null;
          activeSprintEndDate = activeItem.endDate || null;
        }
      });
    }

    // Sprint Time Elapsed Percentage (null when no active sprint dates exist)
    let sprintTimeElapsedPercent = null;
    if (activeSprintStartDate && activeSprintEndDate) {
      const startMs = new Date(activeSprintStartDate).getTime();
      const endMs = new Date(activeSprintEndDate).getTime();
      const totalSprintMs = endMs - startMs;
      if (totalSprintMs > 0) {
        const elapsed = Math.max(0, now - startMs);
        sprintTimeElapsedPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalSprintMs) * 100)));
      }
    }

    // KPI Aggregations (consistent definitions across backend & frontend)
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
    let activeBugCount = 0;
    let bugStoryPoints = 0;
    let activeBugStoryPoints = 0;
    let totalCycleTimeMs = 0;
    let cycleTimeSampleCount = 0;

    const assigneeMap = {};
    const typeMap = {};
    const typePointsMap = {};
    const priorityMap = {};
    const statusMap = {};
    const staleIssues = [];

    issues.forEach((issue) => {
      const fields = issue.fields || {};
      const statusCategory = fields.status?.statusCategory?.key || 'new';
      const statusName = fields.status?.name || 'Unknown';
      const typeName = fields.issuetype?.name || 'Task';
      const priorityName = fields.priority?.name || 'Unprioritized';
      const assigneeName = fields.assignee?.displayName || 'Unassigned';
      const assigneeKey = fields.assignee?.accountId || assigneeName;

      // Single source of truth for Done: statusCategory === 'done'
      const isDone = statusCategory === 'done';
      const isInProgress = statusCategory === 'indeterminate';
      const isBug = BUG_TYPE_REGEX.test(typeName);

      // Status counters for issue volume
      if (isDone) completedCount += 1;
      else if (isInProgress) inProgressCount += 1;
      else toDoCount += 1;

      statusMap[statusName] = (statusMap[statusName] || 0) + 1;
      typeMap[typeName] = (typeMap[typeName] || 0) + 1;
      if (isBug) {
        bugCount += 1;
        if (!isDone) {
          activeBugCount += 1;
        }
      }
      priorityMap[priorityName] = (priorityMap[priorityName] || 0) + 1;

      // --- STORY POINTS CALCULATION ---
      const points = extractStoryPoints(fields, storyPointFieldIds);
      const isEstimatedPoints = points !== null && points !== undefined;
      const issuePoints = isEstimatedPoints ? points : 0;

      totalStoryPoints += issuePoints;
      typePointsMap[typeName] = (typePointsMap[typeName] || 0) + issuePoints;
      if (isBug) {
        bugStoryPoints += issuePoints;
        if (!isDone) {
          activeBugStoryPoints += issuePoints;
        }
      }
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

      // --- TIME TRACKING / HOURS CALCULATION (sum raw seconds, round once at end) ---
      const estSeconds = fields.timetracking?.originalEstimateSeconds || 0;
      const spentSeconds = fields.timetracking?.timeSpentSeconds || fields.timespent || 0;
      const remSeconds =
        fields.timetracking?.remainingEstimateSeconds ?? fields.timeestimate ?? 0;

      totalEstimatedSeconds += estSeconds;
      totalLoggedSeconds += spentSeconds;
      totalRemainingSeconds += remSeconds;

      if (!estSeconds && !isDone) {
        unestimatedHoursCount += 1;
      }

      // Count active unassigned issues
      if (!fields.assignee && !isDone) {
        unassignedCount += 1;
      }

      // Initialize team member record keyed by accountId (prevents display-name collisions)
      if (!assigneeMap[assigneeKey]) {
        assigneeMap[assigneeKey] = {
          name: assigneeName,
          accountId: fields.assignee?.accountId || null,
          avatarUrl: fields.assignee?.avatarUrls
            ? fields.assignee.avatarUrls['24x24'] || fields.assignee.avatarUrls['32x32']
            : null,
          totalIssues: 0,
          completedIssues: 0,
          inProgressIssues: 0,
          toDoIssues: 0,
          totalPoints: 0,
          completedPoints: 0,
          remainingPoints: 0,
          estSeconds: 0,
          spentSeconds: 0,
          remSeconds: 0,
        };
      }

      const member = assigneeMap[assigneeKey];
      member.totalIssues += 1;
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

      member.estSeconds += estSeconds;
      member.spentSeconds += spentSeconds;
      member.remSeconds += remSeconds;

      // Lead/Cycle time calculation (created to resolution)
      if (isDone && fields.resolutiondate && fields.created) {
        const createdMs = new Date(fields.created).getTime();
        const resolvedMs = new Date(fields.resolutiondate).getTime();
        if (resolvedMs >= createdMs) {
          totalCycleTimeMs += resolvedMs - createdMs;
          cycleTimeSampleCount += 1;
        }
      }

      // Unified Stale check: non-done issues inactive for >= STALE_DAYS_THRESHOLD (3 days)
      if (!isDone && fields.updated) {
        const updatedMs = new Date(fields.updated).getTime();
        const daysInactive = Math.floor((now - updatedMs) / (1000 * 60 * 60 * 24));
        if (daysInactive >= STALE_DAYS_THRESHOLD) {
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
    const ticketCompletionRate = totalIssues > 0 ? Math.round((completedCount / totalIssues) * 100) : 0;

    // Format Story Points
    totalStoryPoints = Math.round(totalStoryPoints * 10) / 10;
    completedStoryPoints = Math.round(completedStoryPoints * 10) / 10;
    const remainingStoryPoints = Math.round((totalStoryPoints - completedStoryPoints) * 10) / 10;
    const spCompletionRate =
      totalStoryPoints > 0
        ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
        : ticketCompletionRate;
    const completionRate = spCompletionRate;

    // Format Hours (rounded once from total seconds)
    const totalEstimatedHours = Math.round((totalEstimatedSeconds / 3600) * 10) / 10;
    const totalLoggedHours = Math.round((totalLoggedSeconds / 3600) * 10) / 10;
    const totalRemainingHours = Math.round((totalRemainingSeconds / 3600) * 10) / 10;

    const bugRatio = totalIssues > 0 ? Math.round((bugCount / totalIssues) * 100) : 0;
    const bugSpRatio =
      totalStoryPoints > 0 ? Math.round((bugStoryPoints / totalStoryPoints) * 100) : bugRatio;
    const avgCycleTimeDays =
      cycleTimeSampleCount > 0
        ? Math.round((totalCycleTimeMs / (cycleTimeSampleCount * 1000 * 60 * 60 * 24)) * 10) / 10
        : null;
    const activeContributorsCount = Object.values(assigneeMap).filter(
      (m) => m.name !== 'Unassigned'
    ).length;

    // Format Team Members list with capacity statuses
    const teamMembers = Object.values(assigneeMap).map((m) => {
      const estimatedHours = Math.round((m.estSeconds / 3600) * 10) / 10;
      const loggedHours = Math.round((m.spentSeconds / 3600) * 10) / 10;
      const remainingHours = Math.round((m.remSeconds / 3600) * 10) / 10;

      let capacityStatusPoints = 'Optimal';
      if (m.remainingPoints > 20 || m.totalPoints > 30) {
        capacityStatusPoints = 'Heavy';
      } else if (m.totalPoints === 0 && m.totalIssues > 0) {
        capacityStatusPoints = 'Unestimated';
      }

      let capacityStatusHours = 'Optimal';
      if (estimatedHours > 40) {
        capacityStatusHours = 'Heavy';
      } else if (estimatedHours === 0 && m.totalIssues > 0) {
        capacityStatusHours = 'Unestimated';
      }

      return {
        name: m.name,
        accountId: m.accountId,
        avatarUrl: m.avatarUrl,
        totalIssues: m.totalIssues,
        completedIssues: m.completedIssues,
        inProgressIssues: m.inProgressIssues,
        toDoIssues: m.toDoIssues,
        totalPoints: Math.round(m.totalPoints * 10) / 10,
        completedPoints: Math.round(m.completedPoints * 10) / 10,
        remainingPoints: Math.round(m.remainingPoints * 10) / 10,
        estimatedHours,
        loggedHours,
        remainingHours,
        completionRate: m.totalIssues > 0 ? Math.round((m.completedIssues / m.totalIssues) * 100) : 0,
        capacityStatusPoints,
        capacityStatusHours,
      };
    });

    teamMembers.sort((a, b) => b.totalIssues - a.totalIssues);

    const typeChartData = Object.keys(typeMap).map((name) => ({
      name,
      value: typeMap[name],
      storyPoints: Math.round((typePointsMap[name] || 0) * 10) / 10,
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

    staleIssues.sort((a, b) => b.daysInactive - a.daysInactive);

    // Epics map & Backlog accumulator
    const epicsMap = new Map();
    let orphanIssuesCount = 0;
    let orphanIssuesPoints = 0;

    let backlogTotalItems = 0;
    let backlogTotalPoints = 0;
    let backlogEstimatedCount = 0;
    let backlogStaleCount60 = 0;
    let backlogStaleCount90 = 0;
    const backlogAgeBrackets = {
      under30: 0,
      days30to60: 0,
      days60to90: 0,
      over90: 0,
    };
    const backlogTypeMap = {};

    // Normalized rawIssues for frontend consumption
    const rawIssues = issues.map((issue) => {
      const fields = issue.fields || {};
      const issuePoints = extractStoryPoints(fields, storyPointFieldIds);
      const estSec = fields.timetracking?.originalEstimateSeconds || 0;
      const spentSec = fields.timetracking?.timeSpentSeconds || fields.timespent || 0;

      const statusCategory = fields.status?.statusCategory?.key || 'new';
      const isDone = statusCategory === 'done';
      const isInProgress = statusCategory === 'indeterminate';
      const statusBucket = isDone ? 'Done' : isInProgress ? 'In Progress' : 'To Do';
      const typeName = fields.issuetype?.name || 'Task';
      const isBug = BUG_TYPE_REGEX.test(typeName);

      const updatedMs = fields.updated ? new Date(fields.updated).getTime() : now;
      const createdMs = fields.created ? new Date(fields.created).getTime() : now;
      const daysInactive = Math.floor((now - updatedMs) / (1000 * 60 * 60 * 24));
      const daysSinceCreation = Math.floor((now - createdMs) / (1000 * 60 * 60 * 24));
      const isStale = !isDone && daysInactive >= STALE_DAYS_THRESHOLD;

      // Sprint associations on issue
      const issueSprints = [];
      let hasActiveSprint = false;
      for (const fieldId of sprintFieldIds) {
        const val = fields[fieldId];
        const items = Array.isArray(val) ? val : val && typeof val === 'object' ? [val] : [];
        for (const s of items) {
          if (s && s.name) {
            const state = (s.state || '').toLowerCase();
            issueSprints.push({ name: s.name, state });
            if (state === 'active') hasActiveSprint = true;
          }
        }
      }
      const isBacklog = issueSprints.length === 0;

      // Parent & Epic association (ensure parent is an Epic, not a Story parent of a Sub-task)
      const isEpic = typeName.toLowerCase() === 'epic';
      const parentField = fields.parent;
      const parentType = (parentField?.fields?.issuetype?.name || '').toLowerCase();
      const parentIsEpic = !parentType || parentType === 'epic';
      const epicKey = isEpic ? issue.key : parentIsEpic ? parentField?.key || null : null;
      const epicSummary = isEpic
        ? (fields.summary || issue.key)
        : parentIsEpic
        ? (parentField?.fields?.summary || parentField?.key || null)
        : null;

      const pointsNum = issuePoints || 0;

      // Accumulate Epic aggregation
      if (epicKey) {
        if (!epicsMap.has(epicKey)) {
          epicsMap.set(epicKey, {
            key: epicKey,
            summary: epicSummary || epicKey,
            totalIssues: 0,
            doneIssues: 0,
            inProgressIssues: 0,
            toDoIssues: 0,
            totalPoints: 0,
            donePoints: 0,
            inProgressPoints: 0,
            toDoPoints: 0,
            bugCount: 0,
            contributors: new Set(),
            childIssues: [],
          });
        }
        const ep = epicsMap.get(epicKey);
        if (epicSummary && ep.summary === epicKey) ep.summary = epicSummary;
        if (!isEpic) {
          ep.totalIssues += 1;
          ep.totalPoints += pointsNum;
          if (isDone) {
            ep.doneIssues += 1;
            ep.donePoints += pointsNum;
          } else if (isInProgress) {
            ep.inProgressIssues += 1;
            ep.inProgressPoints += pointsNum;
          } else {
            ep.toDoIssues += 1;
            ep.toDoPoints += pointsNum;
          }
          if (isBug) ep.bugCount += 1;
          if (fields.assignee?.displayName) {
            ep.contributors.add(fields.assignee.displayName);
          }
          ep.childIssues.push({
            id: issue.id,
            key: issue.key,
            summary: fields.summary || '',
            type: typeName,
            status: fields.status?.name || '',
            statusCategory,
            assignee: fields.assignee?.displayName || 'Unassigned',
            storyPoints: issuePoints,
            isDone,
          });
        }
      } else if (!isEpic) {
        orphanIssuesCount += 1;
        orphanIssuesPoints += pointsNum;
      }

      // Accumulate Backlog metrics (tickets not in any sprint and not done, excluding Epics)
      if (isBacklog && !isDone && !isEpic) {
        backlogTotalItems += 1;
        backlogTotalPoints += pointsNum;
        if (issuePoints !== null && issuePoints !== undefined && issuePoints > 0) {
          backlogEstimatedCount += 1;
        }
        if (daysInactive >= 60) backlogStaleCount60 += 1;
        if (daysInactive >= 90) backlogStaleCount90 += 1;

        if (daysSinceCreation < 30) backlogAgeBrackets.under30 += 1;
        else if (daysSinceCreation < 60) backlogAgeBrackets.days30to60 += 1;
        else if (daysSinceCreation < 90) backlogAgeBrackets.days60to90 += 1;
        else backlogAgeBrackets.over90 += 1;

        backlogTypeMap[typeName] = (backlogTypeMap[typeName] || 0) + 1;
      }

      return {
        id: issue.id,
        key: issue.key,
        summary: fields.summary || '',
        type: typeName,
        isBug,
        status: fields.status?.name || '',
        statusCategory,
        statusBucket,
        priority: fields.priority?.name || 'Unprioritized',
        assignee: fields.assignee?.displayName || 'Unassigned',
        accountId: fields.assignee?.accountId || null,
        avatarUrl: fields.assignee?.avatarUrls
          ? fields.assignee.avatarUrls['32x32'] ||
            fields.assignee.avatarUrls['24x24'] ||
            fields.assignee.avatarUrls['48x48'] ||
            fields.assignee.avatarUrls['16x16']
          : null,
        storyPoints: issuePoints,
        estimatedHours: Math.round((estSec / 3600) * 10) / 10,
        loggedHours: Math.round((spentSec / 3600) * 10) / 10,
        created: fields.created,
        resolutiondate: fields.resolutiondate,
        updated: fields.updated,
        daysInactive,
        daysSinceCreation,
        isStale,
        sprints: issueSprints,
        hasActiveSprint,
        isBacklog,
        isEpic,
        epicKey,
        epicSummary,
        parent: parentField ? {
          key: parentField.key,
          summary: parentField.fields?.summary || parentField.key,
          type: parentField.fields?.issuetype?.name || '',
          status: parentField.fields?.status?.name || '',
        } : null,
      };
    });

    // Format Epics summary array
    const epicsList = Array.from(epicsMap.values()).map((ep) => {
      const compRate = ep.totalIssues > 0 ? Math.round((ep.doneIssues / ep.totalIssues) * 100) : 0;
      const spCompRate = ep.totalPoints > 0 ? Math.round((ep.donePoints / ep.totalPoints) * 100) : compRate;
      const isAtRisk = ep.bugCount >= 3 || (ep.inProgressIssues > 5 && compRate < 30);
      return {
        key: ep.key,
        summary: ep.summary,
        totalIssues: ep.totalIssues,
        doneIssues: ep.doneIssues,
        inProgressIssues: ep.inProgressIssues,
        toDoIssues: ep.toDoIssues,
        totalPoints: Math.round(ep.totalPoints * 10) / 10,
        donePoints: Math.round(ep.donePoints * 10) / 10,
        inProgressPoints: Math.round(ep.inProgressPoints * 10) / 10,
        toDoPoints: Math.round(ep.toDoPoints * 10) / 10,
        completionRate: compRate,
        spCompletionRate: spCompRate,
        isAtRisk,
        bugCount: ep.bugCount,
        contributorsCount: ep.contributors.size,
        contributors: Array.from(ep.contributors),
        childIssues: ep.childIssues,
      };
    });
    epicsList.sort((a, b) => b.totalPoints - a.totalPoints || b.totalIssues - a.totalIssues);

    const backlogReadinessScore =
      backlogTotalItems > 0 ? Math.round((backlogEstimatedCount / backlogTotalItems) * 100) : 100;

    const backlogTypeChartData = Object.keys(backlogTypeMap).map((name) => ({
      name,
      value: backlogTypeMap[name],
    }));

    const backlogSummary = {
      totalItems: backlogTotalItems,
      totalPoints: Math.round(backlogTotalPoints * 10) / 10,
      estimatedCount: backlogEstimatedCount,
      unestimatedCount: backlogTotalItems - backlogEstimatedCount,
      readinessScore: backlogReadinessScore,
      staleCount60: backlogStaleCount60,
      staleCount90: backlogStaleCount90,
      ageBrackets: backlogAgeBrackets,
      typeBreakdown: backlogTypeChartData,
    };

    // --- FIFO HISTORICAL SNAPSHOT VAULT SYNC ---
    const currentCompactSnapshot = buildCompactSnapshot({
      now,
      sprintScope: sprint || 'active',
      activeSprintName,
      totalStoryPoints,
      completedStoryPoints,
      inProgressStoryPoints: Math.round(inProgressStoryPoints * 10) / 10,
      toDoStoryPoints: Math.round(toDoStoryPoints * 10) / 10,
      spCompletionRate,
      ticketCompletionRate,
      totalIssues,
      completedCount,
      bugCount,
      activeBugCount,
      staleCount: staleIssues.length,
      avgCycleTimeDays,
      unestimatedPointsCount,
      orphanIssuesCount,
      backlogTotalPoints: Math.round(backlogTotalPoints * 10) / 10,
      backlogTotalItems,
      trigger: 'auto-daily',
    });

    const fifoHistory = await syncProjectFifoVault(
      projectKey,
      currentCompactSnapshot,
      rawIssues,
      { forceNew: false }
    );

    return {
      success: true,
      projectKey,
      appliedJql: jql,
      totalFound,
      isTruncated,
      sprintScope: sprint || 'active',
      activeSprintName,
      activeSprintStartDate,
      activeSprintEndDate,
      sprintTimeElapsedPercent,
      detectedSprints: Array.from(projectSprintsMap.values()),
      sprintFallbackOccurred,
      kpis: {
        totalIssues,
        completedCount,
        inProgressCount,
        toDoCount,
        completionRate,
        ticketCompletionRate,
        spCompletionRate,
        totalStoryPoints,
        completedStoryPoints,
        inProgressStoryPoints: Math.round(inProgressStoryPoints * 10) / 10,
        toDoStoryPoints: Math.round(toDoStoryPoints * 10) / 10,
        remainingStoryPoints,
        unestimatedPointsCount,
        totalEstimatedHours,
        totalLoggedHours,
        totalRemainingHours,
        unestimatedHoursCount,
        bugRatio,
        bugSpRatio,
        bugCount,
        activeBugCount,
        bugStoryPoints: Math.round(bugStoryPoints * 10) / 10,
        activeBugStoryPoints: Math.round(activeBugStoryPoints * 10) / 10,
        avgCycleTimeDays,
        activeContributorsCount,
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
      rawIssues,
      epics: epicsList,
      orphanIssuesCount,
      orphanIssuesPoints: Math.round(orphanIssuesPoints * 10) / 10,
      backlog: backlogSummary,
      fifoHistory,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to fetch project analytics',
    };
  }
});

/**
 * Resolver: updateIssueStatus
 * Transitions an issue to a new status strictly using the caller's permissions (`asUser()`).
 */
resolver.define('updateIssueStatus', async (req) => {
  const { issueKey: rawKey, statusName, transitionId } = req.payload || {};
  if (!rawKey || (!statusName && !transitionId)) {
    return { success: false, error: 'Issue key and target status are required.' };
  }

  try {
    const issueKey = assertIssueKey(rawKey);
    const transitionsData = await fetchJira(route`/rest/api/3/issue/${issueKey}/transitions`);
    const transitions = transitionsData.transitions || [];

    let matchedTransition = null;
    if (transitionId) {
      matchedTransition = transitions.find((t) => String(t.id) === String(transitionId));
    }

    if (!matchedTransition && statusName) {
      const targetLower = String(statusName).trim().toLowerCase();
      // Exact match on target status name or transition name (never fuzzy substring matching)
      matchedTransition = transitions.find(
        (t) =>
          (t.to?.name || '').toLowerCase() === targetLower ||
          (t.name || '').toLowerCase() === targetLower
      );
      // Secondary match on statusCategory key if user picked a bucket ('Done', 'In Progress', 'To Do')
      if (!matchedTransition) {
        const bucketToCategory = {
          done: 'done',
          'in progress': 'indeterminate',
          'to do': 'new',
        };
        const wantedCat = bucketToCategory[targetLower];
        if (wantedCat) {
          matchedTransition = transitions.find(
            (t) => (t.to?.statusCategory?.key || '').toLowerCase() === wantedCat
          );
        }
      }
    }

    if (!matchedTransition) {
      return {
        success: false,
        error: `No workflow transition available to "${statusName}".`,
      };
    }

    await fetchJira(route`/rest/api/3/issue/${issueKey}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: matchedTransition.id } }),
    });

    return {
      success: true,
      issueKey,
      newStatus: matchedTransition.to?.name || statusName,
      newStatusCategory: matchedTransition.to?.statusCategory?.key || null,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Resolver: updateIssueAssignee
 * Reassigns an issue to a given user strictly using the caller's permissions (`asUser()`).
 */
resolver.define('updateIssueAssignee', async (req) => {
  const { issueKey: rawKey, assigneeName, accountId } = req.payload || {};
  if (!rawKey) {
    return { success: false, error: 'Issue key is required.' };
  }

  try {
    const issueKey = assertIssueKey(rawKey);
    let targetAccountId = accountId;
    let resolvedDisplayName = assigneeName || 'Unassigned';
    let resolvedAvatarUrl = null;

    const isUnassign =
      accountId === null ||
      (typeof assigneeName === 'string' && assigneeName.trim().toLowerCase() === 'unassigned');

    if (isUnassign) {
      targetAccountId = null;
      resolvedDisplayName = 'Unassigned';
    } else if (!targetAccountId && assigneeName) {
      const cleanName = String(assigneeName).trim();
      // Do NOT wrap in encodeURIComponent inside `route` template (route already encodes)
      const users = await fetchJira(route`/rest/api/3/user/search?query=${cleanName}`);
      if (!Array.isArray(users) || users.length === 0) {
        return {
          success: false,
          error: `Could not find Jira user matching "${cleanName}".`,
        };
      }
      const exactUser =
        users.find((u) => (u.displayName || '').toLowerCase() === cleanName.toLowerCase()) ||
        users[0];
      targetAccountId = exactUser.accountId;
      resolvedDisplayName = exactUser.displayName || cleanName;
      resolvedAvatarUrl = exactUser.avatarUrls
        ? exactUser.avatarUrls['32x32'] || exactUser.avatarUrls['24x24']
        : null;
    }

    if (!isUnassign && !targetAccountId) {
      return {
        success: false,
        error: 'A valid user accountId or assigneeName is required.',
      };
    }

    await fetchJira(route`/rest/api/3/issue/${issueKey}/assignee`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: targetAccountId }),
    });

    return {
      success: true,
      issueKey,
      assignee: resolvedDisplayName,
      accountId: targetAccountId,
      avatarUrl: resolvedAvatarUrl,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * ============================================================================
 * FIFO HISTORICAL SNAPSHOT VAULT ENGINE (1-BY-1 CHRONOLOGICAL EVICTION)
 * ============================================================================
 */

function createDefaultFifoVault() {
  return {
    version: 1,
    maxCapacity: MAX_FIFO_SNAPSHOTS,
    totalEvictedCount: 0,
    lastEvictedReport: null,
    snapshots: [],
  };
}

function buildCompactSnapshot({
  now = Date.now(),
  sprintScope = 'active',
  activeSprintName = null,
  totalStoryPoints = 0,
  completedStoryPoints = 0,
  inProgressStoryPoints = 0,
  toDoStoryPoints = 0,
  spCompletionRate = 0,
  ticketCompletionRate = 0,
  totalIssues = 0,
  completedCount = 0,
  bugCount = 0,
  activeBugCount = 0,
  staleCount = 0,
  avgCycleTimeDays = null,
  unestimatedPointsCount = 0,
  orphanIssuesCount = 0,
  backlogTotalPoints = 0,
  backlogTotalItems = 0,
  trigger = 'auto-daily',
}) {
  const iso = new Date(now).toISOString();
  return {
    id: `snap_${now}_${Math.random().toString(36).slice(2, 6)}`,
    ts: now,
    dateLabel: iso.slice(0, 10),
    timeLabel: iso.slice(11, 19),
    sprintName:
      activeSprintName ||
      (sprintScope === 'all'
        ? 'All Project Scope'
        : sprintScope === 'backlog'
        ? 'Backlog Scope'
        : 'Active Sprint'),
    scope: sprintScope,
    totalSP: Math.round(totalStoryPoints * 10) / 10,
    doneSP: Math.round(completedStoryPoints * 10) / 10,
    inProgSP: Math.round(inProgressStoryPoints * 10) / 10,
    toDoSP: Math.round(toDoStoryPoints * 10) / 10,
    compRate: spCompletionRate,
    ticketCompRate: ticketCompletionRate,
    totalIssues,
    doneIssues: completedCount,
    bugCount,
    openBugs: activeBugCount,
    staleCount,
    cycleTime: avgCycleTimeDays,
    unestimated: unestimatedPointsCount,
    orphanCount: orphanIssuesCount,
    backlogSP: Math.round(backlogTotalPoints * 10) / 10,
    backlogItems: backlogTotalItems,
    trigger,
  };
}

/**
 * Reconstructs real historical weekly checkpoints from Jira issues' actual `created`
 * and `resolutiondate` timestamps when a project initializes its FIFO vault for the first time.
 */
function reconstructInitialJiraHistory(rawIssues = [], now = Date.now(), activeSprintName = null) {
  if (!Array.isArray(rawIssues) || rawIssues.length === 0) return [];

  const createdTimes = rawIssues
    .map((i) => (i.created ? new Date(i.created).getTime() : null))
    .filter((t) => t && !isNaN(t));

  if (createdTimes.length === 0) return [];

  const earliestMs = Math.min(...createdTimes);
  const spanMs = Math.max(0, now - earliestMs);
  if (spanMs < 24 * 3600 * 1000) return [];

  // Create up to 4 real historical checkpoints between earliest issue creation and 1 day ago
  const steps = 4;
  const historySnaps = [];

  for (let step = 1; step <= steps; step++) {
    const chkMs = Math.round(earliestMs + (spanMs * step) / (steps + 1));
    const existingAtChk = rawIssues.filter((i) => {
      const cMs = i.created ? new Date(i.created).getTime() : now;
      return cMs <= chkMs;
    });
    if (existingAtChk.length === 0) continue;

    let totalSP = 0;
    let doneSP = 0;
    let inProgSP = 0;
    let toDoSP = 0;
    let doneIssues = 0;
    let bugCount = 0;
    let openBugs = 0;

    existingAtChk.forEach((i) => {
      const sp = Number(i.storyPoints) || 0;
      totalSP += sp;
      const resMs = i.resolutiondate ? new Date(i.resolutiondate).getTime() : null;
      const wasDoneAtChk = i.statusCategory === 'done' && resMs !== null && resMs <= chkMs;

      if (wasDoneAtChk) {
        doneIssues += 1;
        doneSP += sp;
      } else if (i.statusCategory === 'indeterminate') {
        inProgSP += sp;
      } else {
        toDoSP += sp;
      }

      if (i.isBug) {
        bugCount += 1;
        if (!wasDoneAtChk) openBugs += 1;
      }
    });

    const totalIssues = existingAtChk.length;
    const ticketCompRate = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;
    const spCompRate = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : ticketCompRate;

    historySnaps.push(
      buildCompactSnapshot({
        now: chkMs,
        sprintScope: 'all',
        activeSprintName: activeSprintName || 'Historical Baseline',
        totalStoryPoints: totalSP,
        completedStoryPoints: doneSP,
        inProgressStoryPoints: inProgSP,
        toDoStoryPoints: toDoSP,
        spCompletionRate: spCompRate,
        ticketCompletionRate: ticketCompRate,
        totalIssues,
        completedCount: doneIssues,
        bugCount,
        activeBugCount: openBugs,
        staleCount: 0,
        avgCycleTimeDays: null,
        unestimatedPointsCount: 0,
        orphanIssuesCount: totalIssues,
        backlogTotalPoints: 0,
        backlogTotalItems: 0,
        trigger: 'jira-history',
      })
    );
  }

  return historySnaps;
}

const inMemoryFifoVaultCache = new Map();
const projectAnchorIssueCache = new Map();

async function resolveProjectAnchorIssueKey(projectKey, candidateIssues = []) {
  if (projectAnchorIssueCache.has(projectKey)) {
    return projectAnchorIssueCache.get(projectKey);
  }

  // If we already have candidate issues in memory, pick the lowest issue number deterministically
  if (Array.isArray(candidateIssues) && candidateIssues.length > 0) {
    const sortedKeys = candidateIssues
      .map((i) => i.key)
      .filter(Boolean)
      .sort((a, b) => {
        const numA = Number((a.split('-')[1] || '0').replace(/\D/g, '')) || 0;
        const numB = Number((b.split('-')[1] || '0').replace(/\D/g, '')) || 0;
        return numA - numB;
      });
    if (sortedKeys[0]) {
      projectAnchorIssueCache.set(projectKey, sortedKeys[0]);
      return sortedKeys[0];
    }
  }

  // Otherwise query the earliest created issue in the project (maxResults: 1)
  try {
    const jql = `project = "${jqlQuote(projectKey)}" ORDER BY created ASC`;
    const searchData = await fetchJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ jql, maxResults: 1, fields: ['summary'] }),
    });
    const firstKey = searchData?.issues?.[0]?.key || null;
    if (firstKey) {
      projectAnchorIssueCache.set(projectKey, firstKey);
    }
    return firstKey;
  } catch (err) {
    return null;
  }
}

async function readProjectFifoVault(projectKey, candidateIssues = []) {
  try {
    const anchorKey = await resolveProjectAnchorIssueKey(projectKey, candidateIssues);
    if (!anchorKey) {
      return inMemoryFifoVaultCache.get(projectKey) || createDefaultFifoVault();
    }

    const res = await api
      .asUser()
      .requestJira(route`/rest/api/3/issue/${anchorKey}/properties/${FIFO_VAULT_PROPERTY_KEY}`);
    if (!res.ok) {
      return inMemoryFifoVaultCache.get(projectKey) || createDefaultFifoVault();
    }
    const text = await res.text();
    if (!text) return inMemoryFifoVaultCache.get(projectKey) || createDefaultFifoVault();
    const parsed = JSON.parse(text);
    const val = parsed?.value;
    if (!val || !Array.isArray(val.snapshots)) {
      return inMemoryFifoVaultCache.get(projectKey) || createDefaultFifoVault();
    }
    const loadedVault = {
      version: val.version || 1,
      maxCapacity: MAX_FIFO_SNAPSHOTS,
      totalEvictedCount: Number(val.totalEvictedCount) || 0,
      lastEvictedReport: val.lastEvictedReport || null,
      snapshots: val.snapshots,
    };
    inMemoryFifoVaultCache.set(projectKey, loadedVault);
    return loadedVault;
  } catch (err) {
    return inMemoryFifoVaultCache.get(projectKey) || createDefaultFifoVault();
  }
}

async function writeProjectFifoVault(projectKey, vault, candidateIssues = []) {
  inMemoryFifoVaultCache.set(projectKey, vault);
  try {
    const anchorKey = await resolveProjectAnchorIssueKey(projectKey, candidateIssues);
    if (!anchorKey) return false;

    await api
      .asUser()
      .requestJira(route`/rest/api/3/issue/${anchorKey}/properties/${FIFO_VAULT_PROPERTY_KEY}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(vault),
      });
    return true;
  } catch (err) {
    console.warn('Could not persist FIFO snapshot vault:', err.message);
    return false;
  }
}

/**
 * Enforces the strict 1-by-1 FIFO Rolling Window.
 * Sorts chronologically ascending so `snapshots[0]` is always the oldest report.
 * If capacity (`effectiveMax`) or byte limit (`MAX_FIFO_BYTES`) is exceeded,
 * unhooks ONLY the single oldest chronological report (`snapshots.shift()`) one at a time.
 */
function enforceFifoRollingWindow(vault, effectiveMax = MAX_FIFO_SNAPSHOTS) {
  vault.snapshots.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const evictedNow = [];

  while (
    vault.snapshots.length > effectiveMax ||
    (vault.snapshots.length > 1 &&
      Buffer.byteLength(JSON.stringify(vault), 'utf8') > MAX_FIFO_BYTES)
  ) {
    const oldestReport = vault.snapshots.shift();
    if (!oldestReport) break;
    vault.totalEvictedCount = (vault.totalEvictedCount || 0) + 1;
    const evictedMeta = {
      id: oldestReport.id,
      dateLabel: oldestReport.dateLabel,
      timeLabel: oldestReport.timeLabel,
      sprintName: oldestReport.sprintName,
      totalSP: oldestReport.totalSP,
      doneSP: oldestReport.doneSP,
      compRate: oldestReport.compRate,
      evictedAt: new Date().toISOString(),
    };
    vault.lastEvictedReport = evictedMeta;
    evictedNow.push(evictedMeta);
  }

  return evictedNow;
}

function formatFifoHistoryResponse(vault, evictedNow = []) {
  const byteSize = Buffer.byteLength(JSON.stringify(vault), 'utf8');
  const usedCount = vault.snapshots.length;
  return {
    snapshots: vault.snapshots,
    usedCount,
    maxCapacity: MAX_FIFO_SNAPSHOTS,
    usagePct: Math.min(100, Math.round((usedCount / MAX_FIFO_SNAPSHOTS) * 100)),
    byteSize,
    maxBytes: MAX_FIFO_BYTES,
    byteUsagePct: Math.min(100, Math.round((byteSize / MAX_FIFO_BYTES) * 100)),
    totalEvictedCount: vault.totalEvictedCount || 0,
    lastEvictedReport: vault.lastEvictedReport || null,
    evictedNow,
  };
}

async function syncProjectFifoVault(
  projectKey,
  newSnapshot,
  rawIssues = [],
  { forceNew = false, effectiveMax = MAX_FIFO_SNAPSHOTS } = {}
) {
  const vault = await readProjectFifoVault(projectKey, rawIssues);

  // If vault is completely empty on first run, reconstruct initial checkpoints from real Jira issue dates
  if (vault.snapshots.length === 0 && Array.isArray(rawIssues) && rawIssues.length > 0) {
    const initialHistory = reconstructInitialJiraHistory(
      rawIssues,
      newSnapshot.ts,
      newSnapshot.sprintName
    );
    vault.snapshots.push(...initialHistory);
  }

  vault.snapshots.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  if (!forceNew && vault.snapshots.length > 0) {
    const latest = vault.snapshots[vault.snapshots.length - 1];
    if (
      latest.dateLabel === newSnapshot.dateLabel &&
      latest.trigger !== 'manual-capture' &&
      latest.trigger !== 'jira-history'
    ) {
      // Update today's auto-daily snapshot in place
      vault.snapshots[vault.snapshots.length - 1] = {
        ...newSnapshot,
        id: latest.id,
      };
    } else {
      vault.snapshots.push(newSnapshot);
    }
  } else {
    vault.snapshots.push(newSnapshot);
  }

  const evictedNow = enforceFifoRollingWindow(vault, effectiveMax);
  await writeProjectFifoVault(projectKey, vault, rawIssues);

  return formatFifoHistoryResponse(vault, evictedNow);
}

/**
 * Resolver: captureFifoSnapshot
 * Manually captures a new point-in-time snapshot into the project's FIFO queue.
 * If `simulateFullQueue` is true, sets `effectiveMax` to the current length so that adding
 * the new snapshot immediately demonstrates unhooking ONLY the single oldest chronological report!
 */
resolver.define('captureFifoSnapshot', async (req) => {
  const { projectKey: rawProjectKey, snapshotData, simulateFullQueue = false } = req.payload || {};
  if (!rawProjectKey) {
    return { success: false, error: 'Project key is required.' };
  }

  try {
    const projectKey = assertProjectKey(rawProjectKey);
    const vault = await readProjectFifoVault(projectKey);
    const now = Date.now();

    const manualSnap = buildCompactSnapshot({
      now,
      sprintScope: snapshotData?.sprintScope || 'active',
      activeSprintName: snapshotData?.activeSprintName || 'Manual Snapshot',
      totalStoryPoints: Number(snapshotData?.totalStoryPoints) || 0,
      completedStoryPoints: Number(snapshotData?.completedStoryPoints) || 0,
      inProgressStoryPoints: Number(snapshotData?.inProgressStoryPoints) || 0,
      toDoStoryPoints: Number(snapshotData?.toDoStoryPoints) || 0,
      spCompletionRate: Number(snapshotData?.spCompletionRate) || 0,
      ticketCompletionRate: Number(snapshotData?.ticketCompletionRate) || 0,
      totalIssues: Number(snapshotData?.totalIssues) || 0,
      completedCount: Number(snapshotData?.completedCount) || 0,
      bugCount: Number(snapshotData?.bugCount) || 0,
      activeBugCount: Number(snapshotData?.activeBugCount) || 0,
      staleCount: Number(snapshotData?.staleCount) || 0,
      avgCycleTimeDays: snapshotData?.avgCycleTimeDays ?? null,
      unestimatedPointsCount: Number(snapshotData?.unestimatedPointsCount) || 0,
      orphanIssuesCount: Number(snapshotData?.orphanIssuesCount) || 0,
      backlogTotalPoints: Number(snapshotData?.backlogTotalPoints) || 0,
      backlogTotalItems: Number(snapshotData?.backlogTotalItems) || 0,
      trigger: simulateFullQueue ? 'fifo-rollover-test' : 'manual-capture',
    });

    const previousLength = vault.snapshots.length;
    vault.snapshots.push(manualSnap);

    // If testing FIFO rollover on a non-full queue, cap at previousLength so adding 1 unhooks 1 oldest
    const effectiveMax =
      simulateFullQueue && previousLength > 0 ? previousLength : MAX_FIFO_SNAPSHOTS;

    const evictedNow = enforceFifoRollingWindow(vault, effectiveMax);
    await writeProjectFifoVault(projectKey, vault);

    return {
      success: true,
      fifoHistory: formatFifoHistoryResponse(vault, evictedNow),
    };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to capture snapshot.' };
  }
});

/**
 * Resolver: shiftOldestFifoSnapshot
 * Manually unhooks ONLY the single oldest chronological report (`snapshots[0]`) from the FIFO queue.
 */
resolver.define('shiftOldestFifoSnapshot', async (req) => {
  const { projectKey: rawProjectKey } = req.payload || {};
  if (!rawProjectKey) {
    return { success: false, error: 'Project key is required.' };
  }

  try {
    const projectKey = assertProjectKey(rawProjectKey);
    const vault = await readProjectFifoVault(projectKey);
    if (vault.snapshots.length <= 1) {
      return {
        success: false,
        error: 'At least 1 baseline snapshot is kept in the vault.',
      };
    }

    // Target strictly the current length minus 1 so enforceFifoRollingWindow shifts exactly 1 oldest item
    const evictedNow = enforceFifoRollingWindow(vault, vault.snapshots.length - 1);
    await writeProjectFifoVault(projectKey, vault);

    return {
      success: true,
      fifoHistory: formatFifoHistoryResponse(vault, evictedNow),
    };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to unhook oldest snapshot.' };
  }
});

export const handler = resolver.getDefinitions();
