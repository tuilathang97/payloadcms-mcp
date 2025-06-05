import { payloadRequest } from "../payload";
import { createBlockSampleContent } from "./createBlockSampleContent";

export async function createCollectionSampleContent({ collectionConfig }: { collectionConfig: any }) {
  const document: Record<string, any> = {};
  for (const block of collectionConfig.blocks) {
    const blockDoc = await createBlockSampleContent({ blockConfig: block });
    document[block.slug] = blockDoc.id;
  }
  return payloadRequest<any>("post", `/${collectionConfig.slug}`, document);
}
