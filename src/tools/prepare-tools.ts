/**
 * Prepare Tools for PayloadCMS MCP Server
 * 
 * Two-phase approach inspired by old-tools.ts:
 * 1. prepare-content: Read all configs, return structured output for client review
 * 2. populate-content: Take prepared content and create actual documents
 * 
 * Key principles:
 * - Use EXACT slugs from config files (featureSections not FeatureSections)
 * - Client gets to review and modify before creation
 * - Accurate field structure parsing from actual config files
 * - Better error handling and recovery
 */

import { contextGatherer, ContextGatheringRequest } from '../lib/context-gatherer.js';
import { logger } from '../utils/logger.js';
import { PayloadCollection, PayloadBlock, PayloadField } from '../lib/config-parser.js';

export interface PreparedContent {
  success: boolean;
  discoveredConfig: {
    collections: string[];
    blocks: string[];
    globals: string[];
  };
  parsedStructure: {
    collections: Record<string, CollectionStructure>;
    blocks: Record<string, BlockStructure>;
    globals: Record<string, GlobalStructure>;
  };
  sampleContent: {
    collections: Record<string, any>;
    blocks: Record<string, any>;
    globals: Record<string, any>;
  };
  metadata: {
    projectPath: string;
    configPath: string;
    totalCollections: number;
    totalBlocks: number;
    totalGlobals: number;
    preparationTime: string;
  };
  message: string;
}

export interface CollectionStructure {
  slug: string;
  labels: {
    singular: string;
    plural: string;
  };
  fields: FieldStructure[];
}

export interface BlockStructure {
  slug: string;
  labels: {
    singular: string;
    plural: string;
  };
  fields: FieldStructure[];
}

export interface GlobalStructure {
  slug: string;
  labels: {
    singular: string;
    plural: string;
  };
  fields: FieldStructure[];
}

export interface FieldStructure {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  admin?: any;
  relationTo?: string | string[];
  hasMany?: boolean;
  blocks?: string[]; // Block slugs for blocks field type
  options?: Array<{label: string; value: string}> | string[]; // For select fields
  fields?: FieldStructure[]; // For group, array, tabs fields
  tabs?: Array<{label: string; fields: FieldStructure[]}>;
}

/**
 * Phase 1: Prepare Content Tool
 * Reads all PayloadCMS configurations and returns structured data for client review
 */
export async function prepareContent(input: any): Promise<PreparedContent> {
  const startTime = Date.now();
  
  try {
    const { projectPath } = input;
    
    if (!projectPath) {
      return {
        success: false,
        discoveredConfig: { collections: [], blocks: [], globals: [] },
        parsedStructure: { collections: {}, blocks: {}, globals: {} },
        sampleContent: { collections: {}, blocks: {}, globals: {} },
        metadata: {
          projectPath: '',
          configPath: '',
          totalCollections: 0,
          totalBlocks: 0,
          totalGlobals: 0,
          preparationTime: '0ms'
        },
        message: 'Project path is required'
      };
    }

    logger.info('PrepareContent', 'Starting configuration preparation', { projectPath });

    // Use context gatherer to discover and parse configs
    const contextRequest: ContextGatheringRequest = {
      projectPath,
      step: 'discover_config'
    };

    const contextResponse = await contextGatherer.gatherContext(contextRequest);

    if (contextResponse.status !== 'complete') {
      return {
        success: false,
        discoveredConfig: { collections: [], blocks: [], globals: [] },
        parsedStructure: { collections: {}, blocks: {}, globals: {} },
        sampleContent: { collections: {}, blocks: {}, globals: {} },
        metadata: {
          projectPath,
          configPath: '',
          totalCollections: 0,
          totalBlocks: 0,
          totalGlobals: 0,
          preparationTime: `${Date.now() - startTime}ms`
        },
        message: contextResponse.message || 'Failed to parse configuration'
      };
    }

    const { parsedConfig, discoveredConfig } = contextResponse;
    
    if (!parsedConfig || !discoveredConfig) {
      throw new Error('Missing parsed configuration data');
    }

    // Build structured output with EXACT slugs from config
    const parsedStructure = {
      collections: buildCollectionStructures(parsedConfig.collections),
      blocks: buildBlockStructures(parsedConfig.blocks),
      globals: buildGlobalStructures(parsedConfig.globals || [])
    };

    // Generate sample content that respects actual field structures
    const sampleContent = generateStructuredSampleContent(parsedStructure);

    const executionTime = `${Date.now() - startTime}ms`;

    logger.info('PrepareContent', 'Configuration preparation complete', {
      totalCollections: parsedConfig.collections.length,
      totalBlocks: parsedConfig.blocks.length,
      totalGlobals: parsedConfig.globals?.length || 0,
      executionTime
    });

    return {
      success: true,
      discoveredConfig: {
        collections: parsedConfig.collections.map(c => c.slug),
        blocks: parsedConfig.blocks.map(b => b.slug),
        globals: parsedConfig.globals?.map((g: any) => g.slug) || []
      },
      parsedStructure,
      sampleContent,
      metadata: {
        projectPath,
        configPath: discoveredConfig.structure.configPath || '',
        totalCollections: parsedConfig.collections.length,
        totalBlocks: parsedConfig.blocks.length,
        totalGlobals: parsedConfig.globals?.length || 0,
        preparationTime: executionTime
      },
      message: `Successfully prepared configuration with ${parsedConfig.collections.length} collections, ${parsedConfig.blocks.length} blocks, and ${parsedConfig.globals?.length || 0} globals`
    };

  } catch (error) {
    logger.error('PrepareContent', 'Failed to prepare content', error instanceof Error ? error : undefined);
    
    return {
      success: false,
      discoveredConfig: { collections: [], blocks: [], globals: [] },
      parsedStructure: { collections: {}, blocks: {}, globals: {} },
      sampleContent: { collections: {}, blocks: {}, globals: {} },
      metadata: {
        projectPath: input.projectPath || '',
        configPath: '',
        totalCollections: 0,
        totalBlocks: 0,
        totalGlobals: 0,
        preparationTime: `${Date.now() - startTime}ms`
      },
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Build collection structures with exact slugs and field mappings
 */
function buildCollectionStructures(collections: PayloadCollection[]): Record<string, CollectionStructure> {
  const structures: Record<string, CollectionStructure> = {};

  for (const collection of collections) {
    structures[collection.slug] = {
      slug: collection.slug, // Use EXACT slug from config
      labels: {
        singular: collection.labels?.singular || collection.slug,
        plural: collection.labels?.plural || collection.slug + 's'
      },
      fields: buildFieldStructures(collection.fields)
    };
  }

  return structures;
}

/**
 * Build block structures with exact slugs and field mappings
 */
function buildBlockStructures(blocks: PayloadBlock[]): Record<string, BlockStructure> {
  const structures: Record<string, BlockStructure> = {};

  for (const block of blocks) {
    structures[block.slug] = {
      slug: block.slug, // Use EXACT slug from config
      labels: {
        singular: block.labels?.singular || block.slug,
        plural: block.labels?.plural || block.slug + 's'
      },
      fields: buildFieldStructures(block.fields)
    };
  }

  return structures;
}

/**
 * Build global structures with exact slugs and field mappings
 */
function buildGlobalStructures(globals: any[]): Record<string, GlobalStructure> {
  const structures: Record<string, GlobalStructure> = {};

  for (const global of globals) {
    structures[global.slug] = {
      slug: global.slug, // Use EXACT slug from config
      labels: global.labels || {
        singular: global.slug,
        plural: global.slug + 's'
      },
      fields: buildFieldStructures(global.fields || [])
    };
  }

  return structures;
}

/**
 * Build field structures from PayloadCMS field definitions
 */
function buildFieldStructures(fields: PayloadField[]): FieldStructure[] {
  const structures: FieldStructure[] = [];

  for (const field of fields) {
    const structure: FieldStructure = {
      name: field.name,
      type: field.type,
      label: field['label'],
      ...(field.required !== undefined && { required: field.required }),
      admin: field.admin
    };

    // Add type-specific properties
    if (field.relationTo) {
      structure.relationTo = field.relationTo;
      if (field.hasMany !== undefined) {
        structure.hasMany = field.hasMany;
      }
    }

    if (field.blocks) {
      structure.blocks = Array.isArray(field.blocks) ? field.blocks : [field.blocks];
    }

    if (field.options) {
      structure.options = field.options;
    }

    if (field.fields) {
      structure.fields = buildFieldStructures(field.fields);
    }

    if (field.tabs) {
      structure.tabs = field.tabs.map(tab => ({
        label: tab.label,
        fields: buildFieldStructures(tab.fields)
      }));
    }

    structures.push(structure);
  }

  return structures;
}

/**
 * Generate sample content that respects actual field structures
 */
function generateStructuredSampleContent(parsedStructure: any): any {
  const sampleContent = {
    collections: {} as any,
    blocks: {} as any,
    globals: {} as any
  };

  // Generate sample content for collections
  for (const [slug, structure] of Object.entries(parsedStructure.collections)) {
    sampleContent.collections[slug] = generateSampleForStructure(structure as CollectionStructure);
  }

  // Generate sample content for blocks
  for (const [slug, structure] of Object.entries(parsedStructure.blocks)) {
    sampleContent.blocks[slug] = generateSampleForStructure(structure as BlockStructure);
  }

  // Generate sample content for globals
  for (const [slug, structure] of Object.entries(parsedStructure.globals)) {
    sampleContent.globals[slug] = generateSampleForStructure(structure as GlobalStructure);
  }

  return sampleContent;
}

/**
 * Generate sample data for a specific structure (collection, block, or global)
 */
function generateSampleForStructure(structure: CollectionStructure | BlockStructure | GlobalStructure): any {
  const sample = {
    slug: structure.slug,
    labels: structure.labels,
    sampleData: generateSampleFieldData(structure.fields)
  };

  return sample;
}

/**
 * Generate sample data for an array of field structures
 */
function generateSampleFieldData(fields: FieldStructure[]): any {
  const sampleData: any = {};

  for (const field of fields) {
    sampleData[field.name] = generateSampleFieldValue(field);
  }

  return sampleData;
}

/**
 * Generate sample value for a specific field based on its structure
 */
function generateSampleFieldValue(field: FieldStructure): any {
  const variants = ['sample', 'example', 'demo', 'test'];
  const randomVariant = variants[Math.floor(Math.random() * variants.length)];

  switch (field.type) {
    case 'text':
      if (field.name === 'title' || field.name === 'name') {
        return `${randomVariant} ${field.name}`;
      }
      if (field.name === 'slug') {
        return `${randomVariant}-${field.name}`;
      }
      return `${randomVariant} ${field.name} content`;

    case 'textarea':
      return `This is ${randomVariant} ${field.name} content. It can contain multiple lines of text.`;

    case 'richText':
      return {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: `This is ${randomVariant} rich text content for ${field.name}.`
                }
              ]
            }
          ]
        }
      };

    case 'number':
      if (field.name === 'price') {
        return Math.floor(Math.random() * 500) + 10;
      }
      if (field.name === 'rating') {
        return Math.floor(Math.random() * 5) + 1;
      }
      return Math.floor(Math.random() * 100);

    case 'email':
      return `${randomVariant}@example.com`;

    case 'select':
      if (field.options && field.options.length > 0) {
        const option = field.options[0];
        if (typeof option === 'object' && 'value' in option) {
          return option.value;
        }
        return option;
      }
      return 'draft';

    case 'checkbox':
      return Math.random() > 0.5;

    case 'date':
      return new Date().toISOString();

    case 'upload':
      return {
        filename: `${randomVariant}-image.jpg`,
        alt: `${randomVariant} image`,
        url: `https://via.placeholder.com/800x600?text=${randomVariant}`
      };

    case 'relationship':
      if (field.relationTo) {
        if (Array.isArray(field.relationTo)) {
          return {
            relationTo: field.relationTo[0],
            value: `${randomVariant}-id-123`
          };
        }
        return `${randomVariant}-${field.relationTo}-id`;
      }
      return null;

    case 'array':
      if (field.fields) {
        return [generateSampleFieldData(field.fields)];
      }
      return [`${randomVariant} array item`];

    case 'group':
      if (field.fields) {
        return generateSampleFieldData(field.fields);
      }
      return {};

    case 'blocks':
      if (field.blocks && field.blocks.length > 0) {
        const randomBlock = field.blocks[Math.floor(Math.random() * field.blocks.length)];
        return [
          {
            blockType: randomBlock, // Use EXACT block slug
            id: `block-${Date.now()}-${Math.random()}`,
            [`${randomVariant}Field`]: `${randomVariant} block content`
          }
        ];
      }
      return [];

    case 'tabs':
      if (field.tabs) {
        const tabData: any = {};
        for (const tab of field.tabs) {
          const tabSampleData = generateSampleFieldData(tab.fields);
          Object.assign(tabData, tabSampleData);
        }
        return tabData;
      }
      return {};

    case 'json':
      return {
        [`${randomVariant}Key`]: `${randomVariant} value`,
        nested: {
          property: `${randomVariant} nested value`
        }
      };

    case 'code':
      return `// ${randomVariant} code\nconsole.log('${randomVariant}');`;

    case 'point':
      return [Math.random() * 180 - 90, Math.random() * 360 - 180]; // [lat, lng]

    default:
      return `${randomVariant} ${field.type} value`;
  }
}

// Export the tool definition for MCP
export const prepareContentTool = {
  name: 'prepare-content',
  description: 'Reads all PayloadCMS configurations and returns structured data for client review. This is Phase 1 of the two-phase approach - it discovers collections, blocks, and globals with their exact field structures, then generates sample content that respects the actual PayloadCMS configuration. The client can review and modify this before actual document creation.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to the PayloadCMS project directory containing payload.config.ts'
      }
    },
    required: ['projectPath'],
    additionalProperties: false
  }
};