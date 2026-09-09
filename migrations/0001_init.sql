-- Drop MVP schema.

create extension if not exists pgcrypto;

create table if not exists users (
  id               uuid primary key default gen_random_uuid(),
  external_user_id text not null unique,
  display_name     text not null,
  email            text not null,
  created_at       timestamptz not null default now(),
  last_login_at    timestamptz
);

create index if not exists users_email_idx on users (lower(email));

create table if not exists sites (
  id               uuid primary key default gen_random_uuid(),
  path             text not null unique,
  owner_user_id    uuid not null references users (id) on delete restrict,
  storage_prefix   text,
  status           text not null check (status in ('active', 'expired')),
  spa              boolean not null default false,
  expires_at       timestamptz,
  size_bytes       bigint not null default 0,
  file_count       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_deployed_at timestamptz
);

create index if not exists sites_owner_idx on sites (owner_user_id, last_deployed_at desc);
create index if not exists sites_status_expires_idx on sites (status, expires_at);

create table if not exists cli_auth_requests (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  status     text not null check (status in ('pending', 'approved', 'denied')),
  user_id    uuid references users (id) on delete cascade,
  token_hash text,
  token      text,               -- plaintext, handed to the CLI once on poll then nulled
  hostname   text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists cli_auth_requests_created_idx on cli_auth_requests (created_at);

create table if not exists cli_tokens (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  user_id      uuid not null references users (id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);

create index if not exists cli_tokens_user_idx on cli_tokens (user_id);
