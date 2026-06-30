import * as THREE from 'three';
// 1. Swap to TrackballControls for unrestricted 3D tumbling
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const aspect = window.innerWidth / window.innerHeight;
const perspCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
const frustumSize = 25;
const orthoCamera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 0.1, 1000);

let activeCamera = perspCamera;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.localClippingEnabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(10, 20, 10);
scene.add(ambientLight, dirLight);

// 2. Initialize Trackball Controls
const controls = new TrackballControls(activeCamera, renderer.domElement);
controls.rotateSpeed = 4.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
// This ensures continuous smooth movement without getting "stuck"
controls.noRoll = false; 

// Containers
const atomGroup = new THREE.Group();
const cellGroup = new THREE.Group();
const bondGroup = new THREE.Group();
const customAxes = new THREE.Group();
const clippingHelpers = new THREE.Group();
scene.add(atomGroup, cellGroup, bondGroup, customAxes, clippingHelpers);

// Clipping Planes 
const clipX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
const clipY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const clipZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const clipPlanes = [clipX, clipY, clipZ];

let helperX, helperY, helperZ;

function makeTextSprite(message, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = "Bold 36px Arial";
    ctx.fillStyle = color;
    ctx.fillText(message, 10, 40);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sprite.scale.set(3, 1.5, 1);
    return sprite;
}

// Inject UI with Checkboxes for Clipping Planes
const uiPanel = document.getElementById('ui-panel');
uiPanel.style.maxHeight = '90vh';
uiPanel.style.overflowY = 'auto';
const advDiv = document.createElement('div');
advDiv.innerHTML = `
    <hr style="border:0; border-top:1px solid #444; margin: 10px 0;">
    <div style="font-size: 12px; display: grid; gap: 5px;">
        <label><b>Material:</b> 
            <select id="matSelect" style="background:#333; color:white; border:1px solid #555; padding:2px; width:100%;">
                <option value="alumina">α-Alumina</option>
                <option value="zirconia_m">Monoclinic ZrO2</option>
                <option value="zirconia_t">Tetragonal ZrO2</option>
                <option value="zirconia_c">Cubic ZrO2</option>
            </select>
        </label>
        <label><b>Background:</b> <input type="color" id="bgColor" value="#222222"></label>
        <label><b>Camera:</b> 
            <select id="camType" style="background:#333; color:white; border:none;">
                <option value="persp">Perspective</option>
                <option value="ortho">Orthographic</option>
            </select>
        </label>
        <label><b>Lighting:</b> <input type="range" id="lightInt" min="0" max="2" step="0.1" value="1"></label>
        <label><b>Atom Opacity:</b> <input type="range" id="atomOpac" min="0" max="1" step="0.1" value="1"></label>
        <label><b>Bond Opacity:</b> <input type="range" id="bondOpac" min="0" max="1" step="0.1" value="0.6"></label>
    </div>
    <div style="font-size: 12px; margin-top: 10px;">
        <b>Clipping Planes:</b> (Check to show surface)<br>
        <div style="display:flex; align-items:center; margin-top:2px;">
            <input type="checkbox" id="showClipX"> <span style="width:15px">X:</span> <input type="range" id="sliderX" style="width:100%">
        </div>
        <div style="display:flex; align-items:center; margin-top:2px;">
            <input type="checkbox" id="showClipY"> <span style="width:15px">Y:</span> <input type="range" id="sliderY" style="width:100%">
        </div>
        <div style="display:flex; align-items:center; margin-top:2px;">
            <input type="checkbox" id="showClipZ"> <span style="width:15px">Z:</span> <input type="range" id="sliderZ" style="width:100%">
        </div>
    </div>
    <hr style="border:0; border-top:1px solid #444; margin: 10px 0;">
    <div style="font-size: 12px; line-height: 1.4;">
        <b>Crystal Info:</b><br>
        System: <span id="meta-cs" style="text-transform: capitalize;">...</span><br>
        Space Group: <span id="meta-sg">...</span><br>
        <b>Lattice Params (Å, °):</b><br>
        <span id="meta-lat">...</span><br>
        <b>Atoms:</b><br>
        <div id="atom-legend"></div>
    </div>
`;
uiPanel.appendChild(advDiv);

const atomMaterials = [];
const bondMaterials = [];

function clearScene() {
    atomGroup.clear();
    cellGroup.clear();
    bondGroup.clear();
    customAxes.clear();
    clippingHelpers.clear();
    atomMaterials.length = 0;
    bondMaterials.length = 0;
}

async function loadCrystal(material) {
    clearScene();
    const response = await fetch(`http://127.0.0.1:8000/crystal/${material}`);
    const data = await response.json();
    const m = data.lattice_matrix;

    const p0 = new THREE.Vector3(0, 0, 0);
    const pA = new THREE.Vector3(...m[0]);
    const pB = new THREE.Vector3(...m[1]);
    const pC = new THREE.Vector3(...m[2]);

    const a = pA.length(); const b = pB.length(); const c = pC.length();
    const alpha = pB.angleTo(pC) * (180/Math.PI);
    const beta = pA.angleTo(pC) * (180/Math.PI);
    const gamma = pA.angleTo(pB) * (180/Math.PI);

    document.getElementById('meta-cs').innerText = data.crystal_system;
    document.getElementById('meta-sg').innerText = data.space_group;
    document.getElementById('meta-lat').innerText = `a=${a.toFixed(2)}, b=${b.toFixed(2)}, c=${c.toFixed(2)}\nα=${alpha.toFixed(1)}, β=${beta.toFixed(1)}, γ=${gamma.toFixed(1)}`;

    const atomPositions = [];
    const speciesSet = new Set();

    data.atoms.forEach(atom => {
        speciesSet.add(atom.species);
        let color = atom.species === 'Al' ? 0xff4444 : atom.species === 'O' ? 0x4444ff : 0xaaaaaa;
        if (atom.species === 'Zr') color = 0x44ff44;
        
        const mat = new THREE.MeshStandardMaterial({ 
            color: color, roughness: 0.2, metalness: 0.1,
            clippingPlanes: clipPlanes, transparent: true, opacity: document.getElementById('atomOpac').value
        });
        atomMaterials.push(mat);
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 32), mat);
        const pos = new THREE.Vector3(atom.position[0], atom.position[1], atom.position[2]);
        sphere.position.copy(pos);
        atomGroup.add(sphere);
        atomPositions.push(pos);
    });

    let legendHtml = '';
    speciesSet.forEach(sp => {
        let hex = sp === 'Al' ? '#ff4444' : sp === 'O' ? '#4444ff' : sp === 'Zr' ? '#44ff44' : '#aaaaaa';
        legendHtml += `<span style="color:${hex}">■</span> ${sp} (Radius: 0.35Å)<br>`;
    });
    document.getElementById('atom-legend').innerHTML = legendHtml;

    // Unit Cell
    const pAB = new THREE.Vector3().addVectors(pA, pB);
    const pAC = new THREE.Vector3().addVectors(pA, pC);
    const pBC = new THREE.Vector3().addVectors(pB, pC);
    const pABC = new THREE.Vector3().addVectors(pAB, pC);
    const pts = [p0, pA, pB, pC, pAB, pAC, pBC, pABC];
    const lines = [0,1, 0,2, 0,3, 1,4, 1,5, 2,4, 2,6, 3,5, 3,6, 4,7, 5,7, 6,7];
    const geom = new THREE.BufferGeometry().setFromPoints(lines.map(i => pts[i]));
    cellGroup.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: 0xffffff })));

    // Labeled Axes
    const axA = new THREE.ArrowHelper(pA.clone().normalize(), p0, pA.length() + 1, 0xff4444);
    const lblA = makeTextSprite("a1", "#ff4444"); lblA.position.copy(pA).multiplyScalar(1.2); 
    customAxes.add(axA, lblA);
    
    const axB = new THREE.ArrowHelper(pB.clone().normalize(), p0, pB.length() + 1, 0x44ff44);
    const lblB = makeTextSprite("a2", "#44ff44"); lblB.position.copy(pB).multiplyScalar(1.2); 
    customAxes.add(axB, lblB);
    
    const axC = new THREE.ArrowHelper(pC.clone().normalize(), p0, pC.length() + 1, 0x4444ff);
    const lblC = makeTextSprite("c", "#4444ff"); lblC.position.copy(pC).multiplyScalar(1.2); 
    customAxes.add(axC, lblC);
    
    if (data.crystal_system === 'trigonal' || data.crystal_system === 'hexagonal') {
        const pA3 = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(-1);
        const axA3 = new THREE.ArrowHelper(pA3.clone().normalize(), p0, pA3.length() + 1, 0xffff44);
        const lblA3 = makeTextSprite("a3", "#ffff44"); lblA3.position.copy(pA3).multiplyScalar(1.2); 
        customAxes.add(axA3, lblA3);
    }

    // Bonds
    for (let i = 0; i < atomPositions.length; i++) {
        for (let j = i + 1; j < atomPositions.length; j++) {
            if (atomPositions[i].distanceTo(atomPositions[j]) < 2.5) {
                const bMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: document.getElementById('bondOpac').value, clippingPlanes: clipPlanes });
                bondMaterials.push(bMat);
                const bGeom = new THREE.BufferGeometry().setFromPoints([atomPositions[i], atomPositions[j]]);
                bondGroup.add(new THREE.Line(bGeom, bMat));
            }
        }
    }

    // Bounding Box & Slicing Planes
    const box = new THREE.Box3().setFromObject(cellGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    helperX = new THREE.Mesh(new THREE.PlaneGeometry(size.z, size.y), new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    helperY = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.z), new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    helperZ = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), new THREE.MeshBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    helperX.rotation.y = Math.PI / 2; helperY.rotation.x = Math.PI / 2;
    
    helperX.position.set(0, center.y, center.z);
    helperY.position.set(center.x, 0, center.z);
    helperZ.position.set(center.x, center.y, 0);
    clippingHelpers.add(helperX, helperY, helperZ);
    
    clippingHelpers.visible = true;
    helperX.visible = false;
    helperY.visible = false;
    helperZ.visible = false;
    document.getElementById('showClipX').checked = false;
    document.getElementById('showClipY').checked = false;
    document.getElementById('showClipZ').checked = false;

    const initSlider = (id, plane, helper, min, max) => {
        const sl = document.getElementById(id);
        sl.min = min; sl.max = max; sl.step = (max-min)/100; sl.value = max;
        plane.constant = max;
        helper.position[id.slice(-1).toLowerCase()] = max;
    };
    initSlider('sliderX', clipX, helperX, box.min.x, box.max.x);
    initSlider('sliderY', clipY, helperY, box.min.y, box.max.y);
    initSlider('sliderZ', clipZ, helperZ, box.min.z, box.max.z);

    controls.target.copy(center);
    perspCamera.position.set(center.x + 15, center.y + 10, center.z + 15);
    orthoCamera.position.set(center.x + 15, center.y + 10, center.z + 15);
}

// Global UI Event Listeners
document.getElementById('matSelect').addEventListener('change', (e) => loadCrystal(e.target.value));
document.getElementById('showBonds').addEventListener('change', (e) => bondGroup.visible = e.target.checked);
document.getElementById('showUnitCell').addEventListener('change', (e) => cellGroup.visible = e.target.checked);
document.getElementById('showAxes').addEventListener('change', (e) => customAxes.visible = e.target.checked);
document.getElementById('bgColor').addEventListener('input', (e) => scene.background = new THREE.Color(e.target.value));
document.getElementById('lightInt').addEventListener('input', (e) => dirLight.intensity = parseFloat(e.target.value));
document.getElementById('atomOpac').addEventListener('input', (e) => atomMaterials.forEach(m => m.opacity = parseFloat(e.target.value)));
document.getElementById('bondOpac').addEventListener('input', (e) => bondMaterials.forEach(m => m.opacity = parseFloat(e.target.value)));

document.getElementById('showClipX').addEventListener('change', (e) => helperX.visible = e.target.checked);
document.getElementById('showClipY').addEventListener('change', (e) => helperY.visible = e.target.checked);
document.getElementById('showClipZ').addEventListener('change', (e) => helperZ.visible = e.target.checked);

document.getElementById('camType').addEventListener('change', (e) => {
    if (e.target.value === 'ortho') { orthoCamera.position.copy(perspCamera.position); activeCamera = orthoCamera; } 
    else { perspCamera.position.copy(orthoCamera.position); activeCamera = perspCamera; }
    controls.object = activeCamera; controls.update();
});

const updateClipping = (axis, plane, helper) => {
    const val = parseFloat(document.getElementById(`slider${axis}`).value);
    plane.constant = val;
    helper.position[axis.toLowerCase()] = val;
    
    if (!document.getElementById(`showClip${axis}`).checked) {
        document.getElementById(`showClip${axis}`).checked = true;
        helper.visible = true;
    }
};

document.getElementById('sliderX').addEventListener('input', () => updateClipping('X', clipX, helperX));
document.getElementById('sliderY').addEventListener('input', () => updateClipping('Y', clipY, helperY));
document.getElementById('sliderZ').addEventListener('input', () => updateClipping('Z', clipZ, helperZ));

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    perspCamera.aspect = aspect; perspCamera.updateProjectionMatrix();
    orthoCamera.left = -frustumSize * aspect / 2; orthoCamera.right = frustumSize * aspect / 2;
    orthoCamera.top = frustumSize / 2; orthoCamera.bottom = -frustumSize / 2; orthoCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // 3. Inform TrackballControls of the resize so it maintains proper panning ratios
    controls.handleResize();
});

loadCrystal('alumina');
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, activeCamera); }
animate();