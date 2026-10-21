// تست فاز ۰۲ — اتوماسیون CI/CD: سیاست merge، لینتر و هم‌خوانی workflowها با docs/AUTO.md
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const AUTO_MERGE = path.join(ROOT, 'scripts/auto-merge.mjs');
const LINT = path.join(ROOT, 'scripts/lint.mjs');
const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-ci-'));

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'تست اُرفه‌ئو',
  GIT_AUTHOR_EMAIL: 'test@orfeo.local',
  GIT_COMMITTER_NAME: 'تست اُرفه‌ئو',
  GIT_COMMITTER_EMAIL: 'test@orfeo.local',
};

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...GIT_IDENTITY },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(script: string, cwd: string, env: Record<string, string>): RunResult {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...GIT_IDENTITY, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    const failure = err as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    };
  }
}

function mergeResult(stdout: string): { merged: boolean; reason: string } {
  const line = stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('AUTO_MERGE_RESULT '));
  if (!line) throw new Error(`خروجی AUTO_MERGE_RESULT پیدا نشد:\n${stdout}`);
  return JSON.parse(line.slice('AUTO_MERGE_RESULT '.length)) as {
    merged: boolean;
    reason: string;
  };
}

/** ساخت یک origin بَر و کلون کاری با شاخهٔ main و شاخهٔ ایجنت */
function setupRepo(name: string) {
  const base = path.join(tmpDir, name);
  const origin = path.join(base, 'origin.git');
  const work = path.join(base, 'work');
  mkdirSync(base, { recursive: true });
  execFileSync('git', ['init', '--bare', '--initial-branch=main', origin], { stdio: 'ignore' });
  execFileSync('git', ['clone', origin, work], { stdio: 'ignore' });
  git(work, ['checkout', '-b', 'main']);
  writeFileSync(path.join(work, 'README.md'), 'نسخهٔ اصلی\n');
  git(work, ['add', '.']);
  git(work, ['commit', '-m', 'اولین کامیت main']);
  git(work, ['push', '-u', 'origin', 'main']);
  return { origin, work };
}

function createAgentBranch(work: string, branch: string, file: string, content: string) {
  git(work, ['checkout', '-b', branch, 'main']);
  writeFileSync(path.join(work, file), content);
  git(work, ['add', '.']);
  git(work, ['commit', '-m', `کامیت شاخهٔ ${branch}`]);
  git(work, ['push', '-u', 'origin', branch]);
}

function originMainContent(work: string, file: string): string {
  git(work, ['fetch', 'origin']);
  return git(work, ['show', `origin/main:${file}`]);
}

describe('فاز ۰۲ — سیاست merge خودکار', () => {
  it('با CI سبز شاخهٔ ایجنت را بدون PR دستی به main می‌رساند', () => {
    const { work } = setupRepo('success');
    createAgentBranch(work, 'agent/tohid/wave-ci', 'ci.txt', 'تغییر سبز\n');

    const result = run(AUTO_MERGE, work, {
      MERGE_BRANCH: 'agent/tohid/wave-ci',
      CI_CONCLUSION: 'success',
      BASE_BRANCH: 'main',
    });

    expect(result.status).toBe(0);
    expect(mergeResult(result.stdout).merged).toBe(true);
    expect(originMainContent(work, 'ci.txt')).toBe('تغییر سبز');
    // merge حتماً یک کامیت merge با پیام فارسی ساخته است
    const log = git(work, ['log', 'origin/main', '--merges', '--format=%s', '-1']);
    expect(log).toContain('ادغام خودکار');
  });

  it('با CI قرمز هیچ merge انجام نمی‌شود و main دست‌نخورده می‌ماند', () => {
    const { work } = setupRepo('red-ci');
    createAgentBranch(work, 'agent/amirali/wave-ui', 'ui.txt', 'تغییر قرمز\n');

    const result = run(AUTO_MERGE, work, {
      MERGE_BRANCH: 'agent/amirali/wave-ui',
      CI_CONCLUSION: 'failure',
      BASE_BRANCH: 'main',
    });

    expect(result.status).toBe(0);
    const parsed = mergeResult(result.stdout);
    expect(parsed.merged).toBe(false);
    expect(parsed.reason).toContain('CI سبز نبود');
    expect(() => originMainContent(work, 'ui.txt')).toThrow();
  });

  it('push مستقیم به main یا نام شاخهٔ ناشناس را هرگز merge نمی‌کند', () => {
    const { work } = setupRepo('guard');
    createAgentBranch(work, 'agent/nazanin/wave-qa', 'qa.txt', 'کیو‌ای\n');

    const direct = run(AUTO_MERGE, work, {
      MERGE_BRANCH: 'main',
      CI_CONCLUSION: 'success',
    });
    expect(mergeResult(direct.stdout).merged).toBe(false);

    const unknown = run(AUTO_MERGE, work, {
      MERGE_BRANCH: 'feature/random',
      CI_CONCLUSION: 'success',
    });
    expect(mergeResult(unknown.stdout).merged).toBe(false);
    expect(mergeResult(unknown.stdout).reason).toContain('الگوی مجاز');

    expect(() => originMainContent(work, 'qa.txt')).toThrow();
  });

  it('در تعارض merge، شاخهٔ اصلی سبز می‌ماند و کد خروج ۲ می‌دهد', () => {
    const { work } = setupRepo('conflict');
    writeFileSync(path.join(work, 'shared.txt'), 'پایه\n');
    git(work, ['add', '.']);
    git(work, ['commit', '-m', 'افزودن فایل مشترک']);
    git(work, ['push', 'origin', 'main']);

    createAgentBranch(work, 'agent/alireza/wave-3d', 'shared.txt', 'نسخهٔ علیرضا\n');
    git(work, ['checkout', 'main']);
    writeFileSync(path.join(work, 'shared.txt'), 'نسخهٔ توحید\n');
    git(work, ['add', '.']);
    git(work, ['commit', '-m', 'تغییر هم‌زمان روی main']);
    git(work, ['push', 'origin', 'main']);

    const result = run(AUTO_MERGE, work, {
      MERGE_BRANCH: 'agent/alireza/wave-3d',
      CI_CONCLUSION: 'success',
    });

    expect(result.status).toBe(2);
    expect(mergeResult(result.stdout).merged).toBe(false);
    expect(mergeResult(result.stdout).reason).toContain('تعارض');
    expect(originMainContent(work, 'shared.txt')).toBe('نسخهٔ توحید');
  });

  it('در اجرای آزمایشی هیچ چیزی را push نمی‌کند', () => {
    const { work } = setupRepo('dry-run');
    createAgentBranch(work, 'arena/test/dry', 'dry.txt', 'خشک\n');

    const result = run(AUTO_MERGE, work, {
      MERGE_BRANCH: 'arena/test/dry',
      CI_CONCLUSION: 'success',
      DRY_RUN: '1',
    });

    expect(mergeResult(result.stdout).merged).toBe(false);
    expect(() => originMainContent(work, 'dry.txt')).toThrow();
  });
});

describe('فاز ۰۲ — لینتر بدون وابستگی', () => {
  it('روی کد فعلی پروژه پاک است', () => {
    const result = run(LINT, ROOT, {});
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('lint پاک است');
  });

  it('console.log در src، debugger و it.only را می‌گیرد', () => {
    const fakeRoot = path.join(tmpDir, 'lint-bad');
    mkdirSync(path.join(fakeRoot, 'src'), { recursive: true });
    mkdirSync(path.join(fakeRoot, 'tests'), { recursive: true });
    writeFileSync(
      path.join(fakeRoot, 'src', 'bad.ts'),
      'console.log("افشای اطلاعات");\ndebugger;\nconst x: any = 1;\n// TODO: بعداً\n',
    );
    writeFileSync(path.join(fakeRoot, 'tests', 'only.test.ts'), "it.only('تنها تست', () => {});\n");

    const result = run(LINT, fakeRoot, { LINT_ROOT: fakeRoot });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no-console-log');
    expect(result.stderr).toContain('no-debugger');
    expect(result.stderr).toContain('no-explicit-any');
    expect(result.stderr).toContain('no-todo');
    expect(result.stderr).toContain('no-test-only');
  });
});

describe('فاز ۰۲ — هم‌خوانی با docs/AUTO.md', () => {
  const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

  it('CI روی push شاخهٔ ایجنت‌ها typecheck، test و lint را اجرا می‌کند', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('name: CI');
    expect(ci).toContain("'agent/**'");
    expect(ci).toContain('npm ci');
    expect(ci).toContain('npm run typecheck');
    expect(ci).toContain('npm test');
    expect(ci).toContain('npm run lint');
    expect(ci).toContain('npm run build');
  });

  it('Auto-merge بعد از CI سبز و با دسترسی نوشتن اجرا می‌شود', () => {
    const autoMerge = read('.github/workflows/auto-merge.yml');
    expect(autoMerge).toContain("workflows: ['CI']");
    expect(autoMerge).toContain('contents: write');
    expect(autoMerge).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(autoMerge).toContain('node scripts/auto-merge.mjs');
  });

  it('Deploy فقط از main سبز و با توکن Vercel انجام می‌شود', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toContain("branches: ['main']");
    expect(deploy).toContain("github.actor == 'tnix138'");
    expect(deploy).toContain('secrets.VERCEL_TOKEN');
    expect(deploy).toContain('/api/health');
    // پیش‌بررسی secretها باید قبل از نصب/ساخت اجرا شود تا پیام خطا روشن باشد
    expect(deploy).toContain('بررسی secretهای انتشار');
    expect(deploy.indexOf('بررسی secretهای انتشار')).toBeLessThan(
      deploy.indexOf('npm ci'),
    );
    expect(deploy).toContain('VERCEL_PROJECT_ID');
  });

  it('اسکریپت‌های package.json اسکریپت‌های مستندشده را دارند', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> })
      .scripts;
    expect(scripts.lint).toBe('node scripts/lint.mjs');
    expect(scripts['auto-merge']).toBe('node scripts/auto-merge.mjs');
    expect(scripts.ci).toContain('npm run typecheck');
    expect(scripts.ci).toContain('npm test');
  });

  it('package.json بدون BOM است تا next build و Vercel نشکند', () => {
    const bytes = readFileSync(path.join(ROOT, 'package.json'));
    expect([...bytes.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes[0]).toBe('{'.charCodeAt(0));
  });
});
