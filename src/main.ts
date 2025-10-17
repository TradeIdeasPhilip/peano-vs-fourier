import { getById, querySelector, querySelectorAll } from "phil-lib/client-misc";
import "./style.css";
import { type ReadOnlyRect } from "phil-lib/misc";
import { ParagraphLayout } from "./glib/paragraph-layout";
import { Font } from "./glib/letters-base";
import { createHandwriting } from "./glib/handwriting";
import { MainAnimation } from "./main-animation";
import {
  makeExclusiveInSeries,
  makeShowableInParallel,
  makeShowableInSeries,
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

/*
class HandwritingEffect {
  constructor() {
// TODO ParagraphLayout.drawPartial() only knows about the canvas.
// Need to add something similar for SVG.

  }
  #g : SVGGElement;
  get topLevelElement () { return this.#g}
  static make(parent:SVGElement,className ?:string):HandwritingEffect {
    const result = new this();
    parent.append(result);
  }
}
  */

const mainSVG = getById("main", SVGSVGElement);

const chapters: Showable[] = [];

const font = Font.cursive(2 / 3);

function makeChapterTitle(title: string, className: string, index: number) {
  const delayBefore = 500;
  const duration = 2500;
  const delayAfter = 1000;
  const layout = new ParagraphLayout(font);
  const wordInfo = layout.addText(title);
  const laidOut = layout.align();
  const pathShape = laidOut.singlePathShape();
  const handwriting = createHandwriting(pathShape);
  mainSVG.append(handwriting.topElement);
  handwriting.topElement.classList.add(className);
  const lineHeight = font.bottom - font.top;
  handwriting.topElement.style.transform = `translateY(${
    lineHeight * (index + 1)
  }px) translateX(${lineHeight * 0.5}px)`;
  const showable = handwriting.makeShowable({
    duration,
    delayAfter,
    delayBefore,
  });
  return showable;
}

function createPeanoPath(iteration: number, size = 1) {
  function getSegmentLength() {
    let length = 0;
    for (let i = 0; i < iteration; i++) {
      length = 2 + 3 * length;
    }
    return 1 / length;
  }
  const segmentLength = getSegmentLength();
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
   * Assuming we have enough
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

{
  // Script:
  // One large copy of the first iteration drawing.
  // Draw it with the handwriting effect.
  // Leave it in place when finished, where the second and third iterations will cover it.
  const peano0D = "M 0,1 V 0 H 0.5 V 1 H 1 V 0";
  const peano0Shape = createPeanoPath(1); //PathShape.fromString(peano0D);
  const peanoHandwriting = createHandwriting(peano0Shape);
  peanoHandwriting.topElement.id = "peano-1-main";
  mainSVG.append(peanoHandwriting.topElement);
  const peanoShowable = peanoHandwriting.makeShowable({ duration: 2000 });
  const chapterTitle = makeChapterTitle(
    "First iteration\nof Peano curve",
    "iteration-1-text",
    0
  );
  const chapter = makeShowableInParallel([peanoShowable, chapterTitle]);
  chapters.push(chapter);
}
{
  // Script:
  // Create a copy of the first iteration, but in white.
  // Create it in place, on top of the original.
  // Maybe use the handwriting effect to introduce it.
  // Then shrink it down the appropriate amount.
  // Keep the bottom left corner fixed in place and everything else moves toward that corner.
  // Keep the stroke width constant despite resizing the path.
  // Then make a copy of that small white version.
  // Flip it up into the next position, slightly above the first, upside down.
  // Then use a handwriting effect to add the missing bar connecting the first to the second.
  // Then flip the second one up to make the third.
  // The use handwriting effect to add the missing bar connecting the second to the third.
  // Then flip right, then down, then down again, then right again, the up again, then up again.
  const peanoShape = createPeanoPath(2); //PathShape.fromString(peano0D);
  const peanoHandwriting = createHandwriting(peanoShape);
  peanoHandwriting.topElement.id = "peano-2-main";
  mainSVG.append(peanoHandwriting.topElement);

  /**
   * Show the 5 exact copies of iteration 1 in iteration 2:
   * stroke-dasharray: 1 1.25;
   *  stroke-dashoffset: 0;
   *
   * Show the 4 reversed copies of iteration 1 in iteration 2:
   * stroke-dasharray: 1 1.25;
   * stroke-dashoffset: 1.125;
   *
   * Show all 9 copies of iteration 1 in iteration 2:
   * stroke-dasharray: 1 0.125;
   * stroke-dashoffset: 0;
   *
   * Show just the connective tissue.
   * 8 segments similar to the original in iteration 1, but broken apart.
   * Doesn't look very good.  🙁
   * stroke-dasharray: 0.125 1;
   * stroke-dashoffset: -1;
   *
   * Restore to normal:
   * $0.style['stroke-dashoffset']="";
   * $0.style['stroke-dasharray']="";
   *
   */

  const peanoShowable = peanoHandwriting.makeShowable({ duration: 6000 });

  function makeShowParts(): Showable {
    const style = querySelector(
      ":scope *",
      SVGPathElement,
      peanoHandwriting.topElement
    ).style;
    function hide() {
      style.strokeDashoffset = "";
      style.strokeDasharray = "";
    }
    function showAll() {
      style.strokeDashoffset = "0";
      style.strokeDasharray = "1 0.125";
    }
    function showExactCopies() {
      style.strokeDashoffset = "0";
      style.strokeDasharray = "1 1.25";
    }
    function showReversedCopies() {
      style.strokeDashoffset = "1.125";
      style.strokeDasharray = "1 1.25";
    }
    const result = makeExclusiveInSeries([
      { show: hide, endTime: 1000 },
      { show: showAll, endTime: 2000 },
      { show: showExactCopies, endTime: 2000 },
      { show: showReversedCopies, endTime: 2000 },
      { show: showAll, endTime: 2000 },
      { show: hide, endTime: 1000 },
    ]);
    return result;
  }

  const chapterTitle = makeChapterTitle(
    "Second iteration",
    "iteration-2-text",
    3
  );
  const chapter = makeShowableInParallel([
    makeShowableInSeries([peanoShowable, makeShowParts()]),
    chapterTitle,
  ]);
  chapters.push(chapter);
}

{
  // Script:
  // Analogous to the second iteration.
  // Make nine copies of the second iteration and connect them in the same way.
  const peanoShape = createPeanoPath(3); //PathShape.fromString(peano0D);
  const peanoHandwriting = createHandwriting(peanoShape);
  peanoHandwriting.topElement.id = "peano-3-main";
  mainSVG.append(peanoHandwriting.topElement);
  const peanoShowable = peanoHandwriting.makeShowable({ duration: 18000 });
  const chapterTitle = makeChapterTitle(
    "Third iteration",
    "iteration-3-text",
    5
  );
  const chapter = makeShowableInParallel([peanoShowable, chapterTitle]);
  chapters.push(chapter);
}

new MainAnimation(makeShowableInSeries(chapters), "peano-vs-fourier");
