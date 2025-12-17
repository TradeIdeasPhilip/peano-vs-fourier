import { getById } from "phil-lib/client-misc";
import "./style.css";
import { MainAnimation } from "./main-animation";
import { makeAutoHider, makeShowableInSeries } from "./showable";
import { peanoIterations } from "./peano-iterations";
import { fourierIntro } from "./fourier-intro";
import { peanoFourier } from "./peano-fourier";

new MainAnimation(
  makeShowableInSeries([
    peanoFourier,
    makeAutoHider(1000, getById("placeholder1", SVGTextElement)),
    fourierIntro,
    makeAutoHider(5000, getById("placeholder2", SVGTextElement)),
    peanoIterations,
  ]),
  "peano-vs-fourier"
);
