/**
 * =============================================================================
 * JIRA MOCK DATA SEEDER
 * =============================================================================
 * Αυτό το script δημιουργεί ~50 ρεαλιστικά tickets στο Jira σου μέσω REST API v3.
 *
 * Πώς να το τρέξεις:
 *   1. Αντέγραψε το .env.example σε .env και συμπλήρωσε τα στοιχεία σου.
 *   2. Τρέξε: npm install
 *   3. Τρέξε: npm run seed
 *
 * Για dry-run (δες τι θα δημιουργηθεί χωρίς να στείλεις στο Jira):
 *   npm run seed:dry
 * =============================================================================
 */

// Φορτώνουμε τις μεταβλητές περιβάλλοντος από το .env αρχείο
require("dotenv").config();

const axios = require("axios");

// ---------------------------------------------------------------------------
// CONFIGURATION — Διαβάζουμε όλα από το .env (ποτέ hardcoded credentials!)
// ---------------------------------------------------------------------------
const JIRA_DOMAIN = process.env.JIRA_DOMAIN; // π.χ. mycompany.atlassian.net
const JIRA_EMAIL = process.env.JIRA_EMAIL; // το email σου στο Jira
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN; // το API token από id.atlassian.com
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || "JAPA";

// Έλεγχος ότι υπάρχουν όλες οι απαραίτητες μεταβλητές
if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error(
    "❌ Λείπουν μεταβλητές περιβάλλοντος! Σιγουρέψου ότι έχεις .env με:"
  );
  console.error("   JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN");
  process.exit(1);
}

// Ελέγχουμε αν τρέχουμε σε dry-run mode (δεν στέλνει requests στο Jira)
const IS_DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// AXIOS CLIENT — Configured με Basic Auth (email + API token)
// ---------------------------------------------------------------------------
const jira = axios.create({
  baseURL: `https://${JIRA_DOMAIN}/rest/api/3`,
  headers: {
    Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64")}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
  },
});

// ---------------------------------------------------------------------------
// MOCK DATA POOLS
// ---------------------------------------------------------------------------

const STORY_TITLES = [
  "Υλοποίηση dashboard γραφημάτων sprint velocity",
  "Δημιουργία αναφοράς burndown chart",
  "Σελίδα διαχείρισης χρηστών",
  "Φίλτρο αναζήτησης tickets ανά assignee",
  "Export δεδομένων σε CSV format",
  "Σύνδεση με Jira REST API v3",
  "Προβολή ιστορικού αλλαγών ticket",
  "Responsive design για mobile συσκευές",
  "Φόρμα δημιουργίας νέου sprint",
  "Γράφημα κατανομής story points ανά μέλος",
  "Notification system για αλλαγές status",
  "Dark mode support για το UI",
  "Σύνδεση με Google Calendar για deadlines",
  "Αναφορά ανοιχτών bugs ανά sprint",
  "Προφίλ χρήστη με στατιστικά απόδοσης",
  "Αυτόματη ανάθεση tickets βάσει workload",
  "Επισκόπηση τρέχοντος sprint σε Kanban view",
  "Γράφημα cumulative flow diagram",
  "Αναζήτηση tickets με full-text search",
  "Ενσωμάτωση Slack notifications",
];

const BUG_TITLES = [
  "Το burndown chart δεν ενημερώνεται σε realtime",
  "Λανθασμένος υπολογισμός story points σε κλειστά sprints",
  "Crash κατά την εξαγωγή αναφοράς σε PDF",
  "Τα φίλτρα δεν αποθηκεύονται μετά από refresh",
  "Λείπει pagination στη λίστα tickets",
  "Σφάλμα 401 κατά την ανανέωση token",
  "Duplicate tickets εμφανίζονται στο dashboard",
  "Λάθος χρώμα priority badge σε Low issues",
  "Η σελίδα αναφοράς κρασάρει σε Safari",
  "Χρονικά timestamps εμφανίζονται σε UTC αντί local time",
  "Search επιστρέφει κενά αποτελέσματα για Unicode χαρακτήρες",
  "Modal δεν κλείνει με ESC key",
  "Story points αδυναμία αποθήκευσης για τιμή 0",
];

const TASK_TITLES = [
  "Γράψιμο unit tests για το API module",
  "Refactoring του authentication middleware",
  "Ενημέρωση documentation στο README",
  "Setup CI/CD pipeline με GitHub Actions",
  "Αναβάθμιση axios σε τελευταία έκδοση",
  "Code review για το sprint analytics module",
  "Database indexing για βελτίωση performance",
  "Security audit του REST API",
  "Δημιουργία Storybook components",
  "Load testing με k6",
  "Μετάφραση UI σε Ελληνικά",
  "Καθαρισμός deprecated dependencies",
  "Ρύθμιση ESLint + Prettier κανόνων",
  "Deployment στο production environment",
  "Monitoring setup με Datadog",
];

const STORY_POINTS_VALUES = [null, null, 1, 1, 2, 2, 3, 3, 3, 5, 5, 8, 8, 13];
const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"];
const PRIORITY_WEIGHTS = [0.05, 0.25, 0.45, 0.20, 0.05];
const STATUSES = ["To Do", "In Progress", "Done"];
const STATUS_WEIGHTS = [0.35, 0.40, 0.25];

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

function randomChoice(arr, weights = null) {
  if (!weights) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  const random = Math.random();
  let cumulative = 0;
  for (let i = 0; i < arr.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) return arr[i];
  }
  return arr[arr.length - 1];
}

function getRandomTitle(issueType) {
  switch (issueType) {
    case "Story": return randomChoice(STORY_TITLES);
    case "Bug":   return randomChoice(BUG_TITLES);
    case "Task":  return randomChoice(TASK_TITLES);
    default:      return "Γενικό Task";
  }
}

function getRandomStoryPoints() {
  return randomChoice(STORY_POINTS_VALUES);
}

function buildDescription(issueType, priority) {
  const descriptions = {
    Story: [
      "Ως χρήστης της εφαρμογής, θέλω να μπορώ να βλέπω τα δεδομένα μου σε γραφική μορφή ώστε να κατανοώ εύκολα την πρόοδο του sprint.",
      "Υλοποίηση νέας λειτουργικότητας σύμφωνα με τις απαιτήσεις του Product Owner. Απαιτείται ανασκόπηση κώδικα πριν το merge.",
      "Αυτή η user story αφορά τη βελτίωση της εμπειρίας χρήστη στη διαχείριση εργασιών.",
    ],
    Bug: [
      `Αναφορά σφάλματος - Προτεραιότητα: ${priority}. Το πρόβλημα εντοπίστηκε σε production environment. Απαιτεί άμεση διόρθωση.`,
      "Αναπαραγωγή: 1) Άνοιξε το dashboard 2) Κάνε filter 3) Παρατήρησε το σφάλμα. Expected: Σωστή συμπεριφορά. Actual: Crash.",
      "Αυτό το bug επηρεάζει τους τελικούς χρήστες. Χρειάζεται hotfix ή θα συμπεριληφθεί στο επόμενο sprint;",
    ],
    Task: [
      "Τεχνική εργασία χωρίς άμεσο business value, αλλά απαραίτητη για τη συντήρηση και βελτίωση του codebase.",
      "Αυτή η εργασία αποτελεί μέρος του technical debt cleanup. Εκτιμώμενη διάρκεια: 1-2 ημέρες.",
      "DevOps/Infrastructure task. Συντονισμός με την ομάδα για deployment window.",
    ],
  };

  const text = randomChoice(descriptions[issueType] || descriptions["Task"]);
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

// ---------------------------------------------------------------------------
// JIRA API FUNCTIONS
// ---------------------------------------------------------------------------

async function getIssueTypes() {
  console.log("📋 Ανάκτηση issue types από το project...");
  const response = await jira.get(
    `/issue/createmeta?projectKeys=${PROJECT_KEY}&expand=projects.issuetypes.fields`
  );
  const project = response.data.projects?.[0];
  if (!project) {
    throw new Error(`Δεν βρέθηκε το project: ${PROJECT_KEY}`);
  }
  const typeMap = {};
  for (const issueType of project.issuetypes) {
    typeMap[issueType.name] = issueType.id;
  }
  console.log(`   Βρέθηκαν: ${Object.keys(typeMap).join(", ")}`);
  return typeMap;
}

async function getTransitions(issueKey) {
  const response = await jira.get(`/issue/${issueKey}/transitions`);
  return response.data.transitions;
}

async function transitionIssue(issueKey, targetStatus) {
  const transitions = await getTransitions(issueKey);
  const transition = transitions.find(
    (t) => t.to.name.toLowerCase() === targetStatus.toLowerCase()
  );
  if (!transition) {
    console.log(`   ⚠️  Δεν βρέθηκε transition για "${targetStatus}" σε ${issueKey}`);
    return;
  }
  await jira.post(`/issue/${issueKey}/transitions`, {
    transition: { id: transition.id },
  });
}

async function getStoryPointsFieldId() {
  const response = await jira.get(
    `/issue/createmeta?projectKeys=${PROJECT_KEY}&issuetypeNames=Story&expand=projects.issuetypes.fields`
  );
  const fields = response.data.projects?.[0]?.issuetypes?.[0]?.fields || {};
  for (const [fieldId, fieldMeta] of Object.entries(fields)) {
    const name = (fieldMeta.name || "").toLowerCase();
    if (name.includes("story point") || name.includes("story_point")) {
      console.log(`   Story Points field ID: ${fieldId} ("${fieldMeta.name}")`);
      return fieldId;
    }
  }
  console.log("   ⚠️  Χρησιμοποιούμε fallback field: 'story_points'");
  return "story_points";
}

async function createIssue(issueData, storyPointsField, issueTypeIds) {
  const { title, issueType, priority, storyPoints } = issueData;
  const issueTypeId = issueTypeIds[issueType];

  const payload = {
    fields: {
      project: { key: PROJECT_KEY },
      summary: title,
      description: buildDescription(issueType, priority),
      issuetype: issueTypeId ? { id: issueTypeId } : { name: issueType || "Task" },
      priority: { name: priority },
    },
  };

  if (storyPoints !== null && storyPoints !== undefined) {
    payload.fields[storyPointsField] = storyPoints;
  }

  const response = await jira.post("/issue", payload);
  return response.data;
}

// ---------------------------------------------------------------------------
// MOCK DATA GENERATOR
// ---------------------------------------------------------------------------

function generateMockTickets(count = 50) {
  const tickets = [];
  const issueTypeDistribution = [
    { type: "Story", weight: 0.40 },
    { type: "Task",  weight: 0.35 },
    { type: "Bug",   weight: 0.25 },
  ];

  for (let i = 0; i < count; i++) {
    const issueType = randomChoice(
      issueTypeDistribution.map((d) => d.type),
      issueTypeDistribution.map((d) => d.weight)
    );
    const priority     = randomChoice(PRIORITIES, PRIORITY_WEIGHTS);
    const targetStatus = randomChoice(STATUSES, STATUS_WEIGHTS);

    let storyPoints = getRandomStoryPoints();
    if (issueType === "Bug") {
      if (Math.random() < 0.4) storyPoints = null;
      if (storyPoints > 8) storyPoints = randomChoice([3, 5, 8]);
    }

    tickets.push({ title: getRandomTitle(issueType), issueType, priority, storyPoints, targetStatus });
  }
  return tickets;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚀 Jira Mock Data Seeder");
  console.log("=".repeat(50));
  console.log(`📌 Project: ${PROJECT_KEY}`);
  console.log(`🌐 Domain:  ${JIRA_DOMAIN}`);
  console.log(`📧 Email:   ${JIRA_EMAIL}`);
  if (IS_DRY_RUN) console.log("🧪 MODE: DRY RUN");
  console.log("=".repeat(50));

  const tickets = generateMockTickets(50);

  if (IS_DRY_RUN) {
    console.log("\n📋 TICKETS ΠΟΥ ΘΑ ΔΗΜΙΟΥΡΓΗΘΟΥΝ:\n");
    tickets.forEach((ticket, i) => {
      const sp = ticket.storyPoints !== null ? `SP:${ticket.storyPoints}` : "SP:---";
      console.log(`${String(i + 1).padStart(2, "0")}. [${ticket.issueType.padEnd(5)}] [${ticket.priority.padEnd(7)}] [${ticket.targetStatus.padEnd(11)}] [${sp.padEnd(6)}] ${ticket.title}`);
    });
    console.log(`\n✅ Σύνολο: ${tickets.length} tickets`);
    return;
  }

  let issueTypeIds, storyPointsField;
  try {
    issueTypeIds = await getIssueTypes();
    console.log("🔍 Εύρεση Story Points field...");
    storyPointsField = await getStoryPointsFieldId();
  } catch (error) {
    console.error("\n❌ Σφάλμα κατά την αρχικοποίηση:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Body:   ${JSON.stringify(error.response.data)}`);
      if (error.response.status === 401) console.error("   💡 Έλεγξε email & API token στο .env");
      if (error.response.status === 404) console.error("   💡 Έλεγξε domain & project key στο .env");
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }

  console.log("\n🏗️  Δημιουργία tickets...\n");
  const stats = { created: 0, failed: 0, byType: {}, byStatus: {} };

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const num = String(i + 1).padStart(2, "0");
    try {
      const created = await createIssue(ticket, storyPointsField, issueTypeIds);
      const key = created.key;
      if (ticket.targetStatus !== "To Do") {
        await transitionIssue(key, ticket.targetStatus);
      }
      const sp = ticket.storyPoints !== null ? `SP:${ticket.storyPoints}` : "SP:---";
      console.log(`✅ ${num}/50 [${key}] [${ticket.issueType.padEnd(5)}] [${ticket.priority.padEnd(7)}] → ${ticket.targetStatus.padEnd(11)} | ${sp} | ${ticket.title}`);
      stats.created++;
      stats.byType[ticket.issueType]   = (stats.byType[ticket.issueType] || 0) + 1;
      stats.byStatus[ticket.targetStatus] = (stats.byStatus[ticket.targetStatus] || 0) + 1;
      // Rate limiting: 300ms delay μεταξύ requests
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      stats.failed++;
      const errMsg = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message;
      console.error(`❌ ${num}/50 Αποτυχία: "${ticket.title}" — ${errMsg}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:");
  console.log(`   ✅ Δημιουργήθηκαν: ${stats.created}`);
  if (stats.failed > 0) console.log(`   ❌ Απέτυχαν:       ${stats.failed}`);
  console.log("\n   Ανά τύπο:   " + Object.entries(stats.byType).map(([k, v]) => `${k}:${v}`).join(" | "));
  console.log("   Ανά status: " + Object.entries(stats.byStatus).map(([k, v]) => `${k}:${v}`).join(" | "));
  console.log("=".repeat(50));
  console.log(`\n🎉 Ολοκληρώθηκε! https://${JIRA_DOMAIN}/jira/software/projects/${PROJECT_KEY}/boards`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
