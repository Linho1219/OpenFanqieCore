/*
 * 将脚本内容解析为对象。
 */

import { Metadata, METADATA_PREFIX, formatMode, MarkReg } from "./types";
import { RawPageConfig, PageConfig, PAGE_PRESETS } from "./types";
import { Note, SIGN_CMD_LIST, NOTE_ORN_LIST, createNote } from "./types";
import { SignType, Sign, createSign } from "./types";
import { Mark, SPEC_CHAR } from "./types";
import { Barline, createBarline, BARLINE_ORN_LIST } from "./types";
import { State, Line } from "./types";
import { RawLine, RawLineMulti, RawPage, DivideResult } from "./types";
import { warn } from "./warn";

/** 将脚本源代码转换为 Metadata 和 RawLine */
export function divideScript(code: string): DivideResult {
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
      warn("Prefix Error: Prefix missing", { source: raw, position: 0 });
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
              { source: raw, position: 0, length: raw.length }
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
              { source: raw, position: 0, length: raw.length }
            );
          else if (data.match(/^[A-G][#$]?$/) === null)
            warn(`Prefix Error: Illegal mode expression '${data}'`, {
              source: raw,
              position: prefix.length,
              lastIndex: raw.length,
            });
          else metadata.mode = data;
          break;
        }
        case "P": {
          const res = data.match(/(\d+)\s*\/\s*(\d+)/);
          if (res === null) {
            warn(`Prefix Error: Illegal meter expression '${data}'`, {
              source: raw,
              position: prefix.length,
              lastIndex: raw.length,
            });
          } else {
            metadata.meter = [Number(res[1]), Number(res[2])];
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
            { source: raw, position: 0, length: prefix.length }
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
            position: 0,
            length: prefix.length,
          });
        else lastLyc.push(data);
      }
    } else {
      warn(`Prefix Error: Unknown prefix '${prefix}'`, {
        source: raw,
        position: 0,
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
export function parseLine(input: string) {
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
  /** 强制跳转索引 */
  let forceJump: number | undefined = undefined;
  /** 括号配对栈 */
  let parentheseStack: Array<MarkReg> = [];
  /** 渐强渐弱配对，因为不允许重叠所以只要一个 */
  let dynamicStack: MarkReg | undefined = undefined;
  for (let position = 0; position < input.length; position++) {
    const char = input[position],
      state: State = judgeState(char);

    // 强制跳转
    if (forceJump !== undefined) {
      if (position === forceJump) forceJump = undefined;
      else continue;
    }

    // 命令结算
    if (
      (state !== "command" && curntCmd !== "") ||
      (char === "&" && curntCmd !== "")
    ) {
      const command = curntCmd.slice(1),
        lastToken = line.notes.at(-1);
      if (SIGN_CMD_LIST.includes(command)) {
        if (command === "zkh")
          line.notes.push(createSign("parenthese-left", line.notes.length));
        else if (command === "ykh")
          line.notes.push(createSign("parenthese-right", line.notes.length));
        else
          warn(
            `Internal Error: Command '${curntCmd}' registered as Sign but failed to find implement`,
            {
              source: input,
              lastIndex: position,
              length: curntCmd.length,
            }
          );
      } else if (lastToken !== undefined) {
        if (lastToken.cate === "Note" && NOTE_ORN_LIST.includes(command)) {
          if (lastToken.ornaments === undefined) lastToken.ornaments = [];
          lastToken.ornaments.push(command);
        } else if (
          lastToken.cate === "Barline" &&
          BARLINE_ORN_LIST.includes(command)
        ) {
          if (lastToken.ornaments === undefined) lastToken.ornaments = [];
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
            lastIndex: position,
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
          lastIndex: position,
          length: curntCmd.length,
        });
      }
      curntCmd = "";
    }

    const lastToken = line.notes.at(-1);
    // 进入字符判断流程
    if (SPEC_CHAR.includes(char)) {
      // 特殊字符处理
      switch (char) {
        case '"': {
          const quoted: string | undefined = input
            .slice(position)
            .match(/^\s*"([^"]+)"/)?.[1];
          if (quoted !== undefined) {
            const lastToken = line.notes.at(-1);
            if (lastToken?.cate === "Barline") {
              const meterMatch = quoted.match(/p:(\d+)\/(\d+)/);
              if (meterMatch !== null) {
                line.notes.push({
                  ...createSign("meter", line.notes.length),
                  meter: [Number(meterMatch[1]), Number(meterMatch[2])],
                });
              } else
                warn(`Sign Error: Illegal temporary meter format '${quoted}'`, {
                  source: input,
                  position,
                  length: quoted.length + 2,
                });
            } else if (lastToken?.cate === "Note") {
              lastToken.comment = quoted;
            } else {
              warn(
                `Modifier Error: Comment must be attached to a note or a rest but found ${lastToken?.cate}`,
                {
                  source: input,
                  position,
                  length: quoted.length + 2,
                }
              );
            }
            forceJump = position + quoted.length + 2;
          } else {
            warn(`Modifier Error: Unexpected '"' without closing`, {
              source: input,
              position,
            });
          }
          break;
        }
        case "(": {
          if (input[position + 1] === "y") {
            // 连音线
            parentheseStack.push({
              type: "tuplets",
              position,
              index: line.notes.length,
            });
            forceJump = position + 2;
          } else {
            // 延音线
            parentheseStack.push({
              type: "legato",
              position,
              index: line.notes.length,
            });
          }
          break;
        }
        case ")": {
          const tempReg = parentheseStack.pop();
          if (tempReg !== undefined) {
            const begin = tempReg.index;
            const end = line.notes.length - 1;
            if (tempReg.index <= end) {
              if (line.marks === undefined) line.marks = [];
              if (tempReg.type === "tuplets") {
                const legatoNotes = line.notes.slice(begin, end + 1);
                if (
                  legatoNotes.filter(
                    (token) => token.cate !== "Note" && token.type !== "fermata"
                  ).length === 0
                ) {
                  legatoNotes.forEach((token) => {
                    if (token.cate === "Barline")
                      throw new Error("Unexpected Barline");
                    token.tuplets = end - begin + 1;
                  });
                } else {
                  warn(
                    `Mark Error: Tuplets should not include tokens other than notes, rests and fermata`,
                    {
                      source: input,
                      position: tempReg.position,
                      lastIndex: position,
                    }
                  );
                }
              }
              line.marks.push({
                cate: "Mark",
                type: tempReg.type,
                begin,
                end,
              });
            } else {
              warn(
                `Mark Error: Tokens within ${tempReg.type} must be no less than 2`,
                {
                  source: input,
                  position: tempReg.position,
                  lastIndex: position,
                }
              );
            }
          } else {
            warn(`Mark Error: Unexpected ')' without '('`, {
              source: input,
              position,
            });
          }
          break;
        }
        case "<":
        case ">": {
          if (dynamicStack === undefined) {
            dynamicStack = {
              position,
              index: line.notes.length - 1,
              type: <"cresc" | "dim">{ "<": "cresc", ">": "dim" }[char],
            };
          } else {
            warn(`Mark Error: Dynamics marks should not be nested`, {
              source: input,
              position,
            });
          }
          break;
        }
        case "!": {
          if (dynamicStack !== undefined) {
            const begin = dynamicStack.index;
            const end = line.notes.length - 1;
            if (dynamicStack.index <= end) {
              if (line.marks === undefined) line.marks = [];
              line.marks.push({
                cate: "Mark",
                type: dynamicStack.type,
                begin,
                end,
              });
            } else {
              warn(
                `Mark Error: Tokens within long dynamic marks must be no less than 2`,
                {
                  source: input,
                  position: dynamicStack.position,
                  lastIndex: position,
                }
              );
            }
          } else {
            warn(`Mark Error: Unexpected '!' without previous '<' or '>'`, {
              source: input,
              position,
            });
          }
          break;
        }
        case "[": {
          if (lastToken !== undefined) {
          } else {
            //////
            warn(`Internal Error: Unexpected '[' at`, {
              source: input,
              position,
            });
          }
          break;
        }
        case "]": {
          break;
        }
        default: {
          warn(
            `Internal Error: Specialized char ${char} registered without implement`,
            { source: input, position }
          );
          break;
        }
      }
    } else if (state === "command") {
      if (char === "&") {
        curntCmd = "&";
      } else {
        if (curntCmd[0] !== "&")
          warn("Command Error: Missing '&' before command", {
            source: input,
            position,
          });
        else curntCmd += char;
      }
    } else if (state === "note") {
      line.notes.push(createNote(char, line.notes.length));
    } else if (state === "sign") {
      line.notes.push(createSign(judgeSignType(char), line.notes.length));
    } else if (state === "modifier") {
      if (lastToken === undefined)
        warn(
          `Modifier Error: Unexpected modifier '${char}' at the beginning of a line`,
          { source: input, position }
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
            if (lastToken.dot === undefined) lastToken.dot = 0;
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
              { source: input, position }
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
            { source: input, position }
          );
      } else
        warn(
          `Modifier Error: Unexpected modifier '${char}' after ${lastToken.cate}`,
          { source: input, position }
        );
    } else if (state === "barline") {
      if (lastToken === undefined || lastToken.cate !== "Barline") {
        if (char === "|")
          // "|"
          line.notes.push(createBarline("normal", line.notes.length));
        else if (char === ":") {
          // ":|"
          if (input[position + 1] !== "|")
            warn("Barline Error: Unexpected ':' without '|'", {
              source: input,
              position,
            });
          else
            line.notes.push(createBarline("repeat-right", line.notes.length));
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
              { source: input, position }
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
              { source: input, position }
            );
        }
      }
    }
  }
  if (forceJump !== undefined) {
    warn(`Internal Error: Forced jump not finished`, {
      source: input,
      position: 0,
    });
  }
  return line;
}

export function parse(code: string, config: RawPageConfig) {}
