# 🔧 Fix: Invalid Client Secret Error

## Problem
The error `AADSTS7000215: Invalid client secret provided` means you're using the **Secret ID** instead of the **Secret Value**.

## Solution: Get the Correct Secret Value

### Step 1: Go to Azure Portal
1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations**
3. Find your app: `450530a1-3041-45dd-b653-ba5c75f80550`

### Step 2: Get the Secret Value
1. Click on your app
2. Go to **Certificates & secrets** (left menu)
3. Under **Client secrets**, you'll see a list of secrets
4. **IMPORTANT**: You need the **Value** column, NOT the **Secret ID** column
5. If the Value is hidden (shows as dots), you have two options:

   **Option A: Copy from when it was created**
   - The secret value is only shown ONCE when you create it
   - If you didn't copy it, you need to create a new secret

   **Option B: Create a new secret**
   1. Click **"+ New client secret"**
   2. Add a description (e.g., "Email Service Secret")
   3. Choose expiration (recommended: 24 months)
   4. Click **Add**
   5. **IMMEDIATELY COPY THE VALUE** - it will look like:
      ```
      abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz
      ```
   6. This is what you need to put in `.env`

### Step 3: Update .env File
Replace the current `MICROSOFT_365_CLIENT_SECRET` with the actual secret **value** (not the ID):

```env
MICROSOFT_365_CLIENT_SECRET=abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz
```

**Note**: The secret value is typically:
- 40+ characters long
- Contains letters, numbers, and special characters like `~`, `-`, `_`
- Does NOT look like a GUID (no dashes in the middle)

### Step 4: Restart Server
After updating the `.env` file, restart your server:
```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev:server
```

## What NOT to Use
❌ **Secret ID** (GUID format): `c8b84100-4830-45ea-b1f0-620f790c996d`
✅ **Secret Value** (long string): `abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz`

## Verification
After updating, run the test again:
```bash
npx tsx tests/email/test-token-acquisition.ts
```

You should see:
```
✅ Token Acquisition Test: PASSED
```

