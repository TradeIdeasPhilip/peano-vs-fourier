import { getById, querySelector, querySelectorAll } from "phil-lib/client-misc";
import "./style.css";
import { type ReadOnlyRect } from "phil-lib/misc";
import { ParagraphLayout } from "./glib/paragraph-layout";
import { Font } from "./glib/letters-base";
import { createHandwriting } from "./glib/handwriting";
import { MainAnimation } from "./main-animation";
import { makeRepeater } from "./showable";

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

const font = Font.cursive(1);
const layout = new ParagraphLayout(font);
const wordInfo = layout.addText("Hello world!");
const laidOut = layout.align(undefined, "center");
const pathShape = laidOut.singlePathShape();
const path = pathShape.makeElement();
mainSVG.append(path);
path.classList.add("simple-text");

const delayBefore = 500;
const duration = 2500;
const delayAfter = 1000;
const handwriting = createHandwriting(pathShape);
mainSVG.append(handwriting.topElement);
handwriting.topElement.classList.add("simple-text");
handwriting.topElement.style.transform = `translateY(${laidOut.height}px)`;
new MainAnimation(
  makeRepeater(handwriting.makeShowable({ duration, delayAfter, delayBefore })),
  "peano-vs-fourier"
);
