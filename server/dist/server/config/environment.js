/**
 * Environment Detection Module
 *
 * Provides environment detection for TEST, DEVELOPMENT, and PRODUCTION
 * Used by test user guards and deployment verification
 */
export var Environment;
(function (Environment) {
    Environment["PRODUCTION"] = "PRODUCTION";
    Environment["DEVELOPMENT"] = "DEVELOPMENT";
    Environment["TEST"] = "TEST";
})(Environment || (Environment = {}));
/**
 * Detect the current environment based on NODE_ENV and other indicators
 */
export function detectEnvironment() {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    // Explicit environment detection
    if (nodeEnv === "production") {
        return Environment.PRODUCTION;
    }
    if (nodeEnv === "test" || process.env.CI === "true") {
        return Environment.TEST;
    }
    // Check for Replit deployment indicators
    if (process.env.REPL_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT === "1") {
        return Environment.PRODUCTION;
    }
    // Default to development
    return Environment.DEVELOPMENT;
}
/**
 * Check if currently in production environment
 */
export function isProduction() {
    return detectEnvironment() === Environment.PRODUCTION;
}
/**
 * Check if currently in development environment
 */
export function isDevelopment() {
    return detectEnvironment() === Environment.DEVELOPMENT;
}
/**
 * Check if currently in test environment
 */
export function isTest() {
    return detectEnvironment() === Environment.TEST;
}
/**
 * Get current environment as string
 */
export function getEnvironmentName() {
    return detectEnvironment();
}
// Export current environment for quick access
export const currentEnvironment = detectEnvironment();
