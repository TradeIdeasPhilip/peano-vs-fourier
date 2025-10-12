import {
  AnimationLoop,
  getById,
  querySelector,
  querySelectorAll,
} from "phil-lib/client-misc";
import "./style.css";
import { type ReadOnlyRect } from "phil-lib/misc";
import { ParagraphLayout } from "./glib/paragraph-layout";
import { Font } from "./glib/letters-base";
import { createHandwriting } from "./glib/handwriting";

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

class MainAnimation {
  readonly #showable: Showable;
  show(timeInMS: number) {
    this.#showable.show(timeInMS);
  }
  get endTime() {
    return this.#showable.endTime;
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
      source: "peano-vs-fourier",
      script,
      seconds: this.#showable.endTime / 1000,
      devicePixelRatio,
    };
  }
  constructor(showable: Showable) {
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
  disableAnimationLoop() {
    this.#disableAnimationLoop = true;
    this.#animationLoop?.cancel();
  }
}

type Showable = { show(timeInMs: number): void; readonly endTime: number };

function makeShowableInParallel(...all: Showable[]): Showable {
  const endTime = Math.max(...all.map((showable) => showable.endTime));
  function show(timeInMs: number) {
    all.forEach((showable) => showable.show(timeInMs));
  }
  return { endTime, show };
}

function makeShowableInSeries(...all: Showable[]): Showable {
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

const font = Font.cursive(1);
const layout = new ParagraphLayout(font);
const wordInfo = layout.addText("Hello world!");
const laidOut = layout.align(undefined, "center");
const pathShape = laidOut.singlePathShape();
const path = pathShape.makeElement();
mainSVG.append(path);
path.classList.add("simple-text");

const delayBeforeDraw = 500;
const timeToDraw = 3000;
const period = 4000;
const handwriting = createHandwriting(delayBeforeDraw, timeToDraw, pathShape);
mainSVG.append(handwriting.topElement);
handwriting.topElement.classList.add("simple-text");
handwriting.topElement.style.transform = `translateY(${laidOut.height}px)`;
new MainAnimation({
  show(timeInMs) {
    timeInMs %= period;
    handwriting.show(timeInMs);
  },
  endTime: Infinity,
});
