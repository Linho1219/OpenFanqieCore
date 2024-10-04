interface warnPos {
  source: string;
  position?: number;
  length?: number;
  lastPos?: number;
}

/** 在控制台打印警告 */
export function warn(
  content: string,
  { source, position, length, lastPos }: warnPos
) {
  if (
    position !== undefined &&
    length !== undefined &&
    lastPos === undefined
  ) {
    // 无需调整
  } else if (
    position !== undefined &&
    length === undefined &&
    lastPos === undefined
  ) {
    length = 1;
  } else if (
    position !== undefined &&
    length === undefined &&
    lastPos !== undefined
  ) {
    length = lastPos - position + 1;
  } else if (
    position === undefined &&
    length !== undefined &&
    lastPos !== undefined
  ) {
    position = lastPos - length;
  } else throw new Error("Internal Error: Bad warning");
  console.warn(
    `${content} @ char ${position}\n  source: ${source}\n${" ".repeat(
      position + 10
    )}${"^".repeat(length)}`
  );
}
