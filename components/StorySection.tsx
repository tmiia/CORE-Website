import Image from "next/image";
import { client } from "@/sanity/lib/client";
import { allStoriesQuery } from "@/sanity/lib/queries";
import StoryCarousel from "./StoryCarousel";

export default async function StorySection() {
  const stories = client
    ? await client.fetch(allStoriesQuery, {}, { next: { revalidate: 60 } })
    : [];

  return (
    <section className="relative isolate flex h-dvh max-h-dvh min-h-0 w-full flex-col items-center overflow-hidden px-0 pb-[clamp(2rem,5dvh,3rem)] pt-[clamp(4.25rem,9dvh,5.5rem)]">
      {/* Heading block */}
      <div className="z-10 mb-[clamp(1rem,4dvh,4rem)] flex flex-none flex-col items-center gap-[clamp(0.25rem,1dvh,0.75rem)] px-4 sm:px-6">
        <Image
          src="/assets/stickers/globe.png"
          alt=""
          width={166}
          height={72}
          aria-hidden="true"
          className="h-auto w-[clamp(5.5rem,14vmin,10.375rem)]"
        />

        {/* Stars row */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Image
            src="/assets/stickers/stars.svg"
            alt=""
            width={70}
            height={32}
            aria-hidden="true"
            className="h-auto w-[clamp(2.5rem,6vmin,4.375rem)]"
          />
        </div>

        <div className="mt-[clamp(0rem,3dvh,2.5rem)] max-w-88 md:mt-0 md:max-w-[720px]">
          {/* Title line 1 */}
          <h2 className="text-center font-monigue text-[clamp(2rem,6vmin,3.75rem)] uppercase leading-none text-foreground">
            Because celebrating music is also{" "}
            <span className="md:hidden">about knowing</span>
          </h2>

          {/* Title line 2 with stickers */}
          <div className="flex items-start justify-center gap-2 sm:gap-3 md:gap-4">
            <Image
              src="/assets/stickers/star.svg"
              alt=""
              width={45}
              height={32}
              aria-hidden="true"
              className="mt-1 h-auto w-[clamp(1.5rem,4vmin,2.8125rem)] flex-none"
            />
            <h2 className="text-center font-monigue text-[clamp(2rem,6vmin,3.75rem)] uppercase leading-none text-foreground">
              <span className="hidden md:inline">about knowing </span>
              their story
            </h2>
            <Image
              src="/assets/stickers/star.svg"
              alt=""
              width={45}
              height={32}
              aria-hidden="true"
              className="mt-1 h-auto w-[clamp(1.5rem,4vmin,2.8125rem)] flex-none scale-x-[-1]"
            />
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div className="z-10 flex min-h-0 w-full flex-1">
        <StoryCarousel stories={stories} />
      </div>

      {/* Stickers */}
      <div className="z-80 absolute bottom-[40px] right-[-40px] translate-y-1/2 max-md:[@media_(max-height:799px)]:right-[-70px] max-md:[@media_(max-height:799px)]:bottom-[-30px] md:bottom-[-150px] md:left-0 md:right-0 md:translate-x-0 md:translate-y-0 pointer-events-none">
        <Image
          src="/assets/stickers/street.svg"
          alt=""
          width={240}
          height={340}
          aria-hidden="true"
          className="h-auto w-36 sm:w-40 lg:w-[240px]"
        />
      </div>

      <div className="pointer-events-none absolute bottom-[110px] left-[30px] z-80 -translate-x-1/2 translate-y-1/2 max-lg:[@media_(max-height:799px)]:left-[-20px] max-lg:[@media_(max-height:799px)]:bottom-[70px] lg:bottom-[-50px] lg:left-0 lg:right-0 lg:translate-x-0 lg:translate-y-0">
        <Image
          src="/assets/stickers/antenna.svg"
          alt=""
          width={505}
          height={724}
          aria-hidden="true"
          className="h-auto w-56 sm:w-80 md:w-[450px] lg:w-[505px]"
        />
      </div>

      <div className="z-80 absolute top-[50%] right-[-70px] -translate-y-1/2 md:bottom-1/2 md:translate-y-1/2 md:right-[-70px] pointer-events-none">
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
