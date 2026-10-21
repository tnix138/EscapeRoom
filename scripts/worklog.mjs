#!/usr/bin/env node
/**
 * Entry point: `node scripts/worklog.mjs <command>`
 * See `node scripts/worklog.mjs help` or WORKLOG.md §راهنمای سریع.
 */
import { run } from './worklog/lib/cli.mjs';

try {
  const code = run(process.argv.slice(2));
  process.exitCode = typeof code === 'number' ? code : 0;
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
}
