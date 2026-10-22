import Phaser from 'phaser';
import { makeTextures } from './art';

/** Genera el arte en canvas y pasa a la introducción. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    makeTextures(this);
    this.scene.start('intro');
  }
}
