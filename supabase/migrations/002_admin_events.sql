-- تماشاخانه اُرفه‌ئو — مایگریشن ۰۰۲: جدول رویدادهای ادمین
-- مرجع: قرارداد ۶ در docs/CONTRACTS.md و فاز ۱۰/۱۳
-- اجرا فقط توسط توحید روی Supabase انجام می‌شود؛ این فایل هیچ کلید محرمانه‌ای ندارد.

create table if not exists public.admin_events (
  id         text primary key,
  type       text not null check (type in (
               'room_created', 'player_joined', 'puzzle_solved', 'door_attempt',
               'phase_changed', 'chat_message', 'player_removed', 'error'
             )),
  room_code  text,
  player_id  text,
  payload    jsonb not null default '{}'::jsonb,
  created_at bigint not null
);

create index if not exists admin_events_created_at_idx on public.admin_events (created_at desc);
create index if not exists admin_events_room_code_idx on public.admin_events (room_code);
create index if not exists admin_events_type_idx on public.admin_events (type);

comment on table public.admin_events is 'رویدادهای پنل ادمین (قرارداد ۶) — فقط از سمت سرور با service_role نوشته می‌شود';
comment on column public.admin_events.payload is 'دادهٔ اضافی رویداد؛ نباید شامل توکن صندلی یا جواب معما باشد';

-- دسترسی فقط از سمت سرور؛ RLS فعال و بدون policy عمومی.
alter table public.admin_events enable row level security;

-- پشتیبانی از داشبورد آمار: شمارش سریع اتاق‌های فعال و آنلاین‌ها
create index if not exists rooms_created_at_idx on public.rooms (created_at desc);
