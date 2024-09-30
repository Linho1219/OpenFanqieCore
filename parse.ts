/*
 * 将脚本内容解析为对象。
 */

/** 描述头 */
type Metadata = {
  /** V-版本号：
   *  用来指定当前谱脚本是使用哪个版本的脚本规范，主要是因为后期可能会对脚本规范进行调整，衍生出不同的版本规范。*/
  version?: string;
  /** B-标题：
   *  B 字段可多次出现。第一次出现将被认为是主标题，第二次以后出现的被认为是附标题。*/
  title: Array<string>;
  /** Z-作者：
   *  Z 字段可多次出现。作者分别由上到下地居右显示。*/
  author: Array<string>;
  /** D-调式：
   *  调式必须是一个大写字母，在字母后面可以加“#”或“$”表示升降调。*/
  mode?: string;
  /** P-拍号：
   *  两个数字分别是分子和分母。*/
  meter?: [number, number];
  /** J-节拍
   *  文字表述，原样输出；数字输入，判断为 BPM。*/
  tempo?: string | number;
};

const METADATA_PREFIX = ["V", "B", "Z", "D", "P", "J"];

const formatMode = (mode: string) =>
  mode[0] + (mode[1] === "#" ? "♯" : "") + (mode[1] === "$" ? "♭" : "");

/** 原始字体格式 */
type RawFontFamily = "Microsoft YaHei" | "SimSun" | "SimHei" | "KaiTi";

/** 原始页面设置 */
type RawPageConfig = {
  /** 页面大小 */
  page: "A4" | "A5" | "A4_horizontal" | "A5_horizontal";
  /** 上边距 */
  margin_top: string;
  /** 下边距 */
  margin_bottom: string;
  /** 左边距 */
  margin_left: string;
  /** 右边距 */
  margin_right: string;
  /** 标题字体 */
  biaoti_font: RawFontFamily;
  /** 数字字体 现代/罗马/经典 */
  shuzi_font: "a" | "b" | "c";
  /** 歌词字体 */
  geci_font: RawFontFamily;
  /** 曲的下间距 */
  height_quci: string;
  /** 词的下间距 */
  height_cici: string;
  /** 曲的上间距 */
  height_ciqu: string;
  /** 多声部额外间距 */
  height_shengbu: string;
  /** 标题字号 */
  biaoti_size: string;
  /** 副标题字号 */
  fubiaoti_size: string;
  /** 歌词字号 */
  geci_size: string;
  /** 正文上间距 */
  body_margin_top: string;
  /** 连音线样式 */
  lianyinxian_type: "0" | "1" | "2";
};

type FontConfig = {
  /** 字体家族 */
  fontFamily: string;
  /** 字号 */
  fontSize: number;
};

/** 页面设置 */
type PageConfig = {
  size: {
    height: number;
    width: number;
  };
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    topExtra: number;
  };
  title: FontConfig;
  subtitle: FontConfig;
  lyric: FontConfig;
  /** 音符数字样式 */
  note: "modern" | "roman" | "classic";
  /** 连音线样式 */
  slur: "auto" | "arc" | "flat";
};

const PAGE_PRESETS = {
  A4: { width: 1000, height: 1415 },
  A5: { width: 840, height: 1193 },
  A4_horizontal: { width: 1415, height: 1000 },
  A5_horizontal: { width: 1193, height: 840 },
};

function translatePageConfig(raw: RawPageConfig): PageConfig {
  return {
    size: PAGE_PRESETS[raw.page],
    margin: {
      top: Number(raw.margin_top),
      right: Number(raw.margin_right),
      bottom: Number(raw.margin_bottom),
      left: Number(raw.margin_left),
      topExtra: Number(raw.body_margin_top),
    },
    title: {
      fontFamily: raw.biaoti_font,
      fontSize: Number(raw.biaoti_size),
    },
    subtitle: {
      fontFamily: raw.biaoti_font,
      fontSize: Number(raw.fubiaoti_size),
    },
    lyric: {
      fontFamily: raw.geci_font,
      fontSize: Number(raw.geci_size),
    },
    note: <"modern" | "roman" | "classic">(
      { a: "modern", b: "roman", c: "classic" }[raw.shuzi_font]
    ),
    slur: <"auto" | "arc" | "flat">(
      ["auto", "arc", "flat"][raw.lianyinxian_type]
    ),
  };
}

/** 音符和休止符 */
type Note = {
  cate: "Note";
  type: "note" | "rest";
  /** 音高，数字 1-7，休止符为 0, X 为 9*/
  pitch: Number;
  /** 区域，数字 0 表示不加点，+n 上加 n 点，-n 下加 n 点 */
  range: number;
  /** 时值，存储分母，四分音符为 4，八分为 8 */
  duration: number;
  /** 附点个数 */
  dot: 0 | 1 | 2;
  /** 升# 降$ 还原= */
  accidental: "none" | "sharp" | "flat" | "natural";
  /** 装饰记号，用 & 开头 */
  ornaments: Array<string>;
};

/** Sign 命令列表 */
const SIGN_CMD_LIST = ["zkh", "ykh"];

/** 音符装饰记号列表 */
const NOTE_ORN_LIST = [
  "pp",
  "p",
  "mp",
  "mf",
  "f",
  "ff",
  "fff",
  "cresc",
  "dim",
  "sf",
  "fp",
  "sfp",
  "atempo",
  "rit",
  "yc",
  "bc",
  "zy",
  "dy",
  "hx",
  "shy",
  "xhy",
  "sby",
  "sby+",
  "xby",
  "xby+",
  "cy",
  "cy+",
];

/** 新建音符/休止符 */
function createNote(char?: string): Note {
  if (typeof char === "undefined")
    return {
      cate: "Note",
      type: "note",
      pitch: -1,
      range: 0,
      duration: 4,
      dot: 0,
      accidental: "none",
      ornaments: [],
    };
  else
    return {
      cate: "Note",
      type: char === "0" ? "rest" : "note",
      pitch: Number(char),
      range: 0,
      duration: 4,
      dot: 0,
      accidental: "none",
      ornaments: [],
    };
}

/** 在谱面中与音符所占位置相同的记号 */
type Sign = {
  cate: "Sign";
  /** 符号类型 */
  type:
    | "fermata"
    | "invisible"
    | "meter"
    | "parenthese-left"
    | "parenthese-right";
  meter?: [number, number];
  ornaments: Array<string>;
};

function createSign(
  type:
    | "fermata"
    | "invisible"
    | "meter"
    | "parenthese-left"
    | "parenthese-right"
): Sign {
  return {
    cate: "Sign",
    type,
    ornaments: [],
  };
}

/** 在谱面中标记在音符上的记号 */
type Mark = {};

/** 小节线 */
type Barline = {
  cate: "Barline";
  type:
    | "normal" // "|"
    | "end" // "||"
    | "double" // "||/"
    | "repeat-left" // "|:"
    | "repeat-right" // ":|"
    | "repeat-double" // ":|:"
    | "hidden" // "|/"，不显示也不占据空间
    | "invisible"; // "|*"，不显示但占据空间
  ornaments: Array<string>;
};

function createBarline(
  type:
    | "normal"
    | "end"
    | "double"
    | "repeat-left"
    | "repeat-right"
    | "repeat-double"
    | "hidden"
    | "invisible"
): Barline {
  return {
    cate: "Barline",
    type,
    ornaments: [],
  };
}

/** 小节线装饰记号列表 */
const BARLINE_ORN_LIST = ["fine", "dc", "ds", "ty", "hs"];

/** 行 */
type Line = {
  notes: Array<Note | Sign | Barline>;
  marks?: [];
};

interface warnPos {
  source: string;
  index?: number;
  length?: number;
  lastIndex?: number;
}

/** 在控制台打印警告 */
function warn(content: string, { source, index, length, lastIndex }: warnPos) {
  if (index !== undefined && length !== undefined && lastIndex === undefined) {
    // 无需调整
  } else if (
    index !== undefined &&
    length === undefined &&
    lastIndex === undefined
  ) {
    length = 1;
  } else if (
    index !== undefined &&
    length === undefined &&
    lastIndex !== undefined
  ) {
    length = lastIndex - index;
  } else if (
    index === undefined &&
    length !== undefined &&
    lastIndex !== undefined
  ) {
    index = lastIndex - length;
  } else throw new Error("Internal Error: Bad warning");
  console.warn(
    `${content} @ char ${index}\n  source: ${source}\n${" ".repeat(
      index + 10
    )}${"^".repeat(length)}`
  );
}
type RawLine = {
  multi: false;
  rawLine: string;
  rawLyric: Array<string>;
};
type RawLineMulti = {
  multi: true;
  rawLine: Array<string>;
  rawLyric: Array<string>;
};
type divideResult = { metadata: Metadata; rawPages: Array<Array<RawLine>> };

/** 将脚本源代码转换为 Metadata 和 RawLine */
function divideScript(code: string) {
  ///////////
  code.replaceAll("&hh&", "\n"); // 原版前端用 &hh& 表示换行符
  let arr = code.split("\n");
  let metadata: Metadata = {
    title: [],
    author: [],
  };
  let currentPage: Array<RawLine> = [],
    pageResult: Array<Array<RawLine>> = [];
  for (let raw of arr) {
    if (raw.at(0) === "#") continue; // 注释行
    let prefix = raw.match(/^([A-Z0-9]+):/)?.[1];
    if (prefix === undefined) {
      warn("Prefix Error: Preifx missing", { source: raw, index: 0 });
    } else if (METADATA_PREFIX.includes(prefix)) {
      // 描述头部分
      let data = raw.slice(prefix.length + 1).trim();
      switch (prefix) {
        case "V":
          if (metadata.version !== undefined)
            warn(
              `Prefix Error: Version code already defined as '${metadata.version}'`,
              { source: raw, index: 0, length: raw.length }
            );
          metadata.version = data;
          break;
        case "B":
          metadata.title.push(data);
          break;
        case "Z":
          metadata.author.push(data);
          break;
        case "D":
          if (metadata.mode !== undefined)
            warn(
              `Prefix Error: Mode already defined as ${formatMode(
                metadata.mode
              )}`,
              { source: raw, index: 0, length: raw.length }
            );
          else if (data.match(/^[A-G][#$]?$/) !== null) metadata.mode = data;
          else
            warn(`Prefix Error: Illegal mode expression '${data}'`, {
              source: raw,
              index: prefix.length,
              lastIndex: raw.length,
            });
          break;
        case "P":
          if (isNaN(Number(data))) metadata.tempo = data;
          else metadata.tempo = Number(data);
      }
    } else {
      ///歌词旋律处理
    }
  }
}

/** 编译一个旋律行 */
function parseLine(input: string) {
  /** 当前字符状态 */
  type State = "space" | "note" | "sign" | "modifier" | "barline" | "command";

  /** 判断当前字符性质 */
  function judgeState(char: string) {
    if (char === " ") return "space";
    if (char.match(/[a-z&+]/) !== null) return "command";
    if (["0", "1", "2", "3", "4", "5", "6", "7", "9"].includes(char))
      return "note";
    if (["8", "-"].includes(char)) return "sign";
    if (["|", ":"].includes(char)) return "barline";
    return "modifier";
  }

  /** 判断当前 sign 类型 */
  function judgeSignType(char: string) {
    switch (char) {
      case "-":
        return "fermata";
      case "8":
        return "invisible";
      default:
        return "invisible";
    }
  }

  // 原版同时支持 &atempo 和 &a tempo，后者解析难做，故用替换的方法 hack
  input = input.replaceAll("&a tempo", "&atempo");
  let line: Line = {
    notes: [],
  };
  let state: State = "space",
    lastState: State = "space",
    targetState: State = "space";
  // let currentNote: Note | undefined = undefined,
  //   currentSign: Sign | undefined = undefined,
  //   currentBarline: Barline | undefined = undefined;
  let currentCommand = "";

  for (let index = 0; index < input.length; index++) {
    let char = input[index];

    // 维护状态
    lastState = state;
    state = judgeState(char);
    if (!["space", "modifier", "command"].includes(lastState))
      targetState = lastState;

    // 命令结算
    if (state !== "command" && currentCommand !== "") {
      let command = currentCommand.slice(1);
      if (SIGN_CMD_LIST.includes(command)) {
        if (command === "zkh") line.notes.push(createSign("parenthese-left"));
        else if (command === "ykh")
          line.notes.push(createSign("parenthese-right"));
        else
          warn(
            `Internal Error: Command '${currentCommand}' registered as Sign but failed to find implement`,
            {
              source: input,
              lastIndex: index,
              length: currentCommand.length,
            }
          );
      } else if (
        line.notes.at(-1)?.cate === "Note" &&
        NOTE_ORN_LIST.includes(command)
      ) {
        line.notes.at(-1)!.ornaments.push(command);
      } else if (
        line.notes.at(-1)?.cate === "Barline" &&
        BARLINE_ORN_LIST.includes(command)
      ) {
        line.notes.at(-1)!.ornaments.push(command);
      } else {
        let warnStr;
        if (NOTE_ORN_LIST.includes(command))
          warnStr = `Command '${currentCommand}' should be used after note or rest, but found ${
            line.notes.at(-1)?.cate
          }`;
        else if (BARLINE_ORN_LIST.includes(command))
          warnStr = `Command '${currentCommand}' should be used after barline, but found ${
            line.notes.at(-1)?.cate
          }`;
        else warnStr = `Unknown command '${currentCommand}'`;
        warn("Command Error: " + warnStr, {
          source: input,
          lastIndex: index,
          length: currentCommand.length,
        });
      }
      currentCommand = "";
      targetState = "command";
    }

    // 进入字符判断流程
    let lastToken = line.notes.at(-1);
    if (state === "command")
      if (char === "&") {
        if (currentCommand === "") currentCommand = "&";
        else
          warn("Command Error: Unexpected '&' in command", {
            source: input,
            index,
          });
      } else {
        if (currentCommand.slice(0, 1) === "&") currentCommand += char;
        else
          warn("Command Error: Missing '&' before command", {
            source: input,
            index,
          });
      }
    else if (state === "note") {
      line.notes.push(createNote(char));
    } else if (state === "sign") {
      line.notes.push(createSign(judgeSignType(char)));
    } else if (state === "modifier") {
      if (lastToken === undefined)
        warn(
          `Modifier Error: Unexpected modifier '${char}' at the beginning of a line`,
          { source: input, index }
        );
      else if (lastToken.cate === "Note") {
        switch (char) {
          case ",": // 下加一点
            lastToken.range -= 1;
            break;
          case "'": // 上加一点
            lastToken.range += 1;
            break;
          case "#": // 升号
            lastToken.accidental = "sharp";
            break;
          case "$": // 降号
            lastToken.accidental = "flat";
            break;
          case "=": // 还原号
            lastToken.accidental = "natural";
            break;
          case ".": // 附点
            lastToken.dot++;
            break;
          case "/": // 时值线
            lastToken.duration *= 2;
            break;
          default:
            warn(
              `Modifier Error: Unexpected modifier '${char}' after ${lastToken.type}`,
              { source: input, index }
            );
            break;
        }
      } else if (lastToken.cate === "Barline") {
        if (char === "/" && lastToken.type === "normal")
          // "| +/"
          lastToken.type = "hidden";
        else if (char === "/" && lastToken.type === "end")
          // "|| +/"
          lastToken.type = "double";
        else if (char === "*" && lastToken.type === "normal")
          // "| +*"
          lastToken.type = "invisible";
        else
          warn(
            `Modifier Error: Unexpected modifier '${char}' after barline ${lastToken.type}`,
            { source: input, index }
          );
      } else
        warn(
          `Modifier Error: Unexpected modifier '${char}' after ${lastToken.cate}`,
          { source: input, index }
        );
    } else if (state === "barline") {
      if (lastToken === undefined || lastToken.cate !== "Barline") {
        if (char === "|")
          // "|"
          line.notes.push(createBarline("normal"));
        else if (char === ":") {
          // ":|"
          if (input[index + 1] === "|")
            line.notes.push(createBarline("repeat-right"));
          else
            warn("Barline Error: Unexpected ':' without '|'", {
              source: input,
              index,
            });
        }
      } else {
        if (char === "|") {
          if (lastToken.type === "normal")
            // "||"
            lastToken.type = "end";
          else if (lastToken.type === "repeat-right")
            // ":|"
            lastToken.type = "repeat-right";
          else
            warn(
              `Barline Error: Unexpected '|' after complete barline ${lastToken.type}`,
              { source: input, index }
            );
        } else if (char === ":") {
          if (lastToken.type === "normal")
            // "|:"
            lastToken.type = "repeat-left";
          else if (lastToken.type === "repeat-right")
            // ":|:"
            lastToken.type = "repeat-double";
          else
            warn(
              `Barline Error: Unexpected ':' after complete barline ${lastToken.type}`,
              { source: input, index }
            );
        }
      }
    }
  }
  return line;
}

import fs from "fs";
fs.writeFileSync(
  "./data.json",
  JSON.stringify(
    parseLine(
      "0/&zkh 1'/ 7/ &sfp 6/ :| 5/ 4/ 3/ 2/ |&ty 1/ 2// 3// 4// 5// 6// 7// | 1'/ 5/ 1'/ 0/&ykh :| 5 6 | 5/ 3. | 5,/ 1/ 4/ 3/ |"
    )
  )
);

export function parse(code: string, config: RawPageConfig) {}
