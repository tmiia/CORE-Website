import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { client } from "./client";

const builder = client ? createImageUrlBuilder(client) : null;

export function urlForImage(source: SanityImageSource) {
  if (!builder) {
    throw new Error(
      "Cannot build Sanity image URL without NEXT_PUBLIC_SANITY_PROJECT_ID",
    );
  }

  return builder.image(source);
}
