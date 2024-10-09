import { Sign } from "crypto";
import { Ele, Note, Mark, Metadata, PageConfig, FontFamily } from "./types";
import { PAGE, MODE_LETTER, ACCI, MARK, BARL } from "./svgraw";
import { MARK_NAME } from "./svgraw";
import { NOTE_GENERAL, NOTE_ClASSIC, NOTE_MODERN, NOTE_ROMAN } from "./svgraw";
import { SMALL_CLASSIC, SMALL_MODERN, SMALL_ROMAN } from "./svgraw";

const FONTSIZE_FIX = 0.8355;

type Pos = { x: number; y: number };

let CONFIG: PageConfig;
export function initSVG(config: PageConfig, metadata: Metadata) {
  CONFIG = config;
}

export function use(ele: Ele | Mark, { x, y }: Pos) {
  function node2code(ele: Note) {
    let str = String(ele.pitch);
    if (ele.accidental)
      str += ({ sharp: "#", flat: "$", natural: "=" } as const)[ele.accidental];
    str += ele.range >= 0 ? "'".repeat(ele.range) : ",".repeat(-ele.range);
    str += "/".repeat(Math.log2(ele.duration) - 2);
    return str;
  }
  // todo: 注册 def
  if (ele.cate === "Mark") {
    if (ele.type === "tuplets") {
    } else if (ele.type === "legato") {
    } else if (ele.type === "volta") {
    } else {
      const svgName = MARK_NAME[ele.type];
    }
  } else if (ele.cate === "Note") {
    if (ele.pitch === 9) {
      return `<use x="${x}" y="${y}" xlink:href="#shuzi_x" time="${
        4 / ele.duration
      }" audio="9" notepos="${0 /* todo */}" code="node2code(
        ele
      )" xmlns:xlink="http://www.w3.org/1999/xlink"></use>`;
    } else {
      return `<use x="${x}" y="${y}" xlink:href="#shuzi_${
        ({ modern: "a", roman: "b", classic: "c" } as const)[CONFIG.note]
      }_${ele.pitch}" time="${4 / ele.duration}" audio="${
        ele.pitch
      }" notepos="${0 /* todo */}" code="${node2code(
        ele
      )}" xmlns:xlink="http://www.w3.org/1999/xlink"></use>`;
    }
  } else if (ele.cate === "Sign") {
    if (ele.type === "fermata") {
      return `<use x="${x}" y="${y}" xlink:href="#yanyinfu" time="1" audio="" notepos="${
        0 /* todo */
      }" code="-" xmlns:xlink="http://www.w3.org/1999/xlink"></use>`;
    } else if (ele.type === "bracket") {
    }
  } else if (ele.cate === "Barline") {
  }
}

type TextConfig = {
  font: FontFamily;
  size: number;
  bold: boolean;
  anchor: "start" | "middle" | "end";
};

export const text = (
  text: string,
  { x, y }: Pos,
  { font, size, bold, anchor }: TextConfig
) =>
  `<text x="${x}" y="${y}" dy="${FONTSIZE_FIX * size}" ${
    anchor !== "start" ? `text-anchor="${anchor}"` : ""
  } fill="#1b1b1b" ${
    bold ? `style="font-weight:bold;"` : ""
  } font-size="${size}" font-family="${font}">${text}</text>`;

export function expDef() {}
