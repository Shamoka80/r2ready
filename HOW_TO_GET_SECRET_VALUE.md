# 🔑 How to Get the Correct Client Secret Value

## ⚠️ Current Problem
You're using: `c8b84100-4830-45ea-b1f0-620f790c996d` (This is a **Secret ID**, not the **Secret Value**)

## ✅ What You Need
The **Secret Value** looks like: `abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz` (40+ characters)

---

## 📋 Step-by-Step Instructions

### Step 1: Go to Azure Portal
1. Open: https://portal.azure.com
2. Sign in with your Azure account
3. Search for "Azure Active Directory" in the top search bar
4. Click on **Azure Active Directory**

### Step 2: Find Your App Registration
1. In the left menu, click **"App registrations"**
2. Find your app with Client ID: `450530a1-3041-45dd-b653-ba5c75f80550`
3. Click on it

### Step 3: Go to Certificates & Secrets
1. In the left menu, click **"Certificates & secrets"**
2. You'll see a table with your secrets

### Step 4: Check the Table
You'll see a table like this:

| Description | Secret ID | Value | Expires |
|------------|-----------|-------|---------|
| Email Service Secret | `c8b84100-4830-45ea-b1f0-620f790c996d` | `abc~DEF123...` | 2026-11-21 |

**IMPORTANT**: 
- ❌ **Secret ID** column = What you currently have (GUID format)
- ✅ **Value** column = What you need (long string with special characters)

### Step 5: Get the Value

**Option A: If Value is Visible**
- Click the **"Copy"** button next to the Value
- This is your `MICROSOFT_365_CLIENT_SECRET`

**Option B: If Value is Hidden (shows as dots)**
The value is only shown ONCE when created. You need to create a new secret:

1. Click **"+ New client secret"** button
2. Fill in:
   - **Description**: `Email Service Secret - Production`
   - **Expires**: Choose `24 months` (or your preference)
3. Click **"Add"**
4. **IMMEDIATELY** copy the **Value** that appears
   - It will look like: `abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz`
   - This is shown ONLY ONCE - if you close the page, you can't get it back
5. Save it somewhere safe

### Step 6: Update Your .env File

Replace the current value in both `.env` files:

**Before (WRONG - Secret ID):**
```env
MICROSOFT_365_CLIENT_SECRET=c8b84100-4830-45ea-b1f0-620f790c996d
```

**After (CORRECT - Secret Value):**
```env
MICROSOFT_365_CLIENT_SECRET=abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz
```

(Use the actual value you copied from Azure Portal)

### Step 7: Restart Server
After updating, restart your server for changes to take effect.

---

## 🔍 How to Identify the Correct Value

### ❌ Secret ID (WRONG - What you have now)
- Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Length: 36 characters
- Contains: Only letters, numbers, and dashes
- Example: `c8b84100-4830-45ea-b1f0-620f790c996d`

### ✅ Secret Value (CORRECT - What you need)
- Format: Long random string
- Length: 40+ characters (usually 40-88 characters)
- Contains: Letters, numbers, and special characters (`~`, `-`, `_`, etc.)
- Example: `abc~DEF123ghi456JKL789mno012PQR345stu678VWX901yz`

---

## 🧪 Test After Updating

Once you've updated the `.env` file with the correct Secret Value, test it:

```bash
npx tsx tests/email/test-token-acquisition.ts
```

You should see:
```
✅ Token Acquisition Test: PASSED
```

If you still see errors, double-check:
1. You copied the **Value** column, not the **Secret ID** column
2. No extra spaces or quotes around the value
3. The value is on a single line in the `.env` file
4. You restarted the server after updating

