import Image from "next/image";
import Link from "next/link";
import { client } from "@/sanity/lib/client";
import { projectTopicsQuery } from "@/sanity/lib/queries";
import ProjectModal, { type ProjectTopic } from "./ProjectModal";

export default async function Header() {
  const projectTopics = await client.fetch<ProjectTopic[]>(
    projectTopicsQuery,
    {},
    { next: { revalidate: 60 } },
  );

  return (
    <header className="pointer-events-none fixed left-0 right-0 top-0 z-90 flex items-center justify-between px-6 py-5">
      <Link href="/" aria-label="Home" className="pointer-events-auto relative z-100">
        <Image
          src="/assets/logos/core-logo.svg"
          alt="Core logo"
          width={41}
          height={24}
          priority
        />
      </Link>

      <nav className="pointer-events-none">
        <ProjectModal
          topics={projectTopics}
          className="pointer-events-auto font-anonymous text-sm uppercase text-background transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
        />
      </nav>
    </header>
  );
}
