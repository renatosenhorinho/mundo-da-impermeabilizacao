-- ============================================================
-- MDI — Setup da tabela analytics_events no Supabase
-- Execute no SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Criar tabela (se não existir)
create table if not exists analytics_events (
  id          uuid        default gen_random_uuid() primary key,
  event_type  text        not null,
  page_url    text,
  session_id  text,
  device      text,
  event_data  jsonb,
  created_at  timestamptz default timezone('utc', now())
);

-- Índices para performance no dashboard
create index if not exists idx_analytics_events_session_id  on analytics_events(session_id);
create index if not exists idx_analytics_events_event_type  on analytics_events(event_type);
create index if not exists idx_analytics_events_created_at  on analytics_events(created_at desc);

-- ============================================================
-- 2. Row Level Security
-- ============================================================

alter table analytics_events enable row level security;

-- Permite qualquer pessoa inserir (visitantes do site, sem auth)
drop policy if exists "Allow insert" on analytics_events;
create policy "Allow insert"
  on analytics_events
  for insert
  with check (true);

-- Apenas admins autenticados podem ler
drop policy if exists "Allow select for admin" on analytics_events;
create policy "Allow select for admin"
  on analytics_events
  for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- 3. Verificação — rode para confirmar que funcionou
-- ============================================================
select count(*) as total_eventos from analytics_events;
