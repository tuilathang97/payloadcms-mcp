declare module "express" {
  export interface Request {}
  export interface Response {}
  const e: any;
  export default e;
}

declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string);
    window: any;
  }
}

declare module "axios" {
  const a: any;
  export default a;
}

declare module "dotenv" {
  export function config(): void;
}

declare module "@lexical/html" {
  export const $generateNodesFromDOM: any;
}

declare const process: any;
