import Piii from "piii";
import piiiFilters from "piii-filters";
import { createFilter } from "toxibr";

const piii = new Piii({ filters: Object.values(piiiFilters) });
const toxibr = createFilter({
  blockLinks: false,
  blockPhones: false,
  blockDigitsOnly: false,
  blockEmojis: false
});

export function isOffensiveMessage(text: string): boolean {
  return piii.has(text) || !toxibr(text).allowed;
}
