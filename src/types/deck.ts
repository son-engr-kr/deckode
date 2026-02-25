// ----- Geometry -----

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

// ----- Slide Background -----

export interface SlideBackground {
  color?: string;
  image?: string;
}

// ----- Slide Transition -----

export type TransitionType = "fade" | "slide" | "none";

export interface SlideTransition {
  type: TransitionType;
  duration?: number;
}

// ----- Element Styles -----

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  verticalAlign?: "top" | "middle" | "bottom";
}

export interface ImageStyle {
  objectFit?: "contain" | "cover" | "fill";
  borderRadius?: number;
  opacity?: number;
  border?: string;
}

export interface CodeStyle {
  theme?: string;
  fontSize?: number;
  lineNumbers?: boolean;
  highlightLines?: number[];
  borderRadius?: number;
}

export type ShapeKind = "rectangle" | "ellipse" | "line" | "arrow";

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
}

export interface VideoStyle {
  objectFit?: "contain" | "cover" | "fill";
  borderRadius?: number;
}

export interface TikZStyle {
  backgroundColor?: string;
  borderRadius?: number;
}

export interface TableStyle {
  fontSize?: number;
  color?: string;
  headerBackground?: string;
  headerColor?: string;
  borderColor?: string;
  striped?: boolean;
  borderRadius?: number;
}

// ----- Elements -----

interface BaseElement {
  id: string;
  position: Position;
  size: Size;
  rotation?: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  content: string;
  style?: TextStyle;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  style?: ImageStyle;
}

export interface CodeElement extends BaseElement {
  type: "code";
  language: string;
  content: string;
  style?: CodeStyle;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: ShapeKind;
  style?: ShapeStyle;
}

export interface VideoElement extends BaseElement {
  type: "video";
  src: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  style?: VideoStyle;
}

export interface TikZElement extends BaseElement {
  type: "tikz";
  content: string;
  svgUrl?: string;
  preamble?: string;
  renderedContent?: string;
  renderedPreamble?: string;
  renderError?: string;
  style?: TikZStyle;
}

export interface TableElement extends BaseElement {
  type: "table";
  columns: string[];
  rows: string[][];
  style?: TableStyle;
}

export interface CustomElement extends BaseElement {
  type: "custom";
  component: string;
  props?: Record<string, unknown>;
}

export type SlideElement = TextElement | ImageElement | CodeElement | ShapeElement | VideoElement | TikZElement | TableElement | CustomElement;

// ----- Animations -----

export type AnimationTrigger = "onEnter" | "onClick" | "onKey" | "afterPrevious" | "withPrevious";

export type AnimationEffect =
  | "fadeIn"
  | "fadeOut"
  | "slideInLeft"
  | "slideInRight"
  | "slideInUp"
  | "slideInDown"
  | "scaleIn"
  | "scaleOut"
  | "typewriter";

export interface Animation {
  target: string;
  trigger: AnimationTrigger;
  effect: AnimationEffect;
  delay?: number;
  duration?: number;
  order?: number;
  key?: string;
}

// ----- Slide -----

export interface Slide {
  id: string;
  layout?: string;
  background?: SlideBackground;
  transition?: SlideTransition;
  notes?: string;
  elements: SlideElement[];
  animations?: Animation[];
}

// ----- Theme -----

export interface DeckTheme {
  slide?: { background?: SlideBackground };
  text?: Partial<TextStyle>;
  code?: Partial<CodeStyle>;
  shape?: Partial<ShapeStyle>;
  image?: Partial<ImageStyle>;
  video?: Partial<VideoStyle>;
  tikz?: Partial<TikZStyle>;
  table?: Partial<TableStyle>;
}

// ----- Deck (top-level) -----

export interface DeckMeta {
  title: string;
  author?: string;
  aspectRatio: "16:9" | "4:3";
}

export interface Deck {
  deckode: string;
  meta: DeckMeta;
  theme?: DeckTheme;
  slides: Slide[];
}

// ----- Virtual canvas constants -----

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
