export type MerchantConfig = {
  id?: string;
  name: string;
  baseUrl: string;
  selectors: Record<string, string>;
  menu?: { items: { name: string; aliases?: string[]; sizes?: string[]; modifiers?: string[] }[] };
  normalize?: {
    items?: Record<string, string>;
    sizes?: Record<string, string>;
    modifiers?: Record<string, string>;
  };
  availability?: {
    outOfStock?: string[];
    substitutions?: Record<string, string[]>;
  };
  verification?: {
    summarySelector: string;
    mustContain?: string[];
  };
  checkout?: {
    defaults?: { name?: string; phone?: string; time?: string };
    fields?: { name?: string; phone?: string; time?: string };
  };
  ownerUid?: string;
  ownerEmail?: string;
};
