export function draw(input: string) {
  /** 描述头定义 */
  type head = {
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

  /** 音符定义 */
  type note = {
    /** 音符类型 */
    type: "note" | "rest" | "invisible";
    /** 音高，数字 1-7，休止符为 0 */
    pitch: number;
    /** 区域，数字 0 表示不加点，+1 上加一点，-1 下加一点 */
    range: number;
    /** 时值，存储分母，四分音符存 4，八分为 8 */
    duration: number;
    /** 附点 */
    dot: boolean;
		/** 升# 降$ 还原= */
    accidental: "none" | "sharp" | "flat" | "natural";
  };
  let a: note;
}
