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
