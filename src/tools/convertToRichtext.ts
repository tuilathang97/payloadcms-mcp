import { JSDOM } from "jsdom";
import { $generateNodesFromDOM } from "@lexical/html";

export function convertToRichtext({ htmlString }: { htmlString: string }) {
  // Headless Lexical editor context
  const dom = new JSDOM("<div id=\"root\"></div>");
  const root = dom.window.document.getElementById("root")!;
  root.innerHTML = htmlString;

  // Mock editor with jsdom — Lexical expects window & document
  const editor: any = {
    // Minimal shims for $generateNodesFromDOM
    _nodes: [],
    registerTransform: () => {},
  };

  const nodes = $generateNodesFromDOM(editor, root);
  return nodes.map((n: any) => n.getLatest()).map((n: any) => n.__serialize());
}
