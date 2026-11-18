import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.backgroundColor = "#222222";

const oldUi = document.getElementById('ui-panel');
if (oldUi) oldUi.style.display = 'none';

const topBar = document.createElement('div');
topBar.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 50px;
    background-color: #181818; border-bottom: 2px solid #444;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; box-sizing: border-box; z-index: 2000;
    color: white; font-family: sans-serif;
`;
topBar.innerHTML = `
    <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px; color: #44aaff;">
        CRYSTALLOGRAPHY VIEWER
    </div>
    <div style="display: flex; gap: 15px; align-items: center;">
        <label style="font-size: 14px; font-weight: bold;">Workspace Mode:</label>
        <select id="workspaceMode" style="background:#333; color:white; border:1px solid #666; padding:6px; border-radius:4px; outline:none; cursor:pointer;">
            <option value="single">Single Crystal View</option>
            <option value="dual">Dual Split-Screen</option>
            <option value="interface">Interface Builder</option>
        </select>
    </div>
`;
document.body.appendChild(topBar);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '50px';
renderer.domElement.style.left = '0px';
renderer.localClippingEnabled = true;
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);

const frustumSize = 25;

const splitDivider = document.createElement('div');
splitDivider.style.cssText = `
    position: absolute; left: 50%; top: 50px; width: 4px; height: calc(100vh - 50px);
    background-color: #666; border-left: 1px solid #222; border-right: 1px solid #222;
    z-index: 1500; display: none; transform: translateX(-50%);
`;
document.body.appendChild(splitDivider);

// --- CLICKABLE & AUTO-RETRACTING PANEL CONTROLLER ---
function makeRetractable(panelWrapper, contentPanel, side) {
    const isLeft = side === 'left';
    const isBottom = side === 'bottom';

    panelWrapper.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)';

    const hiddenTransform = isBottom
        ? 'translate(-50%, 100%)'
        : (isLeft ? 'translateX(-100%)' : 'translateX(100%)');
    const visibleTransform = isBottom ? 'translate(-50%, 0%)' : 'translateX(0%)';

    const tab = document.createElement('button');
    tab.type = 'button';
    if (isBottom) {
        tab.style.cssText = `
            position: absolute; top: -32px; left: 50%; transform: translateX(-50%);
            background: #18222c; border: 2px solid #4a6b8c; border-bottom: none;
            padding: 5px 20px; border-radius: 8px 8px 0 0; color: #66ccff;
            cursor: pointer; font-size: 13px; font-weight: bold; z-index: 2200;
            pointer-events: auto; outline: none; box-shadow: 0 -4px 10px rgba(0,0,0,0.5);
        `;
    } else {
        tab.style.cssText = `
            position: absolute; top: 20px; ${isLeft ? 'right: -32px;' : 'left: -32px;'}
            background: #222; border: 1px solid #666;
            ${isLeft ? 'border-left: none;' : 'border-right: none;'}
            width: 32px; height: 48px; text-align: center;
            cursor: pointer; color: #44aaff; font-size: 16px; font-weight: bold;
            border-radius: ${isLeft ? '0 8px 8px 0' : '8px 0 0 8px'};
            z-index: 2200; pointer-events: auto; outline: none;
            box-shadow: 2px 2px 10px rgba(0,0,0,0.5);
        `;
    }
    panelWrapper.appendChild(tab);

    let isOpen = true;
    let timeoutId = null;

    const updateTabLabel = () => {
        if (isBottom) {
            tab.innerText = isOpen ? '▼ Hide Epitaxy Matcher ▼' : '▲ Open Epitaxy Matcher ▲';
        } else {
            tab.innerText = isOpen ? (isLeft ? '◀' : '▶') : (isLeft ? '▶' : '◀');
        }
    };

    const show = () => {
        clearTimeout(timeoutId);
        isOpen = true;
        panelWrapper.style.transform = visibleTransform;
        contentPanel.style.opacity = '1';
        contentPanel.style.pointerEvents = 'auto';
        updateTabLabel();
    };

    const immediateHide = () => {
        clearTimeout(timeoutId);
        isOpen = false;
        panelWrapper.style.transform = hiddenTransform;
        contentPanel.style.opacity = '0.3';
        contentPanel.style.pointerEvents = 'none';
        updateTabLabel();
    };

    const startAutoHideTimer = () => {
        clearTimeout(timeoutId);
        if (!isOpen) return;
        timeoutId = setTimeout(() => {
            immediateHide();
        }, 5000);
    };

    tab.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen) {
            immediateHide();
        } else {
            show();
            startAutoHideTimer();
        }
    });

    contentPanel.addEventListener('mouseenter', () => clearTimeout(timeoutId));
    contentPanel.addEventListener('input', () => clearTimeout(timeoutId));
    contentPanel.addEventListener('mouseleave', () => {
        if (isOpen) startAutoHideTimer();
    });

    show();
    startAutoHideTimer();
    return { show, immediateHide };
}

// --- EPITAXY BUILDER UI PANEL ---
const epitaxyWrapper = document.createElement('div');
epitaxyWrapper.style.cssText = `
    position: absolute; bottom: 0px; left: 50%; z-index: 2100; display: none;
`;
const epitaxyPanel = document.createElement('div');
epitaxyPanel.style.cssText = `
    width: 650px; background: rgba(20, 25, 30, 0.96); border: 2px solid #4a6b8c; border-bottom: none;
    color: white; font-family: sans-serif; padding: 14px; border-radius: 8px 8px 0 0;
    box-shadow: 0px -10px 30px rgba(0,0,0,0.8); transition: opacity 0.3s ease;
`;
epitaxyPanel.innerHTML = `
    <h3 style="margin:0 0 8px 0; color:#66ccff; text-align:center; border-bottom:1px solid #444; padding-bottom:5px; font-size:15px;">
        Epitaxy & Interface Matcher (2D Vectorial & Twist-Reactive)
    </h3>
    
    <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:8px;">
        <div style="background:#222; padding:8px; border-radius:5px; flex:1; border:1px solid #555;">
            <b style="color:#ffcc66; font-size:12px;">Primary Crystal Plane (h k l)</b>
            <div style="display:flex; gap:5px; margin-top:5px; align-items:center;">
                h:<input type="number" id="ep1_h" value="0" style="width:38px; background:#444; color:white; border:none; text-align:center;">
                k:<input type="number" id="ep1_k" value="0" style="width:38px; background:#444; color:white; border:none; text-align:center;">
                l:<input type="number" id="ep1_l" value="1" style="width:38px; background:#444; color:white; border:none; text-align:center;">
            </div>
            <div style="margin-top:4px; font-size:11px; color:#aaa;" id="ep1_d">Unit d-spacing: -- Å</div>
        </div>
        
        <div style="background:#222; padding:8px; border-radius:5px; flex:1; border:1px solid #555;">
            <b style="color:#66ccff; font-size:12px;">Secondary Crystal Plane (h k l)</b>
            <div style="display:flex; gap:5px; margin-top:5px; align-items:center;">
                h:<input type="number" id="ep2_h" value="1" style="width:38px; background:#444; color:white; border:none; text-align:center;">
                k:<input type="number" id="ep2_k" value="1" style="width:38px; background:#444; color:white; border:none; text-align:center;">
                l:<input type="number" id="ep2_l" value="0" style="width:38px; background:#444; color:white; border:none; text-align:center;">
            </div>
            <div style="margin-top:4px; font-size:11px; color:#aaa;" id="ep2_d">Unit d-spacing: -- Å</div>
        </div>
    </div>

    <div style="background:#111; border:1px solid #333; padding:8px; text-align:center; border-radius:5px; margin-bottom:8px;">
        <div style="display:flex; justify-content:center; align-items:center; gap:12px; flex-wrap:wrap;">
            <span style="font-size:12px; color:#ccc;" id="epiMatchText">Parametric Mis-fit (F₀): --%</span>
            <span style="color:#444;">|</span>
            <span style="font-size:12px; color:#ffcc66;" id="epiAngleText">Angular Mis-fit (α): 0.0°</span>
            <span style="color:#444;">|</span>
            <span style="font-size:16px; font-weight:bold; color:#00ff00;" id="epiScoreText">Matching Degree: --%</span>
        </div>
        <div style="font-size:11px; color:#888; margin-top:4px;" id="epiSupercellText">Coincidence Supercell: n × d₁ ≈ m × d₂</div>
    </div>

    <div style="display:flex; gap:8px; margin-bottom:8px;">
        <button id="btnCalcMatch" style="flex:1; padding:7px; background:#4a6b8c; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">1. Calculate Match</button>
        <button id="btnDockCrystal" style="flex:1; padding:7px; background:#bba53d; color:black; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">2. Dock Face-to-Face</button>
        <button id="btnAutoTwist" style="flex:1; padding:7px; background:#2e8b57; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;" title="Automatically rotate Twist φ to find lowest interfacial energy">3. Auto-Optimize Twist (φ)</button>
    </div>

    <div style="border-top:1px solid #444; padding-top:8px; font-size:12px; text-align:center;">
        <div style="display:flex; justify-content:center; gap:15px; padding:4px; background:#222; border-radius:4px; border:1px solid #555; margin-bottom:8px;">
            <span style="color:#ddd;">Mouse Mode:</span>
            <label style="cursor:pointer; font-weight:bold; color:#aaa;"><input type="radio" name="dragAction" value="camera" checked> Orbit Camera</label>
            <label style="cursor:pointer; font-weight:bold; color:#ffcc66;"><input type="radio" name="dragAction" value="primary"> Spin Primary</label>
            <label style="cursor:pointer; font-weight:bold; color:#66ccff;"><input type="radio" name="dragAction" value="secondary"> Spin Secondary</label>
        </div>
    </div>

    <div style="font-size:12px; display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
        <div style="display:flex; align-items:center;">
            <span style="width:75px;">Slide X:</span> <input type="range" id="epiTransX" min="-15" max="15" step="0.1" value="0" style="width:100%">
        </div>
        <div style="display:flex; align-items:center;">
            <span style="width:75px;">Slide Y:</span> <input type="range" id="epiTransY" min="-15" max="15" step="0.1" value="0" style="width:100%">
        </div>
        <div style="display:flex; align-items:center;">
            <span style="width:75px;">Face Gap:</span> <input type="range" id="epiGap" min="0" max="25" step="0.2" value="4" style="width:100%">
        </div>
        <div style="display:flex; align-items:center;">
            <span style="width:95px;" id="twistLabel" title="Rotate Secondary Crystal in-plane">Twist φ (0°):</span>
            <input type="range" id="epiTwist" min="-180" max="180" step="0.5" value="0" style="width:100%">
        </div>
    </div>
`;
epitaxyWrapper.appendChild(epitaxyPanel);
document.body.appendChild(epitaxyWrapper);
const epitaxyRetractor = makeRetractable(epitaxyWrapper, epitaxyPanel, 'bottom');

const SHARED_SPHERE_GEOM = new THREE.SphereGeometry(1.0, 24, 24);

// --- CPK / JMOL ELEMENT COLOR & NAME DATABASE ---
const ELEMENT_DATA = {
    'H':  { color: '#ffffff', name: 'Hydrogen' },
    'He': { color: '#d9ffff', name: 'Helium' },
    'Li': { color: '#cc80ff', name: 'Lithium' },
    'Be': { color: '#c2ff00', name: 'Beryllium' },
    'B':  { color: '#ffb5b5', name: 'Boron' },
    'C':  { color: '#555555', name: 'Carbon' },
    'N':  { color: '#3050f8', name: 'Nitrogen' },
    'O':  { color: '#ff0d0d', name: 'Oxygen' },
    'F':  { color: '#90e050', name: 'Fluorine' },
    'Na': { color: '#ab5cf2', name: 'Sodium' },
    'Mg': { color: '#8aff00', name: 'Magnesium' },
    'Al': { color: '#bfa6a6', name: 'Aluminum (Alumina)' },
    'Si': { color: '#f0c8a0', name: 'Silicon' },
    'P':  { color: '#ff8000', name: 'Phosphorus' },
    'S':  { color: '#ffff30', name: 'Sulfur' },
    'Cl': { color: '#1ff01f', name: 'Chlorine' },
    'K':  { color: '#8f40d4', name: 'Potassium' },
    'Ca': { color: '#3dff00', name: 'Calcium' },
    'Sc': { color: '#e6e6e6', name: 'Scandium' },
    'Ti': { color: '#bfc2c7', name: 'Titanium' },
    'V':  { color: '#a6a6ab', name: 'Vanadium' },
    'Cr': { color: '#8a99c7', name: 'Chromium' },
    'Mn': { color: '#9c7ac7', name: 'Manganese' },
    'Fe': { color: '#e06633', name: 'Iron' },
    'Co': { color: '#f090a0', name: 'Cobalt' },
    'Ni': { color: '#50d050', name: 'Nickel' },
    'Cu': { color: '#c88033', name: 'Copper' },
    'Zn': { color: '#7d80b0', name: 'Zinc' },
    'Ga': { color: '#c28f8f', name: 'Gallium' },
    'Ge': { color: '#668f8f', name: 'Germanium' },
    'As': { color: '#bd80e3', name: 'Arsenic' },
    'Se': { color: '#ffa100', name: 'Selenium' },
    'Br': { color: '#a62929', name: 'Bromine' },
    'Sr': { color: '#00ff00', name: 'Strontium' },
    'Y':  { color: '#94ffff', name: 'Yttrium' },
    'Zr': { color: '#00c99c', name: 'Zirconium (Zirconia)' },
    'Nb': { color: '#73c2c9', name: 'Niobium' },
    'Mo': { color: '#54b5b5', name: 'Molybdenum' },
    'Ru': { color: '#248f8f', name: 'Ruthenium' },
    'Rh': { color: '#0a7d8c', name: 'Rhodium' },
    'Pd': { color: '#006985', name: 'Palladium' },
    'Ag': { color: '#c0c0c0', name: 'Silver' },
    'Cd': { color: '#ffd98f', name: 'Cadmium' },
    'In': { color: '#a67573', name: 'Indium' },
    'Sn': { color: '#668080', name: 'Tin' },
    'Sb': { color: '#9e63b5', name: 'Antimony' },
    'Te': { color: '#d47a00', name: 'Tellurium' },
    'I':  { color: '#940094', name: 'Iodine' },
    'Cs': { color: '#57178f', name: 'Cesium' },
    'Ba': { color: '#00c900', name: 'Barium' },
    'La': { color: '#70d4ff', name: 'Lanthanum' },
    'Ce': { color: '#ffffc7', name: 'Cerium' },
    'Nd': { color: '#c7ffc7', name: 'Neodymium' },
    'Sm': { color: '#8fffc7', name: 'Samarium' },
    'Eu': { color: '#61ffc7', name: 'Europium' },
    'Gd': { color: '#45ffc7', name: 'Gadolinium' },
    'Hf': { color: '#4dc2ff', name: 'Hafnium' },
    'Ta': { color: '#4da6ff', name: 'Tantalum' },
    'W':  { color: '#2194d6', name: 'Tungsten' },
    'Pt': { color: '#d0d0e0', name: 'Platinum' },
    'Au': { color: '#ffd123', name: 'Gold' },
    'Pb': { color: '#575961', name: 'Lead' },
    'Bi': { color: '#9e4fb5', name: 'Bismuth' },
    'U':  { color: '#008fff', name: 'Uranium' }
};

function getElementInfo(rawSpecies) {
    const cleanSymbol = String(rawSpecies || 'X').replace(/[^a-zA-Z]/g, '') || String(rawSpecies);
    if (ELEMENT_DATA[cleanSymbol]) {
        return { symbol: cleanSymbol, name: ELEMENT_DATA[cleanSymbol].name, color: ELEMENT_DATA[cleanSymbol].color };
    }
    // Deterministic distinct color for any unlisted element symbol
    let hash = 0;
    for (let i = 0; i < cleanSymbol.length; i++) {
        hash = cleanSymbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash * 137) % 360;
    const c = new THREE.Color(`hsl(${hue}, 75%, 60%)`);
    return {
        symbol: cleanSymbol,
        name: `Element ${cleanSymbol}`,
        color: '#' + c.getHexString()
    };
}

function makeAtomLabelSprite(symbol, hexColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'Bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 6;
    ctx.strokeText(symbol, 64, 32);
    ctx.fillStyle = hexColor || '#ffffff';
    ctx.fillText(symbol, 64, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true
    }));
    sprite.scale.set(1.4, 0.7, 1);
    return sprite;
}

function disposeGroup(group) {
    group.traverse(obj => {
        if (obj.geometry && obj.geometry !== SHARED_SPHERE_GEOM) obj.geometry.dispose();
        if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    });
    group.clear();
}

function makeTextSprite(message, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = "Bold 44px Arial";
    ctx.strokeStyle = 'black'; ctx.lineWidth = 4; ctx.strokeText(message, 10, 60);
    ctx.fillStyle = color; ctx.fillText(message, 10, 60);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(4, 2, 1);
    return sprite;
}

class CrystalWorkspace {
    constructor(id, side, defaultMaterial) {
        this.id = id;
        this.side = side;
        this.currentUploadedFile = null;
        this.supercellFactors = { x: 1, y: 1, z: 1 };
        this.unitReciprocalMatrix = [];
        this.speciesRegistry = new Map();
        this.customSpeciesColors = {};

        this.eventZone = document.createElement('div');
        this.eventZone.style.cssText = `
            position: absolute; left: ${side === 'left' ? '0' : '50%'}; top: 50px;
            width: 50%; height: calc(100vh - 50px); z-index: 10;
        `;
        document.body.appendChild(this.eventZone);

        // Always-visible floating HUD Atom Color Annotation bar
        this.hudLegend = document.createElement('div');
        this.hudLegend.style.cssText = `
            position: absolute; ${side}: 16px; top: 58px; z-index: 90;
            background: rgba(20, 24, 30, 0.88); border: 1px solid #4a6b8c;
            border-radius: 6px; padding: 6px 10px; color: #fff;
            font-family: sans-serif; font-size: 12px; display: flex;
            flex-wrap: wrap; align-items: center; gap: 10px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.5); pointer-events: none;
        `;
        document.body.appendChild(this.hudLegend);

        this.uiWrapper = document.createElement('div');
        this.uiWrapper.style.cssText = `
            position: absolute; ${side}: 0; top: 100px; z-index: 100;
            padding: ${side === 'left' ? '0 0 0 15px' : '0 15px 0 0'};
        `;
        document.body.appendChild(this.uiWrapper);

        this.uiPanel = document.createElement('div');
        this.uiPanel.style.cssText = `
            width: 310px; max-height: calc(100vh - 115px); overflow-y: auto;
            background: rgba(30, 30, 30, 0.92); border: 1px solid #444;
            color: white; font-family: sans-serif; padding: 15px;
            border-radius: 8px; box-shadow: 0px 5px 15px rgba(0,0,0,0.5);
            transition: opacity 0.3s ease;
        `;
        this.uiWrapper.appendChild(this.uiPanel);
        this.retractor = makeRetractable(this.uiWrapper, this.uiPanel, side);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        const aspect = (window.innerWidth / 2) / (window.innerHeight - 50);
        this.perspCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.orthoCamera = new THREE.OrthographicCamera(-frustumSize * aspect / 2, frustumSize * aspect / 2, frustumSize / 2, -frustumSize / 2, 0.1, 1000);
        this.activeCamera = this.perspCamera;

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.ambientLight);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.dirLight.position.set(10, 20, 10);
        this.scene.add(this.dirLight);

        this.controls = new TrackballControls(this.activeCamera, this.eventZone);
        this.controls.rotateSpeed = 4.0;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 1.0;

        this.crystalMasterGroup = new THREE.Group();
        this.crystalPivotGroup = new THREE.Group();
        this.crystalMasterGroup.add(this.crystalPivotGroup);
        this.scene.add(this.crystalMasterGroup);

        this.atomGroup = new THREE.Group();
        this.atomLabelGroup = new THREE.Group();
        this.atomLabelGroup.visible = false;
        this.cellGroup = new THREE.Group();
        this.bondGroup = new THREE.Group();
        this.customAxes = new THREE.Group();
        this.millerPlanesGroup = new THREE.Group();
        this.crystalPivotGroup.add(this.atomGroup, this.atomLabelGroup, this.cellGroup, this.bondGroup, this.customAxes, this.millerPlanesGroup);

        this.clipX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), Infinity);
        this.clipY = new THREE.Plane(new THREE.Vector3(0, -1, 0), Infinity);
        this.clipZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), Infinity);
        this.isolatePlane1 = new THREE.Plane(new THREE.Vector3(0, 1, 0), Infinity);
        this.isolatePlane2 = new THREE.Plane(new THREE.Vector3(0, -1, 0), Infinity);

        this.clipPlanes = [this.clipX, this.clipY, this.clipZ, this.isolatePlane1, this.isolatePlane2];

        this.currentReciprocalMatrix = [];
        this.latticeVectors = { a: null, b: null, c: null };
        this.boxBoundingPlanes = Array(6).fill(null).map(() => new THREE.Plane());
        this.atomMaterials = [];
        this.sharedBondMaterial = null;
        this.bFieldArrow = null;
        this.bFieldLabel = null;
        this.generatedPlanes = [];
        this.isolatedPlaneData = null;

        this.buildUI(defaultMaterial);
        this.attachEvents();
        this.loadCrystal();
    }

    getUnitReciprocalVectors() {
        if (this.unitReciprocalMatrix.length === 0) return null;
        return {
            rA: new THREE.Vector3(...this.unitReciprocalMatrix[0]),
            rB: new THREE.Vector3(...this.unitReciprocalMatrix[1]),
            rC: new THREE.Vector3(...this.unitReciprocalMatrix[2])
        };
    }

    buildUI(defaultMaterial) {
        this.uiPanel.innerHTML = `
            <h3 style="margin-top:0; padding-bottom:5px; border-bottom:1px solid #555;">${this.side === 'left' ? 'Primary' : 'Secondary'} Crystal</h3>
            
            <div style="background:#233342; padding:8px; border-radius:5px; margin-bottom:10px; border:1px solid #3c546e;">
                <b style="color:#77c5ff; font-size:12px;">📂 Load Structure (.cif):</b><br>
                <input type="file" id="fileCif_${this.id}" accept=".cif,.str,.txt" style="width:100%; font-size:11px; margin-top:4px; color:#ddd;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                    <span id="fileName_${this.id}" style="font-size:11px; color:#aaa; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">No custom CIF loaded</span>
                    <button id="btnClearCif_${this.id}" style="background:#555; color:#fff; border:none; border-radius:3px; padding:2px 6px; font-size:10px; cursor:pointer;">Reset</button>
                </div>
            </div>

            <div style="background:#1e2923; padding:8px; border-radius:5px; margin-bottom:10px; border:1px solid #3d634d;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <b style="color:#66ffaa; font-size:12px;">🎨 Atom Annotations & Colors:</b>
                    <label style="font-size:11px; color:#ccc; cursor:pointer;" title="Show 3D element symbols directly on atoms">
                        <input type="checkbox" id="showAtomLabels_${this.id}"> 3D Labels
                    </label>
                </div>
                <div id="atomLegendList_${this.id}" style="display:grid; gap:4px; font-size:12px;">
                    <span style="color:#888; font-size:11px;">Loading atomic species...</span>
                </div>
            </div>

            <div style="font-size: 13px; margin-bottom: 10px; display: grid; gap: 6px;">
                <label><input type="checkbox" id="showBonds_${this.id}" checked> Show Bonds</label>
                <label><input type="checkbox" id="showCell_${this.id}" checked> Show Unit Cell</label>
                <label><input type="checkbox" id="showAxes_${this.id}" checked> Show Axes</label>
            </div>

            <div style="background:#3a3a3a; padding:8px; border-radius:4px; border: 1px solid #555; margin-bottom:10px; font-size:12px;">
                <label style="display:block; margin-bottom:6px;"><b>Rendering Mode:</b>
                    <select id="renderMode_${this.id}" style="background:#222; color:white; border:1px solid #555; padding:2px; width:100%; margin-top:2px;">
                        <option value="ball_stick">Ball & Stick</option>
                        <option value="space_fill">Space Filling</option>
                    </select>
                </label>
                <div style="display:grid; gap:5px;">
                    <label><b>Lighting Intensity:</b> <input type="range" id="lightInt_${this.id}" min="0.1" max="3.0" step="0.1" value="1.0" style="width:100%;"></label>
                    <label><b>Atomic Radius (Å):</b> <input type="range" id="atomRadius_${this.id}" min="0.1" max="1.5" step="0.05" value="0.35" style="width:100%;"></label>
                </div>
                <div style="display:flex; gap:5px; margin-top:5px;">
                    <label style="flex:1;"><b>Atom Opacity:</b> <input type="range" id="atomOpac_${this.id}" min="0.1" max="1" step="0.1" value="1" style="width:100%;"></label>
                    <label style="flex:1;"><b>Bond Opacity:</b> <input type="range" id="bondOpac_${this.id}" min="0.1" max="1" step="0.1" value="0.6" style="width:100%;"></label>
                </div>
            </div>

            <div style="font-size: 12px; display: grid; gap: 5px;">
                <label id="presetSelectContainer_${this.id}"><b>Preloaded Database:</b> 
                    <select id="matSelect_${this.id}" style="background:#333; color:white; border:1px solid #555; padding:2px; width:100%;">
                        <option value="alumina" ${defaultMaterial==='alumina'?'selected':''}>α-Alumina</option>
                        <option value="zirconia_m" ${defaultMaterial==='zirconia_m'?'selected':''}>Monoclinic ZrO2</option>
                        <option value="zirconia_t" ${defaultMaterial==='zirconia_t'?'selected':''}>Tetragonal ZrO2</option>
                        <option value="zirconia_c" ${defaultMaterial==='zirconia_c'?'selected':''}>Cubic ZrO2</option>
                    </select>
                </label>
                
                <div style="background:#333; padding:5px; border-radius:4px;">
                    <b>Supercell Size:</b><br>
                    Nx:<input type="number" id="scX_${this.id}" value="1" min="1" max="10" style="width:25px; background:#444; color:white; border:none;">
                    Ny:<input type="number" id="scY_${this.id}" value="1" min="1" max="10" style="width:25px; background:#444; color:white; border:none;">
                    Nz:<input type="number" id="scZ_${this.id}" value="1" min="1" max="10" style="width:25px; background:#444; color:white; border:none;">
                    <button id="btnSupercell_${this.id}" style="width:100%; margin-top:5px; background:#555; color:white; border:none; cursor:pointer;">Regenerate Lattice</button>
                </div>

                <div style="background:#4a3b2c; padding:5px; border-radius:4px; border: 1px solid #665544;">
                    <b style="color:#ffcc66;">Magnetic Orientation Analysis</b><br>
                    <div style="display:flex; gap:2px; margin-top:6px; align-items:center;">
                        <span style="width:65px;">B-Field (Lab):</span>
                        <input type="number" id="bX_${this.id}" value="0" step="1" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                        <input type="number" id="bY_${this.id}" value="0" step="1" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                        <input type="number" id="bZ_${this.id}" value="1" step="1" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                    </div>
                    <div style="display:flex; gap:2px; margin-top:4px; align-items:center;">
                        <select id="targetType_${this.id}" style="width:65px; background:#222; color:white; border:1px solid #555; font-size:10px;">
                            <option value="dir">Dir [uvw]</option>
                            <option value="plane">Norm (hkl)</option>
                        </select>
                        <input type="number" id="tU_${this.id}" value="0" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                        <input type="number" id="tV_${this.id}" value="0" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                        <input type="number" id="tW_${this.id}" value="1" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                    </div>
                    <div style="display:flex; gap:2px; margin-top:4px; align-items:center;">
                        <span style="width:65px;">Pos(Å):</span>
                        <input type="number" id="posX_${this.id}" value="0" step="0.5" style="width:35px; background:#222; color:white; border:none; text-align:center;" ${this.id==='2'?'disabled':''}>
                        <input type="number" id="posY_${this.id}" value="0" step="0.5" style="width:35px; background:#222; color:white; border:none; text-align:center;" ${this.id==='2'?'disabled':''}>
                        <input type="number" id="posZ_${this.id}" value="0" step="0.5" style="width:35px; background:#222; color:white; border:none; text-align:center;" ${this.id==='2'?'disabled':''}>
                    </div>
                    <div style="display:flex; gap:2px; margin-top:4px; align-items:center;">
                        <span style="width:65px;">Rotation(°):</span>
                        <input type="number" id="rotX_${this.id}" value="0" step="5" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                        <input type="number" id="rotY_${this.id}" value="0" step="5" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                        <input type="number" id="rotZ_${this.id}" value="0" step="5" style="width:35px; background:#222; color:white; border:none; text-align:center;">
                    </div>
                    <div style="margin-top:8px; background:#111; padding:6px; border-radius:3px; text-align:center; border: 1px solid #333;">
                        <span style="font-size:15px; font-weight:bold; color:#00ff00;" id="thetaDisplay_${this.id}">θ = 0.0°</span>
                        <span style="color:#555; margin:0 5px;">|</span>
                        <span style="font-size:15px; font-weight:bold; color:#ffffff;" id="sDisplay_${this.id}">S = 1.00</span>
                    </div>
                    <div style="margin-top:3px; height:6px; background:linear-gradient(90deg, #00ff00, #ffff00, #ff0000); width:100%; border-radius:3px; border:1px solid #000;"></div>
                    <label style="margin-top:6px; display:block; cursor:pointer;">
                        <input type="checkbox" id="colorHeatmap_${this.id}"> Color by Alignment Quality
                    </label>
                    <button id="btnAlignB_${this.id}" style="width:100%; margin-top:6px; padding:6px; background:#bba53d; color:black; font-weight:bold; border:none; border-radius:3px; cursor:pointer;">Snap Crystal to B-Field</button>
                </div>

                <div style="background:#2a3b4c; padding:5px; border-radius:4px; margin-top:5px;">
                    <b id="millerTitle_${this.id}" style="color:#66ccff;">Miller Planes (Phase 3):</b><br>
                    <div style="display:flex; gap:4px; margin-top:4px; align-items:center;">
                        <label>h:<input type="number" id="mH_${this.id}" value="1" style="width:25px; background:#444; color:white; border:none; text-align:center;"></label>
                        <label>k:<input type="number" id="mK_${this.id}" value="1" style="width:25px; background:#444; color:white; border:none; text-align:center;"></label>
                        <label id="i-container_${this.id}" style="display:none;">i:<input type="number" id="mI_${this.id}" value="-2" style="width:25px; background:#333; color:#aaa; border:none; text-align:center;" readonly></label>
                        <label>l:<input type="number" id="mL_${this.id}" value="0" style="width:25px; background:#444; color:white; border:none; text-align:center;"></label>
                        <button id="btnAddPlane_${this.id}" style="background:#4a6b8c; color:white; border:none; cursor:pointer; padding:2px 5px; border-radius:3px; flex-grow:1;">Add</button>
                    </div>
                    <div style="display:flex; gap:4px; margin-top:6px; align-items:center; border-top: 1px solid #444; padding-top:6px;">
                        <label>Batch Max Index (±n): <input type="number" id="maxMiller_${this.id}" value="1" min="1" max="3" style="width:30px; background:#444; color:white; border:none; text-align:center;"></label>
                        <button id="btnBatchPlanes_${this.id}" style="background:#4a6b8c; color:white; border:none; cursor:pointer; padding:2px 5px; border-radius:3px; flex-grow:1;">Generate All</button>
                    </div>
                    <div id="planeList_${this.id}" style="max-height:120px; overflow-y:auto; margin-top:6px; background:#1a2b3c; padding:2px; border-radius:3px;"></div>
                    <button id="btnClearPlanes_${this.id}" style="width:100%; margin-top:5px; background:#8c4a4a; color:white; border:none; cursor:pointer; padding:4px; border-radius:3px;">Clear All Planes</button>
                </div>

                <div style="background:#3a3a3a; padding:5px; border-radius:4px; border: 1px solid #555; margin-top:5px;">
                    <label><b>Camera Type:</b> 
                        <select id="camType_${this.id}" style="background:#222; color:white; border:1px solid #555; width:100%; margin-bottom:5px;">
                            <option value="persp">Perspective</option>
                            <option value="ortho">Orthographic</option>
                        </select>
                    </label>
                    <button id="btnResetView_${this.id}" style="width:100%; padding:6px; background:#635222; color:white; font-weight:bold; border:1px solid #887733; cursor:pointer; border-radius:3px;">
                        Reset Camera Center
                    </button>
                </div>
            </div>
            
            <div style="font-size: 12px; margin-top: 10px;">
                <b>Lattice Slicing Planes:</b><br>
                <div style="display:flex; align-items:center; margin-top:2px;">
                    <input type="checkbox" id="showClipX_${this.id}"> <span style="width:15px">a:</span> <input type="range" id="sliderX_${this.id}" min="1" max="100" value="100" style="width:100%">
                </div>
                <div style="display:flex; align-items:center; margin-top:2px;">
                    <input type="checkbox" id="showClipY_${this.id}"> <span style="width:15px">b:</span> <input type="range" id="sliderY_${this.id}" min="1" max="100" value="100" style="width:100%">
                </div>
                <div style="display:flex; align-items:center; margin-top:2px;">
                    <input type="checkbox" id="showClipZ_${this.id}"> <span style="width:15px">c:</span> <input type="range" id="sliderZ_${this.id}" min="1" max="100" value="100" style="width:100%">
                </div>
            </div>
            
            <hr style="border:0; border-top:1px solid #444; margin: 10px 0;">
            <div style="font-size: 12px; line-height: 1.4;" id="metaPanel_${this.id}">
                <b>Crystal Info:</b><br>
                System: <span id="meta-cs_${this.id}">...</span><br>
                Space Group: <span id="meta-sg_${this.id}">...</span><br>
            </div>
        `;
    }

    addPlaneData(h, k, l, customColor = null) {
        const existing = this.generatedPlanes.find(p => p.h === h && p.k === k && p.l === l);
        if (existing) {
            existing.visible = true;
            return existing;
        }
        const id = `plane_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const color = customColor || ('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'));
        const newPlane = { id, h, k, l, color, opacity: 0.55, visible: true, isolate: false };
        this.generatedPlanes.push(newPlane);
        return newPlane;
    }

    renderPlaneUI() {
        const list = document.getElementById(`planeList_${this.id}`);
        list.innerHTML = '';
        
        if (this.generatedPlanes.length === 0) {
            list.innerHTML = '<div style="color:#777; text-align:center; padding:5px;">No planes generated.</div>';
            return;
        }

        const cs = document.getElementById(`meta-cs_${this.id}`).innerText;
        const isHex = (cs === 'trigonal' || cs === 'hexagonal');

        this.generatedPlanes.forEach(p => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:#222; padding:3px 5px; margin-bottom:2px; border-radius:3px; font-size:12px;';

            const labelText = isHex ? `(${p.h} ${p.k} ${-(p.h+p.k)} ${p.l})` : `(${p.h} ${p.k} ${p.l})`;

            div.innerHTML = `
                <span id="lbl_${p.id}" style="width:55px; font-weight:bold; color:${p.color}; white-space:nowrap; overflow:hidden; cursor:pointer;" title="Click to send to Epitaxy Matcher">${labelText}</span>
                <label style="color:#0f0; cursor:pointer; font-size:10px;" title="Isolate Atoms in this Plane">
                    <input type="checkbox" data-id="${p.id}" class="plane-iso" ${p.isolate ? 'checked' : ''}> ISO
                </label>
                <input type="color" value="${p.color}" style="width:18px; height:18px; border:none; padding:0; cursor:pointer;" data-id="${p.id}" class="plane-color">
                <input type="range" min="0.1" max="1" step="0.1" value="${p.opacity}" style="width:40px;" data-id="${p.id}" class="plane-opac" title="Opacity">
                <input type="checkbox" ${p.visible ? 'checked' : ''} data-id="${p.id}" class="plane-vis" title="Toggle Visibility">
                <button data-id="${p.id}" class="plane-del" style="background:transparent; color:#f44; border:none; cursor:pointer; font-size:14px; padding:0 2px;">✖</button>
            `;
            list.appendChild(div);

            div.querySelector(`#lbl_${p.id}`).addEventListener('click', () => {
                const prefix = this.id === '1' ? 'ep1' : 'ep2';
                document.getElementById(`${prefix}_h`).value = p.h;
                document.getElementById(`${prefix}_k`).value = p.k;
                document.getElementById(`${prefix}_l`).value = p.l;
                calculateEpitaxyMatch();
            });
        });

        list.querySelectorAll('.plane-iso').forEach(el => el.addEventListener('change', (e) => {
            const targetId = e.target.dataset.id;
            const isChecked = e.target.checked;
            this.generatedPlanes.forEach(x => {
                x.isolate = (x.id === targetId) ? isChecked : false;
            });
            this.isolatedPlaneData = this.generatedPlanes.find(x => x.isolate) || null;
            this.renderPlaneUI(); 
            this.updateCSGPlanes(); 
        }));
        
        list.querySelectorAll('.plane-color').forEach(el => el.addEventListener('input', (e) => {
            const p = this.generatedPlanes.find(x => x.id === e.target.dataset.id);
            p.color = e.target.value;
            document.getElementById(`lbl_${p.id}`).style.color = p.color;
            this.update3DPlanes();
        }));
        list.querySelectorAll('.plane-opac').forEach(el => el.addEventListener('input', (e) => {
            const p = this.generatedPlanes.find(x => x.id === e.target.dataset.id);
            p.opacity = parseFloat(e.target.value);
            if (p.mesh) p.mesh.material.opacity = p.opacity;
        }));
        list.querySelectorAll('.plane-vis').forEach(el => el.addEventListener('change', (e) => {
            this.generatedPlanes.find(x => x.id === e.target.dataset.id).visible = e.target.checked;
            this.update3DPlanes();
        }));
        list.querySelectorAll('.plane-del').forEach(el => el.addEventListener('click', (e) => {
            const targetId = e.target.dataset.id;
            if (this.isolatedPlaneData && this.isolatedPlaneData.id === targetId) {
                this.isolatedPlaneData = null;
                this.updateCSGPlanes();
            }
            this.generatedPlanes = this.generatedPlanes.filter(x => x.id !== targetId);
            this.renderPlaneUI();
            this.update3DPlanes();
        }));
    }

    update3DPlanes() {
        disposeGroup(this.millerPlanesGroup);
        const unitRecip = this.getUnitReciprocalVectors();
        if (!unitRecip) return;

        const { rA, rB, rC } = unitRecip;
        const pA = this.latticeVectors.a;
        const pB = this.latticeVectors.b;
        const pC = this.latticeVectors.c;
        const diag = new THREE.Vector3().addVectors(pA, pB).add(pC).length();
        const maxDim = diag * 2.5;
        const boxCenter = new THREE.Vector3().addVectors(pA, pB).add(pC).multiplyScalar(0.5);

        const cs = document.getElementById(`meta-cs_${this.id}`).innerText;
        const isHex = (cs === 'trigonal' || cs === 'hexagonal');

        this.generatedPlanes.forEach(p => {
            if (!p.visible) return;

            const normal = new THREE.Vector3().addScaledVector(rA, p.h).addScaledVector(rB, p.k).addScaledVector(rC, p.l).normalize();

            const planeMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(p.color),
                transparent: true,
                opacity: p.opacity,
                side: THREE.DoubleSide,
                depthWrite: false,
                clippingPlanes: this.boxBoundingPlanes
            });

            const visualPlane = new THREE.Mesh(new THREE.PlaneGeometry(maxDim, maxDim), planeMat);
            visualPlane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            visualPlane.position.copy(boxCenter);
            p.mesh = visualPlane;

            this.millerPlanesGroup.add(visualPlane);

            const labelText = isHex ? `(${p.h} ${p.k} ${-(p.h+p.k)} ${p.l})` : `(${p.h} ${p.k} ${p.l})`;
            const label = makeTextSprite(labelText, p.color);
            let tangent = new THREE.Vector3(1, 0, 0);
            if (Math.abs(normal.dot(tangent)) > 0.9) tangent.set(0, 1, 0);
            tangent.cross(normal).normalize();

            label.position.copy(boxCenter).add(tangent.multiplyScalar(diag * 0.35));
            label.position.add(normal.clone().multiplyScalar(0.4));
            this.millerPlanesGroup.add(label);
        });
    }

    updateCSGPlanes() {
        if (!this.latticeVectors.a) return;

        this.crystalMasterGroup.updateMatrixWorld(true);
        this.crystalPivotGroup.updateMatrixWorld(true);

        const p0 = new THREE.Vector3(0, 0, 0);
        const pA = this.latticeVectors.a;
        const pB = this.latticeVectors.b;
        const pC = this.latticeVectors.c;

        const w_p0 = p0.clone().applyMatrix4(this.crystalPivotGroup.matrixWorld);
        const w_pA = pA.clone().applyMatrix4(this.crystalPivotGroup.matrixWorld);
        const w_pB = pB.clone().applyMatrix4(this.crystalPivotGroup.matrixWorld);
        const w_pC = pC.clone().applyMatrix4(this.crystalPivotGroup.matrixWorld);
        const w_center = new THREE.Vector3().addVectors(pA, pB).add(pC).multiplyScalar(0.5).applyMatrix4(this.crystalPivotGroup.matrixWorld);

        const nAB = new THREE.Vector3().crossVectors(pA, pB).normalize().transformDirection(this.crystalPivotGroup.matrixWorld);
        const nBC = new THREE.Vector3().crossVectors(pB, pC).normalize().transformDirection(this.crystalPivotGroup.matrixWorld);
        const nCA = new THREE.Vector3().crossVectors(pC, pA).normalize().transformDirection(this.crystalPivotGroup.matrixWorld);

        const getInwardPlane = (pt, norm, insidePt) => {
            const dir = new THREE.Vector3().subVectors(insidePt, pt);
            let finalNorm = norm.clone();
            if (finalNorm.dot(dir) < 0) finalNorm.negate();
            return new THREE.Plane().setFromNormalAndCoplanarPoint(finalNorm, pt);
        };

        this.boxBoundingPlanes[0].copy(getInwardPlane(w_p0, nAB, w_center));
        this.boxBoundingPlanes[1].copy(getInwardPlane(w_pC, nAB, w_center));
        this.boxBoundingPlanes[2].copy(getInwardPlane(w_p0, nBC, w_center));
        this.boxBoundingPlanes[3].copy(getInwardPlane(w_pA, nBC, w_center));
        this.boxBoundingPlanes[4].copy(getInwardPlane(w_p0, nCA, w_center));
        this.boxBoundingPlanes[5].copy(getInwardPlane(w_pB, nCA, w_center));

        const get = (key) => document.getElementById(`${key}_${this.id}`);

        if (get('showClipX').checked) {
            const fracX = parseFloat(get('sliderX').value) / 100;
            const slicePtX = new THREE.Vector3().lerpVectors(w_p0, w_pA, fracX);
            const inwardNormX = getInwardPlane(w_pA, nBC, w_p0).normal;
            this.clipX.setFromNormalAndCoplanarPoint(inwardNormX, slicePtX);
        } else {
            this.clipX.set(new THREE.Vector3(-1, 0, 0), Infinity);
        }

        if (get('showClipY').checked) {
            const fracY = parseFloat(get('sliderY').value) / 100;
            const slicePtY = new THREE.Vector3().lerpVectors(w_p0, w_pB, fracY);
            const inwardNormY = getInwardPlane(w_pB, nCA, w_p0).normal;
            this.clipY.setFromNormalAndCoplanarPoint(inwardNormY, slicePtY);
        } else {
            this.clipY.set(new THREE.Vector3(0, -1, 0), Infinity);
        }

        if (get('showClipZ').checked) {
            const fracZ = parseFloat(get('sliderZ').value) / 100;
            const slicePtZ = new THREE.Vector3().lerpVectors(w_p0, w_pC, fracZ);
            const inwardNormZ = getInwardPlane(w_pC, nAB, w_p0).normal;
            this.clipZ.setFromNormalAndCoplanarPoint(inwardNormZ, slicePtZ);
        } else {
            this.clipZ.set(new THREE.Vector3(0, 0, -1), Infinity);
        }

        const unitRecip = this.getUnitReciprocalVectors();
        if (this.isolatedPlaneData && unitRecip) {
            const { rA, rB, rC } = unitRecip;
            const pData = this.isolatedPlaneData;

            const localNormal = new THREE.Vector3().addScaledVector(rA, pData.h).addScaledVector(rB, pData.k).addScaledVector(rC, pData.l).normalize();
            const wNormal = localNormal.transformDirection(this.crystalPivotGroup.matrixWorld).normalize();
            const wNormalNeg = wNormal.clone().negate();

            const halfSlab = 1.2;
            const pt1 = w_center.clone().add(wNormal.clone().multiplyScalar(halfSlab));
            this.isolatePlane1.setFromNormalAndCoplanarPoint(wNormalNeg, pt1);

            const pt2 = w_center.clone().add(wNormalNeg.clone().multiplyScalar(halfSlab));
            this.isolatePlane2.setFromNormalAndCoplanarPoint(wNormal, pt2);
        } else {
            this.isolatePlane1.set(new THREE.Vector3(0, 1, 0), Infinity);
            this.isolatePlane2.set(new THREE.Vector3(0, -1, 0), Infinity);
        }
    }

    updateMagneticAnalytics() {
        if (!this.latticeVectors.a) return;
        const get = (key) => document.getElementById(`${key}_${this.id}`);

        if (!get('posX').disabled) {
            const tx = parseFloat(get('posX').value) || 0;
            const ty = parseFloat(get('posY').value) || 0;
            const tz = parseFloat(get('posZ').value) || 0;
            this.crystalMasterGroup.position.set(tx, ty, tz);
        }

        const bx = parseFloat(get('bX').value) || 0;
        const by = parseFloat(get('bY').value) || 0;
        const bz = parseFloat(get('bZ').value) || 0;
        const bVec = new THREE.Vector3(bx, by, bz);
        if (bVec.lengthSq() === 0) bVec.set(0, 0, 1);
        bVec.normalize();

        if (this.bFieldArrow) {
            this.bFieldArrow.setDirection(bVec);
            this.bFieldArrow.position.copy(this.crystalMasterGroup.position);
        }
        if (this.bFieldLabel) {
            this.bFieldLabel.position.copy(this.crystalMasterGroup.position).add(bVec.clone().multiplyScalar(17));
        }

        const tType = get('targetType').value;
        const u = parseFloat(get('tU').value) || 0;
        const v = parseFloat(get('tV').value) || 0;
        const w = parseFloat(get('tW').value) || 0;

        let localVec = new THREE.Vector3();
        const unitRecip = this.getUnitReciprocalVectors();
        if (tType === 'dir') {
            localVec.addScaledVector(this.latticeVectors.a, u / this.supercellFactors.x)
                    .addScaledVector(this.latticeVectors.b, v / this.supercellFactors.y)
                    .addScaledVector(this.latticeVectors.c, w / this.supercellFactors.z);
        } else if (unitRecip) {
            localVec.addScaledVector(unitRecip.rA, u).addScaledVector(unitRecip.rB, v).addScaledVector(unitRecip.rC, w);
        }
        if (localVec.lengthSq() === 0) localVec.set(0, 0, 1);
        localVec.normalize();

        const rx = parseFloat(get('rotX').value) || 0;
        const ry = parseFloat(get('rotY').value) || 0;
        const rz = parseFloat(get('rotZ').value) || 0;
        const euler = new THREE.Euler(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), THREE.MathUtils.degToRad(rz));
        this.crystalMasterGroup.rotation.copy(euler);

        this.updateCSGPlanes();

        const worldVec = localVec.clone().applyQuaternion(this.crystalMasterGroup.quaternion).normalize();
        let cosTheta = THREE.MathUtils.clamp(worldVec.dot(bVec), -1, 1);
        let thetaDeg = THREE.MathUtils.radToDeg(Math.acos(Math.abs(cosTheta)));
        let S = 0.5 * (3 * Math.pow(Math.abs(cosTheta), 2) - 1);

        const thetaDisp = get('thetaDisplay');
        thetaDisp.innerText = `θ = ${thetaDeg.toFixed(1)}°`;
        get('sDisplay').innerText = `S = ${S.toFixed(2)}`;

        const heatColor = new THREE.Color();
        if (thetaDeg <= 45) {
            heatColor.lerpColors(new THREE.Color(0x00ff00), new THREE.Color(0xffff00), thetaDeg / 45);
        } else {
            heatColor.lerpColors(new THREE.Color(0xffff00), new THREE.Color(0xff0000), (thetaDeg - 45) / 45);
        }
        thetaDisp.style.color = heatColor.getStyle();

        const useHeatmap = get('colorHeatmap').checked;
        this.atomMaterials.forEach(mat => {
            mat.color.copy(useHeatmap ? heatColor : mat.userData.originalColor);
        });
    }

    renderAtomLegendUI() {
        const listEl = document.getElementById(`atomLegendList_${this.id}`);
        if (!listEl) return;

        if (this.speciesRegistry.size === 0) {
            listEl.innerHTML = `<span style="color:#888; font-size:11px;">No atoms loaded.</span>`;
            this.hudLegend.innerHTML = `<span style="color:#aaa;">${this.side === 'left' ? 'Primary' : 'Secondary'}: No structure loaded</span>`;
            return;
        }

        listEl.innerHTML = '';
        const hudItems = [`<b style="color:${this.side === 'left' ? '#ffcc66' : '#66ccff'};">${this.side === 'left' ? 'Primary' : 'Secondary'}:</b>`];

        this.speciesRegistry.forEach((entry, rawSpecies) => {
            const row = document.createElement('div');
            row.style.cssText = `
                display:flex; align-items:center; justify-content:space-between;
                background:#141c18; padding:4px 6px; border-radius:4px; border:1px solid #2d4537;
            `;
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:7px; overflow:hidden;">
                    <input type="color" value="${entry.color}" data-sp="${rawSpecies}" class="sp-color-picker"
                        title="Click to customize ${entry.name} color"
                        style="width:18px; height:18px; border:none; padding:0; background:none; cursor:pointer; flex-shrink:0;">
                    <span id="sp_dot_${this.id}_${rawSpecies}" style="
                        display:inline-block; width:11px; height:11px; border-radius:50%;
                        background: radial-gradient(circle at 32% 32%, #ffffff, ${entry.color} 55%, #111111);
                        border:1px solid rgba(255,255,255,0.4); flex-shrink:0;
                    "></span>
                    <span style="font-weight:bold; color:#fff;">${entry.symbol}</span>
                    <span style="color:#b8d4c5; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${entry.name}">
                        ${entry.name}
                    </span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                    <span style="background:#26382e; color:#88ffbb; padding:1px 5px; border-radius:10px; font-size:10px; font-weight:bold;">
                        ×${entry.count}
                    </span>
                    <input type="checkbox" data-sp="${rawSpecies}" class="sp-vis-toggle" ${entry.visible ? 'checked' : ''}
                        title="Show/Hide ${entry.symbol} atoms" style="cursor:pointer; margin:0;">
                </div>
            `;
            listEl.appendChild(row);

            hudItems.push(`
                <span style="display:inline-flex; align-items:center; gap:5px; background:rgba(255,255,255,0.06); padding:2px 7px; border-radius:12px; border:1px solid rgba(255,255,255,0.12);">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:radial-gradient(circle at 30% 30%, #fff, ${entry.color} 60%, #111);"></span>
                    <b>${entry.symbol}</b> <span style="color:#ccc; font-size:11px;">(${entry.name})</span>
                    <span style="color:#88ffbb; font-size:10px;">×${entry.count}</span>
                </span>
            `);
        });

        this.hudLegend.innerHTML = hudItems.join('');

        // Wire color pickers
        listEl.querySelectorAll('.sp-color-picker').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const sp = e.target.dataset.sp;
                const newHex = e.target.value;
                this.customSpeciesColors[sp] = newHex;
                const entry = this.speciesRegistry.get(sp);
                if (!entry) return;
                entry.color = newHex;

                const useHeatmap = document.getElementById(`colorHeatmap_${this.id}`).checked;
                entry.materials.forEach(mat => {
                    mat.userData.originalColor.set(newHex);
                    if (!useHeatmap) mat.color.set(newHex);
                });

                const dot = document.getElementById(`sp_dot_${this.id}_${sp}`);
                if (dot) {
                    dot.style.background = `radial-gradient(circle at 32% 32%, #ffffff, ${newHex} 55%, #111111)`;
                }
                this.renderAtomLegendUI();
            });
        });

        // Wire visibility toggles per element species
        listEl.querySelectorAll('.sp-vis-toggle').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const sp = e.target.dataset.sp;
                const isVis = e.target.checked;
                const entry = this.speciesRegistry.get(sp);
                if (!entry) return;
                entry.visible = isVis;
                entry.meshes.forEach(m => { m.visible = isVis; });
                entry.labels.forEach(l => { l.visible = isVis; });
            });
        });
    }

    attachEvents() {
        const get = (key) => document.getElementById(`${key}_${this.id}`);

        get('fileCif').addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.currentUploadedFile = e.target.files[0];
                get('fileName').innerText = this.currentUploadedFile.name;
                get('fileName').style.color = '#77c5ff';
                this.loadCrystal();
            }
        });

        get('btnClearCif').addEventListener('click', () => {
            this.currentUploadedFile = null;
            get('fileCif').value = '';
            get('fileName').innerText = 'No custom CIF loaded';
            get('fileName').style.color = '#aaa';
            this.loadCrystal();
        });

        get('showAtomLabels').addEventListener('change', (e) => {
            this.atomLabelGroup.visible = e.target.checked;
        });

        get('showBonds').addEventListener('change', (e) => {
            if (get('renderMode').value !== 'space_fill') this.bondGroup.visible = e.target.checked;
        });
        get('showCell').addEventListener('change', (e) => this.cellGroup.visible = e.target.checked);
        get('showAxes').addEventListener('change', (e) => this.customAxes.visible = e.target.checked);

        const updateAtomScale = () => {
            const baseRad = parseFloat(get('atomRadius').value);
            const isSpaceFill = get('renderMode').value === 'space_fill';
            const mult = isSpaceFill ? 3.5 : 1.0;
            this.atomGroup.children.forEach(mesh => mesh.scale.setScalar(baseRad * mult));
        };

        get('renderMode').addEventListener('change', (e) => {
            updateAtomScale();
            this.bondGroup.visible = e.target.value !== 'space_fill' && get('showBonds').checked;
        });
        get('atomRadius').addEventListener('input', updateAtomScale);
        get('lightInt').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.dirLight.intensity = val;
            this.ambientLight.intensity = val * 0.6;
        });

        ['posX', 'posY', 'posZ', 'bX', 'bY', 'bZ', 'targetType', 'tU', 'tV', 'tW', 'rotX', 'rotY', 'rotZ', 'colorHeatmap'].forEach(id => {
            get(id).addEventListener('input', () => {
                this.updateMagneticAnalytics();
                if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();
            });
        });

        get('btnAlignB').addEventListener('click', () => {
            const bx = parseFloat(get('bX').value) || 0;
            const by = parseFloat(get('bY').value) || 0;
            const bz = parseFloat(get('bZ').value) || 0;
            const bVec = new THREE.Vector3(bx, by, bz).normalize();
            const tType = get('targetType').value;
            const u = parseFloat(get('tU').value) || 0;
            const v = parseFloat(get('tV').value) || 0;
            const w = parseFloat(get('tW').value) || 0;
            let localVec = new THREE.Vector3();
            const unitRecip = this.getUnitReciprocalVectors();
            if (tType === 'dir') {
                localVec.addScaledVector(this.latticeVectors.a, u / this.supercellFactors.x)
                        .addScaledVector(this.latticeVectors.b, v / this.supercellFactors.y)
                        .addScaledVector(this.latticeVectors.c, w / this.supercellFactors.z);
            } else if (unitRecip) {
                localVec.addScaledVector(unitRecip.rA, u).addScaledVector(unitRecip.rB, v).addScaledVector(unitRecip.rC, w);
            }
            localVec.normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(localVec, bVec);
            const euler = new THREE.Euler().setFromQuaternion(quat);
            get('rotX').value = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
            get('rotY').value = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
            get('rotZ').value = THREE.MathUtils.radToDeg(euler.z).toFixed(1);
            this.updateMagneticAnalytics();
            if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();
        });

        const updateMillerI = () => {
            const h = parseFloat(get('mH').value) || 0;
            const k = parseFloat(get('mK').value) || 0;
            get('mI').value = -(h + k);
        };
        get('mH').addEventListener('input', updateMillerI);
        get('mK').addEventListener('input', updateMillerI);

        get('btnAddPlane').addEventListener('click', () => {
            const h = parseFloat(get('mH').value) || 0;
            const k = parseFloat(get('mK').value) || 0;
            const l = parseFloat(get('mL').value) || 0;
            if (h === 0 && k === 0 && l === 0) return;
            this.addPlaneData(h, k, l);
            this.renderPlaneUI();
            this.update3DPlanes();

            const prefix = this.id === '1' ? 'ep1' : 'ep2';
            document.getElementById(`${prefix}_h`).value = h;
            document.getElementById(`${prefix}_k`).value = k;
            document.getElementById(`${prefix}_l`).value = l;
            if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();
        });

        get('btnBatchPlanes').addEventListener('click', () => {
            const n = parseInt(get('maxMiller').value) || 1;
            const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);
            const gcd3 = (a, b, c) => gcd(a, gcd(b, c));

            for (let h = -n; h <= n; h++) {
                for (let k = -n; k <= n; k++) {
                    for (let l = -n; l <= n; l++) {
                        if (h === 0 && k === 0 && l === 0) continue;
                        let d = gcd3(h, k, l);
                        let h_n = h / d, k_n = k / d, l_n = l / d;
                        let first = h_n !== 0 ? h_n : (k_n !== 0 ? k_n : l_n);
                        if (first < 0) { h_n *= -1; k_n *= -1; l_n *= -1; }
                        this.addPlaneData(h_n, k_n, l_n);
                    }
                }
            }
            this.renderPlaneUI();
            this.update3DPlanes();
        });

        get('btnClearPlanes').addEventListener('click', () => {
            this.generatedPlanes = [];
            this.isolatedPlaneData = null;
            this.renderPlaneUI();
            this.update3DPlanes();
            this.updateCSGPlanes();
        });

        get('matSelect').addEventListener('change', () => {
            if (!this.currentUploadedFile) this.loadCrystal();
        });
        get('btnSupercell').addEventListener('click', () => this.loadCrystal());

        get('atomOpac').addEventListener('input', (e) => this.atomMaterials.forEach(m => m.opacity = parseFloat(e.target.value)));
        get('bondOpac').addEventListener('input', (e) => {
            if (this.sharedBondMaterial) this.sharedBondMaterial.opacity = parseFloat(e.target.value);
        });

        get('camType').addEventListener('change', (e) => {
            if (e.target.value === 'ortho') {
                this.orthoCamera.position.copy(this.perspCamera.position);
                this.activeCamera = this.orthoCamera;
            } else {
                this.perspCamera.position.copy(this.orthoCamera.position);
                this.activeCamera = this.perspCamera;
            }
            this.controls.object = this.activeCamera;
            this.controls.update();
        });

        get('btnResetView').addEventListener('click', () => {
            const newTarget = this.crystalMasterGroup.position.clone();
            const offset = new THREE.Vector3().subVectors(this.activeCamera.position, this.controls.target);
            this.controls.target.copy(newTarget);
            this.activeCamera.position.copy(newTarget).add(offset);
            this.controls.update();
        });

        ['X', 'Y', 'Z'].forEach(axis => {
            get(`slider${axis}`).addEventListener('input', () => {
                get(`showClip${axis}`).checked = true;
                this.updateCSGPlanes();
            });
            get(`showClip${axis}`).addEventListener('change', () => this.updateCSGPlanes());
        });
    }

    clearScene() {
        disposeGroup(this.atomGroup);
        disposeGroup(this.atomLabelGroup);
        disposeGroup(this.cellGroup);
        disposeGroup(this.bondGroup);
        disposeGroup(this.customAxes);
        disposeGroup(this.millerPlanesGroup);
        this.atomMaterials.length = 0;
        this.speciesRegistry.clear();
        this.sharedBondMaterial = null;
        this.generatedPlanes = [];
        this.isolatedPlaneData = null;
        const list = document.getElementById(`planeList_${this.id}`);
        if (list) list.innerHTML = '';
    }

    async loadCrystal() {
        this.clearScene();
        const get = (key) => document.getElementById(`${key}_${this.id}`);
        const sx = parseInt(get('scX').value) || 1;
        const sy = parseInt(get('scY').value) || 1;
        const sz = parseInt(get('scZ').value) || 1;
        this.supercellFactors = { x: sx, y: sy, z: sz };

        try {
            let response;
            if (this.currentUploadedFile) {
                const formData = new FormData();
                formData.append('file', this.currentUploadedFile);
                response = await fetch(`http://127.0.0.1:8000/crystal/upload?sc_x=${sx}&sc_y=${sy}&sc_z=${sz}`, {
                    method: 'POST',
                    body: formData
                });
            } else {
                const material = get('matSelect').value;
                response = await fetch(`http://127.0.0.1:8000/crystal/${material}?sc_x=${sx}&sc_y=${sy}&sc_z=${sz}`);
            }

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Server returned an error.");
            }
            const data = await response.json();

            const m = data.lattice_matrix;
            this.currentReciprocalMatrix = data.reciprocal_matrix;

            this.unitReciprocalMatrix = [
                this.currentReciprocalMatrix[0].map(val => val * sx),
                this.currentReciprocalMatrix[1].map(val => val * sy),
                this.currentReciprocalMatrix[2].map(val => val * sz)
            ];

            const isHexOrTrigonal = (data.crystal_system === 'trigonal' || data.crystal_system === 'hexagonal');
            get('i-container').style.display = isHexOrTrigonal ? 'inline' : 'none';
            get('millerTitle').innerText = isHexOrTrigonal ? 'Miller Planes (Phase 3) (h, k, i, l):' : 'Miller Planes (Phase 3) (h, k, l):';
            if (isHexOrTrigonal) {
                const h = parseFloat(get('mH').value) || 0;
                const k = parseFloat(get('mK').value) || 0;
                get('mI').value = -(h + k);
            }

            const p0 = new THREE.Vector3(0, 0, 0);
            const pA = new THREE.Vector3(...m[0]);
            const pB = new THREE.Vector3(...m[1]);
            const pC = new THREE.Vector3(...m[2]);
            this.latticeVectors = { a: pA.clone(), b: pB.clone(), c: pC.clone() };

            get('meta-cs').innerText = data.crystal_system;
            get('meta-sg').innerText = data.space_group;

            const boxCenter = new THREE.Vector3().addVectors(pA, pB).add(pC).multiplyScalar(0.5);
            this.crystalPivotGroup.position.copy(boxCenter).negate();

            const baseRad = parseFloat(get('atomRadius').value);
            const isSpaceFill = get('renderMode').value === 'space_fill';
            const scaleMult = isSpaceFill ? 3.5 : 1.0;

            if (data.atoms && data.atoms.length > 0) {
                const atomPositions = [];
                data.atoms.forEach(atom => {
                    const elemInfo = getElementInfo(atom.species);
                    const colorHex = this.customSpeciesColors[atom.species] || elemInfo.color;

                    if (!this.speciesRegistry.has(atom.species)) {
                        this.speciesRegistry.set(atom.species, {
                            symbol: elemInfo.symbol,
                            name: elemInfo.name,
                            color: colorHex,
                            count: 0,
                            visible: true,
                            materials: [],
                            meshes: [],
                            labels: []
                        });
                    }
                    const spEntry = this.speciesRegistry.get(atom.species);
                    spEntry.count++;

                    const mat = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(colorHex), roughness: 0.25, metalness: 0.1,
                        clippingPlanes: this.clipPlanes, transparent: true,
                        opacity: parseFloat(get('atomOpac').value)
                    });
                    mat.userData.originalColor = new THREE.Color(colorHex);
                    this.atomMaterials.push(mat);
                    spEntry.materials.push(mat);

                    const sphere = new THREE.Mesh(SHARED_SPHERE_GEOM, mat);
                    sphere.scale.setScalar(baseRad * scaleMult);
                    const pos = new THREE.Vector3(atom.position[0], atom.position[1], atom.position[2]);
                    sphere.position.copy(pos);
                    this.atomGroup.add(sphere);
                    spEntry.meshes.push(sphere);
                    atomPositions.push(pos);

                    const lblSprite = makeAtomLabelSprite(elemInfo.symbol, colorHex);
                    lblSprite.position.copy(pos);
                    this.atomLabelGroup.add(lblSprite);
                    spEntry.labels.push(lblSprite);
                });

                this.atomLabelGroup.visible = get('showAtomLabels').checked;
                this.renderAtomLegendUI();

                const bondPoints = [];
                for (let i = 0; i < atomPositions.length; i++) {
                    for (let j = i + 1; j < atomPositions.length; j++) {
                        if (atomPositions[i].distanceToSquared(atomPositions[j]) < 6.25) {
                            bondPoints.push(atomPositions[i], atomPositions[j]);
                        }
                    }
                }
                if (bondPoints.length > 0) {
                    this.sharedBondMaterial = new THREE.LineBasicMaterial({
                        color: 0xffffff, transparent: true,
                        opacity: parseFloat(get('bondOpac').value),
                        clippingPlanes: this.clipPlanes
                    });
                    const bGeom = new THREE.BufferGeometry().setFromPoints(bondPoints);
                    this.bondGroup.add(new THREE.LineSegments(bGeom, this.sharedBondMaterial));
                }
                if (isSpaceFill) this.bondGroup.visible = false;
            } else {
                this.renderAtomLegendUI();
            }

            const pAB = new THREE.Vector3().addVectors(pA, pB);
            const pAC = new THREE.Vector3().addVectors(pA, pC);
            const pBC = new THREE.Vector3().addVectors(pB, pC);
            const pABC = new THREE.Vector3().addVectors(pAB, pC);
            const pts = [p0, pA, pB, pC, pAB, pAC, pBC, pABC];
            const lines = [0,1, 0,2, 0,3, 1,4, 1,5, 2,4, 2,6, 3,5, 3,6, 4,7, 5,7, 6,7];
            const geom = new THREE.BufferGeometry().setFromPoints(lines.map(i => pts[i]));
            this.cellGroup.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: 0xffffff })));

            const axA = new THREE.ArrowHelper(pA.clone().normalize(), p0, pA.length() + 1, 0xff4444);
            const lblA = makeTextSprite("a1", "#ff4444"); lblA.position.copy(pA).multiplyScalar(1.05); this.customAxes.add(axA, lblA);
            const axB = new THREE.ArrowHelper(pB.clone().normalize(), p0, pB.length() + 1, 0x44ff44);
            const lblB = makeTextSprite("a2", "#44ff44"); lblB.position.copy(pB).multiplyScalar(1.05); this.customAxes.add(axB, lblB);
            const axC = new THREE.ArrowHelper(pC.clone().normalize(), p0, pC.length() + 1, 0x4444ff);
            const lblC = makeTextSprite("c", "#4444ff"); lblC.position.copy(pC).multiplyScalar(1.05); this.customAxes.add(axC, lblC);

            if (isHexOrTrigonal) {
                const pA3 = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(-1);
                const axA3 = new THREE.ArrowHelper(pA3.clone().normalize(), p0, pA3.length() + 1, 0xffff44);
                const lblA3 = makeTextSprite("a3", "#ffff44"); lblA3.position.copy(pA3).multiplyScalar(1.05); this.customAxes.add(axA3, lblA3);
            }

            if (!this.bFieldArrow) {
                this.bFieldArrow = new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,0), 15, 0xaa44ff, 3, 2);
                this.scene.add(this.bFieldArrow);
            }
            if (!this.bFieldLabel) {
                this.bFieldLabel = makeTextSprite("B-Field", "#aa44ff");
                this.scene.add(this.bFieldLabel);
            }

            get('showClipX').checked = false;
            get('showClipY').checked = false;
            get('showClipZ').checked = false;
            get('sliderX').value = 100;
            get('sliderY').value = 100;
            get('sliderZ').value = 100;

            this.updateCSGPlanes();

            this.controls.target.copy(this.crystalMasterGroup.position);
            const diag = new THREE.Vector3().addVectors(pA, pB).add(pC).length();
            const camDistance = Math.max(diag * 0.75, 10);
            this.perspCamera.position.set(this.crystalMasterGroup.position.x + camDistance, this.crystalMasterGroup.position.y + camDistance * 0.7, this.crystalMasterGroup.position.z + camDistance);
            this.orthoCamera.position.set(this.crystalMasterGroup.position.x + camDistance, this.crystalMasterGroup.position.y + camDistance * 0.7, this.crystalMasterGroup.position.z + camDistance);

            this.updateMagneticAnalytics();
            this.renderPlaneUI();

            if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();

        } catch (error) {
            console.warn(`Workspace ${this.id} initial load:`, error.message);
            const metaCs = document.getElementById(`meta-cs_${this.id}`);
            if (metaCs) metaCs.innerText = "Please upload a .cif file";
            this.renderAtomLegendUI();
        }
    }
}

const workspaceLeft = new CrystalWorkspace('1', 'left', 'alumina');
const workspaceRight = new CrystalWorkspace('2', 'right', 'alumina');

// --- 2D VECTORIAL & TWIST-DEPENDENT EPITAXY ENGINE ---
function getPlaneVectorAndDSpacing(ws, h, k, l) {
    const unitRecip = ws.getUnitReciprocalVectors();
    if (!unitRecip || (h === 0 && k === 0 && l === 0)) {
        return { normal: new THREE.Vector3(0, 0, 1), d: 0, scaleFactor: 1.0 };
    }
    const { rA, rB, rC } = unitRecip;

    const pA_unit = ws.latticeVectors.a.clone().divideScalar(ws.supercellFactors.x);
    const dotTest = Math.abs(pA_unit.dot(rA));
    const scaleFactor = (Math.abs(dotTest - 2 * Math.PI) < 0.5) ? (2 * Math.PI) : 1.0;

    const gVector = new THREE.Vector3()
        .addScaledVector(rA, h)
        .addScaledVector(rB, k)
        .addScaledVector(rC, l);
    const length = gVector.length();
    return {
        normal: gVector.clone().normalize(),
        d: length > 0 ? (scaleFactor / length) : 0,
        scaleFactor
    };
}

// Extracts low-index in-plane "structural wall" directions lying within the chosen (hkl) plane
function getInPlaneStructuralWalls(ws, contactLocalNormal, scaleFactor) {
    const unitRecip = ws.getUnitReciprocalVectors();
    if (!unitRecip) return [];
    const { rA, rB, rC } = unitRecip;
    const walls = [];

    for (let h = -2; h <= 2; h++) {
        for (let k = -2; k <= 2; k++) {
            for (let l = -2; l <= 2; l++) {
                if (h === 0 && k === 0 && l === 0) continue;
                const g = new THREE.Vector3()
                    .addScaledVector(rA, h)
                    .addScaledVector(rB, k)
                    .addScaledVector(rC, l);
                const gNorm = g.clone().normalize();
                // Keep planes that are perpendicular or steeply intersecting the contact plane
                if (Math.abs(gNorm.dot(contactLocalNormal)) < 0.65) {
                    const qProj = g.clone().addScaledVector(contactLocalNormal, -g.dot(contactLocalNormal));
                    const qLen = qProj.length();
                    if (qLen > 1e-4) {
                        const dir = qProj.clone().normalize();
                        const dWall = scaleFactor / qLen;
                        // Deduplicate parallel/anti-parallel wall directions, keeping the largest d-spacing (fundamental wall)
                        const dup = walls.find(w => Math.abs(w.localDir.dot(dir)) > 0.995);
                        if (!dup) {
                            walls.push({ h, k, l, localDir: dir, dWall });
                        } else if (dWall > dup.dWall) {
                            dup.h = h; dup.k = k; dup.l = l;
                            dup.localDir = dir; dup.dWall = dWall;
                        }
                    }
                }
            }
        }
    }
    // Sort by largest d-spacing (most prominent low-index structural walls)
    walls.sort((a, b) => b.dWall - a.dWall);
    return walls.slice(0, 6);
}

// Evaluates the 2D Vectorial Misfit for a given Secondary Crystal quaternion
function evaluateInterfaceState(quat1, quat2, plane1, plane2, walls1, walls2, bestN, bestM, baseMisFit) {
    const worldN1 = plane1.normal.clone().applyQuaternion(quat1).normalize();
    const worldN2 = plane2.normal.clone().applyQuaternion(quat2).normalize();

    // Out-of-plane tilt between N1 and -N2
    const targetN2 = worldN1.clone().negate();
    const cosTilt = THREE.MathUtils.clamp(Math.abs(worldN2.dot(targetN2)), 0, 1);
    const tiltRad = Math.acos(cosTilt);

    // Find minimum in-plane angular mis-fit (alpha) between principal structural walls
    let minAlphaRad = Math.PI / 4;
    if (walls1.length > 0 && walls2.length > 0) {
        const topWalls1 = walls1.slice(0, 3);
        const topWalls2 = walls2.slice(0, 3);
        for (const w1 of topWalls1) {
            const w1World = w1.localDir.clone().applyQuaternion(quat1).normalize();
            for (const w2 of topWalls2) {
                const w2World = w2.localDir.clone().applyQuaternion(quat2).normalize();
                const cosAlpha = THREE.MathUtils.clamp(Math.abs(w1World.dot(w2World)), 0, 1);
                const alpha = Math.acos(cosAlpha);
                if (alpha < minAlphaRad) {
                    minAlphaRad = alpha;
                }
            }
        }
    } else {
        minAlphaRad = 0;
    }

    // 2D Vectorial Mis-fit combining Trolliard's F0, angular wall mis-fit alpha(phi), and out-of-plane tilt
    const ratio = (bestN * plane1.d > 0) ? ((bestM * plane2.d) / (bestN * plane1.d)) : 1.0;
    const angularTerm = 4.0 * ratio * Math.pow(Math.sin(minAlphaRad / 2.0), 2);
    const tiltTerm = Math.pow(Math.sin(tiltRad), 2);
    const totalMisFit = Math.sqrt(Math.pow(baseMisFit, 2) + angularTerm + tiltTerm);

    return {
        alphaDeg: THREE.MathUtils.radToDeg(minAlphaRad),
        tiltDeg: THREE.MathUtils.radToDeg(tiltRad),
        totalMisFitPercent: totalMisFit * 100,
        matchingDegree: Math.max(0, 100 - totalMisFit * 100)
    };
}

function calculateEpitaxyMatch() {
    const h1 = parseFloat(document.getElementById('ep1_h').value) || 0;
    const k1 = parseFloat(document.getElementById('ep1_k').value) || 0;
    const l1 = parseFloat(document.getElementById('ep1_l').value) || 0;

    const h2 = parseFloat(document.getElementById('ep2_h').value) || 0;
    const k2 = parseFloat(document.getElementById('ep2_k').value) || 0;
    const l2 = parseFloat(document.getElementById('ep2_l').value) || 0;

    const plane1 = getPlaneVectorAndDSpacing(workspaceLeft, h1, k1, l1);
    const plane2 = getPlaneVectorAndDSpacing(workspaceRight, h2, k2, l2);

    document.getElementById('ep1_d').innerText = `Unit d-spacing: ${plane1.d.toFixed(4)} Å`;
    document.getElementById('ep2_d').innerText = `Unit d-spacing: ${plane2.d.toFixed(4)} Å`;

    if (plane1.d === 0 || plane2.d === 0) return;

    let bestMisFit = Infinity;
    let bestN = 1, bestM = 1;

    for (let n = 1; n <= 12; n++) {
        for (let m = 1; m <= 12; m++) {
            const length1 = n * plane1.d;
            const length2 = m * plane2.d;
            const misFit = Math.abs(length1 - length2) / length1;
            if (misFit < bestMisFit) {
                bestMisFit = misFit;
                bestN = n;
                bestM = m;
            }
        }
    }

    const walls1 = getInPlaneStructuralWalls(workspaceLeft, plane1.normal, plane1.scaleFactor);
    const walls2 = getInPlaneStructuralWalls(workspaceRight, plane2.normal, plane2.scaleFactor);

    const state = evaluateInterfaceState(
        workspaceLeft.crystalMasterGroup.quaternion,
        workspaceRight.crystalMasterGroup.quaternion,
        plane1, plane2, walls1, walls2, bestN, bestM, bestMisFit
    );

    const f0Percent = bestMisFit * 100;
    document.getElementById('epiMatchText').innerText = `Parametric Mis-fit (F₀): ${f0Percent.toFixed(2)}%`;
    document.getElementById('epiAngleText').innerText =
        `Angular Mis-fit (α): ${state.alphaDeg.toFixed(1)}°` + (state.tiltDeg > 0.5 ? ` (Tilt: ${state.tiltDeg.toFixed(1)}°)` : '');

    const scoreElem = document.getElementById('epiScoreText');
    scoreElem.innerText = `Matching Degree: ${state.matchingDegree.toFixed(2)}%`;
    scoreElem.style.color = state.matchingDegree > 95 ? '#00ff00' : (state.matchingDegree > 80 ? '#ffff00' : '#ff4444');

    const len1 = (bestN * plane1.d).toFixed(2);
    const len2 = (bestM * plane2.d).toFixed(2);
    document.getElementById('epiSupercellText').innerText =
        `Coincidence Supercell: ${bestN} × d₁ (${len1} Å) ≈ ${bestM} × d₂ (${len2} Å) | Total Vectorial Mis-fit: ${state.totalMisFitPercent.toFixed(2)}%`;
}

document.getElementById('btnCalcMatch').addEventListener('click', calculateEpitaxyMatch);

let baseDockQuaternion = new THREE.Quaternion();

function dockCrystalsFaceToFace() {
    const h1 = parseFloat(document.getElementById('ep1_h').value) || 0;
    const k1 = parseFloat(document.getElementById('ep1_k').value) || 0;
    const l1 = parseFloat(document.getElementById('ep1_l').value) || 0;

    const h2 = parseFloat(document.getElementById('ep2_h').value) || 0;
    const k2 = parseFloat(document.getElementById('ep2_k').value) || 0;
    const l2 = parseFloat(document.getElementById('ep2_l').value) || 0;

    if ((h1 === 0 && k1 === 0 && l1 === 0) || (h2 === 0 && k2 === 0 && l2 === 0)) {
        alert("Please enter valid non-zero (h k l) Miller indices for both crystals.");
        return;
    }

    workspaceLeft.addPlaneData(h1, k1, l1, '#ffcc00');
    workspaceLeft.renderPlaneUI();
    workspaceLeft.update3DPlanes();

    workspaceRight.addPlaneData(h2, k2, l2, '#00ccff');
    workspaceRight.renderPlaneUI();
    workspaceRight.update3DPlanes();

    const plane1 = getPlaneVectorAndDSpacing(workspaceLeft, h1, k1, l1);
    const plane2 = getPlaneVectorAndDSpacing(workspaceRight, h2, k2, l2);

    workspaceLeft.crystalMasterGroup.updateMatrixWorld(true);
    const worldNormal1 = plane1.normal.clone()
        .applyQuaternion(workspaceLeft.crystalMasterGroup.quaternion)
        .normalize();

    const targetNormal2 = worldNormal1.clone().negate();
    const localNormal2 = plane2.normal.clone().normalize();

    baseDockQuaternion.setFromUnitVectors(localNormal2, targetNormal2);

    applyEpitaxyTransform();
}

function applyEpitaxyTransform() {
    const h1 = parseFloat(document.getElementById('ep1_h').value) || 0;
    const k1 = parseFloat(document.getElementById('ep1_k').value) || 0;
    const l1 = parseFloat(document.getElementById('ep1_l').value) || 0;
    const plane1 = getPlaneVectorAndDSpacing(workspaceLeft, h1, k1, l1);

    workspaceLeft.crystalMasterGroup.updateMatrixWorld(true);
    const worldNormal1 = plane1.normal.clone()
        .applyQuaternion(workspaceLeft.crystalMasterGroup.quaternion)
        .normalize();

    const twistDeg = parseFloat(document.getElementById('epiTwist').value) || 0;
    document.getElementById('twistLabel').innerText = `Twist φ (${twistDeg.toFixed(1)}°):`;

    const twistQuat = new THREE.Quaternion().setFromAxisAngle(worldNormal1, THREE.MathUtils.degToRad(twistDeg));
    const finalQuat = twistQuat.multiply(baseDockQuaternion.clone());
    workspaceRight.crystalMasterGroup.quaternion.copy(finalQuat);

    const euler = new THREE.Euler().setFromQuaternion(finalQuat);
    document.getElementById('rotX_2').value = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
    document.getElementById('rotY_2').value = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
    document.getElementById('rotZ_2').value = THREE.MathUtils.radToDeg(euler.z).toFixed(1);

    const gap = parseFloat(document.getElementById('epiGap').value) || 0;
    const transX = parseFloat(document.getElementById('epiTransX').value) || 0;
    const transY = parseFloat(document.getElementById('epiTransY').value) || 0;

    let tangentX = new THREE.Vector3(1, 0, 0);
    if (Math.abs(worldNormal1.dot(tangentX)) > 0.9) tangentX.set(0, 1, 0);
    tangentX.crossVectors(tangentX, worldNormal1).normalize();
    const tangentY = new THREE.Vector3().crossVectors(worldNormal1, tangentX).normalize();

    const finalPos = workspaceLeft.crystalMasterGroup.position.clone()
        .addScaledVector(worldNormal1, gap)
        .addScaledVector(tangentX, transX)
        .addScaledVector(tangentY, transY);

    workspaceRight.crystalMasterGroup.position.copy(finalPos);
    workspaceRight.updateCSGPlanes();

    // Immediately recalculate Twist-dependent Matching Degree!
    calculateEpitaxyMatch();
}

// Automatically sweeps Twist phi in [-180, 180] to lock into the highest Matching Degree
function autoOptimizeTwistAngle() {
    dockCrystalsFaceToFace();

    const h1 = parseFloat(document.getElementById('ep1_h').value) || 0;
    const k1 = parseFloat(document.getElementById('ep1_k').value) || 0;
    const l1 = parseFloat(document.getElementById('ep1_l').value) || 0;
    const h2 = parseFloat(document.getElementById('ep2_h').value) || 0;
    const k2 = parseFloat(document.getElementById('ep2_k').value) || 0;
    const l2 = parseFloat(document.getElementById('ep2_l').value) || 0;

    const plane1 = getPlaneVectorAndDSpacing(workspaceLeft, h1, k1, l1);
    const plane2 = getPlaneVectorAndDSpacing(workspaceRight, h2, k2, l2);
    if (plane1.d === 0 || plane2.d === 0) return;

    let bestMisFit = Infinity;
    let bestN = 1, bestM = 1;
    for (let n = 1; n <= 12; n++) {
        for (let m = 1; m <= 12; m++) {
            const misFit = Math.abs(n * plane1.d - m * plane2.d) / (n * plane1.d);
            if (misFit < bestMisFit) {
                bestMisFit = misFit; bestN = n; bestM = m;
            }
        }
    }

    const walls1 = getInPlaneStructuralWalls(workspaceLeft, plane1.normal, plane1.scaleFactor);
    const walls2 = getInPlaneStructuralWalls(workspaceRight, plane2.normal, plane2.scaleFactor);

    const worldNormal1 = plane1.normal.clone()
        .applyQuaternion(workspaceLeft.crystalMasterGroup.quaternion)
        .normalize();

    let bestPhi = 0;
    let maxScore = -1;

    for (let phi = -180; phi <= 180; phi += 0.5) {
        const testTwistQuat = new THREE.Quaternion().setFromAxisAngle(worldNormal1, THREE.MathUtils.degToRad(phi));
        const testQuat2 = testTwistQuat.multiply(baseDockQuaternion.clone());
        const res = evaluateInterfaceState(
            workspaceLeft.crystalMasterGroup.quaternion,
            testQuat2,
            plane1, plane2, walls1, walls2, bestN, bestM, bestMisFit
        );
        if (res.matchingDegree > maxScore) {
            maxScore = res.matchingDegree;
            bestPhi = phi;
        }
    }

    document.getElementById('epiTwist').value = bestPhi;
    applyEpitaxyTransform();
}

document.getElementById('btnDockCrystal').addEventListener('click', dockCrystalsFaceToFace);
document.getElementById('btnAutoTwist').addEventListener('click', autoOptimizeTwistAngle);

['epiTransX', 'epiTransY', 'epiGap', 'epiTwist'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyEpitaxyTransform);
});

// --- GLOBAL MOUSE DRAG & ROTATION LOGIC ---
let activeDragMode = 'camera';
document.addEventListener('change', e => {
    if (e.target.name === 'dragAction') {
        activeDragMode = e.target.value;
        workspaceLeft.controls.enabled = (activeDragMode === 'camera');
    }
});

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
    if (activeDragMode === 'camera') return;
    isDragging = true;
    previousMousePosition = { x: e.offsetX, y: e.offsetY };
});

renderer.domElement.addEventListener('pointermove', (e) => {
    if (!isDragging || activeDragMode === 'camera') return;

    const deltaMove = {
        x: e.offsetX - previousMousePosition.x,
        y: e.offsetY - previousMousePosition.y
    };

    const ws = (activeDragMode === 'primary') ? workspaceLeft : workspaceRight;

    const rotSpeed = 0.006;
    const deltaRotationQuaternion = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(
            deltaMove.y * rotSpeed,
            deltaMove.x * rotSpeed,
            0,
            'XYZ'
        ));

    ws.crystalMasterGroup.quaternion.premultiply(deltaRotationQuaternion);

    const euler = new THREE.Euler().setFromQuaternion(ws.crystalMasterGroup.quaternion);
    document.getElementById(`rotX_${ws.id}`).value = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
    document.getElementById(`rotY_${ws.id}`).value = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
    document.getElementById(`rotZ_${ws.id}`).value = THREE.MathUtils.radToDeg(euler.z).toFixed(1);

    ws.updateCSGPlanes();

    if (ws.id === '2') {
        baseDockQuaternion.copy(ws.crystalMasterGroup.quaternion);
        document.getElementById('epiTwist').value = 0;
        document.getElementById('twistLabel').innerText = `Twist φ (0.0°):`;
    }

    // Live update Matching Degree during 3D manual spin!
    if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();

    previousMousePosition = { x: e.offsetX, y: e.offsetY };
});

window.addEventListener('pointerup', () => { isDragging = false; });

// --- WORKSPACE MODE SWITCHER ---
let currentMode = 'single';
document.getElementById('workspaceMode').addEventListener('change', (e) => {
    currentMode = e.target.value;

    splitDivider.style.display = currentMode === 'dual' ? 'block' : 'none';
    workspaceRight.eventZone.style.display = currentMode === 'dual' ? 'block' : 'none';

    if (currentMode === 'single') {
        workspaceRight.uiWrapper.style.display = 'none';
        workspaceRight.hudLegend.style.display = 'none';
        epitaxyWrapper.style.display = 'none';
    } else if (currentMode === 'dual') {
        workspaceRight.uiWrapper.style.display = 'block';
        workspaceRight.hudLegend.style.display = 'flex';
        epitaxyWrapper.style.display = 'none';
        workspaceRight.retractor.show();
    } else if (currentMode === 'interface') {
        workspaceRight.uiWrapper.style.display = 'block';
        workspaceRight.hudLegend.style.display = 'flex';
        epitaxyWrapper.style.display = 'block';
        epitaxyRetractor.show();
        workspaceRight.retractor.show();
        workspaceLeft.retractor.show();
    }

    if (currentMode === 'interface') {
        workspaceRight.scene.remove(workspaceRight.crystalMasterGroup);
        workspaceLeft.scene.add(workspaceRight.crystalMasterGroup);

        document.getElementById('posX_2').disabled = true;
        document.getElementById('posY_2').disabled = true;
        document.getElementById('posZ_2').disabled = true;

        dockCrystalsFaceToFace();
    } else {
        workspaceLeft.scene.remove(workspaceRight.crystalMasterGroup);
        workspaceRight.scene.add(workspaceRight.crystalMasterGroup);

        document.getElementById('posX_2').disabled = false;
        document.getElementById('posY_2').disabled = false;
        document.getElementById('posZ_2').disabled = false;

        document.getElementById('posX_2').value = 0;
        workspaceRight.crystalMasterGroup.position.set(0, 0, 0);
        workspaceRight.updateCSGPlanes();
    }
    triggerResize();
});

function triggerResize() {
    const w = window.innerWidth;
    const h = window.innerHeight - 50;
    renderer.setSize(w, h);

    if (currentMode === 'single' || currentMode === 'interface') {
        workspaceLeft.eventZone.style.width = '100%';
        const aspect = w / h;
        workspaceLeft.perspCamera.aspect = aspect;
        workspaceLeft.perspCamera.updateProjectionMatrix();
        workspaceLeft.orthoCamera.left = -frustumSize * aspect / 2;
        workspaceLeft.orthoCamera.right = frustumSize * aspect / 2;
        workspaceLeft.orthoCamera.top = frustumSize / 2;
        workspaceLeft.orthoCamera.bottom = -frustumSize / 2;
        workspaceLeft.orthoCamera.updateProjectionMatrix();
        workspaceLeft.controls.handleResize();
    } else {
        workspaceLeft.eventZone.style.width = '50%';
        const aspect = (w / 2) / h;
        [workspaceLeft, workspaceRight].forEach(ws => {
            ws.perspCamera.aspect = aspect;
            ws.perspCamera.updateProjectionMatrix();
            ws.orthoCamera.left = -frustumSize * aspect / 2;
            ws.orthoCamera.right = frustumSize * aspect / 2;
            ws.orthoCamera.top = frustumSize / 2;
            ws.orthoCamera.bottom = -frustumSize / 2;
            ws.orthoCamera.updateProjectionMatrix();
            ws.controls.handleResize();
        });
    }
}
window.addEventListener('resize', triggerResize);

function animate() {
    requestAnimationFrame(animate);
    const h = window.innerHeight - 50;

    if (currentMode === 'single' || currentMode === 'interface') {
        workspaceLeft.controls.update();
        renderer.setViewport(0, 0, window.innerWidth, h);
        renderer.setScissor(0, 0, window.innerWidth, h);
        renderer.render(workspaceLeft.scene, workspaceLeft.activeCamera);
    } else {
        workspaceLeft.controls.update();
        renderer.setViewport(0, 0, window.innerWidth / 2, h);
        renderer.setScissor(0, 0, window.innerWidth / 2, h);
        renderer.render(workspaceLeft.scene, workspaceLeft.activeCamera);

        workspaceRight.controls.update();
        renderer.setViewport(window.innerWidth / 2, 0, window.innerWidth / 2, h);
        renderer.setScissor(window.innerWidth / 2, 0, window.innerWidth / 2, h);
        renderer.render(workspaceRight.scene, workspaceRight.activeCamera);
    }
}

workspaceRight.eventZone.style.display = 'none';
workspaceRight.uiWrapper.style.display = 'none';
workspaceRight.hudLegend.style.display = 'none';
triggerResize();
animate();