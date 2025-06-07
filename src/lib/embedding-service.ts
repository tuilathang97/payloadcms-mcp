
export interface EmbeddingResponse {
  embedding: number[]
  tokens: number
}

export class EmbeddingService {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env['OPENAI_API_KEY'] || ''
    this.baseUrl = 'https://api.openai.com/v1'
    
    if (!this.apiKey) {
      console.warn('OpenAI API key not found. Embedding features will be disabled.')
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    if (!this.apiKey) {
      // Return zero vector if no API key
      return { embedding: new Array(384).fill(0), tokens: 0 }
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small', // 1536 dimensions, but we'll truncate to 384
          input: text,
          dimensions: 384, // Reduce dimensions for better performance
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json() as any
      
      return {
        embedding: data.data[0].embedding,
        tokens: data.usage.total_tokens,
      }
    } catch (error) {
      console.error('Failed to generate embedding:', error)
      // Return zero vector as fallback
      return { embedding: new Array(384).fill(0), tokens: 0 }
    }
  }

  /**
   * Generate embedding for a schema object
   * Creates a text representation including field names, types, and relationships
   */
  async generateSchemaEmbedding(schema: any): Promise<EmbeddingResponse> {
    const textRepresentation = this.schemaToText(schema)
    return this.generateEmbedding(textRepresentation)
  }

  private schemaToText(schema: any): string {
    const parts: string[] = []

    if (schema.slug) {
      parts.push(`Collection: ${schema.slug}`)
    }

    if (schema.labels) {
      parts.push(`Label: ${schema.labels.singular || schema.labels.plural}`)
    }

    if (schema.fieldSchema) {
      parts.push('Fields:')
      this.extractFieldsText(schema.fieldSchema, parts, 0)
    }

    if (schema.fields) {
      parts.push('Fields:')
      this.extractFieldsFromArray(schema.fields, parts, 0)
    }

    if (schema.availableBlocks) {
      parts.push(`Available blocks: ${schema.availableBlocks.join(', ')}`)
    }

    return parts.join(' ')
  }

  private extractFieldsText(fields: any, parts: string[], depth: number): void {
    const indent = '  '.repeat(depth)
    
    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      if (typeof fieldConfig === 'object' && fieldConfig !== null) {
        const config = fieldConfig as any
        parts.push(`${indent}${fieldName}: ${config.type || 'unknown'}${config.required ? ' (required)' : ''}`)
        
        if (config.relationTo) {
          parts.push(`${indent}  relates to: ${config.relationTo}`)
        }
        
        if (config.tabs) {
          for (const tab of config.tabs) {
            parts.push(`${indent}  tab: ${tab.label}`)
            if (tab.fields) {
              this.extractFieldsText(tab.fields, parts, depth + 2)
            }
          }
        }
        
        if (config.blocks) {
          parts.push(`${indent}  available blocks: ${config.blocks.join(', ')}`)
        }
      }
    }
  }

  private extractFieldsFromArray(fields: any[], parts: string[], depth: number): void {
    const indent = '  '.repeat(depth)
    
    for (const field of fields) {
      parts.push(`${indent}${field.name}: ${field.type}${field.required ? ' (required)' : ''}`)
      
      if (field.relationTo) {
        parts.push(`${indent}  relates to: ${field.relationTo}`)
      }
      
      if (field.tabs) {
        for (const tab of field.tabs) {
          parts.push(`${indent}  tab: ${tab.label}`)
          if (tab.fields) {
            this.extractFieldsFromArray(tab.fields, parts, depth + 2)
          }
        }
      }
      
      if (field.blocks) {
        const blockNames = field.blocks.map((b: any) => b.slug || b.name || 'unknown').join(', ')
        parts.push(`${indent}  available blocks: ${blockNames}`)
      }
    }
  }
}

// Singleton instance
let embeddingService: EmbeddingService | null = null

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService()
  }
  return embeddingService
}