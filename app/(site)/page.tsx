import HomeExperience from "@/components/home/HomeExperience";
import { buildMenu, type StoryItem } from "@/lib/experience/genres";
import { client } from "@/sanity/lib/client";
import { allStoriesQuery } from "@/sanity/lib/queries";

export default async function HomePage() {
  // No Sanity config (no .env.local): the menu lists the installation's genres
  // without links.
  const stories = client
    ? await client.fetch<StoryItem[]>(allStoriesQuery, {}, { next: { revalidate: 60 } })
    : [];

  return <HomeExperience genres={buildMenu(stories)} />;
}
