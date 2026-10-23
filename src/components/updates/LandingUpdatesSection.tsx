'use client';

import { useState } from 'react';
import {
  PUBLIC_UPDATES,
  PUBLIC_UPDATE_FILTERS,
  type PublicUpdateCategory,
} from '@/updates/project-updates';

const INITIAL_VISIBLE_COUNT = 3;

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

function toFaDigits(value: number): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export default function LandingUpdatesSection() {
  const [activeCategory, setActiveCategory] = useState<PublicUpdateCategory>('all');
  const [expandedAll, setExpandedAll] = useState(false);

  const filtered =
    activeCategory === 'all'
      ? PUBLIC_UPDATES
      : PUBLIC_UPDATES.filter((item) => item.category === activeCategory);

  const shouldTruncate =
    activeCategory === 'all' && !expandedAll && filtered.length > INITIAL_VISIBLE_COUNT;

  const visibleItems = shouldTruncate
    ? filtered.slice(0, INITIAL_VISIBLE_COUNT)
    : filtered;

  return (
    <section
      className="updates-section"
      id="updates"
      aria-labelledby="updates-heading"
    >
      <div className="section-heading">
        <span className="section-index">
          ۰۲ <i />
        </span>
        <div>
          <p className="eyebrow">دفتر وقایع تماشاخانه</p>
          <h2 id="updates-heading">آخرین آپدیت‌ها و بهبودهای بازی</h2>
        </div>
        <p className="section-aside">
          مروری کوتاه بر تغییرات تازه،
          <br />
          برای تجربه‌ای روان‌تر در هر پرده.
        </p>
      </div>

      <div
        className="updates-filter-bar"
        role="tablist"
        aria-label="دسته‌بندی آپدیت‌های بازی"
      >
        {PUBLIC_UPDATE_FILTERS.map((filter) => {
          const isSelected = activeCategory === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`updates-filter-pill${isSelected ? ' is-active' : ''}`}
              onClick={() => {
                setActiveCategory(filter.id);
              }}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="updates-grid">
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className={`update-card${item.isLatest ? ' is-latest' : ''}`}
          >
            <div className="update-card-top">
              <span className={`update-badge${item.isLatest ? ' is-latest' : ''}`}>
                {item.isLatest && <span className="status-dot" aria-hidden="true" />}
                {item.badge}
              </span>
              <span className="update-order">{item.orderLabel}</span>
            </div>

            <h3 className="update-card-title">{item.title}</h3>
            <p className="update-card-summary">{item.summary}</p>

            <ul className="update-highlights">
              {item.highlights.map((point) => (
                <li key={point}>
                  <span className="update-bullet-mark" aria-hidden="true">
                    ✦
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="update-card-footer">
              <span className="update-category-tag">{item.categoryLabel}</span>
            </div>
          </article>
        ))}
      </div>

      {activeCategory === 'all' && filtered.length > INITIAL_VISIBLE_COUNT && (
        <div className="updates-more-wrap">
          <button
            type="button"
            className="updates-more-button"
            aria-expanded={expandedAll}
            onClick={() => setExpandedAll((prev) => !prev)}
          >
            {expandedAll
              ? 'نمایش خلاصه‌تر آپدیت‌ها'
              : `مشاهدهٔ همهٔ آپدیت‌ها (${toFaDigits(filtered.length)} مورد)`}
          </button>
        </div>
      )}
    </section>
  );
}
