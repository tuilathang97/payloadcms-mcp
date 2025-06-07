/**
 * Development Logger for PayloadCMS MCP Server
 * 
 * Logs detailed debugging information to local machine when in development mode
 */

import fs from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  module: string;
  message: string;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDev: boolean;
  private logFile: string;

  constructor() {
    this.isDev = process.env['NODE_ENV'] === 'development' || process.env['DEBUG'] === 'true';
    this.logFile = path.join(process.cwd(), 'mcp-debug.log');
    
    if (this.isDev) {
      this.info('Logger', 'Development logging enabled', { logFile: this.logFile });
    }
  }

  private writeLog(entry: LogEntry): void {
    if (!this.isDev) return;

    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private createEntry(
    level: LogEntry['level'], 
    module: string, 
    message: string, 
    data?: any, 
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message
    };

    if (data !== undefined) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    }

    return entry;
  }

  info(module: string, message: string, data?: any): void {
    const entry = this.createEntry('info', module, message, data);
    this.writeLog(entry);
    
    if (this.isDev) {
      console.log(`[${entry.timestamp}] [${module}] ${message}`, data ? data : '');
    }
  }

  warn(module: string, message: string, data?: any): void {
    const entry = this.createEntry('warn', module, message, data);
    this.writeLog(entry);
    
    if (this.isDev) {
      console.warn(`[${entry.timestamp}] [${module}] ${message}`, data ? data : '');
    }
  }

  error(module: string, message: string, error?: Error, data?: any): void {
    const entry = this.createEntry('error', module, message, data, error);
    this.writeLog(entry);
    
    if (this.isDev) {
      console.error(`[${entry.timestamp}] [${module}] ${message}`, error ? error : '', data ? data : '');
    }
  }

  debug(module: string, message: string, data?: any): void {
    const entry = this.createEntry('debug', module, message, data);
    this.writeLog(entry);
    
    if (this.isDev) {
      console.debug(`[${entry.timestamp}] [${module}] ${message}`, data ? data : '');
    }
  }

  // PayloadCMS specific logging methods
  payloadAuth(success: boolean, method: 'jwt' | 'apikey', details?: any): void {
    this.info('PayloadAuth', `Authentication ${success ? 'successful' : 'failed'} using ${method}`, details);
  }

  payloadRequest(method: string, url: string, data?: any): void {
    this.debug('PayloadRequest', `${method.toUpperCase()} ${url}`, data);
  }

  payloadResponse(method: string, url: string, status: number, data?: any): void {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    this.log(level, 'PayloadResponse', `${method.toUpperCase()} ${url} - ${status}`, data);
  }

  payloadError(method: string, url: string, error: any): void {
    this.error('PayloadError', `${method.toUpperCase()} ${url} failed`, error, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers
    });
  }

  contextGathering(step: string, result: string, data?: any): void {
    this.info('ContextGathering', `${step}: ${result}`, data);
  }

  contentGeneration(collection: string, action: string, result: string, data?: any): void {
    this.info('ContentGeneration', `${collection} ${action}: ${result}`, data);
  }

  private log(level: LogEntry['level'], module: string, message: string, data?: any): void {
    const entry = this.createEntry(level, module, message, data);
    this.writeLog(entry);
    
    if (this.isDev) {
      const logFn = level === 'error' ? console.error : 
                   level === 'warn' ? console.warn : 
                   level === 'debug' ? console.debug : 
                   console.log;
      logFn(`[${entry.timestamp}] [${module}] ${message}`, data ? data : '');
    }
  }

  // Clear log file
  clearLog(): void {
    if (this.isDev && fs.existsSync(this.logFile)) {
      fs.unlinkSync(this.logFile);
      this.info('Logger', 'Log file cleared');
    }
  }
}

// Export singleton instance
export const logger = new Logger();