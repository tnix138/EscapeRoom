-- تماشاخانه اُرفه‌ئو — اسکیما اولیه PostgreSQL (Supabase)
-- اجرا روی Supabase فقط توسط ایجنت چهارم زیرساخت (با مدیریت توحید) انجام می‌شود؛
-- این فایل صرفاً تعریف اسکیماست و هیچ کلید محرمانه‌ای در آن نیست.
-- لایه دسترسی (src/server/db/supabase-repository.ts) با همین جدول و از طریق PostgREST کار می‌کند.

create table if not exists public.rooms (
  code       text primary key,
  version    integer not null default 1,
  phase      text not null check (phase in ('alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater')),
  state_json text not null,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists rooms_phase_idx on public.rooms (phase);
create index if not exists rooms_updated_at_idx on public.rooms (updated_at);

comment on table public.rooms is 'وضعیت ماندگار اتاق‌های بازی پرده سرخ (هر ردیف = یک اتاق، state_json = InternalRoomState)';
comment on column public.rooms.version is 'نسخه OCC؛ ذخیره مشروط با WHERE code = ? AND version = ? انجام می‌شود';

-- دسترسی فقط از سمت سرور با service_role انجام می‌شود؛ RLS فعال و بدون policy عمومی می‌ماند.
alter table public.rooms enable row level security;
