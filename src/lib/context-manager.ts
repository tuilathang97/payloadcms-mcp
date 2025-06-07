/**
 * Context Manager for Multi-Step Bootstrap Operations
 * 
 * Manages context between multiple bootstrap calls with:
 * - UUID-based context storage
 * - 8-call limit tracking
 * - Dependency resolution state
 * - Created content tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { PreparedContent } from '../tools/prepare-tools.js';

export interface BootstrapContext {
  contextId: string;
  projectPath: string;
  callCount: number;
  maxCalls: number;
  
  // Configuration data
  preparedContent: PreparedContent | null;
  discoveredConfig: any;
  
  // User-provided content
  userContent: any;
  
  // Creation tracking
  createdContent: {
    media: Record<string, string>; // filename -> id
    [collection: string]: Record<string, string>; // title/name -> id
  };
  
  // Dependency management
  pendingDependencies: {
    [collection: string]: DependencyRequest[];
  };
  
  // Step history
  stepHistory: StepRecord[];
  
  // Timestamps
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
}

export interface DependencyRequest {
  field: string;
  relationTo: string;
  required: boolean;
  hasMany: boolean;
  description: string;
  suggestedContent?: any;
}

export interface StepRecord {
  step: string;
  timestamp: Date;
  callCount: number;
  status: 'success' | 'error' | 'needs_dependencies';
  message: string;
  data?: any;
}

export class ContextManager {
  private contexts: Map<string, BootstrapContext> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Clean up expired contexts every 30 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredContexts();
    }, 30 * 60 * 1000);
  }

  /**
   * Create a new bootstrap context
   */
  createContext(projectPath: string): BootstrapContext {
    const contextId = uuidv4();
    const now = new Date();
    
    const context: BootstrapContext = {
      contextId,
      projectPath,
      callCount: 0,
      maxCalls: 8,
      
      preparedContent: null,
      discoveredConfig: null,
      userContent: null,
      
      createdContent: {
        media: {}
      },
      
      pendingDependencies: {},
      stepHistory: [],
      
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours
    };
    
    this.contexts.set(contextId, context);
    
    logger.info('ContextManager', 'Created new context', { 
      contextId, 
      projectPath,
      expiresAt: context.expiresAt 
    });
    
    return context;
  }

  /**
   * Get existing context by ID
   */
  getContext(contextId: string): BootstrapContext | null {
    const context = this.contexts.get(contextId);
    
    if (!context) {
      logger.warn('ContextManager', 'Context not found', { contextId });
      return null;
    }
    
    if (context.expiresAt < new Date()) {
      logger.warn('ContextManager', 'Context expired', { 
        contextId, 
        expiresAt: context.expiresAt 
      });
      this.contexts.delete(contextId);
      return null;
    }
    
    // Update last accessed time
    context.lastAccessedAt = new Date();
    
    return context;
  }

  /**
   * Update context with new data
   */
  updateContext(contextId: string, updates: Partial<BootstrapContext>): boolean {
    const context = this.getContext(contextId);
    
    if (!context) {
      return false;
    }
    
    // Merge updates
    Object.assign(context, updates);
    context.lastAccessedAt = new Date();
    
    logger.debug('ContextManager', 'Updated context', { 
      contextId, 
      updateKeys: Object.keys(updates) 
    });
    
    return true;
  }

  /**
   * Increment call count and check limit
   */
  incrementCallCount(contextId: string): { success: boolean; callCount: number; limitReached: boolean } {
    const context = this.getContext(contextId);
    
    if (!context) {
      return { success: false, callCount: 0, limitReached: false };
    }
    
    context.callCount++;
    context.lastAccessedAt = new Date();
    
    const limitReached = context.callCount >= context.maxCalls;
    
    logger.info('ContextManager', 'Incremented call count', { 
      contextId, 
      callCount: context.callCount, 
      maxCalls: context.maxCalls,
      limitReached 
    });
    
    return { 
      success: true, 
      callCount: context.callCount, 
      limitReached 
    };
  }

  /**
   * Add step to history
   */
  addStepToHistory(
    contextId: string, 
    step: string, 
    status: 'success' | 'error' | 'needs_dependencies',
    message: string,
    data?: any
  ): boolean {
    const context = this.getContext(contextId);
    
    if (!context) {
      return false;
    }
    
    const stepRecord: StepRecord = {
      step,
      timestamp: new Date(),
      callCount: context.callCount,
      status,
      message,
      data
    };
    
    context.stepHistory.push(stepRecord);
    
    logger.debug('ContextManager', 'Added step to history', { 
      contextId, 
      step, 
      status,
      totalSteps: context.stepHistory.length 
    });
    
    return true;
  }

  /**
   * Track created content
   */
  trackCreatedContent(
    contextId: string, 
    collection: string, 
    identifier: string, 
    id: string
  ): boolean {
    const context = this.getContext(contextId);
    
    if (!context) {
      return false;
    }
    
    if (!context.createdContent[collection]) {
      context.createdContent[collection] = {};
    }
    
    context.createdContent[collection][identifier] = id;
    
    logger.debug('ContextManager', 'Tracked created content', { 
      contextId, 
      collection, 
      identifier, 
      id 
    });
    
    return true;
  }

  /**
   * Get created content ID
   */
  getCreatedContentId(contextId: string, collection: string, identifier: string): string | null {
    const context = this.getContext(contextId);
    
    if (!context || !context.createdContent[collection]) {
      return null;
    }
    
    return context.createdContent[collection][identifier] || null;
  }

  /**
   * Add pending dependency
   */
  addPendingDependency(
    contextId: string, 
    collection: string, 
    dependency: DependencyRequest
  ): boolean {
    const context = this.getContext(contextId);
    
    if (!context) {
      return false;
    }
    
    if (!context.pendingDependencies[collection]) {
      context.pendingDependencies[collection] = [];
    }
    
    context.pendingDependencies[collection].push(dependency);
    
    logger.debug('ContextManager', 'Added pending dependency', { 
      contextId, 
      collection, 
      field: dependency.field, 
      relationTo: dependency.relationTo 
    });
    
    return true;
  }

  /**
   * Get pending dependencies for collection
   */
  getPendingDependencies(contextId: string, collection?: string): Record<string, DependencyRequest[]> | DependencyRequest[] | null {
    const context = this.getContext(contextId);
    
    if (!context) {
      return null;
    }
    
    if (collection) {
      return context.pendingDependencies[collection] || [];
    }
    
    return context.pendingDependencies;
  }

  /**
   * Clear pending dependencies for collection
   */
  clearPendingDependencies(contextId: string, collection: string): boolean {
    const context = this.getContext(contextId);
    
    if (!context) {
      return false;
    }
    
    delete context.pendingDependencies[collection];
    
    logger.debug('ContextManager', 'Cleared pending dependencies', { 
      contextId, 
      collection 
    });
    
    return true;
  }

  /**
   * Check if context has reached call limit
   */
  hasReachedCallLimit(contextId: string): boolean {
    const context = this.getContext(contextId);
    
    if (!context) {
      return true; // Safe default
    }
    
    return context.callCount >= context.maxCalls;
  }

  /**
   * Get context summary
   */
  getContextSummary(contextId: string): any {
    const context = this.getContext(contextId);
    
    if (!context) {
      return null;
    }
    
    return {
      contextId: context.contextId,
      projectPath: context.projectPath,
      callCount: context.callCount,
      maxCalls: context.maxCalls,
      totalSteps: context.stepHistory.length,
      createdCollections: Object.keys(context.createdContent),
      pendingDependencyCollections: Object.keys(context.pendingDependencies),
      createdAt: context.createdAt,
      lastAccessedAt: context.lastAccessedAt,
      expiresAt: context.expiresAt
    };
  }

  /**
   * Delete context
   */
  deleteContext(contextId: string): boolean {
    const existed = this.contexts.has(contextId);
    this.contexts.delete(contextId);
    
    if (existed) {
      logger.info('ContextManager', 'Deleted context', { contextId });
    }
    
    return existed;
  }

  /**
   * Clean up expired contexts
   */
  private cleanupExpiredContexts(): void {
    const now = new Date();
    const expiredContexts: string[] = [];
    
    for (const [contextId, context] of this.contexts.entries()) {
      if (context.expiresAt < now) {
        expiredContexts.push(contextId);
      }
    }
    
    for (const contextId of expiredContexts) {
      this.contexts.delete(contextId);
    }
    
    if (expiredContexts.length > 0) {
      logger.info('ContextManager', 'Cleaned up expired contexts', { 
        expiredCount: expiredContexts.length,
        remainingCount: this.contexts.size 
      });
    }
  }

  /**
   * Get total contexts count
   */
  getContextCount(): number {
    return this.contexts.size;
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.contexts.clear();
    logger.info('ContextManager', 'Context manager destroyed');
  }
}

// Global instance
export const contextManager = new ContextManager();