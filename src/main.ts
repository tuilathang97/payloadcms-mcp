#!/usr/bin/env node

import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { bootstrap, bootstrapFull, getSampleContents } from './tools/bootstrap-tools.js';
import { prepareContent, prepareContentTool } from './tools/prepare-tools.js';
import { populateContent, populateContentTool } from './tools/populate-tools.js';

// Load environment variables
config();

// Tool definitions
const tools = [
  prepareContentTool,
  populateContentTool,
  {
    name: 'bootstrap',
    description: 'Create essential business website pages with progressive context gathering. This tool dynamically discovers PayloadCMS project configuration and generates content based on actual collections and blocks found in the project.',
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
        },
        step: {
          type: 'string',
          enum: ['discover_config', 'generate_content'],
          description: 'Progressive context gathering step',
          default: 'discover_config'
        },
        configurationFiles: {
          type: 'array',
          description: 'Configuration files content for multi-step operations',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'File content' },
              type: { type: 'string', enum: ['config', 'collection', 'block', 'global'], description: 'File type' }
            },
            required: ['path', 'content']
          }
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'bootstrap-full',
    description: 'Create comprehensive dataset with all discovered collections and block variations using progressive context gathering. This tool dynamically discovers project configuration and generates extensive content based on actual schema.',
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
          description: 'Collections to include: "all" or array of discovered collection slugs',
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
          description: 'Create all available layout variations for discovered blocks',
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
        },
        step: {
          type: 'string',
          enum: ['discover_config', 'generate_content'],
          description: 'Progressive context gathering step',
          default: 'discover_config'
        },
        configurationFiles: {
          type: 'array',
          description: 'Configuration files content for multi-step operations',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'File content' },
              type: { type: 'string', enum: ['config', 'collection', 'block', 'global'], description: 'File type' }
            },
            required: ['path', 'content']
          }
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'get-sample-contents',
    description: 'Retrieve and export all content URLs and metadata from a PayloadCMS project using progressive context gathering. This tool dynamically discovers collections and returns formatted content listings based on actual project schema.',
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
          description: 'Specific collections to include (optional, uses discovered collections by default)'
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
        },
        step: {
          type: 'string',
          enum: ['discover_config', 'generate_content'],
          description: 'Progressive context gathering step',
          default: 'discover_config'
        },
        configurationFiles: {
          type: 'array',
          description: 'Configuration files content for multi-step operations',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'File content' },
              type: { type: 'string', enum: ['config', 'collection', 'block', 'global'], description: 'File type' }
            },
            required: ['path', 'content']
          }
        }
      },
      required: ['projectPath']
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
          case 'prepare-content':
            return await this.handlePrepareContent(args);
          
          case 'populate-content':
            return await this.handlePopulateContent(args);
            
          case 'bootstrap':
            return await this.handleBootstrap(args);
          
          case 'bootstrap-full':
            return await this.handleBootstrapFull(args);
          
          case 'get-sample-contents':
            return await this.handleGetSampleContents(args);
          
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

  private async handlePrepareContent(args: any) {
    try {
      const result = await prepareContent(args);
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
            text: `Error in prepare-content: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handlePopulateContent(args: any) {
    try {
      const result = await populateContent(args);
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
            text: `Error in populate-content: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
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