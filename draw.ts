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
  ornaments: [];
};

/** 新建音符/休止符 */
function freshNote(char?: string): Note {
  if (typeof char === "undefined")
    return {
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
  /** 符号类型 */
  type: "fermata" | "invisible" | "meter";
  meter?: [number, number];
};

/** 在谱面中标记在音符上的记号 */
type Mark = {};

/** 小节线 */
type Barline = {
  type:
    | "normal" // "|"
    | "end" // "||"
    | "double" // "||/"
    | "repeat-left" // "|:"
    | "repeat-right" // ":|"
    | "repeat-double" // ":|:"
    | "hidden" // "|/"，不显示也不占据空间
    | "invisible"; // "|*"，不显示但占据空间
  ornaments: [];
};

/** 小节 */
type Measure = {
  notes: Array<Note | Sign>;
  barline?: Barline;
};

/** 当前字符状态 */
type State = "space" | "note" | "sign" | "modifier" | "barline";

/** 判断当前字符性质 */
function judgeState(char: string): State {
  if (char === " ") return "space";
  if (["0", "1", "2", "3", "4", "5", "6", "7", "9"].includes(char))
    return "note";
  if (["8", "-"].includes(char)) return "sign";
  if (["|", ":"].includes(char)) return "barline";
  else return "modifier";
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
function parserWarn(content: string, index: number, source: string) {
  console.warn(
    `${content} @ char ${index}\n  source: ${source}\n${" ".repeat(
      index + 10
    )}^`
  );
}

function parseLine(input: string) {
  /** 当前行转换出的小节数组 */
  let line: Array<Measure> = [];
  /** 当前状态 */
  let state: State = "space";
  /** 上一个字符的状态 */
  let lastState: State = "space";
  /** 上一个单位（非空格非修饰符）的状态 */
  let targetState: State = "space";
  /** 上一个字符的小节 */
  let currentMeasure: Measure = {
    notes: [],
  };
  /** 当前处理的音符 */
  let currentNote: Note = freshNote();
  /** 当前处理的符号 */
  let currentSign: Sign = {
    type: "invisible",
  };

  for (let index = 0; index < input.length; index++) {
    let char = input[index];
    lastState = state;
    state = judgeState(char);
    if (lastState !== "space" && lastState !== "modifier")
      targetState = lastState;

    // /** 如果上一个字符是修饰符，往前找到前面的音符或符号 */
    // function findTarget() {
    //   let target = index - 1,
    //     targetState: State = lastState;
    //   while (
    //     (targetState === "space" || targetState === "modifier") &&
    //     target > 0
    //   ) {
    //     targetState = judgeState(input[--target]);
    //   }
    //   return { target, targetState };
    // }

    if (
      !(
        state === "modifier" ||
        state === "space" ||
        (state === "barline" && lastState === "barline")
      )
    ) {
      if (targetState === "note") {
        currentMeasure.notes.push(currentNote);
      } else if (targetState === "sign") currentMeasure.notes.push(currentSign);
    }
    if (
      targetState === "barline" &&
      state !== "barline" &&
      state !== "modifier" &&
      state !== "space"
    ) {
      line.push(currentMeasure);
      currentMeasure = {
        notes: [],
      };
    }
    switch (state) {
      case "note":
        currentNote = freshNote(char);
        break;
      case "sign":
        currentSign = {
          type: judgeSignType(char),
        };
        break;
      case "modifier":
        if (targetState === "note") {
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
              parserWarn(`Modifier failure: Unknown modifier ${char}`, index, input);
              break;
          }
        } else if (
          targetState === "barline" &&
          typeof currentMeasure.barline !== "undefined"
        ) {
          if (char === "/")
            if (currentMeasure.barline.type === "normal")
              currentMeasure.barline.type = "hidden";
            else if (currentMeasure.barline.type === "end")
              currentMeasure.barline.type = "double";
            else parserWarn(`Barline faliure: Unexpected modifier '/' after barline ${currentMeasure.barline.type}`, index, input);
          else if (char === "*" && currentMeasure.barline.type === "normal")
            currentMeasure.barline.type = "invisible";
        } else
          parserWarn(
            `Modifier failure: Modifier failed to find token to describe but found previous ${targetState}`,
            index,
            input
          );
        break;
      case "barline":
        if (typeof currentMeasure.barline === "undefined") {
          if (char === "|")
            currentMeasure.barline = {
              type: "normal",
              ornaments: [],
            };
          else if (char === ":" && input[index + 1] === "|")
            currentMeasure.barline = {
              type: "repeat-right",
              ornaments: [],
            };
        } else {
          if (char === "|") {
            if (currentMeasure.barline.type === "normal")
              currentMeasure.barline.type = "end";
            else if (currentMeasure.barline.type === "repeat-right")
              currentMeasure.barline.type = "repeat-right";
            else
              parserWarn(
                `Barline faliure: unexpected ':' after complete barline ${currentMeasure.barline.type}`,
                index,
                input
              );
          } else if (char === ":") {
            if (currentMeasure.barline.type === "normal")
              currentMeasure.barline.type = "repeat-left";
            else if (currentMeasure.barline.type === "repeat-right")
              currentMeasure.barline.type = "repeat-double";
            else
              parserWarn(
                `Barline faliure: unexpected ':' after complete barline ${currentMeasure.barline.type}`,
                index,
                input
              );
          }
        }
        break;
      default:
        break;
    }
  }
  if (judgeState(input[input.length - 1]) === "note")
    currentMeasure.notes.push(currentNote);
  else if (judgeState(input[input.length - 1]) === "sign")
    currentMeasure.notes.push(currentSign);
  line.push(currentMeasure);
  return line;
}
import fs from "fs";
fs.writeFileSync(
  "./data.json",
  JSON.stringify(
    parseLine("1 1# 2= - |:/ 3/ 3/ 2//,, - ||/ 5' 5. 3/ 1 :| 2./ 3// 2 - ||")
  )
);

export function draw(input: string) {}
