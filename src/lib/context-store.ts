import { Pool } from 'pg'

export interface ContextEntry {
  id: string
  project_path: string
  config_hash: string
  collection_name?: string | undefined
  block_type?: string | undefined
  schema_data: any
  embedding: number[]
  created_at: Date
  expires_at: Date
}

export interface ContextQuery {
  projectPath: string
  collections?: string[] | undefined
  blockTypes?: string[] | undefined
  limit?: number
}

export class ContextStore {
  private pool: Pool
  private initialized = false

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await this.pool.query('SELECT 1')
      await this.createTables()
      this.initialized = true
      console.log('Context store initialized successfully')
    } catch (error) {
      console.error('Failed to initialize context store:', error)
      throw error
    }
  }

  private async createTables(): Promise<void> {
    const createTableSQL = `
      CREATE EXTENSION IF NOT EXISTS vector;
      
      CREATE TABLE IF NOT EXISTS context_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_path TEXT NOT NULL,
        config_hash TEXT NOT NULL,
        collection_name TEXT,
        block_type TEXT,
        schema_data JSONB NOT NULL,
        embedding vector(384), -- Using sentence-transformers embedding size
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
        
        -- Indexes for efficient querying
        UNIQUE(project_path, config_hash, collection_name, block_type)
      );

      CREATE INDEX IF NOT EXISTS idx_context_project_path ON context_cache(project_path);
      CREATE INDEX IF NOT EXISTS idx_context_config_hash ON context_cache(config_hash);
      CREATE INDEX IF NOT EXISTS idx_context_collection ON context_cache(collection_name);
      CREATE INDEX IF NOT EXISTS idx_context_block_type ON context_cache(block_type);
      CREATE INDEX IF NOT EXISTS idx_context_expires_at ON context_cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_context_embedding ON context_cache USING ivfflat (embedding vector_cosine_ops);

      -- Clean up expired entries
      CREATE OR REPLACE FUNCTION cleanup_expired_context() RETURNS void AS $$
      BEGIN
        DELETE FROM context_cache WHERE expires_at < NOW();
      END;
      $$ LANGUAGE plpgsql;
    `

    await this.pool.query(createTableSQL)
  }

  async storeContext(entry: Omit<ContextEntry, 'id' | 'created_at' | 'expires_at'>): Promise<string> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const result = await this.pool.query(
      `INSERT INTO context_cache 
       (project_path, config_hash, collection_name, block_type, schema_data, embedding, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (project_path, config_hash, collection_name, block_type) 
       DO UPDATE SET 
         schema_data = EXCLUDED.schema_data,
         embedding = EXCLUDED.embedding,
         expires_at = EXCLUDED.expires_at
       RETURNING id`,
      [
        entry.project_path,
        entry.config_hash,
        entry.collection_name,
        entry.block_type,
        entry.schema_data,
        `[${entry.embedding.join(',')}]`,
        expiresAt
      ]
    )

    return result.rows[0].id
  }

  async getContext(query: ContextQuery): Promise<ContextEntry[]> {
    let sql = `
      SELECT * FROM context_cache 
      WHERE project_path = $1 
      AND expires_at > NOW()
    `
    const params: any[] = [query.projectPath]

    if (query.collections?.length) {
      sql += ` AND collection_name = ANY($${params.length + 1})`
      params.push(query.collections)
    }

    if (query.blockTypes?.length) {
      sql += ` AND block_type = ANY($${params.length + 1})`
      params.push(query.blockTypes)
    }

    sql += ` ORDER BY created_at DESC`

    if (query.limit) {
      sql += ` LIMIT $${params.length + 1}`
      params.push(query.limit)
    }

    const result = await this.pool.query(sql, params)
    return result.rows
  }

  async findSimilarContext(
    projectPath: string,
    embedding: number[],
    similarity: number = 0.8,
    limit: number = 10
  ): Promise<ContextEntry[]> {
    const result = await this.pool.query(
      `SELECT *, 1 - (embedding <=> $2) as similarity
       FROM context_cache 
       WHERE project_path = $1 
       AND expires_at > NOW()
       AND 1 - (embedding <=> $2) > $3
       ORDER BY similarity DESC
       LIMIT $4`,
      [projectPath, `[${embedding.join(',')}]`, similarity, limit]
    )

    return result.rows
  }

  async invalidateProject(projectPath: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM context_cache WHERE project_path = $1',
      [projectPath]
    )
    console.log(`Invalidated context cache for project: ${projectPath}`)
  }

  async cleanupExpired(): Promise<void> {
    await this.pool.query('SELECT cleanup_expired_context()')
    console.log('Cleaned up expired context entries')
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

// Singleton instance
let contextStore: ContextStore | null = null

export function getContextStore(): ContextStore {
  if (!contextStore) {
    const connectionString = process.env['POSTGRES_URL'] || process.env['DATABASE_URL']
    if (!connectionString) {
      throw new Error('POSTGRES_URL or DATABASE_URL environment variable is required')
    }
    contextStore = new ContextStore(connectionString)
  }
  return contextStore
}