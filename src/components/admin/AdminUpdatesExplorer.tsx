'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import StatsCard from './StatsCard';
import { faDigits } from './format';
import {
  badgeStyle,
  buttonStyle,
  hintStyle,
  inputStyle,
  panelStyle,
  titleStyle,
} from './styles';
import {
  SUBSYSTEM_META,
  type AdminTechnicalUpdate,
  type AdminUpdateKind,
  type AdminUpdatesOverview,
  type TechnicalSubsystem,
} from '@/updates/project-updates';

export interface AdminUpdatesExplorerProps {
  overview: AdminUpdatesOverview;
}

type KindFilter = 'all' | AdminUpdateKind;
type SubsystemFilter = 'all' | TechnicalSubsystem;

const SUBSYSTEM_ORDER: readonly TechnicalSubsystem[] = [
  'multiplayer',
  'engine3d',
  'hud_ui',
  'audio',
  'mobile_pwa',
  'admin_security',
  'infra_ci',
];

const KIND_FILTERS: ReadonlyArray<{ id: KindFilter; label: string }> = [
  { id: 'all', label: 'همهٔ انواع' },
  { id: 'fixed', label: 'اصلاح و بهبود فنی' },
  { id: 'added', label: 'افزوده شد (قابلیت / فاز)' },
  { id: 'infra_fix', label: 'رفع زیرساختی' },
];

const inlineCodeStyle: CSSProperties = {
  direction: 'ltr',
  unicodeBidi: 'embed',
  display: 'inline-block',
  padding: '1px 6px',
  margin: '0 2px',
  borderRadius: 5,
  border: '1px solid rgba(212, 175, 99, 0.24)',
  background: 'rgba(18, 13, 16, 0.82)',
  color: 'var(--gold-light)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 'var(--text-xs)',
};

const pathChipStyle: CSSProperties = {
  direction: 'ltr',
  unicodeBidi: 'embed',
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 9px',
  borderRadius: 6,
  border: '1px solid rgba(212, 175, 99, 0.2)',
  background: 'var(--ink-soft)',
  color: 'var(--text-primary)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 'var(--text-xs)',
};

const testChipStyle: CSSProperties = {
  ...pathChipStyle,
  borderColor: 'rgba(120, 195, 140, 0.34)',
  background: 'rgba(35, 86, 52, 0.22)',
  color: '#b8eec1',
};

/**
 * قالب‌بندی عبارات فنی داخل بولت‌های CHANGELOG (`code` و **bold**) بدون dangerouslySetInnerHTML.
 */
function renderTechnicalInline(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={idx} style={inlineCodeStyle}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} style={{ color: 'var(--gold-light)', fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function matchesSearch(update: AdminTechnicalUpdate, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  if (update.title.toLowerCase().includes(q)) return true;
  if (update.touchedFiles.some((f) => f.toLowerCase().includes(q))) return true;
  if (update.testFiles.some((t) => t.toLowerCase().includes(q))) return true;
  if (update.relatedPublicSummary?.toLowerCase().includes(q)) return true;
  return update.bullets.some(
    (b) =>
      b.text.toLowerCase().includes(q) ||
      b.subItems.some((sub) => sub.toLowerCase().includes(q)),
  );
}

function kindBadgeTone(kind: AdminUpdateKind): 'ok' | 'warn' | 'off' {
  if (kind === 'added') return 'ok';
  if (kind === 'fixed') return 'warn';
  return 'off';
}

export default function AdminUpdatesExplorer({ overview }: AdminUpdatesExplorerProps) {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [subsystemFilter, setSubsystemFilter] = useState<SubsystemFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of overview.updates.slice(0, 5)) {
      initial[item.id] = true;
    }
    return initial;
  });

  const filteredUpdates = useMemo(
    () =>
      overview.updates.filter((item) => {
        if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
        if (subsystemFilter !== 'all' && !item.subsystems.includes(subsystemFilter)) {
          return false;
        }
        return matchesSearch(item, query);
      }),
    [overview.updates, kindFilter, subsystemFilter, query],
  );

  const doneChecklistCount = overview.checklist.filter((c) => c.done).length;

  const allFilteredExpanded =
    filteredUpdates.length > 0 && filteredUpdates.every((u) => expandedIds[u.id]);

  function toggleOne(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllFiltered() {
    const nextValue = !allFilteredExpanded;
    setExpandedIds((prev) => {
      const next = { ...prev };
      for (const item of filteredUpdates) {
        next[item.id] = nextValue;
      }
      return next;
    });
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {/* ۱. کارت‌های آمار کلی */}
      <section
        aria-label="آمار آپدیت‌های پروژه"
        style={{
          display: 'grid',
          gap: 'var(--space-3)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        <StatsCard
          label="کل آپدیت‌های مستندشده"
          value={faDigits(overview.totalEntries)}
          hint={`${faDigits(overview.fixedCount)} اصلاح فنی · ${faDigits(overview.addedCount)} قابلیت و فاز`}
        />
        <StatsCard
          label="ماژول‌ها و فایل‌های فنی"
          value={faDigits(overview.uniqueFilesCount)}
          hint="مسیرهای کد و پیکربندی ثبت‌شده در تغییرات"
        />
        <StatsCard
          label="فایل‌های تست رگرسیون"
          value={faDigits(overview.uniqueTestFilesCount)}
          hint="پوشش خودکار Vitest / Playwright در آپدیت‌ها"
        />
        <StatsCard
          label="چک‌لیست استقرار نهایی"
          value={`${faDigits(doneChecklistCount)} / ${faDigits(overview.checklist.length)}`}
          hint="وضعیت موارد باقی‌ماندهٔ انتشار در CHANGELOG"
          tone={doneChecklistCount < overview.checklist.length ? 'warn' : 'default'}
        />
      </section>

      {/* ۲. ماتریس زیرسیستم‌های فنی */}
      <section aria-label="پوشش زیرسیستم‌های فنی" style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <h2 style={titleStyle}>تفکیک آپدیت‌ها بر اساس زیرسیستم فنی</h2>
          {subsystemFilter !== 'all' && (
            <button
              type="button"
              style={buttonStyle}
              onClick={() => setSubsystemFilter('all')}
            >
              نمایش همهٔ زیرسیستم‌ها
            </button>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gap: 8,
            gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
          }}
        >
          {SUBSYSTEM_ORDER.map((subId) => {
            const meta = SUBSYSTEM_META[subId];
            const active = subsystemFilter === subId;
            return (
              <button
                key={subId}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setSubsystemFilter((prev) => (prev === subId ? 'all' : subId))
                }
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: active
                    ? '1px solid var(--gold)'
                    : '1px solid var(--line)',
                  background: active
                    ? 'linear-gradient(135deg, rgba(107, 16, 32, 0.52), rgba(36, 25, 29, 0.95))'
                    : 'var(--ink-soft)',
                  color: active ? 'var(--gold-light)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'start',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <span>{meta.label}</span>
                <strong
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(212, 175, 99, 0.14)',
                    color: 'var(--gold-light)',
                  }}
                >
                  {faDigits(overview.subsystemCounts[subId])}
                </strong>
              </button>
            );
          })}
        </div>
      </section>

      {/* ۳. نوار جستجو و فیلتر دقیق */}
      <section aria-label="فیلتر و جستجوی آپدیت‌ها" style={panelStyle}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در عنوان، جزئیات فنی، نام فایل (مثلاً room-service.ts) یا تست…"
              aria-label="جستجوی فنی در آپدیت‌ها"
              style={inputStyle}
            />
            <button type="button" style={buttonStyle} onClick={toggleAllFiltered}>
              {allFilteredExpanded ? 'جمع کردن همهٔ کارت‌ها' : 'باز کردن همهٔ جزئیات'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {KIND_FILTERS.map((item) => {
                const selected = kindFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setKindFilter(item.id)}
                    style={{
                      ...buttonStyle,
                      borderColor: selected ? 'var(--gold)' : 'var(--line)',
                      background: selected ? 'var(--wine)' : 'var(--ink-soft)',
                      color: selected ? 'var(--gold-light)' : 'var(--text-secondary)',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <span style={hintStyle}>
              نمایش <strong>{faDigits(filteredUpdates.length)}</strong> مورد از{' '}
              {faDigits(overview.totalEntries)} آپدیت ثبت‌شده
            </span>
          </div>
        </div>
      </section>

      {/* ۴. فهرست مشروح آپدیت‌های فنی */}
      <section
        aria-label="فهرست کامل آپدیت‌های فنی"
        style={{ display: 'grid', gap: 'var(--space-3)' }}
      >
        {filteredUpdates.length === 0 ? (
          <div style={panelStyle}>
            <p style={{ ...hintStyle, margin: 0 }}>
              هیچ آپدیتی با فیلتر یا عبارت جستجوشده پیدا نشد.
            </p>
          </div>
        ) : (
          filteredUpdates.map((item) => {
            const isOpen = Boolean(expandedIds[item.id]);
            const totalSubItems = item.bullets.reduce(
              (acc, b) => acc + b.subItems.length,
              0,
            );

            return (
              <article
                key={item.id}
                style={{
                  ...panelStyle,
                  borderColor:
                    item.index === 1
                      ? 'rgba(212, 175, 99, 0.42)'
                      : 'var(--line)',
                  background:
                    item.index === 1
                      ? 'radial-gradient(ellipse at 90% 0%, rgba(107, 16, 32, 0.28), transparent 60%), var(--panel)'
                      : 'var(--panel)',
                  display: 'grid',
                  gap: 12,
                }}
              >
                {/* سربرگ کارت */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'grid', gap: 8, flex: '1 1 320px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          padding: '2px 9px',
                          borderRadius: 999,
                          background: 'rgba(212, 175, 99, 0.14)',
                          color: 'var(--gold)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                        }}
                      >
                        #{faDigits(String(item.index).padStart(2, '0'))}
                      </span>
                      <span style={badgeStyle(kindBadgeTone(item.kind))}>
                        {item.kindLabel}
                      </span>
                      {item.index === 1 && (
                        <span
                          style={{
                            ...badgeStyle('warn'),
                            background: 'rgba(143, 33, 50, 0.42)',
                            borderColor: 'rgba(212, 175, 99, 0.48)',
                          }}
                        >
                          آخرین تغییر ثبت‌شده
                        </span>
                      )}
                      {item.subsystems.map((subId) => (
                        <span
                          key={subId}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            border: '1px solid rgba(212, 175, 99, 0.18)',
                            background: 'var(--ink-soft)',
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          {SUBSYSTEM_META[subId].shortLabel}
                        </span>
                      ))}
                    </div>

                    <h3
                      style={{
                        margin: 0,
                        fontSize: 'var(--text-base)',
                        lineHeight: 1.65,
                        color: 'var(--cream)',
                      }}
                    >
                      {item.title}
                    </h3>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        بولت‌های فنی:{' '}
                        <strong style={{ color: 'var(--text-secondary)' }}>
                          {faDigits(item.bullets.length + totalSubItems)}
                        </strong>
                      </span>
                      <span>
                        فایل‌های درگیر:{' '}
                        <strong style={{ color: 'var(--text-secondary)' }}>
                          {faDigits(item.touchedFiles.length)}
                        </strong>
                      </span>
                      <span>
                        فایل‌های تست:{' '}
                        <strong style={{ color: 'var(--text-secondary)' }}>
                          {faDigits(item.testFiles.length)}
                        </strong>
                      </span>
                      <span>نسخه: {item.releaseGroup}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleOne(item.id)}
                    style={buttonStyle}
                  >
                    {isOpen ? 'بستن جزئیات' : 'مشاهدهٔ کالبدشکافی فنی'}
                  </button>
                </div>

                {/* بدنهٔ کامل فنی در حالت باز */}
                {isOpen && (
                  <div
                    style={{
                      display: 'grid',
                      gap: 14,
                      paddingTop: 12,
                      borderTop: '1px solid rgba(212, 175, 99, 0.14)',
                    }}
                  >
                    {item.relatedPublicSummary && (
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid rgba(212, 175, 99, 0.2)',
                          background: 'rgba(107, 16, 32, 0.16)',
                          fontSize: 'var(--text-sm)',
                          lineHeight: 1.8,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <strong style={{ color: 'var(--gold-light)' }}>
                          خلاصهٔ نمایش‌داده‌شده در صفحهٔ اصلی:{' '}
                        </strong>
                        {item.relatedPublicSummary}
                      </div>
                    )}

                    {/* فهرست کامل بولت‌ها و زیربولت‌های فنی */}
                    <div>
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--gold)',
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        جزئیات فنی، معماری و تغییرات پیاده‌سازی:
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingInlineStart: 20,
                          display: 'grid',
                          gap: 8,
                          fontSize: 'var(--text-sm)',
                          lineHeight: 1.85,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {item.bullets.map((bullet, bIdx) => (
                          <li key={bIdx}>
                            <div>{renderTechnicalInline(bullet.text)}</div>
                            {bullet.subItems.length > 0 && (
                              <ul
                                style={{
                                  marginTop: 6,
                                  paddingInlineStart: 18,
                                  display: 'grid',
                                  gap: 5,
                                  color: 'var(--text-secondary)',
                                  fontSize: 'var(--text-sm)',
                                }}
                              >
                                {bullet.subItems.map((sub, sIdx) => (
                                  <li key={sIdx}>{renderTechnicalInline(sub)}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* تراشه‌های فایل‌های تغییریافته و تست‌های مرتبط */}
                    {(item.touchedFiles.length > 0 || item.testFiles.length > 0) && (
                      <div
                        style={{
                          display: 'grid',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'rgba(18, 13, 16, 0.56)',
                          border: '1px solid rgba(212, 175, 99, 0.12)',
                        }}
                      >
                        {item.touchedFiles.length > 0 && (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              فایل‌ها و ماژول‌های تغییریافته ({faDigits(item.touchedFiles.length)}):
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {item.touchedFiles.map((file) => (
                                <span key={file} style={pathChipStyle}>
                                  {file}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.testFiles.length > 0 && (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              تست‌های تضمین کیفیت ({faDigits(item.testFiles.length)}):
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {item.testFiles.map((testFile) => (
                                <span key={testFile} style={testChipStyle}>
                                  ✓ {testFile}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* ۵. چک‌لیست باقی‌ماندهٔ انتشار */}
      {overview.checklist.length > 0 && (
        <section aria-label="چک‌لیست انتشار" style={panelStyle}>
          <h2 style={titleStyle}>وضعیت چک‌لیست زیرساخت و انتشار تولیدی</h2>
          <ul
            style={{
              listStyle: 'none',
              margin: '10px 0 0',
              padding: 0,
              display: 'grid',
              gap: 8,
              fontSize: 'var(--text-sm)',
            }}
          >
            {overview.checklist.map((item, idx) => (
              <li
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--ink-soft)',
                  border: '1px solid rgba(212, 175, 99, 0.12)',
                  color: item.done ? '#b8eec1' : 'var(--text-secondary)',
                }}
              >
                <span aria-hidden="true">{item.done ? '✅' : '⏳'}</span>
                <span>{renderTechnicalInline(item.text)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
