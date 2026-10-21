/**
 * Command line interface for the team worklog.
 *
 * Usage:
 *   node scripts/worklog.mjs new --author علیرضا --activity Commit --title "..." --topic pov-audio
 *   node scripts/worklog.mjs push --author توحید --commit
 *   node scripts/worklog.mjs archive <log-id> --by توحید --note "PR #21 ادغام شد"
 *   node scripts/worklog.mjs sync
 *   node scripts/worklog.mjs check
 *   node scripts/worklog.mjs list
 *   node scripts/worklog.mjs hooks
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  archiveLog,
  checkWorklog,
  composeLogFile,
  createLog,
  readAllLogs,
  readLogFile,
  resolveAuthor,
  syncAll,
  syncWorklog,
  persianDateTime,
  worklogPath,
  logDir,
} from './registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/* -------------------------------------------------------------------------- */
/* Tiny argv parser                                                           */
/* -------------------------------------------------------------------------- */

export function parseArgv(argv) {
  const flags = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split('=');
    const key = rawKey.trim();

    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return { flags, positionals };
}

const bool = (value) => value === true || value === 'true' || value === '1';

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryGit(root, args) {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

function currentBranch(root) {
  return tryGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || '';
}

function readBody(flags, root) {
  if (typeof flags['body-file'] === 'string') {
    return fs.readFileSync(path.resolve(root, flags['body-file']), 'utf8');
  }
  if (typeof flags.body === 'string') return flags.body;
  return '';
}

function commitLogFiles(root, files, message) {
  const relative = files
    .map((file) => path.relative(root, file))
    .filter((file) => file && !file.startsWith('..'));

  git(root, ['add', '--', ...relative]);
  git(root, ['commit', '-m', message]);
  return tryGit(root, ['rev-parse', '--short', 'HEAD']) || '';
}

/* -------------------------------------------------------------------------- */
/* Commands                                                                   */
/* -------------------------------------------------------------------------- */

const HELP = `
📋 سیستم لاگ تیمی — EscapeRoom / تماشاخانه اُرفه‌ئو

دستورها:
  new       ساخت یک لاگ جدید در logs/pending (Commit / Push / PR / Infra-*)
  push      ساخت لاگ پوش بر اساس کامیت‌های شاخه فعلی
  archive   انتقال لاگ از Pending به Archive همراه با ثبت «آرشیو شده توسط/زمان»
  sync      بازسازی جدول‌های WORKLOG.md و بلوک چرخه عمر همه لاگ‌ها
  check     اعتبارسنجی کامل لاگ‌ها، هم‌خوانی WORKLOG و (اختیاری) گارد پوش
  attach    افزودن SHA کامیت به یک لاگ
  list      نمایش لاگ‌های Pending و Archive
  hooks     فعال‌سازی هوک‌های Git پروژه (.githooks)

نمونه‌ها:
  npm run worklog:new -- --author علیرضا --slug alireza --activity Commit \\
    --title "موج ۳ کات‌سین" --topic wave3-cutscene --ref "شاخه arena/xxx"

  npm run worklog:push -- --author توحید --slug tohid --commit
  npm run worklog:archive -- 1405-07-29_16-35-38_alireza_pr-13_wave1-wave2 \\
    --by توحید --note "PR #13 بررسی و ادغام شد"
  npm run worklog:check

راهنما: WORKLOG.md و TEAM.md §۴
`.trim();

export function run(argv, root = ROOT) {
  const [command, ...rest] = argv;
  const { flags, positionals } = parseArgv(rest);

  switch (command) {
    case 'new':
    case 'create':
      return commandNew(flags, root);
    case 'push':
      return commandPush(flags, root);
    case 'archive':
      return commandArchive(positionals, flags, root);
    case 'sync':
      return commandSync(flags, root);
    case 'check':
      return commandCheck(flags, positionals, root);
    case 'attach':
      return commandAttach(positionals, flags, root);
    case 'list':
    case 'ls':
      return commandList(flags, root);
    case 'hooks':
      return commandHooks(flags, root);
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      return 0;
    default:
      console.error(`✖ دستور ناشناخته: ${command}\n`);
      console.log(HELP);
      return 1;
  }
}

function commandNew(flags, root) {
  const branch = flags.branch || currentBranch(root);
  const result = createLog(root, {
    author: flags.author,
    slug: flags.slug,
    activity: flags.activity,
    title: flags.title,
    summary: flags.summary,
    ref: flags.ref,
    branch,
    topic: flags.topic,
    body: readBody(flags, root),
    at: typeof flags.at === 'string' ? flags.at : undefined,
    commits: typeof flags['commit-sha'] === 'string' ? flags['commit-sha'].split(',') : undefined,
  });

  if (!bool(flags['no-sync'])) syncWorklog(root);

  console.log(`✅ لاگ جدید در Pending ساخته شد:`);
  console.log(`   شناسه: ${result.id}`);
  console.log(`   فایل:  ${path.relative(root, result.file)}`);
  console.log(`   زمان:  ${persianDateTime(result.meta)} (${result.meta.created_at_utc})`);

  if (bool(flags.commit)) {
    const sha = commitLogFiles(
      root,
      [result.file, worklogPath(root)],
      `docs(worklog): ثبت لاگ ${result.meta.activity} — ${result.meta.title}`,
    );
    console.log(`   ✅ کامیت شد: ${sha}`);
  } else {
    console.log(`   ℹ️  بعد از تکمیل متن، فایل را کامیت کن: git add ${path.relative(root, result.file)} WORKLOG.md`);
  }
  return 0;
}

function commandPush(flags, root) {
  const branch = flags.branch || currentBranch(root);
  const branchName = currentBranch(root);
  const upstream = tryGit(root, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{upstream}',
  ]);

  const base =
    (typeof flags.base === 'string' && flags.base) ||
    [upstream, 'origin/main', 'main', 'origin/master', 'master']
      .filter((candidate) => candidate && candidate !== branchName)
      .find((candidate) =>
        tryGit(root, ['rev-parse', '--verify', '--quiet', candidate]),
      ) ||
    (tryGit(root, ['rev-list', '--max-parents=0', 'HEAD']) || '')
      .split('\n')
      .filter(Boolean)
      .pop();

  if (!base || !tryGit(root, ['rev-parse', '--verify', '--quiet', base])) {
    console.error('✖ مرجع پایه پیدا نشد. با --base یک مرجع معتبر بده.');
    return 1;
  }

  const head = git(root, ['rev-parse', '--short', 'HEAD']);
  const logOutput = tryGit(root, ['log', '--format=%h|%cI|%s', `${base}..HEAD`]);
  const commits = (logOutput ? logOutput.split('\n') : []).filter(Boolean).map((line) => {
    const [sha, iso, ...subject] = line.split('|');
    return { sha, iso, subject: subject.join('|') };
  });

  if (!commits.length && !bool(flags['allow-empty'])) {
    console.error(
      `✖ هیچ کامیتی بین «${base}» و HEAD وجود ندارد؛ لاگ پوش معنی ندارد.\n  (برای ثبت اجباری از --allow-empty استفاده کن.)`,
    );
    return 1;
  }

  const mergeBase = tryGit(root, ['merge-base', base, 'HEAD']) || base;
  const nameStatus = tryGit(root, ['diff', '--name-status', mergeBase, 'HEAD']) || '';
  const changedFiles = nameStatus
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...file] = line.split('\t');
      return { status, file: file.join('\t') };
    });

  const byArea = new Map();
  for (const { file } of changedFiles) {
    const segment = file.includes('/') ? file.split('/')[0] : 'ریشه پروژه (md/config)';
    byArea.set(segment, (byArea.get(segment) || 0) + 1);
  }

  const commitRows = commits.length
    ? commits.map(
        (commit, index) =>
          `| ${index + 1} | \`${commit.sha}\` | ${commit.iso} | ${commit.subject.replaceAll('|', '\\|')} |`,
      )
    : ['| — | — | — | هیچ کامیت جدیدی نسبت به مرجع پایه وجود ندارد |'];

  const areaRows = [...byArea.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([area, count]) => `| \`${area}\` | ${count} |`);

  const dirty = (tryGit(root, ['status', '--porcelain']) || '').trim();

  const body = [
    '## 📝 شرح دقیق فعالیت انجام‌شده',
    '',
    `پوش شاخه \`${branch}\` روی ریموت \`origin\` شامل **${commits.length}** کامیت (${base} → \`${head}\`).`,
    '',
    '### 📦 کامیت‌های موجود در این پوش',
    '',
    '| # | کامیت | زمان (UTC) | عنوان |',
    '| --- | --- | --- | --- |',
    ...commitRows,
    '',
    '### 📁 خلاصه فایل‌های تغییر یافته',
    '',
    '| حوزه | تعداد فایل |',
    '| --- | --- |',
    ...(areaRows.length ? areaRows : ['| — | ۰ |']),
    '',
    typeof flags.note === 'string' ? `### 🗒️ یادداشت\n\n${flags.note}\n` : '',
    dirty ? '> ⚠️ هنگام ساخت این لاگ، تغییرات کامیت‌نشده در شاخه کاری وجود داشت.\n' : '',
    '> ℹ️ کامیت ثبت همین لاگ نیز در همین پوش ارسال می‌شود؛ به همین دلیل SHA آن در فهرست بالا نیست.',
  ].join('\n');

  const summary =
    typeof flags.summary === 'string'
      ? flags.summary
      : `پوش ${commits.length} کامیت شاخه ${branch} (${base} → ${head})` +
        (commits.length ? ` از جمله «${commits[0].subject}»` : '');

  const result = createLog(root, {
    author: flags.author,
    slug: flags.slug,
    activity: 'Push',
    title:
      typeof flags.title === 'string'
        ? flags.title
        : `پوش شاخه ${branch} — ${head}`,
    summary,
    ref: `origin/${branch} (${base}..${head})`,
    branch,
    topic: typeof flags.topic === 'string' ? flags.topic : 'push',
    body,
    at: typeof flags.at === 'string' ? flags.at : undefined,
  });

  if (!bool(flags['no-sync'])) syncWorklog(root);

  console.log('✅ لاگ پوش در Pending ساخته شد:');
  console.log(`   شناسه: ${result.id}`);
  console.log(`   فایل:  ${path.relative(root, result.file)}`);
  console.log(`   پوش:   ${commits.length} کامیت (${base}..${head})`);

  if (bool(flags.commit)) {
    const sha = commitLogFiles(
      root,
      [result.file, worklogPath(root)],
      `docs(worklog): ثبت لاگ پوش «${branch}» — ${result.meta.title}`,
    );
    console.log(`   ✅ کامیت شد: ${sha}`);
    console.log('   ℹ️  اکنون می‌توانی git push انجام دهی.');
  } else {
    console.log('   ℹ️  سپس لاگ را کامیت کن و پوش کن (یا از --commit استفاده کن).');
  }
  return 0;
}

function commandArchive(positionals, flags, root) {
  if (!positionals.length) {
    console.error('✖ شناسه لاگ را بده: worklog:archive <id> [<id> ...] --by <نام>');
    return 1;
  }

  const by = typeof flags.by === 'string' ? flags.by : '';
  if (!by) {
    console.error(
      '✖ نام آرشیوکننده الزامی است: --by "توحید" یا --by "ایجنت چهارم زیرساخت (به مدیریت توحید)"',
    );
    return 1;
  }

  let archivedBy = by;
  try {
    archivedBy = resolveAuthor({ author: by }).name;
  } catch {
    // نام آزاد (مثلاً یک ایجنت جدید) پذیرفته می‌شود.
  }

  let failed = 0;
  for (const id of positionals) {
    try {
      const result = archiveLog(root, {
        id,
        by: archivedBy,
        note: typeof flags.note === 'string' ? flags.note : undefined,
        append: typeof flags.append === 'string' ? flags.append : undefined,
        at: typeof flags.at === 'string' ? flags.at : undefined,
      });
      console.log(`✅ ${id} → Archive`);
      console.log(`   آرشیو شده توسط: ${archivedBy}`);
      console.log(`   زمان آرشیو: ${persianDateTime(result.meta)} (${result.meta.archived_at_utc})`);
    } catch (error) {
      console.error(`✖ ${id}: ${error.message}`);
      failed += 1;
    }
  }

  if (!bool(flags['no-sync'])) syncWorklog(root);
  return failed ? 1 : 0;
}

function commandSync(flags, root) {
  const result = syncAll(root);
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(
    `✅ همگام‌سازی انجام شد — بلوک‌های WORKLOG: ${result.worklog.changed ? 'به‌روزرسانی شد' : 'بدون تغییر'}`,
  );
  if (result.headers.length) {
    console.log(`   سربرگ لاگ‌های به‌روزرسانی‌شده (${result.headers.length}):`);
    for (const file of result.headers) console.log(`   • ${file}`);
  }
  return 0;
}

function commandCheck(flags, positionals, root) {
  if (flags.push) {
    // Supported forms (used by the pre-push hook):
    //   check --push <local-sha> <remote-sha>
    //   check --push=<local-sha> <remote-sha>
    //   check --push            (defaults to HEAD vs. an empty remote)
    const zero = '0'.repeat(40);
    let localSha;
    let remoteSha;

    if (flags.push === true) {
      localSha = positionals[0] || 'HEAD';
      remoteSha = positionals[1] || zero;
    } else {
      localSha = String(flags.push);
      remoteSha = positionals[0] || zero;
    }

    return checkPush(root, localSha, remoteSha);
  }

  const { errors, warnings, logs } = checkWorklog(root);

  if (flags.json) {
    console.log(JSON.stringify({ errors, warnings, total: logs.length }, null, 2));
    return errors.length ? 1 : 0;
  }

  for (const warning of warnings) console.warn(`⚠️  ${warning}`);
  for (const error of errors) console.error(`✖ ${error}`);

  if (errors.length) {
    console.error(
      `\n✖ اعتبارسنجی با ${errors.length} خطا شکست خورد. اصلاح: npm run worklog:sync`,
    );
    return 1;
  }

  console.log(
    `✅ همه لاگ‌ها سالم‌اند (${logs.length} لاگ) و WORKLOG.md با پوشه logs/ هم‌خوان است.`,
  );
  return 0;
}

function checkPush(root, localSha, remoteSha) {
  // The pre-push hook may pass a symbolic ref or an empty remote sha.
  if (!/^[0-9a-f]{7,40}$/.test(String(localSha))) {
    console.error(`✖ SHA محلی نامعتبر: ${localSha}`);
    return 1;
  }

  const isNewBranch = !/^[0-9a-f]{7,40}$/.test(String(remoteSha)) || /^0+$/.test(String(remoteSha));
  let base = isNewBranch
    ? tryGit(root, ['merge-base', localSha, 'origin/main']) ||
      tryGit(root, ['rev-list', '--max-parents=0', localSha])?.split('\n').pop()
    : remoteSha;

  if (!base) base = 'HEAD~1';

  const commits = (tryGit(root, ['rev-list', `${base}..${localSha}`]) || '')
    .split('\n')
    .filter(Boolean);

  const logChanges = (tryGit(root, ['diff', '--name-status', base, localSha, '--', 'logs/']) || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...file] = line.split('\t');
      return { status, file: file.join('\t') };
    })
    .filter((change) => /^[AMR]/.test(change.status));

  if (!commits.length && !logChanges.length) {
    console.log('ℹ️  هیچ کامیت جدیدی برای این ref نیست؛ بررسی لاگ پوش لازم نیست.');
    return 0;
  }

  if (!logChanges.length) {
    console.error(
      [
        '',
        '✖ طبق قانون WORKLOG.md، هر پوش باید حداقل یک فایل لاگ داشته باشد.',
        `  این پوش ${commits.length} کامیت دارد، اما هیچ فایلی در logs/ اضافه یا ویرایش نکرده است.`,
        '',
        '  راه‌حل:',
        '    npm run worklog:push -- --author "<نام>" --slug <slug> --commit',
        '    یا اگر این پوش فقط یک کامیت را تکمیل می‌کند:',
        '    npm run worklog:attach -- <log-id> $(git rev-parse --short HEAD)',
        '',
        '  در صورت اضطرار (مثلاً پوش خود سیستم لاگ): git push --no-verify',
        '',
      ].join('\n'),
    );
    return 1;
  }

  console.log(
    `✅ این پوش ${commits.length} کامیت و ${logChanges.length} فایل لاگ دارد:`,
  );
  for (const change of logChanges) console.log(`   ${change.status} ${change.file}`);

  const { errors } = checkWorklog(root);
  if (errors.length) {
    for (const error of errors) console.error(`✖ ${error}`);
    console.error('\n✖ لاگ‌ها سالم نیستند؛ پوش متوقف شد. npm run worklog:sync');
    return 1;
  }

  return 0;
}

function commandAttach(positionals, flags, root) {
  const [id, ...shas] = positionals;
  if (!id || !shas.length) {
    console.error('✖ استفاده: worklog:attach <log-id> <sha> [<sha> ...]');
    return 1;
  }

  const log = findLog(root, id);
  if (!log) {
    console.error(`✖ لاگ ${id} پیدا نشد.`);
    return 1;
  }

  const commits = new Set([...(log.meta.commits || []), ...shas.map((sha) => sha.trim())]);
  const updatedMeta = { ...log.meta, commits: [...commits] };
  const target = path.join(logDir(root, updatedMeta.status), `${updatedMeta.id}.md`);

  fs.writeFileSync(target, composeLogFile(updatedMeta, log.body), 'utf8');
  if (!bool(flags['no-sync'])) syncWorklog(root);

  console.log(`✅ کامیت‌های ${[...commits].join(', ')} به ${id} اضافه شد.`);
  return 0;
}

function findLog(root, id) {
  const direct = readAllLogs(root).find((log) => log.meta.id === id);
  if (direct) return direct;
  for (const status of ['pending', 'archive']) {
    const file = path.join(logDir(root, status), `${id}.md`);
    if (fs.existsSync(file)) return readLogFile(root, file);
  }
  return null;
}

function commandList(flags, root) {
  const logs = readAllLogs(root);
  const pending = logs.filter((log) => log.meta.status === 'pending');
  const archive = logs.filter((log) => log.meta.status === 'archive');

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          pending: pending.map((log) => log.meta),
          archive: archive.map((log) => log.meta),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(`⏳ Pending (${pending.length})`);
  for (const log of pending) {
    console.log(`   • ${log.meta.id}\n     ${log.meta.title} — ${log.meta.created_by || log.meta.author} — ${persianDateTime(log.meta)}`);
  }
  console.log(`\n✅ Archive (${archive.length})`);
  for (const log of archive) {
    console.log(
      `   • ${log.meta.id}\n     ${log.meta.title} — ایجاد: ${log.meta.created_by || log.meta.author} / آرشیو: ${log.meta.archived_by}`,
    );
  }
  return 0;
}

function commandHooks(flags, root) {
  const dir = path.join(root, '.githooks');
  if (!fs.existsSync(dir)) {
    console.error('✖ پوشه .githooks پیدا نشد.');
    return 1;
  }

  for (const entry of fs.readdirSync(dir)) {
    const file = path.join(dir, entry);
    if (fs.statSync(file).isFile()) fs.chmodSync(file, 0o755);
  }

  const previous = tryGit(root, ['config', '--get', 'hooksPath']);
  git(root, ['config', 'core.hooksPath', '.githooks']);
  console.log('✅ هوک‌های Git فعال شدند (core.hooksPath = .githooks)');
  if (previous && previous !== '.githooks') {
    console.log(`   ℹ️ مقدار قبلی: ${previous} (هوک commit-msg پروژه شامل ثبت امضای Arena هست)`);
  }
  console.log('   حالا هر پوش بدون فایل لاگ متوقف می‌شود و پیام کامیت باید فارسی باشد.');
  return 0;
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const code = run(process.argv.slice(2));
    process.exitCode = typeof code === 'number' ? code : 0;
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exitCode = 1;
  }
}
