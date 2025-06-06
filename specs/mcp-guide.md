# PayloadCMS MCP Adaptation Guide

## Overview
This guide helps you adapt your PayloadCMS MCP functions to work correctly with your specific PayloadCMS configuration.

## Key Issues Found & Solutions

### 1. Block Type Mismatches
**Issue**: Using incorrect block slugs (e.g., `"button"` instead of `"buttonBlock"`)

**Solution**: Always use the exact `slug` from block configurations.

### 2. Field Structure Mismatches
**Issue**: Using simplified field structures that don't match the actual PayloadCMS field definitions.

**Solution**: Inspect actual field configurations and use exact structure.

## Files to Inspect for Field Structures

### A. Block Configurations
1. **Location**: `src/blocks/[BlockName]/config.ts`
2. **Key Properties to Extract**:
   ```typescript
   export const BlockName: Block = {
     slug: 'actualSlugName', // Use this in blockType
     fields: [...] // Extract field structure from here
   }
   ```

### B. Collection Configurations
1. **Location**: `src/collections/[CollectionName]/index.ts`
2. **Key Properties**:
   ```typescript
   export const CollectionName: CollectionConfig = {
     slug: 'collectionSlug', // Collection identifier
     fields: [...] // Field definitions
   }
   ```

### C. Field Type Configurations
1. **Common Fields**: `src/fields/`
   - `link.ts` - Link field structure
   - `slug.ts` - Slug field structure
   - `layoutPicker.ts` - Layout picker options
   - `richtextField.ts` - Rich text structure

## Block Structure Analysis Template

For each block, create this analysis:

```typescript
// Block: HeroSections (example)
{
  slug: 'heroSections', // Use this as blockType
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            // Extract each field structure
            'title': 'textarea',
            'description': 'richtext',
            'ctaButtons': {
              type: 'blocks',
              blocks: ['buttonBlock'], // Note: uses buttonBlock, not button
              maxRows: 2
            }
          ]
        }
      ]
    }
  ]
}
```

## MCP Function Requirements

### Input Structure Function
```typescript
function getBlockFieldStructure(blockSlug: string, collectionSlug: string) {
  // 1. Read block config file: src/blocks/{BlockName}/config.ts
  // 2. Extract field structure from fields array
  // 3. Handle nested fields (tabs, groups, blocks)
  // 4. Return structured field map with types and options

  return {
    blockType: blockSlug,
    fields: {
      // Map of field names to their configurations
      title: { type: 'textarea', required: false },
      description: { type: 'richtext', required: false },
      ctaButtons: {
        type: 'blocks',
        blocks: ['buttonBlock'],
        maxRows: 2,
        fields: getButtonBlockStructure()
      }
    }
  }
}
```

### Output Structure Function
```typescript
function generateBlockSampleData(blockSlug: string, fieldStructure: any) {
  // 1. Use exact blockType from slug
  // 2. Generate data matching field types
  // 3. Handle nested blocks recursively
  // 4. Use valid options from select/radio fields

  return {
    blockType: blockSlug, // Exact slug from config
    // ... other fields based on structure
  }
}
```

## Steps to Adapt Your MCP Functions

### Step 1: Create Field Structure Parser
1. **Parse Block Configs**: Read all block config files and extract field structures
2. **Parse Collection Configs**: Extract collection field structures
3. **Handle Field Types**:
   - `blocks`: Need to recursively get sub-block structures
   - `select/radio`: Extract valid options
   - `group`: Handle nested field structures
   - `tabs`: Handle tabbed field groups

### Step 2: Create Sample Data Generators
1. **Block-Specific Generators**: Create generators for each block type
2. **Field Type Handlers**: Create handlers for each field type
3. **Validation**: Ensure generated data matches field constraints

### Step 3: Update MCP Functions
1. **Use Structure Parser**: Update `createBlockSampleContent` to use actual field structures
2. **Generate Valid Data**: Update `createCollectionSampleContent` to generate valid sample data
3. **Handle Relationships**: Properly handle relational fields

## Common Field Structures Found

### ButtonBlock Structure
```json
{
  "blockType": "buttonBlock",
  "sizeOptionFive": "lg", // xs, md, lg, xl, 2xl
  "description": "Button Text",
  "link": {
    "type": "custom", // or "reference"
    "url": "/path",
    "label": "Button Label",
    "newTab": false
  },
  "layout": "Primary buttons" // Must match buttonLayouts options
}
```

### Rich Text Field Structure
```json
{
  "description": {
    "root": {
      "type": "root",
      "children": [
        {
          "type": "paragraph",
          "children": [
            {
              "type": "text",
              "text": "Your content here"
            }
          ]
        }
      ]
    }
  }
}
```

### Link Field Structure
```json
{
  "link": {
    "type": "custom", // or "reference"
    "url": "/custom-url", // for custom type
    "reference": "pageId", // for reference type
    "label": "Link Text",
    "newTab": false
  }
}
```

## Testing Strategy

1. **Unit Test Each Block**: Generate sample data for each block individually
2. **Integration Test**: Create full pages with multiple blocks
3. **Validation Test**: Ensure all generated data passes PayloadCMS validation
4. **API Test**: Test direct population via PayloadCMS API

## Example: Fixed HeroSections Sample

See `hero-page-sample.json` for a working example that:
- Uses correct `blockType: "heroSections"`
- Uses correct `blockType: "buttonBlock"` for CTA buttons
- Includes proper rich text structure
- Uses valid layout options from configurations

## Next Steps

1. Implement field structure parser for your MCP
2. Update sample data generators to use actual field structures
3. Test with each block type in your configuration
4. Add validation to ensure generated data matches field constraints
5. Handle edge cases (conditional fields, required fields, etc.)
