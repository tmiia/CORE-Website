import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";
import { sanityDataset, sanityProjectId } from "./lib/env";
import { PROJECT_PAGE_ID } from "./lib/projectPageId";

const projectId = sanityProjectId ?? "missing-project-id";

// One-of-a-kind documents: opened directly from the list, never created,
// duplicated or deleted.
const SINGLETONS = new Set(["projectPage"]);
const SINGLETON_ACTIONS = new Set(["publish", "discardChanges", "restore"]);

export default defineConfig({
  name: "default",
  title: "Core Website",

  projectId,
  dataset: sanityDataset,

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Contenu")
          .items([
            S.listItem()
              .title("Page projet")
              .id(PROJECT_PAGE_ID)
              .child(S.document().schemaType("projectPage").documentId(PROJECT_PAGE_ID).title("Page projet")),
            S.divider(),
            ...S.documentTypeListItems().filter((item) => !SINGLETONS.has(item.getId() ?? "")),
          ]),
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({ schemaType }) => !SINGLETONS.has(schemaType)),
  },

  document: {
    actions: (actions, { schemaType }) =>
      SINGLETONS.has(schemaType) ? actions.filter(({ action }) => action && SINGLETON_ACTIONS.has(action)) : actions,
  },
});
