import { z } from "zod";

export const Role = z.object({ id: z.string(), name: z.string() });
export const Permission = z.object({ id: z.string(), action: z.string(), resource: z.string() });

export const AssignRoleReq = z.object({ userId: z.string(), roleId: z.string() });

export const RotateReq = z.object({
  providerId: z.string(),
  reason: z.enum(["routine","compromise","manual"]),
});
export const RotateRes = z.object({
  tokenId: z.string(), rotatedFrom: z.string().nullable(), createdAt: z.string(),
});

export const RevokeReq = z.object({
  tokenId: z.string(), reason: z.string().min(1),
});

export const AuditLog = z.object({
  id: z.string(),
  ts: z.string(),
  who: z.string().nullable(),
  action: z.string(),
  target: z.string().nullable(),
  meta: z.record(z.any()).optional(),
});
