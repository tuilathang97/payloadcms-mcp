# PayloadCMS MCP Server

A Model Context Protocol (MCP) server for PayloadCMS integration, providing intelligent content generation with automatic project discovery and two-phase workflow.

> **Current Status**: ✅ Fully functional with improved two-phase architecture  
> **Version**: 2.0.0 - Enhanced client interaction with prepare/populate workflow  
> **Ready for**: Production use with any PayloadCMS project structure

## Overview

This MCP server provides a sophisticated two-phase approach to PayloadCMS content generation, inspired by robust workflow patterns and designed for better client interaction and accuracy.

### Key Features

- 🎯 **Two-Phase Workflow**: Separate preparation and population phases for better client control
- 🔍 **Exact Config Mapping**: Uses actual slugs from config files (e.g., `featureSections` not `FeatureSections`)
- 🧩 **Client-Agnostic Design**: Works with any PayloadCMS project structure without hardcoded assumptions
- 📊 **Comprehensive Config Reading**: Automatically discovers and parses all collections, blocks, and globals
- ✅ **Client Review Process**: Client can review and modify prepared content before creation
- 🛡️ **Robust Error Handling**: Graceful degradation and detailed error reporting
- 📝 **Development Logging**: Comprehensive logging when `DEBUG=true` for troubleshooting

## Recent Major Improvements (v2.0.0)

### ✅ **Fixed Critical Issues**
- **Endless Loop Problem**: Resolved infinite context gathering loops that plagued v1.x
- **Slug Mismatch**: Now uses exact slugs from config files instead of transformed versions
- **Authentication Issues**: Fixed 403 errors with proper JWT token authentication
- **One-Shot Limitations**: Replaced problematic single-call approach with two-phase workflow

### 🚀 **Enhanced Architecture** 
- **Better Client Interaction**: Clients can now review configurations before content creation
- **Accurate Field Parsing**: Respects actual PayloadCMS field definitions from config files
- **Improved Error Recovery**: No more all-or-nothing failures
- **Development Logging**: Detailed logging system for debugging and monitoring

## MCP Tools

### **Phase 1: `prepare-content`** ⚡ *New & Recommended*
Reads all PayloadCMS configurations and returns structured data for client review. This is the foundation of the improved workflow.

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

### **Legacy Tools** (Still Available)

#### `bootstrap`
Generate essential business website pages with progressive context gathering. 

*Note: This tool now uses the improved authentication and config parsing from v2.0, but the two-phase approach (`prepare-content` + `populate-content`) is recommended for better control.*

#### `bootstrap-full`
Create comprehensive dataset with all discovered collections and block variations.

*Note: For comprehensive content creation, use `prepare-content` followed by `populate-content` with appropriate collection specifications.*

#### `get-sample-contents`
Retrieve and export all content URLs and metadata from a PayloadCMS project.

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

### 2. **Basic Two-Phase Workflow**

**Step 1: Prepare Content**
```bash
# Use your MCP client to call:
{
  "tool": "prepare-content",
  "projectPath": "/path/to/your/payloadcms/project"
}
```

**Step 2: Review & Populate**
```bash
# Review the prepared content, then call:
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

### 3. **Run the Server**
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
│   └── bootstrap-tools.ts      # Legacy tools (still functional)
├── lib/
│   ├── payload-client.ts       # ✅ Enhanced PayloadCMS API client with JWT auth
│   ├── context-gatherer.ts     # ✅ Fixed configuration discovery
│   ├── config-parser.ts        # ✅ Accurate config file parsing
│   ├── content-generator.ts    # Content generation utilities
│   └── relationship-manager.ts # Dependency resolution
└── utils/
    ├── logger.ts              # ⚡ New comprehensive logging system
    └── media-upload.ts        # Media handling utilities
```

## Project History & Evolution

### v2.0.0 - Two-Phase Architecture (Current)
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

**🎯 Recommended Workflow**: Always use `prepare-content` first, review the output, then use `populate-content` for the best experience and control over your PayloadCMS content generation.