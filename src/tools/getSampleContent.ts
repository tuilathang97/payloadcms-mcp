import { payloadRequest } from "../payload";

export async function getSampleContent() {
  // Fetch the list of collections first
  const { collections } = await payloadRequest<{ collections: string[] }>("get", "/");
  const all = {} as Record<string, any[]>;
  for (const slug of collections) {
    const docs = await payloadRequest<{ docs: any[] }>("get", `/${slug}`);
    all[slug] = docs.docs;
  }
  return all;
}
