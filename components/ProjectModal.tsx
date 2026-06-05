"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const AUTOPLAY_DURATION = 20_000;
const MODAL_EXPAND_DURATION = 0.75;
const CONTENT_FADE_DURATION = 0.25;
const CLOSE_BUTTON_FADE_DURATION = 0.15;

export type ProjectTopic = {
  _id: string;
  title: string;
  subtitle?: string;
  body: string;
};

type ProjectModalProps = {
  topics: ProjectTopic[];
  className?: string;
};

type TriggerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function ProjectModal({ topics, className }: ProjectModalProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFrameRef = useRef<number | null>(null);
  const titlePointerTypeRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closeButtonTimerRef = useRef<number | null>(null);
  const contentHideTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isCloseButtonVisible, setIsCloseButtonVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [triggerBounds, setTriggerBounds] = useState<TriggerBounds>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const shouldReduceMotion = useReducedMotion();
  const hasTopics = topics.length > 0;
  const activeTopic = topics[activeIndex] ?? topics[0];

  const clearTimer = (timerRef: { current: number | null }) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const openModal = () => {
    if (!hasTopics) return;

    clearTimer(closeTimerRef);
    clearTimer(closeButtonTimerRef);
    clearTimer(contentHideTimerRef);

    const rect = triggerRef.current?.getBoundingClientRect();

    setTriggerBounds({
      x: rect?.left ?? window.innerWidth / 2,
      y: rect?.top ?? window.innerHeight / 2,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
    });
    setIsOpen(true);
    setIsContentVisible(true);
    setIsCloseButtonVisible(false);

    closeButtonTimerRef.current = window.setTimeout(
      () => {
        setIsCloseButtonVisible(true);
        closeButtonTimerRef.current = null;
      },
      shouldReduceMotion
        ? 0
        : (MODAL_EXPAND_DURATION + CONTENT_FADE_DURATION) * 1000,
    );
  };

  const closeModal = () => {
    if (closeTimerRef.current !== null) return;

    clearTimer(closeButtonTimerRef);
    setIsCloseButtonVisible(false);
    setIsPaused(false);
    contentHideTimerRef.current = window.setTimeout(
      () => {
        setIsContentVisible(false);
        contentHideTimerRef.current = null;
      },
      shouldReduceMotion ? 0 : CLOSE_BUTTON_FADE_DURATION * 1000,
    );
    closeTimerRef.current = window.setTimeout(
      () => {
        setIsOpen(false);
        closeTimerRef.current = null;
        triggerRef.current?.focus();
      },
      shouldReduceMotion
        ? 0
        : (CLOSE_BUTTON_FADE_DURATION + CONTENT_FADE_DURATION) * 1000,
    );
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (closeButtonTimerRef.current !== null) {
        window.clearTimeout(closeButtonTimerRef.current);
      }
      if (contentHideTimerRef.current !== null) {
        window.clearTimeout(contentHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isCloseButtonVisible) return;

    const frameId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isCloseButtonVisible, isOpen]);

  useEffect(() => {
    if (!isOpen || !topics.length) {
      setProgress(0);
      lastFrameRef.current = null;
      return;
    }

    let frameId = 0;

    const tick = (timestamp: number) => {
      if (!isPaused) {
        const previousTimestamp = lastFrameRef.current ?? timestamp;
        const elapsed = timestamp - previousTimestamp;

        setProgress((currentProgress) => {
          const nextProgress = currentProgress + elapsed / AUTOPLAY_DURATION;

          if (nextProgress >= 1) {
            setActiveIndex((currentIndex) => (currentIndex + 1) % topics.length);
            return 0;
          }

          return nextProgress;
        });
      }

      lastFrameRef.current = timestamp;
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      lastFrameRef.current = null;
    };
  }, [isOpen, isPaused, topics.length]);

  useEffect(() => {
    if (activeIndex >= topics.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, topics.length]);

  const selectTopic = (index: number) => {
    setActiveIndex(index);
    setProgress(0);
  };

  const pauseOnTitleHover = (index: number) => {
    selectTopic(index);
    setIsPaused(true);
    lastFrameRef.current = null;
  };

  const pauseOnTitleFocus = (index: number) => {
    if (titlePointerTypeRef.current) {
      titlePointerTypeRef.current = null;
      return;
    }

    selectTopic(index);
    setIsPaused(true);
    lastFrameRef.current = null;
  };

  const selectTopicAndResume = (index: number) => {
    selectTopic(index);
    resumeAutoplay();
  };

  const resumeAutoplay = () => {
    setIsPaused(false);
    lastFrameRef.current = null;
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex items-center gap-2 rounded-full border border-foreground px-4 py-2 font-anonymous text-xs font-bold uppercase leading-none transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 cursor-pointer ${className ?? ""} ${isOpen ? "pointer-events-none opacity-0" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={!hasTopics}
        onClick={openModal}
      >
        <Image
          src="/assets/symbols/nea-onnim.svg"
          alt=""
          width={22}
          height={22}
          aria-hidden="true"
          className="h-4 w-4 brightness-0"
        />
        <span className="text-foreground">Le projet</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
            className="pointer-events-auto fixed inset-0 z-70 overflow-hidden text-[#171717]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
          >
            <motion.div
              className="absolute left-0 top-0 bg-white/90 backdrop-blur-md"
              initial={
                shouldReduceMotion
                  ? { opacity: 0, inset: 0, borderRadius: 0 }
                  : {
                      opacity: 0,
                      x: triggerBounds.x,
                      y: triggerBounds.y,
                      width: triggerBounds.width,
                      height: triggerBounds.height,
                      borderRadius: 32,
                    }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1, inset: 0, borderRadius: 0 }
                  : {
                      opacity: 1,
                      x: 0,
                      y: 0,
                      width: "100vw",
                      height: "100dvh",
                      borderRadius: 0,
                    }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0, inset: 0, borderRadius: 0 }
                  : {
                      opacity: 0,
                      x: triggerBounds.x,
                      y: triggerBounds.y,
                      width: triggerBounds.width,
                      height: triggerBounds.height,
                      borderRadius: 32,
                    }
              }
              transition={{
                duration: shouldReduceMotion ? 0.01 : MODAL_EXPAND_DURATION,
                ease: [0.83, 0, 0.17, 1],
              }}
            />

            <div
              className="relative min-h-dvh"
            >
              <div className="absolute left-0 top-0 h-1 w-full bg-[#171717]/10">
                <motion.div
                  className="h-full bg-light-orange"
                  style={{ scaleX: progress, transformOrigin: "left" }}
                />
              </div>

              <motion.button
                ref={closeButtonRef}
                type="button"
                className="absolute right-4 top-4 z-10 rounded-full border border-[#171717] px-4 py-2 font-anonymous text-xs font-bold uppercase leading-none text-[#171717] transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#171717] sm:right-6 sm:top-5 cursor-pointer"
                aria-label="Fermer la modal Le projet"
                initial={{ opacity: 0 }}
                animate={{ opacity: isCloseButtonVisible ? 1 : 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0.01 : CLOSE_BUTTON_FADE_DURATION,
                  ease: "easeOut",
                }}
                onClick={closeModal}
              >
                x close
              </motion.button>

              <motion.div
                className="flex min-h-dvh flex-col px-5 pb-10 pt-20 sm:px-8 sm:pt-24 md:px-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: isContentVisible ? 1 : 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  delay: isContentVisible && !shouldReduceMotion ? MODAL_EXPAND_DURATION : 0,
                  duration: shouldReduceMotion ? 0.01 : CONTENT_FADE_DURATION,
                  ease: "easeOut",
                }}
              >
                <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-2 text-center">
                  {topics.map((topic, index) => {
                    const isActive = index === activeIndex;

                    return (
                      <button
                        key={topic._id}
                        type="button"
                        id={isActive ? "project-modal-title" : undefined}
                        className={`font-monigue text-2xl uppercase leading-none transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#171717] sm:text-3xl md:text-4xl ${
                          isActive ? "opacity-100" : "opacity-40 hover:opacity-60"
                        }`}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => selectTopicAndResume(index)}
                        onPointerDown={(event) => {
                          titlePointerTypeRef.current = event.pointerType;
                        }}
                        onPointerEnter={(event) => {
                          if (event.pointerType === "mouse") {
                            pauseOnTitleHover(index);
                          }
                        }}
                        onPointerLeave={(event) => {
                          if (event.pointerType === "mouse") {
                            resumeAutoplay();
                          }
                        }}
                        onFocus={() => pauseOnTitleFocus(index)}
                        onBlur={resumeAutoplay}
                      >
                        {topic.title}
                        {isActive && topic.subtitle && (
                          <span className="mt-2 block font-anonymous text-xs font-bold normal-case leading-tight sm:text-sm">
                            [{topic.subtitle}]
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.p
                    key={activeTopic?._id}
                    className="m-auto max-w-152 -translate-y-1/2 px-1 text-center font-anonymous text-base leading-snug text-[#171717] sm:text-lg md:text-xl"
                    initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -14 }}
                    transition={{ duration: shouldReduceMotion ? 0.01 : 0.35, ease: "easeOut" }}
                  >
                    {activeTopic?.body}
                  </motion.p>
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
