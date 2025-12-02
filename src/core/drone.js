export class Drone {
  constructor({
    id,
    name = "Drone",
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0 },
    speed = 1,
    battery = 100,
    status = "idle",
    model = null,
    timeline = [],
  }) {
    this.id = id;
    this.name = name;
    this.position = position;
    this.rotation = rotation;
    this.speed = speed;
    this.battery = battery;
    this.status = status;
    this.model = model;

    // timeline: [{ time, x, y, z }]
    this.timeline = timeline;

    // playback state
    this.isPlaying = false;
    this.startTime = 0;
  }

  // Gán model 3D
  setModel(mesh) {
    this.model = mesh;
    this.update(); // cập nhật lần đầu
  }

  // Thêm keyframe
  addKeyframe(pos) {
    const time = this.timeline.length; // auto tăng
    this.timeline.push({
      time,
      x: pos.x,
      y: pos.y,
      z: pos.z,
    });
  }

  // Bắt đầu chạy timeline
  play() {
    if (this.timeline.length < 2) return false;

    this.isPlaying = true;
    this.startTime = performance.now();
    return true;
  }

  // Ngưng chạy timeline
  stop() {
    this.isPlaying = false;
  }

  // Hàm nội suy (lerp) từ timeline
  updateTimeline() {
    if (!this.isPlaying) return;

    const arr = this.timeline;
    const t = (performance.now() - this.startTime) / 1000; // giây

    let k1 = null, k2 = null;

    for (let i = 0; i < arr.length - 1; i++) {
      if (t >= arr[i].time && t <= arr[i + 1].time) {
        k1 = arr[i];
        k2 = arr[i + 1];
        break;
      }
    }

    // Không còn key tiếp theo => dừng
    if (!k2) {
      this.isPlaying = false;
      return;
    }

    const duration = k2.time - k1.time;
    const localT = (t - k1.time) / duration;

    // Lerp position
    this.position.x = k1.x + (k2.x - k1.x) * localT;
    this.position.y = k1.y + (k2.y - k1.y) * localT;
    this.position.z = k1.z + (k2.z - k1.z) * localT;

    this.update();
  }

  // Cập nhật model mesh
  update() {
    if (!this.model) return;

    this.model.position.set(this.position.x, this.position.y, this.position.z);
    this.model.rotation.set(
      this.rotation.x,
      this.rotation.y,
      this.rotation.z
    );
  }
  // Áp dụng timeline tại thời điểm globalTime
  applyTimeline(globalTime) {
    const arr = this.timeline;
    if (!arr || arr.length === 0) return;

    let k1 = null, k2 = null;

    for (let i = 0; i < arr.length - 1; i++) {
        if (globalTime >= arr[i].time && globalTime <= arr[i + 1].time) {
        k1 = arr[i];
        k2 = arr[i + 1];
        break;
        }
    }

    if (!k2) return; // ra ngoài range => đứng yên

    const t = (globalTime - k1.time) / (k2.time - k1.time);
    
    this.position.x = k1.x + (k2.x - k1.x) * t;
    this.position.y = k1.y + (k2.y - k1.y) * t;
    this.position.z = k1.z + (k2.z - k1.z) * t;

    this.update();
    }
}
