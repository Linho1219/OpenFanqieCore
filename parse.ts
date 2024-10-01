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
const createNote = (char: string): Note => ({
  cate: "Note",
  type: char === "0" ? "rest" : "note",
  pitch: Number(char),
  range: 0,
  duration: 4,
  dot: 0,
  accidental: "none",
  ornaments: [],
});

type SignType =
  | "fermata"
  | "invisible"
  | "meter"
  | "parenthese-left"
  | "parenthese-right";

/** 在谱面中与音符所占位置相同的记号 */
type Sign = {
  cate: "Sign";
  type: SignType;
  meter?: [number, number];
  ornaments: Array<string>;
};

const createSign = (type: SignType): Sign => ({
  cate: "Sign",
  type,
  ornaments: [],
});

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
  index: number;
  caption?: string;
  rawLine: string;
  rawLyric: Array<string>;
};
type RawLineMulti = Array<RawLine>;
type RawPage = Array<RawLineMulti>;

type DivideResult = {
  metadata: Metadata;
  rawPages: Array<RawPage>;
};

/** 将脚本源代码转换为 Metadata 和 RawLine */
function divideScript(code: string): DivideResult {
  code.replaceAll("&hh&", "\n"); // 原版前端用 &hh& 表示换行符
  const arr = code.split("\n");
  const metadata: Metadata = {
    title: [],
    author: [],
  };
  let curntMulti: RawLineMulti = [];
  let curntPage: RawPage = [];
  const rawPages: Array<RawPage> = [];
  rawPages.push(curntPage);
  for (let raw of arr) {
    if (raw.at(0) === "#" || raw.trim() == "") continue; // 注释行或空行
    if (raw === "[fenye]") {
      // 分页符
      curntPage = [];
      rawPages.push(curntPage);
      continue;
    }
    const prefix = raw.match(/^([A-Z][0-9]*("[^"]+")?):/)?.[1];
    if (prefix === undefined) {
      warn("Prefix Error: Prefix missing", { source: raw, index: 0 });
      continue;
    }
    const data = raw.slice(prefix.length + 1).trim();
    const preLetter = prefix[0];
    if (METADATA_PREFIX.includes(prefix)) {
      // 描述头部分
      switch (prefix) {
        case "V": {
          if (metadata.version !== undefined)
            warn(
              `Prefix Error: Version code already defined as '${metadata.version}'`,
              { source: raw, index: 0, length: raw.length }
            );
          metadata.version = data;
          break;
        }
        case "B": {
          metadata.title.push(data);
          break;
        }
        case "Z": {
          metadata.author.push(data);
          break;
        }
        case "D": {
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
        }
        case "P": {
          const res = data.match(/(\d+)\s*\/\s*(\d+)/);
          if (res !== null) {
            metadata.meter = [Number(res[1]), Number(res[2])];
          } else {
            warn(`Prefix Error: Illegal meter expression '${data}'`, {
              source: raw,
              index: prefix.length,
              lastIndex: raw.length,
            });
          }
          break;
        }
        case "J": {
          if (isNaN(Number(data))) metadata.tempo = data;
          else metadata.tempo = Number(data);
          break;
        }
        default: {
          warn(
            `Internal Error: Registered prefix ${prefix} without implement`,
            { source: raw, index: 0, length: prefix.length }
          );
          break;
        }
      }
    } else if (preLetter[0] === "Q" || preLetter[0] === "C") {
      const index = parseInt(prefix.slice(1));
      if (preLetter === "Q") {
        if (index <= 1) {
          curntMulti = [];
          curntPage.push(curntMulti);
        }
        const caption = prefix.match(/"([^"]+)"$/)?.[1];

        curntMulti.push({
          index,
          rawLine: data,
          rawLyric: [],
          caption,
        });
      } else {
        const lastLyc = curntMulti.at(-1)?.rawLyric;
        if (lastLyc === undefined)
          warn(`Prefix Error: Lyric must be attached to score`, {
            source: raw,
            index: 0,
            length: prefix.length,
          });
        else lastLyc.push(data);
      }
    } else {
      warn(`Prefix Error: Unknown prefix '${prefix}'`, {
        source: raw,
        index: 0,
        length: prefix.length,
      });
    }
  }
  return {
    metadata,
    rawPages,
  };
}

/** 编译一个旋律行 */
function parseLine(input: string) {
  type State = "space" | "note" | "sign" | "modifier" | "barline" | "command";
  function judgeState(char: string) {
    if (char === " ") return "space";
    if (char.match(/[a-z&+]/) !== null) return "command";
    if (["0", "1", "2", "3", "4", "5", "6", "7", "9"].includes(char))
      return "note";
    if (["8", "-"].includes(char)) return "sign";
    if (["|", ":"].includes(char)) return "barline";
    return "modifier";
  }
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
  const line: Line = {
    notes: [],
  };
  let curntCmd = "";

  for (let index = 0; index < input.length; index++) {
    const char = input[index],
      state: State = judgeState(char);

    // 命令结算
    if (state !== "command" && curntCmd !== "") {
      const command = curntCmd.slice(1),
        lastToken = line.notes.at(-1);
      if (SIGN_CMD_LIST.includes(command)) {
        if (command === "zkh") line.notes.push(createSign("parenthese-left"));
        else if (command === "ykh")
          line.notes.push(createSign("parenthese-right"));
        else
          warn(
            `Internal Error: Command '${curntCmd}' registered as Sign but failed to find implement`,
            {
              source: input,
              lastIndex: index,
              length: curntCmd.length,
            }
          );
      } else if (lastToken !== undefined) {
        if (lastToken.cate === "Note" && NOTE_ORN_LIST.includes(command)) {
          lastToken.ornaments.push(command);
        } else if (
          lastToken.cate === "Barline" &&
          BARLINE_ORN_LIST.includes(command)
        ) {
          lastToken.ornaments.push(command);
        } else {
          let warnStr;
          if (NOTE_ORN_LIST.includes(command))
            warnStr = `Command '${curntCmd}' should be used after note or rest, but found ${lastToken?.cate}`;
          else if (BARLINE_ORN_LIST.includes(command))
            warnStr = `Command '${curntCmd}' should be used after barline, but found ${lastToken?.cate}`;
          else warnStr = `Unknown command '${curntCmd}'`;
          warn("Command Error: " + warnStr, {
            source: input,
            lastIndex: index,
            length: curntCmd.length,
          });
        }
      } else {
        let warnStr;
        if (NOTE_ORN_LIST.includes(command))
          warnStr = `Command '${curntCmd}' should be used after note or rest, but placed at the beginning`;
        else if (BARLINE_ORN_LIST.includes(command))
          warnStr = `Command '${curntCmd}' should be used after barline, but placed at the beginning`;
        else warnStr = `Unknown command '${curntCmd}'`;
        warn("Command Error: " + warnStr, {
          source: input,
          lastIndex: index,
          length: curntCmd.length,
        });
      }
      curntCmd = "";
    }

    // 进入字符判断流程
    /** 上一个有意义的元素对象 */
    const lastToken = line.notes.at(-1);
    if (state === "command")
      if (char === "&") {
        if (curntCmd === "") curntCmd = "&";
        else
          warn("Command Error: Unexpected '&' in command", {
            source: input,
            index,
          });
      } else {
        if (curntCmd.slice(0, 1) === "&") curntCmd += char;
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
          case ",": {
            // 下加一点
            lastToken.range -= 1;
            break;
          }
          case "'": {
            // 上加一点
            lastToken.range += 1;
            break;
          }
          case "#": {
            // 升号
            lastToken.accidental = "sharp";
            break;
          }
          case "$": {
            // 降号
            lastToken.accidental = "flat";
            break;
          }
          case "=": {
            // 还原号
            lastToken.accidental = "natural";
            break;
          }
          case ".": {
            // 附点
            lastToken.dot++;
            break;
          }
          case "/": {
            // 时值线
            lastToken.duration *= 2;
            break;
          }
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
// fs.writeFileSync(
//   "./data.json",
//   JSON.stringify(
//     parseLine(
//       "0/&zkh 1'/ 7/ &sfp 6/ :| 5/ 4/ 3/ 2/ |&ty 1/ 2// 3// 4// 5// 6// 7// | 1'/ 5/ 1'/ 0/&ykh :| 5 6 | 5/ 3. | 5,/ 1/ 4/ 3/ |"
//     )
//   )
// );
fs.writeFileSync(
  "./data.json",
  JSON.stringify(
    divideScript(
      `#============================以下为简谱头部定义==========================
B: 时　忆
B: 福州一中 2024届(11)班
Z: 林嘉欣 庄忆 词
Z: 黄若丞 曲
D: C
P: 4/4
J: 80
#============================以下开始简谱正文============================
Q1"女声": 0/ 5,/ | (2/ 3//) 3// 0 2/ 3/ 5/ 3/ | 0 0 0 0/ 5,/ | (2/ 3//) 3// 0 2/ 3/ 5/ 1/ | 0 0 0 0/ 5,/ |
C1: @我想@在@清晨眺望@@@@我想@在@午后轻唱@@@@我

Q2"男高": 0 | 0 0 0 0 | 2,/ 3,/ 5,/ 3,/ 0 0 | 0 0 0 0 | 2,/ 3,/ 5,/ 1,/ 0 0 |
C2: @@@@@清晨眺望@@@@@@午后轻唱

Q3"男低": 0 | 1, - - - | - - - 0 | 3, - - - | - - - 0 |
C3: @呜@呜

Q1: 3/ 4// 4// 0/ 5// 4// 0/ 3/ 2/ 1/ | 0 0 0/ 6,/ (1/ 2/) | 3 (- 3/ 2/ 1/) (2/ | 2) (- - 2/) 0/ |
C1: 想和你@一起@在黄昏@@@许下@愿@@@望
Q2: 0 0 0 0 | 0/ 3,/ 2,/ 1,/ 0 0 | 6, - - - | 7, - - 0/ 5,,/ |
C2: @@@@@在黄昏@@愿望@我
Q3: 4, - - - | - - - 0 | 4, - - - | 5, - - - |
C3: 呜@愿望

Q1: 0 0 0 0 | 2/ 3/ 5/ 3/ 0 0 | 0 0 0 0 | 7/ 1'/ 7/ 5/ 0 0/ 5,/ |
C1: @@@@走出彷徨@@@@@@那么荒唐@@我
Q2:  (2,/ 3,/) 0 2,/ 3,/ 5,/ 3,/ | 0 0 0 0/ 5,,/ | (2,/ 3,/) 0 2,/ 3,/ 6,/ 3,/ | 0 0 0 0 |
C2: 想@@走出彷徨@@@@我想不@那么荒唐@@@@
Q3: 1, - - - | - - - 0 | 3, - - - | - - - 0 |
C3:呜@呜

Q1: 3/ 4/ 3/ 4/ 5/ 4/ 3/ 1/ | 1 2/ (2/ 2) 0 | 1/ 2/ 3/ 1'/ 7/ 1'/ 2/ 1/ | 1/ 2// (3// 3/) 2// 1// (y7/ 7/ 6/) (y6/ 5/ 3/) |
C1: 想在黄金时代不留下遗憾@@那个晴天不曾言语斑驳的@午后初见你的样子
Q2: 5,/ 6,/ 5,/ 6,/ 1/ 6,/ 0 | 5, - - 0 | 6, - 5#, - | 3, - 2, - |
C2: 想在黄金时代呜呜@呜呜呜呜
Q3: 2, - - - | 5,, - - 0 | 1, - 7,, - | 5,, - 4#, - |
C3: 呜呜@呜呜呜呜

[fenye]

Q1: 6/ 5// 5// 0/ 2// 3// 5/ 1/ 7,/ 1/ | 6/ 5// (5// 5) 1'/ 7/ 6// 7// 0/ |
C1: 四楼的@阳光不偏不倚我们的@故事开始
Q2: 4, - 3, - | 6,/ 5,// (5,// 5,) 1/ 7,/ 6,// 7,// 0/ |
C2: 啊啊我们的@故事开始
Q3: 1, - 1, - | 4,/ 3,// (3,// 3) 4,/ 5,/ 4,// 5,// 0/ |
C3: 啊啊我们的@故事开始

Q1: 3/ 2/ 3/ 5/ 2 3 | 3/ 2/ 3/ 1'/ 2/ 3/ (y3/ 4/ 5/) | 5/ 1/ (y3/ 4/ 5/) 5/ 1/ 0/ 5,/ | 5/ 4// 4// 3// 6./ 5 1/ 2/ |
C1: 美好熬成时光时光唱成歌谣也许某一天就在那一天@故事也会有终点我们
Q2: 1,/ 7,,/ 1,/ 3,/ 0 7,, | 1, - 6,/ 5,/ 0 | 4, - 3, - | 2, - 5, - |
C2: 美好熬成@时光歌谣@呜呜啊啊
Q3: 1, - 7,, - | 6,, - 5,, - | 4,, - 3,, - | 4,, - 5,, - |
C3: 呜呜呜啊呜呜啊啊

Q1: 3 2/ 1// (2// 2) 2/ 1/ | 6&yc - 0/ 2// 3// 4/ 3// 4// | 0 5// 5// 1/ 2/ 1/ - ||/
C1: 挥手告别@所以啊@这首歌一定@要大声地唱
Q2:  (6, 6,/.) (5,#// 5,) 5=, | 4,# - 0/ 6,// 5,// 6,/ 5,// 6,// | 0 5,// 5,// 5,/ 5,/ 1/ 0 ||/
C2: 呜@呜@呜啊@这首歌一定@要大声地唱
Q3:  (6,, 6,,/.) (7,,// 7,,) 2, | 2, - 0/ 2,/ - | 0 5,,// 5,,// 5,,/&xhy0 0 ||/
C3: 呜@呜@呜啊@啊@嘟嘟嘟


Q1: 0/ 3// 2// 3// 2// 3// 2// 3// 2// 3// 2// 3// 1// 2/ | 0/ 3// 2// 3// 2// 3// 2// 3// 2// 3// 2// 3// 5// 3/ | 0/ 3// 2// 3// 2// 3// 2// 2// 1// 2// 3// 2/ 1/ |
C1: @不会做的问题前后左右互相帮@请你不要假装做过的题没印象@木棉飘落窗下也许带着匆忙
Q2: 0/ 3,// 2,// 3,// 2,// 3,// 2,// 3,// 2,// 3,// 2,// 3,// 1,// 2,/ | 0/ 3,// 2,// 3,// 2,// 3,// 2,// 3,// 2,// 3,// 2,// 3,// 5,// 3,/ | 0/ 3,// 2,// 3,// 2,// 3,// 2,// 2,// 1,// 2,// 3,// 2,/ 1,/ |
C2: @不会做的问题前后左右互相帮@请你不要假装做过的题没印象@木棉飘落窗下也许带着匆忙
Q3: 1,/ 5,/ 1,// 1,// 5,/ 3,/ 7,/ 3,// 3,// 7,/ | 6,,/ 3,/ 6,,// 6,,// 3,/ 5,,/ 2,/ 5,,// 5,,// 2,/ | 4,,/ 1,/ 4,,// 4,,// 1,/ 3,/ 7,/ 3,// 3,// 6,/ |
C3: 嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟


Q1: 0/ 4// 4// 4// 3// 2// 1// 4// 3// 4// 5// 1// 2// 2/ | 0/ 3// 2// 3// 2// 3// 2// 9// 9// 9// 9// 9// 9// 9/ | 0/ 3// 2// 3// 2// 3// 3// 3// 2// 3// 2// 3// 2// 3/ |
C1: @下课铃还没响我就想逃到远方@如果你去装水记得帮我带一杯@后黑板不空荡有欢喜与你分享
Q2: 0/ 4,// 4,// 4,// 3,// 2,// 1,// 4,// 3,// 4,// 5,// 1,// 2,// 2,/ | 0/ 3,// 2,// 3,// 2,// 3,// 2,// 9// 9// 9// 9// 9// 9// 9/ | 0/ 3,// 2,// 3,// 2,// 3,// 3,// 3,// 2,// 3,// 2,// 3,// 2,// 3,/ |
C2: @下课铃还没响我就想逃到远方@如果你去装水记得帮我带一杯@后黑板不空荡有欢喜与你分享
Q3: 2,/ 6,/ 2,// 2,// 6,/ 5,,/ 2,/ 5,,// 5,,// 2,/ | 1,/ 5,/ 1,// 1,// 5,/ 3,/ 7,/ 3,// 3,// 7,/ | 6,,/ 3,/ 6,,// 6,,// 3,/ 5,,/ 2,/ 5,,// 5,,// 2,/ |
C3: 嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟

[fenye]

Q1: 0/ 3// 2// 3// 2// 3// 2// 2// 1// 2// 3// 2// 1// 1/ | 0/ 4// 3// 4// 3// 4// 3// 4// 3// 4// 5// 4// 3// 1// 2// | 1 - - - ||/
C1: @带上你的背包拾起你眼里的光@阳光下的少年快去占有一个篮球场
Q2: 0/ 3,// 2,// 3,// 2,// 3,// 2,// 2,// 1,// 2,// 3,// 2,// 1,// 1,/ | 0/ 4,// 3,// 4,// 3,// 4,// 3,// 4,// 3,// 4,// 5,// 4,// 3,// 1,// 2,// | 1, - - - ||/
C2: @带上你的背包拾起你眼里的光@阳光下的少年快去占有一个篮球场
Q3: 4,,/ 1,/ 4,,// 4,,// 1,/ 3,/ 7,/ 3,// 3,// 6,/ | 2,/ 6,/ 2,// 2,// 6,/ 5,,/ 2,/ 5,,// 5,,// 2,/ | 1, - - - ||/
C3: 嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟嘟呜

Q1: 3/ 2/ 3/ 5/ 2 3 | 3/ 2/ 3/ 1'/ 2/ 3/ (y3/ 4/ 5/) | 5/ 1/ (y3/ 4/ 5/) 5/ 1/ 0/ 5,/ | 5/ 4// 4// 3// 6./ 5 1/ 2/ |
C1: 美好熬成时光时光唱成歌谣也许某一天就在那一天@时间真的有终点我们
Q2: 1,/ 7,,/ 1,/ 3,/ 0 7,, | 1, - 6,/ 5,/ 0 | 4, - 3, - | 2, - 5, - |
C2: 美好熬成@时光歌谣@呜呜啊啊
Q3: 1, - 2, - | 6,, - 7,, - | 1, - 7,, - | 6,, - 5,, - |
C3: 呜呜呜啊呜呜啊啊

Q1: 3 7/ 1'// (3// 3) 2/ 1/ | 6&yc - 0/ 2// 3// 4/ 3// 4// | 0 5// 5// 1/ 2/ 1/ - ||/
C1: 挥手告别@所以啊@这首歌一定@要大声地唱
Q2:  (6, 6,/.) (5,#// 5,) 5=, | 4,# - 0/ 6,// 5,// 6,/ 5,// 6,// | 0 5,// 5,// 5,/ 5,/ 1/ 0 ||/
C2: 呜@呜@呜啊@这首歌一定@要大声地唱
Q3:  (6,, 6,,/.) (7,,// 7,,) 2, | 2, - 0/ 2,/ - | 0 5,,// 5,,// 5,,/ 0 0 ||/
C3: 呜@呜@呜啊@啊@嘟嘟嘟


Q1: 3/"1=D" 2/ 3/ 5/ 5#/ 6// (7// 7/) 3/ | 1'/ 7// (1'// 1'/) 1'/ 2'/ 1'/ 5/ 3/ | 3// 4// 3/ 4/ 3/ 4/ 3/ 2/ 1/ | 2/ 3// (3// 3) - 0/ 3// 3// |
C1: 我还想着四季绚@烂我还想@看落日远山我还想和你一起看星辰流转@@那段
Q2: 1, - 3, - | 6, - 5, - | 4, - 5, - | 1, - - - |
C2: 呜呜呜呜呜呜呜

Q1: 3/ 3/ 3/ 3// (2// 2/) (7,/ 7,/) 6,// 7,// | 1/ 1'// (1'// 1') 7/ 6/ 3/ (2/ | 2&ycy) - - 0/ 2// 3// | 4/ 3// (4// 4) 5&rit/ 6/ 7/ (1'/ | 1') - - ||
C1: 时光不曾言@语@四楼的走廊@载满风雨@@我们的故事@未完待续
Q2: 6,/ 6,/ 6,/ 6,// 5#,// 5 0 | 6, - 5, (4#, | 4#) - - 0/ 2,// 3,// | 4,/ 3,// (4,// 4,) 5,/ 6,/ 7,/ (1,/ | 1,) - - ||
C2: 时光不曾言语@呜呜呜呜@我们的故事@未完待续
Q3: 2, - 3, - | 6,, - 5,, (4,,# | 4,,#) - - 0 | 2, - (5,, - | 5,,) - - ||
C3: 呜呜呜呜呜呜@呜呜`
    )
  )
);

export function parse(code: string, config: RawPageConfig) {}
