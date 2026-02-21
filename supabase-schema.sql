create extension if not exists "pgcrypto";

create table if not exists public.letters (
  id uuid primary key,
  sender_name text not null,
  recipient_name text,
  recipient_email text,
  letter_content text not null,
  delay_minutes integer not null default 0,
  image_urls text[] not null default '{}',
  audio_url text,
  stamp_data text,
  paper_theme text not null default 'classic',
  schedule_time timestamptz not null,
  created_at timestamptz not null default now()
);

alter table if exists public.letters
  add column if not exists stamp_data text;

alter table if exists public.letters
  add column if not exists paper_theme text not null default 'classic';

create index if not exists idx_letters_created_at on public.letters (created_at desc);
