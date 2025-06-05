import { payloadRequest } from "../payload";
import { createRelationalContent } from "./createRelationalContent";

export async function createBlockSampleContent({ blockConfig }: { blockConfig: any }) {
  /**
   * 1. Inspect the blockConfig to find its `fields` and any `relations`.
   * 2. Build a sample payload that covers every enum option and field type.
   */
  const sample: Record<string, any> = {};

  for (const field of blockConfig.fields) {
    if (field.type === "select") sample[field.name] = field.options[0].value;
    else if (field.type === "relationship") {
      const related = await createRelationalContent({ fieldConfig: field });
      sample[field.name] = related.id;
    } else {
      sample[field.name] = `Sample ${field.name}`;
    }
  }

  // Persist sample in its bound collection
  const collectionSlug = blockConfig.interfaceName;
  const created = await payloadRequest<any>(
    "post",
    `/${collectionSlug}`,
    sample
  );

  return created;
}
