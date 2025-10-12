import { makeLinear } from "phil-lib/misc";
import { PathShape } from "./path-shape";

export function createHandwritingGroup(...pathShapes: PathShape[]) {
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
  function makeUpdater(from: number, to: number) {
    const scale = makeLinear(from, 0, to, totalLength);
    function update(time: number) {
      const position = scale(time);
      topElement.style.setProperty("--total-position", position.toString());
    }
    return update;
  }
  return { topElement, allPaths, makeUpdater };
}
