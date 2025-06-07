/**
 * Refactored Bootstrap Tools with Context Management
 * 
 * Implements smart multi-step bootstrap flow with:
 * - Context management with 8-call limit
 * - Smart dependency resolution 
 * - Reusable media management
 * - Iterative content creation
 */

import { logger } from '../utils/logger.js';
import { PayloadCMSClient } from './payload-client.js';
import { contextManager, BootstrapContext, DependencyRequest } from './context-manager.js';
import { DependencyResolver } from './dependency-resolver.js';
import { MediaManager } from './media-manager.js';
import { prepareContent } from '../tools/prepare-tools.js';

export interface BootstrapInput {
  // Step management
  step?: 'discover_config' | 'generate_content' | 'resolve_dependencies';
  contextId?: string;
  
  // Project configuration
  projectPath: string;
  
  // User content (for generate_content step)
  userContent?: any;
  
  // Dependency resolution (for resolve_dependencies step)
  dependencyContent?: any;
  
  // Options
  resolveRelationships?: boolean;
  continueOnError?: boolean;
}

export interface BootstrapResponse {
  success: boolean;
  status: 'complete' | 'needs_user_content' | 'needs_dependencies' | 'error' | 'call_limit_reached';
  
  // Context tracking
  contextId?: string;
  callCount?: number;
  maxCalls?: number;
  
  // Step-specific data
  contentTemplates?: any;
  missingDependencies?: { [collection: string]: DependencyRequest[] };
  createdContent?: any;
  
  // Results
  discoveredConfig?: any;
  parsedStructure?: any;
  metadata?: any;
  
  // Error handling
  message: string;
  error?: string;
  partialResults?: any;
}

export class RefactoredBootstrap {
  private payloadClient: PayloadCMSClient;
  private dependencyResolver: DependencyResolver;
  private mediaManager: MediaManager;

  constructor() {
    this.payloadClient = new PayloadCMSClient({
      host: process.env['PAYLOAD_HOST'] || process.env['PAYLOAD_URL'] || 'http://localhost:3000',
      apiKey: process.env['PAYLOAD_API_KEY'],
      email: process.env['PAYLOAD_USERNAME'] || process.env['PAYLOAD_EMAIL'],
      password: process.env['PAYLOAD_PASSWORD']
    });
    
    this.dependencyResolver = new DependencyResolver(this.payloadClient);
    this.mediaManager = new MediaManager(this.payloadClient);
  }

  /**
   * Main bootstrap entry point
   */
  async bootstrap(input: BootstrapInput): Promise<BootstrapResponse> {
    try {
      // Initialize PayloadCMS client
      await this.payloadClient.initialize();
      
      const step = input.step || 'discover_config';
      
      logger.info('RefactoredBootstrap', 'Starting bootstrap', { 
        step, 
        contextId: input.contextId,
        projectPath: input.projectPath 
      });

      switch (step) {
        case 'discover_config':
          return await this.handleDiscoverConfig(input);
          
        case 'generate_content':
          return await this.handleGenerateContent(input);
          
        case 'resolve_dependencies':
          return await this.handleResolveDependencies(input);
          
        default:
          return {
            success: false,
            status: 'error',
            message: `Unknown step: ${step}`,
            error: `Invalid step parameter: ${step}`
          };
      }
    } catch (error) {
      logger.error('RefactoredBootstrap', 'Bootstrap failed', error instanceof Error ? error : undefined);
      
      return {
        success: false,
        status: 'error',
        message: 'Bootstrap operation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Step 1: Discover configuration and return content templates
   */
  private async handleDiscoverConfig(input: BootstrapInput): Promise<BootstrapResponse> {
    logger.info('RefactoredBootstrap', 'Handling discover config step');

    // Create new context
    const context = contextManager.createContext(input.projectPath);
    const callResult = contextManager.incrementCallCount(context.contextId);

    if (callResult.limitReached) {
      return {
        success: false,
        status: 'call_limit_reached',
        contextId: context.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        message: 'Maximum number of calls reached'
      };
    }

    try {
      // Prepare content using existing prepare-tools
      const preparedContent = await prepareContent({ projectPath: input.projectPath });
      
      if (!preparedContent.success) {
        contextManager.addStepToHistory(
          context.contextId,
          'discover_config',
          'error',
          preparedContent.message
        );
        
        return {
          success: false,
          status: 'error',
          contextId: context.contextId,
          callCount: callResult.callCount,
          maxCalls: context.maxCalls,
          message: 'Failed to prepare content templates',
          error: preparedContent.message
        };
      }

      // Store prepared content in context
      contextManager.updateContext(context.contextId, {
        preparedContent,
        discoveredConfig: preparedContent.discoveredConfig
      });

      contextManager.addStepToHistory(
        context.contextId,
        'discover_config',
        'success',
        'Configuration discovered successfully'
      );

      // Preload common media placeholders
      await this.mediaManager.preloadCommonPlaceholders();

      return {
        success: true,
        status: 'needs_user_content',
        contextId: context.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        contentTemplates: preparedContent.contentTemplates,
        discoveredConfig: preparedContent.discoveredConfig,
        parsedStructure: preparedContent.parsedStructure,
        metadata: preparedContent.metadata,
        message: `Configuration prepared successfully. ${preparedContent.message}. Next: Provide user content for generate_content step.`
      };

    } catch (error) {
      contextManager.addStepToHistory(
        context.contextId,
        'discover_config',
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        status: 'error',
        contextId: context.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        message: 'Configuration discovery failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Step 2: Analyze user content and create what we can, or request dependencies
   */
  private async handleGenerateContent(input: BootstrapInput): Promise<BootstrapResponse> {
    if (!input.contextId) {
      return {
        success: false,
        status: 'error',
        message: 'Context ID is required for generate_content step',
        error: 'Missing contextId parameter'
      };
    }

    logger.info('RefactoredBootstrap', 'Handling generate content step', { 
      contextId: input.contextId 
    });

    const context = contextManager.getContext(input.contextId);
    if (!context) {
      return {
        success: false,
        status: 'error',
        message: 'Context not found or expired',
        error: 'Invalid or expired contextId'
      };
    }

    const callResult = contextManager.incrementCallCount(input.contextId);
    if (callResult.limitReached) {
      return {
        success: false,
        status: 'call_limit_reached',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        message: 'Maximum number of calls reached'
      };
    }

    if (!input.userContent) {
      return {
        success: false,
        status: 'error',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        message: 'User content is required for generate_content step',
        error: 'Missing userContent parameter'
      };
    }

    try {
      // Store user content in context
      contextManager.updateContext(input.contextId, {
        userContent: input.userContent
      });

      if (!context.preparedContent) {
        throw new Error('Prepared content not found in context');
      }

      // Analyze dependencies
      const dependencyAnalysis = await this.dependencyResolver.analyzeDependencies(
        input.userContent,
        context.preparedContent.parsedStructure
      );

      if (Object.keys(dependencyAnalysis.requiredDependencies).length > 0) {
        // Store pending dependencies in context
        for (const [collection, deps] of Object.entries(dependencyAnalysis.requiredDependencies)) {
          for (const dep of deps) {
            contextManager.addPendingDependency(input.contextId, collection, dep);
          }
        }

        contextManager.addStepToHistory(
          input.contextId,
          'generate_content',
          'needs_dependencies',
          `Found ${Object.keys(dependencyAnalysis.requiredDependencies).length} collections with missing dependencies`
        );

        return {
          success: false,
          status: 'needs_dependencies',
          contextId: input.contextId,
          callCount: callResult.callCount,
          maxCalls: context.maxCalls,
          missingDependencies: dependencyAnalysis.requiredDependencies,
          message: `Missing dependencies detected. Please provide content for: ${Object.keys(dependencyAnalysis.requiredDependencies).join(', ')}`
        };
      }

      // No dependencies needed, proceed with content creation
      const createdContent = await this.createUserContent(context, input.userContent);

      contextManager.addStepToHistory(
        input.contextId,
        'generate_content',
        'success',
        'Content created successfully'
      );

      return {
        success: true,
        status: 'complete',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        createdContent,
        message: 'Content generation completed successfully'
      };

    } catch (error) {
      contextManager.addStepToHistory(
        input.contextId,
        'generate_content',
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        status: 'error',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        message: 'Content generation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Step 3: Resolve dependencies and continue with content creation
   */
  private async handleResolveDependencies(input: BootstrapInput): Promise<BootstrapResponse> {
    if (!input.contextId) {
      return {
        success: false,
        status: 'error',
        message: 'Context ID is required for resolve_dependencies step',
        error: 'Missing contextId parameter'
      };
    }

    logger.info('RefactoredBootstrap', 'Handling resolve dependencies step', { 
      contextId: input.contextId 
    });

    const context = contextManager.getContext(input.contextId);
    if (!context) {
      return {
        success: false,
        status: 'error',
        message: 'Context not found or expired',
        error: 'Invalid or expired contextId'
      };
    }

    const callResult = contextManager.incrementCallCount(input.contextId);
    if (callResult.limitReached) {
      return {
        success: false,
        status: 'call_limit_reached',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        message: 'Maximum number of calls reached'
      };
    }

    if (!input.dependencyContent) {
      return {
        success: false,
        status: 'error',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        message: 'Dependency content is required for resolve_dependencies step',
        error: 'Missing dependencyContent parameter'
      };
    }

    try {
      // Create dependency content first
      const dependencyResults = await this.createDependencyContent(context, input.dependencyContent);

      // Now try to create the original user content
      const mainContentResults = await this.createUserContent(context, context.userContent);

      contextManager.addStepToHistory(
        input.contextId,
        'resolve_dependencies',
        'success',
        'Dependencies resolved and content created'
      );

      return {
        success: true,
        status: 'complete',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        createdContent: {
          dependencies: dependencyResults,
          main: mainContentResults
        },
        message: 'Dependencies resolved and content creation completed successfully'
      };

    } catch (error) {
      contextManager.addStepToHistory(
        input.contextId,
        'resolve_dependencies',
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        status: 'error',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        message: 'Dependency resolution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        partialResults: context.createdContent
      };
    }
  }

  /**
   * Create dependency content (categories, testimonials, etc.)
   */
  private async createDependencyContent(context: BootstrapContext, dependencyContent: any): Promise<any> {
    const results: any = {};

    for (const [collection, items] of Object.entries(dependencyContent.collections || {})) {
      if (!Array.isArray(items)) continue;

      logger.info('RefactoredBootstrap', 'Creating dependency content', { 
        collection, 
        count: items.length 
      });

      results[collection] = [];

      for (const item of items) {
        try {
          // Handle media uploads specially
          if (collection === 'media') {
            const mediaInfo = await this.mediaManager.getOrCreatePlaceholderImage(
              item.filename || 'placeholder.png'
            );
            
            results[collection].push(mediaInfo);
            contextManager.trackCreatedContent(
              context.contextId,
              collection,
              mediaInfo.filename,
              mediaInfo.id
            );
            continue;
          }

          // Create regular content
          const processedItem = await this.processContentItem(item, collection, context);
          const createdDoc = await this.payloadClient.create(collection, processedItem);
          
          results[collection].push(createdDoc);
          
          // Track created content
          const identifier = createdDoc['title'] || createdDoc['name'] || createdDoc['slug'] || createdDoc.id;
          contextManager.trackCreatedContent(
            context.contextId,
            collection,
            identifier,
            createdDoc.id
          );

        } catch (error) {
          logger.warn('RefactoredBootstrap', 'Failed to create dependency item', { 
            collection, 
            item: item.title || item.name || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          // Continue on error for dependency content creation
        }
      }
    }

    return results;
  }

  /**
   * Create main user content with relationship resolution
   */
  private async createUserContent(context: BootstrapContext, userContent: any): Promise<any> {
    const results: any = {};

    for (const [collection, items] of Object.entries(userContent.collections || {})) {
      if (!Array.isArray(items)) continue;

      logger.info('RefactoredBootstrap', 'Creating user content', { 
        collection, 
        count: items.length 
      });

      results[collection] = [];

      for (const item of items) {
        try {
          const processedItem = await this.processContentItem(item, collection, context);
          const createdDoc = await this.payloadClient.create(collection, processedItem);
          
          results[collection].push(createdDoc);
          
          // Track created content
          const identifier = createdDoc['title'] || createdDoc['name'] || createdDoc['slug'] || createdDoc.id;
          contextManager.trackCreatedContent(
            context.contextId,
            collection,
            identifier,
            createdDoc.id
          );

        } catch (error) {
          logger.warn('RefactoredBootstrap', 'Failed to create user content item', { 
            collection, 
            item: item.title || item.name || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          throw error; // Don't continue on error for main content
        }
      }
    }

    return results;
  }

  /**
   * Process content item, resolving relationships and media references
   */
  private async processContentItem(item: any, collection: string, context: BootstrapContext): Promise<any> {
    const processed = { ...item };

    // Get collection structure to understand field types
    const collectionStructure = context.preparedContent?.parsedStructure?.collections?.[collection];
    if (!collectionStructure) {
      return processed; // Return as-is if no structure info
    }

    await this.processFields(processed, collectionStructure.fields, context);
    
    return processed;
  }

  /**
   * Recursively process fields, resolving relationships and media
   */
  private async processFields(data: any, fields: any[], context: BootstrapContext): Promise<void> {
    for (const field of fields) {
      const fieldValue = data[field.name];
      if (!fieldValue) continue;

      if (field.type === 'relationship' || field.type === 'upload') {
        data[field.name] = await this.resolveRelationshipField(fieldValue, field, context);
      } else if (field.type === 'richText') {
        data[field.name] = this.processRichTextField(fieldValue);
      } else if (field.type === 'array' && field.fields && Array.isArray(fieldValue)) {
        for (const arrayItem of fieldValue) {
          await this.processFields(arrayItem, field.fields, context);
        }
      } else if (field.type === 'group' && field.fields && typeof fieldValue === 'object') {
        await this.processFields(fieldValue, field.fields, context);
      }
    }
  }

  /**
   * Resolve relationship field references
   */
  private async resolveRelationshipField(fieldValue: any, field: any, context: BootstrapContext): Promise<any> {
    const relationTo = Array.isArray(field.relationTo) ? field.relationTo[0] : field.relationTo;
    
    if (field.hasMany && Array.isArray(fieldValue)) {
      const resolved = [];
      for (const value of fieldValue) {
        const resolvedValue = await this.resolveSingleReference(value, relationTo, context);
        if (resolvedValue) {
          resolved.push(resolvedValue);
        }
      }
      return resolved;
    } else {
      return await this.resolveSingleReference(fieldValue, relationTo, context);
    }
  }

  /**
   * Resolve a single reference value
   */
  private async resolveSingleReference(value: any, relationTo: string, context: BootstrapContext): Promise<string | null> {
    // If it's already an ID, return it
    if (typeof value === 'string' && value.length === 24) {
      return value;
    }

    // If it's an object with ID, return the ID
    if (typeof value === 'object' && value.id) {
      return value.id;
    }

    // Handle media references
    if (relationTo === 'media') {
      const filename = typeof value === 'string' ? value : value.filename;
      if (filename) {
        const media = await this.mediaManager.getOrCreatePlaceholderImage(filename);
        return media.id;
      }
    }

    // Look up by title/name in created content
    const identifier = typeof value === 'string' ? value : (value.title || value.name);
    if (identifier) {
      const existingId = contextManager.getCreatedContentId(context.contextId, relationTo, identifier);
      if (existingId) {
        return existingId;
      }
    }

    logger.warn('RefactoredBootstrap', 'Could not resolve reference', { 
      value, 
      relationTo 
    });
    return null;
  }

  /**
   * Process rich text field to ensure proper Lexical format
   */
  private processRichTextField(fieldValue: any): any {
    // If it's already a Lexical object, return as-is
    if (fieldValue && typeof fieldValue === 'object' && fieldValue.root) {
      return fieldValue;
    }

    // If it's a string, convert to Lexical format
    if (typeof fieldValue === 'string') {
      return {
        root: {
          children: [{
            children: [{
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: fieldValue,
              type: 'text',
              version: 1
            }],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
            textFormat: 0,
            textStyle: ''
          }],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
          version: 1
        }
      };
    }

    return fieldValue;
  }
}

export const refactoredBootstrap = new RefactoredBootstrap();