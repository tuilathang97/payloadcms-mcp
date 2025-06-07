# PayloadCMS MCP Server

A Model Context Protocol (MCP) server for PayloadCMS integration, providing intelligent content generation with automatic project discovery and advanced multi-step workflow.

> **Current Status**: ✅ Production ready with enhanced bootstrap tools  
> **Version**: 3.1.0 - Enhanced context management with PostgreSQL optimization  
> **Ready for**: Any PayloadCMS project structure

## Overview

This MCP server provides sophisticated content generation for PayloadCMS projects, with both immediate-use tools and optional PostgreSQL-powered enhancements for enterprise performance.

### Key Features

- 🎯 **Enhanced Multi-Step Bootstrap**: Context-aware workflow with intelligent dependency resolution
- 🚀 **Works Immediately**: No database setup required for basic functionality
- 💾 **Optional PostgreSQL Enhancement**: 100x faster context retrieval with semantic search
- 🧠 **Smart Dependency Analysis**: Automatically detects missing relationships
- 🧩 **Client-Agnostic Design**: Works with any PayloadCMS project structure
- 🎨 **Reusable Media Management**: Automatic placeholder image deduplication
- ✅ **User-Driven Content**: Accept real content instead of generated placeholders

## MCP Tools

### 🚀 `bootstrap-enhanced` ⭐ *Recommended*
Next-generation multi-step bootstrap with intelligent context management.

**Immediate Use (No Setup Required):**
- Smart template generation
- Dependency detection
- Multi-step workflow
- Works with any PayloadCMS project

**With PostgreSQL (Optional Enhancement):**
- Intelligent context caching
- Semantic search for similar contexts
- 100x faster repeated operations
- Advanced dependency resolution

**Usage:**
```json
{
  "step": "discover_config",
  "projectPath": "/path/to/your/payloadcms/project"
}
```

### 🔄 `bootstrap-refactored`
Advanced multi-step bootstrap with full dependency resolution (current production tool).

### 📋 `prepare-content`
Template preparation and structure analysis.

### 🏗️ `populate-content`  
Content population from prepared templates.

### 📊 `get-sample-contents`
Content export and URL generation.

## Quick Start

### 1. Basic Usage (Works Immediately)

```bash
# No setup required - works with any PayloadCMS project
npm install
npm run dev
```

Use `bootstrap-enhanced` tool with your PayloadCMS project path.

### 2. PostgreSQL Enhancement (Optional)

For enterprise performance and intelligent context caching:

```bash
# 1. Setup PostgreSQL with pgvector
docker run --name payloadcms-mcp \
  -e POSTGRES_DB=payloadcms_mcp \
  -e POSTGRES_USER=mcp_user \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  -d ankane/pgvector

# 2. Configure environment
POSTGRES_URL=postgresql://mcp_user:secure_password@localhost:5432/payloadcms_mcp
OPENAI_API_KEY=your-api-key-here  # Optional for semantic search

# 3. Enjoy enhanced performance
```

See `notes/enhanced-context-store-setup.md` for complete setup instructions.

## Environment Configuration

Required for your MCP client configuration:

```env
# PayloadCMS Connection (Required)
PAYLOAD_HOST=http://localhost:3000
PAYLOAD_USERNAME=admin@example.com
PAYLOAD_PASSWORD=your-password

# PostgreSQL Enhancement (Optional)
POSTGRES_URL=postgresql://user:pass@localhost:5432/payloadcms_mcp
OPENAI_API_KEY=your-openai-key  # Optional for semantic search
```

## Tool Migration Guide

### Current Recommendations

1. **New Projects**: Use `bootstrap-enhanced` 
   - Modern multi-step workflow
   - Intelligent dependency detection
   - Works immediately without setup

2. **Complex Existing Workflows**: Use `bootstrap-refactored`
   - Full dependency resolution
   - Advanced relationship handling
   - Production tested

3. **Specific Use Cases**: Traditional tools
   - `prepare-content` for template preparation
   - `populate-content` for content population
   - `get-sample-contents` for export

### Performance Comparison

| Tool | Setup Required | Context Retrieval | Dependency Resolution | Semantic Search |
|------|----------------|-------------------|----------------------|-----------------|
| `bootstrap-enhanced` (basic) | None | ~1-2s | Smart detection | No |
| `bootstrap-enhanced` (PostgreSQL) | PostgreSQL | ~100ms | Intelligent | Yes |
| `bootstrap-refactored` | None | ~2-3s | Full resolution | No |

## Architecture

### Client-Agnostic Design
- **No Hardcoded Schemas**: Dynamically discovers your PayloadCMS configuration
- **Universal Compatibility**: Works with any collection names, field structures, or block types
- **Automatic File Reading**: MCP server reads configuration files from your project filesystem
- **Progressive Context Gathering**: Multi-step approach for complex project structures

### Enhanced Context Management (PostgreSQL)
- **Chunked Storage**: Collections and blocks stored separately for optimal retrieval
- **Semantic Search**: OpenAI embeddings for intelligent context discovery
- **Automatic Caching**: Context cached with hash-based change detection
- **Performance Optimization**: Only loads relevant schema parts for specific operations

## Development

```bash
# Development mode
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Build for production
npm run build
```

## Documentation

- `notes/enhanced-context-store-setup.md` - Complete PostgreSQL setup guide
- `notes/webhook-cache-invalidation.md` - Cache invalidation strategies
- `IMPLEMENTATION_STATUS.md` - Current implementation status
- `CLAUDE.md` - Development guidelines and architecture

## License

MIT License - See LICENSE file for details.