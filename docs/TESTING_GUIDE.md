
# Testing Guide - Mock Payment Implementation

## Overview
This guide covers how to use the mock payment system for testing the complete user journey without real payment processing.

## Test Accounts

### Business Test Account
- **Company**: GreenTech Recycling Solutions  
- **Email**: sarah.manager@greentech-recycling.com
- **Password**: Business2024!Test
- **Role**: Facility Manager
- **Plan**: Team Business ($899)

### Consultant Test Account  
- **Company**: EcoCompliance Advisory Group
- **Email**: michael.consultant@ecocompliance.consulting
- **Password**: Consultant2024!Test
- **Role**: Lead Consultant
- **Plan**: Agency Consultant ($1,199)

## Mock Payment Testing

### 1. Quick Setup
Run the test account setup script to create accounts with mock payments already processed:

```bash
npx tsx server/tools/setup-test-accounts.ts
```

This will:
- Create both test accounts
- Process mock payments automatically
- Activate licenses via mock webhooks
- Set accounts to 'setup_complete' status

### 2. Manual Testing Flow

#### Step 1: Register New Account
1. Go to `/register`
2. Fill out registration form
3. Choose account type (Business or Consultant)

#### Step 2: Purchase Plan
1. Navigate to `/pricing`
2. Select a plan
3. Click "Get Started" 
4. On purchase page, click "🧪 Mock Payment (Testing Only)"
5. Mock payment will process and redirect to onboarding

#### Step 3: Complete Onboarding
1. Fill out organization profile
2. Set up facility/client information  
3. Configure scope and applicability
4. Account will be activated automatically

### 3. Mock Payment API Endpoints

#### Create Mock Payment
```
POST /api/stripe/mock-payment
{
  "planId": "team",
  "userEmail": "test@example.com", 
  "userId": "test-user-id",
  "mockSuccess": true
}
```

#### Process Mock Webhook
```
POST /api/stripe/mock-webhook
{
  "sessionId": "mock_cs_test_123456789",
  "mockSuccess": true
}
```

#### Retrieve Mock Session
```
GET /api/stripe/session/mock_cs_test_123456789
```

### 4. Database Verification

After mock payment processing, verify:

- **Licenses table**: License record created with plan details
- **Users table**: Setup status updated to 'setup_complete' 
- **Tenants table**: License status set to 'active'
- **Audit logs**: Payment and license activation events logged

### 5. Testing Scenarios

#### Success Path
1. Register → Purchase (Mock) → Onboarding → Dashboard
2. Verify all data persisted correctly
3. Check license activation and user permissions

#### Failure Testing  
1. Set `mockSuccess: false` in mock payment request
2. Verify error handling and user feedback
3. Test payment retry flow

### 6. Mock vs Real Payments

**Mock Sessions**:
- Start with `mock_cs_test_`
- Stored in memory (global.mockSessions)
- No actual Stripe communication
- Immediate success/failure simulation

**Real Sessions**:
- Standard Stripe session IDs
- Full Stripe checkout flow
- Real webhook processing
- Production payment verification

## Best Practices

1. **Always use mock payments** for development and testing
2. **Clear mock session data** between test runs if needed
3. **Test both success and failure scenarios**
4. **Verify database state** after each test
5. **Use test account credentials** for consistent testing

## Troubleshooting

### Mock Payment Not Working
- Check server logs for mock payment processing
- Verify mock session creation in global.mockSessions
- Ensure webhook endpoint is accessible

### License Not Activated
- Confirm mock webhook was triggered
- Check database for license record creation
- Verify user setup status update

### Session Not Found
- Mock sessions are stored in memory
- Server restart clears mock sessions
- Re-run test account setup if needed

