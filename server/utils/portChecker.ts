
/**
 * Port validation and health check utilities
 */
import net from 'net';

export interface PortStatus {
  port: number;
  available: boolean;
  service?: string;
}

export class PortChecker {
  /**
   * Check if a port is available
   */
  static async isPortAvailable(port: number, host = '0.0.0.0'): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, host, () => {
        server.close(() => resolve(true));
      });
      
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Find the next available port starting from a base port
   */
  static async findAvailablePort(basePort: number, maxAttempts = 10): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
      const port = basePort + i;
      const available = await this.isPortAvailable(port);
      if (available) {
        return port;
      }
    }
    throw new Error(`No available port found starting from ${basePort}`);
  }

  /**
   * Validate required ports for the application
   */
  static async validateApplicationPorts(): Promise<PortStatus[]> {
    const requiredPorts = [
      { port: 5000, service: 'Express API Server' },
      { port: 5173, service: 'Vite Dev Server' },
      { port: 5174, service: 'Vite HMR' }
    ];

    const results: PortStatus[] = [];

    for (const { port, service } of requiredPorts) {
      const available = await this.isPortAvailable(port);
      results.push({ port, available, service });
      
      // If a critical port is unavailable, suggest alternatives
      if (!available && (port === 5000 || port === 5173)) {
        const alternativePort = await this.findAvailablePort(port + 1, 5);
        console.log(`⚠️  Port ${port} (${service}) is unavailable. Alternative: ${alternativePort}`);
      }
    }

    return results;
  }

  /**
   * Health check for proxy connections
   */
  static async checkProxyHealth(targetUrl: string, timeout = 5000): Promise<boolean> {
    try {
      const response = await fetch(`${targetUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
