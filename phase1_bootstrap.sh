#!/usr/bin/env bash
set -euo pipefail

FIX="${FIX:-./Fixes}"
API_DIR="$FIX/api"
ERD_DIR="$FIX/erd"
CONTRACTS_DIR="$FIX/contracts"
MIG_DIR="$FIX/migrations"
mkdir -p "$API_DIR" "$ERD_DIR" "$CONTRACTS_DIR" "$MIG_DIR"

OPENAPI="$API_DIR/openapi_byoc.yaml"
ZOD="$CONTRACTS_DIR/byoc_contracts.ts"
ERD="$ERD_DIR/byoc.mmd"
SQL="$MIG_DIR/001_byoc.sql"

echo "==> Phase 1 scaffold → $FIX"

# --- OpenAPI 3.1 ---
if [[ -e "$OPENAPI" ]]; then echo "SKIP $OPENAPI"; else cat >"$OPENAPI" <<'YAML'
openapi: 3.1.0
info:
  title: BYOC Evidence API
  version: 0.1.0
servers:
  - url: /api
security:
  - bearerAuth: []
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    UUID: { type: string, format: uuid }
    Timestamp: { type: string, format: date-time }
    ProviderType: { type: string, enum: [aws, gcp, azure, custom] }
    TokenStatus: { type: string, enum: [active, revoked, expired] }
    IntegrityMeta:
      type: object
      properties:
        sha256: { type: string, pattern: '^[a-f0-9]{64}$' }
        size: { type: integer, minimum: 0 }
        signature: { type: string, nullable: true }
      required: [sha256, size]
    Provider:
      type: object
      properties:
        id: { $ref: '#/components/schemas/UUID' }
        name: { type: string }
        type: { $ref: '#/components/schemas/ProviderType' }
        createdAt: { $ref: '#/components/schemas/Timestamp' }
      required: [id, name, type, createdAt]
    ProviderToken:
      type: object
      properties:
        id: { $ref: '#/components/schemas/UUID' }
        providerId: { $ref: '#/components/schemas/UUID' }
        status: { $ref: '#/components/schemas/TokenStatus' }
        createdAt: { $ref: '#/components/schemas/Timestamp' }
        expiresAt: { $ref: '#/components/schemas/Timestamp' }
        revokedAt: { $ref: '#/components/schemas/Timestamp' }
      required: [id, providerId, status, createdAt]
    EvidenceCollection:
      type: object
      properties:
        id: { $ref: '#/components/schemas/UUID' }
        providerId: { $ref: '#/components/schemas/UUID' }
        name: { type: string }
        createdAt: { $ref: '#/components/schemas/Timestamp' }
      required: [id, providerId, name, createdAt]
    EvidenceReference:
      type: object
      properties:
        id: { $ref: '#/components/schemas/UUID' }
        collectionId: { $ref: '#/components/schemas/UUID' }
        uri: { type: string }
        hashSha256: { type: string, pattern: '^[a-f0-9]{64}$' }
        size: { type: integer, minimum: 0 }
        addedAt: { $ref: '#/components/schemas/Timestamp' }
        metadata: { type: object, additionalProperties: true }
      required: [id, collectionId, uri, hashSha256, size, addedAt]

paths:
  /providers/connect:
    post:
      tags: [Providers]
      summary: Register/connect a provider and mint a token
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
                providerType: { $ref: '#/components/schemas/ProviderType' }
                credentials: { type: object, additionalProperties: true }
              required: [name, providerType]
      responses:
        '201':
          description: Connected
          content:
            application/json:
              schema:
                type: object
                properties:
                  provider: { $ref: '#/components/schemas/Provider' }
                  token: { $ref: '#/components/schemas/ProviderToken' }
                required: [provider, token]

  /collections:
    post:
      tags: [Collections]
      summary: Create an evidence collection
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                providerId: { $ref: '#/components/schemas/UUID' }
                name: { type: string }
              required: [providerId, name]
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/EvidenceCollection' }

  /evidence:
    post:
      tags: [Evidence]
      summary: Attach an evidence reference to a collection
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                collectionId: { $ref: '#/components/schemas/UUID' }
                uri: { type: string }
                integrity: { $ref: '#/components/schemas/IntegrityMeta' }
                metadata: { type: object, additionalProperties: true }
              required: [collectionId, uri, integrity]
      responses:
        '201':
          description: Attached
          content:
            application/json:
              schema: { $ref: '#/components/schemas/EvidenceReference' }

  /provider-tokens/{id}:
    delete:
      tags: [Providers]
      summary: Revoke a provider token
      parameters:
        - in: path
          name: id
          required: true
          schema: { $ref: '#/components/schemas/UUID' }
      responses:
        '204': { description: Revoked }
YAML
  echo "WROTE $OPENAPI"
fi

# --- Zod templates ---
if [[ -e "$ZOD" ]]; then echo "SKIP $ZOD"; else cat >"$ZOD" <<'TS'
/** Phase 1 BYOC contracts (template) */
import { z } from "zod";

export const ProviderType = z.enum(["aws","gcp","azure","custom"]);
export const TokenStatus  = z.enum(["active","revoked","expired"]);

export const UUID = z.string().uuid();
export const Timestamp = z.string().datetime();

export const IntegrityMeta = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().min(0),
  signature: z.string().nullish(),
});

export const Provider = z.object({
  id: UUID, name: z.string(), type: ProviderType, createdAt: Timestamp,
});

export const ProviderToken = z.object({
  id: UUID, providerId: UUID, status: TokenStatus,
  createdAt: Timestamp, expiresAt: Timestamp.optional(), revokedAt: Timestamp.optional(),
});

export const EvidenceCollection = z.object({
  id: UUID, providerId: UUID, name: z.string(), createdAt: Timestamp,
});

export const EvidenceReference = z.object({
  id: UUID, collectionId: UUID, uri: z.string(),
  hashSha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().min(0),
  addedAt: Timestamp,
  metadata: z.record(z.any()).optional(),
});

/* Requests */
export const Req_ConnectProvider = z.object({
  name: z.string(),
  providerType: ProviderType,
  credentials: z.record(z.any()).optional(),
});
export type Req_ConnectProvider = z.infer<typeof Req_ConnectProvider>;
export type Res_ConnectProvider = { provider: z.infer<typeof Provider>, token: z.infer<typeof ProviderToken> };

export const Req_CreateCollection = z.object({
  providerId: UUID,
  name: z.string(),
});
export type Req_CreateCollection = z.infer<typeof Req_CreateCollection>;
export type Res_CreateCollection = z.infer<typeof EvidenceCollection>;

export const Req_AttachEvidence = z.object({
  collectionId: UUID,
  uri: z.string(),
  integrity: IntegrityMeta,
  metadata: z.record(z.any()).optional(),
});
export type Req_AttachEvidence = z.infer<typeof Req_AttachEvidence>;
export type Res_AttachEvidence = z.infer<typeof EvidenceReference>;
TS
  echo "WROTE $ZOD"
fi

# --- ERD (Mermaid) ---
if [[ -e "$ERD" ]]; then echo "SKIP $ERD"; else cat >"$ERD" <<'MMD'
erDiagram
  PROVIDERS ||--o{ PROVIDER_TOKENS : has
  PROVIDERS ||--o{ EVIDENCE_COLLECTIONS : has
  EVIDENCE_COLLECTIONS ||--o{ EVIDENCE_REFERENCES : has

  PROVIDERS {
    UUID id PK
    TEXT name
    TEXT type  "aws|gcp|azure|custom"
    TIMESTAMPTZ created_at
  }

  PROVIDER_TOKENS {
    UUID id PK
    UUID provider_id FK
    TEXT status "active|revoked|expired"
    TIMESTAMPTZ created_at
    TIMESTAMPTZ expires_at
    TIMESTAMPTZ revoked_at
  }

  EVIDENCE_COLLECTIONS {
    UUID id PK
    UUID provider_id FK
    TEXT name
    TIMESTAMPTZ created_at
  }

  EVIDENCE_REFERENCES {
    UUID id PK
    UUID collection_id FK
    TEXT uri
    CHAR(64) hash_sha256
    BIGINT size
    TIMESTAMPTZ added_at
    JSONB metadata
  }
MMD
  echo "WROTE $ERD"
fi

# --- SQL (portable Postgres) ---
if [[ -e "$SQL" ]]; then echo "SKIP $SQL"; else cat >"$SQL" <<'SQL'
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
SQL
  echo "WROTE $SQL"
fi

echo "==> Done (OpenAPI, Zod, ERD, SQL)"
