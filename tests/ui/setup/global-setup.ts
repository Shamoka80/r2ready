import { FullConfig } from '@playwright/test';
import { setupServer } from 'msw/node';
import { handlers } from './msw';

async function globalSetup(_config: FullConfig) {
  // Start MSW server for API mocking
  const server = setupServer(...handlers);
  server.listen();
  
  // Store server instance for cleanup
  (global as unknown as { __MSW_SERVER__: any }).__MSW_SERVER__ = server;
  
  console.log('🎭 Global setup completed - MSW server started');
}

export default globalSetup;