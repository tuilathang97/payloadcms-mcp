import { contextManager, BootstrapContext } from '../lib/context-manager.js';
import { contextGatherer } from '../lib/context-gatherer.js';
import { PayloadCMSClient } from '../lib/payload-client.js';
import { DependencyResolver } from '../lib/dependency-resolver.js';
import { prepareContent } from './prepare-tools.js';
import { populateContent } from './populate-tools.js';
import { logger } from '../utils/logger.js';

// Enhanced bootstrap with PostgreSQL-powered context management
interface BootstrapEnhancedInput {
  step: 'discover_config' | 'generate_content' | 'resolve_dependencies'
  projectPath: string
  contextId?: string
  userContent?: Record<string, any>
  dependencyContent?: Record<string, any>
  collections?: string[]
  resolveRelationships?: boolean
  continueOnError?: boolean
}

interface StepResult {
  success: boolean
  status: 'needs_user_content' | 'needs_dependencies' | 'complete' | 'error'
  contextId?: string | undefined
  callCount?: number
  maxCalls?: number
  contentTemplates?: any
  discoveredConfig?: any
  missingDependencies?: any
  createdContent?: any
  message: string
  error?: string
}

export async function bootstrapEnhancedSimple(input: BootstrapEnhancedInput): Promise<StepResult> {
  try {
    // Basic validation
    if (!input.projectPath) {
      throw new Error('Project path is required')
    }
    
    // Set defaults
    const validated = {
      resolveRelationships: true,
      continueOnError: false,
      ...input
    }

    logger.info('BootstrapEnhanced', 'Starting step', { 
      step: validated.step, 
      projectPath: validated.projectPath,
      contextId: validated.contextId 
    });

    switch (validated.step) {
      case 'discover_config':
        return await handleDiscoverConfig(validated);
        
      case 'generate_content':
        return await handleGenerateContent(validated);
        
      case 'resolve_dependencies':
        return await handleResolveDependencies(validated);
        
      default:
        throw new Error(`Unknown step: ${validated.step}`)
    }
  } catch (error: any) {
    logger.error('BootstrapEnhanced', 'Error in bootstrap enhanced', error);
    return {
      success: false,
      status: 'error',
      message: 'Bootstrap enhanced error: ' + error.message,
      error: error.message
    }
  }
}

/**
 * Step 1: Discover project configuration and create context
 */
async function handleDiscoverConfig(input: BootstrapEnhancedInput): Promise<StepResult> {
  logger.info('BootstrapEnhanced', 'Discovering project configuration', { 
    projectPath: input.projectPath 
  });

  try {
    // Use prepare-content tool to discover configuration
    const preparedResult = await prepareContent({ projectPath: input.projectPath });
    
    if (!preparedResult.success) {
      throw new Error(`Failed to prepare content: ${preparedResult.message}`);
    }

    // Create new context
    const context = contextManager.createContext(input.projectPath);
    
    // Increment call count
    const callResult = contextManager.incrementCallCount(context.contextId);
    if (!callResult.success) {
      throw new Error('Failed to track call count');
    }

    // Store prepared content in context
    contextManager.updateContext(context.contextId, {
      preparedContent: preparedResult,
      discoveredConfig: preparedResult.discoveredConfig
    });

    // Add to step history
    contextManager.addStepToHistory(
      context.contextId,
      'discover_config',
      'success',
      'Configuration discovered successfully',
      { 
        collections: preparedResult.discoveredConfig.collections.length,
        blocks: preparedResult.discoveredConfig.blocks.length,
        globals: preparedResult.discoveredConfig.globals.length
      }
    );

    logger.info('BootstrapEnhanced', 'Configuration discovery completed', {
      contextId: context.contextId,
      collections: preparedResult.discoveredConfig.collections.length,
      blocks: preparedResult.discoveredConfig.blocks.length
    });

    return {
      success: true,
      status: 'needs_user_content',
      contextId: context.contextId,
      callCount: callResult.callCount,
      maxCalls: context.maxCalls,
      contentTemplates: preparedResult.contentTemplates,
      discoveredConfig: preparedResult.discoveredConfig,
      message: `Configuration discovered successfully. Found ${preparedResult.discoveredConfig.collections.length} collections, ${preparedResult.discoveredConfig.blocks.length} blocks, and ${preparedResult.discoveredConfig.globals.length} globals. Please provide user content for the next step.`
    };

  } catch (error: any) {
    logger.error('BootstrapEnhanced', 'Failed to discover configuration', error);
    throw error;
  }
}

/**
 * Step 2: Generate content with user input and dependency analysis
 */
async function handleGenerateContent(input: BootstrapEnhancedInput): Promise<StepResult> {
  if (!input.contextId) {
    throw new Error('Context ID is required for generate_content step');
  }

  if (!input.userContent) {
    throw new Error('User content is required for generate_content step');
  }

  logger.info('BootstrapEnhanced', 'Generating content with user input', { 
    contextId: input.contextId 
  });

  try {
    // Get existing context
    const context = contextManager.getContext(input.contextId);
    if (!context || !context.preparedContent) {
      throw new Error('Context not found or missing prepared content. Please run discover_config first.');
    }

    // Check call limit
    const callResult = contextManager.incrementCallCount(input.contextId);
    if (!callResult.success || callResult.limitReached) {
      throw new Error(`Call limit reached (${context.maxCalls} calls maximum)`);
    }

    // Store user content in context
    contextManager.updateContext(input.contextId, {
      userContent: input.userContent
    });

    // Initialize PayloadCMS client and dependency resolver
    // We need to get PayloadCMS config from environment or context
    const payloadConfig = {
      host: process.env['PAYLOAD_HOST'] || process.env['PAYLOAD_URL'] || 'http://localhost:3000',
      email: process.env['PAYLOAD_USERNAME'] || process.env['PAYLOAD_EMAIL'],
      password: process.env['PAYLOAD_PASSWORD'],
      apiKey: process.env['PAYLOAD_API_KEY']
    };
    
    const payloadClient = new PayloadCMSClient(payloadConfig);
    const dependencyResolver = new DependencyResolver(payloadClient);

    // Analyze dependencies
    const dependencyAnalysis = await dependencyResolver.analyzeDependencies(
      input.userContent,
      context.preparedContent.parsedStructure
    );

    logger.debug('BootstrapEnhanced', 'Dependency analysis completed', {
      contextId: input.contextId,
      requiredDependencies: Object.keys(dependencyAnalysis.requiredDependencies),
      creationOrder: dependencyAnalysis.creationOrder,
      circularDependencies: dependencyAnalysis.circularDependencies
    });

    // Check if dependencies are missing
    const hasMissingDependencies = Object.keys(dependencyAnalysis.requiredDependencies).length > 0;

    if (hasMissingDependencies) {
      // Store pending dependencies
      for (const [collection, dependencies] of Object.entries(dependencyAnalysis.requiredDependencies)) {
        for (const dep of dependencies) {
          contextManager.addPendingDependency(input.contextId, collection, dep);
        }
      }

      // Add to step history
      contextManager.addStepToHistory(
        input.contextId,
        'generate_content',
        'needs_dependencies',
        'Missing dependencies detected',
        { missingDependencies: dependencyAnalysis.requiredDependencies }
      );

      return {
        success: false,
        status: 'needs_dependencies',
        contextId: input.contextId,
        callCount: callResult.callCount,
        maxCalls: context.maxCalls,
        missingDependencies: dependencyAnalysis.requiredDependencies,
        message: `Missing dependencies detected for collections: ${Object.keys(dependencyAnalysis.requiredDependencies).join(', ')}. Please provide dependency content using the resolve_dependencies step.`
      };
    }

    // No missing dependencies - proceed with content creation
    // Convert user content format to populate-content format
    const collectionsToCreate: Record<string, { count: number; customData?: any[] }> = {};
    
    if (input.userContent['collections']) {
      for (const [collectionName, contentArray] of Object.entries(input.userContent['collections'])) {
        if (Array.isArray(contentArray) && contentArray.length > 0) {
          collectionsToCreate[collectionName] = {
            count: contentArray.length,
            customData: contentArray
          };
        }
      }
    }

    logger.debug('BootstrapEnhanced', 'Converted user content for populate-content', {
      contextId: input.contextId,
      originalCollections: Object.keys(input.userContent['collections'] || {}),
      convertedCollections: Object.keys(collectionsToCreate),
      totalItems: Object.values(collectionsToCreate).reduce((sum, col) => sum + col.count, 0)
    });

    const populateResult = await populateContent({
      preparedContent: context.preparedContent,
      contentToCreate: {
        collections: collectionsToCreate,
        generateRelationships: input.resolveRelationships !== false,
        createMediaAssets: true
      },
      options: {
        continueOnError: input.continueOnError || false,
        validateBeforeCreate: true,
        dryRun: false
      }
    });

    if (!populateResult.success) {
      throw new Error(`Failed to create content: ${populateResult.message}`);
    }

    // Track created content from results
    if (populateResult.results.collections) {
      for (const [collection, result] of Object.entries(populateResult.results.collections)) {
        if (result.documents && Array.isArray(result.documents)) {
          for (const item of result.documents) {
            if (item.status === 'created' && item.id && item.title) {
              contextManager.trackCreatedContent(
                input.contextId,
                collection,
                item.title,
                item.id
              );
            }
          }
        }
      }
    }

    // Add to step history
    contextManager.addStepToHistory(
      input.contextId,
      'generate_content',
      'success',
      'Content created successfully',
      { createdContent: populateResult.results.collections }
    );

    logger.info('BootstrapEnhanced', 'Content generation completed', {
      contextId: input.contextId,
      createdCollections: Object.keys(populateResult.results.collections || {})
    });

    return {
      success: true,
      status: 'complete',
      contextId: input.contextId,
      callCount: callResult.callCount,
      createdContent: populateResult.results.collections,
      message: `Content creation completed successfully. Created content for: ${Object.keys(populateResult.results.collections || {}).join(', ')}`
    };

  } catch (error: any) {
    logger.error('BootstrapEnhanced', 'Failed to generate content', error);
    throw error;
  }
}

/**
 * Step 3: Resolve dependencies and create content
 */
async function handleResolveDependencies(input: BootstrapEnhancedInput): Promise<StepResult> {
  if (!input.contextId) {
    throw new Error('Context ID is required for resolve_dependencies step');
  }

  if (!input.dependencyContent) {
    throw new Error('Dependency content is required for resolve_dependencies step');
  }

  logger.info('BootstrapEnhanced', 'Resolving dependencies', { 
    contextId: input.contextId 
  });

  try {
    // Get existing context
    const context = contextManager.getContext(input.contextId);
    if (!context || !context.preparedContent || !context.userContent) {
      throw new Error('Context not found or missing required data. Please run previous steps first.');
    }

    // Check call limit
    const callResult = contextManager.incrementCallCount(input.contextId);
    if (!callResult.success || callResult.limitReached) {
      throw new Error(`Call limit reached (${context.maxCalls} calls maximum)`);
    }

    // First, create dependency content
    // Convert dependency content format to populate-content format
    const dependencyCollectionsToCreate: Record<string, { count: number; customData?: any[] }> = {};
    
    if (input.dependencyContent['collections']) {
      for (const [collectionName, contentArray] of Object.entries(input.dependencyContent['collections'])) {
        if (Array.isArray(contentArray) && contentArray.length > 0) {
          dependencyCollectionsToCreate[collectionName] = {
            count: contentArray.length,
            customData: contentArray
          };
        }
      }
    }

    const dependencyPopulateResult = await populateContent({
      preparedContent: context.preparedContent,
      contentToCreate: {
        collections: dependencyCollectionsToCreate,
        generateRelationships: false, // Don't generate relationships for dependencies
        createMediaAssets: true
      },
      options: {
        continueOnError: input.continueOnError || false,
        validateBeforeCreate: true,
        dryRun: false
      }
    });

    if (!dependencyPopulateResult.success) {
      throw new Error(`Failed to create dependencies: ${dependencyPopulateResult.message}`);
    }

    // Track created dependencies
    if (dependencyPopulateResult.results.collections) {
      for (const [collection, result] of Object.entries(dependencyPopulateResult.results.collections)) {
        if (result.documents && Array.isArray(result.documents)) {
          for (const item of result.documents) {
            if (item.status === 'created' && item.id && item.title) {
              contextManager.trackCreatedContent(
                input.contextId,
                collection,
                item.title,
                item.id
              );
            }
          }
        }
      }
    }

    // Now create main content with resolved dependencies
    // Convert main content format to populate-content format
    const mainCollectionsToCreate: Record<string, { count: number; customData?: any[] }> = {};
    
    if (context.userContent['collections']) {
      for (const [collectionName, contentArray] of Object.entries(context.userContent['collections'])) {
        if (Array.isArray(contentArray) && contentArray.length > 0) {
          mainCollectionsToCreate[collectionName] = {
            count: contentArray.length,
            customData: contentArray
          };
        }
      }
    }

    const mainPopulateResult = await populateContent({
      preparedContent: context.preparedContent,
      contentToCreate: {
        collections: mainCollectionsToCreate,
        generateRelationships: input.resolveRelationships !== false,
        createMediaAssets: false // Already created in dependencies
      },
      options: {
        continueOnError: input.continueOnError || false,
        validateBeforeCreate: true,
        dryRun: false
      }
    });

    if (!mainPopulateResult.success) {
      throw new Error(`Failed to create main content: ${mainPopulateResult.message}`);
    }

    // Track created main content
    if (mainPopulateResult.results.collections) {
      for (const [collection, result] of Object.entries(mainPopulateResult.results.collections)) {
        if (result.documents && Array.isArray(result.documents)) {
          for (const item of result.documents) {
            if (item.status === 'created' && item.id && item.title) {
              contextManager.trackCreatedContent(
                input.contextId,
                collection,
                item.title,
                item.id
              );
            }
          }
        }
      }
    }

    // Clear pending dependencies
    const pendingDeps = contextManager.getPendingDependencies(input.contextId) as Record<string, any>;
    for (const collection of Object.keys(pendingDeps || {})) {
      contextManager.clearPendingDependencies(input.contextId, collection);
    }

    // Combine created content
    const allCreatedContent = {
      dependencies: dependencyPopulateResult.results.collections || {},
      main: mainPopulateResult.results.collections || {}
    };

    // Add to step history
    contextManager.addStepToHistory(
      input.contextId,
      'resolve_dependencies',
      'success',
      'Dependencies resolved and content created',
      { createdContent: allCreatedContent }
    );

    logger.info('BootstrapEnhanced', 'Dependency resolution completed', {
      contextId: input.contextId,
      dependencyCollections: Object.keys(dependencyPopulateResult.results.collections || {}),
      mainCollections: Object.keys(mainPopulateResult.results.collections || {})
    });

    return {
      success: true,
      status: 'complete',
      contextId: input.contextId,
      callCount: callResult.callCount,
      createdContent: allCreatedContent,
      message: `Dependencies resolved and content created successfully. Dependencies: ${Object.keys(dependencyPopulateResult.results.collections || {}).join(', ')}. Main content: ${Object.keys(mainPopulateResult.results.collections || {}).join(', ')}`
    };

  } catch (error: any) {
    logger.error('BootstrapEnhanced', 'Failed to resolve dependencies', error);
    throw error;
  }
}

export const bootstrapEnhancedSimpleTool = {
  name: 'bootstrap-enhanced',
  description: 'Advanced multi-step PayloadCMS content generation with PostgreSQL-powered context management, intelligent dependency resolution, and 8-call limit tracking. Supports iterative content creation with smart relationship handling.',
  inputSchema: {
    type: 'object',
    properties: {
      step: {
        type: 'string',
        enum: ['discover_config', 'generate_content', 'resolve_dependencies'],
        description: 'Bootstrap step: discover_config (prepare templates), generate_content (create with user content), resolve_dependencies (handle missing references)',
        default: 'discover_config'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the PayloadCMS project directory'
      },
      contextId: {
        type: 'string',
        description: 'Context ID from previous step (required for generate_content and resolve_dependencies steps)'
      },
      userContent: {
        type: 'object',
        description: 'User-provided content structure for generate_content step',
        additionalProperties: true
      },
      dependencyContent: {
        type: 'object',
        description: 'Content to resolve missing dependencies for resolve_dependencies step',
        additionalProperties: true
      },
      collections: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific collections to include (optional)'
      },
      resolveRelationships: {
        type: 'boolean',
        description: 'Automatically resolve content relationships',
        default: true
      },
      continueOnError: {
        type: 'boolean',
        description: 'Continue processing if some operations fail',
        default: false
      }
    },
    required: ['projectPath'],
    additionalProperties: false
  }
}