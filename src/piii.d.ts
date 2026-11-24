declare module "piii" {
  export type PiiiFilter = string | PiiiFilter[];

  interface PiiiOptions {
    filters?: PiiiFilter[];
  }

  export default class Piii {
    constructor(options?: PiiiOptions);
    has(text: string): boolean;
    filter(text: string): string;
  }
}

declare module "piii-filters" {
  import type { PiiiFilter } from "piii";

  const filters: Record<string, PiiiFilter>;
  export default filters;
}
