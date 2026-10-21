'use client';

/**
 * /room/[code] — صفحه اصلی اتاق بازی و سوئیچر فازهای فصل اول (علیرضا، موج ۳)
 * -----------------------------------------------------------------------------------
 * منبع: TASKS-ALIREZA.md موج ۳ بند ۴ — مونتاژ نهایی تجربه بازی:
 *   alley_puzzle  ← صحنه کوچه امیرعلی (تا رسیدن آن: فال‌بک یکپارچه‌سازی موقت همین فایل)
 *   door_cutscene / theater_cutscene ← FirstPersonCutsceneStage علیرضا
 *   in_theater    ← DarkAuditoriumScene علیرضا
 * وضعیت زنده اتاق و ساعت میلی‌ثانیه‌ای کات‌سین از useTheaterSession توحید
 * (src/client-sdk — قرارداد API-CONTRACT.md بخش ۴.۱) می‌آید و با Refresh حفظ می‌شود.
 * توکن صندلی: صفحه دعوت امیرعلی آن را در حافظه مرورگر (کلید `seat:<code>`) می‌گذارد؛
 * تا تحویل صفحه دعوت، ورود مستقیم با ?token=<seatToken> هم پشتیبانی می‌شود.
 *
 * ⚠️ فال‌بک موقت کوچه (AlleyIntegrationFallback): فقط برای قابل‌بازی بودن سرتاسری
 * فصل اول تا مرج صحنه رسمی امیرعلی است و هیچ فایلی در پوشه‌های او ساخته نشده؛
 * به‌محض تحویل src/components/alley/AlleyFirstPersonScene جایگزین همین بخش می‌شود.
 */

import {
  Suspense,
  use,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  ClientRoomView,
  PlayActNumber,
  RowRomanCode,
  TheaterEmblemId,
} from '@/contracts/types';
import type { GameActionPayload } from '@/contracts/actions';
import { useTheaterSession } from '@/client-sdk';
import FirstPersonCutsceneStage from '@/components/cinema/FirstPersonCutsceneStage';
import DarkAuditoriumScene from '@/components/auditorium/DarkAuditoriumScene';
import styles from './page.module.css';

const EMBLEMS: ReadonlyArray<{ id: TheaterEmblemId; label: string }> = [
  { id: 'mask', label: '🎭 نقاب نمایش' },
  { id: 'violin', label: '🎻 ویولن کلاسیک' },
  { id: 'dancer', label: '🩰 رقصنده ایتالیایی' },
  { id: 'candelabra', label: '🕯️ شمعدان نقره' },
  { id: 'rose', label: '🌹 رز مخملی' },
  { id: 'swan', label: '🦢 قو سفید' },
  { id: 'hourglass', label: '⏳ ساعت شنی' },
  { id: 'bell', label: '🔔 زنگ پرده' },
];

function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function emblemLabel(id: TheaterEmblemId): string {
  return EMBLEMS.find((e) => e.id === id)?.label ?? id;
}

/* ====================================================================================
 * فال‌بک موقت یکپارچه‌سازی فاز کوچه — جایگزین صحنه رسمی امیرعلی پس از مرج او
 * ==================================================================================== */

function AlleyIntegrationFallback({
  room,
  performAction,
  sendWhisper,
}: {
  room: ClientRoomView;
  performAction: (action: GameActionPayload) => Promise<{ accepted: boolean; message: string }>;
  sendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
}) {
  const ticket = room.myHeldTickets.mainTicket;
  const stub = room.myHeldTickets.companionStub;
  const [emblem, setEmblem] = useState<TheaterEmblemId>(
    ticket.selectedPunch?.emblem ?? 'mask',
  );
  const [actNumber, setActNumber] = useState<PlayActNumber>(
    ticket.selectedPunch?.actNumber ?? 1,
  );
  const [rowCode, setRowCode] = useState<RowRomanCode>(
    ticket.selectedPunch?.rowCode ?? 'I',
  );
  const [doorCode, setDoorCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [whisperDraft, setWhisperDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ accepted: boolean; message: string } | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (result) setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'خطای شبکه؛ دوباره تلاش کن.');
    } finally {
      setBusy(false);
    }
  };

  const handleWhisper = async (event: FormEvent) => {
    event.preventDefault();
    const text = whisperDraft.trim();
    if (!text) return;
    await run(async () => {
      await sendWhisper(text);
      setWhisperDraft('');
    });
  };

  /* کارت دعوت موقت تا رسیدن ویدیوی گرافیکی امیرعلی */
  if (!room.me.hasWatchedInvitation) {
    return (
      <div className={styles.alleyRoot} data-testid="alley-fallback">
        <div className={styles.invitationCard}>
          <div className={styles.envelope}>✉️✦</div>
          <h1>کارت دعوت تماشاخانه اُرفه‌ئو</h1>
          <p>
            <strong>{room.me.playerName}</strong> عزیز، امشب به اجرای ویژه نمایش‌نامه
            «پرده سرخ» در تماشاخانه اُرفه‌ئو دعوت شده‌ای.
            جایگاه تو: <strong>{room.me.seatLabel}</strong>
          </p>
          <p className={styles.fallbackNote}>
            🎬 ویدیوی گرافیکی اول‌شخص باز شدن این پاکت، بخش امیرعلی است و به‌زودی جایگزین این کارت موقت می‌شود.
          </p>
          <button
            type="button"
            data-testid="complete-invitation"
            className={styles.primaryButton}
            disabled={busy}
            onClick={() => void run(() => performAction({ type: 'COMPLETE_INVITATION_VIDEO' }))}
          >
            گشودن پاکت و رفتن به کوچه تماشاخانه ←
          </button>
          {feedback && <p className={styles.feedback}>{feedback}</p>}
        </div>
      </div>
    );
  }

  const lock = room.alley.doorLockState;
  const allPunched = lock.punchedCount >= lock.requiredCount;

  return (
    <div className={styles.alleyRoot} data-testid="alley-fallback">
      <header className={styles.alleyHeader}>
        <h1>🌙 کوچه تماشاخانه اُرفه‌ئو — معمای بلیط‌ها</h1>
        <p>
          {room.me.playerName} — {room.me.seatLabel} | بلیط‌های پانچ‌شده تیم:{' '}
          {toFaDigits(lock.punchedCount)} از {toFaDigits(lock.requiredCount)}
        </p>
        <p className={styles.fallbackNote}>
          ⚠️ نمای موقت یکپارچه‌سازی: صحنه اول‌شخص رسمی کوچه متعلق به امیرعلی است و پس از مرج او جایگزین می‌شود؛ منطق معما همین حالا واقعی و متصل به سرور است.
        </p>
      </header>

      <div className={styles.alleyGrid}>
        {/* بلیط اصلی خود بازیکن + پانچ برنجی */}
        <section className={styles.card}>
          <h2>🎫 بلیط اصلی تو — {ticket.ownerName}</h2>
          <p>{ticket.playTitle}</p>
          <p>
            {ticket.seatLabel} | راهنمای ردیف روی بلیط: <strong>{ticket.alleyRowHintName}</strong>
          </p>
          {ticket.isValidated ? (
            <p className={styles.validated}>
              ✓ بلیطت پانچ و معتبر شد! رقم طلایی خط برش تو:{' '}
              <strong data-testid="golden-digit">
                {ticket.revealedGoldenDigit != null ? toFaDigits(ticket.revealedGoldenDigit) : '؟'}
              </strong>
            </p>
          ) : (
            <>
              <label>
                نماد صحنه
                <select data-testid="punch-emblem" value={emblem} onChange={(e) => setEmblem(e.target.value as TheaterEmblemId)}>
                  {EMBLEMS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                شماره پرده
                <select data-testid="punch-act" value={actNumber} onChange={(e) => setActNumber(Number(e.target.value) as PlayActNumber)}>
                  {[1, 2, 3, 4].map((act) => (
                    <option key={act} value={act}>پرده {toFaDigits(act)}</option>
                  ))}
                </select>
              </label>
              <label>
                کد رومی ردیف
                <select data-testid="punch-row" value={rowCode} onChange={(e) => setRowCode(e.target.value as RowRomanCode)}>
                  {(['I', 'II', 'III', 'IV'] as RowRomanCode[]).map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                data-testid="punch-submit"
                className={styles.primaryButton}
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    performAction({ type: 'PUNCH_MY_TICKET', emblem, actNumber, rowCode }),
                  )
                }
              >
                🔨 پانچ برنجی بلیط من
              </button>
            </>
          )}
        </section>

        {/* کوپن هم‌تیمی — قلب معمای حلقوی */}
        <section className={styles.card} data-testid="companion-stub">
          <h2>🧩 کوپن هم‌تیمی تو</h2>
          <p>
            این کوپن متعلق به بلیط <strong>{stub.targetTeammateName}</strong> است؛
            بدون تو او نمی‌تواند بلیطش را پانچ کند!
          </p>
          <ul className={styles.stubList}>
            <li>نماد صحنه او: <strong>{emblemLabel(stub.targetEmblem)}</strong></li>
            <li>عنوان پرده او: <strong>{stub.targetActSceneTitle}</strong> (شماره‌اش را از پوستر سمت چپ پیدا کنید)</li>
            <li>یادداشت پشت کوپن: «{stub.whisperNote}»</li>
          </ul>
          <button
            type="button"
            data-testid="share-stub"
            className={styles.button}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await sendWhisper('', true);
                setFeedback('مشخصات کوپن با تیم به اشتراک گذاشته شد ✓');
              })
            }
          >
            📣 اشتراک کوپن با تیم
          </button>
        </section>

        {/* تابلوهای چپ و راست کوچه */}
        <section className={styles.card}>
          <h2>🖼️ تابلوی سمت چپ — پرده‌های امشب</h2>
          <ul className={styles.stubList}>
            {room.alley.leftWallPlaybill.map((item) => (
              <li key={item.actNumber}>
                پرده {toFaDigits(item.actNumber)}: <strong>{item.sceneTitle}</strong> — {item.description}
              </li>
            ))}
          </ul>
          <h2>🪟 پنجره سمت راست — تبدیل ردیف به کد رومی</h2>
          <ul className={styles.stubList}>
            {room.alley.rightWallRowChart.map((item) => (
              <li key={item.romanCode}>
                {item.rowTitle} ← <strong>{item.romanCode}</strong>
              </li>
            ))}
          </ul>
        </section>

        {/* گیشه مکانیکی و قفل در */}
        <section className={styles.card}>
          <h2>🚪 گیشه برنجی و قفل در تالار</h2>
          <ul className={styles.stubList}>
            {room.players.map((player) => (
              <li key={player.playerId}>
                {player.ticketPunched ? '🟢' : '⚪'} {player.playerName} — {player.seatLabel}
                {player.revealedDoorDigit != null && (
                  <> | رقم طلایی: <strong>{toFaDigits(player.revealedDoorDigit)}</strong></>
                )}
              </li>
            ))}
          </ul>
          <p>ارقام طلایی همه را به ترتیب صندلی ۱ تا {toFaDigits(lock.requiredCount)} کنار هم بگذار:</p>
          <div className={styles.unlockRow}>
            <input
              data-testid="door-code-input"
              value={doorCode}
              onChange={(e) => setDoorCode(e.target.value)}
              placeholder={`رمز ${toFaDigits(lock.requiredCount)} رقمی در`}
              inputMode="numeric"
              aria-label="رمز قفل در تالار"
            />
            <button
              type="button"
              data-testid="door-unlock"
              className={styles.primaryButton}
              disabled={busy || !allPunched}
              onClick={() =>
                void run(() => performAction({ type: 'UNLOCK_THEATER_DOOR', code: doorCode.trim() }))
              }
            >
              🔓 باز کردن در تالار
            </button>
          </div>
          {!allPunched && <p className={styles.hint}>قفل وقتی فعال می‌شود که بلیط هر {toFaDigits(lock.requiredCount)} نفر پانچ شده باشد.</p>}
          {lock.lastAttemptFeedback && <p className={styles.feedback}>{lock.lastAttemptFeedback}</p>}
        </section>
      </div>

      {/* نجوای تیمی کوچه */}
      <section className={styles.card}>
        <h2>🤫 نجوای تیمی</h2>
        <div className={styles.messages}>
          {room.messages.length === 0 ? (
            <p className={styles.hint}>هنوز پیامی نیست؛ سرنخ کوپنت را برای هم‌تیمی‌ات بخوان!</p>
          ) : (
            room.messages.slice(-30).map((message) => (
              <p key={message.id} className={styles.messageLine}>
                <strong>{message.senderName}:</strong> {message.text}
              </p>
            ))
          )}
        </div>
        <form className={styles.whisperForm} onSubmit={(e) => void handleWhisper(e)}>
          <input
            data-testid="alley-whisper-input"
            value={whisperDraft}
            onChange={(e) => setWhisperDraft(e.target.value)}
            placeholder="نجوا به تیم…"
            maxLength={300}
            aria-label="متن نجوای تیمی"
          />
          <button type="submit" className={styles.button} disabled={busy || !whisperDraft.trim()}>
            ارسال
          </button>
        </form>
      </section>

      {feedback && (
        <p className={styles.feedbackBar} data-testid="alley-feedback">{feedback}</p>
      )}
    </div>
  );
}

/* ====================================================================================
 * صفحه اتاق
 * ==================================================================================== */

function RoomPageInner({ code }: { code: string }) {
  const roomCode = decodeURIComponent(code);
  const searchParams = useSearchParams();
  const queryToken = searchParams.get('token');

  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      setStoredToken(
        sessionStorage.getItem(`seat:${roomCode}`) ??
          localStorage.getItem(`seat:${roomCode}`),
      );
    } catch {
      setStoredToken(null);
    }
    setTokenChecked(true);
  }, [roomCode]);

  const seatToken = queryToken ?? storedToken ?? '';
  const { loading, room, cutsceneElapsedMs, error, performAction, sendWhisper } =
    useTheaterSession(roomCode, seatToken);

  if (!tokenChecked) {
    return (
      <main className={styles.centerState}>
        <p>در حال یافتن صندلی تو در تماشاخانه… 🎭</p>
      </main>
    );
  }

  if (!seatToken) {
    return (
      <main className={styles.centerState}>
        <div className={styles.stateCard}>
          <div className={styles.stateIcon}>🎫</div>
          <h1>لینک دعوت اختصاصی لازم است</h1>
          <p>
            برای ورود به اتاق <strong dir="ltr">{roomCode}</strong> باید از لینک دعوت
            اختصاصی خودت که میزبان برایت فرستاده وارد شوی؛ هر صندلی لینک و بلیط مخصوص خودش را دارد.
          </p>
        </div>
      </main>
    );
  }

  if (loading && !room) {
    return (
      <main className={styles.centerState}>
        <p>در حال گشودن درهای تماشاخانه اُرفه‌ئو… 🕯️</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className={styles.centerState}>
        <div className={styles.stateCard}>
          <div className={styles.stateIcon}>🚪</div>
          <h1>اتاق پیدا نشد</h1>
          <p>{error ?? 'کد اتاق یا لینک دعوت معتبر نیست. لینک را دوباره از میزبان بگیر.'}</p>
        </div>
      </main>
    );
  }

  /* فاز معمای کوچه */
  if (room.phase === 'alley_puzzle') {
    return (
      <main className={styles.alleyPage}>
        <AlleyIntegrationFallback
          room={room}
          performAction={performAction}
          sendWhisper={sendWhisper}
        />
      </main>
    );
  }

  /* فاز شروع مجدد در سالن تاریک — پایان فصل اول */
  if (room.phase === 'in_theater') {
    return (
      <main className={styles.fullscreenStage}>
        <DarkAuditoriumScene
          room={room}
          muted={muted}
          onToggleMute={() => setMuted((prev) => !prev)}
          onInspectHotspot={async (hotspotId) => {
            await performAction({ type: 'INSPECT_AUDITORIUM_HOTSPOT', hotspotId });
          }}
          onSendWhisper={async (text) => {
            await sendWhisper(text);
          }}
        />
      </main>
    );
  }

  /* فازهای کات‌سین دربان و سالن — تمام‌صفحه و همگام با ساعت سرور */
  return (
    <main className={styles.fullscreenStage}>
      <FirstPersonCutsceneStage
        room={room}
        elapsedMs={cutsceneElapsedMs}
        muted={muted}
        onToggleMute={() => setMuted((prev) => !prev)}
      />
    </main>
  );
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return (
    <Suspense
      fallback={
        <main className={styles.centerState}>
          <p>در حال گشودن درهای تماشاخانه اُرفه‌ئو… 🕯️</p>
        </main>
      }
    >
      <RoomPageInner code={code} />
    </Suspense>
  );
}
