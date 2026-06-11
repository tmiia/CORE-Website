import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";
import { sanityDataset, sanityProjectId } from "./lib/env";

const projectId = sanityProjectId ?? "missing-project-id";

export default defineConfig({
  name: "default",
  title: "Core Website",

  projectId,
  dataset: sanityDataset,

  plugins: [structureTool(), visionTool()],

  schema: {
    types: schemaTypes,
  },
});
