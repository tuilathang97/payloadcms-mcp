import { payloadRequest } from "../payload";

export async function createRelationalContent({ fieldConfig }: { fieldConfig: any }) {
  if (fieldConfig.relationTo === "media") {
    // Example: upload a placeholder image
    const img = await payloadRequest<any>("post", "/media", {
      alt: "Sample image",
      // base64 or URL upload omitted for brevity
    });
    return img;
  }
  // For another collection
  const doc = await payloadRequest<any>("post", `/${fieldConfig.relationTo}`, {
    title: "Related document",
  });
  return doc;
}
