import { makeBoundedLinear, positiveModulo } from "phil-lib/misc";

export type Showable = {
  show(timeInMs: number): void;
  hide(): void;
  readonly duration: number;
};

function notNegative(value: number) {
  if (value < 0 || Number.isNaN(value)) {
    throw new Error("wtf");
  }
}

export class MakeShowableInParallel {
  readonly #all: Showable[] = [];
  #duration = 0;
  add(showable: Showable, duration = showable.duration) {
    notNegative(duration);
    this.#all.push(showable);
    this.#duration = Math.max(this.#duration, duration);
  }
  build(): Showable {
    const duration = this.#duration;
    const all = this.#all;
    const end = all.length;
    const show = (timeInMS: number) => {
      for (let i = 0; i < end; i++) {
        all[i].show(timeInMS);
      }
    };
    const hide = () => {
      for (let i = 0; i < end; i++) {
        all[i].hide();
      }
    };
    return { duration, show, hide };
  }
}

export function makeShowableInParallel(all: Showable[]): Showable {
  all = [...all];
  const duration = Math.max(...all.map((showable) => showable.duration));
  function show(timeInMs: number) {
    all.forEach((showable) => showable.show(timeInMs));
  }
  function hide() {
    all.forEach((showable) => showable.hide());
  }
  return { duration, show, hide };
}

export class MakeShowableInSeries {
  #duration = 0;
  get duration() {
    return this.#duration;
  }
  readonly #children = new Array<Showable>();
  readonly #toShow = new Array<{
    start: number;
    showable: Showable;
  }>();
  #used = false;
  add(showable: Showable) {
    if (this.#used) {
      throw new Error("wtf");
    }
    const newEntry = { start: this.#duration, showable };
    notNegative(showable.duration);
    this.#duration += showable.duration;
    this.#toShow.push(newEntry);
  }
  skip(duration: number) {
    if (this.#used) {
      throw new Error("wtf");
    }
    notNegative(duration);
    this.#duration += duration;
  }
  build() {
    if (this.#used) {
      throw new Error("wtf");
    }
    this.#used = true;
    const duration = this.duration;
    const show = (timeInMs: number) => {
      // TODO this is wrong.  We should not be calling hide from show.
      // We should be asserting that someone else called hide.
      // Required before each call to show().
      let toShowNow: (() => void) | undefined;
      this.#toShow.forEach(({ start, showable }) => {
        const localTime = timeInMs - start;
        if (localTime >= 0 && localTime <= showable.duration) {
          // This item can be shown now.
          toShowNow = () => {
            showable.show(localTime);
          };
        }
        showable.hide();
      });
      toShowNow?.();
    };
    const hide = () => {
      this.#toShow.forEach(({ showable }) => {
        showable.hide();
      });
    };
    return { duration, show, hide };
  }
}

/**
 * Create a new showable that contains all of the inputs as children.
 * The new composite showable's duration will be the sum of the durations of all children.
 *
 * Each call to the composite's show() will call show() on at most one of the inputs, and will call hide() on the others.
 * All hide() calls will be done before the optional call to show().
 * This is important in case any of the inputs are sharing any resources.
 * An input will only be called at times between 0 and duration.
 * If a time is exactly on the boundary of two inputs, only the later input will be shown.
 * That means that any input could be shown at time 0.
 * But only the last input in the list could be called at time == duration.
 * @param children The child items to show.
 * @returns A new showable.
 */
export function makeShowableInSeries(children: Showable[]): Showable {
  const builder = new MakeShowableInSeries();
  children.forEach((showable) => {
    builder.add(showable);
  });
  return builder.build();
}

/**
 * Create a new showable that calls the original over and over.
 * This can be useful for a background pattern that goes on forever, or as long as the foreground action continues.
 * And in test it often makes sense to repeat the current scene over and over.
 * @param showable The action to repeat
 * @param count How many times to repeat the action.
 * This can be Infinity.
 * Otherwise, calling this after the last repeat will freeze the time at the end of the period.
 * @returns A new `Showable` object that will call the original multiple times.
 */
export function makeRepeater(showable: Showable, count = Infinity): Showable {
  const period = showable.duration;
  const repeaterDuration = count * period;
  function show(timeInMS: number) {
    const iteration = Math.floor(timeInMS / period);
    if (iteration >= count) {
      showable.show(period);
    } else {
      const timeWithinPeriod = positiveModulo(timeInMS, period);
      showable.show(timeWithinPeriod);
    }
  }
  function hide() {
    showable.hide();
  }
  return { duration: repeaterDuration, show, hide };
}

// makeShowableInSeries() takes two types of items.
// Actual items work more or less like they do now.
// But we add placeholders.
// A placeholder doesn't have a show() or a hide().
// A placeholder has a duration and that will reserve space as normal.
// The duration can be 0 but cannot be negative.
// None of the other items will run at the reserved time.
// For each placeholder, makeShowableInSeries() will return a start time,
// the time when this item would have started if it were not a placeholder.
// The caller can modify that as desired, maybe starting early or ending late.
// The caller can then use makeShowableInParallel() to join these modified showable objects
// and the new showable that handles the non-placeholder-items.
// Will these nest?

// Or makeShowableInSeries() becomes builder object.
// builder.add(nextShowable);
// const mark1 = builder.duration;  // The current duration
// builder.skip(7000); // An empty showable, or something more efficient, with this duration.
// const series : Showable = builder.build();

/**
 * This ensures that the base will be hidden before and after it's requested time slot.
 * @param base Show this items.
 * @param before Wait this many milliseconds before showing `base`.
 * @param after Wait this many milliseconds after showing `base`.
 * @returns
 */
export function addMargins(
  base: Showable,
  extra: {
    hiddenBefore?: number;
    hiddenAfter?: number;
    frozenBefore?: number;
    frozenAfter: number;
  }
): Showable {
  const builder = new MakeShowableInSeries();
  if (extra.hiddenBefore !== undefined) {
    builder.skip(extra.hiddenBefore);
  }
  if (extra.frozenBefore !== undefined) {
    builder.add({
      duration: extra.frozenBefore,
      show() {
        base.show(0);
      },
      hide() {
        base.hide();
      },
    });
  }
  builder.add(base);
  if (extra.frozenAfter !== undefined) {
    builder.add({
      duration: extra.frozenAfter,
      show() {
        base.show(base.duration);
      },
      hide() {
        base.hide();
      },
    });
  }
  if (extra.hiddenAfter !== undefined) {
    builder.skip(extra.hiddenAfter);
  }
  return builder.build();
}
// TODO should probably rewrite the handwriting effect and the morph so they don't add margins themselves.
// They build something simple and then someone calls addMargins().

/**
 * This is often done for efficiency, simplicity and safety.
 * You can have several different scenes, each wrapped in one of these.
 * You can disable all of the scenes by hiding one DOM element per scene.
 * You have to touch each of the live elements every frame, but not all of the hidden ones.
 * @param duration Total time to run this showable.
 * @param element The element to show on every show() and to hide on every hide()
 * @param showAlso Also do this in calls to show().
 * @param hideAlso Alo do this in calls to hide().
 * @returns
 */
function makeAutoHider(
  duration: number,
  element: HTMLElement | SVGElement,
  showAlso = (timeInMS: number) => {},
  hideAlso = () => {}
): Showable {
  function show(timeInMS: number) {
    element.style.display = "";
    showAlso(timeInMS);
  }
  function hide() {
    element.style.display = "none";
    hideAlso();
  }
  return { duration, show, hide };
}

/**
 * This is a wrapper around makeAutoHider() which makes the common case easy.
 * It uses base.duration and base.show(), but it explicitly ignores base.hide().
 * @param base The source of the duration and the show() function.
 * @param element To auto hide and show.
 * @returns
 */
function commonHider(base: Showable, element: HTMLElement | SVGElement) {
  return makeAutoHider(base.duration, element, base.show.bind(base));
}

// If duration == infinity
// If you have a series of Showable objects, +infinity should be allowed for the last duration,
// trying to add or skip more after that throws an exception
// If you have a set of Showable objects in parallel, then the duration of the whole should be the max of all finite durations of the children.
// Or not, maybe there's an explicit way to say "don't include this duration when computing the total duration".
// Yes, let's make it explicit.
// Yuck, start and end are not symmetric.
// You have to set a start time in addMargins.
// Before that time nothing shows.
// But you can create an infinite hold time at the end.
// So the animation could keep showing its final frame forever.
// This is relevant in a makeParallel() which will shut it off when other operations finish.
// What about the top level debug?
// Do we want to freeze the last frame?
// NaN and all negative numbers, including -infinity, are never valid durations.
// TODO check if serial is already infinity.  I think the rest has already been done.
