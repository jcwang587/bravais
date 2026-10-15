import { elementColor } from "./palette";

const STYLE_ID = "bravais-styles";

/** Styles for the viewer's overlay elements, injected once per document. */
const STYLES = `
.bravais-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.bravais-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}
.bravais-legend {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 16px;
  max-width: calc(100% - 32px);
  padding: 8px 16px;
  border: 1px solid rgba(40, 40, 40, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(150%);
  box-shadow: 0 10px 15px -3px rgba(40, 40, 40, 0.1);
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1;
  color: #282828;
  pointer-events: none;
}
.bravais-legend[hidden] {
  display: none;
}
.bravais-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bravais-legend-swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(40, 40, 40, 0.1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
`;

export function ensureViewerStyles(root: Document): void {
  if (root.getElementById(STYLE_ID)) {
    return;
  }
  const style = root.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  root.head.appendChild(style);
}

// The lit-sphere swatch currently follows Pretty Lattice's legend.
function swatchBackground(color: string): string {
  return `linear-gradient(135deg, rgba(255, 255, 255, 0.38) 0 14%, rgba(255, 255, 255, 0) 42%), ${color}`;
}

/** The element legend pill at the bottom of the viewer. */
export class ElementLegend {
  readonly element: HTMLElement;

  constructor(root: Document) {
    this.element = root.createElement("div");
    this.element.className = "bravais-legend";
    this.element.hidden = true;
  }

  setElements(elements: string[]): void {
    this.element.replaceChildren();
    for (const symbol of elements) {
      const item = this.element.ownerDocument.createElement("span");
      item.className = "bravais-legend-item";
      const swatch = this.element.ownerDocument.createElement("span");
      swatch.className = "bravais-legend-swatch";
      swatch.style.background = swatchBackground(elementColor(symbol));
      const label = this.element.ownerDocument.createElement("span");
      label.textContent = symbol;
      item.append(swatch, label);
      this.element.appendChild(item);
    }
    this.element.hidden = elements.length === 0;
  }
}
