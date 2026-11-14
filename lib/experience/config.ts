/** Home experience timings — tweak here. */
export const EXPERIENCE = {
  minLoadingMs: 3000, // the loader runs at least this long, even if all is cached
  // Loader curve: one ease-out over minLoadingMs (fast, then slower and
  // slower: 50 % ≈ 0.9 s, 80 % ≈ 1.5 s, then the last 20 % over ~1.5 s). The
  // real loading can only hold back the part above `realFrom`. The display
  // follows that target smoothly (no speed jumps).
  loaderCurve: 3, // ease-out power: higher = faster start, longer tail
  loaderFollow: 4, // per second: smoothing of the displayed value
  realFrom: 0.8,
  maxLoadingMs: 20000, // give up waiting past this (slow network): go on anyway
  loadedBeatMs: 450, // pause on "100%" before the HOLD button
  holdMs: 2500, // holding time to forge the logo
  releaseMs: 900, // released early: full → empty in this time
  forgedShowMs: 2400, // chrome logo alone on screen after the forge
  // Then the dissolve: the logo sinks into the ASCII (LOGO_FX.hide) while the
  // glyph field and the wave form (STAGE_FX.presenceRate); REC goes live.
  dissolveMs: 1600, // before the intro subtitles start
  menuDelayMs: 800, // the genre menu decodes in after the logo starts its reveal
};
