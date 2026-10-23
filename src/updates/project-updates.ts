/**
 * داده‌ها و تحلیل‌گر بخش «آپدیت‌ها» در تماشاخانهٔ اُرفه‌ئو
 * - نسخهٔ صفحهٔ اصلی (عمومی): خلاصه‌های کلی، روان و هم‌لحن با فضای داستانی سایت برای بازیکنان
 * - نسخهٔ پنل ادمین (تخصصی): استخراج کامل تاریخچهٔ فنی از CHANGELOG.md همراه با فایل‌ها، زیرسیستم‌ها و تست‌ها
 */

export type PublicUpdateCategory = 'all' | 'gameplay' | 'atmosphere' | 'experience';

export interface PublicUpdateItem {
  id: string;
  orderLabel: string;
  badge: string;
  isLatest?: boolean;
  category: Exclude<PublicUpdateCategory, 'all'>;
  categoryLabel: string;
  title: string;
  summary: string;
  highlights: readonly string[];
}

export const PUBLIC_UPDATE_FILTERS: ReadonlyArray<{
  id: PublicUpdateCategory;
  label: string;
}> = [
  { id: 'all', label: 'همهٔ آپدیت‌ها' },
  { id: 'gameplay', label: 'گیم‌پلی و همکاری' },
  { id: 'atmosphere', label: 'فضاسازی و صدا' },
  { id: 'experience', label: 'رابط کاربری و موبایل' },
];

/**
 * فهرست کلی و کاربرپسند آپدیت‌ها برای صفحهٔ اصلی سایت (بدون اصطلاحات فنی کدنویسی).
 */
export const PUBLIC_UPDATES: readonly PublicUpdateItem[] = [
  {
    id: 'whisper-and-clue-sync',
    orderLabel: 'نسخهٔ تازه',
    badge: 'جدیدترین آپدیت',
    isLatest: true,
    category: 'gameplay',
    categoryLabel: 'گیم‌پلی و همکاری',
    title: 'ارتباط روان در «نجوای گروهی» و تبادل بی‌وقفهٔ معماها',
    summary:
      'گفت‌وگوی تیمی و ارسال سرنخ‌های بلیط بین هم‌سفران بازطراحی شد تا پیام‌ها و کوپن‌های معما در شلوغ‌ترین لحظات بازی هم فوری و بدون گیر کردن به دست همه برسند.',
    highlights: [
      'ارسال آنی کوپن بلیط و سرنخ‌های هم‌تیمی‌ها با نام فارسی نمادهای تماشاخانه',
      'پایداری کامل ارتباط هم‌زمان چند بازیکن بدون قفل شدن دکمهٔ ارسال',
      'حفظ متن نوشته‌شده در صورت نوسان اینترنت و آزاد شدن خودکار نشانگر ماوس هنگام باز کردن چت',
    ],
  },
  {
    id: 'invitation-music-and-envelope',
    orderLabel: 'به‌روزرسانی ۰۵',
    badge: 'صدا و دعوت‌نامه',
    category: 'atmosphere',
    categoryLabel: 'فضاسازی و صدا',
    title: 'موسیقی معمایی دعوت‌نامه و باز شدن طبیعی پاکت مخملی',
    summary:
      'از لحظهٔ ورود به صفحهٔ دعوت‌نامهٔ اختصاصی، قطعهٔ موسیقایی ملایم و رازآلود تماشاخانه به‌طور خودکار با صدای متعادل پخش می‌شود و برگهٔ دعوت بدون هم‌پوشانی از پاکت بیرون می‌آید.',
    highlights: [
      'پخش خودکار پیش‌درآمد پیانو و جعبهٔ موسیقی عتیقه با بلندی صدای نرم و گوش‌نواز',
      'حذف کامل صدای نویز پس‌زمینه و هماهنگی افکت زنگ ظریف با باز شدن مُهر مومی پاکت',
      'اصلاح لایه‌بندی پاکت و برگهٔ دعوت روی لپ‌تاپ، دسکتاپ و گوشی',
    ],
  },
  {
    id: 'alley-world-and-lighting',
    orderLabel: 'به‌روزرسانی ۰۴',
    badge: 'جهان سه‌بعدی',
    category: 'atmosphere',
    categoryLabel: 'فضاسازی و صدا',
    title: 'بازآفرینی کوچهٔ شبانه، درِ لابی و نورپردازی مه',
    summary:
      'جزئیات بصری کوچهٔ تماشاخانهٔ اُرفه‌ئو از سنگ‌فرش برجستهٔ زمین تا درِ چوبی-شیشه‌ای ورودی، مشعل‌های هشت‌ضلعی و هالهٔ چراغ‌های خیابان طبیعی‌تر و چشم‌نوازتر شد.',
    highlights: [
      'سنگ‌فرش دست‌چین و برجستهٔ کوچه با چاله‌های باران و بافت خشک و طبیعی دیوارها',
      'درِ دو لنگهٔ چوبی لابی با قوس شیشه‌ای، نقش‌نگاری گل آهنی و دو مشعل هشت‌ضلعی قرینه',
      'پخش ملایم نور چراغ‌های برق در مه شبانه و تراز دقیق تابلوهای راهنمای کوچه',
    ],
  },
  {
    id: 'smooth-walking-and-glass-hud',
    orderLabel: 'به‌روزرسانی ۰۳',
    badge: 'کنترل و بلیط‌ها',
    category: 'experience',
    categoryLabel: 'رابط کاربری و موبایل',
    title: 'حرکت روان در صحنه و پنل شیشه‌ای یک‌دست بلیط و معما',
    summary:
      'راه رفتن در کوچه و سالن بدون گیر کردن به گوشه‌ها یا حرکت ناخواسته انجام می‌شود و پنل بلیط با طراحی شیشه‌ای تیره-طلایی در لبهٔ راست صفحه باز و بسته می‌شود.',
    highlights: [
      'سر خوردن نرم کنار دیوارها و موانع و توقف فوری حرکت هنگام باز کردن پنجره‌ها یا تایپ',
      'پنل شیشه‌ای خوانا برای بلیط و پاسخ معما با زبانهٔ باز و بستن سریع در سمت راست',
      'چیدمان منظم «هم‌سفران تماشاخانه» و «سرنخ‌های کوچه» بدون پوشاندن دید صحنه',
    ],
  },
  {
    id: 'human-avatars-and-mobile-pwa',
    orderLabel: 'به‌روزرسانی ۰۲',
    badge: 'چندنفره و موبایل',
    category: 'experience',
    categoryLabel: 'رابط کاربری و موبایل',
    title: 'کاراکترهای انسانی باورپذیر و تجربهٔ کامل روی گوشی',
    summary:
      'هم‌تیمی‌ها با ۸ تیپ کاراکتر انسانی سه‌بعدی در کوچه و سالن دیده می‌شوند و بازیکنان موبایل با پد لمسی، کشوهای کناری و قابلیت نصب وب‌اپ راحت بازی می‌کنند.',
    highlights: [
      '۸ شخصیت متمایز با چهره، لباس، انیمیشن طبیعی راه رفتن، پلک زدن و نشستن روی صندلی‌ها',
      'پد حرکت لمسی اختصاصی روی گوشی و چرخش هماهنگ دید در نمای سه‌بعدی و کلاسیک',
      'امکان نصب بازی روی صفحهٔ اصلی گوشی (iOS و اندروید) به‌صورت تمام‌صفحه',
    ],
  },
  {
    id: 'chapter-one-cutscene-and-auditorium',
    orderLabel: 'به‌روزرسانی ۰۱',
    badge: 'داستان و تالار',
    category: 'gameplay',
    categoryLabel: 'گیم‌پلی و همکاری',
    title: 'کات‌سین ورود گروهی و کاوش در تالار تاریک فصل اول',
    summary:
      'با حل معمای بلیط‌ها و گشودن قفل در، همهٔ اعضا هم‌زمان وارد کات‌سین سینمایی و اجرای صحنه می‌شوند و سپس کنترل کاوش در سالن تاریک ویران را به دست می‌گیرند.',
    highlights: [
      'همگام‌سازی لحظه‌ای ورود همهٔ بازیکنان از کوچه به راهرو و تالار اصلی نمایش',
      'صداگذاری فضایی سه‌بعدی دیالوگ‌ها و ادامهٔ پیوستهٔ موسیقی دلهره‌آور در سالن تاریک',
      'بررسی مشارکتی نقاط مرموز تالار (لوستر شکسته، تابلوهای کج، سه سن تاریک و درهای قفل‌شده)',
    ],
  },
];

/* ============================================================================
 * مدل داده و تحلیل‌گر تخصصی پنل ادمین (همگام با CHANGELOG.md)
 * ========================================================================== */

export type AdminUpdateKind = 'fixed' | 'added' | 'infra_fix';

export type TechnicalSubsystem =
  | 'multiplayer'
  | 'engine3d'
  | 'hud_ui'
  | 'audio'
  | 'mobile_pwa'
  | 'admin_security'
  | 'infra_ci';

export interface SubsystemMeta {
  id: TechnicalSubsystem;
  label: string;
  shortLabel: string;
}

export const SUBSYSTEM_META: Record<TechnicalSubsystem, SubsystemMeta> = {
  multiplayer: {
    id: 'multiplayer',
    label: 'شبکه، چت و هم‌زمانی چندنفره',
    shortLabel: 'شبکه و چندنفره',
  },
  engine3d: {
    id: 'engine3d',
    label: 'موتور سه‌بعدی، هندسه و نورپردازی',
    shortLabel: 'موتور سه‌بعدی',
  },
  hud_ui: {
    id: 'hud_ui',
    label: 'رابط کاربری، بلیط و HUD صحنه',
    shortLabel: 'رابط کاربری و HUD',
  },
  audio: {
    id: 'audio',
    label: 'موتور صدا، موسیقی و روایت',
    shortLabel: 'صدا و موسیقی',
  },
  mobile_pwa: {
    id: 'mobile_pwa',
    label: 'ریسپانسیو موبایل، لمس و PWA',
    shortLabel: 'موبایل و PWA',
  },
  admin_security: {
    id: 'admin_security',
    label: 'پنل ادمین، احراز هویت و دیتابیس',
    shortLabel: 'ادمین و امنیت',
  },
  infra_ci: {
    id: 'infra_ci',
    label: 'زیرساخت، CI/CD و انتشار',
    shortLabel: 'زیرساخت و CI',
  },
};

export interface TechnicalBullet {
  text: string;
  subItems: string[];
}

export interface AdminTechnicalUpdate {
  id: string;
  index: number;
  releaseGroup: string;
  kind: AdminUpdateKind;
  kindLabel: string;
  title: string;
  bullets: TechnicalBullet[];
  subsystems: TechnicalSubsystem[];
  touchedFiles: string[];
  testFiles: string[];
  testSummary: string | null;
  relatedPublicSummary: string | null;
}

export interface ReleaseChecklistItem {
  text: string;
  done: boolean;
}

export interface AdminUpdatesOverview {
  totalEntries: number;
  fixedCount: number;
  addedCount: number;
  infraFixCount: number;
  uniqueFilesCount: number;
  uniqueTestFilesCount: number;
  subsystemCounts: Record<TechnicalSubsystem, number>;
  updates: AdminTechnicalUpdate[];
  checklist: ReleaseChecklistItem[];
}

const FILE_PATH_PATTERN =
  /`((?:src|scripts|supabase|public|\.github|docs)\/[A-Za-z0-9_./[\]*-]+(?:\.[A-Za-z0-9]+)?|(?:package\.json|next\.config\.mjs|playwright\.config\.ts|vercel\.json|CHANGELOG\.md))`/g;

const TEST_PATH_PATTERN = /`(tests\/[A-Za-z0-9_./[\]*-]+)`/g;

function extractUniqueMatches(text: string, regex: RegExp): string[] {
  const found = new Set<string>();
  const globalRegex = new RegExp(regex.source, 'g');
  let match: RegExpExecArray | null = globalRegex.exec(text);
  while (match !== null) {
    if (match[1]) {
      found.add(match[1]);
    }
    match = globalRegex.exec(text);
  }
  return Array.from(found);
}

function detectSubsystems(
  title: string,
  fullText: string,
  touchedFiles: readonly string[],
): TechnicalSubsystem[] {
  const combined = `${title}\n${fullText}\n${touchedFiles.join(' ')}`;
  const matched: TechnicalSubsystem[] = [];

  if (
    /stream|SSE|EventSource|presence|نجوا|whisper|chat|کوپن|shareStub|room-service|client-sdk/i.test(
      combined,
    )
  ) {
    matched.push('multiplayer');
  }
  if (
    /engine3d|Three|سنگ‌فرش|چراغ|مشعل|درِ لابی|کف کوچه|برخورد|collision|کاراکتر|human-avatar|صندلی‌های سالن|تابلوی راهنما/i.test(
      combined,
    )
  ) {
    matched.push('engine3d');
  }
  if (
    /HUD|پنل بلیط|هم‌سفران|همسفران|پاکت|دعوت‌نامه|کشوی بلیط|پاسخ معما|globals\.css|WhisperChatPanel|HeldTicketsDrawer/i.test(
      combined,
    )
  ) {
    matched.push('hud_ui');
  }
  if (/audio|صدا|موسیقی|نویز|آهنگ|prelude|دیالوگ/i.test(combined)) {
    matched.push('audio');
  }
  if (/موبایل|گوشی|PWA|manifest|touch-controls|لمسی|آیفون|safe-area/i.test(combined)) {
    matched.push('mobile_pwa');
  }
  if (/admin|ادمین|احراز هویت|scrypt|JWT|Supabase|SQLite|قرارداد ترس/i.test(combined)) {
    matched.push('admin_security');
  }
  if (/CI\/CD|deploy|Vercel|lint|smoke-test|package\.json|انتشار/i.test(combined)) {
    matched.push('infra_ci');
  }

  if (matched.length === 0) {
    matched.push('hud_ui');
  }
  return matched;
}

function findRelatedPublicSummary(title: string): string | null {
  if (/نجوای گروهی/.test(title)) {
    return PUBLIC_UPDATES[0]?.summary ?? null;
  }
  if (/دعوت‌نامه|موسیقی|نویز/.test(title)) {
    return PUBLIC_UPDATES[1]?.summary ?? null;
  }
  if (/سنگ‌فرش|درِ|چراغ|مشعل|تابلوی راهنما|کف کوچه/.test(title)) {
    return PUBLIC_UPDATES[2]?.summary ?? null;
  }
  if (/گیر کردن ناگهانی|کشوی بلیط|پنل بلیط|هم‌سفران|همسفران|HUD/.test(title)) {
    return PUBLIC_UPDATES[3]?.summary ?? null;
  }
  if (/کاراکترها|موبایل|پوستهٔ گوشی|چرخش سر/.test(title)) {
    return PUBLIC_UPDATES[4]?.summary ?? null;
  }
  return null;
}

function extractTestSummary(bullets: readonly TechnicalBullet[]): string | null {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const line = bullets[i]?.text ?? '';
    if (/^(?:تست(?:‌ها|\s+تازه)?|\d+\s*تست)/.test(line)) {
      return line;
    }
  }
  return null;
}

function kindLabelFor(kind: AdminUpdateKind): string {
  switch (kind) {
    case 'added':
      return 'افزوده شد (قابلیت / فاز)';
    case 'infra_fix':
      return 'رفع اشکال زیرساختی';
    case 'fixed':
    default:
      return 'اصلاح و بهبود فنی';
  }
}

/**
 * تحلیل‌گر خالص فایل CHANGELOG.md به ساختار کامل قابل جستجو و فیلتر در پنل ادمین.
 */
export function parseChangelogMarkdown(markdown: string): AdminUpdatesOverview {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let currentRelease = 'منتشرنشده — در حال آماده‌سازی انتشار';
  let currentSection: 'fixed' | 'added' | 'infra_fix' | 'tests' | 'checklist' | 'other' = 'fixed';

  interface RawEntry {
    releaseGroup: string;
    kind: AdminUpdateKind;
    title: string;
    bullets: TechnicalBullet[];
  }

  const rawEntries: RawEntry[] = [];
  const checklist: ReleaseChecklistItem[] = [];
  let activeEntry: RawEntry | null = null;

  const flushEntry = () => {
    if (activeEntry && (activeEntry.bullets.length > 0 || activeEntry.title.length > 0)) {
      rawEntries.push(activeEntry);
    }
    activeEntry = null;
  };

  for (const rawLine of lines) {
    const trimmedEnd = rawLine.trimEnd();
    const trimmed = trimmedEnd.trim();

    if (!trimmed) continue;

    // سرگروه نسخه: ## [...]
    if (trimmed.startsWith('## ')) {
      flushEntry();
      currentRelease = trimmed.replace(/^##\s+/, '').replace(/[[\]]/g, '').trim();
      continue;
    }

    // زیربخش: ### اصلاح شد / ### افزوده شد / ### رفع شد / ### باقی‌مانده برای انتشار
    if (trimmed.startsWith('### ')) {
      flushEntry();
      const heading = trimmed.replace(/^###\s+/, '').trim();
      if (heading.startsWith('اصلاح شد')) {
        currentSection = 'fixed';
      } else if (heading.startsWith('افزوده شد')) {
        currentSection = 'added';
      } else if (heading.startsWith('رفع شد')) {
        currentSection = 'infra_fix';
      } else if (heading.startsWith('باقی‌مانده')) {
        currentSection = 'checklist';
      } else if (heading.startsWith('تست')) {
        currentSection = 'tests';
      } else {
        currentSection = 'other';
      }
      continue;
    }

    if (currentSection === 'checklist') {
      const checkMatch = /^-\s*\[([ xX])\]\s+(.+)$/.exec(trimmed);
      if (checkMatch) {
        checklist.push({
          done: checkMatch[1]?.toLowerCase() === 'x',
          text: checkMatch[2]?.trim() ?? '',
        });
      }
      continue;
    }

    if (currentSection === 'tests' || currentSection === 'other') {
      continue;
    }

    // عنوان پررنگ هر آپدیت: **...**
    const boldTitleMatch = /^\*\*(.+)\*\*$/.exec(trimmed);
    if (boldTitleMatch && (currentSection === 'fixed' || currentSection === 'added')) {
      flushEntry();
      activeEntry = {
        releaseGroup: currentRelease,
        kind: currentSection,
        title: boldTitleMatch[1]?.trim() ?? '',
        bullets: [],
      };
      continue;
    }

    // زیرمورد تورفته: "  - ..."
    if (/^\s{2,}-\s+/.test(trimmedEnd) && activeEntry && activeEntry.bullets.length > 0) {
      const subText = trimmed.replace(/^-\s+/, '').trim();
      const lastBullet = activeEntry.bullets[activeEntry.bullets.length - 1];
      if (lastBullet) {
        lastBullet.subItems.push(subText);
      }
      continue;
    }

    // بولت سطح اول: "- ..."
    if (trimmed.startsWith('- ')) {
      const itemText = trimmed.replace(/^-\s+/, '').trim();
      if (currentSection === 'infra_fix') {
        flushEntry();
        const shortTitle =
          itemText.length > 82 ? `${itemText.slice(0, 80).trim()}…` : itemText;
        rawEntries.push({
          releaseGroup: currentRelease,
          kind: 'infra_fix',
          title: shortTitle,
          bullets: [{ text: itemText, subItems: [] }],
        });
      } else if (activeEntry) {
        activeEntry.bullets.push({ text: itemText, subItems: [] });
      }
    }
  }

  flushEntry();

  const allFiles = new Set<string>();
  const allTests = new Set<string>();
  const subsystemCounts: Record<TechnicalSubsystem, number> = {
    multiplayer: 0,
    engine3d: 0,
    hud_ui: 0,
    audio: 0,
    mobile_pwa: 0,
    admin_security: 0,
    infra_ci: 0,
  };

  let fixedCount = 0;
  let addedCount = 0;
  let infraFixCount = 0;

  const updates: AdminTechnicalUpdate[] = rawEntries.map((entry, idx) => {
    if (entry.kind === 'fixed') fixedCount += 1;
    else if (entry.kind === 'added') addedCount += 1;
    else infraFixCount += 1;

    const fullBody = entry.bullets
      .map((b) => [b.text, ...b.subItems].join('\n'))
      .join('\n');

    const touchedFiles = extractUniqueMatches(fullBody, FILE_PATH_PATTERN);
    const testFiles = extractUniqueMatches(fullBody, TEST_PATH_PATTERN);
    for (const f of touchedFiles) allFiles.add(f);
    for (const t of testFiles) allTests.add(t);

    const subsystems = detectSubsystems(entry.title, fullBody, touchedFiles);
    for (const sub of subsystems) {
      subsystemCounts[sub] += 1;
    }

    return {
      id: `update-${idx + 1}`,
      index: idx + 1,
      releaseGroup: entry.releaseGroup,
      kind: entry.kind,
      kindLabel: kindLabelFor(entry.kind),
      title: entry.title,
      bullets: entry.bullets,
      subsystems,
      touchedFiles,
      testFiles,
      testSummary: extractTestSummary(entry.bullets),
      relatedPublicSummary: findRelatedPublicSummary(entry.title),
    };
  });

  return {
    totalEntries: updates.length,
    fixedCount,
    addedCount,
    infraFixCount,
    uniqueFilesCount: allFiles.size,
    uniqueTestFilesCount: allTests.size,
    subsystemCounts,
    updates,
    checklist,
  };
}
