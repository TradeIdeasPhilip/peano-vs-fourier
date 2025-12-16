import { getById } from "phil-lib/client-misc";
import "./style.css";
import { MainAnimation } from "./main-animation";
import { makeAutoHider, makeShowableInSeries } from "./showable";
import { peanoIterations } from "./peano-iterations";
import { fourierIntro } from "./fourier-intro";

new MainAnimation(
  makeShowableInSeries([
    fourierIntro,
    makeAutoHider(1000, getById("placeholder1", SVGTextElement)),
    peanoIterations,
    makeAutoHider(5000, getById("placeholder2", SVGTextElement)),
  ]),
  "peano-vs-fourier"
);
