import type { FontPreset } from "@sushichan044/kg-core";

export function cssFontFeatures(profile: FontPreset): string {
  return Object.entries(profile.rendering.features)
    .map(([tag, value]) => `"${tag}" ${value}`)
    .join(", ");
}
