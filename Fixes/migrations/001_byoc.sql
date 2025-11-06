-- Phase 1 BYOC schema (PostgreSQL)
create extension if not exists "uuid-ossp";

create table if not exists providers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('aws','gcp','azure','custom')),
  created_at timestamptz not null default now()
);

create table if not exists provider_tokens (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references providers(id) on delete cascade,
  status text not null check (status in ('active','revoked','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists evidence_collections (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references providers(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists evidence_references (
  id uuid primary key default uuid_generate_v4(),
  collection_id uuid not null references evidence_collections(id) on delete cascade,
  uri text not null,
  hash_sha256 char(64) not null,
  size bigint not null check (size >= 0),
  added_at timestamptz not null default now(),
  metadata jsonb
);

create index if not exists idx_evr_col on evidence_references(collection_id);
create index if not exists idx_evr_hash on evidence_references(hash_sha256);
create unique index if not exists uq_evr_col_hash on evidence_references(collection_id, hash_sha256);
