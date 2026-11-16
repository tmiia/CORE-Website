import { pageSchema } from "./page";
import { genreSchema } from "./genre";
import { playlistSchema } from "./playlist";
import { projectPageSchema } from "./projectPage";
import { projectTopicSchema } from "./projectTopic";
import { storySchema } from "./story";

export const schemaTypes = [
  projectPageSchema,
  pageSchema,
  genreSchema,
  playlistSchema,
  storySchema,
  projectTopicSchema,
];
