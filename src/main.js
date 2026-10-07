import Phaser from 'phaser';
import * as C from './config.js';
import { GameScene } from './GameScene.js';

// The canvas is RES× the logical size and the camera zooms in, so shapes stay sharp on high-DPI phones.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: C.W * C.RES,
  height: C.H * C.RES,
  backgroundColor: '#10131c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
  scene: [GameScene],
});

if (import.meta.env.DEV) window.game = game; // handle for debugging in the console

