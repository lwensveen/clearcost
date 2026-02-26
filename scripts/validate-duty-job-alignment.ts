import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const dutiesTasksDir = join(repoRoot, 'apps', 'api', 'src', 'modules', 'tasks', 'duties');
const coverageFile = join(repoRoot, 'apps', 'api', 'src', 'lib', 'cron', 'commands', 'coverage.ts');
const dailyWorkflowFile = join(repoRoot, '.github', 'workflows', 'cron-daily-http.yml');
const INTERNAL_DUTY_PATH_PREFIX = '/internal/cron/import/duties/';
const MANUAL_OFFICIAL_DUTY_JOBS = new Set(['duties:eu-mfn-official', 'duties:eu-fta-official']);
const BN_KH_LA_MM_SLUGS = ['bn', 'kh', 'la', 'mm'] as const;

type DutyRouteMapping = {
  path: string;
  job: string;
  file: string;
};

type WorkflowDutyStep = {
  name: string;
  path: string;
  labels: string[];
};

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
      out.push(...listFiles(full));
      continue;
    }
    if (stat.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function expandKnownTemplate(template: string): string[] {
  if (!template.includes('${')) return [template];
  if (template.includes('${country.slug}')) {
    return BN_KH_LA_MM_SLUGS.map((slug) => template.replaceAll('${country.slug}', slug));
  }
  return [];
}

function pairExpandedPathsAndJobs(paths: ReadonlyArray<string>, jobs: ReadonlyArray<string>) {
  if (paths.length === 0 || jobs.length === 0) return [] as Array<{ path: string; job: string }>;
  if (paths.length === jobs.length) return paths.map((path, index) => ({ path, job: jobs[index] }));
  if (paths.length === 1) return jobs.map((job) => ({ path: paths[0], job }));
  if (jobs.length === 1) return paths.map((path) => ({ path, job: jobs[0] }));
  return [] as Array<{ path: string; job: string }>;
}

function extractDutyRouteMappings(files: ReadonlyArray<string>): {
  mappings: DutyRouteMapping[];
  unresolvedTemplates: string[];
} {
  const mappings: DutyRouteMapping[] = [];
  const unresolvedTemplates: string[] = [];
  const routeRegex =
    /app\.post\(\s*(?<pathQuote>['"`])(?<path>\/cron\/import\/duties\/[^'"`]+)\k<pathQuote>[\s\S]*?job:\s*(?<jobQuote>['"`])(?<job>duties:[^'"`]+)\k<jobQuote>/g;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(routeRegex)) {
      const rawPath = match.groups?.path;
      const rawJob = match.groups?.job;
      if (!rawPath || !rawJob) continue;

      const expandedPaths = expandKnownTemplate(rawPath);
      const expandedJobs = expandKnownTemplate(rawJob);
      const pairs = pairExpandedPathsAndJobs(expandedPaths, expandedJobs);

      if (pairs.length === 0) {
        unresolvedTemplates.push(`${file}: ${rawPath} -> ${rawJob}`);
        continue;
      }

      for (const pair of pairs) {
        mappings.push({ path: pair.path, job: pair.job, file });
      }
    }
  }

  return { mappings, unresolvedTemplates };
}

function extractCoverageRequiredDutyJobs(filePath: string): Set<string> {
  const text = readFileSync(filePath, 'utf8');
  const jobs = new Set<string>();

  for (const arrayMatch of text.matchAll(
    /const\s+[A-Z0-9_]+REQUIRED_JOBS\s*=\s*\[([\s\S]*?)\]\s*as const/g
  )) {
    const arrayBody = arrayMatch[1] ?? '';
    for (const jobMatch of arrayBody.matchAll(/'([^']+)'/g)) {
      const job = jobMatch[1];
      if (job?.startsWith('duties:')) jobs.add(job);
    }
  }

  return jobs;
}

function extractWorkflowDutyLabels(filePath: string): Set<string> {
  const text = readFileSync(filePath, 'utf8');
  const jobs = new Set<string>();
  for (const match of text.matchAll(/\[(duties:[a-z0-9-]+)\]/gi)) {
    const job = match[1]?.toLowerCase();
    if (job) jobs.add(job);
  }
  return jobs;
}

function extractWorkflowDutySteps(filePath: string): WorkflowDutyStep[] {
  const text = readFileSync(filePath, 'utf8');
  const steps: WorkflowDutyStep[] = [];
  const stepRegex = /^\s*-\s+name:\s*(?<name>[^\n]+)\n(?<body>[\s\S]*?)(?=^\s*-\s+name:|\n\s*$)/gm;

  for (const stepMatch of text.matchAll(stepRegex)) {
    const name = stepMatch.groups?.name?.trim() ?? 'unknown step';
    const body = stepMatch.groups?.body ?? '';
    const runBody = body.match(/^\s*run:\s*\|\n(?<run>(?:^\s{10}.*(?:\n|$))*)/m)?.groups?.run;
    if (!runBody) continue;

    const dutyPaths = [
      ...runBody.matchAll(/--path\s+(\/internal\/cron\/import\/duties\/[^\s'"]+)/g),
    ]
      .map((match) => match[1]?.trim())
      .filter((value): value is string => Boolean(value));
    if (dutyPaths.length === 0) continue;

    const labels = [...runBody.matchAll(/\[(duties:[a-z0-9-]+)\]/gi)]
      .map((match) => match[1]?.toLowerCase())
      .filter((value): value is string => Boolean(value));

    for (const path of dutyPaths) {
      steps.push({ name, path, labels });
    }
  }

  return steps;
}

function isOfficialDutyJob(job: string): boolean {
  return job.endsWith('-official');
}

function diff(source: ReadonlySet<string>, target: ReadonlySet<string>): string[] {
  return [...source].filter((value) => !target.has(value)).sort();
}

const dutyTaskFiles = listFiles(dutiesTasksDir);
const { mappings: routeMappings, unresolvedTemplates: unresolvedRouteTemplates } =
  extractDutyRouteMappings(dutyTaskFiles);
const routeDutyJobs = new Set(routeMappings.map((mapping) => mapping.job));
const routeOfficialDutyJobs = new Set([...routeDutyJobs].filter(isOfficialDutyJob));
const routePathToJobs = new Map<string, Set<string>>();
for (const mapping of routeMappings) {
  const existing = routePathToJobs.get(mapping.path);
  if (existing) {
    existing.add(mapping.job);
    continue;
  }
  routePathToJobs.set(mapping.path, new Set([mapping.job]));
}

const coverageDutyJobs = extractCoverageRequiredDutyJobs(coverageFile);
const coverageOfficialDutyJobs = new Set([...coverageDutyJobs].filter(isOfficialDutyJob));

const workflowDutyLabels = extractWorkflowDutyLabels(dailyWorkflowFile);
const workflowDutySteps = extractWorkflowDutySteps(dailyWorkflowFile);
const workflowOfficialDutyLabels = new Set([...workflowDutyLabels].filter(isOfficialDutyJob));
const workflowNonOfficialDutyLabels = [...workflowDutyLabels].filter(
  (job) => !isOfficialDutyJob(job)
);

const knownOfficialDutyJobs = new Set([...routeOfficialDutyJobs, ...coverageOfficialDutyJobs]);

const errors: string[] = [];

if (unresolvedRouteTemplates.length > 0) {
  errors.push(
    `Unable to resolve dynamic duty route templates for alignment checks: ${unresolvedRouteTemplates.join(
      ', '
    )}`
  );
}

if (routeOfficialDutyJobs.size === 0) {
  errors.push('No official duty jobs found in task route importMeta definitions.');
}

if (coverageOfficialDutyJobs.size === 0) {
  errors.push('No official duty REQUIRED_JOBS entries found in coverage.ts.');
}

if (workflowDutyLabels.size === 0) {
  errors.push('No duty labels found in cron-daily-http.yml.');
}

if (workflowNonOfficialDutyLabels.length > 0) {
  errors.push(
    `Non-canonical duty labels in cron-daily-http.yml: ${workflowNonOfficialDutyLabels
      .sort()
      .join(', ')}`
  );
}

const missingCoverageJobsInWorkflow = diff(coverageOfficialDutyJobs, workflowOfficialDutyLabels);
if (missingCoverageJobsInWorkflow.length > 0) {
  errors.push(
    `Coverage-required duty jobs missing from cron-daily-http.yml labels: ${missingCoverageJobsInWorkflow.join(
      ', '
    )}`
  );
}

const unknownWorkflowOfficialJobs = diff(workflowOfficialDutyLabels, knownOfficialDutyJobs);
if (unknownWorkflowOfficialJobs.length > 0) {
  errors.push(
    `Unknown official duty labels in cron-daily-http.yml (not found in routes/coverage): ${unknownWorkflowOfficialJobs.join(
      ', '
    )}`
  );
}

const unknownManualAllowlistJobs = diff(MANUAL_OFFICIAL_DUTY_JOBS, routeOfficialDutyJobs);
if (unknownManualAllowlistJobs.length > 0) {
  errors.push(
    `Manual official duty allowlist includes jobs that are not registered in routes: ${unknownManualAllowlistJobs.join(
      ', '
    )}`
  );
}

for (const step of workflowDutySteps) {
  if (!step.path.startsWith(INTERNAL_DUTY_PATH_PREFIX)) continue;

  const routePath = step.path.replace(/^\/internal/, '');
  const routeJobs = routePathToJobs.get(routePath);
  if (!routeJobs || routeJobs.size === 0) {
    errors.push(`Workflow duty path ${step.path} (${step.name}) does not map to any duty route.`);
    continue;
  }

  const routeOfficialJobs = [...routeJobs].filter(isOfficialDutyJob);
  if (routeOfficialJobs.length === 0) {
    errors.push(
      `Workflow duty path ${step.path} (${step.name}) maps to non-official job(s): ${[
        ...routeJobs,
      ].join(', ')}`
    );
    continue;
  }

  if (step.labels.length === 0) {
    errors.push(`Workflow duty step ${step.name} (${step.path}) is missing [duties:*] label.`);
    continue;
  }

  const officialLabels = [...new Set(step.labels.filter(isOfficialDutyJob))];
  if (officialLabels.length !== 1) {
    errors.push(
      `Workflow duty step ${step.name} (${step.path}) must have exactly one official duty label, got: ${step.labels.join(
        ', '
      )}`
    );
    continue;
  }

  const [label] = officialLabels;
  if (!routeJobs.has(label)) {
    errors.push(
      `Workflow duty step ${step.name} (${step.path}) label ${label} does not match route importMeta job(s): ${[
        ...routeJobs,
      ].join(', ')}`
    );
  }
}

if (errors.length > 0) {
  console.error('Duty job alignment validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const allowedUnscheduledOfficialJobs = new Set([
  ...workflowOfficialDutyLabels,
  ...MANUAL_OFFICIAL_DUTY_JOBS,
]);
const routeOfficialNotInDailyWorkflow = diff(routeOfficialDutyJobs, allowedUnscheduledOfficialJobs);
if (routeOfficialNotInDailyWorkflow.length > 0) {
  console.error('Duty job alignment validation failed:');
  console.error(
    `- Official duty route jobs missing from workflow labels and manual allowlist: ${routeOfficialNotInDailyWorkflow.join(
      ', '
    )}`
  );
  process.exit(1);
}

console.log(
  `duty job alignment OK (routes=${routeOfficialDutyJobs.size}, coverage=${coverageOfficialDutyJobs.size}, workflow=${workflowOfficialDutyLabels.size})`
);
const manualOnlyRouteJobs = diff(routeOfficialDutyJobs, workflowOfficialDutyLabels).filter((job) =>
  MANUAL_OFFICIAL_DUTY_JOBS.has(job)
);
if (manualOnlyRouteJobs.length > 0) {
  console.log(
    `note: official route jobs covered by manual allowlist: ${manualOnlyRouteJobs.join(', ')}`
  );
}
