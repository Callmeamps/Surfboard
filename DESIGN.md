---
name: Surfboard
description: A riced Electron browser with paper sandbox aesthetic
colors:
  ink: "#000000"
  paper: "#f5f0e8"
  paper-warm: "#ede6d8"
  paper-cool: "#e8e4dc"
  silver: "#c0c0c0"
  silver-light: "#d8d8d8"
  silver-dark: "#8a8a8a"
  clay: "#c4a882"
  clay-deep: "#a68b6b"
  terracotta: "#c97b5a"
  moss: "#7d8a6f"
  stone: "#6b6560"
  parchment: "#d4cfc4"
  bg-deep: "#0a0a0a"
  bg-surface: "#141414"
  bg-elevated: "#1e1e1e"
  bg-hover: "#282828"
  bg-active: "#333333"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontWeight: 400
  body:
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  mono:
    fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace"
rounded:
  none: "0"
  sm: "2px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.silver}"
    borderBottom: "2px solid transparent"
  tab-active:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.paper}"
    borderBottom: "2px solid {colors.terracotta}"
  paper-card:
    backgroundColor: "{colors.bg-surface}"
    border: "1px solid {colors.border}"
  paper-card-active:
    border: "2px solid {colors.terracotta}"
---

# Design System: Surfboard

## 1. Overview

**Creative North Star: "The Paper Sandbox"**

A workspace that feels like scattered papers on a dark desk. Not chrome, not glass, not neon. Paper. Earth. Silver tools. The browser is a surface for thinking, not a product to admire.

The aesthetic rejects corporate sterility (Chrome), bloated AI overlays (Edge Copilot), and over-designed spatial interfaces (Arc). It embraces imperfection: paint-stroke underlines, paper grain texture, edgeless shapes that feel hand-placed rather than mathematically rounded.

**Key Characteristics:**
- Deep black base with earthy warmth
- Paper texture and grain throughout
- Paint-stroke decorative elements
- Edgeless, soft shapes
- Silver as the functional accent
- Terracotta for emphasis and active states

## 2. Colors

A palette pulled from a woodworker's desk: deep shadows, warm paper, cool metal tools.

### Primary (Emphasis)
- **Terracotta** (#c97b5a): Active states, focus rings, paint-stroke accents. Warm, earthy, confident.

### Neutral
- **Ink** (#000000): True black base. No gray compromise.
- **Paper** (#f5f0e8): Primary text, light elements. Warm off-white.
- **Silver** (#c0c0c0): Secondary text, borders, functional elements. Cool metal.
- **Silver Dark** (#8a8a8a): Muted text, inactive states.
- **Bg Surface** (#141414): Elevated surfaces, cards.
- **Bg Hover** (#282828): Hover states.

### Earthy Tones
- **Clay** (#c4a882): Subtle warm accents.
- **Moss** (#7d8a6f): Success states, nature accents.
- **Stone** (#6b6560): Borders, dividers.

### Named Rules

**The Earthy Rule.** Colors come from natural materials: clay, moss, stone, terracotta. No synthetic blues, purples, or neons. The palette should feel like a physical desk, not a digital interface.

**The Silver Rule.** Silver is for tools and functional elements only. It's the metal in the workspace, not the paper.

## 3. Typography

**Display Font:** Georgia (serif) for headings, emphasis, decorative text.
**Body Font:** Helvetica Neue / Arial (sans-serif) for interface text.
**Mono Font:** SF Mono / Fira Code for code, shortcuts, technical elements.

**Character:** The serif display adds warmth and personality. It's not a corporate sans-serif stack. The body stays clean and readable. The mono font handles technical content without dominating.

### Hierarchy
- **Display** (Georgia, 400, 18px): Section headers, decorative labels.
- **Body** (Helvetica Neue, 400, 13px): Interface text, descriptions.
- **Label** (Helvetica Neue, 400, 10px, uppercase, 0.08em tracking): Section eyebrows, meta text.
- **Mono** (SF Mono, 400, 12px): Shortcuts, code, technical values.

### Named Rules

**The Paint Stroke Rule.** Decorative underlines use paint-stroke clip-paths, not solid lines. They're imperfect by design.

## 4. Elevation

Flat by default. Depth is conveyed through tonal shifts (bg-surface → bg-elevated → bg-hover), not shadows. Shadows appear only as functional feedback: paper cards lift on hover, active elements glow.

### Shadow Vocabulary
- **Lift** (`0 12px 40px rgba(0,0,0,0.5)`): Paper cards on hover.
- **Glow** (`0 0 8px var(--terracotta)`): Active minimap items, focus states.

### Named Rules

**The Flat Desk Rule.** Surfaces are flat at rest. Shadows are responses to interaction, not decoration.

## 5. Components

### Tabs
- **Style:** Edgeless, paint-stroke underline on active.
- **Active:** Terracotta bottom border, slight bg elevation.
- **Hover:** Silver bottom border, bg highlight.

### Paper Cards (Switcher View)
- **Shape:** Sharp corners, no border-radius.
- **Background:** bg-surface, lifts on hover.
- **Active:** Terracotta border glow.

### Bookmarks
- **Style:** Simple list items, no decoration.
- **Hover:** bg-hover highlight.

### Buttons
- **Style:** Flat, no border-radius, minimal.
- **Hover:** bg-hover, silver text.
- **Active:** Terracotta accent.

### Inputs
- **Style:** bg-elevated background, silver border.
- **Focus:** Silver-dark border.

## 6. Do's and Don'ts

### Do:
- **Do** use terracotta for emphasis sparingly. It's the only warm accent.
- **Do** use paper texture overlay for depth and character.
- **Do** use paint-stroke clip-paths for decorative underlines.
- **Do** keep shapes edgeless. No border-radius above 4px.
- **Do** use tonal shifts for depth, not shadows.

### Don't:
- **Don't** use blue, purple, or neon accents. This isn't a cyberpunk theme.
- **Don't** round corners aggressively. This isn't Arc or iOS.
- **Don't** add glass effects, blur, or transparency. Keep it solid.
- **Don't** use gradient text or decorative gradients.
- **Don't** make shadows ambient. They're functional feedback only.
