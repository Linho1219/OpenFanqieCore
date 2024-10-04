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

export function translatePageConfig(raw: RawPageConfig): PageConfig {
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

/** 将脚本源代码转换为 Metadata 和 RawLine */
export function divideScript(code: string): DivideResult {
  code.replaceAll("&hh&", "\n"); // 原版前端用 &hh& 表示换行符
  const metadata: Metadata = {
    title: [],
    author: [],
  };
  let curntMulti: RawLineMulti = [];
  let curntPage: RawPage = [];
  const rawPages: Array<RawPage> = [];
  rawPages.push(curntPage);
  code.split("\n").forEach((raw) => {
    if (raw[0] === "#" || raw.trim() === "") return; // 注释行或空行
    if (raw === "[fenye]") {
      // 分页符
      curntPage = [];
      rawPages.push(curntPage);
      return;
    }
    const prefix = raw.match(/^([A-Z][0-9]*("[^"]+")?):/)?.[1];
    if (prefix === undefined) {
      warn("Prefix Error: Prefix missing", { source: raw, position: 0 });
      return;
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
              lastPos: raw.length,
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
              lastPos: raw.length,
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
        curntMulti.push({
          index,
          rawLine: data,
          rawLyric: [],
          caption: prefix.match(/"([^"]+)"$/)?.[1],
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
  });
  return {
    metadata,
    rawPages,
  };
}

/** 编译一个旋律行 */
export function parseLine(source: string) {
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
  source = source.replaceAll("&a tempo", "&atempo");
  const line: Line = {
    notes: [],
  };
  let curntCmd = "";
  /** 强制跳转索引 */
  let forceJump: number | undefined = undefined;
  /** 括号配对栈 */
  let parentheseStack: Array<MarkReg> = [];
  /** 渐强渐弱配对，不允许嵌套所以只要一个 */
  let dynamicStack: MarkReg | undefined = undefined;
  /** 跳房子配对，因为不允许嵌套所以只要一个 */
  let voltaStack: MarkReg | undefined = undefined;

  [...source].forEach((char, position) => {
    // 强制跳转
    if (forceJump !== undefined) {
      if (position !== forceJump) return;
      else forceJump = undefined;
    }

    const state: State = judgeState(char);

    // 命令结算
    if (
      (state !== "command" && curntCmd !== "") ||
      (char === "&" && curntCmd !== "")
    ) {
      const command = curntCmd.slice(1),
        lastToken = line.notes.at(-1);
      // if (SIGN_CMD_LIST.includes(command)) {
      //   if (command === "zkh")
      //     line.notes.push(createSign("parenthese-left", line.notes.length));
      //   else if (command === "ykh")
      //     line.notes.push(createSign("parenthese-right", line.notes.length));
      //   else
      //     warn(
      //       `Internal Error: Command '${curntCmd}' registered as Sign but failed to find implement`,
      //       {
      //         source,
      //         lastPos: position,
      //         length: curntCmd.length,
      //       }
      //     );
      // } else
      if (lastToken !== undefined) {
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
            source,
            lastPos: position,
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
          source,
          lastPos: position,
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
          const quoted: string | undefined = source
            .slice(position)
            .match(/^\s*"([^"]+)"/)?.[1];
          if (quoted === undefined) {
            warn(`Modifier Error: Unexpected '"' without closing`, {
              source,
              position,
            });
            return;
          }
          const lastToken = line.notes.at(-1);
          if (lastToken?.cate === "Barline") {
            const meterMatch = quoted.match(/p:(\d+)\/(\d+)/);
            if (meterMatch === null)
              warn(`Sign Error: Illegal temporary meter format '${quoted}'`, {
                source,
                position,
                length: quoted.length + 2,
              });
            else
              line.notes.push({
                ...createSign("meter", line.notes.length),
                meter: [Number(meterMatch[1]), Number(meterMatch[2])],
              });
          } else if (lastToken?.cate === "Note") {
            lastToken.comment = quoted;
          } else {
            warn(
              `Modifier Error: Comment must be attached to a note or a rest but found ${lastToken?.cate}`,
              {
                source,
                position,
                length: quoted.length + 2,
              }
            );
          }
          forceJump = position + quoted.length + 2;

          break;
        }
        case "(": {
          if (source[position + 1] === "y") {
            // 连音线
            parentheseStack.push({
              type: "tuplets",
              position,
              begin: line.notes.length,
            });
            forceJump = position + 2;
          } else {
            // 延音线
            parentheseStack.push({
              type: "legato",
              position,
              begin: line.notes.length,
            });
          }
          break;
        }
        case ")": {
          const tempReg = parentheseStack.pop();
          if (tempReg === undefined) {
            warn(`Mark Error: Unexpected ')' without '('`, {
              source,
              position,
            });
            return;
          }
          if (line.notes[tempReg.begin].cate !== "Note") {
            warn(
              `Mark Error: The first token of ${tempReg.type} must be note or rest`,
              {
                source,
                position: tempReg.position,
                lastPos: position,
              }
            );
            return;
          }
          if (lastToken!.cate !== "Note" && lastToken!.type !== "fermata") {
            warn(
              `Mark Error: The last token of ${tempReg.type} must be note, rest or fermata`,
              {
                source,
                position: tempReg.position,
                lastPos: position,
              }
            );
            return;
          }
          const begin = tempReg.begin;
          const end = line.notes.length - 1;
          if (tempReg.begin >= end) {
            warn(
              `Mark Error: Tokens within ${tempReg.type} must be no less than 2`,
              {
                source,
                position: tempReg.position,
                lastPos: position,
              }
            );
            return;
          }
          if (line.marks === undefined) line.marks = [];
          if (tempReg.type === "tuplets") {
            const legatoNotes = line.notes.slice(begin, end + 1);
            if (
              legatoNotes.filter(
                (token) => token.cate !== "Note" && token.type !== "fermata"
              ).length !== 0
            ) {
              warn(
                `Mark Error: Tuplets should not include tokens other than notes, rests and fermata`,
                {
                  source,
                  position: tempReg.position,
                  lastPos: position,
                }
              );
              return;
            }
            if (((end - begin + 1) & (end - begin)) === 0)
              warn(`Mark Warning: Tuplet number should not be a power of 2`, {
                source,
                position: tempReg.position,
                lastPos: position,
              });
            (<Array<Note | Sign>>legatoNotes).forEach((token) => {
              token.tuplets = end - begin + 1;
            });
          }
          line.marks.push({
            cate: "Mark",
            type: tempReg.type,
            begin,
            end,
            tuplets: tempReg.type === "tuplets" ? end - begin + 1 : undefined,
          });
          break;
        }
        case "<":
        case ">": {
          if (dynamicStack !== undefined) {
            warn(`Mark Error: Dynamics marks must not be nested`, {
              source,
              position,
            });
            return;
          }
          dynamicStack = {
            position,
            begin: line.notes.length - 1,
            type: <"cresc" | "dim">{ "<": "cresc", ">": "dim" }[char],
          };
          break;
        }
        case "!": {
          if (dynamicStack === undefined) {
            warn(`Mark Error: Unexpected '!' without previous '<' or '>'`, {
              source,
              position,
            });
            return;
          }
          const begin = dynamicStack.begin;
          const end = line.notes.length - 1;
          if (dynamicStack.begin >= end)
            warn(
              `Mark Warning: Tokens within long dynamic marks should be no less than 2`,
              {
                source,
                position: dynamicStack.position,
                lastPos: position,
              }
            );
          if (line.marks === undefined) line.marks = [];
          line.marks.push({
            cate: "Mark",
            type: dynamicStack.type,
            begin,
            end,
          });

          break;
        }
        case "[": {
          if (lastToken === undefined) {
            warn(`Mark Error: Unexpected '[' at the beginning of a line`, {
              source,
              position,
            });
          } else if (lastToken.cate === "Note") {
            // 倚音
            const graceMatch = source
              .slice(position)
              .match(/^\[(h?)([^\]]+)\]/);
            if (graceMatch === null) {
              warn(
                `Mark Error: Unexpected '[' without leagal grace expression`,
                {
                  source,
                  position,
                }
              );
              return;
            }
            const graceObj = parseLine(graceMatch[2]);
            if (graceObj.marks !== undefined) {
              warn(`Mark Error: Unexpected marks in grace expression`, {
                source,
                position,
                length: graceMatch[0].length,
              });
            } else {
              try {
                graceObj.notes.forEach((value) => {
                  if (value.cate !== "Note" || value.type === "rest")
                    throw new Error();
                  value.duration *= 2;
                });
                lastToken.grace = {
                  content: <Array<Note>>graceObj.notes,
                  position: graceMatch[1] === "h" ? "end" : "begin",
                };
              } catch (e) {
                warn(`Mark Error: Unexpected marks in grace expression`, {
                  source,
                  position,
                  length: graceMatch[0].length,
                });
              }
            }
            forceJump = position + graceMatch[0].length;
          } else if (lastToken.cate === "Barline") {
            // 跳房子
            const voltaMatch = source.slice(position).match(/^\["([^"]+)"/);
            if (voltaMatch === null) {
              warn(`Mark Error: Illegal volta expression`, {
                source,
                position,
              });
              return;
            }
            if (voltaStack !== undefined) {
              warn(`Mark Error: Voltas are not allowed to nest`, {
                source,
                position: voltaStack.position,
              });
              return;
            }
            voltaStack = {
              type: "volta",
              position,
              begin: lastToken.index,
              caption: voltaMatch[1],
            };
            forceJump = position + voltaMatch[0].length;
          } else {
            warn(`Mark Error: Unexpected '[' after ${lastToken.cate}`, {
              source,
              position,
            });
          }
          break;
        }
        case "]": {
          // 一定是跳房子（倚音会直接跳到 ']' 后面）
          if (lastToken?.cate !== "Barline") {
            warn(`Mark Error: Unexpected ']' after ${lastToken?.cate}`, {
              source,
              position,
            });
            return;
          }
          if (voltaStack === undefined) {
            warn(`Mark Error: Unexpected ']' without previous '['`, {
              source,
              position,
            });
            return;
          }
          if (line.marks === undefined) line.marks = [];
          line.marks.push({
            cate: "Mark",
            type: "volta",
            begin: voltaStack.begin,
            end: lastToken.index,
            caption: voltaStack.caption,
            lastInv: false,
          });
          voltaStack = undefined;
          break;
        }
        default: {
          warn(
            `Internal Error: Specialized char ${char} registered without implement`,
            { source, position }
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
            source,
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
          { source, position }
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
              { source, position }
            );
            break;
        }
      } else if (lastToken.cate === "Barline") {
        if (char === "/" && source[position - 1] === "]") {
          // "] +/"，跳房子
          if (line.marks === undefined) {
            warn(`Mark Error: Unexpected ']/' without previous volta`, {
              source,
              length: 2,
              lastPos: position,
            });
            return;
          }
          const mark = line.marks.filter(
            ({ type, end }) => type === "volta" && end === lastToken.index
          )?.[0];
          if (mark === undefined) {
            warn(`Mark Error: Unexpected ']/' without previous volta`, {
              source,
              length: 2,
              lastPos: position,
            });
            return;
          }
          mark.lastInv = true;
        } else if (char === "/" && lastToken.type === "normal")
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
            { source, position }
          );
      } else
        warn(
          `Modifier Error: Unexpected modifier '${char}' after ${lastToken.cate}`,
          { source, position }
        );
    } else if (state === "barline") {
      if (lastToken === undefined || lastToken.cate !== "Barline") {
        if (char === "|")
          // "|"
          line.notes.push(createBarline("normal", line.notes.length));
        else if (char === ":") {
          // ":|"
          if (source[position + 1] !== "|")
            warn("Barline Error: Unexpected ':' without '|'", {
              source,
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
              { source, position }
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
              { source, position }
            );
        }
      }
    }
  });
  if (forceJump !== undefined) {
    warn(`Internal Error: Forced jump not finished`, {
      source,
      position: 0,
    });
  }
  if (parentheseStack.length !== 0) {
    parentheseStack.forEach(({ position }) => {
      warn(`Mark Error: '(' not closed`, {
        source,
        position,
      });
    });
  }
  return line;
}

export function parse(code: string, config: RawPageConfig) {}
