import { getById, querySelector, querySelectorAll } from "phil-lib/client-misc";
import "./style.css";
import {
  type ReadOnlyRect,
} from "phil-lib/misc";
import { MainAnimation } from "./main-animation";
import {
  makeAutoHider,
  makeShowableInSeries,
} from "./showable";
import { peanoIterations } from "./peano-iterations";

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

new MainAnimation(
  makeShowableInSeries([
    makeAutoHider(1000, getById("placeholder1", SVGTextElement)),
    peanoIterations,
    makeAutoHider(5000, getById("placeholder2", SVGTextElement)),
  ]),
  "peano-vs-fourier"
);
