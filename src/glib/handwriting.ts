import { makeLinear } from "phil-lib/misc";
import { PathShape } from "./path-shape";

type Handwriting = {
  /**
   * A new <g> element containing your animation.
   * Attach this to an SVG to view it.
   */
  topElement: SVGGElement;
  /**
   * All of the SVG path elements that were created.
   *
   * This array and the input to createHandwritingGroup() are connected.
   * The path elements in the first index of this array came from the first PathShape in the input.
   * The path elements in the nth index of this array came from the nth PathShape in the input.
   *
   * This can be useful when you want to style different parts of the output differently.
   * Maybe one word in a paragraph layout should be stroked in red, while the rest are stroked in black.
   *
   * These are also available as children of the `topElement`, which can be an easy way to style all of the text.
   */
  allPaths: SVGPathElement[][];
  /**
   * Use this to update the animation.
   * @param time What point in the animation should we draw?
   * These are scaled to match the inputs to `createHandwriting()`
   * Values before or at the `fromTime` will display nothing.
   * Values at or after the `toTime` will display the entire path.
   */
  show(time: number): void;
};

/**
 * Draw a shape (often text) by tracing out the outline.
 * @param fromTime When to start displaying things.
 * @param toTime When everything should be on the screen.
 * @param pathShapes What to display.
 * @returns An object used to operate the animation.
 */
export function createHandwriting(
  fromTime: number,
  toTime: number,
  ...pathShapes: PathShape[]
): Handwriting {
  const topElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  topElement.classList.add("handwriting");
  const allPaths: SVGPathElement[][] = [];
  let soFar = 0.01;
  pathShapes.forEach((pathShape) => {
    const paths = new Array<SVGPathElement>();
    const pieces = pathShape.splitOnMove();
    pieces.forEach((piece) => {
      const element = piece.makeElement();
      paths.push(element);
      topElement.appendChild(element);
      const before = soFar;
      const length = piece.getLength();
      const after = before + length;
      soFar = after;
      element.style.setProperty("--offset", before.toString());
      element.style.setProperty("--length", length.toString());
    });
    allPaths.push(paths);
  });
  const totalLength = soFar;
  const scale = makeLinear(fromTime, 0, toTime, totalLength);
  function show(time: number) {
    const position = scale(time);
    topElement.style.setProperty("--total-position", position.toString());
  }
  return { topElement, allPaths, show };
}
