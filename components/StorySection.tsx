import Image from "next/image";
import { client } from "@/sanity/lib/client";
import { allStoriesQuery } from "@/sanity/lib/queries";
import StoryCarousel from "./StoryCarousel";

export default async function StorySection() {
  const stories = await client.fetch(allStoriesQuery, {}, { next: { revalidate: 60 } });

  return (
    <section className="relative w-full flex flex-col items-center py-10 sm:py-12 min-h-dvh overflow-hidden">
      {/* Heading block */}
      <div className="flex flex-col items-center gap-2 sm:gap-3 px-4 sm:px-6 mb-12 sm:mb-16 md:mb-25">
        <Image
          src="/assets/stickers/globe.png"
          alt=""
          width={166}
          height={72}
          aria-hidden="true"
          className="h-auto w-28 sm:w-36 md:w-[166px]"
        />

        {/* Stars row */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Image
            src="/assets/stickers/stars.svg"
            alt=""
            width={70}
            height={32}
            aria-hidden="true"
            className="h-auto w-12 sm:w-14 md:w-[70px]"
          />
        </div>

        <div className="max-w-88 sm:max-w-none">
          {/* Title line 1 */}
          <h2 className="font-monigue text-foreground uppercase text-center text-4xl sm:text-5xl md:text-6xl leading-none">
            Because celebrating music is also
          </h2>

          {/* Title line 2 with stickers */}
          <div className="flex items-start justify-center gap-2 sm:gap-3 md:gap-4">
            <Image
              src="/assets/stickers/star.svg"
              alt=""
              width={45}
              height={32}
              aria-hidden="true"
              className="mt-1 h-auto w-6 flex-none sm:w-8 md:w-[45px]"
            />
            <h2 className="font-monigue text-foreground uppercase text-center text-4xl sm:text-5xl md:text-6xl leading-none">
              About knowing their story
            </h2>
            <Image
              src="/assets/stickers/star.svg"
              alt=""
              width={45}
              height={32}
              aria-hidden="true"
              className="mt-1 h-auto w-6 flex-none scale-x-[-1] sm:w-8 md:w-[45px]"
            />
          </div>
        </div>
      </div>

      {/* Carousel */}
      <StoryCarousel stories={stories} />

      {/* Stickers */}
      <div className="absolute bottom-[30px] left-1/2 -translate-x-1/2 translate-y-1/2 md:bottom-[-150px] md:left-0 md:right-0 md:translate-x-0 md:translate-y-0 pointer-events-none">
        <Image
          src="/assets/stickers/street.svg"
          alt=""
          width={240}
          height={340}
          aria-hidden="true"
          className="h-auto w-36 sm:w-40 md:w-[240px]"
        />
      </div>

      <div className="pointer-events-none absolute bottom-[80px] left-[30px] z-80 -translate-x-1/2 translate-y-1/2 md:bottom-[-50px] md:left-0 md:right-0 md:translate-x-0 md:translate-y-0">
        <Image
          src="/assets/stickers/antenna.svg"
          alt=""
          width={505}
          height={724}
          aria-hidden="true"
          className="h-auto w-56 sm:w-80 md:w-[505px]"
        />
      </div>

      <div className="absolute top-[60%] right-[-60px] -translate-y-1/2 md:bottom-1/2 md:translate-y-1/2 md:right-[-70px] pointer-events-none">
        <Image
          src="/assets/stickers/body.svg"
          alt=""
          width={207}
          height={205}
          aria-hidden="true"
          className="h-auto w-36 sm:w-36 md:w-[207px]"
        />
      </div>
    </section>
  );
}
