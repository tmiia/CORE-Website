"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const STAR_PATHS = [
  {
    d: "M5.66214 6.53165C3.00834 6.86555 1.84499 7.03165 1.16214 7.03165C0.450836 7.03165 2.16363 8.53189 4.66218 9.70862C5.41822 10.0647 4.93818 15.2546 5.40724 15.0319C6.64237 14.4454 9.19408 9.60874 10.1624 11.0319C11.2572 12.641 14.6563 15.5124 14.6624 14.0319C14.6649 13.4282 12.6433 10.6131 14.1622 9.53189C14.7537 9.11076 18.5857 8.51255 17.2612 7.46517C16.0304 6.49184 13.4193 7.15849 12.3066 5.66964C11.1274 4.09163 10.3787 -0.560066 9.16211 1.53174C7.892 3.71549 8.31594 6.19775 5.66214 6.53165Z",
    fill: "#059D48",
  },
  {
    d: "M32.6621 6.53165C30.0083 6.86555 28.845 7.03165 28.1621 7.03165C27.4508 7.03165 29.1636 8.53189 31.6622 9.70862C32.4182 10.0647 31.9382 15.2546 32.4072 15.0319C33.6424 14.4454 36.1941 9.60874 37.1624 11.0319C38.2572 12.641 41.6563 15.5124 41.6624 14.0319C41.6649 13.4282 39.6433 10.6131 41.1622 9.53189C41.7537 9.11076 45.5857 8.51255 44.2612 7.46517C43.0304 6.49184 40.4193 7.15849 39.3066 5.66964C38.1274 4.09163 37.3787 -0.560066 36.1621 1.53174C34.892 3.71549 35.3159 6.19775 32.6621 6.53165Z",
    fill: "#141414",
  },
  {
    d: "M59.6621 6.53165C57.0083 6.86555 55.845 7.03165 55.1621 7.03165C54.4508 7.03165 56.1636 8.53189 58.6622 9.70862C59.4182 10.0647 58.9382 15.2546 59.4072 15.0319C60.6424 14.4454 63.1941 9.60874 64.1624 11.0319C65.2572 12.641 68.6563 15.5124 68.6624 14.0319C68.6649 13.4282 66.6433 10.6131 68.1622 9.53189C68.7537 9.11076 72.5857 8.51255 71.2612 7.46517C70.0304 6.49184 67.4193 7.15849 66.3066 5.66964C65.1274 4.09163 64.3787 -0.560066 63.1621 1.53174C61.892 3.71549 62.3159 6.19775 59.6621 6.53165Z",
    fill: "#DE1E19",
  },
];

export default function IntroLoader() {
  const [isVisible, setIsVisible] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const starsTimeout = window.setTimeout(
      () => setShowStars(false),
      shouldReduceMotion ? 450 : 1300,
    );
    const overlayTimeout = window.setTimeout(
      () => setIsVisible(false),
      shouldReduceMotion ? 600 : 1750,
    );

    return () => {
      window.clearTimeout(starsTimeout);
      window.clearTimeout(overlayTimeout);
    };
  }, [shouldReduceMotion]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-999 flex items-center justify-center bg-page"
          aria-hidden="true"
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: shouldReduceMotion ? 0.2 : 0.6, ease: "easeOut" }}
        >
          <motion.svg
            width="73"
            height="17"
            viewBox="0 0 73 17"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-auto w-[clamp(3rem,18vmin,5rem)] overflow-visible"
            initial="hidden"
            animate={showStars ? "visible" : "gone"}
          >
            {STAR_PATHS.map((star, index) => (
              <motion.path
                key={star.d}
                d={star.d}
                fill={star.fill}
                stroke="black"
                strokeWidth="2"
                strokeLinecap="round"
                custom={index}
                variants={{
                  hidden: {
                    opacity: 0,
                    scale: shouldReduceMotion ? 1 : 0.65,
                  },
                  visible: (starIndex: number) => ({
                    opacity: 1,
                    scale: 1,
                    transition: {
                      delay: shouldReduceMotion ? 0 : starIndex * 0.24,
                      duration: shouldReduceMotion ? 0.1 : 0.4,
                      ease: "easeOut",
                    },
                  }),
                  gone: {
                    opacity: 0,
                    scale: shouldReduceMotion ? 1 : 0.9,
                    transition: {
                      duration: shouldReduceMotion ? 0.1 : 0.35,
                      ease: "easeInOut",
                    },
                  },
                }}
              />
            ))}
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
