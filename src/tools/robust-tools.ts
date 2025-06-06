/**
 * Robust PayloadCMS MCP Tools
 * 
 * These tools follow the approach described in the mcp-guide.md and MCP best practices:
 * 1. Parse payload.config.ts as the source of truth
 * 2. Find and parse actual collection/block config files
 * 3. Generate sample data based on real field structures
 * 
 * Important: Always provide absolute file paths to ensure reliable operation
 * across different working directories and MCP client environments.
 */

export const parsePayloadConfigTool = {
  name: 'parsePayloadConfig',
  description: 'Parse the main payload.config.ts file to discover all collections and blocks. This is the first step in the robust workflow - it reads the PayloadCMS configuration file to understand the project structure and locate all collection and block definitions.',
  inputSchema: {
    type: 'object',
    properties: {
      payloadConfigPath: {
        type: 'string',
        description: 'ABSOLUTE path to the payload.config.ts file. Example: "/Users/username/myproject/payload.config.ts". Always provide the full path from filesystem root to avoid working directory issues.'
      },
      tsconfigPath: {
        type: 'string',
        description: 'ABSOLUTE path to tsconfig.json for TypeScript resolution (optional). Example: "/Users/username/myproject/tsconfig.json". Leave empty if using default TypeScript settings.'
      },
      projectRoot: {
        type: 'string',
        description: 'ABSOLUTE path to the root directory of the PayloadCMS project. Example: "/Users/username/myproject". This is used to resolve relative imports within the config files. If not provided, the directory containing the payload config file will be used.'
      }
    },
    required: ['payloadConfigPath'],
    additionalProperties: false
  }
};

export const discoverConfigFilesTool = {
  name: 'discoverConfigFiles',
  description: 'Automatically discover all PayloadCMS configuration files in the project. This tool recursively scans the project directory to find collection and block config files, typically located in patterns like src/collections/*/config.ts and src/blocks/*/config.ts. Useful for getting an overview of all available configurations.',
  inputSchema: {
    type: 'object',
    properties: {
      projectRoot: {
        type: 'string',
        description: 'ABSOLUTE path to the root directory to search from. Example: "/Users/username/myproject". The tool will recursively search all subdirectories.'
      },
      patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File name patterns to search for using glob syntax. Common PayloadCMS config file patterns.',
        default: ['**/config.ts', '**/config.js', '**/index.ts', '**/index.js'],
        examples: [
          ['**/config.ts', '**/config.js'],
          ['src/collections/*/config.ts', 'src/blocks/*/config.ts']
        ]
      },
      excludeDirs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Directory names to exclude from the search to improve performance and avoid irrelevant files.',
        default: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.nyc_output'],
        examples: [
          ['node_modules', '.git', 'dist'],
          ['node_modules', '.git', 'build', 'out']
        ]
      }
    },
    required: ['projectRoot'],
    additionalProperties: false
  }
};

export const parseCollectionConfigTool = {
  name: 'parseCollectionConfig',
  description: 'Parse a specific collection configuration file to extract complete field structures. This tool reads the actual TypeScript/JavaScript config file and extracts all field definitions including types, validation rules, relationships, admin UI settings, and access controls. Essential for understanding the exact structure before generating sample data.',
  inputSchema: {
    type: 'object',
    properties: {
      configFilePath: {
        type: 'string',
        description: 'ABSOLUTE path to the collection config file. Example: "/Users/username/myproject/src/collections/Posts/config.ts". Must be the full path from filesystem root to the specific config file.'
      },
      tsconfigPath: {
        type: 'string',
        description: 'ABSOLUTE path to tsconfig.json for TypeScript resolution (optional). Example: "/Users/username/myproject/tsconfig.json". Required only if the config file uses complex TypeScript imports or custom path mappings.'
      }
    },
    required: ['configFilePath'],
    additionalProperties: false
  }
};

export const parseBlockConfigTool = {
  name: 'parseBlockConfig',
  description: 'Parse a specific block configuration file to extract complete field structures. Blocks are reusable content components in PayloadCMS that can be used within rich text editors or array fields. This tool extracts all block field definitions, allowing for accurate sample data generation that matches the actual block structure.',
  inputSchema: {
    type: 'object',
    properties: {
      configFilePath: {
        type: 'string',
        description: 'ABSOLUTE path to the block config file. Example: "/Users/username/myproject/src/blocks/Hero/config.ts". Must be the full path from filesystem root to the specific block config file.'
      },
      tsconfigPath: {
        type: 'string',
        description: 'ABSOLUTE path to tsconfig.json for TypeScript resolution (optional). Example: "/Users/username/myproject/tsconfig.json". Required only if the block config uses complex TypeScript imports.'
      }
    },
    required: ['configFilePath'],
    additionalProperties: false
  }
};

export const generateSampleFromConfigTool = {
  name: 'generateSampleFromConfig',
  description: 'Generate realistic sample content based on parsed field configurations. This tool takes the parsed field structures from parseCollectionConfig or parseBlockConfig and generates sample data that respects all field types, validation rules, relationships, and constraints defined in the actual PayloadCMS configuration. The generated data is suitable for testing, demos, or seeding development databases.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['collection', 'block'],
        description: 'Type of configuration to generate sample data for. Use "collection" for documents that will be stored in the database, "block" for reusable content components.'
      },
      configData: {
        type: 'object',
        description: 'Parsed configuration data object returned from parseCollectionConfig or parseBlockConfig. This contains all the field definitions, validation rules, and metadata needed to generate appropriate sample data.',
        properties: {
          slug: { type: 'string' },
          fields: { type: 'array' }
        },
        required: ['slug', 'fields']
      },
      count: {
        type: 'number',
        description: 'Number of sample items to generate. Higher counts are useful for testing pagination, search, and bulk operations.',
        default: 3,
        minimum: 1,
        maximum: 50
      },
      includeOptional: {
        type: 'boolean',
        description: 'Whether to include optional fields in the generated data. Set to false for minimal data sets, true for comprehensive testing data.',
        default: true
      },
      locale: {
        type: 'string',
        description: 'Locale for generated content (affects text generation, dates, numbers). Use standard locale codes like "en", "es", "fr", "de".',
        default: 'en',
        examples: ['en', 'es', 'fr', 'de', 'ja', 'zh']
      }
    },
    required: ['type', 'configData'],
    additionalProperties: false
  }
};

export const createDocumentsFromConfigTool = {
  name: 'createDocumentsFromConfig',
  description: 'Create actual PayloadCMS documents in the database using sample data generated from configuration. This tool combines configuration parsing, sample data generation, and document creation into a single workflow. It ensures the created documents perfectly match the field structures and can handle relationship resolution and media creation.',
  inputSchema: {
    type: 'object',
    properties: {
      collectionSlug: {
        type: 'string',
        description: 'The slug identifier of the collection to create documents in. This must match exactly with a collection defined in your PayloadCMS configuration.',
        examples: ['posts', 'users', 'pages', 'products', 'categories']
      },
      configData: {
        type: 'object',
        description: 'Parsed collection configuration data object returned from parseCollectionConfig. Contains all field definitions and collection metadata.',
        properties: {
          slug: { type: 'string' },
          fields: { type: 'array' }
        },
        required: ['slug', 'fields']
      },
      count: {
        type: 'number',
        description: 'Number of documents to create in the collection. Consider your database limits and testing needs.',
        default: 3,
        minimum: 1,
        maximum: 20
      },
      resolveRelationships: {
        type: 'boolean',
        description: 'Whether to automatically create related documents for relationship fields. If true, the tool will create dependent documents in related collections to satisfy relationship constraints.',
        default: true
      },
      createMedia: {
        type: 'boolean',
        description: 'Whether to create placeholder media files for upload fields. If true, generates placeholder images and files that can be used for testing upload functionality.',
        default: false
      }
    },
    required: ['collectionSlug', 'configData'],
    additionalProperties: false
  }
};

export const validateConfigStructureTool = {
  name: 'validateConfigStructure',
  description: 'Validate that a parsed configuration structure is valid and complete. This tool performs comprehensive validation checks including required fields, field type validity, relationship integrity, and structural correctness. Use this before generating sample data to catch configuration issues early.',
  inputSchema: {
    type: 'object',
    properties: {
      configData: {
        type: 'object',
        description: 'Parsed configuration data object to validate. Should be the output from parseCollectionConfig, parseBlockConfig, or similar parsing tools.',
        properties: {
          slug: { type: 'string' },
          fields: { type: 'array' }
        },
        required: ['slug', 'fields']
      },
      type: {
        type: 'string',
        enum: ['collection', 'block', 'global'],
        description: 'Type of configuration being validated. Different types have different validation rules and requirements.'
      },
      strict: {
        type: 'boolean',
        description: 'Whether to apply strict validation rules. Strict mode checks for best practices, naming conventions, and potential performance issues beyond basic structural validity.',
        default: false
      }
    },
    required: ['configData', 'type'],
    additionalProperties: false
  }
};

export const analyzeProjectStructureTool = {
  name: 'analyzeProjectStructure',
  description: 'Analyze the complete PayloadCMS project structure to understand relationships between collections, blocks, and configurations. This tool provides a comprehensive overview of the project organization, relationship dependencies, complexity metrics, and identifies potential issues or optimization opportunities.',
  inputSchema: {
    type: 'object',
    properties: {
      payloadConfigPath: {
        type: 'string',
        description: 'ABSOLUTE path to the main payload.config.ts file. Example: "/Users/username/myproject/payload.config.ts". This is the entry point for analyzing the entire project structure.'
      },
      tsconfigPath: {
        type: 'string',
        description: 'ABSOLUTE path to tsconfig.json for TypeScript resolution (optional). Example: "/Users/username/myproject/tsconfig.json". Helps resolve complex import paths and type definitions.'
      },
      includeUnused: {
        type: 'boolean',
        description: 'Whether to include analysis of config files that exist in the project but are not referenced in the main configuration. Useful for finding orphaned or experimental configurations.',
        default: true
      },
      generateReport: {
        type: 'boolean',
        description: 'Whether to generate a detailed analysis report with metrics, recommendations, and structural insights. Disable for simpler output.',
        default: true
      }
    },
    required: ['payloadConfigPath'],
    additionalProperties: false
  }
};

export const createCompleteDatasetTool = {
  name: 'createCompleteDataset',
  description: 'Create a complete dataset for a PayloadCMS project by parsing all configurations and generating sample data for all collections. This is the most comprehensive tool that orchestrates the entire workflow: configuration parsing, dependency analysis, relationship resolution, and document creation across all collections. Perfect for setting up development or demo environments.',
  inputSchema: {
    type: 'object',
    properties: {
      payloadConfigPath: {
        type: 'string',
        description: 'ABSOLUTE path to the main payload.config.ts file. Example: "/Users/username/myproject/payload.config.ts". This serves as the entry point for discovering and processing all collections.'
      },
      tsconfigPath: {
        type: 'string',
        description: 'ABSOLUTE path to tsconfig.json for TypeScript resolution (optional). Example: "/Users/username/myproject/tsconfig.json". Recommended for projects with complex TypeScript configurations.'
      },
      collectionsToInclude: {
        type: 'array',
        items: { 
          type: 'string',
          description: 'Collection slug to include'
        },
        description: 'Specific collection slugs to include in the dataset creation. If empty or not provided, all collections found in the configuration will be processed. Use this to limit scope for testing or partial data generation.',
        examples: [
          ['posts', 'users'],
          ['pages', 'media', 'categories'],
          []
        ]
      },
      documentsPerCollection: {
        type: 'number',
        description: 'Number of documents to create per collection. Consider your database size, testing needs, and relationship complexity when setting this value.',
        default: 3,
        minimum: 1,
        maximum: 10
      },
      resolveAllRelationships: {
        type: 'boolean',
        description: 'Whether to resolve all relationship dependencies across collections. If true, the tool will create documents in the correct order to satisfy all relationship constraints, creating dependent documents as needed.',
        default: true
      },
      createMediaAssets: {
        type: 'boolean',
        description: 'Whether to create placeholder media assets for upload and media fields. If true, generates placeholder images, documents, and other media files for comprehensive testing.',
        default: false
      },
      dryRun: {
        type: 'boolean',
        description: 'Whether to perform a dry run without actually creating documents in the database. Useful for previewing what would be created and validating the configuration before making actual changes.',
        default: false
      }
    },
    required: ['payloadConfigPath'],
    additionalProperties: false
  }
};

export const testPayloadConnectionTool = {
  name: 'testPayloadConnection',
  description: 'Test the connection to your PayloadCMS instance and verify authentication. This diagnostic tool helps troubleshoot connection issues before attempting to create documents. It checks if the PayloadCMS server is accessible and if the provided credentials are valid.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  }
}; 