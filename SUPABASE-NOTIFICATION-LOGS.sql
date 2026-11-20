-- Al-Maheen Academy: transactional email notification history
-- Run once in the Supabase SQL Editor before enabling trial email notifications.

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  free_trial_id uuid references public.free_trials(id) on delete set null,
  recipient text,
  channel text not null default 'email' check (channel in ('email')),
  event_type text not null check (event_type in ('approved', 'rejected', 'rescheduled', 'booked')),
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider text not null default 'resend',
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notification_logs_free_trial_id_idx
  on public.notification_logs(free_trial_id);

create index if not exists notification_logs_created_at_idx
  on public.notification_logs(created_at desc);

alter table public.notification_logs enable row level security;

-- The server uses the Supabase service-role key for inserts.
-- No browser/client policies are created, so ordinary users cannot read these logs.
