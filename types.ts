/**
 * 类型定义
 */

/** 描述头 */
export type Metadata = {
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

export const METADATA_PREFIX = ["V", "B", "Z", "D", "P", "J"];

export const formatMode = (mode: string) =>
  mode[0] + (mode[1] === "#" ? "♯" : "") + (mode[1] === "$" ? "♭" : "");

/** 原始字体格式 */
export type FontFamily = "Microsoft YaHei" | "SimSun" | "SimHei" | "KaiTi";

/** 原始页面设置 */
export type RawPageConfig = {
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
  biaoti_font: FontFamily;
  /** 数字字体 现代/经典/罗马 */
  shuzi_font: "a" | "b" | "c";
  /** 歌词字体 */
  geci_font: FontFamily;
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

export const DEFAULT_PAGE_CONFIG: RawPageConfig = {
  page: "A4",
  margin_top: "80",
  margin_bottom: "80",
  margin_left: "80",
  margin_right: "80",
  biaoti_font: "Microsoft YaHei",
  shuzi_font: "b",
  geci_font: "Microsoft YaHei",
  height_quci: "13",
  height_cici: "10",
  height_ciqu: "40",
  height_shengbu: "0",
  biaoti_size: "36",
  fubiaoti_size: "20",
  geci_size: "18",
  body_margin_top: "40",
  lianyinxian_type: "0",
};

type FontConfig = {
  /** 字体家族 */
  fontFamily: string;
  /** 字号 */
  fontSize: number;
};

/** 页面设置 */
export type PageConfig = {
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

export const PAGE_PRESETS = {
  A4: { width: 1000, height: 1415 },
  A5: { width: 840, height: 1193 },
  A4_horizontal: { width: 1415, height: 1000 },
  A5_horizontal: { width: 1193, height: 840 },
};

/** 音符和休止符 */
export type Note = {
  cate: "Note";
  type: "note" | "rest";
  /** 音高，数字 1-7，休止符为 0, X 为 9*/
  pitch: Number;
  /** 区域，数字 0 表示不加点，+n 上加 n 点，-n 下加 n 点 */
  range: number;
  /** 时值，存储分母，四分音符为 4，八分为 8 */
  duration: number;
  /** 附点个数 */
  dot?: 0 | 1 | 2;
  /** 升# 降$ 还原= */
  accidental?: "sharp" | "flat" | "natural";
  /** 装饰记号，用 & 开头 */
  ornaments?: Array<string>;
  /** 倚音 */
  grace?: {
    position: "begin" | "end";
    content: Array<Note>;
  };
  /** 多连音 */
  tuplets?: number;
  /** 注释 */
  comment?: string;
  index: number;
  /** 歌词 */
  lyric?: Array<string>;
};

/** Sign 命令列表 */
export const SIGN_CMD_LIST = ["dsb"];

/** 音符装饰记号列表，记入 note.ornaments */
export const NOTE_ORN_LIST = [
  "zkh",
  "ykh",
  "ppp",
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
  "sby_",
  "xby",
  "xby_",
  "cy",
  "cy_",
];

/** 新建音符/休止符 */
export const createNote = (char: string, index: number): Note => ({
  cate: "Note",
  type: char === "0" ? "rest" : "note",
  pitch: Number(char),
  range: 0,
  duration: 4,
  index,
});

export type SignType = "fermata" | "invisible" | "meter" | "bracket";
// | "parenthese-left"
// | "parenthese-right";

/** 在谱面中与音符所占位置相同的记号，混入 line.notes */
export type Sign = {
  cate: "Sign";
  type: SignType;
  meter?: [number, number];
  ornaments?: Array<string>;
  tuplets?: number;
  index: number;
};

export const createSign = (type: SignType, index: number): Sign => ({
  cate: "Sign",
  type,
  index,
});

/** 在谱面中跨音符的记号，记录在 line.marks */
type MarkType = "cresc" | "dim" | "tuplets" | "legato" | "volta";

export type Mark = {
  cate: "Mark";
  type: MarkType;
  begin: number;
  end: number;
  /** 多连音 */
  tuplets?: number;
  /** 跳房子的文本 */
  caption?: string;
  /** 跳房子结尾不可见 */
  lastInv?: boolean;
};

export type MarkReg = {
  position: number;
  type: MarkType;
  object?: Mark;
  begin: number;
  caption?: string;
};

export const SPEC_CHAR = ['"', "(", ")", "<", ">", "!", "[", "]"];

type BarlineType =
  | "normal" // "|"
  | "end" // "||"
  | "double" // "||/"
  | "repeatL" // "|:"
  | "repeatR" // ":|"
  | "repeatD" // ":|:"
  | "hidden" // "|/"，不显示也不占据空间
  | "invisible"; // "|*"，不显示但占据空间

/** 小节线 */
export type Barline = {
  cate: "Barline";
  type: BarlineType;
  ornaments?: Array<string>;
  index: number;
};

export const createBarline = (type: BarlineType, index: number): Barline => ({
  cate: "Barline",
  type,
  index,
});

/** 小节线装饰记号列表 */
export const BARLINE_ORN_LIST = ["fine", "dc", "ds", "ty", "hs"];

// 分块部分

export type RawLine = {
  index: number;
  caption?: string;
  rawLine: string;
  rawLyric: Array<string>;
};
export type RawLineMulti = Array<RawLine>;
export type RawPage = Array<RawLineMulti>;

export type DivideResult = {
  metadata: Metadata;
  rawPages: Array<RawPage>;
};

// 行解析部分

export type State =
  | "space"
  | "note"
  | "sign"
  | "modifier"
  | "barline"
  | "command";

export type Ele = Note | Sign | Barline;

export type Line = {
  notes: Array<Ele>;
  marks?: Array<Mark>;
  lrcCnt: number;
  caption?: string;
};

export type LineMulti = Array<Line>;
export type Page = Array<LineMulti>;

export type FullObj = {
  config: PageConfig;
  metadata: Metadata;
  pages: Array<Page>;
};
