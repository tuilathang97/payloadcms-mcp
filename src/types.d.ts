export type BlockConfig = {
  fields: any[];
  interfaceName: string;
};

export type CollectionConfig = {
  slug: string;
  blocks: BlockConfig[];
};
