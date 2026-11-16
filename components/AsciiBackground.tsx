"use client";

import { useEffect, useRef } from "react";
import { completeAllLoads, reportLoad } from "@/lib/core-fm/loadProgress";
import { appearGlitch } from "@/lib/experience/sfx";

/**
 * Fixed full-viewport WebGL background: the installation's oscilloscope wave
 * through the ASCII post-effect. three/postprocessing are imported inside the
 * effect, so they stay out of the server render and the initial bundle.
 * `?debug` mounts the tweakpane panel. No WebGL → the black page background.
 */
export default function AsciiBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      let BackgroundStage: typeof import("@/lib/core-fm/BackgroundStage").BackgroundStage;
      try {
        ({ BackgroundStage } = await import("@/lib/core-fm/BackgroundStage"));
      } catch (e) {
        console.warn("[AsciiBackground] 3D bundle failed to load", e);
        completeAllLoads(); // never leave the loader waiting
        return;
      }
      reportLoad("code", 1);
      if (disposed) return;

      let stage: InstanceType<typeof BackgroundStage>;
      try {
        stage = new BackgroundStage(canvas, {
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        });
      } catch (e) {
        console.warn("[AsciiBackground] WebGL unavailable", e);
        completeAllLoads();
        return;
      }
      // A genre model tears in (ASCII glitch): static that settles with it.
      stage.genre.onAppear = appearGlitch;
      stage.start();
      cleanup = () => stage.dispose();

      if (!new URLSearchParams(window.location.search).has("debug")) return;
      const { mountDebugPane } = await import("@/lib/core-fm/debugPane");
      if (disposed) return; // cleanup already disposed the stage
      const pane = mountDebugPane(stage);
      // Console access for profiling (?debug only).
      (window as unknown as { __coreStage?: unknown }).__coreStage = stage;
      cleanup = () => {
        pane.dispose();
        stage.dispose();
        delete (window as unknown as { __coreStage?: unknown }).__coreStage;
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      // lvh: the size doesn't change when the mobile URL bar shows/hides, so
      // scrolling never triggers a WebGL resize.
      className="pointer-events-none fixed left-0 top-0 -z-10 h-lvh w-full"
    />
  );
}
