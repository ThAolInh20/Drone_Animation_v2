export class GlobalTimeline {
  constructor() {
    this.isPlaying = false;
    this.startTime = 0;
    this.currentTime = 0;
  }

  play() {
    this.isPlaying = true;
    this.startTime = performance.now();
  }

  stop() {
    this.isPlaying = false;
  }

  update() {
    if (!this.isPlaying) return;

    this.currentTime = (performance.now() - this.startTime) / 1000;
  }
}
