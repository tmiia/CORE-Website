import { createClient } from "next-sanity";
import {
  sanityApiVersion,
  sanityDataset,
  sanityProjectId,
} from "./env";

export const client = sanityProjectId
  ? createClient({
      projectId: sanityProjectId,
      dataset: sanityDataset,
      apiVersion: sanityApiVersion,
      useCdn: process.env.NODE_ENV === "production",
      // Token used only on the server for authenticated requests (drafts, mutations)
      token: process.env.SANITY_API_TOKEN,
    })
  : null;
