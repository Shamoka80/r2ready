
export class WorkflowMonitoringService {
  private static instance: WorkflowMonitoringService;
  private healthCheckInterval?: NodeJS.Timeout;
  private unhandledRejectionListenerAttached = false;
  private lastRecoveryTime = 0;
  private readonly RECOVERY_COOLDOWN = 300000; // 5 minutes cooldown between recoveries

  static getInstance(): WorkflowMonitoringService {
    if (!this.instance) {
      this.instance = new WorkflowMonitoringService();
    }
    return this.instance;
  }

  startMonitoring(): void {
    console.log('🔍 Starting workflow monitoring...');
    
    // Set up unhandled rejection listener once (not inside interval)
    if (!this.unhandledRejectionListenerAttached) {
      process.on('unhandledRejection', (reason, promise) => {
        console.error('🚨 Unhandled Promise Rejection:', reason);
      });
      this.unhandledRejectionListenerAttached = true;
    }
    
    // Monitor health every 60 seconds (reduced from 30 to lower overhead)
    this.healthCheckInterval = setInterval(async () => {
      try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const usagePercentage = (heapUsedMB / heapTotalMB) * 100;

        if (usagePercentage > 90) {
          console.warn(`⚠️  High memory usage: ${usagePercentage.toFixed(1)}%`);
          
          // Only trigger recovery if cooldown has passed
          const now = Date.now();
          if (now - this.lastRecoveryTime >= this.RECOVERY_COOLDOWN) {
            console.log('🔧 Triggering automatic health recovery...');
            await this.triggerHealthRecovery();
            this.lastRecoveryTime = now;
          }
        }
        
      } catch (error) {
        console.error('Workflow monitoring error:', error);
      }
    }, 60000); // Increased to 60 seconds
  }

  private async triggerHealthRecovery(): Promise<void> {
    try {
      // Perform recovery inline instead of spawning a new process
      // This reduces memory overhead significantly
      if (global.gc) {
        global.gc();
      }
      console.log('✅ Automatic health recovery completed');
    } catch (error) {
      console.error('❌ Automatic health recovery failed:', error);
    }
  }

  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      console.log('⏹️  Workflow monitoring stopped');
    }
  }
}
