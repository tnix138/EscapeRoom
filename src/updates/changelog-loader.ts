import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseChangelogMarkdown,
  type AdminUpdatesOverview,
} from './project-updates';

/**
 * بارگذاری تاریخچهٔ کامل آپدیت‌های فنی از CHANGELOG.md در سمت سرور برای پنل مدیریت.
 */
export function loadAdminUpdatesOverview(): AdminUpdatesOverview {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  if (!existsSync(changelogPath)) {
    return parseChangelogMarkdown('');
  }
  const markdown = readFileSync(changelogPath, 'utf8');
  return parseChangelogMarkdown(markdown);
}
