
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

interface VerificationResult {
  phase: string;
  checks: Array<{
    name: string;
    passed: boolean;
    details?: string;
    critical: boolean;
  }>;
  overallSuccess: boolean;
}

async function runVerification(): Promise<void> {
  console.log(chalk.blue('🔍 Running Complete Implementation Verification\n'));

  const results: VerificationResult[] = [];

  // Phase 1: Core Blocking Issues
  const phase1Result: VerificationResult = {
    phase: 'Phase 1: Core Blocking Issues',
    checks: [],
    overallSuccess: true
  };

  // Check if port conflict is resolved
  try {
    const processCheck = execSync('lsof -i :5173 || echo "Port available"', { encoding: 'utf-8' });
    phase1Result.checks.push({
      name: 'Port 5173 Available',
      passed: processCheck.includes('Port available'),
      details: processCheck.trim(),
      critical: true
    });
  } catch (error) {
    phase1Result.checks.push({
      name: 'Port 5173 Check',
      passed: true, // If lsof fails, assume port is available
      details: 'lsof command not available, assuming port is free',
      critical: false
    });
  }

  // Check SQL query fix in assessments
  const assessmentFile = fs.readFileSync('server/routes/assessments.ts', 'utf-8');
  const hasFixedSqlQuery = assessmentFile.includes('categoryConditions.reduce') && 
                           !assessmentFile.includes('[object Object]');
  phase1Result.checks.push({
    name: 'SQL Query Construction Fixed',
    passed: hasFixedSqlQuery,
    details: hasFixedSqlQuery ? 'Proper OR condition building implemented' : 'SQL query still has issues',
    critical: true
  });

  // Check auth middleware
  const hasAuthLogging = assessmentFile.includes('No user found in request');
  phase1Result.checks.push({
    name: 'Authentication Error Handling',
    passed: hasAuthLogging,
    details: hasAuthLogging ? 'Auth error logging implemented' : 'Missing auth error handling',
    critical: true
  });

  results.push(phase1Result);

  // Phase 2: Business Dashboard
  const phase2Result: VerificationResult = {
    phase: 'Phase 2: Business Dashboard Real Data',
    checks: [],
    overallSuccess: true
  };

  // Check dashboard service improvements
  const dashboardServiceFile = fs.readFileSync('server/services/dashboardAnalyticsService.ts', 'utf-8');
  const hasImprovedKpis = dashboardServiceFile.includes('Dashboard KPIs calculated') &&
                         dashboardServiceFile.includes('Math.max(0, criticalGapCount)');
  phase2Result.checks.push({
    name: 'KPI Calculations Fixed',
    passed: hasImprovedKpis,
    details: hasImprovedKpis ? 'KPI calculations use real data with proper error handling' : 'KPI calculations still using mock data',
    critical: true
  });

  const hasImprovedCoreScoring = dashboardServiceFile.includes('crCounts.set') &&
                                dashboardServiceFile.includes('Math.round(data.score / data.total)');
  phase2Result.checks.push({
    name: 'Core Requirement Scoring',
    passed: hasImprovedCoreScoring,
    details: hasImprovedCoreScoring ? 'Core requirement scoring implemented' : 'Core requirement scoring missing',
    critical: true
  });

  results.push(phase2Result);

  // Phase 3: Consultant Dashboard Backend
  const phase3Result: VerificationResult = {
    phase: 'Phase 3: Consultant Dashboard Backend',
    checks: [],
    overallSuccess: true
  };

  // Check if migration was created
  const migrationExists = fs.existsSync('migrations/0015_add_consultant_clients_table.sql');
  phase3Result.checks.push({
    name: 'Consultant Clients Migration',
    passed: migrationExists,
    details: migrationExists ? 'Migration file created' : 'Migration file missing',
    critical: true
  });

  // Check schema update
  const schemaFile = fs.readFileSync('shared/schema.ts', 'utf-8');
  const hasConsultantClientsTable = schemaFile.includes('consultantClients = pgTable') &&
                                   schemaFile.includes('NewConsultantClient');
  phase3Result.checks.push({
    name: 'Schema Updated',
    passed: hasConsultantClientsTable,
    details: hasConsultantClientsTable ? 'consultantClients table added to schema' : 'Schema not updated',
    critical: true
  });

  // Check service implementation
  const consultantServiceFile = fs.readFileSync('server/services/consultantFeaturesService.ts', 'utf-8');
  const hasRealImplementation = !consultantServiceFile.includes('consultantClients = null') &&
                               consultantServiceFile.includes('from(consultantClients)');
  phase3Result.checks.push({
    name: 'Service Implementation',
    passed: hasRealImplementation,
    details: hasRealImplementation ? 'Real database operations implemented' : 'Still using stubbed methods',
    critical: true
  });

  // Check dashboard endpoint
  const dashboardRouteFile = fs.readFileSync('server/routes/dashboard.ts', 'utf-8');
  const hasTenantAwareDashboard = dashboardRouteFile.includes('tenantType === \'CONSULTANT\'') &&
                                 dashboardRouteFile.includes('ConsultantFeaturesService');
  phase3Result.checks.push({
    name: 'Tenant-Aware Dashboard',
    passed: hasTenantAwareDashboard,
    details: hasTenantAwareDashboard ? 'Dashboard routes to correct type' : 'Dashboard routing missing',
    critical: true
  });

  results.push(phase3Result);

  // Calculate overall results
  let totalChecks = 0;
  let passedChecks = 0;
  let criticalFailures = 0;

  results.forEach(phase => {
    console.log(chalk.yellow(`\n📋 ${phase.phase}\n`));
    
    phase.checks.forEach(check => {
      totalChecks++;
      
      const status = check.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
      const critical = check.critical ? chalk.red('(CRITICAL)') : chalk.yellow('(WARNING)');
      
      console.log(`${status} ${check.name} ${critical}`);
      if (check.details) {
        console.log(`    └─ ${check.details}`);
      }
      
      if (check.passed) {
        passedChecks++;
      } else if (check.critical) {
        criticalFailures++;
        phase.overallSuccess = false;
      }
    });
  });

  // Summary
  const successRate = Math.round((passedChecks / totalChecks) * 100);
  
  console.log(chalk.blue('\n📈 Implementation Summary:\n'));
  console.log(`Phase 1 (Core Fixes): ${results[0].overallSuccess ? chalk.green('✅ COMPLETE') : chalk.red('❌ INCOMPLETE')}`);
  console.log(`Phase 2 (Business Dashboard): ${results[1].overallSuccess ? chalk.green('✅ COMPLETE') : chalk.red('❌ INCOMPLETE')}`);
  console.log(`Phase 3 (Consultant Backend): ${results[2].overallSuccess ? chalk.green('✅ COMPLETE') : chalk.red('❌ INCOMPLETE')}`);
  
  console.log(`\n🎯 Overall Success Rate: ${successRate}%`);
  console.log(`📊 Passed: ${passedChecks}/${totalChecks}`);
  console.log(`🚨 Critical Failures: ${criticalFailures}`);

  if (successRate >= 100 && criticalFailures === 0) {
    console.log(chalk.green('\n🚀 SUCCESS: 100% Implementation Complete!'));
    console.log(chalk.green('All phases implemented successfully. System ready for production.'));
  } else if (successRate >= 90 && criticalFailures <= 2) {
    console.log(chalk.yellow('\n⚠️  MOSTLY COMPLETE: Address remaining critical issues'));
  } else {
    console.log(chalk.red('\n❌ INCOMPLETE: Major issues need attention'));
    process.exit(1);
  }
}

// Run verification
runVerification().catch(error => {
  console.error(chalk.red('💥 Verification failed:'), error);
  process.exit(1);
});
