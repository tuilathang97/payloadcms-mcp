#!/usr/bin/env node

import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { bootstrap, bootstrapFull, getSampleContents } from './tools/bootstrap-tools.js';

// Load environment variables
config();

// Tool definitions
const tools = [
  {
    name: 'bootstrap',
    description: 'Create essential business website pages (10+ pages) with practical block combinations. This tool creates all essential pages for a business website including Home, About, Services, Contact, Blog, Privacy Policy, Terms & Conditions, FAQ, and more based on website type and requirements.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the PayloadCMS project directory'
        },
        websiteType: {
          type: 'string',
          enum: ['business', 'ecommerce', 'blog', 'portfolio', 'minimal'],
          description: 'Type of website to bootstrap',
          default: 'business'
        },
        includeEcommerce: {
          type: 'boolean',
          description: 'Include e-commerce pages and functionality',
          default: false
        },
        includeBlog: {
          type: 'boolean',
          description: 'Include blog pages and posts',
          default: true
        },
        includeJobs: {
          type: 'boolean',
          description: 'Include careers/jobs pages',
          default: false
        },
        businessInfo: {
          type: 'object',
          description: 'Business information for content generation',
          properties: {
            name: { type: 'string', description: 'Business name' },
            industry: { type: 'string', description: 'Industry sector' },
            description: { type: 'string', description: 'Business description' }
          }
        },
        contentQuality: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Quality level of generated content',
          default: 'medium'
        },
        resolveRelationships: {
          type: 'boolean',
          description: 'Automatically resolve content relationships',
          default: true
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'bootstrap-full',
    description: 'Create comprehensive dataset with all collections and block variations. This tool generates extensive sample content across all available collections with multiple layout variations for testing and development purposes.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the PayloadCMS project directory'
        },
        collections: {
          oneOf: [
            { type: 'string', enum: ['all'] },
            { type: 'array', items: { type: 'string' } }
          ],
          description: 'Collections to include: "all" or array of collection slugs',
          default: 'all'
        },
        blocksPerCollection: {
          type: 'number',
          description: 'Number of documents to create per collection',
          default: 3,
          minimum: 1,
          maximum: 10
        },
        includeAllLayoutVariations: {
          type: 'boolean',
          description: 'Create all available layout variations for blocks',
          default: true
        },
        createRelationships: {
          type: 'boolean',
          description: 'Create and resolve content relationships',
          default: true
        },
        uploadPlaceholderMedia: {
          type: 'boolean',
          description: 'Create placeholder media files',
          default: true
        },
        contentQuality: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Quality level of generated content',
          default: 'medium'
        },
        continueOnError: {
          type: 'boolean',
          description: 'Continue processing if some operations fail',
          default: true
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'get-sample-contents',
    description: 'Retrieve and export all sample content URLs and metadata from a PayloadCMS project. This tool queries existing collections and returns formatted content listings with URLs, metadata, and export options.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the PayloadCMS project directory'
        },
        collections: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific collections to include (optional, defaults to all)'
        },
        groupByCollection: {
          type: 'boolean',
          description: 'Group results by collection type',
          default: true
        },
        format: {
          type: 'string',
          enum: ['json', 'csv', 'sitemap'],
          description: 'Output format for the content listing',
          default: 'json'
        },
        includeMetadata: {
          type: 'boolean',
          description: 'Include additional metadata in output',
          default: false
        },
        includeBlockDetails: {
          type: 'boolean',
          description: 'Include block/layout details for pages',
          default: false
        },
        validateUrls: {
          type: 'boolean',
          description: 'Validate generated URLs match routing patterns',
          default: false
        },
        customUrlPatterns: {
          type: 'object',
          description: 'Custom URL patterns for specific collections',
          additionalProperties: { type: 'string' }
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'createBlockSampleContent',
    description: 'Generate sample content for PayloadCMS block configurations',
    inputSchema: {
      type: 'object',
      properties: {
        blockSlug: { 
          type: 'string', 
          description: 'The block type identifier' 
        },
        collectionSlug: { 
          type: 'string', 
          description: 'The collection containing the block' 
        },
        variations: { 
          type: 'number', 
          description: 'Number of content variations to generate',
          default: 1 
        },
        includeOptional: { 
          type: 'boolean', 
          description: 'Include optional fields',
          default: true 
        },
        locale: { 
          type: 'string', 
          description: 'Content locale',
          default: 'en' 
        }
      },
      required: ['blockSlug', 'collectionSlug']
    }
  },
  {
    name: 'createCollectionSampleContent',
    description: 'Generate complete sample documents for PayloadCMS collections',
    inputSchema: {
      type: 'object',
      properties: {
        collectionSlug: { 
          type: 'string', 
          description: 'The collection identifier' 
        },
        count: { 
          type: 'number', 
          description: 'Number of documents to create',
          default: 3 
        },
        includeOptional: { 
          type: 'boolean', 
          description: 'Include optional fields',
          default: true 
        },
        locale: { 
          type: 'string', 
          description: 'Content locale',
          default: 'en' 
        }
      },
      required: ['collectionSlug']
    }
  },
  {
    name: 'getSampleContent',
    description: 'Query existing collections and blocks to understand data structure',
    inputSchema: {
      type: 'object',
      properties: {
        collectionSlug: { 
          type: 'string', 
          description: 'Specific collection to query' 
        },
        limit: { 
          type: 'number', 
          description: 'Maximum results to return',
          default: 10 
        },
        fields: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Specific fields to include' 
        }
      }
    }
  },
  {
    name: 'createRelationalContent',
    description: 'Create content with automatic dependency resolution',
    inputSchema: {
      type: 'object',
      properties: {
        targetCollection: { 
          type: 'string', 
          description: 'Main collection to create content for' 
        },
        count: { 
          type: 'number', 
          description: 'Number of documents to create',
          default: 1 
        },
        createDependencies: { 
          type: 'boolean', 
          description: 'Auto-create related content',
          default: true 
        },
        dependencyDepth: { 
          type: 'number', 
          description: 'Maximum relationship depth',
          default: 3 
        }
      },
      required: ['targetCollection']
    }
  },
  {
    name: 'convertToRichtext',
    description: 'Convert plain text, HTML, or markdown to Lexical rich text format',
    inputSchema: {
      type: 'object',
      properties: {
        content: { 
          type: 'string', 
          description: 'Content to convert' 
        },
        format: { 
          type: 'string', 
          enum: ['plaintext', 'html', 'markdown'],
          description: 'Input format',
          default: 'plaintext' 
        }
      },
      required: ['content']
    }
  }
];

class PayloadCMSMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: process.env['MCP_SERVER_NAME'] || 'PayloadCMS MCP Server',
        version: process.env['MCP_SERVER_VERSION'] || '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'bootstrap':
            return await this.handleBootstrap(args);
          
          case 'bootstrap-full':
            return await this.handleBootstrapFull(args);
          
          case 'get-sample-contents':
            return await this.handleGetSampleContents(args);
          
          case 'createBlockSampleContent':
            return await this.handleCreateBlockSampleContent(args);
          
          case 'createCollectionSampleContent':
            return await this.handleCreateCollectionSampleContent(args);
          
          case 'getSampleContent':
            return await this.handleGetSampleContent(args);
          
          case 'createRelationalContent':
            return await this.handleCreateRelationalContent(args);
          
          case 'convertToRichtext':
            return await this.handleConvertToRichtext(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private async handleBootstrap(args: any) {
    try {
      const result = await bootstrap(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in bootstrap: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleBootstrapFull(args: any) {
    try {
      const result = await bootstrapFull(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in bootstrap-full: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleGetSampleContents(args: any) {
    try {
      const result = await getSampleContents(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in get-sample-contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleCreateBlockSampleContent(args: any) {
    const { blockSlug, collectionSlug, variations = 1 } = args;
    
    // Placeholder implementation
    const sampleData = {
      blockType: blockSlug,
      content: `Sample content for ${blockSlug} block in ${collectionSlug} collection`,
      generated: new Date().toISOString(),
      variations: variations
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sampleData, null, 2),
        },
      ],
    };
  }

  private async handleCreateCollectionSampleContent(args: any) {
    const { collectionSlug, count = 3 } = args;
    
    // Placeholder implementation
    const sampleData = {
      collection: collectionSlug,
      documentsCreated: count,
      sampleDocument: {
        id: 'sample-id-123',
        title: `Sample ${collectionSlug} document`,
        createdAt: new Date().toISOString(),
        content: `This is sample content for the ${collectionSlug} collection`
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sampleData, null, 2),
        },
      ],
    };
  }

  private async handleGetSampleContent(args: any) {
    const { collectionSlug, limit = 10 } = args;
    
    // Placeholder implementation
    const sampleData = {
      collection: collectionSlug || 'all',
      limit: limit,
      message: 'This is a placeholder. Connect to your PayloadCMS instance to get real data.',
      sampleStructure: {
        docs: [],
        totalDocs: 0,
        totalPages: 0
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sampleData, null, 2),
        },
      ],
    };
  }

  private async handleCreateRelationalContent(args: any) {
    const { targetCollection, count = 1, createDependencies = true } = args;
    
    // Placeholder implementation
    const sampleData = {
      targetCollection: targetCollection,
      documentsCreated: count,
      dependenciesCreated: createDependencies,
      message: 'Relational content creation placeholder. Implement with PayloadCMS integration.'
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sampleData, null, 2),
        },
      ],
    };
  }

  private async handleConvertToRichtext(args: any) {
    const { content } = args;
    
    // Simple Lexical conversion placeholder
    const lexicalContent = {
      root: {
        children: [
          {
            children: [
              {
                text: content,
                type: 'text',
                version: 1,
                format: 0,
                mode: 'normal',
                style: '',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(lexicalContent, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('PayloadCMS MCP Server running on stdio');
  }
}

// Start the server
const server = new PayloadCMSMCPServer();
server.run().catch((error) => {
  console.error('Failed to run server:', error);
  process.exit(1);
}); 