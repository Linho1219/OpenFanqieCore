/** 描述头 */
type Metadata = {
  /**
   * V-版本号
   *
   * 用来指定当前谱脚本是使用哪个版本的脚本规范，主要是因为后期可能会对脚本规范进行调整，衍生出不同的版本规范。
   */
  version?: string;
  /**
   * B-标题
   *
   * B 字段可多次出现。第一次出现将被认为是主标题，第二次以后出现的被认为是附标题。
   */
  title: Array<string>;
  /**
   * Z-作者
   *
   * Z 字段可多次出现。作者分别由上到下地居右显示。
   */
  author: Array<string>;
  /**
   * D-调式
   *
   * 调式必须是一个大写字母，在字母后面可以加“#”或“$”表示升降调。
   */
  mode?: string;
  /**
   * P-拍号
   *
   * 两个数字分别是分子和分母。
   */
  meter?: [number, number];
  /**
   * J-节拍
   *
   * 文字表述，原样输出。
   */
  tempo?: string;
  /**
   * J-节拍
   *
   * 数字输入，判断为 BPM。
   */
  bpm?: number;
};

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

/** 在控制台打印警告
 *  @param content 报错内容
 *  @param index 出错位置
 *  @param source 来源字符串
 */
function warn(
  content: string,
  index: number,
  source: string,
  length: number = 1
) {
  console.warn(
    `${content} @ char ${index}\n  source: ${source}\n${" ".repeat(
      index + 10
    )}${"^".repeat(length)}`
  );
}

/** 编译一个旋律行 */
function parseLine(input: string) {
  input = input.replaceAll("&a tempo", "&atempo");
  /** 当前行编译出的对象 */
  let line: Line = {
    notes: [],
  };
  /** 当前状态 */
  let state: State = "space";
  /** 上一个字符的状态 */
  let lastState: State = "space";
  /** 上一个单位（非空格非修饰符）的状态 */
  let targetState: State = "space";
  /** 当前处理的音符 */
  let currentNote: Note | undefined = undefined;
  /** 当前处理的符号 */
  let currentSign: Sign | undefined = undefined;
  /** 当前处理的命令 */
  let currentCommand = "";

  /** 当前处理的小节线 */
  let currentBarline: Barline | undefined = undefined;

  for (let index = 0; index < input.length; index++) {
    /** 当前字符 */
    let char = input[index];

    // 维护状态
    lastState = state;
    state = judgeState(char);
    if (!["space", "modifier", "command"].includes(lastState))
      targetState = lastState;

    // 结算
    // 小节线结算：小节线之后，非修饰符或空格，或 & 命令开始
    if (
      (targetState === "barline" &&
        !["barline", "modifier", "space", "command"].includes(state)) ||
      char === "&"
    ) {
      if (typeof currentBarline !== "undefined")
        line.notes.push(currentBarline);
      currentBarline = undefined;
    }
    // 音符/符号结算：非修饰符或空格，或 & 命令开始
    if (!["modifier", "space", "command"].includes(state) || char === "&") {
      if (currentNote !== undefined) {
        line.notes.push(currentNote);
        currentNote = undefined;
      } else if (currentSign !== undefined) {
        line.notes.push(currentSign);
        currentSign = undefined;
      }
    }
    // 命令结算
    if (state !== "command" && currentCommand !== "") {
      let command = currentCommand.slice(1);
      if (SIGN_CMD_LIST.includes(command)) {
        if (command === "zkh") line.notes.push(createSign("parenthese-left"));
        else if (command === "ykh")
          line.notes.push(createSign("parenthese-right"));
        else
          warn(
            `Command Error: Command '${currentCommand}' registered as Sign but failed to find implement`,
            index - currentCommand.length,
            input,
            currentCommand.length
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
        warn(
          "Command Error: " + warnStr,
          index - currentCommand.length,
          input,
          currentCommand.length
        );
      }
      currentCommand = "";
      targetState = "command";
    }

    // 进入字符判断流程
    if (state === "command")
      if (char === "&") {
        if (currentCommand === "") currentCommand = "&";
        else warn("Command Error: Unexpected '&' in command", index, input);
      } else {
        if (currentCommand.slice(0, 1) === "&") currentCommand += char;
        else warn("Command Error: Missing '&' before command", index, input);
      }
    else if (state === "note") {
      if (currentNote !== undefined)
        warn(
          `Internal Error: Unpushed Note ${currentNote.pitch}`,
          index,
          input
        );
      currentNote = createNote(char);
    } else if (state === "sign") {
      line.notes.push(createSign(judgeSignType(char)));
    } else if (state === "modifier") {
      if (targetState === "note") {
        if (currentNote?.cate !== "Note")
          warn(
            `Internal Error: Target is Note but found ${currentNote?.cate}`,
            index,
            input
          );
        else
          switch (char) {
            case ",": // 下加一点
              currentNote.range -= 1;
              break;
            case "'": // 上加一点
              currentNote.range += 1;
              break;
            case "#": // 升号
              currentNote.accidental = "sharp";
              break;
            case "$": // 降号
              currentNote.accidental = "flat";
              break;
            case "=": // 还原号
              currentNote.accidental = "natural";
              break;
            case ".": // 附点
              currentNote.dot++;
              break;
            case "/": // 时值线
              currentNote.duration *= 2;
              break;
            default:
              warn(`Modifier Error: Unknown modifier '${char}'`, index, input);
              break;
          }
      } else if (targetState === "barline" && currentBarline !== undefined) {
        if (char === "/" && currentBarline.type === "normal")
          // "| +/"
          currentBarline.type = "hidden";
        else if (char === "/" && currentBarline.type === "end")
          // "|| +/"
          currentBarline.type = "double";
        else if (char === "*" && currentBarline.type === "normal")
          // "| +*"
          currentBarline.type = "invisible";
        else
          warn(
            `Barline Error: Unexpected modifier '${char}' after barline ${currentBarline.type}`,
            index,
            input
          );
      } else
        warn(
          `Modifier Error: Unexpected modifier '${char}' after ${targetState}`,
          index,
          input
        );
    } else if (state === "barline") {
      if (currentBarline === undefined) {
        if (char === "|")
          // "|"
          currentBarline = createBarline("normal");
        else if (char === ":") {
          // ":|"
          if (input[index + 1] === "|")
            currentBarline = createBarline("repeat-right");
          else warn("Barline Error: Unexpected ':' without '|'", index, input);
        }
      } else {
        if (char === "|") {
          if (currentBarline.type === "normal")
            // "||"
            currentBarline.type = "end";
          else if (currentBarline.type === "repeat-right")
            // ":|"
            currentBarline.type = "repeat-right";
          else
            warn(
              `Barline Error: Unexpected '|' after complete barline ${currentBarline.type}`,
              index,
              input
            );
        } else if (char === ":") {
          if (currentBarline.type === "normal")
            // "|:"
            currentBarline.type = "repeat-left";
          else if (currentBarline.type === "repeat-right")
            // ":|:"
            currentBarline.type = "repeat-double";
          else
            warn(
              `Barline Error: Unexpected ':' after complete barline ${currentBarline.type}`,
              index,
              input
            );
        }
      }
    }
  }
  if (targetState === "note" && currentNote !== undefined)
    line.notes.push(currentNote);
  else if (targetState === "sign" && currentSign !== undefined)
    line.notes.push(currentSign);
  else if (targetState === "barline") line.notes.push(currentBarline!);
  return line;
}

import fs from "fs";
fs.writeFileSync(
  "./data.json",
  JSON.stringify(
    parseLine(
      "0/&zkh 1'/ 7/&mf 6/ :| 5/ 4/ 3/ 2/ ~ |&ty 1/ 2// 3// 4// 5// 6// 7// | 1'/ 5/ 1'/ 0/&ykh :| 5 6 | 5/ 3. | 5,/ 1/ 4/ 3/ |"
    )
  )
);

export function draw(input: string) {}
