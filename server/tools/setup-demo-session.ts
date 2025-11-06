
import { db } from '../db';
import { users, tenants, userSessions, intakeForms, intakeQuestions, intakeAnswers } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { AuthService } from '../services/authService';

async function setupDemoSession() {
  console.log('🔧 Setting up demo session for testing...');

  try {
    // Get or create demo tenant
    let tenant = await db.query.tenants.findFirst({
      where: eq(tenants.name, 'Demo Company')
    });

    if (!tenant) {
      [tenant] = await db.insert(tenants).values({
        id: 'demo-tenant-id',
        name: 'Demo Company',
        tenantType: 'BUSINESS',
        isActive: true,
        subscriptionStatus: 'trial'
      }).returning();
      console.log('✅ Created demo tenant');
    }

    // Get or create demo user
    let user = await db.query.users.findFirst({
      where: eq(users.email, 'demo@example.com')
    });

    if (!user) {
      [user] = await db.insert(users).values({
        id: 'demo-user-id',
        tenantId: tenant.id,
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        businessRole: 'business_owner',
        isActive: true,
        setupStatus: 'assessment_active',
        passwordHash: await AuthService.hashPassword('demo123')
      }).returning();
      console.log('✅ Created demo user');
    }

    // Create valid session token
    const { token } = await AuthService.createSession(
      user.id,
      tenant.id,
      '127.0.0.1',
      'Demo Browser'
    );

    console.log('✅ Demo session created successfully');
    console.log(`🔑 Demo token: ${token}`);
    console.log(`👤 Demo user: ${user.email}`);
    console.log(`🏢 Demo tenant: ${tenant.name}`);
    
    // Show how to use this token
    console.log('\n📋 To test with this token:');
    console.log(`localStorage.setItem('auth_token', '${token}');`);
    
    return { user, tenant, token };

  } catch (error) {
    console.error('❌ Error setting up demo session:', error);
    throw error;
  }
}

setupDemoSession().then(() => {
  console.log('🏁 Demo session setup completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Demo session setup failed:', error);
  process.exit(1);
});
