
#!/usr/bin/env tsx

import { db } from '../server/db';
import { users } from '../shared/schema';
import { readFileSync } from 'fs';
import chalk from 'chalk';

async function enforceTestUsersMd(): Promise<void> {
  console.log(chalk.blue('🔒 Enforcing Test_Users.md compliance...'));
  
  // Get authorized emails from Test_Users.md
  const authorizedEmails = [
    'admin+e2e@rur2.com',    // Superuser Tester: Jonnie Doublin
    'tester+e2e@example.com' // Regular User Tester: Julia Robbin
  ];
  
  console.log(chalk.blue('📋 Authorized test emails:'));
  authorizedEmails.forEach(email => {
    console.log(chalk.green(`   ✅ ${email}`));
  });
  
  // Check all users in database
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName
  }).from(users);
  
  const unauthorizedUsers = allUsers.filter(user => 
    !authorizedEmails.includes(user.email)
  );
  
  if (unauthorizedUsers.length > 0) {
    console.log(chalk.red('\n❌ UNAUTHORIZED TEST USERS DETECTED:'));
    unauthorizedUsers.forEach(user => {
      console.log(chalk.red(`   🚫 ${user.email} (${user.firstName} ${user.lastName})`));
    });
    
    console.log(chalk.red('\n💥 CI ENFORCEMENT FAILURE'));
    console.log(chalk.yellow('Only users defined in Test_Users.md are allowed:'));
    authorizedEmails.forEach(email => {
      console.log(chalk.yellow(`   - ${email}`));
    });
    
    console.log(chalk.blue('\n🔧 To fix this:'));
    console.log('1. Run: npx tsx scripts/purge-all-users.ts');
    console.log('2. Run: npx tsx scripts/setup-test-users-from-md.ts');
    console.log('3. Update any tests to use only Test_Users.md accounts');
    
    process.exit(1);
  }
  
  console.log(chalk.green('\n✅ CI ENFORCEMENT PASSED'));
  console.log(chalk.green(`All ${allUsers.length} users are authorized from Test_Users.md`));
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  enforceTestUsersMd()
    .catch(error => {
      console.error(chalk.red('💥 Enforcement failed:'), error);
      process.exit(1);
    });
}

export { enforceTestUsersMd };
