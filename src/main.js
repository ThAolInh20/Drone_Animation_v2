import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Drone } from "./core/drone.js";
import { GlobalTimeline } from "./core/timeline.js";


// ------------------------------------------------------------
// THREE SETUP
// ------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color("#dce3f1");
const droneListPanel = document.getElementById("droneListPanel");
const btnDroneList = document.getElementById("btnDroneList");
const droneList = document.getElementById("droneList");
//kích thước drone mặc định
const geoSize = 0.25;

const globalTimeline = new GlobalTimeline(); // 🌟 TIMELINE CHUNG

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(6, 6, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
function makeTextLabel(text, color = "#ff0000") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  ctx.font = "bold 80px Arial";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.8, 0.8, 0.8);

  return sprite;
}
btnDroneList.onclick = () => {
  droneListPanel.style.display =
    droneListPanel.style.display === "block" ? "none" : "block";
};
// ------------------------------------------------------------
// GROUND + GRID
// ------------------------------------------------------------
let gridMainColor = 0x444444;
let gridSubColor = 0xbbbbbb;

let grid = new THREE.GridHelper(20, 40, gridMainColor, gridSubColor);
grid.position.y = -0.01;
scene.add(grid);

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: "#ffffff" })
);
plane.rotation.x = -Math.PI / 2;


scene.add(plane);

// ------------------------------------------------------------
// AXIS LABELS
// ------------------------------------------------------------
const labelX = makeTextLabel("X", "#ff4444");
labelX.position.set(2, 0.1, 0);

const labelY = makeTextLabel("Y", "#44ff44");
labelY.position.set(0, 2, 0);

const labelZ = makeTextLabel("Z", "#4444ff");
labelZ.position.set(0, 0.1, 2);

scene.add(labelX);
scene.add(labelY);
scene.add(labelZ);


// ------------------------------------------------------------
// LIGHT
// ------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(6, 10, 4);
scene.add(dir);

// ------------------------------------------------------------
// DRONE SYSTEM
// ------------------------------------------------------------
let drones = [];
let selectedDrone = null;
function resetDroneColors() {
  drones.forEach(d => {
    const mesh = d.model;
    if (mesh && mesh.userData.originalColor) {
      mesh.material.color.copy(mesh.userData.originalColor);
    }
  });
}
function createDrone() {
  const geo = new THREE.SphereGeometry(geoSize, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: Math.random() * 0xffffff,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.5, 0);
  scene.add(mesh);

  const drone = new Drone({
    id: Date.now(),
    model: mesh,
    position: { x: 0, y: 0.5, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    timeline: [],
  });
  drone.originalColor = mat.color.getHex();
  mesh.userData.originalColor = mesh.material.color.clone();
  mesh.userData.drone = drone;
  drones.push(drone);
  renderDroneList();
  return drone;
}

// ------------------------------------------------------------
// HIGHLIGHT RING
// ------------------------------------------------------------
let highlightRing = null;

function createHighlightRing() {
  const geo = new THREE.RingGeometry(geoSize*1.25, geoSize*0.25, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00ff99,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });

  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  return ring;
}

highlightRing = createHighlightRing();

// ------------------------------------------------------------
// PICK DRONE
// ------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("pointerdown", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(scene.children);

  if (hits.length > 0 && hits[0].object.userData.drone) {
  
    // 🌟 Reset toàn bộ drone về màu gốc
    resetDroneColors();

    selectedDrone = hits[0].object.userData.drone;

    // 🌟 Đổi màu drone đang chọn
    selectedDrone.model.material.color.set(0x00ff99);

    // Hiển thị highlight
    highlightRing.visible = true;
    highlightRing.position.set(
      selectedDrone.position.x,
      0.02,
      selectedDrone.position.z
    );

    loadDroneProperties();
    renderDroneList();
    renderKeyList();
  }
// else {
//     // Click đất → bỏ chọn
//       if (selectedDrone) {
//           selectedDrone.model.material.color.set(selectedDrone.originalColor);
//       }
//       selectedDrone = null;
//       highlightRing.visible = false;
//   }
});


// -------------------------------------------------------------
// AXIS VIEWPORT (UI trục XYZ ở góc phải)
// -------------------------------------------------------------
const axisScene = new THREE.Scene();
const axisCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
axisCamera.up = camera.up;

const axisRenderer = new THREE.WebGLRenderer({ alpha: true });
axisRenderer.setSize(120, 120);     // kích thước UI
axisRenderer.domElement.style.position = "fixed";
axisRenderer.domElement.style.top = "10px";
axisRenderer.domElement.style.right = "10px";
axisRenderer.domElement.style.pointerEvents = "none"; // không bắt chuột
document.body.appendChild(axisRenderer.domElement);

// tạo trục XYZ
const axisHelper = new THREE.AxesHelper(1.5);
axisScene.add(axisHelper);

// ------------------------------------------------------------
// UI HANDLERS
// ------------------------------------------------------------
const btnAdd = document.getElementById("btnAddDrone");
const btnProps = document.getElementById("btnProperties");
const btnSet = document.getElementById("btnSettings");
const btnTime = document.getElementById("btnTimeline");

const panelProps = document.getElementById("panelProperties");
const panelSettings = document.getElementById("panelSettings");
const panelTimeline = document.getElementById("panelTimeline");

const keyEdit = document.getElementById("keyEdit");
const kfTime = document.getElementById("kfTime");
const kfX = document.getElementById("kfX");
const kfY = document.getElementById("kfY");
const kfZ = document.getElementById("kfZ");
const btnSaveKey = document.getElementById("btnSaveKey");

let editingKeyIndex = null;

btnAdd.onclick = () => createDrone();

btnProps.onclick = () =>
  (panelProps.style.display =
    panelProps.style.display === "block" ? "none" : "block");

btnSet.onclick = () =>
  (panelSettings.style.display =
    panelSettings.style.display === "block" ? "none" : "block");

btnTime.onclick = () =>
  (panelTimeline.style.display =
    panelTimeline.style.display === "block" ? "none" : "block");

// ------------------------------------------------------------
// PROPERTIES EDITOR
// ------------------------------------------------------------
const colorInput = document.getElementById("droneColor");
const sizeInput = document.getElementById("droneSize");

function loadDroneProperties() {
  if (!selectedDrone) return;

  colorInput.value =
    "#" + selectedDrone.model.material.color.getHexString();
  sizeInput.value = selectedDrone.model.scale.x;

  colorInput.oninput = () =>
    selectedDrone.model.material.color.set(colorInput.value);

  sizeInput.oninput = () =>
    selectedDrone.model.scale.set(
      sizeInput.value,
      sizeInput.value,
      sizeInput.value
    );
}

// ------------------------------------------------------------
// SETTINGS
// ------------------------------------------------------------
document.getElementById("bgColor").oninput = (e) => {
  scene.background = new THREE.Color(e.target.value);
};

document.getElementById("gridMain").oninput = (e) => {
  gridMainColor = e.target.value;
  updateGrid();
};

document.getElementById("gridSub").oninput = (e) => {
  gridSubColor = e.target.value;
  updateGrid();
};

function updateGrid() {
  scene.remove(grid);
  grid = new THREE.GridHelper(20, 40, gridMainColor, gridSubColor);
  grid.position.y = -0.01;
  scene.add(grid);
}

// ------------------------------------------------------------
// TIMELINE UI
// ------------------------------------------------------------
const btnAddKey = document.getElementById("btnAddKey");
const btnPlay = document.getElementById("btnPlayTimeline");
const keyList = document.getElementById("keyList");

btnAddKey.onclick = () => {
  if (!selectedDrone) return alert("Chọn drone trước!");

  selectedDrone.addKeyframe(selectedDrone.position);
  renderKeyList();
};

// PLAY TIMELINE
btnPlay.onclick = () => globalTimeline.play();

function loadKeyframeEditor(key) {
  keyEdit.style.display = "block";

  kfTime.value = key.time;
  kfX.value = key.x;
  kfY.value = key.y;
  kfZ.value = key.z;
}

function renderKeyList() {
  keyList.innerHTML = "";
  keyEdit.style.display = "none";

  if (!selectedDrone) return;

  selectedDrone.timeline.forEach((key, index) => {
    const div = document.createElement("div");
    div.className = "key-item";
    div.textContent = `t=${key.time} → (${key.x}, ${key.y}, ${key.z})`;

    div.onclick = () => {
      editingKeyIndex = index;
      loadKeyframeEditor(key);
    };

    keyList.appendChild(div);
  });
}

btnSaveKey.onclick = () => {
  if (editingKeyIndex === null || !selectedDrone) return;

  const arr = selectedDrone.timeline;
  const k = arr[editingKeyIndex];

  k.time = parseFloat(kfTime.value);
  k.x = parseFloat(kfX.value);
  k.y = parseFloat(kfY.value);
  k.z = parseFloat(kfZ.value);

  arr.sort((a, b) => a.time - b.time);
  renderKeyList();
};

// ------------------------------------------------------------
// ANIMATION LOOP
// ------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  // Cập nhật timeline chung
  globalTimeline.update();

  // Tất cả drone apply timeline
  drones.forEach((d) => d.applyTimeline(globalTimeline.currentTime));

  // 🔥 Cập nhật highlight ring theo drone đã chọn
  if (selectedDrone) {
    highlightRing.visible = true;
    highlightRing.position.set(
      selectedDrone.position.x,
      0.02,
      selectedDrone.position.z
    );
  }
  // render UI trục theo hướng camera
  axisCamera.position.copy(camera.position).sub(controls.target).normalize();
  axisCamera.position.multiplyScalar(3);
  axisCamera.lookAt(axisScene.position);
  axisRenderer.render(axisScene, axisCamera);

  controls.update();
  labelX.lookAt(camera.position);
  labelY.lookAt(camera.position);
  labelZ.lookAt(camera.position);
  renderer.render(scene, camera);
}

animate();

// ------------------------------------------------------------
// WINDOW RESIZE
// ------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
function renderDroneList() {
  droneList.innerHTML = "";

  drones.forEach(drone => {
    const div = document.createElement("div");
    div.className = "drone-item";
    div.textContent = drone.name + " #" + drone.id;

    if (selectedDrone && selectedDrone.id === drone.id) {
      div.classList.add("active");
    }

    // click chọn drone từ list
    div.onclick = () => {
      // bỏ highlight drone cũ
      if (selectedDrone && selectedDrone !== drone) {
        selectedDrone.model.material.color.set(selectedDrone.originalColor);
      }

      selectedDrone = drone;

      // highlight drone mới
      selectedDrone.model.material.color.set(0xffff33);

      highlightRing.visible = true;
      highlightRing.position.set(
        selectedDrone.position.x,
        0.02,
        selectedDrone.position.z
      );

      loadDroneProperties();
      renderKeyList();
      renderDroneList();
    };

    droneList.appendChild(div);
  });
}

