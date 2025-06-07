# PayloadCMS MCP Server

A Model Context Protocol (MCP) server for PayloadCMS integration, providing intelligent content generation with automatic project discovery and advanced multi-step workflow.

> **Current Status**: ✅ Fully functional with refactored bootstrap architecture  
> **Version**: 3.0.0 - Advanced context management with smart dependency resolution  
> **Ready for**: Production use with any PayloadCMS project structure

## Overview

This MCP server provides sophisticated multi-phase approaches to PayloadCMS content generation, with both traditional two-phase workflow and advanced context-managed multi-step operations for complex dependency handling.

### Key Features

- 🎯 **Advanced Multi-Step Bootstrap**: Context-managed workflow with smart dependency resolution
- 🔄 **8-Call Limit Protection**: Prevents infinite loops with automatic call counting
- 🧠 **Smart Dependency Analysis**: Automatically detects missing relationships and suggests content
- 💾 **Context Management**: UUID-based state preservation across multiple operations  
- 🔍 **Exact Config Mapping**: Uses actual slugs from config files (e.g., `featureSections` not `FeatureSections`)
- 🧩 **Client-Agnostic Design**: Works with any PayloadCMS project structure without hardcoded assumptions
- 🎨 **Reusable Media Management**: Automatically deduplicates placeholder images
- ✅ **User-Driven Content**: Accept actual user content instead of generated placeholder text
- 🛡️ **Robust Error Handling**: Graceful degradation and detailed error reporting
- 📝 **Development Logging**: Comprehensive logging when `DEBUG=true` for troubleshooting

## Recent Major Improvements (v3.0.0)

### ✅ **Bootstrap Refactor - Advanced Context Management**
- **Context-Managed Multi-Step Flow**: UUID-based context preservation across multiple operations
- **Smart Dependency Resolution**: Automatic analysis and resolution of missing relationships
- **8-Call Limit Protection**: Prevents infinite loops with automatic call counting and timeouts
- **Reusable Media System**: Automatically reuses existing placeholder images to prevent duplicates
- **User-Driven Content**: Accept actual user content instead of generating placeholder text
- **Proper Lexical Format**: Generate rich text content matching PayloadCMS Lexical structure

### 🚀 **Enhanced Architecture (v3.0)** 
- **Multi-Tool Approach**: `bootstrap-refactored` for advanced workflows, traditional tools still available
- **Context Management**: UUID contexts with 2-hour expiration and automatic cleanup
- **Dependency Analysis**: Smart detection of missing references with suggested content
- **Media Management**: Caching and reuse system for placeholder images
- **Iterative Creation**: Handle complex dependencies through multiple resolution steps

### 🔄 **Previous Improvements (v2.0.0)**
- **Endless Loop Problem**: Resolved infinite context gathering loops ✅
- **Slug Mismatch**: Uses exact slugs from config files ✅  
- **Authentication Issues**: Fixed 403 errors with proper JWT token authentication ✅
- **Two-Phase Workflow**: Separate preparation and population phases ✅

## MCP Tools

### **🚀 `bootstrap-refactored`** ⚡ *Latest & Most Advanced*
Advanced multi-step bootstrap with context management, dependency resolution, and 8-call limit protection. This is the most sophisticated tool for complex content creation scenarios.

**Purpose:** Handle complex content creation with smart dependency resolution and user interaction through multiple steps.

**Features:**
- UUID-based context management with 8-call limit
- Smart dependency analysis and resolution
- Automatic media reuse and deduplication  
- User-driven content acceptance
- Proper Lexical rich text format generation
- Iterative relationship resolution

**Multi-Step Flow:**

**Step 1 - discover_config:**
```json
{
  "step": "discover_config",
  "projectPath": "/path/to/project"
}
```
Returns content templates and context ID for subsequent steps.

**Step 2 - generate_content:**
```json
{
  "step": "generate_content", 
  "contextId": "uuid-from-step1",
  "userContent": {
    "collections": {
      "products": [
        {
          "title": "My Product",
          "price": 299,
          "featuredImage": "hero.png",
          "categories": ["Electronics"]
        }
      ]
    }
  }
}
```
Either creates content immediately or identifies missing dependencies.

**Step 3 - resolve_dependencies (if needed):**
```json
{
  "step": "resolve_dependencies",
  "contextId": "same-uuid", 
  "dependencyContent": {
    "collections": {
      "categories": [{"title": "Electronics", "slug": "electronics"}],
      "media": [{"filename": "hero.png"}]
    }
  }
}
```
Creates missing dependencies first, then completes main content creation.

### **Phase 1: `prepare-content`** ⚡ *Traditional Two-Phase*
Reads all PayloadCMS configurations and returns structured data for client review. This is the foundation of the traditional two-phase workflow.

**Purpose:** Discover, parse, and structure all PayloadCMS configurations without creating any documents.

**Parameters:**
- `projectPath` (string): Absolute path to the PayloadCMS project directory

**Returns:**
```json
{
  "success": true,
  "discoveredConfig": {
    "collections": ["pages", "posts", "products"],
    "blocks": ["featureSections", "heroSections"], // Exact slugs!
    "globals": ["header", "footer"]
  },
  "parsedStructure": {
    "collections": { /* detailed field structures */ },
    "blocks": { /* detailed field structures */ },
    "globals": { /* detailed field structures */ }
  },
  "sampleContent": { /* generated sample data respecting actual field types */ },
  "metadata": { /* preparation statistics and timing */ }
}
```

### **Phase 2: `populate-content`** ⚡ *New & Recommended*
Creates actual PayloadCMS documents using prepared content structure and client specifications.

**Purpose:** Take prepared configurations and client content preferences to create actual documents in PayloadCMS.

**Parameters:**
- `preparedContent` (object): The output from `prepare-content` tool
- `contentToCreate` (object): Specifications for what to create
  - `collections` (object): Collections with document counts and optional custom data
  - `generateRelationships` (boolean): Whether to resolve relationships
  - `createMediaAssets` (boolean): Whether to create placeholder media
- `options` (object): Creation options
  - `continueOnError` (boolean): Continue if some documents fail
  - `validateBeforeCreate` (boolean): Validate data before creation
  - `dryRun` (boolean): Simulate creation without actually creating documents

**Example Usage:**
```json
{
  "preparedContent": { /* output from prepare-content */ },
  "contentToCreate": {
    "collections": {
      "pages": {"count": 5},
      "posts": {"count": 10, "customData": [/* optional custom content */]}
    },
    "generateRelationships": true,
    "createMediaAssets": true
  },
  "options": {
    "continueOnError": true,
    "dryRun": false
  }
}
```

### **Legacy Tools** (Deprecated but Available)

#### ~~`bootstrap`~~ and ~~`bootstrap-full`~~ 
*These tools have been deprecated in favor of `bootstrap-refactored`.*

The old bootstrap tools had several limitations:
- No context management between calls
- Limited dependency resolution  
- No call limit protection
- Less sophisticated relationship handling

**Migration:** Use `bootstrap-refactored` for all new projects. It provides all the functionality of the old tools plus advanced features.

#### `get-sample-contents`
Retrieve and export all content URLs and metadata from a PayloadCMS project.

*Note: This tool remains fully functional and useful for content auditing and export.*

## Quick Start

### 1. **Setup**
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Configure environment
cp env.example .env
# Edit .env with your PayloadCMS credentials
```

### 2. **Recommended: Advanced Bootstrap Workflow**

**Step 1: Discover Configuration**
```bash
# Use your MCP client to call:
{
  "tool": "bootstrap-refactored",
  "step": "discover_config",
  "projectPath": "/path/to/your/payloadcms/project"
}
# Returns: contextId and content templates
```

**Step 2: Submit User Content**
```bash
{
  "tool": "bootstrap-refactored", 
  "step": "generate_content",
  "contextId": "uuid-from-step1",
  "userContent": {
    "collections": {
      "products": [
        {
          "title": "My Product",
          "price": 299,
          "featuredImage": "hero.png",
          "categories": ["Electronics"]
        }
      ]
    }
  }
}
# Either creates content or requests dependencies
```

**Step 3: Resolve Dependencies (if needed)**
```bash
{
  "tool": "bootstrap-refactored",
  "step": "resolve_dependencies", 
  "contextId": "same-uuid",
  "dependencyContent": {
    "collections": {
      "categories": [{"title": "Electronics", "slug": "electronics"}],
      "media": [{"filename": "hero.png"}]
    }
  }
}
# Creates dependencies then main content
```

### 3. **Alternative: Traditional Two-Phase Workflow**

**Step 1: Prepare Content**
```bash
{
  "tool": "prepare-content",
  "projectPath": "/path/to/your/payloadcms/project"
}
```

**Step 2: Review & Populate**
```bash
{
  "tool": "populate-content",
  "preparedContent": { /* output from step 1 */ },
  "contentToCreate": {
    "collections": {
      "pages": {"count": 5},
      "posts": {"count": 10}
    }
  }
}
```

### 4. **Run the Server**
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

## Configuration

### Environment Variables

Copy `env.example` to `.env` and configure:

```env
# PayloadCMS Instance Configuration
PAYLOAD_HOST=http://localhost:3000
PAYLOAD_API_KEY=your-api-key-here
PAYLOAD_USERNAME=admin@lumines.io
PAYLOAD_PASSWORD=your-secure-password

# Development Logging (v2.0 feature)
DEBUG=true
LOG_LEVEL=debug
```

### PayloadCMS Requirements

Ensure your PayloadCMS instance:
1. ✅ Has REST API enabled
2. ✅ Allows the configured user/API key access
3. ✅ Has collections, blocks, and globals configured
4. ✅ Is running and accessible from the MCP server

## Development Logging (New in v2.0)

When `DEBUG=true`, the server provides comprehensive logging:

- **File Logging**: Detailed logs written to `mcp-debug.log`
- **Console Logging**: Real-time logging to console
- **Request Tracking**: All PayloadCMS API requests/responses
- **Error Context**: Full error details with stack traces
- **Performance Metrics**: Timing information for all operations

### Log Categories
- `PayloadAuth`: Authentication attempts and results
- `PayloadRequest/Response`: API communication
- `PrepareContent`: Configuration preparation process
- `PopulateContent`: Document creation process
- `ContextGathering`: Project discovery and parsing

## Architecture

### Two-Phase Workflow Benefits

1. **Client Control**: Review configurations before creation
2. **Error Prevention**: Catch issues early in preparation phase
3. **Flexibility**: Modify sample content before population
4. **Transparency**: See exactly what will be created
5. **Recovery**: Better error handling and partial completion

### File Structure
```
src/
├── main.ts                     # MCP server entry point
├── tools/
│   ├── prepare-tools.ts        # ⚡ Phase 1: Configuration preparation
│   ├── populate-tools.ts       # ⚡ Phase 2: Document creation
│   └── bootstrap-tools.ts      # Legacy tools (deprecated but functional)
├── lib/
│   ├── payload-client.ts       # ✅ Enhanced PayloadCMS API client with JWT auth
│   ├── context-gatherer.ts     # ✅ Fixed configuration discovery
│   ├── config-parser.ts        # ✅ Accurate config file parsing
│   ├── content-generator.ts    # Content generation utilities
│   ├── relationship-manager.ts # Legacy dependency resolution
│   ├── context-manager.ts      # 🚀 NEW: UUID context management with 8-call limits
│   ├── dependency-resolver.ts  # 🚀 NEW: Smart dependency analysis and resolution
│   ├── media-manager.ts        # 🚀 NEW: Reusable media management with caching
│   └── refactored-bootstrap.ts # 🚀 NEW: Advanced multi-step bootstrap implementation
└── utils/
    ├── logger.ts              # ⚡ Comprehensive logging system
    └── media-upload.ts        # Media handling utilities
```

## Project History & Evolution

### v3.0.0 - Advanced Context Management (Current)
- ✅ **Refactored Bootstrap Architecture** with sophisticated multi-step workflow
- ✅ **Context Management System** with UUID-based state preservation  
- ✅ **Smart Dependency Resolution** automatic analysis and iterative resolution
- ✅ **8-Call Limit Protection** prevents infinite loops with automatic counting
- ✅ **Reusable Media Management** caching and deduplication system
- ✅ **User-Driven Content** accepts actual user content instead of placeholders
- ✅ **Proper Lexical Format** generates rich text matching PayloadCMS structure

### v2.0.0 - Two-Phase Architecture 
- ✅ **Fixed endless loop issues** that plagued earlier versions
- ✅ **Implemented two-phase workflow** for better client interaction  
- ✅ **Fixed slug mapping** to use exact config values
- ✅ **Enhanced authentication** with proper JWT token handling
- ✅ **Added comprehensive logging** for development and debugging
- ✅ **Improved error handling** with graceful degradation

### v1.x - Progressive Context Gathering
- ❌ Had endless loop issues in context gathering
- ❌ Used transformed slugs instead of exact config values  
- ❌ One-shot approach with limited client control
- ❌ Authentication issues with 403 errors
- ✅ Established basic MCP server architecture
- ✅ Implemented PayloadCMS configuration parsing

### Development Insights

The evolution from v1.x to v2.0 was driven by real-world usage feedback:

1. **Endless Loop Problem**: The original context gatherer would get stuck asking for configuration files that were already available in the main config, creating infinite loops until clients gave up.

2. **Slug Transformation Issues**: The system assumed block names like `FeatureSections` when the actual config used `featureSections`, causing creation failures.

3. **One-Shot Limitations**: Clients couldn't review what would be created, leading to unexpected results and wasted API calls.

4. **Authentication Complexity**: PayloadCMS API authentication wasn't properly handled, causing 403 errors.

5. **Poor Error Recovery**: Any failure would cause complete operation failure instead of graceful degradation.

The v2.0 two-phase approach addresses all these issues by separating discovery/parsing from creation, giving clients full visibility and control.

## Supported PayloadCMS Features

### Field Types
- **Text Fields**: text, textarea, email, number, date
- **Selection Fields**: select, radio, checkbox  
- **Rich Content**: richText (Lexical), code, json
- **Relationships**: relationship (single/multiple), upload
- **Layout Fields**: group, array, blocks, tabs, row, collapsible
- **Geo**: point
- **Custom**: Extensible for custom field types

### Configuration Patterns
- **Collections**: Any collection structure with proper field definitions
- **Blocks**: Reusable content blocks with field configurations
- **Globals**: Site-wide configurations (header, footer, theme, etc.)
- **Relationships**: Cross-collection references and dependencies
- **Media**: Upload fields and media management

## Troubleshooting

### Common Issues

1. **403 Authentication Errors** ✅ *Fixed in v2.0*
   - Use email/password credentials from your `.env` file
   - The server now uses proper JWT authentication
   - Check that PayloadCMS instance is running

2. **Endless Context Gathering Loops** ✅ *Fixed in v2.0*  
   - This was resolved by improving the config completeness detection
   - The new two-phase approach prevents these loops entirely

3. **Slug Mismatch Errors** ✅ *Fixed in v2.0*
   - The server now uses exact slugs from config files
   - No more `FeatureSections` vs `featureSections` issues

4. **Content Creation Failures**
   - Use `prepare-content` first to validate configurations
   - Check the `parsedStructure` to ensure field definitions are correct
   - Use `dryRun: true` to test without creating documents

### Debug Mode

Enable comprehensive logging:
```env
DEBUG=true
LOG_LEVEL=debug
```

This creates detailed logs in `mcp-debug.log` and console output for all operations.

## Development

### Scripts
- `npm run build` - Compile TypeScript
- `npm run dev` - Development mode with hot reload  
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint checking
- `npm run lint:fix` - Auto-fix linting issues

### Testing
```bash
# Type checking
npm run type-check

# Build verification  
npm run build

# Run server
npm run dev
```

## MCP Client Integration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "payloadcms": {
      "command": "node",
      "args": ["/path/to/payload-mcp/dist/main.js"],
      "env": {
        "PAYLOAD_HOST": "http://localhost:3000",
        "PAYLOAD_API_KEY": "your-api-key",
        "PAYLOAD_USERNAME": "admin@lumines.io", 
        "PAYLOAD_PASSWORD": "your-password",
        "DEBUG": "true"
      }
    }
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Ensure `npm run build` passes
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: This README covers all current functionality
- **Debug Logs**: Enable `DEBUG=true` for detailed operation logs
- **Issues**: Open GitHub issues for bugs or feature requests
- **PayloadCMS Docs**: Refer to PayloadCMS documentation for project setup

---

**🎯 Recommended Workflow (v3.0)**: Use `bootstrap-refactored` for advanced content creation with dependency resolution and context management. For simpler scenarios, the traditional `prepare-content` + `populate-content` workflow remains fully supported.

**🚀 New in v3.0**: Context-managed multi-step operations with smart dependency resolution and 8-call limit protection for robust content generation.