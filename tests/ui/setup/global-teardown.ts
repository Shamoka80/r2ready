import { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig) {
  // Clean up MSW server
  const server = (global as unknown as { __MSW_SERVER__: any }).__MSW_SERVER__;
  if (server) {
    server.close();
    console.log('🎭 Global teardown completed - MSW server stopped');
  }
}

export default globalTeardown;