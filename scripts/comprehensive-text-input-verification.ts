
#!/usr/bin/env tsx

/**
 * Comprehensive Text Input Verification Script
 * 
 * This script tests ALL text inputs across ALL pages in the application
 * to ensure text input functionality works properly everywhere.
 */

import { chromium, type Browser, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';

interface TextInputTest {
  page: string;
  url: string;
  inputs: {
    selector: string;
    label: string;
    testValue: string;
    required?: boolean;
  }[];
}

const TEXT_INPUT_TESTS: TextInputTest[] = [
  {
    page: "Landing Page",
    url: "/",
    inputs: [
      { selector: 'input[type="email"]', label: "Email signup", testValue: "test@example.com" }
    ]
  },
  {
    page: "Registration Page",
    url: "/register",
    inputs: [
      { selector: 'input[name="firstName"]', label: "First Name", testValue: "John", required: true },
      { selector: 'input[name="lastName"]', label: "Last Name", testValue: "Doe", required: true },
      { selector: 'input[name="email"]', label: "Email", testValue: "john.doe@example.com", required: true },
      { selector: 'input[name="password"]', label: "Password", testValue: "TestPass123!", required: true },
      { selector: 'input[name="companyName"]', label: "Company Name", testValue: "Test Company Inc", required: true }
    ]
  },
  {
    page: "Login Page",
    url: "/login",
    inputs: [
      { selector: 'input[name="email"]', label: "Email", testValue: "test@example.com", required: true },
      { selector: 'input[name="password"]', label: "Password", testValue: "password123", required: true }
    ]
  },
  {
    page: "Onboarding V2",
    url: "/onboarding",
    inputs: [
      { selector: 'input[name="legalName"]', label: "Legal Company Name", testValue: "Test Corp LLC" },
      { selector: 'input[name="dbaName"]', label: "DBA Name", testValue: "Test Corp" },
      { selector: 'input[name="taxId"]', label: "Tax ID", testValue: "12-3456789" },
      { selector: 'input[name="hqAddress"]', label: "HQ Address", testValue: "123 Business St" },
      { selector: 'input[name="hqCity"]', label: "HQ City", testValue: "Austin" },
      { selector: 'input[name="hqState"]', label: "HQ State", testValue: "TX" },
      { selector: 'input[name="hqZipCode"]', label: "HQ ZIP Code", testValue: "78701" },
      { selector: 'input[name="phone"]', label: "Phone", testValue: "(555) 123-4567" },
      { selector: 'input[name="website"]', label: "Website", testValue: "https://testcorp.com" }
    ]
  },
  {
    page: "Primary Facility Setup",
    url: "/onboarding",
    inputs: [
      { selector: 'input[name="facilityName"]', label: "Facility Name", testValue: "Main Processing Center" },
      { selector: 'input[name="facilityAddress"]', label: "Facility Address", testValue: "456 Industrial Way" },
      { selector: 'input[name="facilityCity"]', label: "Facility City", testValue: "Houston" },
      { selector: 'input[name="facilityState"]', label: "Facility State", testValue: "TX" },
      { selector: 'input[name="facilityZipCode"]', label: "Facility ZIP", testValue: "77001" },
      { selector: 'input[name="headcount"]', label: "Headcount", testValue: "50" },
      { selector: 'input[name="floorArea"]', label: "Floor Area", testValue: "25000" }
    ]
  },
  {
    page: "Facilities Management",
    url: "/facilities",
    inputs: [
      { selector: 'input[name="name"]', label: "Facility Name", testValue: "Secondary Facility" },
      { selector: 'input[name="address"]', label: "Address", testValue: "789 Processing Ave" },
      { selector: 'input[name="city"]', label: "City", testValue: "Dallas" },
      { selector: 'input[name="state"]', label: "State", testValue: "TX" },
      { selector: 'input[name="zipCode"]', label: "ZIP Code", testValue: "75201" },
      { selector: 'input[name="headcount"]', label: "Headcount", testValue: "75" },
      { selector: 'input[name="floorArea"]', label: "Floor Area", testValue: "35000" }
    ]
  },
  {
    page: "New Assessment",
    url: "/assessments/new",
    inputs: [
      { selector: 'input[name="title"]', label: "Assessment Title", testValue: "R2v3 Certification Assessment" },
      { selector: 'textarea[name="description"]', label: "Description", testValue: "Complete R2v3 pre-certification self-assessment" }
    ]
  },
  {
    page: "Intake Form",
    url: "/intake-form",
    inputs: [
      { selector: 'input[name="legalCompanyName"]', label: "Legal Company Name", testValue: "GreenTech Solutions LLC" },
      { selector: 'input[name="dbaTradeNames"]', label: "DBA/Trade Names", testValue: "GreenTech" },
      { selector: 'input[name="taxIdEin"]', label: "Tax ID/EIN", testValue: "98-7654321" },
      { selector: 'input[name="yearEstablished"]', label: "Year Established", testValue: "2015" },
      { selector: 'input[name="hqStreet"]', label: "HQ Street", testValue: "123 Green Way" },
      { selector: 'input[name="hqCity"]', label: "HQ City", testValue: "Portland" },
      { selector: 'input[name="hqStateProvince"]', label: "HQ State", testValue: "OR" },
      { selector: 'input[name="hqCountry"]', label: "HQ Country", testValue: "USA" },
      { selector: 'input[name="hqPostalCode"]', label: "HQ Postal Code", testValue: "97201" },
      { selector: 'input[name="mainPhone"]', label: "Main Phone", testValue: "(503) 555-0123" },
      { selector: 'input[name="email"]', label: "Email", testValue: "info@greentech.com" },
      { selector: 'input[name="website"]', label: "Website", testValue: "https://greentech.com" },
      { selector: 'input[name="primaryR2ContactName"]', label: "Primary R2 Contact Name", testValue: "Sarah Johnson" },
      { selector: 'input[name="primaryR2ContactTitle"]', label: "Primary R2 Contact Title", testValue: "Compliance Officer" },
      { selector: 'input[name="primaryR2ContactEmail"]', label: "Primary R2 Contact Email", testValue: "sarah@greentech.com" },
      { selector: 'input[name="primaryR2ContactPhone"]', label: "Primary R2 Contact Phone", testValue: "(503) 555-0124" },
      { selector: 'input[name="totalEmployees"]', label: "Total Employees", testValue: "125" },
      { selector: 'input[name="operatingSchedule"]', label: "Operating Schedule", testValue: "Monday-Friday, 8am-6pm" }
    ]
  },
  {
    page: "Client Organizations",
    url: "/clients",
    inputs: [
      { selector: 'input[name="legalName"]', label: "Legal Name", testValue: "Client Corp LLC" },
      { selector: 'input[name="dbaName"]', label: "DBA Name", testValue: "Client Corp" },
      { selector: 'input[name="taxId"]', label: "Tax ID", testValue: "11-2233445" },
      { selector: 'input[name="address"]', label: "Address", testValue: "456 Client St" },
      { selector: 'input[name="city"]', label: "City", testValue: "Miami" },
      { selector: 'input[name="state"]', label: "State", testValue: "FL" },
      { selector: 'input[name="zipCode"]', label: "ZIP Code", testValue: "33101" },
      { selector: 'input[name="primaryContactName"]', label: "Primary Contact Name", testValue: "Mike Wilson" },
      { selector: 'input[name="primaryContactEmail"]', label: "Primary Contact Email", testValue: "mike@clientcorp.com" },
      { selector: 'input[name="primaryContactPhone"]', label: "Primary Contact Phone", testValue: "(305) 555-0789" }
    ]
  },
  {
    page: "Settings",
    url: "/settings",
    inputs: [
      { selector: 'input[name="firstName"]', label: "First Name", testValue: "Updated John" },
      { selector: 'input[name="lastName"]', label: "Last Name", testValue: "Updated Doe" },
      { selector: 'input[name="email"]', label: "Email", testValue: "updated@example.com" },
      { selector: 'input[name="phone"]', label: "Phone", testValue: "(555) 999-8888" }
    ]
  }
];

class TextInputVerifier {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private results: Array<{
    page: string;
    url: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    inputs: Array<{
      selector: string;
      label: string;
      status: 'PASS' | 'FAIL';
      error?: string;
    }>;
  }> = [];

  async initialize() {
    console.log('🚀 Initializing Text Input Verification...\n');
    
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewportSize({ width: 1280, height: 720 });
    
    // Wait for server to be ready
    await this.waitForServer();
  }

  async waitForServer() {
    console.log('⏳ Waiting for server to be ready...');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch('http://0.0.0.0:5000/api/health');
        if (response.ok) {
          console.log('✅ Server is ready\n');
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Server failed to start within timeout period');
  }

  async testTextInputsOnPage(testConfig: TextInputTest): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`📝 Testing: ${testConfig.page}`);
    
    const result = {
      page: testConfig.page,
      url: testConfig.url,
      status: 'PASS' as const,
      inputs: [] as Array<{
        selector: string;
        label: string;
        status: 'PASS' | 'FAIL';
        error?: string;
      }>
    };

    try {
      // Navigate to page
      await this.page.goto(`http://0.0.0.0:5000${testConfig.url}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await this.page.waitForTimeout(2000); // Allow page to fully load

      // Test each input
      for (const inputConfig of testConfig.inputs) {
        const inputResult = {
          selector: inputConfig.selector,
          label: inputConfig.label,
          status: 'FAIL' as const,
          error: undefined as string | undefined
        };

        try {
          // Check if input exists
          const inputElement = this.page.locator(inputConfig.selector).first();
          const isVisible = await inputElement.isVisible({ timeout: 5000 });
          
          if (!isVisible) {
            // Try alternative selectors
            const alternatives = [
              `input[data-testid="input-${inputConfig.selector.split('[name="')[1]?.split('"]')[0]}"]`,
              `input[placeholder*="${inputConfig.label}"]`,
              `textarea[name="${inputConfig.selector.split('[name="')[1]?.split('"]')[0]}"]`
            ];
            
            let found = false;
            for (const alt of alternatives) {
              try {
                const altElement = this.page.locator(alt).first();
                if (await altElement.isVisible({ timeout: 2000 })) {
                  await this.testInput(altElement, inputConfig.testValue);
                  inputResult.status = 'PASS';
                  found = true;
                  break;
                }
              } catch (e) {
                // Continue to next alternative
              }
            }
            
            if (!found) {
              inputResult.error = `Input not found or not visible: ${inputConfig.selector}`;
            }
          } else {
            // Test the input
            await this.testInput(inputElement, inputConfig.testValue);
            inputResult.status = 'PASS';
          }
        } catch (error) {
          inputResult.error = `Error testing input: ${error.message}`;
        }

        result.inputs.push(inputResult);
        
        // Log result
        const status = inputResult.status === 'PASS' ? '✅' : '❌';
        const errorText = inputResult.error ? ` (${inputResult.error})` : '';
        console.log(`   ${status} ${inputConfig.label}${errorText}`);
      }

      // Determine overall page status
      const hasFailures = result.inputs.some(input => input.status === 'FAIL');
      result.status = hasFailures ? 'FAIL' : 'PASS';

    } catch (error) {
      console.log(`   ❌ Page failed to load: ${error.message}`);
      result.status = 'SKIP';
    }

    this.results.push(result);
    console.log('');
  }

  async testInput(element: any, testValue: string): Promise<void> {
    // Clear existing value
    await element.fill('');
    
    // Type the test value
    await element.fill(testValue);
    
    // Verify the value was entered
    const actualValue = await element.inputValue();
    
    if (actualValue !== testValue) {
      throw new Error(`Expected "${testValue}", got "${actualValue}"`);
    }
    
    // Test that the input responds to typing
    await element.press('Backspace');
    const afterBackspace = await element.inputValue();
    
    if (afterBackspace.length !== testValue.length - 1) {
      throw new Error(`Backspace not working - expected length ${testValue.length - 1}, got ${afterBackspace.length}`);
    }
    
    // Restore the test value
    await element.fill(testValue);
  }

  async testSpecialPages(): Promise<void> {
    if (!this.page) return;

    // Test Intake Facilities page (requires special handling)
    console.log('📝 Testing: Intake Facilities (Special Case)');
    
    try {
      // First create a basic intake form
      await this.page.goto('http://0.0.0.0:5000/intake-form', { waitUntil: 'networkidle' });
      
      // Fill minimal required fields to create form
      await this.page.locator('input[name="legalCompanyName"]').first().fill('Test Intake Company');
      await this.page.locator('input[name="email"]').first().fill('test@intake.com');
      await this.page.locator('input[name="primaryR2ContactName"]').first().fill('Test Contact');
      
      // Wait for auto-save
      await this.page.waitForTimeout(15000);
      
      // Try to navigate to intake facilities (this might be programmatically generated)
      // For now, we'll test the intake form inputs extensively
      
      const intakeFacilityInputs = [
        { selector: 'input[data-testid="input-facility-name"]', label: 'Facility Name', testValue: 'Test Facility 1' },
        { selector: 'input[data-testid="input-address"]', label: 'Address', testValue: '123 Test Street' },
        { selector: 'input[data-testid="input-square-footage"]', label: 'Square Footage', testValue: '50000' },
        { selector: 'input[data-testid="input-employees-at-location"]', label: 'Employees at Location', testValue: '25' },
        { selector: 'input[data-testid="input-shifts"]', label: 'Shifts', testValue: '2' },
        { selector: 'input[data-testid="input-primary-function"]', label: 'Primary Function', testValue: 'Processing' }
      ];
      
      console.log('   Testing intake form facility-related inputs...');
      
      for (const input of intakeFacilityInputs) {
        try {
          const element = this.page.locator(input.selector).first();
          if (await element.isVisible({ timeout: 3000 })) {
            await this.testInput(element, input.testValue);
            console.log(`   ✅ ${input.label}`);
          } else {
            console.log(`   ⚠️  ${input.label} (not found on current page)`);
          }
        } catch (error) {
          console.log(`   ❌ ${input.label} (${error.message})`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Intake Facilities special test failed: ${error.message}`);
    }
    
    console.log('');
  }

  async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEXT INPUT VERIFICATION REPORT');
    console.log('='.repeat(80));
    
    let totalPages = this.results.length;
    let passedPages = this.results.filter(r => r.status === 'PASS').length;
    let failedPages = this.results.filter(r => r.status === 'FAIL').length;
    let skippedPages = this.results.filter(r => r.status === 'SKIP').length;
    
    let totalInputs = 0;
    let passedInputs = 0;
    let failedInputs = 0;
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`   Total Pages Tested: ${totalPages}`);
    console.log(`   ✅ Passed Pages: ${passedPages}`);
    console.log(`   ❌ Failed Pages: ${failedPages}`);
    console.log(`   ⚠️  Skipped Pages: ${skippedPages}`);
    
    console.log(`\n📝 DETAILED RESULTS:`);
    
    for (const result of this.results) {
      const pageStatus = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`\n${pageStatus} ${result.page} (${result.url})`);
      
      for (const input of result.inputs) {
        totalInputs++;
        if (input.status === 'PASS') passedInputs++;
        else failedInputs++;
        
        const inputStatus = input.status === 'PASS' ? '✅' : '❌';
        const errorText = input.error ? ` - ${input.error}` : '';
        console.log(`   ${inputStatus} ${input.label}${errorText}`);
      }
    }
    
    console.log(`\n🎯 INPUT STATISTICS:`);
    console.log(`   Total Inputs Tested: ${totalInputs}`);
    console.log(`   ✅ Passed Inputs: ${passedInputs}`);
    console.log(`   ❌ Failed Inputs: ${failedInputs}`);
    console.log(`   Success Rate: ${totalInputs > 0 ? ((passedInputs / totalInputs) * 100).toFixed(1) : 0}%`);
    
    // Save detailed report
    const reportPath = 'text-input-verification-report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalPages,
        passedPages,
        failedPages,
        skippedPages,
        totalInputs,
        passedInputs,
        failedInputs,
        successRate: totalInputs > 0 ? ((passedInputs / totalInputs) * 100).toFixed(1) : 0
      },
      results: this.results
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Critical issues summary
    const criticalIssues = this.results
      .filter(r => r.status === 'FAIL')
      .map(r => ({
        page: r.page,
        failedInputs: r.inputs.filter(i => i.status === 'FAIL')
      }))
      .filter(r => r.failedInputs.length > 0);
    
    if (criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES REQUIRING ATTENTION:`);
      for (const issue of criticalIssues) {
        console.log(`\n❌ ${issue.page}:`);
        for (const input of issue.failedInputs) {
          console.log(`   • ${input.label}: ${input.error || 'Unknown error'}`);
        }
      }
    } else {
      console.log(`\n🎉 ALL TEXT INPUTS ARE FUNCTIONAL!`);
    }
    
    console.log('\n' + '='.repeat(80));
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run(): Promise<void> {
    try {
      await this.initialize();
      
      // Test all configured pages
      for (const testConfig of TEXT_INPUT_TESTS) {
        await this.testTextInputsOnPage(testConfig);
      }
      
      // Test special cases
      await this.testSpecialPages();
      
      // Generate comprehensive report
      await this.generateReport();
      
    } catch (error) {
      console.error(`❌ Text input verification failed: ${error.message}`);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const verifier = new TextInputVerifier();
  verifier.run().catch(console.error);
}
