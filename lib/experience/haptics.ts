/**
 * Best-effort haptics for the HOLD.
 * - Android (Chrome, Firefox…): the Vibration API.
 * - iPhone: Safari has no Vibration API. Since iOS 18, toggling an
 *   <input type="checkbox" switch> plays the system "tick" haptic, so a hidden
 *   switch is clicked through its <label>. Unofficial trick: it may only fire
 *   inside a user gesture, and can stop working with an iOS update.
 * - Elsewhere: nothing.
 */
let iosLabel: HTMLLabelElement | null = null;

function iosSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (iosLabel) return iosLabel;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosLabel = label;
  return label;
}

const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/** One short tick. */
export function hapticTick(ms = 10): void {
  if (canVibrate()) {
    navigator.vibrate(ms);
    return;
  }
  iosSwitch()?.click();
}

/** Completion: a short burst. */
export function hapticSuccess(): void {
  if (canVibrate()) {
    navigator.vibrate([30, 50, 30, 50, 90]);
    return;
  }
  const label = iosSwitch();
  if (!label) return;
  label.click();
  window.setTimeout(() => label.click(), 90);
  window.setTimeout(() => label.click(), 180);
}
