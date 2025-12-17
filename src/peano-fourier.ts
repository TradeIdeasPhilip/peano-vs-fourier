import { getById, querySelectorAll } from "phil-lib/client-misc";
import { createPeanoPath } from "./peano-shared";
import { simpleDestination } from "./fourier-shared";
import { commonHider, MakeShowableInSeries, Showable } from "./showable";

const SIZE = new DOMMatrix("translate(-2px, -2px) scale(4)");
const paths = [
  createPeanoPath(1).transform(SIZE),
  createPeanoPath(2).transform(SIZE),
  createPeanoPath(3).transform(SIZE),
];

const destinations = querySelectorAll("[data-pf]", SVGPathElement).map(
  (pathElement) => simpleDestination(pathElement)
);

destinations.forEach((destination,index) => {
  destination.show(paths[index].rawPath);
});

const topElement = getById("peano-fourier", SVGGElement);

const builder = new MakeShowableInSeries;
builder.skip(15000)

export const peanoFourier: Showable = commonHider(builder.build(), topElement);