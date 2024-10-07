import { Sign } from "crypto";
import { Ele, Mark, Metadata, PageConfig } from "./types";
import { PAGE, MODE_LETTER, ACCI, MARK, BARL } from "./svgraw";
import { NOTE_GENERAL, NOTE_ClASSIC, NOTE_MODERN, NOTE_ROMAN } from "./svgraw";
import { SMALL_CLASSIC, SMALL_MODERN, SMALL_ROMAN } from "./svgraw";

type Pos = { x: number; y: number };

export function initSVG(config: PageConfig, metadata: Metadata) {}

export function use(element: Ele | Mark, { x, y }: Pos) {}

export function expDef() {}
