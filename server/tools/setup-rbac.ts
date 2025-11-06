
import { db } from '../db';
import { tenants, users, permissions, rolePermissions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { AuthService } from '../services/authService';

async function setupRBAC() {
  console.log('🔐 Setting up RBAC system...');

  try {
    // Check if system admin tenant exists
    const systemTenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, 'system-admin'),
    });

    if (!systemTenant) {
      console.log('Creating system admin tenant...');
      await db.insert(tenants).values({
        id: 'system-admin',
        name: 'RuR2 System Administration',
        tenantType: 'BUSINESS',
        isActive: true,
        subscriptionStatus: 'enterprise',
      });
    }

    // Check if admin users exist
    const adminUser = await db.query.users.findFirst({
      where: eq(users.email, 'admin@rur2.com'),
    });

    if (!adminUser) {
      console.log('Creating admin user...');
      const passwordHash = await AuthService.hashPassword('RuR2Admin2024!');
      await db.insert(users).values({
        id: 'admin-001',
        tenantId: 'system-admin',
        email: 'admin@rur2.com',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        businessRole: 'business_owner',
        isActive: true,
        emailVerified: true,
      });
    }

    const testUser = await db.query.users.findFirst({
      where: eq(users.email, 'test@example.com'),
    });

    if (!testUser) {
      console.log('Creating test user...');
      const passwordHash = await AuthService.hashPassword('TestUser123!');
      await db.insert(users).values({
        id: 'test-001',
        tenantId: 'system-admin',
        email: 'test@example.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'User',
        businessRole: 'business_owner',
        isActive: true,
        emailVerified: true,
      });
    }

    // Verify permissions are set up
    const permissionCount = await db.query.permissions.findMany();
    console.log(`📋 Found ${permissionCount.length} permissions in system`);

    const rolePermissionCount = await db.query.rolePermissions.findMany();
    console.log(`🔗 Found ${rolePermissionCount.length} role-permission mappings`);

    console.log('✅ RBAC system setup complete!');
    console.log('\n🔐 Test Credentials:');
    console.log('Admin: admin@rur2.com / RuR2Admin2024!');
    console.log('Test: test@example.com / TestUser123!');

  } catch (error) {
    console.error('❌ RBAC setup failed:', error);
    process.exit(1);
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupRBAC().then(() => process.exit(0));
}

export default setupRBAC;
