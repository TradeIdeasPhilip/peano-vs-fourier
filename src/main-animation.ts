import { AnimationLoop } from "phil-lib/client-misc";
import { Showable } from "./showable";

/**
 * This handles a lot of the boilerplate work required to work with https://github.com/TradeIdeasPhilip/html-to-video.
 *
 * This initially starts the animation running in real-time.
 * This is very helpful in development.
 *
 * This handles any requests from the external program.
 * It starts by canceling the real-time animation.
 *
 * Notice `window.MainAnimation` which points to the active MainAnimation object.
 * This gives debugging options via the console.
 */
export class MainAnimation {
  /**
   * This is what are we animating.
   */
  readonly #showable: Showable;
  /**
   * Update the screen to the requested place in the animation.
   *
   * This is public for debugging reasons.
   * Most of the time you let this class call this function.
   * @param timeInMS Advance to this time.
   * This is not fixed to any frame rate.
   * Use floating point numbers as you like.
   */
  show(timeInMS: number) {
    this.#showable.show(timeInMS);
  }
  /**
   * When will we be done.
   * We always start at 0.
   * So this is the duration of the show.
   *
   * This is measured in milliseconds.
   *
   * The video capture software will request this from us.
   * This is public mostly for debugging reasons.
   */
  get endTime() {
    return this.#showable.duration;
  }
  private initScreenCapture(script: unknown) {
    document
      .querySelectorAll("[data-hideBeforeScreenshot]")
      .forEach((element) => {
        if (
          !(element instanceof SVGElement || element instanceof HTMLElement)
        ) {
          throw new Error("wtf");
        }
        element.style.display = "none";
      });
    this.disableAnimationLoop();
    return {
      source: this.source,
      script,
      seconds: this.#showable.duration / 1000,
      devicePixelRatio,
    };
  }
  /**
   *
   * @param showable Display and record this.
   * @param source This is used to synchronize with the video capture software.
   * Sometimes, especially when the web software was running in Vite dev mode,
   * and when the video capture software was running from a script,
   * it was easy to run the wrong script.
   *
   * So pick something unique to this program.
   */
  constructor(showable: Showable, readonly source: string) {
    this.#showable = showable;

    (window as any).showFrame = (timeInMs: number) => {
      this.show(timeInMs);
    };
    (window as any).initScreenCapture = this.initScreenCapture.bind(this);
    (window as any).MainAnimation = this;

    // Without this setTimeout() the animation would
    // skip a lot of time in the beginning.  A lot of the setup time
    // would happen right after the first frame and after our clock
    // starts.
    setTimeout(() => {
      if (this.#disableAnimationLoop) {
        return;
      }
      let timeOffset = NaN;
      this.#animationLoop = new AnimationLoop((now) => {
        if (isNaN(timeOffset)) {
          timeOffset = now;
        }
        const time = now - timeOffset;
        this.show(time);
      });
    }, 1);
  }
  #disableAnimationLoop = false;
  #animationLoop: AnimationLoop | undefined;
  /**
   * Stop the real-time animation.
   *
   * A real-time animation always starts for debugging reasons.
   * It can get canceled for various reasons, including the video capture program connecting.
   *
   * This is just a little bit tricky inside because of the timing of different events.
   * However, that is **not** visible outside.
   * Call this method at any time to safely stop the real-time animation.
   *
   * Duplicate calls to this function are silently ignored.
   */
  disableAnimationLoop() {
    this.#disableAnimationLoop = true;
    this.#animationLoop?.cancel();
  }
}
