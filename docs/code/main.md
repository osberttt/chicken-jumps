# main.js

Entry point. Creates the `Phaser.Game` with a single scene, [GameScene](GameScene.md).

## What it sets up

| Option | Value | Why |
|---|---|---|
| `width`, `height` | `C.W * C.RES`, `C.H * C.RES` | The canvas is rendered at the device's real pixel density. `GameScene` zooms its camera by `RES`, so game code still works in logical pixels. See [config.md → Screen and resolution](config.md#screen-and-resolution). |
| `scale.mode` | `FIT`, centered | The canvas keeps its aspect ratio and fits the window. `H` was already chosen to match the screen's aspect ratio (within limits), so on most phones there are no side bars. |
| `type` | `AUTO` | WebGL, falling back to Canvas. Drawing code avoids features that differ between the two (for example, the player ellipse is built from points instead of using transforms). |
| `backgroundColor` | `#10131c` | Only visible for a moment before the first frame. After that the camera and page background follow the palette. |

In dev mode (`npm run dev`) the game object is exposed as `window.game` for poking at it in the browser console.

## index.html

The page has one `#game` div that fills the viewport. The CSS turns off scrolling, text selection, tap highlights and overscroll, so drags on a phone go to the game and not to the browser. `draw.js` keeps `document.body`'s background color in sync with the palette, so any letterbox bars match the game.
