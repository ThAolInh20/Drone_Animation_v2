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

let deletedStack = []; // lưu các drone đã xóa tạm: { drone, index }
const DELETED_STACK_LIMIT = 50;

const globalTimeline = new GlobalTimeline(); // 🌟 TIMELINE CHUNG
let lastContextPoint = null; // THREE.Vector3 world point của lần right-click
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
// Tạo drone (mesh + Drone class), optional pos {x,y,z}
function createDrone(pos = { x: 0, y: 0.5, z: 0 }) {
  const geo = new THREE.SphereGeometry(0.25, 32, 32); // nếu bạn muốn nhỏ hơn
  const mat = new THREE.MeshStandardMaterial({
    color: Math.random() * 0xffffff,
  });
  const mesh = new THREE.Mesh(geo, mat);

  // đặt vị trí theo pos nếu có
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);

  const drone = new Drone({
    id: Date.now(),
    model: mesh,
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: 0, y: 0, z: 0 },
    timeline: [],
  });
  drone.manualOverride = false;

  // lưu màu gốc để highlight trở về
  drone.originalColor = mat.color.getHex();

  mesh.userData.drone = drone;
  drones.push(drone);

  // cập nhật danh sách UI nếu bạn có renderDroneList()
  if (typeof renderDroneList === "function") renderDroneList();

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
const contextMenu = document.getElementById("contextMenu");
const ctxAddBtn = document.getElementById("ctxAddDrone");
// show custom context menu on right-click (renderer.domElement)
renderer.domElement.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  

  // show menu at mouse position
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.style.display = "block";

  const ctxDeleteBtn = document.getElementById("ctxDeleteDrone");

  // Ẩn/hiện nút delete tùy có drone được chọn hay không
  // kiểm tra drone có được chọn chưa
  const hasDrone = !!selectedDrone;

  document.getElementById("ctxDeleteDrone").style.display = hasDrone ? "block" : "none";
  document.getElementById("ctxProperties").style.display = hasDrone ? "block" : "none";

  // compute normalized device coords
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  // raycast to plane to get world position
  raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
  const intersects = raycaster.intersectObject(plane, true);

  if (intersects.length > 0) {
    lastContextPoint = intersects[0].point.clone();
  } else {
    // nếu không trúng plane, ray xuống y=0 (dự phòng)
    // tạo plane ngang y=0
    const t = (0 - camera.position.y) / (raycaster.ray.direction.y || 1e-6);
    const fallback = raycaster.ray.at(t, new THREE.Vector3());
    lastContextPoint = fallback;
  }
});
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
// const btnProps = document.getElementById("btnProperties");
const btnSet = document.getElementById("btnSettings");
// const btnTime = document.getElementById("btnTimeline");

const panelProps = document.getElementById("panelProperties");
const panelSettings = document.getElementById("panelSettings");
const panelTimeline = document.getElementById("panelTimeline");
const xInput = document.getElementById("droneX");
const yInput = document.getElementById("droneY");
const zInput = document.getElementById("droneZ");
const btnApplyToTimeline = document.getElementById("btnApplyToTimeline");
const btnClearOverride = document.getElementById("btnClearOverride");

const keyEdit = document.getElementById("keyEdit");
const kfTime = document.getElementById("kfTime");
const kfX = document.getElementById("kfX");
const kfY = document.getElementById("kfY");
const kfZ = document.getElementById("kfZ");
const btnSaveKey = document.getElementById("btnSaveKey");
const btnDeleteDrone = document.getElementById("btnDeleteDrone");
const ctxDeleteBtn = document.getElementById("ctxDeleteDrone");
const ctxPropertiesBtn = document.getElementById("ctxProperties");

let editingKeyIndex = null;

btnAdd.onclick = () => createDrone();
ctxAddBtn.addEventListener("click", () => {
  if (!lastContextPoint) {
    // fallback: tạo ở trước camera
    const fallbackPos = { x: camera.position.x, y: 0.5, z: camera.position.z - 2 };
    createDrone(fallbackPos);
  } else {
    // đặt drone cao hơn mặt phẳng chút (v.d. y = planeY + 0.5)
    const planeY = plane.position.y || 0;
    const spawnPos = { x: lastContextPoint.x, y: planeY + 0.5, z: lastContextPoint.z };
    createDrone(spawnPos);
  }

  // ẩn menu sau khi thêm
  contextMenu.style.display = "none";
  lastContextPoint = null;
});
btnApplyToTimeline.onclick = () => {
  if (!selectedDrone) return;

  const arr = selectedDrone.timeline;

  // Nếu timeline trống → bắt đầu từ 0
  if (arr.length === 0) {
    arr.push({
      time: 0,
      x: selectedDrone.position.x,
      y: selectedDrone.position.y,
      z: selectedDrone.position.z
    });
  } else {
    // Lấy key cuối cùng và +1
    const lastKey = arr[arr.length - 1];
    const nextTime = lastKey.time + 1;

    arr.push({
      time: nextTime,
      x: selectedDrone.position.x,
      y: selectedDrone.position.y,
      z: selectedDrone.position.z
    });
  }

  // Sort để đảm bảo timeline đúng thứ tự
  arr.sort((a, b) => a.time - b.time);

  renderKeyList();

  // Tắt manualOverride nếu có bật
  selectedDrone.manualOverride = false;
};

btnClearOverride.onclick = () => {
  if (!selectedDrone) return;
  selectedDrone.manualOverride = false;
};
ctxPropertiesBtn.addEventListener("click", () => {
  if (!selectedDrone) return;

  // mở panel Properties
  panelProperties.style.display = "block";

  // load thông tin drone vào UI
  loadDroneProperties();

  // ẩn menu
  contextMenu.style.display = "none";
});
ctxDeleteBtn.addEventListener("click", () => {
  if (!selectedDrone) return;

  // Xóa drone khỏi scene
  scene.remove(selectedDrone.model);

  // Xóa mesh tạm (ko dispose để undo được)
  deletedStack.push({
    drone: selectedDrone,
    index: drones.findIndex(d => d.id === selectedDrone.id)
  });

  drones = drones.filter(d => d.id !== selectedDrone.id);

  // Ẩn highlight
  highlightRing.visible = false;

  // Clear UI
  selectedDrone = null;
  renderDroneList();
  renderKeyList();
  panelProperties.style.display = "none";

  contextMenu.style.display = "none"; // đóng menu
});
// btnProps.onclick = () =>
//   (panelProps.style.display =
//     panelProps.style.display === "block" ? "none" : "block");

btnSet.onclick = () =>
  (panelSettings.style.display =
    panelSettings.style.display === "block" ? "none" : "block");

// btnTime.onclick = () =>
//   (panelTimeline.style.display =
//     panelTimeline.style.display === "block" ? "none" : "block");
btnDeleteDrone.onclick = () => {
  if (!selectedDrone) return alert("Chưa chọn drone!");

  // tìm index hiện tại trong mảng drones
  const idx = drones.findIndex(d => d.id === selectedDrone.id);

  // remove mesh khỏi scene nhưng KHÔNG dispose -> để có thể khôi phục
  if (selectedDrone.model) {
    scene.remove(selectedDrone.model);
  }

  // ẩn highlight
  if (highlightRing) highlightRing.visible = false;

  // push vào stack để undo được (lưu cả index cũ)
  deletedStack.push({ drone: selectedDrone, index: idx });

  // giữ giới hạn stack
  if (deletedStack.length > DELETED_STACK_LIMIT) deletedStack.shift();

  // xóa khỏi mảng drones
  if (idx !== -1) drones.splice(idx, 1);

  // clear selection + UI
  selectedDrone = null;
  panelProperties.style.display = "none";
  keyList.innerHTML = "";
  keyEdit.style.display = "none";
  renderDroneList();

  // tuỳ chọn: thông báo nhỏ
  // alert("Đã xóa tạm drone — nhấn Ctrl+Z để khôi phục");
};

// ------------------------------------------------------------
// PROPERTIES EDITOR
// ------------------------------------------------------------
const colorInput = document.getElementById("droneColor");
const sizeInput = document.getElementById("droneSize");

function loadDroneProperties() {
  if (!selectedDrone) return;

  // color + size
  colorInput.value = "#" + selectedDrone.model.material.color.getHexString();
  sizeInput.value = selectedDrone.model.scale.x;

  // sự kiện đổi màu & size
  colorInput.oninput = () => selectedDrone.model.material.color.set(colorInput.value);
  sizeInput.oninput = () =>
    selectedDrone.model.scale.set(sizeInput.value, sizeInput.value, sizeInput.value);

  // --- TỌA ĐỘ ---
  xInput.value = selectedDrone.position.x.toFixed(2);
  yInput.value = selectedDrone.position.y.toFixed(2);
  zInput.value = selectedDrone.position.z.toFixed(2);

  xInput.oninput = () => {
  if (!selectedDrone) return;
    const v = parseFloat(xInput.value) || 0;
    selectedDrone.position.x = v;
    if (selectedDrone.model) selectedDrone.model.position.x = v;
    if (highlightRing && highlightRing.visible) highlightRing.position.x = v;

    // bật override để timeline không ghi đè
    selectedDrone.manualOverride = true;
  };

  yInput.oninput = () => {
    if (!selectedDrone) return;
    const v = parseFloat(yInput.value) || 0;
    selectedDrone.position.y = v;
    if (selectedDrone.model) selectedDrone.model.position.y = v;
    if (highlightRing && highlightRing.visible) highlightRing.position.z = v;

    selectedDrone.manualOverride = true;
  };

  zInput.oninput = () => {
    if (!selectedDrone) return;
    const v = parseFloat(zInput.value) || 0;
    selectedDrone.position.z = v;
    if (selectedDrone.model) selectedDrone.model.position.z = v;
    if (highlightRing && highlightRing.visible) highlightRing.position.z = v;

    selectedDrone.manualOverride = true;
  };
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
// ẩn khi click trái anywhere (document)
document.addEventListener("click", (e) => {
  // nếu click vào context menu button thì không ẩn ngay (handled by button)
  if (!contextMenu.contains(e.target)) {
    contextMenu.style.display = "none";
  }
});

// ẩn bằng ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") contextMenu.style.display = "none";
});

// ẩn khi resize hoặc scroll
window.addEventListener("resize", () => { contextMenu.style.display = "none"; });
window.addEventListener("scroll", () => { contextMenu.style.display = "none"; });


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
  drones.forEach((d) => {
    if (d.manualOverride) {
      // chỉ cập nhật mesh từ vị trí hiện tại (teleported)
      d.update();
    } else {
      d.applyTimeline(globalTimeline.currentTime);
    }
  });

  // 🔥 Cập nhật highlight ring theo drone đã chọn
  if (selectedDrone) {
  // update ring như hiện tại
    highlightRing.visible = true;
    highlightRing.position.set(
      selectedDrone.position.x,
      0.02,
      selectedDrone.position.z
    );

    // chỉ cập nhật input khi người dùng không nhập (document.activeElement)
    if (document.activeElement !== xInput) xInput.value = selectedDrone.position.x.toFixed(2);
    if (document.activeElement !== yInput) yInput.value = selectedDrone.position.y.toFixed(2);
    if (document.activeElement !== zInput) zInput.value = selectedDrone.position.z.toFixed(2);
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
// Undo Ctrl+Z / Cmd+Z
window.addEventListener("keydown", (e) => {
  const isUndo = (e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z");
  if (!isUndo) return;

  if (deletedStack.length === 0) {
    // optional: thông báo nhỏ
    // console.log("Nothing to undo");
    return;
  }

  const item = deletedStack.pop();
  const drone = item.drone;
  const index = typeof item.index === "number" ? item.index : drones.length;

  // add mesh back to scene
  if (drone && drone.model) {
    scene.add(drone.model);
    // gán lại userData
    drone.model.userData = drone.model.userData || {};
    drone.model.userData.drone = drone;
  }

  // chèn lại vào mảng drones tại vị trí cũ nếu hợp lệ, else push cuối
  const insertAt = Math.min(Math.max(0, index), drones.length);
  drones.splice(insertAt, 0, drone);

  // chọn drone vừa khôi phục
  selectedDrone = drone;

  // highlight & update UI
  // lưu màu gốc nếu chưa có
  if (!selectedDrone.originalColor) selectedDrone.originalColor = selectedDrone.model.material.color.getHex();
  selectedDrone.model.material.color.set(0xffff33); // highlight màu vàng
  if (highlightRing) {
    highlightRing.visible = true;
    highlightRing.position.set(selectedDrone.position.x, 0.02, selectedDrone.position.z);
  }

  loadDroneProperties();
  renderKeyList();
  renderDroneList();

  // optional feedback
  // console.log("Đã khôi phục 1 drone");
});

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

