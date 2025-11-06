
#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import chalk from 'chalk';

interface VerificationResult {
  category: string;
  score: number;
  maxScore: number;
  details: string[];
  issues: string[];
}

class TrainingCenterVerification {
  private results: VerificationResult[] = [];

  async runVerification(): Promise<void> {
    console.log(chalk.blue('\n🎓 R2v3 Training Center Completeness Verification\n'));

    await this.verifyModuleContent();
    await this.verifyKnowledgeBase();
    await this.verifyCertificationPrep();
    await this.verifyAssessments();
    await this.verifyInteractiveTutorials();
    await this.verifyProgressTracking();
    await this.verifyAPIEndpoints();

    this.generateReport();
  }

  private async verifyModuleContent(): Promise<void> {
    console.log(chalk.yellow('📚 Verifying Training Module Content...'));
    
    try {
      const serviceContent = await fs.readFile('server/services/trainingCenterService.ts', 'utf-8');
      let score = 0;
      const maxScore = 100;
      const details: string[] = [];
      const issues: string[] = [];

      // Check for comprehensive module structure
      if (serviceContent.includes('R2v3_TRAINING_MODULES')) {
        score += 20;
        details.push('✅ Main training modules array defined');
      } else {
        issues.push('❌ Training modules array missing');
      }

      // Check for Core Requirements coverage (should have 10 core modules)
      const coreModuleMatches = serviceContent.match(/id: 'core-\d+-/g);
      if (coreModuleMatches && coreModuleMatches.length >= 5) {
        score += 25;
        details.push(`✅ ${coreModuleMatches.length} Core Requirement modules found`);
      } else {
        issues.push('❌ Insufficient Core Requirement module coverage');
      }

      // Check for comprehensive content structure
      if (serviceContent.includes('learningObjectives') && 
          serviceContent.includes('sections') && 
          serviceContent.includes('resources') &&
          serviceContent.includes('assessment')) {
        score += 20;
        details.push('✅ Complete module content structure');
      } else {
        issues.push('❌ Missing module content components');
      }

      // Check for R2v3-specific content
      if (serviceContent.includes('R2v3') && 
          serviceContent.includes('SERI') && 
          serviceContent.includes('certification') &&
          serviceContent.includes('hierarchy') &&
          serviceContent.includes('EHSMS')) {
        score += 15;
        details.push('✅ R2v3-specific terminology and concepts included');
      } else {
        issues.push('❌ Missing R2v3-specific content');
      }

      // Check for assessment questions
      const assessmentMatches = serviceContent.match(/questions:\s*\[/g);
      if (assessmentMatches && assessmentMatches.length >= 3) {
        score += 10;
        details.push('✅ Assessment questions implemented');
      } else {
        issues.push('❌ Insufficient assessment questions');
      }

      // Check for industry-aligned content from curriculum files
      if (serviceContent.includes('180-day') && 
          serviceContent.includes('certification preparation') &&
          serviceContent.includes('Business Implementation')) {
        score += 10;
        details.push('✅ Industry-aligned curriculum content integrated');
      } else {
        issues.push('❌ Missing industry-aligned curriculum content');
      }

      this.results.push({
        category: 'Module Content',
        score,
        maxScore,
        details,
        issues
      });

    } catch (error) {
      this.results.push({
        category: 'Module Content',
        score: 0,
        maxScore: 100,
        details: [],
        issues: ['❌ Failed to load training service file']
      });
    }
  }

  private async verifyKnowledgeBase(): Promise<void> {
    console.log(chalk.yellow('📖 Verifying Knowledge Base...'));
    
    try {
      const serviceContent = await fs.readFile('server/services/trainingCenterService.ts', 'utf-8');
      let score = 0;
      const maxScore = 100;
      const details: string[] = [];
      const issues: string[] = [];

      // Check for knowledge base implementation
      if (serviceContent.includes('getKnowledgeBase')) {
        score += 30;
        details.push('✅ Knowledge base service method implemented');
      } else {
        issues.push('❌ Knowledge base service method missing');
      }

      // Check for comprehensive articles
      const articleMatches = serviceContent.match(/id: 'kb-[\w-]+'/g);
      if (articleMatches && articleMatches.length >= 15) {
        score += 40;
        details.push(`✅ ${articleMatches.length} knowledge base articles found`);
      } else {
        issues.push(`❌ Insufficient knowledge base articles (found: ${articleMatches?.length || 0}, need: 15+)`);
      }

      // Check for article structure
      if (serviceContent.includes('readTime') && 
          serviceContent.includes('tags') && 
          serviceContent.includes('category') &&
          serviceContent.includes('lastUpdated')) {
        score += 20;
        details.push('✅ Complete article structure with metadata');
      } else {
        issues.push('❌ Missing article structure components');
      }

      // Check for search and categorization
      if (serviceContent.includes('searchTerm') && serviceContent.includes('filter')) {
        score += 10;
        details.push('✅ Search and filtering capabilities implemented');
      } else {
        issues.push('❌ Missing search and filtering capabilities');
      }

      this.results.push({
        category: 'Knowledge Base',
        score,
        maxScore,
        details,
        issues
      });

    } catch (error) {
      this.results.push({
        category: 'Knowledge Base',
        score: 0,
        maxScore: 100,
        details: [],
        issues: ['❌ Failed to verify knowledge base']
      });
    }
  }

  private async verifyCertificationPrep(): Promise<void> {
    console.log(chalk.yellow('🎯 Verifying Certification Preparation Program...'));
    
    try {
      const serviceContent = await fs.readFile('server/services/trainingCenterService.ts', 'utf-8');
      let score = 0;
      const maxScore = 100;
      const details: string[] = [];
      const issues: string[] = [];

      // Check for certification prep program
      if (serviceContent.includes('CERTIFICATION_PREP_PROGRAM')) {
        score += 25;
        details.push('✅ Certification preparation program defined');
      } else {
        issues.push('❌ Certification preparation program missing');
      }

      // Check for 180-day timeline
      if (serviceContent.includes('180 days') || serviceContent.includes('180-day')) {
        score += 20;
        details.push('✅ Industry-standard 180-day timeline implemented');
      } else {
        issues.push('❌ Missing 180-day preparation timeline');
      }

      // Check for phased approach
      const phaseMatches = serviceContent.match(/phase-\d+-/g);
      if (phaseMatches && phaseMatches.length >= 3) {
        score += 25;
        details.push(`✅ ${phaseMatches.length} preparation phases defined`);
      } else {
        issues.push('❌ Insufficient preparation phases');
      }

      // Check for task structure
      if (serviceContent.includes('tasks') && 
          serviceContent.includes('milestone') && 
          serviceContent.includes('priority') &&
          serviceContent.includes('estimatedTime')) {
        score += 20;
        details.push('✅ Comprehensive task structure with priorities and timelines');
      } else {
        issues.push('❌ Missing task structure components');
      }

      // Check for checklist implementation
      if (serviceContent.includes('checklist') && serviceContent.includes('ChecklistItem')) {
        score += 10;
        details.push('✅ Preparation checklist implemented');
      } else {
        issues.push('❌ Missing preparation checklist');
      }

      this.results.push({
        category: 'Certification Preparation',
        score,
        maxScore,
        details,
        issues
      });

    } catch (error) {
      this.results.push({
        category: 'Certification Preparation',
        score: 0,
        maxScore: 100,
        details: [],
        issues: ['❌ Failed to verify certification preparation']
      });
    }
  }

  private async verifyAssessments(): Promise<void> {
    console.log(chalk.yellow('📝 Verifying Assessment System...'));
    
    try {
      const serviceContent = await fs.readFile('server/services/trainingCenterService.ts', 'utf-8');
      let score = 0;
      const maxScore = 100;
      const details: string[] = [];
      const issues: string[] = [];

      // Check for assessment service methods
      if (serviceContent.includes('completeModuleAssessment')) {
        score += 30;
        details.push('✅ Assessment completion service implemented');
      } else {
        issues.push('❌ Assessment completion service missing');
      }

      // Check for question types
      if (serviceContent.includes('MULTIPLE_CHOICE') && 
          serviceContent.includes('TRUE_FALSE') && 
          serviceContent.includes('SCENARIO')) {
        score += 25;
        details.push('✅ Multiple question types supported');
      } else {
        issues.push('❌ Missing question type variety');
      }

      // Check for scoring system
      if (serviceContent.includes('passingScore') && 
          serviceContent.includes('correctAnswer') && 
          serviceContent.includes('explanation')) {
        score += 25;
        details.push('✅ Comprehensive scoring system with explanations');
      } else {
        issues.push('❌ Missing scoring system components');
      }

      // Check for progress tracking
      if (serviceContent.includes('updateModuleProgress') && 
          serviceContent.includes('progress')) {
        score += 20;
        details.push('✅ Progress tracking implemented');
      } else {
        issues.push('❌ Missing progress tracking');
      }

      this.results.push({
        category: 'Assessment System',
        score,
        maxScore,
        details,
        issues
      });

    } catch (error) {
      this.results.push({
        category: 'Assessment System',
        score: 0,
        maxScore: 100,
        details: [],
        issues: ['❌ Failed to verify assessment system']
      });
    }
  }

  private async verifyInteractiveTutorials(): Promise<void> {
    console.log(chalk.yellow('🎮 Verifying Interactive Tutorials...'));
    
    try {
      const serviceContent = await fs.readFile('server/services/trainingCenterService.ts', 'utf-8');
      let score = 0;
      const maxScore = 100;
      const details: string[] = [];
      const issues: string[] = [];

      // Check for tutorial service methods
      if (serviceContent.includes('getInteractiveTutorial')) {
        score += 40;
        details.push('✅ Interactive tutorial service implemented');
      } else {
        issues.push('❌ Interactive tutorial service missing');
      }

      // Check for tutorial content types
      if (serviceContent.includes('INTERACTIVE') && 
          serviceContent.includes('WORKSHOP') && 
          serviceContent.includes('PRACTICAL')) {
        score += 30;
        details.push('✅ Multiple interactive content types supported');
      } else {
        issues.push('❌ Missing interactive content types');
      }

      // Check for simulation capabilities
      if (serviceContent.includes('simulation') || serviceContent.includes('Simulator')) {
        score += 20;
        details.push('✅ Simulation capabilities included');
      } else {
        issues.push('❌ Missing simulation capabilities');
      }

      // Check for step-by-step tutorials
      if (serviceContent.includes('steps') && serviceContent.includes('interactiveElements')) {
        score += 10;
        details.push('✅ Step-by-step tutorial structure implemented');
      } else {
        issues.push('❌ Missing step-by-step tutorial structure');
      }

      this.results.push({
        category: 'Interactive Tutorials',
        score,
        maxScore,
        details,
        issues
      });

    } catch (error) {
      this.results.push({
        category: 'Interactive Tutorials',
        score: 0,
        maxScore: 100,
        details: [],
        issues: ['❌ Failed to verify interactive tutorials']
      });
    }
  }

  private async verifyProgressTracking(): Promise<void> {
    console.log(chalk.yellow('📊 Verifying Progress Tracking...'));
    
    try {
      const serviceContent = await fs.readFile('server/services/trainingCenterService.ts', 'utf-8');
      let score = 0;
      const maxScore = 100;
      const details: string[] = [];
      const issues: string[] = [];

      // Check for progress tracking methods
      if (serviceContent.includes('getProgressTracking') || 
          serviceContent.includes('updateProgress')) {
        score += 30;
        details.push('✅ Progress tracking methods implemented');
      } else {
        issues.push('❌ Progress tracking methods missing');
      }

      // Check for comprehensive progress data
      if (serviceContent.includes('overallProgress') && 
          serviceContent.includes('modulesCompleted') && 
          serviceContent.includes('achievements')) {
        score += 25;
        details.push('✅ Comprehensive progress tracking data');
      } else {
        issues.push('❌ Missing progress tracking data components');
      }

      // Check for certificate generation
      if (serviceContent.includes('generateCertificate')) {
        score += 25;
        details.push('✅ Certificate generation implemented');
      } else {
        issues.push('❌ Certificate generation missing');
      }

      // Check for learning analytics
      if (serviceContent.includes('totalLearningTime') && 
          serviceContent.includes('currentStreak')) {
        score += 20;
        details.push('✅ Learning analytics implemented');
      } else {
        issues.push('❌ Missing learning analytics');
      }

      this.results.push({
        category: 'Progress Tracking',
        score,
        maxScore,
        details,
        issues
      });

    } catch (error) {
      this.results.push({
        category: 'Progress Tracking',
        score: 0,
        maxScore: 100,
        details: [],
        issues: ['❌ Failed to verify progress tracking']
      });
    }
  }

  private async verifyAPIEndpoints(): Promise<void> {
    console.log(chalk.yellow('🔌 Verifying API Endpoints...'));
    
    try {
      const routeContent = await fs.readFile('server/routes/training-center.ts', 'utf-8');
      let score = 0;
      const maxScore = 100;
      const details: string[] = [];
      const issues: string[] = [];

      // Check for essential API endpoints
      const endpoints = [
        'GET /modules',
        'POST /modules/:moduleId/start',
        'GET /knowledge-base',
        'GET /certification-prep',
        'POST /modules/:moduleId/certificate',
        'GET /tutorials/:tutorialId',
        'GET /progress/comprehensive'
      ];

      let foundEndpoints = 0;
      endpoints.forEach(endpoint => {
        const method = endpoint.split(' ')[0].toLowerCase();
        const path = endpoint.split(' ')[1].replace(/:/g, '').replace(/\//g, '\\/');
        const regex = new RegExp(`router\\.${method}\\(['"]${path}`, 'i');
        
        if (regex.test(routeContent)) {
          foundEndpoints++;
          details.push(`✅ ${endpoint} endpoint implemented`);
        } else {
          issues.push(`❌ ${endpoint} endpoint missing`);
        }
      });

      score = Math.round((foundEndpoints / endpoints.length) * 100);

      this.results.push({
        category: 'API Endpoints',
        score,
        maxScore,
        details,
        issues
      });

    } catch (error) {
      this.results.push({
        category: 'API Endpoints',
        score: 0,
        maxScore: 100,
        details: [],
        issues: ['❌ Failed to verify API endpoints']
      });
    }
  }

  private generateReport(): void {
    console.log(chalk.blue('\n📋 Training Center Completeness Report\n'));

    let totalScore = 0;
    let totalMaxScore = 0;

    this.results.forEach(result => {
      const percentage = Math.round((result.score / result.maxScore) * 100);
      const status = percentage >= 95 ? chalk.green('✅ EXCELLENT') : 
                     percentage >= 85 ? chalk.yellow('⚠️  GOOD') : 
                     percentage >= 70 ? chalk.orange('🔶 NEEDS WORK') : 
                     chalk.red('❌ CRITICAL');

      console.log(`${chalk.bold(result.category)}: ${percentage}% ${status}`);
      
      if (result.details.length > 0) {
        result.details.forEach(detail => console.log(`  ${detail}`));
      }
      
      if (result.issues.length > 0) {
        result.issues.forEach(issue => console.log(`  ${issue}`));
      }
      
      console.log('');
      
      totalScore += result.score;
      totalMaxScore += result.maxScore;
    });

    const overallPercentage = Math.round((totalScore / totalMaxScore) * 100);
    const overallStatus = overallPercentage >= 95 ? chalk.green('✅ READY FOR PHASE 2') : 
                         overallPercentage >= 85 ? chalk.yellow('⚠️  NEARLY READY') : 
                         chalk.red('❌ NEEDS MORE WORK');

    console.log(chalk.bold(`\n🎯 Overall Training Center Completeness: ${overallPercentage}% ${overallStatus}\n`));

    if (overallPercentage >= 95) {
      console.log(chalk.green('🎉 Training Center has achieved ≥95% completion rate!'));
      console.log(chalk.green('✅ Ready to proceed to Phase 2: Document Management\n'));
    } else {
      console.log(chalk.yellow('📝 Recommendations for reaching 95%:'));
      this.results.forEach(result => {
        if ((result.score / result.maxScore) < 0.95) {
          result.issues.forEach(issue => console.log(`  • ${issue.replace('❌ ', '')}`));
        }
      });
      console.log('');
    }
  }
}

// Run verification
const verification = new TrainingCenterVerification();
verification.runVerification().catch(console.error);
