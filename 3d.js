import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5f5);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(7, 10, 15);
camera.lookAt(0, 3, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(5, 10, 5);
scene.add(sun);

// --- 13cm CALIBRATION ---
const TANK_MAX = 13;
const V_SCALE = 0.5;      // Height multiplier for 3D view
const RADIUS = 1.5;
const HEIGHT_3D = TANK_MAX * V_SCALE;

// The Glass Tank
const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT_3D, 64, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, roughness: 0 })
);
tank.position.y = HEIGHT_3D / 2;
scene.add(tank);

// Ruler Scale Marks
const labelDiv = document.getElementById('labels');
for (let i = 0; i <= TANK_MAX; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.05), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    line.position.set(RADIUS + 0.2, i * V_SCALE, 0);
    scene.add(line);
    const div = document.createElement('div');
    div.className = 'scale-mark';
    div.innerText = i + " cm";
    labelDiv.appendChild(div);
    line.userData.div = div;
}

// The Water
const water = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIUS * 0.99, RADIUS * 0.99, 1, 64),
    new THREE.MeshPhongMaterial({ color: 0x03a9f4, transparent: true, opacity: 0.7 })
);
water.scale.y = 0.001;
scene.add(water);

function animate() {
    requestAnimationFrame(animate);
    scene.children.forEach(c => {
        if (c.userData.div) {
            const v = new THREE.Vector3();
            c.getWorldPosition(v);
            v.project(camera);
            c.userData.div.style.left = (v.x * 0.5 + 0.5) * window.innerWidth + 15 + "px";
            c.userData.div.style.top = (v.y * -0.5 + 0.5) * window.innerHeight + "px";
        }
    });
    renderer.render(scene, camera);
}
animate();

// Sync with Server every 500ms
setInterval(async () => {
    try {
        const res = await fetch('/data');
        const data = await res.json();
        const level = Math.max(0.001, data.height * V_SCALE);

        water.scale.y = level;
        water.position.y = level / 2;

        document.getElementById("levelText").innerText = data.height.toFixed(1) + " cm";
        document.getElementById("percentText").innerText = ((data.height / TANK_MAX) * 100).toFixed(0) + "%";
    } catch (e) { }
}, 500);

document.getElementById("sendSetPoint").addEventListener("click", () => {
    const val = document.getElementById("setPointInput").value;
    fetch('/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setpoint: val })
    });
});