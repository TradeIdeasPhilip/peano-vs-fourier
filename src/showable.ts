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
