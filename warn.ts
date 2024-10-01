interface warnPos {
  source: string;
  position?: number;
  length?: number;
  lastIndex?: number;
}

/** 在控制台打印警告 */
export function warn(content: string, { source, position, length, lastIndex }: warnPos) {
  if (position !== undefined && length !== undefined && lastIndex === undefined) {
    // 无需调整
  } else if (
    position !== undefined &&
    length === undefined &&
    lastIndex === undefined
  ) {
    length = 1;
  } else if (
    position !== undefined &&
    length === undefined &&
    lastIndex !== undefined
  ) {
    length = lastIndex - position;
  } else if (
    position === undefined &&
    length !== undefined &&
    lastIndex !== undefined
  ) {
    position = lastIndex - length;
  } else throw new Error("Internal Error: Bad warning");
  console.warn(
    `${content} @ char ${position}\n  source: ${source}\n${" ".repeat(
      position + 10
    )}${"^".repeat(length)}`
  );
}