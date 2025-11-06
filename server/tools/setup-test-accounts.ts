
import { db } from '../db';
import { users, tenants, userSessions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { AuthService } from '../services/authService';

async function setupTestAccounts() {
  console.log('🧪 Setting up Test_Users.md authorized accounts...');
  console.log('⚠️  Only accounts from Test_Users.md are allowed');

  try {
    // Validate Test_Users.md exists and is readable
    const { parseTestUsersFromMd, setupAuthorizedTestUsers } = await import('../../scripts/setup-test-users-from-md');
    
    // Parse authorized users from Test_Users.md
    const authorizedUsers = parseTestUsersFromMd();
    console.log(`📋 Found ${authorizedUsers.length} authorized test users in Test_Users.md`);
    
    // Setup authorized accounts
    await setupAuthorizedTestUsers();
    
    // Create business tenant
    let businessTenant = await db.query.tenants.findFirst({
      where: eq(tenants.name, 'GreenTech Recycling Solutions')
    });

    if (!businessTenant) {
      [businessTenant] = await db.insert(tenants).values({
        id: 'business-test-tenant',
        name: 'GreenTech Recycling Solutions',
        tenantType: 'BUSINESS',
        domain: 'greentech-recycling.com',
        isActive: true,
        licenseStatus: 'active',
        settings: {
          facilityCount: 3,
          timezone: 'America/New_York',
          notifications: true,
          reporting: 'monthly'
        }
      }).returning();
      console.log('✅ Created business tenant: GreenTech Recycling Solutions');
    }

    // Create business user
    let businessUser = await db.query.users.findFirst({
      where: eq(users.email, 'sarah.manager@greentech-recycling.com')
    });

    if (!businessUser) {
      const passwordHash = await AuthService.hashPassword('Business2024!Test');
      [businessUser] = await db.insert(users).values({
        id: 'business-test-user',
        tenantId: businessTenant.id,
        email: 'sarah.manager@greentech-recycling.com',
        passwordHash,
        firstName: 'Sarah',
        lastName: 'Johnson',
        businessRole: 'facility_manager',
        isActive: true,
        emailVerified: true,
        setupStatus: 'setup_complete',
        phone: '+1-555-0123',
        profileImage: null,
        lastLoginAt: new Date()
      }).returning();
      console.log('✅ Created business user: Sarah Johnson');
    }

    // Create business session token
    const { token: businessToken } = await AuthService.createSession(
      businessUser.id,
      businessTenant.id,
      '192.168.1.100',
      'Business Test Browser'
    );

    // === CONSULTANT TEST ACCOUNT ===
    console.log('\n🔍 Creating Consultant Test Account...');
    
    // Create consultant tenant
    let consultantTenant = await db.query.tenants.findFirst({
      where: eq(tenants.name, 'EcoCompliance Advisory Group')
    });

    if (!consultantTenant) {
      [consultantTenant] = await db.insert(tenants).values({
        id: 'consultant-test-tenant',
        name: 'EcoCompliance Advisory Group',
        tenantType: 'CONSULTANT',
        domain: 'ecocompliance.consulting',
        isActive: true,
        licenseStatus: 'active',
        settings: {
          clientCount: 12,
          timezone: 'America/Los_Angeles',
          notifications: true,
          whiteLabel: true,
          reporting: 'weekly'
        }
      }).returning();
      console.log('✅ Created consultant tenant: EcoCompliance Advisory Group');
    }

    // Create consultant user
    let consultantUser = await db.query.users.findFirst({
      where: eq(users.email, 'michael.consultant@ecocompliance.consulting')
    });

    if (!consultantUser) {
      const passwordHash = await AuthService.hashPassword('Consultant2024!Test');
      [consultantUser] = await db.insert(users).values({
        id: 'consultant-test-user',
        tenantId: consultantTenant.id,
        email: 'michael.consultant@ecocompliance.consulting',
        passwordHash,
        firstName: 'Michael',
        lastName: 'Chen',
        consultantRole: 'lead_consultant',
        isActive: true,
        emailVerified: true,
        setupStatus: 'setup_complete',
        phone: '+1-555-0456',
        profileImage: null,
        lastLoginAt: new Date()
      }).returning();
      console.log('✅ Created consultant user: Michael Chen');
    }

    // Create consultant session token
    const { token: consultantToken } = await AuthService.createSession(
      consultantUser.id,
      consultantTenant.id,
      '192.168.1.200',
      'Consultant Test Browser'
    );

    // Log audit events for both accounts
    await AuthService.logAuditEvent(
      businessTenant.id,
      businessUser.id,
      'TEST_ACCOUNT_CREATED',
      'user',
      businessUser.id,
      undefined,
      { purpose: 'comprehensive_testing', accountType: 'business' }
    );

    await AuthService.logAuditEvent(
      consultantTenant.id,
      consultantUser.id,
      'TEST_ACCOUNT_CREATED',
      'user',
      consultantUser.id,
      undefined,
      { purpose: 'comprehensive_testing', accountType: 'consultant' }
    );

    // === OUTPUT TEST ACCOUNT INFORMATION ===
    console.log('\n🎯 TEST ACCOUNTS READY FOR COMPREHENSIVE TESTING');
    console.log('=' .repeat(60));
    
    console.log('\n🏢 BUSINESS TEST ACCOUNT');
    console.log('Company: GreenTech Recycling Solutions');
    console.log('Email: sarah.manager@greentech-recycling.com');
    console.log('Password: Business2024!Test');
    console.log('Role: Facility Manager');
    console.log('Plan: Team Business');
    console.log(`Session Token: ${businessToken}`);
    
    console.log('\n🔍 CONSULTANT TEST ACCOUNT');
    console.log('Company: EcoCompliance Advisory Group');
    console.log('Email: michael.consultant@ecocompliance.consulting');
    console.log('Password: Consultant2024!Test');
    console.log('Role: Lead Consultant');
    console.log('Plan: Agency Consultant');
    console.log(`Session Token: ${consultantToken}`);

    console.log('\n📋 TESTING INSTRUCTIONS:');
    console.log('1. Test login with both accounts');
    console.log('2. Verify role-based permissions');
    console.log('3. Test assessment creation and management');
    console.log('4. Test intake form workflows');
    console.log('5. Test client/facility management');
    console.log('6. Test report generation and exports');
    console.log('7. Verify UI/UX across different user types');
    console.log('8. Test complete user journeys end-to-end');

    console.log('\n🚀 QUICK LOGIN SETUP:');
    console.log('// Business Account');
    console.log(`localStorage.setItem('auth_token', '${businessToken}');`);
    console.log('// Consultant Account');
    console.log(`localStorage.setItem('auth_token', '${consultantToken}');`);

    return {
      business: {
        tenant: businessTenant,
        user: businessUser,
        token: businessToken,
        credentials: {
          email: 'sarah.manager@greentech-recycling.com',
          password: 'Business2024!Test'
        }
      },
      consultant: {
        tenant: consultantTenant,
        user: consultantUser,
        token: consultantToken,
        credentials: {
          email: 'michael.consultant@ecocompliance.consulting',
          password: 'Consultant2024!Test'
        }
      }
    };

  } catch (error) {
    console.error('❌ Error setting up test accounts:', error);
    throw error;
  }
}

// Process mock payments for test accounts
async function processTestAccountPayments(accounts: any) {
  console.log('\n💳 Processing mock payments for test accounts...');
  
  try {
    // Business account mock payment
    const businessPlan = 'team';
    console.log(`Processing mock payment for business account (${businessPlan} plan)...`);
    
    const businessResponse = await fetch('http://localhost:5000/api/stripe/mock-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: businessPlan,
        userEmail: accounts.business.credentials.email,
        userId: accounts.business.user.id,
        mockSuccess: true
      }),
    });

    if (businessResponse.ok) {
      const businessData = await businessResponse.json();
      console.log('✅ Business account mock payment processed:', businessData.mockSessionId);
      
      // Trigger mock webhook
      await fetch('http://localhost:5000/api/stripe/mock-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: businessData.mockSessionId,
          mockSuccess: true
        }),
      });
      console.log('✅ Business account license activated via mock webhook');
    }

    // Consultant account mock payment
    const consultantPlan = 'agency';
    console.log(`Processing mock payment for consultant account (${consultantPlan} plan)...`);
    
    const consultantResponse = await fetch('http://localhost:5000/api/stripe/mock-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: consultantPlan,
        userEmail: accounts.consultant.credentials.email,
        userId: accounts.consultant.user.id,
        mockSuccess: true
      }),
    });

    if (consultantResponse.ok) {
      const consultantData = await consultantResponse.json();
      console.log('✅ Consultant account mock payment processed:', consultantData.mockSessionId);
      
      // Trigger mock webhook
      await fetch('http://localhost:5000/api/stripe/mock-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: consultantData.mockSessionId,
          mockSuccess: true
        }),
      });
      console.log('✅ Consultant account license activated via mock webhook');
    }

    console.log('\n💳 Mock payment processing completed for both test accounts');
    
  } catch (error) {
    console.error('❌ Error processing mock payments:', error);
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestAccounts().then(() => {
    // Process mock payments for test accounts
    await processTestAccountPayments(result);
    
    console.log('\n✅ Test accounts setup completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test accounts setup failed:', error);
    process.exit(1);
  });
}

export default setupTestAccounts;
