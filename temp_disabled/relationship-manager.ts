import { faker } from '@faker-js/faker';
import { PayloadCMSClient } from './payload-client.js';
import { ContentGenerator } from './content-generator.js';
import { PayloadField, PayloadCollection } from './config-parser.js';

// Type aliases for compatibility
type FieldConfig = PayloadField;
type CollectionConfig = PayloadCollection;

export interface RelationshipDependency {
  collection: string;
  field: string;
  required: boolean;
  hasMany: boolean;
  count?: number;
}

export interface RelationshipPlan {
  dependencies: RelationshipDependency[];
  creationOrder: string[];
  fieldMappings: Map<string, string[]>;
}

export interface CreateRelationalContentOptions {
  targetCollection: string;
  count?: number;
  createDependencies?: boolean;
  dependencyDepth?: number;
  locale?: string;
}

export interface RelationalContentResult {
  created: Record<string, any[]>;
  relationships: Record<string, string[]>;
  errors: Array<{ collection: string; error: string }>;
}

export class RelationshipManager {
  private payloadClient: PayloadCMSClient;
  private contentGenerator: ContentGenerator;
  private createdContentCache = new Map<string, any[]>();

  constructor(payloadClient: PayloadCMSClient, contentGenerator: ContentGenerator) {
    this.payloadClient = payloadClient;
    this.contentGenerator = contentGenerator;
  }

  /**
   * Create relational content with all dependencies
   */
  async createRelationalContent(
    options: CreateRelationalContentOptions
  ): Promise<RelationalContentResult> {
    const {
      targetCollection,
      count = 1,
      createDependencies = true,
      dependencyDepth = 3
    } = options;

    const result: RelationalContentResult = {
      created: {},
      relationships: {},
      errors: []
    };

    try {
      // Clear cache for this operation
      this.createdContentCache.clear();

      // Get collection configuration
      const collectionConfig = await this.payloadClient.getCollectionConfig(targetCollection);
      if (!collectionConfig) {
        throw new Error(`Collection "${targetCollection}" not found`);
      }

      // Analyze dependencies
      const relationshipPlan = this.analyzeRelationships(collectionConfig, dependencyDepth);
      
      if (createDependencies) {
        // Create dependencies first
        await this.createDependencies(relationshipPlan, result);
      }

      // Create main collection documents
      const mainDocuments = await this.createCollectionDocuments(
        targetCollection,
        collectionConfig,
        count,
        relationshipPlan,
        result
      );

      result.created[targetCollection] = mainDocuments;

      return result;
    } catch (error) {
      result.errors.push({
        collection: targetCollection,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return result;
    }
  }

  /**
   * Analyze relationship dependencies for a collection
   */
  private analyzeRelationships(
    collectionConfig: CollectionConfig,
    maxDepth: number,
    visited = new Set<string>(),
    currentDepth = 0
  ): RelationshipPlan {
    const plan: RelationshipPlan = {
      dependencies: [],
      creationOrder: [],
      fieldMappings: new Map()
    };

    if (currentDepth >= maxDepth || visited.has(collectionConfig.slug)) {
      return plan;
    }

    visited.add(collectionConfig.slug);

    // Extract relationships from fields
    this.extractRelationshipsFromFields(
      collectionConfig.fields,
      collectionConfig.slug,
      plan,
      visited,
      maxDepth,
      currentDepth
    );

    // Build creation order (dependencies first)
    const allCollections = new Set([
      ...plan.dependencies.map(d => d.collection),
      collectionConfig.slug
    ]);

    // Simple topological sort
    plan.creationOrder = this.topologicalSort(Array.from(allCollections), plan.dependencies);

    return plan;
  }

  /**
   * Extract relationships from field configurations
   */
  private extractRelationshipsFromFields(
    fields: FieldConfig[],
    parentCollection: string,
    plan: RelationshipPlan,
    visited: Set<string>,
    maxDepth: number,
    currentDepth: number
  ): void {
    for (const field of fields) {
      switch (field.type.toLowerCase()) {
        case 'relationship':
          if (field.relationTo) {
            const dependency: RelationshipDependency = {
              collection: field.relationTo,
              field: field.name,
              required: field.required || false,
              hasMany: field.hasMany || false,
              count: field.hasMany ? faker.number.int({ min: 1, max: 3 }) : 1
            };

            plan.dependencies.push(dependency);

            // Map which fields need this relationship
            if (!plan.fieldMappings.has(field.relationTo)) {
              plan.fieldMappings.set(field.relationTo, []);
            }
            plan.fieldMappings.get(field.relationTo)!.push(`${parentCollection}.${field.name}`);
          }
          break;

        case 'blocks':
          if (field.blocks) {
            for (const blockConfig of field.blocks) {
              this.extractRelationshipsFromFields(
                blockConfig.fields,
                parentCollection,
                plan,
                visited,
                maxDepth,
                currentDepth
              );
            }
          }
          break;

        case 'array':
        case 'group':
        case 'tabs':
        case 'row':
        case 'collapsible':
          if (field.fields) {
            this.extractRelationshipsFromFields(
              field.fields,
              parentCollection,
              plan,
              visited,
              maxDepth,
              currentDepth
            );
          }
          break;
      }
    }
  }

  /**
   * Simple topological sort for dependency order
   */
  private topologicalSort(collections: string[], dependencies: RelationshipDependency[]): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize graph
    for (const collection of collections) {
      graph.set(collection, []);
      inDegree.set(collection, 0);
    }

    // Build dependency graph
    for (const dep of dependencies) {
      if (graph.has(dep.collection)) {
        const dependents = graph.get(dep.collection) || [];
        // Find which collection depends on this one
        const dependent = collections.find(c => 
          dependencies.some(d => d.collection === dep.collection && d.field.includes(c))
        );
        
        if (dependent && dependent !== dep.collection) {
          dependents.push(dependent);
          inDegree.set(dependent, (inDegree.get(dependent) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    // Start with nodes having no dependencies
    for (const [collection, degree] of inDegree) {
      if (degree === 0) {
        queue.push(collection);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Create dependency collections
   */
  private async createDependencies(
    plan: RelationshipPlan,
    result: RelationalContentResult
  ): Promise<void> {
    const dependencyCollections = plan.dependencies.map(d => d.collection);
    const uniqueDependencies = Array.from(new Set(dependencyCollections));

    for (const collection of uniqueDependencies) {
      if (plan.creationOrder.includes(collection)) {
        try {
          const collectionConfig = await this.payloadClient.getCollectionConfig(collection);
          if (!collectionConfig) {
            result.errors.push({
              collection,
              error: `Collection configuration not found`
            });
            continue;
          }

          // Determine how many to create
          const relevantDeps = plan.dependencies.filter(d => d.collection === collection);
          const maxCount = Math.max(...relevantDeps.map(d => d.count || 1));
          const count = Math.min(maxCount, 5); // Limit to reasonable number

          const documents = await this.createCollectionDocuments(
            collection,
            collectionConfig,
            count,
            plan,
            result
          );

          result.created[collection] = documents;
          this.createdContentCache.set(collection, documents);

        } catch (error) {
          result.errors.push({
            collection,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }

  /**
   * Create documents for a specific collection
   */
  private async createCollectionDocuments(
    collectionSlug: string,
    collectionConfig: CollectionConfig,
    count: number,
    plan: RelationshipPlan,
    result: RelationalContentResult
  ): Promise<any[]> {
    const documents: any[] = [];

    for (let i = 0; i < count; i++) {
      try {
        // Generate base sample content
        const samples = await this.contentGenerator.generateCollectionSampleContent(
          collectionConfig,
          { count: 1, includeOptional: true }
        );

        let document = samples[0];

        // Add contextual content
        const contextualContent = this.contentGenerator.generateContextualContent(collectionSlug);
        document = { ...document, ...contextualContent };

        // Resolve relationships
        document = await this.resolveRelationships(document, collectionConfig, plan);

        // Create the document
        const createdDocument = await this.payloadClient.create(collectionSlug, document);
        documents.push(createdDocument);

        // Track relationships
        this.trackRelationships(createdDocument, collectionSlug, result);

      } catch (error) {
        result.errors.push({
          collection: collectionSlug,
          error: `Failed to create document ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return documents;
  }

  /**
   * Resolve relationship fields with actual document IDs
   */
  private async resolveRelationships(
    document: Record<string, any>,
    collectionConfig: CollectionConfig,
    plan: RelationshipPlan
  ): Promise<Record<string, any>> {
    const resolved = { ...document };

    await this.resolveFieldRelationships(resolved, collectionConfig.fields, plan);

    return resolved;
  }

  /**
   * Recursively resolve relationships in fields
   */
  private async resolveFieldRelationships(
    data: Record<string, any>,
    fields: FieldConfig[],
    plan: RelationshipPlan
  ): Promise<void> {
    for (const field of fields) {
      if (data[field.name] === undefined) continue;

      switch (field.type.toLowerCase()) {
        case 'relationship':
          if (field.relationTo) {
            const relatedDocuments = this.createdContentCache.get(field.relationTo) || [];
            
            if (relatedDocuments.length > 0) {
              if (field.hasMany) {
                const count = faker.number.int({ min: 1, max: Math.min(3, relatedDocuments.length) });
                data[field.name] = faker.helpers.arrayElements(relatedDocuments, count)
                  .map(doc => doc.id);
              } else {
                data[field.name] = faker.helpers.arrayElement(relatedDocuments).id;
              }
            }
          }
          break;

        case 'blocks':
          if (Array.isArray(data[field.name]) && field.blocks) {
            for (const blockData of data[field.name]) {
              const blockConfig = field.blocks.find(b => b.slug === blockData.blockType);
              if (blockConfig) {
                await this.resolveFieldRelationships(blockData, blockConfig.fields, plan);
              }
            }
          }
          break;

        case 'array':
          if (Array.isArray(data[field.name]) && field.fields) {
            for (const itemData of data[field.name]) {
              if (typeof itemData === 'object' && itemData !== null) {
                await this.resolveFieldRelationships(itemData, field.fields, plan);
              }
            }
          }
          break;

        case 'group':
        case 'tabs':
        case 'row':
        case 'collapsible':
          if (typeof data[field.name] === 'object' && data[field.name] !== null && field.fields) {
            await this.resolveFieldRelationships(data[field.name], field.fields, plan);
          }
          break;
      }
    }
  }

  /**
   * Track created relationships for reporting
   */
  private trackRelationships(
    document: any,
    collectionSlug: string,
    result: RelationalContentResult
  ): void {
    if (!result.relationships[collectionSlug]) {
      result.relationships[collectionSlug] = [];
    }

    if (document.id) {
      result.relationships[collectionSlug].push(document.id);
    }
  }

  /**
   * Create specific relationship types (contacts, images, CTAs)
   */
  async createSpecificRelationships(
    types: ('contacts' | 'images' | 'ctas')[],
    count = 3
  ): Promise<RelationalContentResult> {
    const result: RelationalContentResult = {
      created: {},
      relationships: {},
      errors: []
    };

    for (const type of types) {
      try {
        switch (type) {
          case 'contacts':
            result.created['contacts'] = await this.createContacts(count);
            break;
          case 'images':
            result.created['images'] = await this.createImages(count);
            break;
          case 'ctas':
            result.created['ctas'] = await this.createCTAs(count);
            break;
        }
      } catch (error) {
        result.errors.push({
          collection: type,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  /**
   * Create sample contact documents
   */
  private async createContacts(count: number): Promise<any[]> {
    const contacts: any[] = [];

    for (let i = 0; i < count; i++) {
      const contact = {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        company: faker.company.name(),
        position: faker.person.jobTitle(),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          zipCode: faker.location.zipCode(),
          country: faker.location.country()
        },
        socialMedia: {
          linkedin: faker.internet.url(),
          twitter: `@${faker.internet.userName()}`,
          website: faker.internet.url()
        },
        notes: faker.lorem.paragraph()
      };

      try {
        const created = await this.payloadClient.create('contacts', contact);
        contacts.push(created);
      } catch (error) {
        // If contacts collection doesn't exist, create generic data
        contacts.push({ ...contact, id: faker.string.alphanumeric(24) });
      }
    }

    return contacts;
  }

  /**
   * Create sample image/media documents
   */
  private async createImages(count: number): Promise<any[]> {
    const images: any[] = [];

    for (let i = 0; i < count; i++) {
      const image = {
        filename: `sample-image-${i + 1}.jpg`,
        alt: faker.lorem.sentence({ min: 3, max: 8 }),
        caption: faker.lorem.paragraph(1),
        width: faker.number.int({ min: 800, max: 1920 }),
        height: faker.number.int({ min: 600, max: 1080 }),
        mimeType: 'image/jpeg',
        filesize: faker.number.int({ min: 50000, max: 2000000 }),
        url: `https://picsum.photos/800/600?random=${i}`,
        focalPoint: {
          x: faker.number.float({ min: 0, max: 100 }),
          y: faker.number.float({ min: 0, max: 100 })
        }
      };

      try {
        const created = await this.payloadClient.create('media', image);
        images.push(created);
      } catch (error) {
        // If media collection doesn't exist, create generic data
        images.push({ ...image, id: faker.string.alphanumeric(24) });
      }
    }

    return images;
  }

  /**
   * Create sample CTA/link documents
   */
  private async createCTAs(count: number): Promise<any[]> {
    const ctas: any[] = [];

    const ctaTypes = ['primary', 'secondary', 'tertiary', 'link'];
    const ctaTexts = [
      'Learn More',
      'Get Started',
      'Contact Us',
      'Download Now',
      'Sign Up',
      'View Details',
      'Try Free',
      'Shop Now'
    ];

    for (let i = 0; i < count; i++) {
      const cta = {
        text: faker.helpers.arrayElement(ctaTexts),
        url: faker.internet.url(),
        type: faker.helpers.arrayElement(ctaTypes),
        openInNewTab: faker.datatype.boolean(),
        ariaLabel: faker.lorem.sentence({ min: 2, max: 5 }),
        icon: faker.helpers.arrayElement(['arrow-right', 'download', 'external-link', 'mail']),
        style: {
          variant: faker.helpers.arrayElement(['solid', 'outline', 'ghost']),
          size: faker.helpers.arrayElement(['sm', 'md', 'lg']),
          color: faker.helpers.arrayElement(['primary', 'secondary', 'success', 'warning', 'danger'])
        }
      };

      try {
        const created = await this.payloadClient.create('ctas', cta);
        ctas.push(created);
      } catch (error) {
        // If ctas collection doesn't exist, create generic data
        ctas.push({ ...cta, id: faker.string.alphanumeric(24) });
      }
    }

    return ctas;
  }

  /**
   * Clear the content cache
   */
  clearCache(): void {
    this.createdContentCache.clear();
  }

  /**
   * Get cached content for a collection
   */
  getCachedContent(collection: string): any[] {
    return this.createdContentCache.get(collection) || [];
  }
} 