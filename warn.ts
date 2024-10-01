interface warnPos {
  source: string;
  index?: number;
  length?: number;
  lastIndex?: number;
}

/** 在控制台打印警告 */
export function warn(content: string, { source, index, length, lastIndex }: warnPos) {
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