document.addEventListener("DOMContentLoaded", function () {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // Light grey background like image

    // --- CAMERA: Inclined view ---
    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 7, 12);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Light Setup
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // --- TANK DIMENSIONS ---
    const TANK_HEIGHT_CM = 28;
    const SCALE = 0.22;
    const RADIUS = 1.4;
    const THREE_HEIGHT = TANK_HEIGHT_CM * SCALE;

    // --- 1. TANK BODY (Made more visible) ---
    const tankGeo = new THREE.CylinderGeometry(RADIUS, RADIUS, THREE_HEIGHT, 64, 1, true);
    const tankMat = new THREE.MeshPhysicalMaterial({
        color: 0xccddee,
        transparent: true,
        opacity: 0.4,       // Increased opacity so it's not invisible
        transmission: 0.2,
        thickness: 0.5,
        roughness: 0.2,
        side: THREE.DoubleSide
    });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.y = THREE_HEIGHT / 2;
    scene.add(tank);

    // --- 2. GREY BASE ---
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(RADIUS + 0.05, RADIUS + 0.05, 0.2, 64),
        new THREE.MeshStandardMaterial({ color: 0x777777 })
    );
    base.position.y = -0.1;
    scene.add(base);

    // --- 3. PIPES (Referencing Image 1) ---
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const pipeGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 32);

    // Inlet Pipe (Top Left)
    const inlet = new THREE.Mesh(pipeGeo, pipeMat);
    inlet.rotation.z = Math.PI / 2;
    inlet.position.set(-RADIUS - 0.8, THREE_HEIGHT * 0.9, 0);
    scene.add(inlet);

    // Outlet Pipe (Bottom Right)
    const outlet = new THREE.Mesh(pipeGeo, pipeMat);
    outlet.rotation.z = Math.PI / 2;
    outlet.position.set(RADIUS + 0.2, THREE_HEIGHT * 0.02, 0);
    scene.add(outlet);

    // --- 4. LONG SCALE LINES (RIGHT SIDE) ---
    const labelContainer = document.getElementById('labels');
    for (let i = 1; i <= 10; i++) {
        const yPos = (i * 2.8) * SCALE;

        // Long Horizontal Line
        const lineGeo = new THREE.BoxGeometry(0.7, 0.04, 0.02); // Wider line
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const line = new THREE.Mesh(lineGeo, lineMat);

        // Positioned so it touches the tank and extends outward
        line.position.set(RADIUS + 0.4, yPos, 0);
        scene.add(line);

        // Percentage Text
        const div = document.createElement('div');
        div.className = 'scale-mark';
        div.style.position = 'absolute';
        div.style.fontWeight = 'bold';
        div.style.fontSize = '16px';
        div.innerText = `${i * 10}%`;
        labelContainer.appendChild(div);
        line.userData.label = div;
    }

    // --- 5. WATER ---
    const water = new THREE.Mesh(
        new THREE.CylinderGeometry(RADIUS * 0.98, RADIUS * 0.98, 1, 64),
        new THREE.MeshPhongMaterial({
            color: 0x1c92d2, transparent: true, opacity: 0.75, shininess: 100
        })
    );
    scene.add(water);

    function updateWater(heightCm) {
        const visualHeight = Math.max(0.01, heightCm * SCALE);
        water.scale.y = visualHeight;
        water.position.y = visualHeight / 2;

        document.getElementById("levelText").innerText = heightCm.toFixed(1) + " cm";
        document.getElementById("percentText").innerText = ((heightCm / 28) * 100).toFixed(0) + "%";
    }

    // --- ANIMATION LOOP ---
    function animate() {
        requestAnimationFrame(animate);

        // Match HTML labels to 3D lines
        scene.children.forEach(c => {
            if (c.userData.label) {
                const vector = new THREE.Vector3();
                c.getWorldPosition(vector);
                vector.project(camera);
                const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
                c.userData.label.style.left = (x + 25) + 'px'; // Offset to right of line
                c.userData.label.style.top = y + 'px';
            }
        });

        renderer.render(scene, camera);
    }
    animate();

    // Data Polling
    setInterval(async () => {
        try {
            const res = await fetch('http://localhost:3000/data');
            const data = await res.json();
            updateWater(data.height);
        } catch (e) { }
    }, 500);

    // Setpoint Event
    document.getElementById("sendSetPoint").addEventListener("click", async () => {
        const sp = document.getElementById("setPointInput").value;
        try {
            await fetch('http://localhost:3000/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setpoint: parseFloat(sp) })
            });
        } catch (e) { }
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});