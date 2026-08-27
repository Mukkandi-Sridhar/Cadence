/**
 * Screen Wake Lock API helper.
 * Keeps the browser screen active during presentation recording.
 */

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}

let wakeLockSentinel: WakeLockSentinelLike | null = null;

export async function requestScreenWakeLock(): Promise<boolean> {
  if (!("wakeLock" in navigator)) {
    console.warn("Screen Wake Lock API not supported on this browser.");
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
    wakeLockSentinel?.addEventListener("release", () => {
      console.log("Screen Wake Lock was released.");
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.error("Failed to acquire Screen Wake Lock:", err);
    return false;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    } catch (err) {
      console.error("Error releasing Screen Wake Lock:", err);
    }
  }
}
