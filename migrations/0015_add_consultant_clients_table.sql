
-- Add consultantClients table for consultant multi-client management
CREATE TABLE IF NOT EXISTS "ConsultantClient" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "consultantUserId" TEXT NOT NULL,
    "clientTenantId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'primary',
    "startDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permissions" JSONB DEFAULT '[]'::jsonb,
    "canManageUsers" BOOLEAN DEFAULT false,
    "canManageAssessments" BOOLEAN DEFAULT true,
    "canViewReports" BOOLEAN DEFAULT true,
    "canEditFacility" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultantClient_consultantUserId_fkey" 
        FOREIGN KEY ("consultantUserId") REFERENCES "User"("id") ON DELETE CASCADE,
    CONSTRAINT "ConsultantClient_clientTenantId_fkey" 
        FOREIGN KEY ("clientTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    
    UNIQUE("consultantUserId", "clientTenantId")
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "ConsultantClient_consultantUserId_idx" ON "ConsultantClient"("consultantUserId");
CREATE INDEX IF NOT EXISTS "ConsultantClient_clientTenantId_idx" ON "ConsultantClient"("clientTenantId");
CREATE INDEX IF NOT EXISTS "ConsultantClient_active_idx" ON "ConsultantClient"("isActive") WHERE "isActive" = true;
