import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const dutiesTasksDir = join(repoRoot, 'apps', 'api', 'src', 'modules', 'tasks', 'duties');
const coverageFile = join(repoRoot, 'apps', 'api', 'src', 'lib', 'cron', 'commands', 'coverage.ts');
const dailyWorkflowFile = join(repoRoot, '.github', 'workflows', 'cron-daily-http.yml');

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

function extractDutyJobsFromRoutes(files: ReadonlyArray<string>): Set<string> {
  const jobs = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');

    for (const match of text.matchAll(/job:\s*'([^']+)'/g)) {
      const job = match[1];
      if (job?.startsWith('duties:')) jobs.add(job);
    }

    for (const match of text.matchAll(/job:\s*`([^`]+)`/g)) {
      const job = match[1];
      if (!job?.startsWith('duties:')) continue;
      if (job.includes('${')) continue; // dynamic template values are validated via coverage job lists
      jobs.add(job);
    }
  }
  return jobs;
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

function isOfficialDutyJob(job: string): boolean {
  return job.endsWith('-official');
}

function diff(source: ReadonlySet<string>, target: ReadonlySet<string>): string[] {
  return [...source].filter((value) => !target.has(value)).sort();
}

const dutyTaskFiles = listFiles(dutiesTasksDir);
const routeDutyJobs = extractDutyJobsFromRoutes(dutyTaskFiles);
const routeOfficialDutyJobs = new Set([...routeDutyJobs].filter(isOfficialDutyJob));

const coverageDutyJobs = extractCoverageRequiredDutyJobs(coverageFile);
const coverageOfficialDutyJobs = new Set([...coverageDutyJobs].filter(isOfficialDutyJob));

const workflowDutyLabels = extractWorkflowDutyLabels(dailyWorkflowFile);
const workflowOfficialDutyLabels = new Set([...workflowDutyLabels].filter(isOfficialDutyJob));
const workflowNonOfficialDutyLabels = [...workflowDutyLabels].filter(
  (job) => !isOfficialDutyJob(job)
);

const knownOfficialDutyJobs = new Set([...routeOfficialDutyJobs, ...coverageOfficialDutyJobs]);

const errors: string[] = [];

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

if (errors.length > 0) {
  console.error('Duty job alignment validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const routeOfficialNotInDailyWorkflow = diff(routeOfficialDutyJobs, workflowOfficialDutyLabels);

console.log(
  `duty job alignment OK (routes=${routeOfficialDutyJobs.size}, coverage=${coverageOfficialDutyJobs.size}, workflow=${workflowOfficialDutyLabels.size})`
);
if (routeOfficialNotInDailyWorkflow.length > 0) {
  console.log(
    `note: official route jobs not asserted in cron-daily-http.yml labels: ${routeOfficialNotInDailyWorkflow.join(
      ', '
    )}`
  );
}
