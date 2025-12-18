import "./style.css";
import { MainAnimation } from "./main-animation";
import { makeShowableInSeries, Showable } from "./showable";
import { peanoIterations } from "./peano-iterations";
import { fourierIntro } from "./fourier-intro";
import { peanoFourier } from "./peano-fourier";

/*
const peanoFourierShort :Showable = { duration:30000, show(timeInMs) {
  peanoFourier.show(timeInMs+30000);
},hide() {
  peanoFourier.hide();
},}
*/

const mainAnimation = new MainAnimation(
  makeShowableInSeries([peanoIterations, fourierIntro, peanoFourier]),
  "peano-vs-fourier"
);

/*
setTimeout(() => {
  mainAnimation.disableAnimationLoop();
  mainAnimation.show((2 * 60 + 21 + 18 / 30) * 1000);
  //  mainAnimation.show(28500 + 4500 * 79);
}, 500);
*/
