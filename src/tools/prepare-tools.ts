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
  contentTemplates: {
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
  tabs?: Array<{label: string; name?: string; fields: FieldStructure[]}>;
}

/**
 * Extract all PayloadBlock objects from collection fields recursively
 */
function extractBlocksFromCollections(collections: PayloadCollection[]): PayloadBlock[] {
  const blocks: PayloadBlock[] = [];
  const seenSlugs = new Set<string>();

  function extractFromFields(fields: PayloadField[]) {
    for (const field of fields) {
      // Check if this field has blocks
      if (field.blocks && Array.isArray(field.blocks)) {
        for (const block of field.blocks) {
          // If it's a PayloadBlock object (not just a string)
          if (typeof block === 'object' && block.slug && !seenSlugs.has(block.slug)) {
            blocks.push(block);
            seenSlugs.add(block.slug);
          }
        }
      }

      // Recursively check nested fields
      if (field.fields) {
        extractFromFields(field.fields);
      }

      // Check tabs
      if (field.tabs) {
        for (const tab of field.tabs) {
          extractFromFields(tab.fields);
        }
      }
    }
  }

  for (const collection of collections) {
    extractFromFields(collection.fields);
  }

  return blocks;
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
        contentTemplates: { collections: {}, blocks: {}, globals: {} },
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
        contentTemplates: { collections: {}, blocks: {}, globals: {} },
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

    // Extract all blocks discovered during collection parsing
    const discoveredBlocks = extractBlocksFromCollections(parsedConfig.collections);
    
    // Add discovered blocks to the main blocks array
    const allBlocks = [...parsedConfig.blocks, ...discoveredBlocks];

    // Build structured output with EXACT slugs from config
    const parsedStructure = {
      collections: buildCollectionStructures(parsedConfig.collections),
      blocks: buildBlockStructures(allBlocks),
      globals: buildGlobalStructures(parsedConfig.globals || [])
    };

    // Generate template structures for AI to fill (not sample content)
    const contentTemplates = generateStructuredTemplates(parsedStructure);

    const executionTime = `${Date.now() - startTime}ms`;

    logger.info('PrepareContent', 'Configuration preparation complete', {
      totalCollections: parsedConfig.collections.length,
      totalBlocks: allBlocks.length,
      totalGlobals: parsedConfig.globals?.length || 0,
      executionTime
    });

    return {
      success: true,
      discoveredConfig: {
        collections: parsedConfig.collections.map(c => c.slug),
        blocks: allBlocks.map(b => b.slug),
        globals: parsedConfig.globals?.map((g: any) => g.slug) || []
      },
      parsedStructure,
      contentTemplates,
      metadata: {
        projectPath,
        configPath: discoveredConfig.structure.configPath || '',
        totalCollections: parsedConfig.collections.length,
        totalBlocks: allBlocks.length,
        totalGlobals: parsedConfig.globals?.length || 0,
        preparationTime: executionTime
      },
      message: `Successfully prepared configuration with ${parsedConfig.collections.length} collections, ${allBlocks.length} blocks, and ${parsedConfig.globals?.length || 0} globals`
    };

  } catch (error) {
    logger.error('PrepareContent', 'Failed to prepare content', error instanceof Error ? error : undefined);
    
    return {
      success: false,
      discoveredConfig: { collections: [], blocks: [], globals: [] },
      parsedStructure: { collections: {}, blocks: {}, globals: {} },
      contentTemplates: { collections: {}, blocks: {}, globals: {} },
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

    // Add _lexical marker for richText fields
    if ((field as any)._lexical) {
      (structure as any)._lexical = true;
    }

    // Add type-specific properties
    if (field.relationTo) {
      structure.relationTo = field.relationTo;
      if (field.hasMany !== undefined) {
        structure.hasMany = field.hasMany;
      }
    }

    if (field.blocks) {
      // Handle both string[] and PayloadBlock[] cases
      if (Array.isArray(field.blocks)) {
        if (field.blocks.length > 0 && typeof field.blocks[0] === 'string') {
          structure.blocks = field.blocks as string[];
        } else {
          structure.blocks = (field.blocks as any[]).map((block: any) => 
            typeof block === 'string' ? block : (block as any).slug
          );
        }
      } else {
        structure.blocks = [typeof field.blocks === 'string' ? field.blocks : (field.blocks as any).slug];
      }
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
        ...(tab.name && { name: tab.name }),
        fields: buildFieldStructures(tab.fields)
      }));
    }

    structures.push(structure);
  }

  return structures;
}

/**
 * Generate template structures for AI to fill (not sample content)
 */
function generateStructuredTemplates(parsedStructure: any): any {
  const templates = {
    collections: {} as any,
    blocks: {} as any,
    globals: {} as any
  };

  // Generate template structure for collections showing field schemas
  for (const [slug, structure] of Object.entries(parsedStructure.collections)) {
    templates.collections[slug] = generateTemplateForStructure(structure as CollectionStructure);
  }

  // Generate template structure for blocks showing field schemas  
  for (const [slug, structure] of Object.entries(parsedStructure.blocks)) {
    templates.blocks[slug] = generateTemplateForStructure(structure as BlockStructure);
  }

  // Generate template structure for globals showing field schemas
  for (const [slug, structure] of Object.entries(parsedStructure.globals)) {
    templates.globals[slug] = generateTemplateForStructure(structure as GlobalStructure);
  }

  return templates;
}

/**
 * Generate template structure for AI to fill (collection, block, or global)
 */
function generateTemplateForStructure(structure: CollectionStructure | BlockStructure | GlobalStructure): any {
  const template = {
    slug: structure.slug,
    labels: structure.labels,
    fieldSchema: generateFieldTemplateSchema(structure.fields),
    example: generateSingleExampleDocument(structure)
  };

  return template;
}

/**
 * Generate field template schema for AI to understand structure
 */
function generateFieldTemplateSchema(fields: FieldStructure[]): any {
  const schema: any = {};

  for (const field of fields) {
    // Special handling for tabs fields - flatten them into the parent schema
    if (field.type === 'tabs' && field.tabs) {
      // For tabs fields, flatten all tab fields into the parent schema
      for (const tab of field.tabs) {
        if (tab.name) {
          // Named tab - create nested object
          schema[tab.name] = {
            type: 'group',
            required: false,
            description: `${tab.label} tab fields`,
            nestedFields: generateFieldTemplateSchema(tab.fields)
          };
        } else {
          // Unnamed tab - flatten fields
          const tabSchema = generateFieldTemplateSchema(tab.fields);
          Object.assign(schema, tabSchema);
        }
      }
    } else if (field.name) {
      // Only add fields that have a name
      schema[field.name] = {
        type: field.type,
        required: field.required || false,
        description: generateFieldDescription(field),
        ...(field.options && { options: field.options }),
        ...(field.relationTo && { relationTo: field.relationTo }),
        ...(field.blocks && { availableBlocks: field.blocks }),
        ...(field.fields && { nestedFields: generateFieldTemplateSchema(field.fields) }),
        ...(field.tabs && { tabs: field.tabs.map(tab => ({
          label: tab.label,
          ...(tab.name && { name: tab.name }),
          fields: generateFieldTemplateSchema(tab.fields)
        })) }),
        ...((field as any)._lexical && { _lexical: true })
      };
    }
  }

  return schema;
}

/**
 * Generate a single example document based on landing-page-example.json format
 */
function generateSingleExampleDocument(structure: CollectionStructure | BlockStructure | GlobalStructure): any {
  if (structure.slug === 'pages') {
    // Return a template similar to landing-page-example.json structure
    return {
      title: "[AI_FILL: Page title]",
      slug: "[AI_FILL: URL slug]",
      layout: [
        {
          blockType: "[AI_FILL: Choose from available blocks]",
          // Fields will be filled based on selected block schema
          id: "[AUTO_GENERATED]"
        }
      ],
      meta: {
        title: "[AI_FILL: SEO title]",
        description: "[AI_FILL: SEO description]"
      },
      status: "draft"
    };
  }

  // For other collections, generate basic template
  const example: any = {};
  for (const field of structure.fields) {
    // Special handling for tabs fields - flatten them into the parent example
    if (field.type === 'tabs' && field.tabs) {
      for (const tab of field.tabs) {
        if (tab.name) {
          // Named tab - create nested object
          const tabObject: any = {};
          for (const tabField of tab.fields) {
            tabObject[tabField.name] = generateFieldPlaceholder(tabField);
          }
          example[tab.name] = tabObject;
        } else {
          // Unnamed tab - flatten fields
          for (const tabField of tab.fields) {
            example[tabField.name] = generateFieldPlaceholder(tabField);
          }
        }
      }
    } else if (field.name) {
      // Only add fields that have a name
      example[field.name] = generateFieldPlaceholder(field);
    }
  }
  
  return example;
}

/**
 * Generate field description for AI understanding
 */
function generateFieldDescription(field: FieldStructure): string {
  const descriptions: Record<string, string> = {
    text: "Text input field",
    textarea: "Multi-line text area",
    richText: "Rich text editor with Lexical format",
    number: "Numeric input",
    email: "Email address",
    select: "Dropdown selection",
    checkbox: "Boolean true/false",
    date: "Date in ISO format",
    upload: "File upload reference",
    relationship: "Reference to another document",
    array: "Array of items",
    group: "Grouped fields object",
    blocks: "Array of block objects with blockType",
    tabs: "Tabbed field grouping",
    json: "JSON object",
    code: "Code snippet",
    point: "Geographic coordinates [lat, lng]"
  };

  const baseDesc = descriptions[field.type] || `${field.type} field`;
  
  if (field.required) {
    return `${baseDesc} (required)`;
  }
  
  return baseDesc;
}

/**
 * Generate field placeholder for example document
 */
function generateFieldPlaceholder(field: FieldStructure): any {
  switch (field.type) {
    case 'text':
      return `[AI_FILL: ${field.name}]`;
    case 'textarea':
    case 'richText':
      return `[AI_FILL: ${field.name} content]`;
    case 'number':
      return `[AI_FILL: ${field.name} number]`;
    case 'email':
      return `[AI_FILL: email address]`;
    case 'select':
      return `[AI_FILL: Choose from options: ${field.options ? JSON.stringify(field.options) : 'see schema'}]`;
    case 'checkbox':
      return `[AI_FILL: true/false]`;
    case 'date':
      return `[AI_FILL: ISO date string]`;
    case 'upload':
      return `[AI_FILL: media document ID or reference]`;
    case 'relationship':
      return `[AI_FILL: ${field.relationTo} document ID]`;
    case 'array':
      return `[AI_FILL: Array of ${field.name}]`;
    case 'group':
      if (field.fields) {
        const groupObj: any = {};
        for (const subField of field.fields) {
          groupObj[subField.name] = generateFieldPlaceholder(subField);
        }
        return groupObj;
      }
      return `[AI_FILL: ${field.name} object]`;
    case 'blocks':
      return `[AI_FILL: Array of block objects with blockType from: ${field.blocks ? JSON.stringify(field.blocks) : 'see schema'}]`;
    case 'tabs':
      if (field.tabs) {
        const tabObj: any = {};
        for (const tab of field.tabs) {
          for (const tabField of tab.fields) {
            tabObj[tabField.name] = generateFieldPlaceholder(tabField);
          }
        }
        return tabObj;
      }
      return `[AI_FILL: ${field.name} tabbed content]`;
    default:
      return `[AI_FILL: ${field.name}]`;
  }
}


// Export the tool definition for MCP
export const prepareContentTool = {
  name: 'prepare-content',
  description: 'Analyzes PayloadCMS configuration and returns template structures for AI to fill. This is Phase 1 of the two-phase approach - it discovers collections, blocks, and globals with their exact field schemas, then generates empty templates with field descriptions and examples for AI content generation. The client fills these templates and sends them to populate-content tool.',
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