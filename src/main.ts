import { getById, querySelector, querySelectorAll } from "phil-lib/client-misc";
import "./style.css";
import {
  assertFinite,
  initializedArray,
  makeLinear,
  type ReadOnlyRect,
} from "phil-lib/misc";
import { ParagraphLayout } from "./glib/paragraph-layout";
import { Font } from "./glib/letters-base";
import { createHandwriting } from "./glib/handwriting";
import { MainAnimation } from "./main-animation";
import {
  addMargins,
  MakeShowableInParallel,
  MakeShowableInSeries,
  Showable,
} from "./showable";
import { LCommand, PathShape } from "./glib/path-shape";

const numberOfFourierSamples = 1024;

/**
 * This knows about the SVG elements implementing this effect.
 * And this knows about the screen real estate reserves for this effect.
 * These are closely related as we use the SVG element to transform the effect to make it fit.
 */
class Destination {
  readonly #gElement: SVGGElement;
  readonly #referencePath: SVGPathElement;
  readonly #livePath: readonly SVGPathElement[];
  constructor(
    top: SVGGElement,
    readonly getTransform: (content: ReadOnlyRect) => DOMMatrix
  ) {
    this.#gElement = top;
    this.#referencePath = querySelector(
      "[data-reference]",
      SVGPathElement,
      this.#gElement
    );
    this.#livePath = querySelectorAll(
      "[data-live]",
      SVGPathElement,
      1,
      Infinity,
      this.#gElement
    );
  }
  hide() {
    this.#gElement.style.display = "none";
  }
  show(referenceColor: string, _liveColor: string) {
    this.#gElement.style.display = "";
    this.#referencePath.style.stroke = referenceColor;
    //this.#livePath.style.stroke = liveColor;
  }
  setReferencePath(d: string) {
    this.#referencePath.setAttribute("d", d);
  }
  setLivePath(d: string) {
    this.#livePath.forEach((path) => path.setAttribute("d", d));
  }
  setTransform(transform: DOMMatrix) {
    const scale = transform.a;
    this.#gElement.style.transform = transform.toString();
    this.#gElement.style.setProperty("--path-scale", scale.toString());
  }
  // static right = new Destination(
  //   getById("right", SVGGElement),
  //   (content: ReadOnlyRect) =>
  //     panAndZoom(
  //       content,
  //       { x: 1, y: 1, width: 14, height: 7 },
  //       "srcRect fits completely into destRect",
  //       1
  //     )
  // );
}

const mainSVG = getById("main", SVGSVGElement);

const font = Font.cursive(0.55);

function makeChapterTitle(title: string, className: string) {
  const delayBefore = 500;
  const duration = (2500 / 30) * ((title.length * 2 + 30) / 3);
  const delayAfter = 1000;
  const layout = new ParagraphLayout(font);
  const wordInfo = layout.addText(title);
  const laidOut = layout.align();
  const pathShape = laidOut.singlePathShape();
  const handwriting = createHandwriting(pathShape);
  mainSVG.append(handwriting.topElement);
  handwriting.topElement.classList.add(className);
  const showable = handwriting.makeShowable({
    duration,
    delayAfter,
    delayBefore,
  });
  return showable;
}

function getSegmentLength(iteration: number) {
  let length = 0;
  for (let i = 0; i < iteration; i++) {
    length = 2 + 3 * length;
  }
  return 1 / length;
}

/**
 *
 * @param iteration 1 for the simplest path, 3 vertical lines and two horizontal lines.
 * @param size How big to make the result.  The will be the width and the height.
 * The number is in SVG userspace units.
 * @returns The requested PathShape.  It is made exclusively of L commands.  And every L command is the same length.
 * The horizontal segments are all a single L command.
 * The verticals segments are all 2 or 5 L commands.
 */
function createPeanoPath(iteration: number, size = 1) {
  const segmentLength = getSegmentLength(iteration);
  function create(iteration: number, up: boolean, right: boolean) {
    if (iteration == 0) {
      return "";
    }
    const previous = iteration - 1;
    const vSegment = ` v ${segmentLength * (up ? -1 : 1)}`;
    const altVSegment = ` v ${segmentLength * (up ? 1 : -1)}`;
    const hSegment = ` h ${segmentLength * (right ? 1 : -1)}`;
    let result = "";
    result += create(previous, up, right);
    result += vSegment;
    result += create(previous, up, !right);
    result += vSegment;
    result += create(previous, up, right);
    result += hSegment;
    result += create(previous, !up, right);
    result += altVSegment;
    result += create(previous, !up, !right);
    result += altVSegment;
    result += create(previous, !up, right);
    result += hSegment;
    result += create(previous, up, right);
    result += vSegment;
    result += create(previous, up, !right);
    result += vSegment;
    result += create(previous, up, right);
    return result;
  }
  const fullString = "M 0 1" + create(iteration, true, true);
  /**
   * The original sequence of commands.
   * These were created in such a way that every one has the exact same length.
   * If you see one segment on the screen that is 5✕ as long as the shortest segment, it is actually made out of 5 commands in this list.
   */
  const verboseCommands = PathShape.fromString(fullString).commands;
  /**
   * Build a new list of commands that is equivalent to {@link verboseCommands} but shorter.
   * This is not strictly necessary, but it might help the Fourier process to have fewer segments.
   * You will need at least one sample per segment.
   * If you have unnecessary segments then you might have to take a lot more samples and the Fourier algorithm will take longer **for each frame**.
   *
   * That logic is not completely sound.
   * I was thinking about the biggest hilbert curve in https://youtu.be/L92xpvGKi4A?si=Gg4P_WXTeHm0WeGL.
   * I was using 1024 samples for all of my work, and that curve just barely fit.
   * To do a good job we probably don't want to push the limits; it's not unreasonable for a longer segment to have multiple samples inside of it.
   *
   * I did this mostly for curiosity.
   * The number of segments in the "verbose" column describes the length of the path.
   * The number of segments in the "terse" column describes the number of segments that go all the way from corner to corner.
   * | Iteration | verbose | terse |
   * | -------: | ------: | -------: |
   * | 0 | 0 | 0 |
   * | 1 | 8 | 5 |
   * | 2 | 80 | 41 |
   * | 3 | 728 | 365 |
   * | 4 | 6,560 | 3,281 |
   * | 5 | 59,048 | 29,525 |
   *
   * Peano curve 3 fits into our standard 1,024 samples with plenty of room to spare.
   * But we'd need to ask for *a lot* more samples to do the bare minimum for Peano curves 4 and 5.
   */
  const terseCommands = new Array<LCommand>();
  verboseCommands.forEach((command) => {
    // Any time we see two line commands in a row with identical angles, combine them.
    if (!(command instanceof LCommand)) {
      throw new Error("wtf");
    }
    const previous = terseCommands.at(-1);
    if (
      previous != undefined &&
      previous.outgoingAngle == command.incomingAngle
    ) {
      const combined = new LCommand(
        previous.x0,
        previous.y0,
        command.x,
        command.y
      );
      terseCommands.pop();
      terseCommands.push(combined);
    } else {
      // Add the command as is.
      terseCommands.push(command);
    }
  });
  const result = new PathShape(terseCommands);
  if (result.splitOnMove().length > 1) {
    throw new Error("wtf");
  }
  return result;
}
(window as any).createPeanoPath = createPeanoPath;

/**
 * Create an animation morphing between one iteration of the Peano curve and another.
 * @param duration The total time in milliseconds.  This includes delay on both sides.
 * @param delay The time in milliseconds to display the initial state before starting to morph.
 * @param endDelay The time in milliseconds to hold the final state, after the morph, before hiding.
 * @param from Initial state.  `iteration == 1` is the smallest legal value.
 * @param to Final state.  `to.iteration` must be larger than `from.iteration`.
 * @param midColors Additional colors to use between from.color and to.color.
 * The default transition between red and var(--blue) (blue with a little green for brightness) got muddy in the middle.
 * Those two colors are almost complements, so middle state was very desaturated.
 * Now I explicitly put violet in between red and var(--blue).
 * That basically makes purple in between red and blue.
 * I picked that shade of violet because it kept the value of the color consistent through the transition.
 * @returns
 */
function createExpander(
  duration: number,
  delay: number,
  endDelay: number,
  from: { iteration: number; color: string; strokeWidth: string },
  to: { iteration: number; color: string; strokeWidth: string },
  midColors: string[] = []
): Showable {
  assertFinite(from.iteration, to.iteration);
  if (
    !Number.isSafeInteger(from.iteration) ||
    !Number.isSafeInteger(to.iteration) ||
    from.iteration < 1 ||
    to.iteration <= from.iteration
  ) {
    throw new Error("wtf");
  }
  /**
   * This is the number of _spaces between_ the vertical lines in the "from" curve.
   *
   * The vertical lines will have indices between 0 and this, inclusive.
   * Divide an index by this to get an x position, a value between 0 and 1 inclusive.
   *
   * This is the width of the curve, measured in the number of segments needed to go straight across.
   *
   * This is also the height of the curve, which always fits in a square.
   * That is less obvious because you never see a single vertical segment.
   * They always appear in groups of 2 or 5.
   */
  const fromCountVertical = Math.round(1 / getSegmentLength(from.iteration));
  /**
   * This is the number of _spaces between_ the vertical lines in the "to" curve.
   *
   * The vertical lines will have indices between 0 and this, inclusive.
   * Divide an index by this to get an x position, a value between 0 and 1 inclusive.
   */
  const toCountVertical = Math.round(1 / getSegmentLength(to.iteration));
  /**
   * How many different vertical line positions in the "to" curve are matched to each vertical line position in the "from curve".
   *
   * Probably a power of 3.
   */
  const inEachVerticalGroup = (toCountVertical + 1) / (fromCountVertical + 1);
  if (!Number.isSafeInteger(inEachVerticalGroup)) {
    throw new Error("wtf");
  }
  /**
   * The input says which vertical line we are discussing in the "to" curve.
   * This is a value between 0 and fromCountVertical, inclusive.
   *
   * The output is a number between 0 and 1, inclusive.
   * This is the position to draw the line in the "from" curve.
   */
  const fromX = initializedArray(toCountVertical + 1, (toIndex) => {
    const fromIndex = Math.floor(toIndex / inEachVerticalGroup);
    const x = fromIndex / fromCountVertical;
    return x;
  });
  /**
   * How many copies of the simplest (iteration= 1) version of the curve are included in the "from" curve.
   * Across _or_ down, __not__ area!
   *
   * Note that there is a small connector _between_ each of the simple versions.
   */
  const numberOfCopies = (fromCountVertical + 1) / 3;
  const fromY: number[] = [];
  for (let i = 0; i < numberOfCopies; i++) {
    const fromSectionBottom = i * 3;
    const fromSectionTop = fromSectionBottom + 2;
    const toSectionPeriod = (toCountVertical + 1) / numberOfCopies;
    const toSectionBottom = i * toSectionPeriod;
    const toSectionSize = toSectionPeriod - 1;
    const toSectionTop = toSectionBottom + toSectionSize;
    const getY = makeLinear(
      toSectionBottom,
      fromSectionBottom / fromCountVertical,
      toSectionTop,
      fromSectionTop / fromCountVertical
    );
    for (let j = 0; j <= toSectionSize; j++) {
      fromY.push(getY(toSectionBottom + j));
    }
  }
  //return { fromX, fromY };
  const toPath = createPeanoPath(to.iteration);
  const fromPath = new PathShape(
    toPath.commands.map((command) => {
      function translateX(x: number) {
        const index = Math.round(x * toCountVertical);
        return fromX[index];
      }
      function translateY(y: number) {
        const index = Math.round(y * toCountVertical);
        return fromY[index];
      }
      return new LCommand(
        translateX(command.x0),
        translateY(command.y0),
        translateX(command.x),
        translateY(command.y)
      );
    })
  );
  const pathElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  const animation = pathElement.animate(
    {
      strokeWidth: [from.strokeWidth, to.strokeWidth],
      stroke: [from.color, ...midColors, to.color],
      d: [fromPath.cssPath, toPath.cssPath],
    },
    {
      fill: "both",
      duration: duration - delay - endDelay,
      easing: "ease-out",
    }
  );
  animation.pause();
  pathElement.style.transform = "translate(0.5px, 1.5px) scale(7)";
  pathElement.style.strokeLinecap = "square";
  pathElement.style.fill = "none";
  pathElement.style.strokeWidth = "0.05";
  mainSVG.append(pathElement);
  return {
    duration,
    show(timeInMs) {
      pathElement.style.display = "";
      animation.currentTime = timeInMs - delay;
    },
    hide() {
      pathElement.style.display = "none";
    },
  };
}
const state1 = { iteration: 1, color: "red", strokeWidth: "0.045" };
const state2 = {
  iteration: 2,
  color: "white",
  strokeWidth: "0.03",
};
const state3 = {
  iteration: 3,
  color: "var(--blue)",
  strokeWidth: "0.015",
};
//const morph12 = createExpander(state1, state2);
//const morph13 = createExpander(state1, state3, ["rgb(128, 0, 255)"]);
//const morph23 = createExpander(state2, state3);

const builder = new MakeShowableInParallel();
const inSeries = new MakeShowableInSeries();

{
  // Script:
  // One large copy of the first iteration drawing.
  // Draw it with the handwriting effect.
  // Leave it in place when finished, where the second and third iterations will cover it.
  const peano0Shape = createPeanoPath(1); //PathShape.fromString(peano0D);
  const peanoHandwriting = createHandwriting(peano0Shape);
  peanoHandwriting.topElement.id = "peano-1-main";
  mainSVG.append(peanoHandwriting.topElement);
  const peanoShowable = peanoHandwriting.makeShowable({ duration: 2000 });
  const chapterTitle = makeChapterTitle(
    "First iteration of Peano curve",
    "iteration-1-text"
  );
  builder.add(
    addMargins(chapterTitle, {
      hiddenBefore: inSeries.duration,
      frozenAfter: Infinity,
    }),
    0
  );
  builder.add(
    addMargins(peanoShowable, {
      hiddenBefore: inSeries.duration,
      frozenAfter: Infinity,
    })
  );
  inSeries.skip(Math.max(chapterTitle.duration, peanoShowable.duration) + 500);
}
{
  const peanoShape = createPeanoPath(2);
  const peanoHandwriting = createHandwriting(peanoShape);
  peanoHandwriting.topElement.id = "peano-2-main";
  mainSVG.append(peanoHandwriting.topElement);

  const duration = 6000;
  const peanoShowable = peanoHandwriting.makeShowable({ duration });

  const chapterTitle = makeChapterTitle("Second", "iteration-2-text");
  builder.add(
    addMargins(chapterTitle, {
      hiddenBefore: inSeries.duration,
      frozenAfter: Infinity,
    }),
    0
  );
  builder.add(
    addMargins(peanoShowable, {
      hiddenBefore: inSeries.duration,
      frozenAfter: Infinity,
    })
  );

  const initialPause = 500;
  const finalPause = 1000;
  const expander = createExpander(
    duration,
    initialPause,
    finalPause,
    state1,
    state2
  );

  inSeries.add(expander);
}

{
  const peanoShape = createPeanoPath(3);
  const peanoHandwriting = createHandwriting(peanoShape);
  peanoHandwriting.topElement.id = "peano-3-main";
  mainSVG.append(peanoHandwriting.topElement);
  const peanoShowable = peanoHandwriting.makeShowable({ duration: 18000 });

  const chapterTitle = makeChapterTitle("Third", "iteration-3-text");
  builder.add(
    addMargins(chapterTitle, {
      hiddenBefore: inSeries.duration,
      frozenAfter: Infinity,
    }),
    0
  );
  builder.add(
    addMargins(peanoShowable, {
      hiddenBefore: inSeries.duration,
      frozenAfter: Infinity,
    })
  );

  const expander1 = createExpander(9000, 500, 1500, state2, state3);
  const expander2 = createExpander(9000, 1000, 1500, state1, state3);
  inSeries.add(expander1);
  inSeries.add(expander2);
}

builder.add(inSeries.build());

new MainAnimation(builder.build(), "peano-vs-fourier");
