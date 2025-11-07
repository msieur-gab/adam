/**
 * Performance Monitoring Utility for ADAM
 * Helps track and debug performance bottlenecks
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.enabled = true;
  }

  /**
   * Start timing an operation
   */
  start(label) {
    if (!this.enabled) return;

    this.metrics.set(label, {
      startTime: performance.now(),
      label: label
    });
  }

  /**
   * End timing and log the result
   */
  end(label) {
    if (!this.enabled) return;

    const metric = this.metrics.get(label);
    if (!metric) {
      console.warn(`Performance metric '${label}' was never started`);
      return;
    }

    const duration = performance.now() - metric.startTime;
    this.metrics.delete(label);

    // Color-code based on duration
    let emoji = '✅';
    let style = 'color: green';

    if (duration > 1000) {
      emoji = '🔴';
      style = 'color: red; font-weight: bold';
    } else if (duration > 500) {
      emoji = '🟡';
      style = 'color: orange';
    } else if (duration > 200) {
      emoji = '🟠';
      style = 'color: #ff8800';
    }

    console.log(
      `%c${emoji} [PERF] ${label}: ${duration.toFixed(2)}ms`,
      style
    );

    return duration;
  }

  /**
   * Get memory stats (Chrome only)
   */
  getMemoryStats() {
    if (!performance.memory) {
      return { available: false };
    }

    const used = performance.memory.usedJSHeapSize;
    const total = performance.memory.totalJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;

    return {
      available: true,
      usedMB: (used / 1024 / 1024).toFixed(2),
      totalMB: (total / 1024 / 1024).toFixed(2),
      limitMB: (limit / 1024 / 1024).toFixed(2),
      usage: ((used / limit) * 100).toFixed(1) + '%'
    };
  }

  /**
   * Get device info for debugging
   */
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cores: navigator.hardwareConcurrency || 'unknown',
      memory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'unknown',
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink + 'Mbps',
        rtt: navigator.connection.rtt + 'ms',
        saveData: navigator.connection.saveData
      } : 'unknown',
      gpu: this.detectGPU()
    };
  }

  /**
   * Detect GPU capabilities
   */
  async detectGPU() {
    // Check for WebGPU
    if ('gpu' in navigator) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          return {
            type: 'WebGPU',
            available: true,
            info: adapter.info || 'Available'
          };
        }
      } catch (e) {
        // WebGPU not available
      }
    }

    // Check for WebGL
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo
          ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : 'Unknown';

        return {
          type: 'WebGL',
          available: true,
          renderer: renderer
        };
      }
    } catch (e) {
      // WebGL not available
    }

    return {
      type: 'None',
      available: false
    };
  }

  /**
   * Log comprehensive performance report
   */
  async logReport() {
    const memory = this.getMemoryStats();
    const device = this.getDeviceInfo();

    console.group('📊 ADAM Performance Report');

    console.group('💾 Memory Stats');
    if (memory.available) {
      console.table({
        'Used Heap': memory.usedMB + ' MB',
        'Total Heap': memory.totalMB + ' MB',
        'Heap Limit': memory.limitMB + ' MB',
        'Usage': memory.usage
      });
    } else {
      console.log('Memory API not available');
    }
    console.groupEnd();

    console.group('📱 Device Info');
    console.log('Platform:', device.platform);
    console.log('CPU Cores:', device.cores);
    console.log('Device Memory:', device.memory);

    const gpu = await device.gpu;
    console.log('GPU:', gpu.type, gpu.available ? '✅' : '❌');
    if (gpu.renderer) console.log('Renderer:', gpu.renderer);

    if (device.connection !== 'unknown') {
      console.log('Network:', device.connection.effectiveType, '-', device.connection.downlink);
      console.log('Latency:', device.connection.rtt);
      console.log('Data Saver:', device.connection.saveData ? 'ON' : 'OFF');
    }
    console.groupEnd();

    console.groupEnd();
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.perfMonitor = perfMonitor;
  window.showPerf = () => perfMonitor.logReport();
}
