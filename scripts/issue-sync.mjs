#!/usr/bin/env node
// scripts/issue-sync.mjs — اعمال چیدمان Issueها با توکن GitHub Actions
// (فاز ۰۲ — توحید). می‌تواند بارها اجرا شود: لیبل‌ها، Milestone، مسئول،
// بدنه‌های اصلاح‌شده، کامنت‌های راهنما و بستن Issueهای انجام‌شده.
//
// ورودی‌ها:
//   GITHUB_TOKEN    توکن با دسترسی issues:write (در Actions: ${{ secrets.GITHUB_TOKEN }})
//   GITHUB_REPOSITORY  owner/repo (در Actions خودکار تنظیم است)
//   DRY_RUN=1       فقط گزارش می‌دهد
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
const REPO = process.env.GITHUB_REPOSITORY ?? 'tnix138/EscapeRoom';
const DRY_RUN = process.env.DRY_RUN === '1';
const PLAN_PATH = process.env.ISSUE_PLAN ?? 'scripts/issue-plan.json';
const API = 'https://api.github.com';

if (!TOKEN) {
  console.error('❌ GITHUB_TOKEN تنظیم نشده است.');
  process.exit(1);
}

const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));

async function api(method, endpoint, body) {
  if (DRY_RUN && method !== 'GET') {
    console.log(`   [dry-run] ${method} ${endpoint}`);
    return { dryRun: true };
  }
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'orfeo-issue-sync',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return {};

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`${method} ${endpoint} → ${response.status}: ${data.message ?? text}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

const summary = { labels: 0, milestones: 0, issues: 0, comments: 0, closed: 0, skipped: [] };

async function ensureLabels() {
  console.log(`\n▶ لیبل‌ها (${plan.labels.length})`);
  for (const label of plan.labels) {
    try {
      await api('POST', `/repos/${REPO}/labels`, label);
      summary.labels++;
      console.log(`   + ${label.name}`);
    } catch (err) {
      if (err.status === 422) {
        await api('PATCH', `/repos/${REPO}/labels/${encodeURIComponent(label.name)}`, label);
        console.log(`   ~ ${label.name} (به‌روزرسانی شد)`);
      } else {
        throw err;
      }
    }
  }
}

async function milestoneIndex() {
  const milestones = await api('GET', `/repos/${REPO}/milestones?state=all&per_page=100`);
  const byTitle = new Map((milestones ?? []).map((item) => [item.title, item.number]));

  const wanted = new Set(plan.issues.map((issue) => issue.milestone).filter(Boolean));
  for (const title of wanted) {
    if (byTitle.has(title)) continue;
    if (DRY_RUN) {
      console.log(`   [dry-run] ساخت Milestone «${title}»`);
      byTitle.set(title, -1);
      continue;
    }
    const created = await api('POST', `/repos/${REPO}/milestones`, { title });
    summary.milestones++;
    byTitle.set(title, created.number);
    console.log(`   + Milestone «${title}» (#${created.number})`);
  }
  return byTitle;
}

async function applyIssue(issue, milestones) {
  const number = issue.number;
  const body = {};

  if (issue.labels?.length) {
    const current = await api('GET', `/repos/${REPO}/issues/${number}`);
    const existing = new Set((current.labels ?? []).map((label) => label.name));
    const missing = issue.labels.filter((label) => !existing.has(label));
    if (missing.length > 0) {
      await api('POST', `/repos/${REPO}/issues/${number}/labels`, { labels: missing });
      console.log(`   #${number} لیبل‌ها: ${missing.join(', ')}`);
    }
  }

  if (issue.milestone) {
    const milestoneNumber = milestones.get(issue.milestone);
    if (milestoneNumber && milestoneNumber > 0) {
      body.milestone = milestoneNumber;
    }
  }

  if (issue.bodyFile) {
    const file = path.resolve(issue.bodyFile);
    if (existsSync(file)) {
      body.body = readFileSync(file, 'utf8');
      console.log(`   #${number} بدنه از ${issue.bodyFile} جایگزین شد`);
    } else {
      summary.skipped.push(`#${number}: فایل بدنه ${issue.bodyFile} پیدا نشد`);
    }
  }

  if (Object.keys(body).length > 0) {
    await api('PATCH', `/repos/${REPO}/issues/${number}`, body);
  }

  if (issue.assignee) {
    try {
      await api('POST', `/repos/${REPO}/issues/${number}/assignees`, { assignees: [issue.assignee] });
      console.log(`   #${number} مسئول: ${issue.assignee}`);
    } catch (err) {
      summary.skipped.push(`#${number}: مسئول ${issue.assignee} اضافه نشد (${err.status ?? 'خطا'})`);
    }
  }

  summary.issues++;
}

async function addComment({ number, body, marker }) {
  const comments = await api('GET', `/repos/${REPO}/issues/${number}/comments?per_page=100`);
  if ((comments ?? []).some((comment) => marker && comment.body?.includes(marker))) {
    console.log(`   #${number} کامنت از قبل هست؛ رد شد`);
    return;
  }
  await api('POST', `/repos/${REPO}/issues/${number}/comments`, { body });
  summary.comments++;
  console.log(`   #${number} کامنت اضافه شد`);
}

async function closeIssue({ number, body, marker }) {
  const issue = await api('GET', `/repos/${REPO}/issues/${number}`);
  if (issue.state === 'closed') {
    console.log(`   #${number} از قبل بسته است`);
    return;
  }
  const comments = await api('GET', `/repos/${REPO}/issues/${number}/comments?per_page=100`);
  if (!(comments ?? []).some((comment) => marker && comment.body?.includes(marker))) {
    await api('POST', `/repos/${REPO}/issues/${number}/comments`, { body });
    summary.comments++;
  }
  await api('PATCH', `/repos/${REPO}/issues/${number}`, { state: 'closed', state_reason: 'completed' });
  summary.closed++;
  console.log(`   #${number} بسته شد ✅`);
}

async function main() {
  console.log(`🔧 همگام‌سازی Issueها — ${REPO}${DRY_RUN ? ' (اجرای آزمایشی)' : ''}`);

  await ensureLabels();
  const milestones = await milestoneIndex();

  console.log(`\n▶ Issueها (${plan.issues.length})`);
  for (const issue of plan.issues) {
    try {
      await applyIssue(issue, milestones);
    } catch (err) {
      summary.skipped.push(`#${issue.number}: ${err.message}`);
      console.error(`   ✗ #${issue.number}: ${err.message}`);
    }
  }

  console.log(`\n▶ کامنت‌ها (${plan.comments.length})`);
  for (const comment of plan.comments) {
    try {
      await addComment(comment);
    } catch (err) {
      summary.skipped.push(`کامنت #${comment.number}: ${err.message}`);
      console.error(`   ✗ کامنت #${comment.number}: ${err.message}`);
    }
  }

  console.log(`\n▶ بستن Issueهای انجام‌شده (${plan.close.length})`);
  for (const item of plan.close) {
    try {
      await closeIssue(item);
    } catch (err) {
      summary.skipped.push(`بستن #${item.number}: ${err.message}`);
      console.error(`   ✗ بستن #${item.number}: ${err.message}`);
    }
  }

  console.log('\n📊 خلاصه:');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.skipped.length > 0) {
    console.log('\n⚠️ موارد رد‌شده (نیازی به تلاش مجدد نیست اگر دسترسی نداری):');
    for (const item of summary.skipped) console.log(`   - ${item}`);
  }

  // اگر عمدهٔ کارها رد شد، اجرا را قرمز کن تا در Actions دیده شود
  const failures = summary.skipped.length;
  if (failures > 0 && summary.issues === 0) {
    console.error('\n❌ هیچ Issue‌ای به‌روزرسانی نشد؛ دسترسی issues:write را بررسی کن.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ خطای غیرمنتظره:', err);
  process.exit(1);
});
