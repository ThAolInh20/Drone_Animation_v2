export class DroneGroup {
  constructor(name = "Group") {
    this.name = name;
    this.drones = [];
    this.active = true;
    this.speedMultiplier = 1;
    this.color = "#ffffff";
  }

  addDrone(drone) {
    this.drones.push(drone);
  }

  removeDrone(id) {
    this.drones = this.drones.filter(d => d.id !== id);
  }

  update() {
    if (!this.active) return;
    this.drones.forEach(d => d.update());
  }
}
