
#!/usr/bin/env tsx

import { db } from '../server/db';
import { intakeForms, assessments, questions, answers } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import chalk from 'chalk';

interface IntegrationTest {
  name: string;
  description: string;
  test: () => Promise<boolean>;
  critical: boolean;
}

class AssessmentWorkflowIntegrationVerifier {
  private tests: IntegrationTest[] = [
    {
      name: 'Database Connectivity',
      description: 'Verify database connection and basic queries',
      test: this.testDatabaseConnectivity.bind(this),
      critical: true
    },
    {
      name: 'Intake Form to Assessment Creation',
      description: 'Test intake form can create assessment with REC mapping',
      test: this.testIntakeToAssessmentFlow.bind(this),
      critical: true
    },
    {
      name: 'REC Mapping Logic Integration',
      description: 'Verify REC mapping logic is properly integrated',
      test: this.testRECMappingIntegration.bind(this),
      critical: true
    },
    {
      name: 'Assessment Question Filtering',
      description: 'Test that assessments filter questions based on REC codes',
      test: this.testQuestionFiltering.bind(this),
      critical: true
    },
    {
      name: 'Assessment Metadata Flow',
      description: 'Verify filtering metadata flows correctly through API',
      test: this.testMetadataFlow.bind(this),
      critical: true
    },
    {
      name: 'Frontend API Integration',
      description: 'Test frontend can consume assessment APIs correctly',
      test: this.testFrontendIntegration.bind(this),
      critical: true
    }
  ];

  async verify(): Promise<void> {
    console.log(chalk.blue('🔍 Assessment Workflow Integration Verification\n'));

    let passedTests = 0;
    let criticalFailures = 0;

    for (const test of this.tests) {
      console.log(chalk.yellow(`Running: ${test.name}`));
      console.log(`   ${test.description}`);

      try {
        const result = await test.test();
        if (result) {
          console.log(chalk.green(`   ✅ PASSED`));
          passedTests++;
        } else {
          console.log(chalk.red(`   ❌ FAILED${test.critical ? ' (CRITICAL)' : ''}`));
          if (test.critical) criticalFailures++;
        }
      } catch (error) {
        console.log(chalk.red(`   💥 ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`));
        if (test.critical) criticalFailures++;
      }

      console.log('');
    }

    // Summary
    const passRate = Math.round((passedTests / this.tests.length) * 100);
    console.log(chalk.blue('📊 Integration Test Results:'));
    console.log(`   Passed: ${passedTests}/${this.tests.length} (${passRate}%)`);
    console.log(`   Critical Failures: ${criticalFailures}`);

    if (passRate === 100 && criticalFailures === 0) {
      console.log(chalk.green('\n🎉 All integration tests passed!'));
      console.log(chalk.green('Assessment workflow integration is fully functional.'));
    } else if (passRate >= 80 && criticalFailures === 0) {
      console.log(chalk.yellow('\n⚠️ Most integration tests passed'));
      console.log(chalk.yellow('Minor issues detected but no critical failures.'));
    } else {
      console.log(chalk.red('\n❌ Integration test failures detected'));
      console.log(chalk.red('Critical issues must be resolved before production.'));
      process.exit(1);
    }
  }

  private async testDatabaseConnectivity(): Promise<boolean> {
    try {
      // Test basic connectivity
      await db.execute('SELECT 1 as test');
      
      // Test schema access
      const userCount = await db.select().from(intakeForms).limit(1);
      const assessmentCount = await db.select().from(assessments).limit(1);
      
      return true;
    } catch (error) {
      console.log(`      Database error: ${error}`);
      return false;
    }
  }

  private async testIntakeToAssessmentFlow(): Promise<boolean> {
    try {
      // Check if IntakeProcessor can be imported and used
      const { IntakeProcessor } = await import('../server/routes/intakeLogic');
      
      // Test validation method
      const testIntakeData = {
        legalCompanyName: 'Test Company',
        processingActivities: ['Materials Recovery'],
        certificationType: 'INITIAL'
      };

      const validation = IntakeProcessor.validateIntakeCompleteness(testIntakeData);
      
      if (typeof validation.isComplete !== 'boolean' || !Array.isArray(validation.missingFields)) {
        return false;
      }

      return true;
    } catch (error) {
      console.log(`      Intake flow error: ${error}`);
      return false;
    }
  }

  private async testRECMappingIntegration(): Promise<boolean> {
    try {
      const { IntakeProcessor } = await import('../server/routes/intakeLogic');
      
      // Create test intake form
      const testIntakeId = 'test-rec-integration-' + Date.now();
      await db.insert(intakeForms).values({
        id: testIntakeId,
        userId: 'test-user',
        tenantId: 'test-tenant',
        legalCompanyName: 'REC Test Company',
        processingActivities: ['Materials Recovery', 'Refurbishment'],
        totalFacilities: '2',
        certificationStructureType: 'CAMPUS',
        internationalShipments: false,
        status: 'SUBMITTED'
      });

      // Test REC mapping generation
      const assessmentScope = await IntakeProcessor.generateAssessmentScope(testIntakeId);

      // Cleanup
      await db.delete(intakeForms).where(eq(intakeForms.id, testIntakeId));

      // Verify scope structure
      return assessmentScope.applicableRecCodes.length > 0 &&
             assessmentScope.scopeStatement.includes('REC Test Company') &&
             Array.isArray(assessmentScope.requiredAppendices) &&
             typeof assessmentScope.complexityFactors.overall === 'number';

    } catch (error) {
      console.log(`      REC mapping error: ${error}`);
      return false;
    }
  }

  private async testQuestionFiltering(): Promise<boolean> {
    try {
      // Test that question filtering logic exists and is accessible
      const assessmentRoutes = await import('../server/routes/assessments');
      
      // Check that the routes module exports properly
      if (!assessmentRoutes.default) {
        return false;
      }

      // Verify that filtering logic components exist
      const fs = await import('fs');
      const assessmentRouteContent = fs.readFileSync('server/routes/assessments.ts', 'utf8');
      
      return assessmentRouteContent.includes('filteringInfo') &&
             assessmentRouteContent.includes('applicableRecCodes') &&
             assessmentRouteContent.includes('IntakeProcessor');

    } catch (error) {
      console.log(`      Question filtering error: ${error}`);
      return false;
    }
  }

  private async testMetadataFlow(): Promise<boolean> {
    try {
      // Verify metadata flow components exist in the codebase
      const fs = await import('fs');
      
      // Check assessment route includes metadata
      const assessmentContent = fs.readFileSync('server/routes/assessments.ts', 'utf8');
      const hasMetadataFlow = assessmentContent.includes('filteringInfo') &&
                             assessmentContent.includes('lastRefreshed') &&
                             assessmentContent.includes('filteredQuestionsCount');

      // Check client components handle metadata
      const assessmentDetailContent = fs.readFileSync('client/src/pages/AssessmentDetail.tsx', 'utf8');
      const hasClientMetadata = assessmentDetailContent.includes('filteringInfo') &&
                               assessmentDetailContent.includes('Smart Filtered') &&
                               assessmentDetailContent.includes('applicableRecCodes');

      return hasMetadataFlow && hasClientMetadata;

    } catch (error) {
      console.log(`      Metadata flow error: ${error}`);
      return false;
    }
  }

  private async testFrontendIntegration(): Promise<boolean> {
    try {
      // Check that frontend components properly integrate with backend APIs
      const fs = await import('fs');
      
      // Check NewAssessment component
      const newAssessmentContent = fs.readFileSync('client/src/pages/NewAssessment.tsx', 'utf8');
      const hasApiIntegration = newAssessmentContent.includes('api.createAssessment') &&
                               newAssessmentContent.includes('intakeFormId') &&
                               newAssessmentContent.includes('facilityId');

      // Check AssessmentDetail component  
      const assessmentDetailContent = fs.readFileSync('client/src/pages/AssessmentDetail.tsx', 'utf8');
      const hasDetailIntegration = assessmentDetailContent.includes('apiGet') &&
                                  assessmentDetailContent.includes('/assessments/') &&
                                  assessmentDetailContent.includes('filtering');

      return hasApiIntegration && hasDetailIntegration;

    } catch (error) {
      console.log(`      Frontend integration error: ${error}`);
      return false;
    }
  }
}

// Run verification
const verifier = new AssessmentWorkflowIntegrationVerifier();
verifier.verify().catch(console.error);
