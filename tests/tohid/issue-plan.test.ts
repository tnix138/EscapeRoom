// تست نگهبان چیدمان Issueها — بدون تماس شبکه، برای CI
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface PlanIssue {
  number: number;
  labels?: string[];
  milestone?: string;
  assignee?: string;
  bodyFile?: string;
}

interface IssuePlan {
  labels: Array<{ name: string; color: string; description: string }>;
  issues: PlanIssue[];
  comments: Array<{ number: number; body: string; marker: string }>;
  close: Array<{ number: number; body: string; marker: string }>;
}

const ROOT = process.cwd();
const plan = JSON.parse(
  readFileSync(path.join(ROOT, 'scripts/issue-plan.json'), 'utf8'),
) as IssuePlan;

const DEFAULT_LABELS = new Set([
  'phase',
  'owner:tohid',
  'owner:alireza',
  'owner:amirali',
  'owner:amir',
  'owner:nazanin',
  'priority:critical',
  'priority:high',
  'priority:medium',
  'priority:low',
  'needs-decision',
]);

const MILESTONES = new Set([
  'هفته ۱ — مستندات و زیرساخت',
  'هفته ۲ — CI، نورپردازی، ادمین، داستان',
  'هفته ۳ — حضور، مواد، آمار، HUD',
  'هفته ۴ — کلاینت حضور، ترس، ابزارهای مدیریتی',
  'هفته ۵ — کات‌سین و QA',
  'هفته ۶ — انتشار',
]);

const ACCOUNTS = new Set([
  'tnix138',
  'alispy021',
  'amiralikj',
  'emirhamzehlou',
  'nazanindavoodi',
]);

describe('چیدمان Issueها — یکپارچگی طرح', () => {
  it('هر Issue فقط یک بار در طرح آمده است', () => {
    const numbers = plan.issues.map((issue) => issue.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.length).toBeGreaterThanOrEqual(28);
  });

  it('همهٔ لیبل‌های استفاده‌شده یا استانداردند یا در طرح ساخته می‌شوند', () => {
    const planned = new Set(plan.labels.map((label) => label.name));
    for (const issue of plan.issues) {
      for (const label of issue.labels ?? []) {
        expect(
          DEFAULT_LABELS.has(label) || planned.has(label),
          `لیبل «${label}» در #${issue.number} تعریف نشده است`,
        ).toBe(true);
      }
    }
  });

  it('رنگ لیبل‌ها معتبر و بدون # است', () => {
    for (const label of plan.labels) {
      expect(label.color).toMatch(/^[0-9a-f]{6}$/i);
      expect(label.description.length).toBeGreaterThan(0);
    }
  });

  it('Milestone هر Issue یکی از هفته‌های تعریف‌شده است', () => {
    for (const issue of plan.issues) {
      if (!issue.milestone) continue;
      expect(MILESTONES.has(issue.milestone), `Milestone نامعتبر در #${issue.number}`).toBe(true);
    }
  });

  it('مسئول هر Issue یکی از اعضای تیم است و هر Issue حداکثر یک مالک لیبلی دارد', () => {
    for (const issue of plan.issues) {
      if (issue.assignee) {
        expect(ACCOUNTS.has(issue.assignee), `حساب ناشناخته ${issue.assignee}`).toBe(true);
      }
      // فقط Issueهای «مادر» فازهای دو-مالکی دو owner دارند
      const owners = (issue.labels ?? []).filter((label) => label.startsWith('owner:'));
      expect(owners.length).toBeLessThanOrEqual(2);
      if (owners.length === 2) expect([74, 80, 82, 84]).toContain(issue.number);
    }
  });

  it('فایل بدنهٔ Issueهای اصلاح‌شده موجود و بدون آکولاد تکراری است', () => {
    const withBody = plan.issues.filter((issue) => issue.bodyFile);
    expect(withBody.map((issue) => issue.number).sort((a, b) => a - b)).toEqual([99, 100, 104]);
    for (const issue of withBody) {
      const file = path.join(ROOT, issue.bodyFile as string);
      expect(existsSync(file), issue.bodyFile).toBe(true);
      const body = readFileSync(file, 'utf8');
      expect(body).not.toContain('{{');
      expect(body).not.toContain("+ L('");
      expect(body).toContain('/api/rooms/{CODE}/presence');
      expect(body).toContain('رادیان');
    }
    // قرارداد نباید نمونهٔ کدِ باگ‌دار داشته باشد
    const contract = readFileSync(path.join(ROOT, 'scripts/issue-bodies/104.md'), 'utf8');
    expect(contract).not.toContain("? currentCode : currentCode");
    expect(contract).not.toContain('currentCode');
    expect(contract).toContain('inFlight');
    expect(contract).toContain('حافظهٔ پروسه');
    // متن کهنه دربارهٔ خرابی #99/#100 نباید بماند
    expect(contract).not.toContain('دچار خطای نمایشی');
  });

  it('هر کامنت و بستن، نشانگر یکتا برای همان Issue دارد تا اجرای دوباره تکراری نسازد', () => {
    const keys = [...plan.comments, ...plan.close].map((item) => `${item.number}:${item.marker}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of [...plan.comments, ...plan.close]) {
      expect(item.body).toContain(item.marker);
      expect(item.marker).toMatch(/^<!-- issue-sync:/);
    }
  });

  it('Issueهای انجام‌شده در طرح به‌عنوان بسته‌شدنی مشخص شده‌اند', () => {
    expect(plan.close.map((item) => item.number).sort((a, b) => a - b)).toEqual([
      74, 75, 76, 98,
    ]);
    for (const item of plan.close) {
      if (item.number === 74 || item.number === 98) continue;
      expect(item.body).toContain('2d72c6b');
    }
    // فقط Issue منسوخ با not_planned بسته می‌شود
    const reasons = plan.close
      .filter((item) => (item as { reason?: string }).reason === 'not_planned')
      .map((item) => item.number);
    expect(reasons).toEqual([74]);
    expect((plan.close[0] as { reason?: string }).reason).toBeUndefined();
    const done = plan.issues.filter((issue) => issue.labels?.includes('status:done'));
    expect(done.map((issue) => issue.number).sort()).toEqual([75, 76]);
  });

  it('workflow همگام‌سازی دسترسی نوشتن Issue دارد و قابل اجرای دستی است', () => {
    const workflow = readFileSync(
      path.join(ROOT, '.github/workflows/issue-sync.yml'),
      'utf8',
    );
    expect(workflow).toContain('issues: write');
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain('node scripts/issue-sync.mjs');
    expect(workflow).toContain('GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}');
  });
});
