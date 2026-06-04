"use client";

import {
  AnimatePresence,
  animate,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
  type PanInfo,
} from "framer-motion";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { urlForImage } from "@/sanity/lib/image";
import type { SanityImageSource } from "@sanity/image-url";

type Story = {
  _id: string;
  title: string;
  origin?: string;
  birthYear?: number;
  description?: string;
  slug?: { current: string };
  thumbnail?: SanityImageSource;
};

type Props = {
  stories: Story[];
};

const AUTOPLAY_INTERVAL = 2500;
const INACTIVE_OPACITY = 0.7;
const ACTIVE_SCALE = 1.08;
const MAX_SLIDE_WIDTH = 620;
const MIN_SLIDE_WIDTH = 288;
const MOBILE_SLIDE_GAP = 24;
const TABLET_SLIDE_GAP = 40;
const DESKTOP_SLIDE_GAP = 64;

type CarouselSlide = {
  story: Story;
  cloneIndex: number;
};

type SlideProps = {
  slide: CarouselSlide;
  index: number;
  activeIndex: number;
  offsetX: MotionValue<number>;
  trackX: MotionValue<number>;
  slideWidth: number;
  totalStories: number;
};

function StorySlide({
  slide,
  index,
  activeIndex,
  offsetX,
  trackX,
  slideWidth,
  totalStories,
}: SlideProps) {
  const isActive = index === activeIndex;
  const shouldReduceMotion = useReducedMotion();
  const storyPosition = (index % totalStories) + 1;
  const imageUrl = slide.story.thumbnail
    ? urlForImage(slide.story.thumbnail).width(1200).height(675).url()
    : null;
  const x = useTransform(() => offsetX.get() + trackX.get());

  return (
    <motion.div
      className="absolute left-0 top-0 select-none"
      role="listitem"
      aria-roledescription="slide"
      aria-label={`${slide.story.title}, ${storyPosition} sur ${totalStories}`}
      aria-current={isActive ? "true" : undefined}
      aria-hidden={!isActive}
      style={{ width: slideWidth, x }}
      animate={{
        opacity: isActive ? 1 : INACTIVE_OPACITY,
        scale: isActive ? ACTIVE_SCALE : 1,
      }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: "easeOut" }}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={slide.story.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 82vw, (max-width: 1024px) 70vw, 620px"
            priority={isActive}
          />
        ) : (
          <div className="w-full h-full bg-black/20" />
        )}
      </div>

      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            key={`${slide.story._id}-${slide.cloneIndex}-details`}
            className="overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
          >
            {slide.story.description &&
              (<>
                <div className="grid grid-cols-2 gap-x-4 mt-4 px-1">
                  <h3 className="font-anonymous font-bold text-background text-xl uppercase leading-tight text-right">
                    {slide.story.origin}
                  </h3>
                  <h3 className="font-anonymous text-background text-xl uppercase leading-tight text-left">
                    {slide.story.birthYear}
                  </h3>
                </div>

                <div className="mt-1 px-1">
                  <p className="font-anonymous text-background text-sm uppercase leading-tight text-center mx-auto max-w-88">
                    {slide.story.description}
                  </p>
                </div>
              </>)}

            {slide.story.slug && (
              <div className="mt-5 px-1 text-center">
                <a
                  href={`/stories/${slide.story.slug.current}`}
                  className="font-anonymous text-background text-sm uppercase tracking-wide transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
                >
                  [Lire l&apos;histoire -&gt;]
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function StoryCarousel({ stories }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const offsetsRef = useRef<number[]>([]);
  const slideMotionValuesRef = useRef<MotionValue<number>[]>([]);
  const autoplayControlsRef = useRef<AnimationPlaybackControls | null>(null);
  const isPausedRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const trackX = useMotionValue(0);

  const slides = useMemo<CarouselSlide[]>(
    () => [...stories, ...stories].map((story, cloneIndex) => ({ story, cloneIndex })),
    [stories],
  );

  const slideWidth =
    viewportWidth > 0
      ? Math.min(MAX_SLIDE_WIDTH, Math.max(MIN_SLIDE_WIDTH, viewportWidth * 0.82))
      : MAX_SLIDE_WIDTH;
  const slideGap =
    viewportWidth < 640
      ? MOBILE_SLIDE_GAP
      : viewportWidth < 1024
        ? TABLET_SLIDE_GAP
        : DESKTOP_SLIDE_GAP;
  const slideStride = slideWidth + slideGap;
  const trackSpan = slideStride * slides.length;

  if (slideMotionValuesRef.current.length !== slides.length) {
    slideMotionValuesRef.current = slides.map(
      (_, index) => slideMotionValuesRef.current[index] ?? motionValue(0),
    );
  }

  const syncOffsets = useCallback(() => {
    slideMotionValuesRef.current.forEach((motionValue, index) => {
      motionValue.set(offsetsRef.current[index] ?? 0);
    });
  }, []);

  const findClosestSlideIndex = useCallback(
    (currentTrackX = trackX.get()) => {
      const viewportCenter = viewportWidth / 2;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      offsetsRef.current.forEach((offset, index) => {
        const center = offset + currentTrackX + slideWidth / 2;
        const distance = Math.abs(center - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      return closestIndex;
    },
    [slideWidth, trackX, viewportWidth],
  );

  const recenterSlides = useCallback(() => {
    if (!viewportWidth || !slides.length) return;

    const currentTrackX = trackX.get();
    let changed = false;

    offsetsRef.current.forEach((offset, index) => {
      const slideLeft = offset + currentTrackX;
      const slideRight = slideLeft + slideWidth;

      if (slideRight < 0) {
        offsetsRef.current[index] = offset + trackSpan;
        changed = true;
      } else if (slideLeft > viewportWidth) {
        offsetsRef.current[index] = offset - trackSpan;
        changed = true;
      }
    });

    if (changed) {
      syncOffsets();
    }

    const closestIndex = findClosestSlideIndex(currentTrackX);

    setActiveIndex((currentIndex) =>
      currentIndex === closestIndex ? currentIndex : closestIndex,
    );
  }, [
    findClosestSlideIndex,
    slideWidth,
    slides.length,
    syncOffsets,
    trackSpan,
    trackX,
    viewportWidth,
  ]);

  const snapToClosestSlide = useCallback(() => {
    if (!viewportWidth || !slides.length) return;

    recenterSlides();

    const currentTrackX = trackX.get();
    const closestIndex = findClosestSlideIndex(currentTrackX);
    const closestCenter =
      offsetsRef.current[closestIndex] + currentTrackX + slideWidth / 2;
    const centeredTrackX = currentTrackX + viewportWidth / 2 - closestCenter;

    setActiveIndex((currentIndex) =>
      currentIndex === closestIndex ? currentIndex : closestIndex,
    );
    autoplayControlsRef.current?.stop();

    if (shouldReduceMotion) {
      trackX.set(centeredTrackX);
      recenterSlides();
      return;
    }

    autoplayControlsRef.current = animate(trackX, centeredTrackX, {
      duration: 0.35,
      ease: "easeOut",
      onUpdate: recenterSlides,
      onComplete: recenterSlides,
    });
  }, [
    findClosestSlideIndex,
    recenterSlides,
    shouldReduceMotion,
    slideWidth,
    slides.length,
    trackX,
    viewportWidth,
  ]);

  const animateBySlide = useCallback(
    (direction: 1 | -1) => {
      autoplayControlsRef.current?.stop();
      autoplayControlsRef.current = animate(trackX, trackX.get() + direction * slideStride, {
        duration: shouldReduceMotion ? 0 : 0.55,
        ease: "easeInOut",
        onUpdate: recenterSlides,
        onComplete: () => {
          recenterSlides();
          snapToClosestSlide();
        },
      });
    },
    [recenterSlides, shouldReduceMotion, slideStride, snapToClosestSlide, trackX],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      setViewportWidth(viewport.getBoundingClientRect().width);
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!slides.length || !viewportWidth) return;

    const initialOffset = viewportWidth / 2 - slideWidth / 2;
    offsetsRef.current = slides.map((_, index) => initialOffset + index * slideStride);
    trackX.set(0);
    syncOffsets();
    recenterSlides();
  }, [recenterSlides, slideStride, slideWidth, slides, syncOffsets, trackX, viewportWidth]);

  useEffect(() => {
    if (!slides.length || !viewportWidth || shouldReduceMotion) return;

    const interval = window.setInterval(() => {
      if (!isPausedRef.current) {
        animateBySlide(-1);
      }
    }, AUTOPLAY_INTERVAL);

    return () => {
      window.clearInterval(interval);
      autoplayControlsRef.current?.stop();
    };
  }, [animateBySlide, shouldReduceMotion, slides.length, viewportWidth]);

  const pauseAutoplay = () => {
    isPausedRef.current = true;
    autoplayControlsRef.current?.stop();
  };

  const resumeAutoplay = () => {
    isPausedRef.current = false;
  };

  const handlePan = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    trackX.set(trackX.get() + info.delta.x);
    recenterSlides();
  };

  const handlePanStart = () => {
    pauseAutoplay();
  };

  const handlePanEnd = () => {
    snapToClosestSlide();
    resumeAutoplay();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    pauseAutoplay();
    animateBySlide(event.key === "ArrowRight" ? -1 : 1);
    resumeAutoplay();
  };

  if (!stories.length) return null;

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Carousel des histoires"
      aria-roledescription="carousel"
      tabIndex={0}
      className="relative h-[430px] w-full touch-pan-y focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background sm:h-[540px] lg:h-[680px]"
      onMouseEnter={pauseAutoplay}
      onMouseLeave={resumeAutoplay}
      onFocus={pauseAutoplay}
      onBlur={resumeAutoplay}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        className="relative h-full cursor-grab active:cursor-grabbing"
        role="list"
        aria-live="polite"
        onPan={handlePan}
        onPanStart={handlePanStart}
        onPanEnd={handlePanEnd}
      >
        {slides.map((slide, index) => (
          <StorySlide
            key={`${slide.story._id}-${slide.cloneIndex}`}
            slide={slide}
            index={index}
            activeIndex={activeIndex}
            offsetX={slideMotionValuesRef.current[index]}
            trackX={trackX}
            slideWidth={slideWidth}
            totalStories={stories.length}
          />
        ))}
      </motion.div>
    </div>
  );
}
