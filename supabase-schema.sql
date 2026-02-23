create extension if not exists "pgcrypto";

create table if not exists public.letters (
  id uuid primary key,
  sender_name text not null,
  sender_country text,
  recipient_name text,
  recipient_email text,
  letter_content text not null,
  delay_minutes integer not null default 0,
  image_urls text[] not null default '{}',
  video_urls text[] not null default '{}',
  audio_url text,
  stamp_data text,
  paper_theme text not null default 'classic',
  edit_password_hash text,
  opening_animation text not null default 'unfold',
  ambience_music boolean not null default false,
  handwriting_mode boolean not null default false,
  stickers text[] not null default '{}',
  capsule_seal text not null default 'wax',
  signature_data text,
  holiday_theme text not null default 'none',
  schedule_time timestamptz not null,
  created_at timestamptz not null default now()
);

alter table if exists public.letters
  add column if not exists stamp_data text;

alter table if exists public.letters
  add column if not exists paper_theme text not null default 'classic';

alter table if exists public.letters
  add column if not exists edit_password_hash text;

alter table if exists public.letters
  add column if not exists sender_country text;

alter table if exists public.letters
  add column if not exists video_urls text[] not null default '{}';

alter table if exists public.letters
  add column if not exists opening_animation text not null default 'unfold';

alter table if exists public.letters
  add column if not exists ambience_music boolean not null default false;

alter table if exists public.letters
  add column if not exists handwriting_mode boolean not null default false;

alter table if exists public.letters
  add column if not exists stickers text[] not null default '{}';

alter table if exists public.letters
  add column if not exists capsule_seal text not null default 'wax';

alter table if exists public.letters
  add column if not exists signature_data text;

alter table if exists public.letters
  add column if not exists holiday_theme text not null default 'none';

create index if not exists idx_letters_created_at on public.letters (created_at desc);
