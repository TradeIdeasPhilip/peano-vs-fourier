import { makeBoundedLinear, positiveModulo } from "phil-lib/misc";

export type Showable = {
  show(timeInMs: number): void;
  readonly endTime: number;
};

export function makeShowableInParallel(all: Showable[]): Showable {
  all = [...all];
  const endTime = Math.max(...all.map((showable) => showable.endTime));
  function show(timeInMs: number) {
    all.forEach((showable) => showable.show(timeInMs));
  }
  return { endTime, show };
}

/**
 * Create a new showable that contains all of the inputs as children.
 * The new composite showable's duration will be the sum of the durations of all children.
 *
 * Each call to the composite's show() function will call all of children's show() functions.
 * However, the time will be offset for each one.
 * The time will be less than 0 before the item should be shown.
 * The time will be exactly 0 right when the item should first be shown.
 * The time will be exactly the item's duration at the end of the time when the item should be shown.
 * The item can decide what to do before or after it should be shown.
 * @param all The child items to show.
 * @returns A new showable.
 */
export function makeShowableInSeries(all: Showable[]): Showable {
  all = [...all];
  let start = 0;
  const toShow = all.map((showable) => {
    const result = { start, showable };
    start += showable.endTime;
    return result;
  });
  const endTime = start;
  function show(timeInMs: number) {
    toShow.forEach(({ start, showable }) => showable.show(timeInMs - start));
  }
  return { endTime, show };
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
  const period = showable.endTime;
  const repeaterEndTime = count * period;
  function show(timeInMS: number) {
    const iteration = Math.floor(timeInMS / period);
    if (iteration >= count) {
      showable.show(period);
    } else {
      const timeWithinPeriod = positiveModulo(timeInMS, period);
      showable.show(timeWithinPeriod);
    }
  }
  return { endTime: repeaterEndTime, show };
}
