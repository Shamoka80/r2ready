-- Add password reset fields to users table
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetTokenExpiry" TIMESTAMP;

-- Add indexes for password reset token lookup
CREATE INDEX IF NOT EXISTS "User_passwordResetToken_idx" ON "User"("passwordResetToken");
CREATE INDEX IF NOT EXISTS "User_passwordResetTokenExpiry_idx" ON "User"("passwordResetTokenExpiry");
