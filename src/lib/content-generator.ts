import { PayloadField, PayloadBlock, PayloadCollection } from './config-parser.js';
// import { LexicalGenerator } from './lexical-generator.js';

export class ContentGenerator {
  // private lexicalGenerator: LexicalGenerator;

  constructor() {
    // this.lexicalGenerator = new LexicalGenerator();
  }

  /**
   * Generate sample content for a collection based on its field structure
   */
  public generateCollectionSampleContent(collection: PayloadCollection, count: number = 1): any[] {
    const results: any[] = [];

    for (let i = 0; i < count; i++) {
      const sampleData = this.generateFieldsData(collection.fields, {
        context: 'collection',
        collectionSlug: collection.slug,
        index: i
      });
      results.push(sampleData);
    }

    return results;
  }

  /**
   * Generate sample content for a block based on its field structure
   */
  public generateBlockSampleContent(block: PayloadBlock, count: number = 1): any[] {
    const results: any[] = [];

    for (let i = 0; i < count; i++) {
      const sampleData = this.generateFieldsData(block.fields, {
        context: 'block',
        blockSlug: block.slug,
        index: i
      });
      
      // Add blockType for blocks
      results.push({
        blockType: block.slug,
        ...sampleData
      });
    }

    return results;
  }

  /**
   * Generate data for an array of fields
   */
  private generateFieldsData(fields: PayloadField[], context: any = {}): any {
    const data: any = {};

    for (const field of fields) {
      if (field.name) {
        const fieldValue = this.generateFieldValue(field, context);
        if (fieldValue !== undefined) {
          data[field.name] = fieldValue;
        }
      } else if (field.type === 'tabs' && field.tabs) {
        // Handle tabs - merge all tab fields into the main object
        for (const tab of field.tabs) {
          const tabData = this.generateFieldsData(tab.fields, context);
          Object.assign(data, tabData);
        }
      }
    }

    return data;
  }

  /**
   * Generate value for a specific field based on its type and configuration
   */
  private generateFieldValue(field: PayloadField, context: any = {}): any {
    switch (field.type) {
      case 'text':
        return this.generateTextValue(field, context);
      
      case 'textarea':
        return this.generateTextareaValue(field, context);
      
      case 'richText':
        return this.generateRichTextValue(field, context);
      
      case 'email':
        return this.generateEmailValue(field, context);
      
      case 'number':
        return this.generateNumberValue(field, context);
      
      case 'date':
        return this.generateDateValue(field, context);
      
      case 'checkbox':
        return this.generateCheckboxValue(field, context);
      
      case 'select':
        return this.generateSelectValue(field, context);
      
      case 'radio':
        return this.generateRadioValue(field, context);
      
      case 'relationship':
        return this.generateRelationshipValue(field, context);
      
      case 'upload':
        return this.generateUploadValue(field, context);
      
      case 'blocks':
        return this.generateBlocksValue(field, context);
      
      case 'array':
        return this.generateArrayValue(field, context);
      
      case 'group':
        return this.generateGroupValue(field, context);
      
      case 'tabs':
        return this.generateTabsValue(field, context);
      
      case 'row':
      case 'collapsible':
        return this.generateLayoutValue(field, context);
      
      case 'code':
        return this.generateCodeValue(field, context);
      
      case 'json':
        return this.generateJsonValue(field, context);
      
      case 'point':
        return this.generatePointValue(field, context);
      
      default:
        console.warn(`Unknown field type: ${field.type}`);
        return undefined;
    }
  }

  private generateTextValue(field: PayloadField, context: any): string {
    const baseName = field.name || 'text';
    const samples = [
      `Sample ${baseName}`,
      `Example ${baseName}`,
      `Demo ${baseName}`,
      `Test ${baseName}`,
      `${baseName} content`
    ];
    
    const index = context.index || 0;
    return samples[index % samples.length] + (index > 0 ? ` ${index + 1}` : '');
  }

  private generateTextareaValue(field: PayloadField, _context: any): string {
    const baseName = field.name || 'content';
    return `This is a longer ${baseName} that might span multiple lines. It provides more detailed information and can include various details about the topic.`;
  }

  private generateRichTextValue(field: PayloadField, context: any): any {
    const textContent = this.generateTextareaValue(field, context);
    // Simple rich text object structure for PayloadCMS
    return {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: textContent
              }
            ]
          }
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1
      }
    };
  }

  private generateEmailValue(_field: PayloadField, context: any): string {
    const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
    const names = ['user', 'demo', 'test', 'sample', 'admin'];
    
    const index = context.index || 0;
    const name = names[index % names.length];
    const domain = domains[index % domains.length];
    
    return `${name}${index > 0 ? index + 1 : ''}@${domain}`;
  }

  private generateNumberValue(field: PayloadField, _context: any): number {
    const min = field['min'] || 1;
    const max = field['max'] || 100;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generateDateValue(_field: PayloadField, context: any): string {
    const now = new Date();
    const daysOffset = (context.index || 0) * 7; // Week intervals
    const date = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return date.toISOString();
  }

  private generateCheckboxValue(_field: PayloadField, _context: any): boolean {
    return Math.random() > 0.5;
  }

  private generateSelectValue(field: PayloadField, context: any): any {
    if (!field.options || field.options.length === 0) {
      return null;
    }

    const index = context.index || 0;
    const option = field.options[index % field.options.length];
    
    if (typeof option === 'object' && option.value !== undefined) {
      return option.value;
    }
    
    return option;
  }

  private generateRadioValue(field: PayloadField, context: any): any {
    return this.generateSelectValue(field, context);
  }

  private generateRelationshipValue(field: PayloadField, context: any): any {
    // For now, return placeholder IDs
    // In a real implementation, this would create or reference actual documents
    if (field.hasMany) {
      const count = Math.min(3, Math.max(1, field.maxRows || 3));
      return Array.from({ length: count }, (_, i) => `placeholder-id-${i + 1}`);
    }
    
    return 'placeholder-id-1';
  }

  private generateUploadValue(field: PayloadField, context: any): any {
    // Return placeholder media ID
    // In a real implementation, this would reference actual media documents
    return 'placeholder-media-id';
  }

  private generateBlocksValue(field: PayloadField, context: any): any[] {
    if (!field.blocks || field.blocks.length === 0) {
      return [];
    }

    const maxRows = field.maxRows || 3;
    const minRows = field.minRows || 1;
    const count = Math.min(maxRows, Math.max(minRows, Math.floor(Math.random() * 3) + 1));
    
    const blocks: any[] = [];
    
    for (let i = 0; i < count; i++) {
      const blockSlug = field.blocks[i % field.blocks.length];
      
      // This would need the actual block configuration to generate proper data
      // For now, return a basic structure
      blocks.push({
        blockType: blockSlug,
        id: `block-${Date.now()}-${i}`
      });
    }
    
    return blocks;
  }

  private generateArrayValue(field: PayloadField, context: any): any[] {
    if (!field.fields) {
      return [];
    }

    const maxRows = field.maxRows || 3;
    const minRows = field.minRows || 1;
    const count = Math.min(maxRows, Math.max(minRows, Math.floor(Math.random() * 3) + 1));
    
    const items: any[] = [];
    
    for (let i = 0; i < count; i++) {
      const itemData = this.generateFieldsData(field.fields, {
        ...context,
        arrayIndex: i
      });
      items.push(itemData);
    }
    
    return items;
  }

  private generateGroupValue(field: PayloadField, context: any): any {
    if (!field.fields) {
      return {};
    }

    return this.generateFieldsData(field.fields, context);
  }

  private generateTabsValue(field: PayloadField, context: any): any {
    if (!field.tabs) {
      return {};
    }

    // Tabs merge their fields into the parent object
    const data: any = {};
    
    for (const tab of field.tabs) {
      const tabData = this.generateFieldsData(tab.fields, context);
      Object.assign(data, tabData);
    }
    
    return data;
  }

  private generateLayoutValue(field: PayloadField, context: any): any {
    if (!field.fields) {
      return {};
    }

    return this.generateFieldsData(field.fields, context);
  }

  private generateCodeValue(field: PayloadField, context: any): string {
    const languages = ['javascript', 'typescript', 'python', 'json'];
    const samples = {
      javascript: 'console.log("Hello, World!");',
      typescript: 'const message: string = "Hello, World!";',
      python: 'print("Hello, World!")',
      json: '{"message": "Hello, World!"}'
    };
    
    const language = field.admin?.language || 'javascript';
    return samples[language as keyof typeof samples] || samples.javascript;
  }

  private generateJsonValue(field: PayloadField, context: any): any {
    return {
      sampleKey: 'sampleValue',
      number: 42,
      boolean: true,
      array: [1, 2, 3],
      nested: {
        property: 'value'
      }
    };
  }

  private generatePointValue(field: PayloadField, context: any): [number, number] {
    // Generate random coordinates (longitude, latitude)
    const longitude = (Math.random() - 0.5) * 360;
    const latitude = (Math.random() - 0.5) * 180;
    return [longitude, latitude];
  }

  /**
   * Generate sample content for specific block types with enhanced data
   */
  public generateEnhancedBlockContent(blockSlug: string, fields: PayloadField[], context: any = {}): any {
    const baseData = this.generateFieldsData(fields, { ...context, blockSlug });
    
    // Add block-specific enhancements based on common patterns
    switch (blockSlug) {
      case 'heroSections':
      case 'hero':
        return this.enhanceHeroBlock(baseData, context);
      
      case 'buttonBlock':
      case 'button':
        return this.enhanceButtonBlock(baseData, context);
      
      case 'textBlock':
      case 'text':
        return this.enhanceTextBlock(baseData, context);
      
      case 'imageBlock':
      case 'image':
        return this.enhanceImageBlock(baseData, context);
      
      default:
        return baseData;
    }
  }

  private enhanceHeroBlock(data: any, context: any): any {
    return {
      ...data,
      title: data.title || 'Welcome to Our Amazing Platform',
      description: data.description || {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Discover the power of modern web development with our cutting-edge tools and services. Join thousands of developers who trust us for their projects.'
                }
              ]
            }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1
        }
      },
      backgroundImage: data.backgroundImage || 'hero-bg-placeholder',
    };
  }

  private enhanceButtonBlock(data: any, context: any): any {
    const buttonTexts = ['Get Started', 'Learn More', 'Contact Us', 'Sign Up', 'Download'];
    const index = context.index || 0;
    
    return {
      ...data,
      text: data.text || buttonTexts[index % buttonTexts.length],
      url: data.url || '/demo-url',
      variant: data.variant || 'primary',
      size: data.size || 'md',
    };
  }

  private enhanceTextBlock(data: any, context: any): any {
    return {
      ...data,
      content: data.content || {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'This is a sample text block with rich content. It can include various formatting options and provides a great way to present information to your users.'
                }
              ]
            }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1
        }
      },
    };
  }

  private enhanceImageBlock(data: any, context: any): any {
    return {
      ...data,
      image: data.image || 'sample-image-placeholder',
      alt: data.alt || 'Sample image description',
      caption: data.caption || 'This is a sample image caption',
    };
  }
} 