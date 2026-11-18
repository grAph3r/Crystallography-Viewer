import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import * as Cryst from './crystallography.js';

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.backgroundColor = "#222222";

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
    contentPanel.addEventListener('pointerdown', () => clearTimeout(timeoutId));
    contentPanel.addEventListener('input', () => clearTimeout(timeoutId));
    contentPanel.addEventListener('change', () => clearTimeout(timeoutId));
    contentPanel.addEventListener('mouseleave', () => {
        if (isOpen) startAutoHideTimer();
    });

    show();
    startAutoHideTimer();
    return { show, immediateHide };
}

function buildEpitaxyCrystalCard({ prefix, title, roleColor, badgeBg, badgeBorder, dirColor, dirTColor, h, k, i, l, u, v, t, w }) {
    return `
        <div style="background:#222; padding:7px 8px; border-radius:5px; flex:1; border:1px solid #555;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
                <b id="${prefix}_title" style="color:${roleColor}; font-size:11.5px;">${title}</b>
                <div style="display:flex; align-items:center; gap:4px;">
                    <span id="${prefix}_sysBadge" style="font-size:9px; background:${badgeBg}; color:${roleColor}; border:1px solid ${badgeBorder}; padding:1px 4px; border-radius:3px;">3-Index</span>
                    <span id="${prefix}_zoneStatus" style="font-size:10px; color:#66ff99;">hu+kv+lw=0 ✓</span>
                </div>
            </div>
            <div style="display:flex; gap:3px; margin-top:5px; align-items:center; font-size:11px;">
                <span id="${prefix}_planeLabel" style="color:#aaa; width:40px;">(hkl):</span>
                h:<input type="number" id="${prefix}_h" value="${h}" style="width:28px; background:#444; color:white; border:none; text-align:center;">
                k:<input type="number" id="${prefix}_k" value="${k}" style="width:28px; background:#444; color:white; border:none; text-align:center;">
                <span id="${prefix}_i_wrap" style="display:none; align-items:center; gap:2px;" title="4th Miller-Bravais plane index i = -(h + k)">i:<input type="number" id="${prefix}_i" value="${i}" readonly style="width:28px; background:#2c2c2c; color:#aaa; border:1px solid #555; text-align:center;"></span>
                l:<input type="number" id="${prefix}_l" value="${l}" style="width:28px; background:#444; color:white; border:none; text-align:center;">
                <select id="${prefix}_dirSelect" title="Valid in-plane crystallographic directions satisfying Weiss Zone Law" style="flex:1; background:#333; color:${roleColor}; border:1px solid #666; font-size:11px; padding:2px; border-radius:3px; min-width:95px;"></select>
            </div>
            <div style="display:flex; gap:3px; margin-top:4px; align-items:center; font-size:11px;">
                <span id="${prefix}_dirLabel" style="color:#aaa; width:40px;">[uvw]:</span>
                u:<input type="number" id="${prefix}_u" value="${u}" style="width:28px; background:#383838; color:${roleColor}; border:1px solid #555; text-align:center;">
                v:<input type="number" id="${prefix}_v" value="${v}" style="width:28px; background:#383838; color:${roleColor}; border:1px solid #555; text-align:center;">
                <span id="${prefix}_t_wrap" style="display:none; align-items:center; gap:2px;" title="4th Miller-Bravais direction index t = -(u + v)">t:<input type="number" id="${prefix}_t" value="${t}" readonly style="width:28px; background:#262626; color:${dirTColor}; border:1px solid #555; text-align:center;"></span>
                w:<input type="number" id="${prefix}_w" value="${w}" style="width:28px; background:#383838; color:${roleColor}; border:1px solid #555; text-align:center;">
                <span style="font-size:10px; color:#bbb; margin-left:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" id="${prefix}_d">d: -- Å | L∥: -- Å | L⊥: -- Å</span>
            </div>
        </div>
    `;
}

// --- EPITAXY BUILDER UI PANEL ---
const epitaxyWrapper = document.createElement('div');
epitaxyWrapper.style.cssText = `
    position: absolute; bottom: 0px; left: 50%; z-index: 2100; display: none;
`;
const epitaxyPanel = document.createElement('div');
epitaxyPanel.style.cssText = `
    width: 740px; background: rgba(20, 25, 30, 0.96); border: 2px solid #4a6b8c; border-bottom: none;
    color: white; font-family: sans-serif; padding: 12px 14px; border-radius: 8px 8px 0 0;
    box-shadow: 0px -10px 30px rgba(0,0,0,0.8); transition: opacity 0.3s ease;
`;
epitaxyPanel.innerHTML = `
    <h3 style="margin:0 0 8px 0; color:#66ccff; text-align:center; border-bottom:1px solid #444; padding-bottom:5px; font-size:14px;">
        Epitaxy & Interface Matcher — (hkl/hkil)₁∥(hkl/hkil)₂ & [uvw/uvtw]₁∥[uvw/uvtw]₂ Domain Matching + Atom Links
    </h3>
    
    <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:8px;">
        ${buildEpitaxyCrystalCard({ prefix: 'ep1', title: 'Primary (h₁ k₁ l₁) & [u₁ v₁ w₁]', roleColor: '#ffcc66', badgeBg: '#3a2e18', badgeBorder: '#775c28', dirTColor: '#cfa855', h: 0, k: 0, i: 0, l: 1, u: 1, v: 0, t: -1, w: 0 })}
        ${buildEpitaxyCrystalCard({ prefix: 'ep2', title: 'Secondary (h₂ k₂ l₂) & [u₂ v₂ w₂]', roleColor: '#66ccff', badgeBg: '#182e3a', badgeBorder: '#285c77', dirTColor: '#55a8cf', h: 1, k: 1, i: -2, l: 0, u: 0, v: 0, t: 0, w: 1 })}
    </div>

    <div style="background:#111; border:1px solid #333; padding:7px 8px; text-align:center; border-radius:5px; margin-bottom:8px;">
        <div style="display:flex; justify-content:center; align-items:center; gap:12px; flex-wrap:wrap;">
            <span style="font-size:12px; color:#ccc;" id="epiMatchText">2D Domain Mis-fit (F₀): --%</span>
            <span style="color:#444;">|</span>
            <span style="font-size:12px; color:#ffcc66;" id="epiAngleText">[uvw]₁ ∠ [uvw]₂ (α): 0.0°</span>
            <span style="color:#444;">|</span>
            <span style="font-size:15px; font-weight:bold; color:#00ff00;" id="epiScoreText">Matching Degree: --%</span>
        </div>
        <div style="font-size:11px; color:#999; margin-top:3px;" id="epiSupercellText">Domain Coincidence: n∥×L₁∥ ≈ m∥×L₂∥ & n⊥×L₁⊥ ≈ m⊥×L₂⊥</div>
        <div style="font-size:10.5px; color:#99ccee; margin-top:5px; padding-top:4px; border-top:1px dashed #333; line-height:1.4; text-align:left;" id="epiRelaxationText">
            <b style="color:#ffcc66;">⚠ Rigid-Lattice Model Notice:</b> 3D/2D views match two unrelaxed rigid lattices. In real oxide interfaces (Trolliard et al., 2006), misfit is overcome by periodic <i>n:m</i> geometrical dislocations + local elastic strain &amp; ionocovalent bond relaxation.
        </div>
    </div>

    <div style="background:#19232d; border:1px solid #365069; padding:6px 8px; border-radius:5px; margin-bottom:8px; font-size:11px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <label style="cursor:pointer; font-weight:bold; color:#77ddff; display:flex; align-items:center; gap:4px;">
                <input type="checkbox" id="showEpiLines" checked> 🔗 Show Atom-to-Atom Matching Lines
            </label>
            <div style="display:flex; align-items:center; gap:5px;">
                <span style="color:#aaa;">Pairing:</span>
                <select id="epiPairMode" style="background:#222; color:white; border:1px solid #555; padding:2px 4px; border-radius:3px; font-size:11px;">
                    <option value="cation_cation" selected>Cations Only: Al³⁺ ↔ Zr⁴⁺ Structural Walls (Trolliard Fig. 3)</option>
                    <option value="same">Same-Polarity Sublattice (Cation↔Cation &amp; O²⁻↔O²⁻)</option>
                    <option value="cation_anion">Polyhedral Bonds: Cation ↔ O²⁻ Anion (Trolliard Fig. 6/7)</option>
                    <option value="all">All Nearest Interfacial Atoms (Include O²⁻)</option>
                </select>
            </div>
            <label style="cursor:pointer; color:#ddd; display:flex; align-items:center; gap:4px;" title="Show lateral offset Δr_xy and 3D distance in Å on each connecting line">
                <input type="checkbox" id="showEpiDistLabels"> Show Δr_xy (Å) Labels
            </label>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px; gap:10px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:180px;">
                <span style="color:#00ff44; font-size:10px; font-weight:bold;">0.0 Å (Coherent)</span>
                <div style="flex:1; height:6px; border-radius:3px; background:linear-gradient(90deg, #00ff44, #ffee00 50%, #ff2222); border:1px solid #000;"></div>
                <span style="color:#ff4444; font-size:10px; font-weight:bold;">≥2.0 Å (Mismatched)</span>
            </div>
            <span id="epiAtomStatsText" style="color:#aaddff; font-size:11px; font-weight:bold; white-space:nowrap;">
                Linked Pairs: -- | Mean ⟨Δr_xy⟩: -- Å
            </span>
            <span id="epiEnergyText" style="color:#66ffaa; font-size:11px; font-weight:bold; white-space:nowrap; background:#10281e; border:1px solid #28664b; padding:1px 6px; border-radius:3px;" title="Cationic Structural Wall Alignment &amp; 2D Coincidence Score (Trolliard et al., 2006)">
                Wall Lock: --% | P₁ Walls: --
            </span>
        </div>
    </div>

    <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
        <button id="btnCalcMatch" style="flex:1; padding:6px; background:#4a6b8c; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11.5px;">1. Calculate Match</button>
        <button id="btnDockCrystal" style="flex:1; padding:6px; background:#bba53d; color:black; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11.5px;" title="Align (h₁k₁l₁)∥(h₂k₂l₂) and [u₁v₁w₁]∥[u₂v₂w₂]">2. Dock (hkl) & [uvw]</button>
        <button id="btnAutoTwist" style="flex:1.15; padding:6px; background:#2e8b57; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11.5px;" title="Automatically search in-plane [uvw] pairs and Twist φ for highest matching degree">3. Auto-Optimize [uvw] & φ</button>
        <button id="btnAutoSlide" style="flex:1.2; padding:6px; background:#8b4789; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11.5px;" title="Slide Secondary 2D sheet (Δx, Δy) to lock into the lowest interfacial energy / highest atomic coincidence state (Trolliard et al.)">4. Auto-Slide Sheet (Min E)</button>
        <button id="btnToggle2DMap" style="padding:6px 10px; background:#1b6ca8; color:#fff; border:1px solid #44bbff; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11.5px;" title="Open/Close Interactive 2D Trolliard Interface Projection & Sheet-Sliding View">🗺️ 2D View</button>
    </div>

    <div style="border-top:1px solid #444; padding-top:6px; font-size:12px; text-align:center;">
        <div style="display:flex; justify-content:center; gap:14px; padding:4px; background:#222; border-radius:4px; border:1px solid #555; margin-bottom:6px; flex-wrap:wrap;">
            <span style="color:#ddd;">3D Mouse Mode:</span>
            <label style="cursor:pointer; font-weight:bold; color:#aaa;"><input type="radio" name="dragAction" value="camera" checked> Orbit Camera</label>
            <label style="cursor:pointer; font-weight:bold; color:#ffcc66;"><input type="radio" name="dragAction" value="primary"> Spin Primary</label>
            <label style="cursor:pointer; font-weight:bold; color:#66ccff;"><input type="radio" name="dragAction" value="secondary"> Spin Secondary</label>
            <label style="cursor:pointer; font-weight:bold; color:#da70d6;" title="Drag directly in 3D viewport to slide Secondary sheet (Δx, Δy) in-plane like two sheets of paper"><input type="radio" name="dragAction" value="slide_sheet"> Slide 2D Sheet (Δx,Δy)</label>
        </div>
    </div>

    <div style="font-size:12px; display:grid; grid-template-columns: 1fr 1fr; gap:6px 10px;">
        <div style="display:flex; align-items:center; gap:4px;">
            <span style="width:112px; white-space:nowrap;" id="slideXLabel" title="In-plane rigid-body shift Δx along Primary [uvw]₁ (Å)">Slide X∥ (0.00Å):</span>
            <input type="range" id="epiTransX" min="-10" max="10" step="0.02" value="0" style="width:100%">
            <button id="btnResetSlideX" style="background:#333; color:#ccc; border:1px solid #555; border-radius:3px; font-size:10px; padding:1px 4px; cursor:pointer;" title="Reset Δx to 0">0</button>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
            <span style="width:112px; white-space:nowrap;" id="slideYLabel" title="In-plane rigid-body shift Δy orthogonal to Primary [uvw]₁ (Å)">Slide Y⊥ (0.00Å):</span>
            <input type="range" id="epiTransY" min="-10" max="10" step="0.02" value="0" style="width:100%">
            <button id="btnResetSlideY" style="background:#333; color:#ccc; border:1px solid #555; border-radius:3px; font-size:10px; padding:1px 4px; cursor:pointer;" title="Reset Δy to 0">0</button>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
            <span style="width:112px; white-space:nowrap;" id="gapLabel">Face Gap (3.2Å):</span>
            <input type="range" id="epiGap" min="0" max="25" step="0.1" value="3.2" style="width:100%">
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
            <span style="width:112px; white-space:nowrap;" id="twistLabel" title="Rotate Secondary Crystal in-plane around plane normal">Twist φ (0.0°):</span>
            <input type="range" id="epiTwist" min="-180" max="180" step="0.2" value="0" style="width:100%">
            <button id="btnResetTwist" style="background:#333; color:#ccc; border:1px solid #555; border-radius:3px; font-size:10px; padding:1px 4px; cursor:pointer;" title="Reset Twist φ to 0°">0</button>
        </div>
    </div>
`;
epitaxyWrapper.appendChild(epitaxyPanel);
document.body.appendChild(epitaxyWrapper);
const epitaxyRetractor = makeRetractable(epitaxyWrapper, epitaxyPanel, 'bottom');

const SHARED_SPHERE_GEOM = new THREE.SphereGeometry(1.0, 24, 24);

// Element symbols treated as anions for interfacial pairing (Set lookup instead of per-atom Array.includes).
const ANION_SYMBOLS = new Set(['O', 'F', 'Cl', 'Br', 'I', 'S', 'Se', 'N']);

// Set while applyEpitaxyTransform() runs: it calls calculateEpitaxyMatch() right afterwards, which
// rebuilds the interfacial atom lines anyway, so the rebuild triggered by updateCSGPlanes() is skipped.
let suppressInterfaceLineRefresh = false;

/** Reads the integer-like Miller index inputs `${prefix}_h|k|l` of the Epitaxy panel (non-numeric → 0). */
function readEpitaxyPlane(prefix) {
    return [
        parseFloat(document.getElementById(`${prefix}_h`).value) || 0,
        parseFloat(document.getElementById(`${prefix}_k`).value) || 0,
        parseFloat(document.getElementById(`${prefix}_l`).value) || 0
    ];
}

/** Updates perspective + orthographic camera projections of a workspace for a new viewport aspect. */
function updateWorkspaceCameras(ws, aspect) {
    ws.perspCamera.aspect = aspect;
    ws.perspCamera.updateProjectionMatrix();
    ws.orthoCamera.left = -frustumSize * aspect / 2;
    ws.orthoCamera.right = frustumSize * aspect / 2;
    ws.orthoCamera.top = frustumSize / 2;
    ws.orthoCamera.bottom = -frustumSize / 2;
    ws.orthoCamera.updateProjectionMatrix();
    ws.controls.handleResize();
}

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

function makeAtomLabelMaterial(symbol, hexColor) {
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
    return new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true
    });
}

let nextPlaneUid = 1;

function disposeGroup(group) {
    const disposed = new Set();
    group.traverse(obj => {
        if (obj.geometry && obj.geometry !== SHARED_SPHERE_GEOM && !disposed.has(obj.geometry)) {
            disposed.add(obj.geometry);
            obj.geometry.dispose();
        }
        if (obj.material && !disposed.has(obj.material)) {
            disposed.add(obj.material);
            if (obj.material.map && !disposed.has(obj.material.map)) {
                disposed.add(obj.material.map);
                obj.material.map.dispose();
            }
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

let currentMode = 'single';

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
        // Cache THREE.Vector3 wrappers on the workspace — unitReciprocalMatrix only changes when a crystal is loaded.
        if (!this._cachedRecipVectors) {
            this._cachedRecipVectors = {
                rA: new THREE.Vector3(...this.unitReciprocalMatrix[0]),
                rB: new THREE.Vector3(...this.unitReciprocalMatrix[1]),
                rC: new THREE.Vector3(...this.unitReciprocalMatrix[2])
            };
        }
        return this._cachedRecipVectors;
    }

    formatPlaneLabel(h, k, l) {
        if (this.isHexOrTrigonal) {
            return `(${h} ${k} ${-(h + k)} ${l})`;
        }
        return `(${h} ${k} ${l})`;
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
                    <label style="font-size:11px; color:#ccc; cursor:pointer;" title="Show 3D element symbols directly on rendered atoms">
                        <input type="checkbox" id="showAtomLabels_${this.id}"> 3D Labels
                    </label>
                </div>
                <div id="atomLegendSummary_${this.id}" style="background:#111915; padding:4px 6px; border-radius:4px; border:1px solid #284233; margin-bottom:6px; font-size:11px; color:#b8d4c5; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
                    <span>Rendered: <b>--</b></span>
                    <span>Disappeared: <b>--</b></span>
                </div>
                <div id="atomLegendList_${this.id}" style="display:grid; gap:4px; font-size:12px;">
                    <span style="color:#888; font-size:11px;">Loading atomic species...</span>
                </div>
            </div>

            <div style="font-size: 13px; margin-bottom: 10px; display: grid; gap: 6px;">
                <label><input type="checkbox" id="showCell_${this.id}" checked> Show Unit Cell</label>
                <label><input type="checkbox" id="showAxes_${this.id}" checked> Show Axes</label>
            </div>

            <div style="background:#3a3a3a; padding:8px; border-radius:4px; border: 1px solid #555; margin-bottom:10px; font-size:12px;">
                <div style="margin-bottom:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label style="cursor:pointer; display:flex; align-items:center; gap:4px;">
                            <input type="checkbox" id="enableRenderMode_${this.id}" checked>
                            <b>Rendering Mode:</b>
                        </label>
                        <span id="badgeRenderMode_${this.id}" style="font-size:10px; font-weight:bold; color:#00ff66;">ON</span>
                    </div>
                    <select id="renderMode_${this.id}" style="background:#222; color:white; border:1px solid #555; padding:2px; width:100%; margin-top:3px;">
                        <option value="ball_stick">Ball & Stick</option>
                        <option value="space_fill">Space Filling</option>
                    </select>
                </div>
                <div style="margin-bottom:6px; padding:4px 0; border-top:1px solid #4a4a4a; border-bottom:1px solid #4a4a4a;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label style="cursor:pointer; display:flex; align-items:center; gap:4px;">
                            <input type="checkbox" id="showBonds_${this.id}" checked>
                            <b>Interatomic Bonds:</b>
                        </label>
                        <span id="badgeBonds_${this.id}" style="font-size:10px; font-weight:bold; color:#00ff66;">ON</span>
                    </div>
                </div>
                <div style="display:grid; gap:6px;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="cursor:pointer; display:flex; align-items:center; gap:4px;">
                                <input type="checkbox" id="enableLightInt_${this.id}" checked>
                                <b>Lighting Intensity:</b>
                            </label>
                            <span id="badgeLightInt_${this.id}" style="font-size:10px; font-weight:bold; color:#00ff66;">ON (1.0)</span>
                        </div>
                        <input type="range" id="lightInt_${this.id}" min="0.1" max="3.0" step="0.1" value="1.0" style="width:100%;">
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="cursor:pointer; display:flex; align-items:center; gap:4px;">
                                <input type="checkbox" id="enableAtomRadius_${this.id}" checked>
                                <b>Atomic Radius (Å):</b>
                            </label>
                            <span id="badgeAtomRadius_${this.id}" style="font-size:10px; font-weight:bold; color:#00ff66;">ON (0.35 Å)</span>
                        </div>
                        <input type="range" id="atomRadius_${this.id}" min="0.1" max="1.5" step="0.05" value="0.35" style="width:100%;">
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-top:6px;">
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="cursor:pointer; display:flex; align-items:center; gap:3px;">
                                <input type="checkbox" id="enableAtomOpac_${this.id}" checked>
                                <b>Atom Opac:</b>
                            </label>
                            <span id="badgeAtomOpac_${this.id}" style="font-size:10px; font-weight:bold; color:#00ff66;">ON</span>
                        </div>
                        <input type="range" id="atomOpac_${this.id}" min="0.1" max="1" step="0.1" value="1" style="width:100%;">
                    </div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="cursor:pointer; display:flex; align-items:center; gap:3px;">
                                <input type="checkbox" id="enableBondOpac_${this.id}" checked>
                                <b>Bond Opac:</b>
                            </label>
                            <span id="badgeBondOpac_${this.id}" style="font-size:10px; font-weight:bold; color:#00ff66;">ON</span>
                        </div>
                        <input type="range" id="bondOpac_${this.id}" min="0.1" max="1" step="0.1" value="0.6" style="width:100%;">
                    </div>
                </div>
            </div>

            <div style="font-size: 12px; display: grid; gap: 5px;">
                <label id="presetSelectContainer_${this.id}"><b>Preloaded Database:</b> 
                    <select id="matSelect_${this.id}" style="background:#333; color:white; border:1px solid #555; padding:2px; width:100%;">
                        <option value="alumina" ${defaultMaterial==='alumina'?'selected':''}>α-Alumina</option>
                        <option value="zirconia_m" ${defaultMaterial==='zirconia_m'?'selected':''}>Monoclinic ZrO2</option>
                        <option value="zirconia_t" ${defaultMaterial==='zirconia_t'?'selected':''}>Tetragonal ZrO2</option>
                        <option value="zirconia_c" ${defaultMaterial==='zirconia_c'?'selected':''}>Cubic ZrO2</option>
                        <option value="zirconia_3ytzp" ${defaultMaterial==='zirconia_3ytzp'?'selected':''}>3Y-TZP (3 mol% Y2O3-ZrO2)</option>
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
                            <option id="optDir_${this.id}" value="dir">Dir [uvw]</option>
                            <option id="optPlane_${this.id}" value="plane">Norm (hkl)</option>
                        </select>
                        <input type="number" id="tU_${this.id}" value="0" style="width:30px; background:#222; color:white; border:none; text-align:center;" title="u or h">
                        <input type="number" id="tV_${this.id}" value="0" style="width:30px; background:#222; color:white; border:none; text-align:center;" title="v or k">
                        <input type="number" id="tI_${this.id}" value="0" readonly style="display:none; width:30px; background:#1a1a1a; color:#aaa; border:1px solid #444; text-align:center;" title="4th index i/t = -(u + v)">
                        <input type="number" id="tW_${this.id}" value="1" style="width:30px; background:#222; color:white; border:none; text-align:center;" title="w or l">
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
        const id = `plane_${nextPlaneUid++}`;
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

        this.generatedPlanes.forEach(p => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:#222; padding:3px 5px; margin-bottom:2px; border-radius:3px; font-size:12px;';

            const labelText = this.formatPlaneLabel(p.h, p.k, p.l);

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
                if (typeof populateInPlaneDirections === 'function') populateInPlaneDirections(this.id, true);
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

        this.generatedPlanes.forEach(p => {
            p.mesh = null;
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

            const labelText = this.formatPlaneLabel(p.h, p.k, p.l);
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

        const clipConfigs = [
            ['X', w_pA, nBC, [-1, 0, 0], this.clipX],
            ['Y', w_pB, nCA, [0, -1, 0], this.clipY],
            ['Z', w_pC, nAB, [0, 0, -1], this.clipZ]
        ];
        for (const [axis, wEnd, norm, defaultNorm, plane] of clipConfigs) {
            if (get(`showClip${axis}`).checked) {
                const frac = parseFloat(get(`slider${axis}`).value) / 100;
                const slicePt = new THREE.Vector3().lerpVectors(w_p0, wEnd, frac);
                plane.setFromNormalAndCoplanarPoint(getInwardPlane(wEnd, norm, w_p0).normal, slicePt);
            } else {
                plane.set(new THREE.Vector3(...defaultNorm), Infinity);
            }
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

        this.updateAtomAnnotationState();

        if (!suppressInterfaceLineRefresh && typeof updateInterfacialAtomLines === 'function' && epitaxyWrapper.style.display === 'block') {
            updateInterfacialAtomLines();
        }
    }

    getActiveClipPlanes() {
        const active = [];
        for (let p = 0; p < this.clipPlanes.length; p++) {
            if (this.clipPlanes[p].constant < 1e5) active.push(this.clipPlanes[p]);
        }
        return active;
    }

    setRotationFromQuaternion(quat) {
        const euler = new THREE.Euler().setFromQuaternion(quat);
        document.getElementById(`rotX_${this.id}`).value = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
        document.getElementById(`rotY_${this.id}`).value = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
        document.getElementById(`rotZ_${this.id}`).value = THREE.MathUtils.radToDeg(euler.z).toFixed(1);
    }

    getMagneticVectors() {
        const get = (key) => document.getElementById(`${key}_${this.id}`);
        const bx = parseFloat(get('bX').value) || 0;
        const by = parseFloat(get('bY').value) || 0;
        const bz = parseFloat(get('bZ').value) || 0;
        const bVec = new THREE.Vector3(bx, by, bz);
        if (bVec.lengthSq() === 0) bVec.set(0, 0, 1);
        bVec.normalize();

        const tType = get('targetType').value;
        const u = parseFloat(get('tU').value) || 0;
        const v = parseFloat(get('tV').value) || 0;
        const w = parseFloat(get('tW').value) || 0;
        if (get('tI')) get('tI').value = -(u + v);

        const localVec = new THREE.Vector3();
        const unitRecip = this.getUnitReciprocalVectors();
        if (tType === 'dir') {
            const { u3, v3, w3 } = this.isHexOrTrigonal ? uvtw4ToUvw3(u, v, w) : { u3: u, v3: v, w3: w };
            localVec.addScaledVector(this.latticeVectors.a, u3 / this.supercellFactors.x)
                    .addScaledVector(this.latticeVectors.b, v3 / this.supercellFactors.y)
                    .addScaledVector(this.latticeVectors.c, w3 / this.supercellFactors.z);
        } else if (unitRecip) {
            localVec.addScaledVector(unitRecip.rA, u).addScaledVector(unitRecip.rB, v).addScaledVector(unitRecip.rC, w);
        }
        if (localVec.lengthSq() === 0) localVec.set(0, 0, 1);
        localVec.normalize();

        return { bVec, localVec };
    }

    updateAtomAnnotationState() {
        const get = (key) => document.getElementById(`${key}_${this.id}`);
        if (!get('enableRenderMode')) return;

        const isModeOn = get('enableRenderMode').checked;
        const showLabels = get('showAtomLabels').checked;

        this.crystalMasterGroup.updateMatrixWorld(true);
        this.crystalPivotGroup.updateMatrixWorld(true);

        let totalLoaded = 0;
        let totalRendered = 0;

        // Pre-filter active clipping planes so the per-atom loop only tests planes that actually clip.
        const activePlanes = this.getActiveClipPlanes();
        const activePlaneCount = activePlanes.length;
        const pivotMat = this.crystalPivotGroup.matrixWorld;
        const scratchPos = new THREE.Vector3();

        this.speciesRegistry.forEach((entry) => {
            let renderedCount = 0;
            const meshes = entry.meshes;
            const labels = entry.labels;
            const meshCount = meshes.length;
            for (let i = 0; i < meshCount; i++) {
                const mesh = meshes[i];
                const lbl = labels[i];
                scratchPos.copy(mesh.position).applyMatrix4(pivotMat);

                let isClipped = false;
                for (let p = 0; p < activePlaneCount; p++) {
                    if (activePlanes[p].distanceToPoint(scratchPos) < -1e-4) {
                        isClipped = true;
                        break;
                    }
                }

                const isAtomRendered = isModeOn && entry.visible && !isClipped;
                mesh.visible = isAtomRendered;
                if (lbl) lbl.visible = isAtomRendered && showLabels;
                if (isAtomRendered) renderedCount++;
            }
            entry.renderedCount = renderedCount;
            entry.hiddenCount = entry.count - renderedCount;
            totalLoaded += entry.count;
            totalRendered += renderedCount;
        });

        this.totalAtomCount = totalLoaded;
        this.renderedAtomCount = totalRendered;
        this.disappearedAtomCount = totalLoaded - totalRendered;

        this.atomLabelGroup.visible = showLabels && isModeOn;

        // Filter bonds so only bonds between two currently rendered atoms are shown
        if (this.bondPairs && this.bondLineSegments) {
            const activePoints = [];
            for (const pair of this.bondPairs) {
                if (pair.meshA.visible && pair.meshB.visible) {
                    activePoints.push(pair.posA, pair.posB);
                }
            }
            this.bondLineSegments.geometry.dispose();
            this.bondLineSegments.geometry = new THREE.BufferGeometry().setFromPoints(activePoints);
        }

        this.updateAtomLegendCountsUI();
    }

    updateAtomLegendCountsUI() {
        const summaryEl = document.getElementById(`atomLegendSummary_${this.id}`);
        if (this.speciesRegistry.size === 0) {
            if (summaryEl) {
                summaryEl.innerHTML = `<span>Rendered: <b>0</b></span><span>Disappeared: <b>0</b></span>`;
            }
            return;
        }

        const totalLoaded = this.totalAtomCount ?? 0;
        const totalRendered = this.renderedAtomCount ?? 0;
        const totalHidden = this.disappearedAtomCount ?? 0;

        if (summaryEl) {
            let filterBadge = '';
            if (this.isolatedPlaneData) {
                const p = this.isolatedPlaneData;
                const stoichParts = [];
                this.speciesRegistry.forEach((entry) => {
                    if (entry.renderedCount > 0) {
                        stoichParts.push(`<b style="color:${entry.color};">${entry.symbol}</b>:${entry.renderedCount}`);
                    }
                });
                filterBadge = `
                    <div style="width:100%; border-top:1px solid #284233; padding-top:3px; margin-top:2px; display:flex; justify-content:space-between; align-items:center; font-size:10px;">
                        <span style="color:#00ff88; font-weight:bold;">🎯 ISO (${p.h} ${p.k} ${p.l}) Plane</span>
                        <span style="color:#ddd;">In-Plane: ${stoichParts.length > 0 ? stoichParts.join(' · ') : '0 atoms'}</span>
                    </div>
                `;
            }
            summaryEl.innerHTML = `
                <span>Rendered: <b style="color:${totalRendered > 0 ? '#66ffaa' : '#ff6666'};">${totalRendered} / ${totalLoaded}</b></span>
                <span>Disappeared: <b style="color:${totalHidden > 0 ? '#ffaa55' : '#888'};">${totalHidden}</b></span>
                ${filterBadge}
            `;
        }

        const sideTitle = this.side === 'left' ? 'Primary' : 'Secondary';
        const sideColor = this.side === 'left' ? '#ffcc66' : '#66ccff';
        const hudHeader = totalHidden > 0
            ? `<b style="color:${sideColor};">${sideTitle} <span style="font-size:10px; color:#66ffaa;">(${totalRendered}/${totalLoaded} rendered, <span style="color:#ffaa55;">-${totalHidden} hidden</span>)</span>:</b>`
            : `<b style="color:${sideColor};">${sideTitle} <span style="font-size:10px; color:#88ffbb;">(${totalRendered} atoms)</span>:</b>`;
        const hudItems = [hudHeader];

        this.speciesRegistry.forEach((entry, rawSpecies) => {
            const rendered = entry.renderedCount ?? entry.count;
            const hidden = entry.hiddenCount ?? 0;
            const cntBadge = document.getElementById(`sp_cnt_${this.id}_${rawSpecies}`);
            const rowEl = document.getElementById(`sp_row_${this.id}_${rawSpecies}`);

            if (cntBadge) {
                if (rendered === entry.count) {
                    cntBadge.innerText = `×${entry.count}`;
                    cntBadge.style.background = '#26382e';
                    cntBadge.style.color = '#88ffbb';
                    cntBadge.title = `All ${entry.count} ${entry.symbol} atoms rendered`;
                } else if (rendered > 0) {
                    cntBadge.innerText = `${rendered}/${entry.count} (-${hidden})`;
                    cntBadge.style.background = '#382e1e';
                    cntBadge.style.color = '#ffcc66';
                    cntBadge.title = `${rendered} rendered on screen, ${hidden} disappeared`;
                } else {
                    cntBadge.innerText = `0/${entry.count} (Hidden)`;
                    cntBadge.style.background = '#3a1d1d';
                    cntBadge.style.color = '#ff7777';
                    cntBadge.title = `All ${entry.count} ${entry.symbol} atoms disappeared from screen`;
                }
            }
            if (rowEl) {
                rowEl.style.opacity = rendered === 0 ? '0.5' : '1.0';
            }

            const hudCountText = hidden > 0
                ? `<span style="color:${rendered > 0 ? '#ffcc66' : '#ff7777'}; font-size:10px;">${rendered}/${entry.count}</span>`
                : `<span style="color:#88ffbb; font-size:10px;">×${entry.count}</span>`;

            hudItems.push(`
                <span style="display:inline-flex; align-items:center; gap:5px; background:rgba(255,255,255,0.06); padding:2px 7px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); opacity:${rendered === 0 ? '0.4' : '1.0'};">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:radial-gradient(circle at 30% 30%, #fff, ${entry.color} 60%, #111);"></span>
                    <b>${entry.symbol}</b> <span style="color:#ccc; font-size:11px;">(${entry.name})</span>
                    ${hudCountText}
                </span>
            `);
        });

        this.hudLegend.innerHTML = hudItems.join('');
    }

    updateMagneticAnalytics(applyEulerInputs = true) {
        if (!this.latticeVectors.a) return;
        const get = (key) => document.getElementById(`${key}_${this.id}`);

        if (!get('posX').disabled) {
            const tx = parseFloat(get('posX').value) || 0;
            const ty = parseFloat(get('posY').value) || 0;
            const tz = parseFloat(get('posZ').value) || 0;
            this.crystalMasterGroup.position.set(tx, ty, tz);
        }

        const { bVec, localVec } = this.getMagneticVectors();

        if (this.bFieldArrow) {
            this.bFieldArrow.setDirection(bVec);
            this.bFieldArrow.position.copy(this.crystalMasterGroup.position);
        }
        if (this.bFieldLabel) {
            this.bFieldLabel.position.copy(this.crystalMasterGroup.position).add(bVec.clone().multiplyScalar(17));
        }

        if (applyEulerInputs) {
            const rx = parseFloat(get('rotX').value) || 0;
            const ry = parseFloat(get('rotY').value) || 0;
            const rz = parseFloat(get('rotZ').value) || 0;
            this.crystalMasterGroup.rotation.set(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), THREE.MathUtils.degToRad(rz));
        }

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
            this.updateAtomLegendCountsUI();
            return;
        }

        listEl.innerHTML = '';

        this.speciesRegistry.forEach((entry, rawSpecies) => {
            const row = document.createElement('div');
            row.id = `sp_row_${this.id}_${rawSpecies}`;
            row.style.cssText = `
                display:flex; align-items:center; justify-content:space-between;
                background:#141c18; padding:4px 6px; border-radius:4px; border:1px solid #2d4537;
                transition: opacity 0.15s ease;
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
                    <span id="sp_cnt_${this.id}_${rawSpecies}" style="background:#26382e; color:#88ffbb; padding:1px 5px; border-radius:10px; font-size:10px; font-weight:bold;">
                        ×${entry.count}
                    </span>
                    <input type="checkbox" data-sp="${rawSpecies}" class="sp-vis-toggle" ${entry.visible ? 'checked' : ''}
                        title="Show/Hide ${entry.symbol} atoms" style="cursor:pointer; margin:0;">
                </div>
            `;
            listEl.appendChild(row);
        });

        this.updateAtomLegendCountsUI();

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

                if (entry.labelMaterial) {
                    if (entry.labelMaterial.map) entry.labelMaterial.map.dispose();
                    entry.labelMaterial.dispose();
                    entry.labelMaterial = makeAtomLabelMaterial(entry.symbol, newHex);
                    entry.labels.forEach(lbl => { lbl.material = entry.labelMaterial; });
                }

                const dot = document.getElementById(`sp_dot_${this.id}_${sp}`);
                if (dot) {
                    dot.style.background = `radial-gradient(circle at 32% 32%, #ffffff, ${newHex} 55%, #111111)`;
                }
                this.updateAtomLegendCountsUI();
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
                this.updateAtomAnnotationState();
                if (typeof updateInterfacialAtomLines === 'function') updateInterfacialAtomLines();
            });
        });
    }

    attachEvents() {
        const get = (key) => document.getElementById(`${key}_${this.id}`);

        get('fileCif').addEventListener('change', async (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.currentUploadedFile = e.target.files[0];
                const chosenName = this.currentUploadedFile.name;
                e.target.value = ''; // Allow re-selecting the exact same file if needed
                get('fileName').innerText = `⏳ Loading ${chosenName}...`;
                get('fileName').style.color = '#ffcc66';
                await this.loadCrystal();
            }
        });

        get('btnClearCif').addEventListener('click', async () => {
            this.currentUploadedFile = null;
            get('fileCif').value = '';
            get('fileName').innerText = 'No custom CIF loaded';
            get('fileName').style.color = '#aaa';
            await this.loadCrystal();
        });

        get('showAtomLabels').addEventListener('change', () => {
            this.updateAtomAnnotationState();
        });

        get('showCell').addEventListener('change', (e) => this.cellGroup.visible = e.target.checked);
        get('showAxes').addEventListener('change', (e) => this.customAxes.visible = e.target.checked);

        const setBadge = (badgeId, isOn, extraText = '') => {
            const el = get(badgeId);
            if (!el) return;
            el.innerText = isOn ? (extraText ? `ON (${extraText})` : 'ON') : 'OFF';
            el.style.color = isOn ? '#00ff66' : '#ff5555';
        };

        const setControlEnabled = (key, isOn) => {
            const el = get(key);
            el.disabled = !isOn;
            el.style.opacity = isOn ? '1' : '0.45';
        };

        const updateBondsState = () => {
            const isBondsOn = get('showBonds').checked;
            setBadge('badgeBonds', isBondsOn);
            this.bondGroup.visible = isBondsOn;
        };

        const updateRenderingState = () => {
            const isModeOn = get('enableRenderMode').checked;
            setControlEnabled('renderMode', isModeOn);
            setBadge('badgeRenderMode', isModeOn);
            this.atomGroup.visible = isModeOn;

            const isRadiusOn = get('enableAtomRadius').checked;
            setControlEnabled('atomRadius', isRadiusOn);
            const baseRad = isRadiusOn ? parseFloat(get('atomRadius').value) : 0.35;
            setBadge('badgeAtomRadius', isRadiusOn, `${baseRad.toFixed(2)} Å`);

            const isSpaceFill = isModeOn && get('renderMode').value === 'space_fill';
            const mult = isSpaceFill ? 3.5 : 1.0;
            this.atomGroup.children.forEach(mesh => mesh.scale.setScalar(baseRad * mult));
            updateBondsState();
            this.updateAtomAnnotationState();

            if (typeof updateInterfacialAtomLines === 'function' && epitaxyWrapper.style.display === 'block') {
                updateInterfacialAtomLines();
            }
        };

        const updateLightingState = () => {
            const isLightOn = get('enableLightInt').checked;
            setControlEnabled('lightInt', isLightOn);
            const val = parseFloat(get('lightInt').value);
            setBadge('badgeLightInt', isLightOn, val.toFixed(1));
            this.dirLight.visible = isLightOn;
            this.dirLight.intensity = isLightOn ? val : 0;
            this.ambientLight.intensity = isLightOn ? (val * 0.6) : 0.35;
        };

        const syncOpacityControl = (enableKey, sliderKey, badgeKey, applyFn) => {
            const isOn = get(enableKey).checked;
            setControlEnabled(sliderKey, isOn);
            const val = isOn ? parseFloat(get(sliderKey).value) : 1.0;
            setBadge(badgeKey, isOn, val.toFixed(1));
            applyFn(val);
        };

        const updateAtomOpacState = () => syncOpacityControl('enableAtomOpac', 'atomOpac', 'badgeAtomOpac', val => {
            this.atomMaterials.forEach(m => { m.opacity = val; });
        });
        const updateBondOpacState = () => syncOpacityControl('enableBondOpac', 'bondOpac', 'badgeBondOpac', val => {
            if (this.sharedBondMaterial) this.sharedBondMaterial.opacity = val;
        });

        get('enableRenderMode').addEventListener('change', updateRenderingState);
        get('renderMode').addEventListener('change', updateRenderingState);
        get('showBonds').addEventListener('change', updateBondsState);
        get('enableAtomRadius').addEventListener('change', updateRenderingState);
        get('atomRadius').addEventListener('input', updateRenderingState);

        get('enableLightInt').addEventListener('change', updateLightingState);
        get('lightInt').addEventListener('input', updateLightingState);

        get('enableAtomOpac').addEventListener('change', updateAtomOpacState);
        get('atomOpac').addEventListener('input', updateAtomOpacState);

        get('enableBondOpac').addEventListener('change', updateBondOpacState);
        get('bondOpac').addEventListener('input', updateBondOpacState);

        ['posX', 'posY', 'posZ', 'bX', 'bY', 'bZ', 'targetType', 'tU', 'tV', 'tW', 'colorHeatmap'].forEach(id => {
            get(id).addEventListener('input', () => {
                this.updateMagneticAnalytics(false);
                if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();
            });
        });

        ['rotX', 'rotY', 'rotZ'].forEach(id => {
            get(id).addEventListener('input', () => {
                this.updateMagneticAnalytics(true);
                if (this.id === '2') {
                    baseDockQuaternion.copy(this.crystalMasterGroup.quaternion);
                    document.getElementById('epiTwist').value = 0;
                    document.getElementById('twistLabel').innerText = `Twist φ (0.0°):`;
                }
                if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();
            });
        });

        get('btnAlignB').addEventListener('click', () => {
            const { bVec, localVec } = this.getMagneticVectors();
            const quat = new THREE.Quaternion().setFromUnitVectors(localVec, bVec);
            this.crystalMasterGroup.quaternion.copy(quat);
            this.setRotationFromQuaternion(quat);
            if (this.id === '2') {
                baseDockQuaternion.copy(quat);
                document.getElementById('epiTwist').value = 0;
                document.getElementById('twistLabel').innerText = `Twist φ (0.0°):`;
            }
            this.updateMagneticAnalytics(false);
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
            if (typeof populateInPlaneDirections === 'function') populateInPlaneDirections(this.id, true);
            if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();
        });

        get('btnBatchPlanes').addEventListener('click', () => {
            const n = parseInt(get('maxMiller').value) || 1;

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
        this._cachedRecipVectors = null;
        disposeGroup(this.atomGroup);
        disposeGroup(this.atomLabelGroup);
        disposeGroup(this.cellGroup);
        disposeGroup(this.bondGroup);
        disposeGroup(this.customAxes);
        disposeGroup(this.millerPlanesGroup);
        this.atomMaterials.length = 0;
        this.speciesRegistry.clear();
        this.sharedBondMaterial = null;
        this.bondPairs = [];
        this.bondLineSegments = null;
        this.totalAtomCount = 0;
        this.renderedAtomCount = 0;
        this.disappearedAtomCount = 0;
        this.generatedPlanes = [];
        this.isolatedPlaneData = null;
        const list = document.getElementById(`planeList_${this.id}`);
        if (list) list.innerHTML = '';
    }

    async loadCrystal() {
        const reqId = (this._loadRequestId = (this._loadRequestId || 0) + 1);
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

            if (reqId !== this._loadRequestId) return;
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Server returned an error.");
            }
            const data = await response.json();
            if (reqId !== this._loadRequestId) return;

            const m = data.lattice_matrix;
            this.crystalData = data;

            // Unit-cell direct lattice vectors (unscaled by supercell)
            const a0 = m[0].map(val => val / sx);
            const b0 = m[1].map(val => val / sy);
            const c0 = m[2].map(val => val / sz);
            this.unitLatticeMatrix = [a0, b0, c0];

            // Exact crystallographic reciprocal basis: a_i · b_j = δ_ij (NO 2π factor)
            this.unitReciprocalMatrix = Cryst.reciprocalBasis(this.unitLatticeMatrix);

            const p0 = new THREE.Vector3(0, 0, 0);
            const pA = new THREE.Vector3(...m[0]);
            const pB = new THREE.Vector3(...m[1]);
            const pC = new THREE.Vector3(...m[2]);
            this.latticeVectors = { a: pA.clone(), b: pB.clone(), c: pC.clone() };

            // Detect 4-index Miller-Bravais (hkil) / [uvtw] system via crystal system OR hexagonal lattice angles (α=90°, β=90°, γ=120°)
            const cosGamma = pA.clone().normalize().dot(pB.clone().normalize());
            const cosAlpha = pB.clone().normalize().dot(pC.clone().normalize());
            const cosBeta = pA.clone().normalize().dot(pC.clone().normalize());
            const hasHexAngles = Math.abs(cosGamma + 0.5) < 0.03 && Math.abs(cosAlpha) < 0.03 && Math.abs(cosBeta) < 0.03;
            const isHexOrTrigonal = (data.crystal_system === 'trigonal' || data.crystal_system === 'hexagonal' || hasHexAngles);
            this.isHexOrTrigonal = isHexOrTrigonal;

            get('i-container').style.display = isHexOrTrigonal ? 'inline' : 'none';
            get('millerTitle').innerText = isHexOrTrigonal ? 'Miller-Bravais Planes (h, k, i, l):' : 'Miller Planes (h, k, l):';
            if (isHexOrTrigonal) {
                const h = parseFloat(get('mH').value) || 0;
                const k = parseFloat(get('mK').value) || 0;
                get('mI').value = -(h + k);
            }

            if (get('tI')) {
                get('tI').style.display = isHexOrTrigonal ? 'inline-block' : 'none';
                const u = parseFloat(get('tU').value) || 0;
                const v = parseFloat(get('tV').value) || 0;
                get('tI').value = -(u + v);
            }
            if (get('optDir')) get('optDir').innerText = isHexOrTrigonal ? 'Dir [uvtw]' : 'Dir [uvw]';
            if (get('optPlane')) get('optPlane').innerText = isHexOrTrigonal ? 'Norm (hkil)' : 'Norm (hkl)';

            if (typeof syncEpitaxyCoordSystemUI === 'function') {
                syncEpitaxyCoordSystemUI(this.id);
            }

            get('meta-cs').innerText = data.crystal_system;
            get('meta-sg').innerText = data.space_group;

            const boxCenter = new THREE.Vector3().addVectors(pA, pB).add(pC).multiplyScalar(0.5);
            this.crystalPivotGroup.position.copy(boxCenter).negate();

            const isModeOn = get('enableRenderMode').checked;
            const isRadiusOn = get('enableAtomRadius').checked;
            const isAtomOpacOn = get('enableAtomOpac').checked;
            const isBondOpacOn = get('enableBondOpac').checked;

            const baseRad = isRadiusOn ? parseFloat(get('atomRadius').value) : 0.35;
            const isSpaceFill = isModeOn && get('renderMode').value === 'space_fill';
            const scaleMult = isSpaceFill ? 3.5 : 1.0;
            const initialAtomOpac = isAtomOpacOn ? parseFloat(get('atomOpac').value) : 1.0;
            const initialBondOpac = isBondOpacOn ? parseFloat(get('bondOpac').value) : 1.0;

            if (data.atoms && data.atoms.length > 0) {
                const atomPositions = [];
                const atomMeshes = [];
                data.atoms.forEach(atom => {
                    const elemInfo = getElementInfo(atom.species);
                    const colorHex = this.customSpeciesColors[atom.species] || elemInfo.color;

                    if (!this.speciesRegistry.has(atom.species)) {
                        // Share one MeshStandardMaterial and one label SpriteMaterial per species.
                        const mat = new THREE.MeshStandardMaterial({
                            color: new THREE.Color(colorHex), roughness: 0.25, metalness: 0.1,
                            clippingPlanes: this.clipPlanes, transparent: true,
                            opacity: initialAtomOpac
                        });
                        mat.userData.originalColor = new THREE.Color(colorHex);
                        this.atomMaterials.push(mat);

                        const labelMaterial = makeAtomLabelMaterial(elemInfo.symbol, colorHex);
                        this.speciesRegistry.set(atom.species, {
                            symbol: elemInfo.symbol,
                            name: elemInfo.name,
                            color: colorHex,
                            count: 0,
                            renderedCount: 0,
                            hiddenCount: 0,
                            visible: true,
                            materials: [mat],
                            labelMaterial,
                            meshes: [],
                            labels: []
                        });
                    }
                    const spEntry = this.speciesRegistry.get(atom.species);
                    spEntry.count++;
                    spEntry.renderedCount++;

                    const sphere = new THREE.Mesh(SHARED_SPHERE_GEOM, spEntry.materials[0]);
                    sphere.scale.setScalar(baseRad * scaleMult);
                    const pos = new THREE.Vector3(atom.position[0], atom.position[1], atom.position[2]);
                    sphere.position.copy(pos);
                    this.atomGroup.add(sphere);
                    spEntry.meshes.push(sphere);
                    atomPositions.push(pos);
                    atomMeshes.push(sphere);

                    const lblSprite = new THREE.Sprite(spEntry.labelMaterial);
                    lblSprite.scale.set(1.4, 0.7, 1);
                    lblSprite.position.copy(pos);
                    this.atomLabelGroup.add(lblSprite);
                    spEntry.labels.push(lblSprite);
                });

                this.totalAtomCount = atomPositions.length;
                this.renderedAtomCount = atomPositions.length;
                this.disappearedAtomCount = 0;

                this.atomGroup.visible = isModeOn;
                this.atomLabelGroup.visible = get('showAtomLabels').checked;
                this.renderAtomLegendUI();

                const bondPoints = [];
                this.bondPairs = [];
                for (let i = 0; i < atomPositions.length; i++) {
                    for (let j = i + 1; j < atomPositions.length; j++) {
                        if (atomPositions[i].distanceToSquared(atomPositions[j]) < 6.25) {
                            bondPoints.push(atomPositions[i], atomPositions[j]);
                            this.bondPairs.push({
                                meshA: atomMeshes[i],
                                meshB: atomMeshes[j],
                                posA: atomPositions[i],
                                posB: atomPositions[j]
                            });
                        }
                    }
                }
                if (bondPoints.length > 0) {
                    this.sharedBondMaterial = new THREE.LineBasicMaterial({
                        color: 0xffffff, transparent: true,
                        opacity: initialBondOpac,
                        clippingPlanes: this.clipPlanes
                    });
                    const bGeom = new THREE.BufferGeometry().setFromPoints(bondPoints);
                    this.bondLineSegments = new THREE.LineSegments(bGeom, this.sharedBondMaterial);
                    this.bondGroup.add(this.bondLineSegments);
                }
                this.bondGroup.visible = get('showBonds').checked;
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

            const addAxis = (vec, label, hexNum, hexStr) => {
                const ax = new THREE.ArrowHelper(vec.clone().normalize(), p0, vec.length() + 1, hexNum);
                const lbl = makeTextSprite(label, hexStr);
                lbl.position.copy(vec).multiplyScalar(1.05);
                this.customAxes.add(ax, lbl);
            };
            addAxis(pA, "a1", 0xff4444, "#ff4444");
            addAxis(pB, "a2", 0x44ff44, "#44ff44");
            addAxis(pC, "c",  0x4444ff, "#4444ff");
            if (isHexOrTrigonal) {
                addAxis(new THREE.Vector3().addVectors(pA, pB).multiplyScalar(-1), "a3", 0xffff44, "#ffff44");
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

            if (this.currentUploadedFile) {
                get('fileName').innerText = `✓ ${this.currentUploadedFile.name}`;
                get('fileName').style.color = '#66ffaa';
            }

            this.updateMagneticAnalytics(true);
            this.renderPlaneUI();

            this.controls.target.copy(this.crystalMasterGroup.position);
            const diag = new THREE.Vector3().addVectors(pA, pB).add(pC).length();
            const camDistance = Math.max(diag * 0.75, 10);
            this.perspCamera.position.set(this.crystalMasterGroup.position.x + camDistance, this.crystalMasterGroup.position.y + camDistance * 0.7, this.crystalMasterGroup.position.z + camDistance);
            this.orthoCamera.position.copy(this.perspCamera.position);
            this.controls.update();

            try {
                if (typeof populateInPlaneDirections === 'function') {
                    populateInPlaneDirections(this.id, true);
                }

                if (currentMode === 'interface') {
                    if (typeof workspaceLeft !== 'undefined' && typeof workspaceRight !== 'undefined') {
                        workspaceRight.scene.remove(workspaceRight.crystalMasterGroup);
                        workspaceLeft.scene.add(workspaceRight.crystalMasterGroup);
                        if (workspaceLeft.latticeVectors.a && workspaceRight.latticeVectors.a && typeof dockCrystalsFaceToFace === 'function') {
                            dockCrystalsFaceToFace();
                        } else if (typeof calculateEpitaxyMatch === 'function') {
                            calculateEpitaxyMatch();
                        }
                    }
                } else if (epitaxyWrapper.style.display === 'block' && typeof calculateEpitaxyMatch === 'function') {
                    calculateEpitaxyMatch();
                }

                if (typeof triggerResize === 'function') {
                    triggerResize();
                }
            } catch (postLoadErr) {
                console.warn(`Workspace ${this.id} post-load update warning:`, postLoadErr);
            }

        } catch (error) {
            console.warn(`Workspace ${this.id} load error:`, error.message);
            if (this.currentUploadedFile) {
                get('fileName').innerText = `⚠ Failed: ${error.message}`;
                get('fileName').style.color = '#ff6666';
            }
            const metaCs = document.getElementById(`meta-cs_${this.id}`);
            if (metaCs) metaCs.innerText = "Please upload a .cif file";
            this.renderAtomLegendUI();
        }
    }
}

const workspaceLeft = new CrystalWorkspace('1', 'left', 'alumina');
const workspaceRight = new CrystalWorkspace('2', 'right', 'alumina');

// --- 3D INTERFACIAL ATOM-TO-ATOM MATCHING LINES GROUPS ---
const interfaceLinesGroup = new THREE.Group();
const interfaceLabelsGroup = new THREE.Group();
workspaceLeft.scene.add(interfaceLinesGroup, interfaceLabelsGroup);

function makeDistanceLabelSprite(text, hexColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10, 14, 20, 0.82)';
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(8, 8, 176, 48, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'Bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hexColor;
    ctx.fillText(text, 96, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true
    }));
    sprite.scale.set(1.6, 0.55, 1);
    return sprite;
}

// --- 2D ORTHOGONAL DOMAIN MATCHING ([uvw]₁ ∥ [uvw]₂) & ATOM-TO-ATOM EPITAXY ENGINE ---
function getUnitCellLatticeVectors(ws) {
    if (!ws.latticeVectors.a) return null;
    return {
        a0: ws.latticeVectors.a.clone().divideScalar(ws.supercellFactors.x || 1),
        b0: ws.latticeVectors.b.clone().divideScalar(ws.supercellFactors.y || 1),
        c0: ws.latticeVectors.c.clone().divideScalar(ws.supercellFactors.z || 1)
    };
}

function getPlaneVectorAndDSpacing(ws, h, k, l) {
    const unitRecip = ws.getUnitReciprocalVectors();
    if (!unitRecip || (h === 0 && k === 0 && l === 0)) {
        return { normal: new THREE.Vector3(0, 0, 1), d: 0 };
    }
    const { rA, rB, rC } = unitRecip;

    const gVector = new THREE.Vector3()
        .addScaledVector(rA, h)
        .addScaledVector(rB, k)
        .addScaledVector(rC, l);
    const length = gVector.length();
    return {
        normal: gVector.clone().normalize(),
        d: length > 0 ? (1.0 / length) : 0
    };
}

function gcd3(a, b, c) {
    return Cryst.gcdArr([a, b, c]);
}

// Converts 3-index direction [u3 v3 w3] into reduced coprime 4-index Miller-Bravais [U V T W] where T = -(U + V)
function uvw3ToUvtw4(u3, v3, w3) {
    u3 = Math.round(u3) || 0;
    v3 = Math.round(v3) || 0;
    w3 = Math.round(w3) || 0;
    if (u3 === 0 && v3 === 0 && w3 === 0) return { U: 0, V: 0, T: 0, W: 0 };
    const [U, V, T, W] = Cryst.dirUVW_toUVTW_int([u3, v3, w3]);
    return { U, V, T, W };
}

// Converts 4-index Miller-Bravais direction [U V T W] (with T = -(U + V)) into reduced coprime 3-index [u3 v3 w3]
function uvtw4ToUvw3(U, V, W) {
    U = Math.round(U) || 0;
    V = Math.round(V) || 0;
    W = Math.round(W) || 0;
    if (U === 0 && V === 0 && W === 0) return { u3: 0, v3: 0, w3: 0 };
    const T = -(U + V);
    const [u3, v3, w3] = Cryst.dirUVTW_toUVW_int([U, V, T, W]);
    return { u3, v3, w3 };
}

// Synchronizes the Primary (ep1) or Secondary (ep2) Epitaxy UI between 3-Index (hkl)/[uvw] and 4-Index (hkil)/[uvtw]
function syncEpitaxyCoordSystemUI(wsId) {
    const ws = wsId === '1' ? workspaceLeft : workspaceRight;
    const prefix = wsId === '1' ? 'ep1' : 'ep2';
    const sub = wsId === '1' ? '₁' : '₂';
    const roleName = wsId === '1' ? 'Primary' : 'Secondary';
    const isHex = Boolean(ws && ws.isHexOrTrigonal);

    const titleEl = document.getElementById(`${prefix}_title`);
    const badgeEl = document.getElementById(`${prefix}_sysBadge`);
    const planeLbl = document.getElementById(`${prefix}_planeLabel`);
    const dirLbl = document.getElementById(`${prefix}_dirLabel`);
    const iWrap = document.getElementById(`${prefix}_i_wrap`);
    const tWrap = document.getElementById(`${prefix}_t_wrap`);
    const iInput = document.getElementById(`${prefix}_i`);
    const tInput = document.getElementById(`${prefix}_t`);

    if (titleEl) {
        titleEl.innerText = isHex
            ? `${roleName} (h${sub} k${sub} i${sub} l${sub}) & [u${sub} v${sub} t${sub} w${sub}]`
            : `${roleName} (h${sub} k${sub} l${sub}) & [u${sub} v${sub} w${sub}]`;
    }
    if (badgeEl) {
        badgeEl.innerText = isHex ? '4-Index (hkil)/[uvtw]' : '3-Index (hkl)/[uvw]';
        badgeEl.style.background = isHex ? '#1b3b2b' : (wsId === '1' ? '#3a2e18' : '#182e3a');
        badgeEl.style.color = isHex ? '#66ffaa' : (wsId === '1' ? '#ffcc66' : '#66ccff');
        badgeEl.style.borderColor = isHex ? '#2e7d56' : (wsId === '1' ? '#775c28' : '#285c77');
    }
    if (planeLbl) planeLbl.innerText = isHex ? '(hkil):' : '(hkl):';
    if (dirLbl) dirLbl.innerText = isHex ? '[uvtw]:' : '[uvw]:';
    if (iWrap) iWrap.style.display = isHex ? 'inline-flex' : 'none';
    if (tWrap) tWrap.style.display = isHex ? 'inline-flex' : 'none';

    const h = parseFloat(document.getElementById(`${prefix}_h`)?.value) || 0;
    const k = parseFloat(document.getElementById(`${prefix}_k`)?.value) || 0;
    if (iInput) iInput.value = -(h + k);

    const u = parseFloat(document.getElementById(`${prefix}_u`)?.value) || 0;
    const v = parseFloat(document.getElementById(`${prefix}_v`)?.value) || 0;
    if (tInput) tInput.value = -(u + v);
}

// Returns the lattice centring divisor for a conventional 3-index direction [u3 v3 w3]
// (e.g. for rhombohedral R-3c on hexagonal axes, 1/3[u3 v3 w3] is a lattice translation in obverse setting when (-u3+v3+w3) is divisible by 3)
function getCentringRepeatDivisor(ws, u3, v3, w3, strictObverse = false) {
    if (ws && ws.isHexOrTrigonal && String(ws.crystalData?.space_group || '').trim().startsWith('R')) {
        if (strictObverse) {
            if ((((-u3 + v3 + w3) % 3) + 3) % 3 === 0) return 3;
            return 1;
        }
        if (((-u3 + v3 + w3) % 3 === 0) || ((u3 - v3 + w3) % 3 === 0)) {
            return 3;
        }
    }
    return 1;
}

// Enumerates coprime crystallographic directions lying strictly inside (hkl)/(hkil) via Weiss Zone Law
function getValidInPlaneDirections(ws, h, k, l) {
    const unitVecs = getUnitCellLatticeVectors(ws);
    if (!unitVecs || (h === 0 && k === 0 && l === 0)) return [];
    const { a0, b0, c0 } = unitVecs;
    const isRhombohedral = Boolean(ws && ws.isHexOrTrigonal && String(ws.crystalData?.space_group || '').trim().startsWith('R'));
    const dirs = [];

    for (let u = -4; u <= 4; u++) {
        for (let v = -4; v <= 4; v++) {
            for (let w = -4; w <= 4; w++) {
                if (u === 0 && v === 0 && w === 0) continue;
                if (Math.abs(h * u + k * v + l * w) > 1e-5) continue;
                const g = gcd3(u, v, w);
                if (g !== 1) continue;

                // Canonical sign:
                // For rhombohedral crystals in obverse setting (-u + v + w = 3n), prefer w > 0 so Trolliard's [-1 1 0 1]
                // and [-4 4 0 1] are selected rather than their opposites [1 -1 0 -1] or uncentered [1 -1 0 1].
                if (isRhombohedral && (((-u + v + w) % 3) === 0)) {
                    const canonSign = w !== 0 ? w : (u !== 0 ? u : v);
                    if (canonSign < 0) continue;
                } else {
                    const first = u !== 0 ? u : (v !== 0 ? v : w);
                    if (first < 0) continue;
                }

                const vec = new THREE.Vector3()
                    .addScaledVector(a0, u)
                    .addScaledVector(b0, v)
                    .addScaledVector(c0, w);
                const div = getCentringRepeatDivisor(ws, u, v, w, true);
                const period = vec.length() / div;
                if (period < 1e-4) continue;

                const uvtw = uvw3ToUvtw4(u, v, w);
                dirs.push({
                    u, v, w,
                    U: uvtw.U, V: uvtw.V, T: uvtw.T, W: uvtw.W,
                    localDir: vec.clone().normalize(),
                    period
                });
            }
        }
    }
    dirs.sort((a, b) => a.period - b.period);
    return dirs.slice(0, 16);
}

function writeEpitaxyDir(wsId, d) {
    const ws = wsId === '1' ? workspaceLeft : workspaceRight;
    const prefix = wsId === '1' ? 'ep1' : 'ep2';
    if (ws.isHexOrTrigonal) {
        document.getElementById(`${prefix}_u`).value = d.U;
        document.getElementById(`${prefix}_v`).value = d.V;
        document.getElementById(`${prefix}_t`).value = d.T;
        document.getElementById(`${prefix}_w`).value = d.W;
    } else {
        document.getElementById(`${prefix}_u`).value = d.u;
        document.getElementById(`${prefix}_v`).value = d.v;
        document.getElementById(`${prefix}_w`).value = d.w;
    }
}

function populateInPlaneDirections(wsId, preserveManualIfValid = false) {
    const ws = wsId === '1' ? workspaceLeft : workspaceRight;
    const prefix = wsId === '1' ? 'ep1' : 'ep2';
    const isHex = Boolean(ws && ws.isHexOrTrigonal);

    syncEpitaxyCoordSystemUI(wsId);

    const [h, k, l] = readEpitaxyPlane(prefix);
    const i = -(h + k);

    const selectEl = document.getElementById(`${prefix}_dirSelect`);
    if (!selectEl) return;

    const dirs = getValidInPlaneDirections(ws, h, k, l);
    selectEl.innerHTML = '';

    if (dirs.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = isHex ? 'Custom [u v t w]' : 'Custom [u v w]';
        selectEl.appendChild(opt);
        return;
    }

    const curU = parseFloat(document.getElementById(`${prefix}_u`).value) || 0;
    const curV = parseFloat(document.getElementById(`${prefix}_v`).value) || 0;
    const curW = parseFloat(document.getElementById(`${prefix}_w`).value) || 0;
    const curT = -(curU + curV);

    let matchedIdx = -1;
    dirs.forEach((d, idx) => {
        const opt = document.createElement('option');
        if (isHex) {
            opt.value = `${d.U},${d.V},${d.W}`;
            opt.textContent = `[${d.U} ${d.V} ${d.T} ${d.W}] (L=${d.period.toFixed(2)} Å)`;
            if (d.U === curU && d.V === curV && d.W === curW) {
                matchedIdx = idx;
            }
        } else {
            opt.value = `${d.u},${d.v},${d.w}`;
            opt.textContent = `[${d.u} ${d.v} ${d.w}] (L=${d.period.toFixed(2)} Å)`;
            if (d.u === curU && d.v === curV && d.w === curW) {
                matchedIdx = idx;
            }
        }
        selectEl.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = isHex ? 'Custom [u v t w]' : 'Custom [u v w]';
    selectEl.appendChild(customOpt);

    const zoneCheck = isHex
        ? (h * curU + k * curV + i * curT + l * curW)
        : (h * curU + k * curV + l * curW);
    const isCurrentInZone = (curU !== 0 || curV !== 0 || curW !== 0) && Math.abs(zoneCheck) < 1e-4;

    if (preserveManualIfValid && isCurrentInZone) {
        if (matchedIdx >= 0) {
            selectEl.selectedIndex = matchedIdx;
        } else {
            selectEl.value = 'custom';
        }
    } else {
        selectEl.selectedIndex = 0;
        writeEpitaxyDir(wsId, dirs[0]);
    }
}

// Computes the in-plane unit direction t_parallel, its period L_parallel, and orthogonal in-plane direction t_perp & period L_perp
function getDirectionAndOrthogonalInfo(ws, prefix, h, k, l, planeInfo) {
    const unitVecs = getUnitCellLatticeVectors(ws);
    const isHex = Boolean(ws && ws.isHexOrTrigonal);
    const uIn = parseFloat(document.getElementById(`${prefix}_u`).value) || 0;
    const vIn = parseFloat(document.getElementById(`${prefix}_v`).value) || 0;
    const wIn = parseFloat(document.getElementById(`${prefix}_w`).value) || 0;
    const tIn = -(uIn + vIn);
    const iPlane = -(h + k);

    const tInput = document.getElementById(`${prefix}_t`);
    if (tInput) tInput.value = tIn;
    const iInput = document.getElementById(`${prefix}_i`);
    if (iInput) iInput.value = iPlane;

    const statusEl = document.getElementById(`${prefix}_zoneStatus`);

    if (!unitVecs || (uIn === 0 && vIn === 0 && wIn === 0)) {
        if (statusEl) {
            statusEl.innerText = isHex ? 'Invalid [0000]' : 'Invalid [000]';
            statusEl.style.color = '#ff5555';
        }
        return null;
    }

    // Convert 4-index [U V T W] to reduced 3-index [u3 v3 w3] if crystal is hexagonal/trigonal
    let u3 = uIn, v3 = vIn, w3 = wIn;
    if (isHex) {
        const conv = uvtw4ToUvw3(uIn, vIn, wIn);
        u3 = conv.u3;
        v3 = conv.v3;
        w3 = conv.w3;
    }

    const { a0, b0, c0 } = unitVecs;
    const zoneSum = isHex
        ? (h * uIn + k * vIn + iPlane * tIn + l * wIn)
        : (h * uIn + k * vIn + l * wIn);

    const rawVec = new THREE.Vector3()
        .addScaledVector(a0, u3)
        .addScaledVector(b0, v3)
        .addScaledVector(c0, w3);

    // Project onto the (hkl)/(hkil) plane in case the user entered an off-zone direction
    const projVec = rawVec.clone().addScaledVector(planeInfo.normal, -rawVec.dot(planeInfo.normal));
    if (projVec.lengthSq() < 1e-6) {
        const fallback = new THREE.Vector3(1, 0, 0);
        if (Math.abs(planeInfo.normal.dot(fallback)) > 0.9) fallback.set(0, 1, 0);
        projVec.crossVectors(planeInfo.normal, fallback);
    }
    const tParallel = projVec.clone().normalize();
    const divPar = getCentringRepeatDivisor(ws, u3, v3, w3);
    const lParallel = (projVec.length() > 1e-4 ? projVec.length() : rawVec.length()) / divPar;

    if (statusEl) {
        const formulaText = isHex ? 'hu+kv+it+lw' : 'hu+kv+lw';
        if (Math.abs(zoneSum) < 1e-4) {
            statusEl.innerText = `${formulaText}=0 ✓`;
            statusEl.style.color = '#66ff99';
        } else {
            statusEl.innerText = `${formulaText}=${zoneSum} (Proj)`;
            statusEl.style.color = '#ffcc44';
        }
    }

    // Orthogonal in-plane unit vector: t_perp = normal x t_parallel
    const tPerp = new THREE.Vector3().crossVectors(planeInfo.normal, tParallel).normalize();
    const validDirs = getValidInPlaneDirections(ws, h, k, l);
    const orthoInfo = computeOrthogonalInPlaneInfo(tParallel, lParallel, tPerp, validDirs, isHex);

    // Find crystallographic structural wall plane (h_w k_w l_w) containing [uvw] and perpendicular to (hkl)
    // per Trolliard et al. (2006) (e.g. (1 -1 0 2)_sa with d=3.48 Å and (0 2 0)_m with d=2.60 Å -> 3:4 ratio)
    let wallPlane = null;
    if (ws.unitLatticeMatrix && Math.abs(zoneSum) < 1e-4) {
        try {
            wallPlane = Cryst.findPerpendicularWallPlane(
                ws.unitLatticeMatrix,
                [h, k, l],
                [u3, v3, w3],
                { isHex, spaceGroup: ws.crystalData?.space_group }
            );
        } catch (_) {
            wallPlane = null;
        }
    }

    const useWallSpacing = Boolean(wallPlane && wallPlane.angleFromPerpDeg < 5.0 && wallPlane.d > 0.5);
    const effectiveLPerp = useWallSpacing ? wallPlane.d : orthoInfo.lPerp;

    const dirBracket = isHex
        ? `[${uIn} ${vIn} ${tIn} ${wIn}]`
        : `[${uIn} ${vIn} ${wIn}]`;
    const perpUVW = orthoInfo.perpUVW;
    const perpBracket = useWallSpacing
        ? wallPlane.label
        : (perpUVW && perpUVW.some(x => x !== 0) ? `[${perpUVW.join(' ')}]` : '⊥');

    return {
        u: uIn, v: vIn, t: tIn, w: wIn,
        u3, v3, w3,
        isHex,
        dirBracket,
        dirLabel: dirBracket,
        perpBracket,
        perpLabel: perpBracket,
        wallPlane,
        tParallel,
        lParallel,
        tPerp,
        lPerp: effectiveLPerp,
        directLPerp: orthoInfo.lPerp,
        conjugateDir: orthoInfo.conjugateDir,
        conjugatePeriod: orthoInfo.conjugatePeriod,
        gammaDeg: orthoInfo.gammaDeg,
        perpUVW
    };
}

// Computes the true primitive orthogonal repeat L_perp and conjugate in-plane direction for a 2D crystal net (Zur & McGill / Trolliard)
// Since validDirs is sorted by ascending period L, we select the SHORTEST primitive lattice vector that is orthogonal (or conjugate) to tParallel
function computeOrthogonalInPlaneInfo(tParallel, lParallel, tPerp, validDirs, isHex) {
    let bestPerpPeriod = lParallel;
    let conjugatePeriod = lParallel;
    let perpUVW = isHex ? [0, 0, 0, 0] : [0, 0, 0];
    let conjugateDir = tPerp.clone();
    let gammaDeg = 90.0;

    if (!validDirs || validDirs.length === 0) {
        return { lPerp: bestPerpPeriod, conjugatePeriod, perpUVW, conjugateDir, gammaDeg };
    }

    // Pass 1: Look for the SHORTEST primitive in-plane vector nearly orthogonal to tParallel (within ~16° of 90°, |d · tPerp| >= 0.96)
    for (const d of validDirs) {
        const sinComp = Math.abs(d.localDir.dot(tPerp));
        if (sinComp >= 0.96) {
            bestPerpPeriod = d.period * sinComp;
            conjugatePeriod = d.period;
            perpUVW = isHex ? [d.U, d.V, d.T, d.W] : [d.u, d.v, d.w];
            conjugateDir = d.localDir.clone();
            gammaDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(Math.abs(d.localDir.dot(tParallel)), 0, 1)));
            return { lPerp: bestPerpPeriod, conjugatePeriod, perpUVW, conjugateDir, gammaDeg };
        }
    }

    // Pass 2: Oblique 2D net (e.g. 60° hexagonal or monoclinic plane without a low-index 90° vector):
    // Select the shortest non-collinear primitive lattice vector (|d · tPerp| >= 0.45) and compute perpendicular row spacing L_perp = d.period * |d · tPerp|
    let minPerpSpacing = Infinity;
    for (const d of validDirs) {
        const sinComp = Math.abs(d.localDir.dot(tPerp));
        if (sinComp >= 0.45) {
            const rowSpacing = d.period * sinComp;
            if (rowSpacing < minPerpSpacing) {
                minPerpSpacing = rowSpacing;
                bestPerpPeriod = rowSpacing;
                conjugatePeriod = d.period;
                perpUVW = isHex ? [d.U, d.V, d.T, d.W] : [d.u, d.v, d.w];
                conjugateDir = d.localDir.clone();
                gammaDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(Math.abs(d.localDir.dot(tParallel)), 0, 1)));
            }
        }
    }

    return {
        lPerp: (Number.isFinite(bestPerpPeriod) && bestPerpPeriod > 1e-3) ? bestPerpPeriod : lParallel,
        conjugatePeriod,
        perpUVW,
        conjugateDir,
        gammaDeg
    };
}

// Finds optimal 1D Domain Matching Epitaxy ratio (n * L1 ≈ m * L2) per Trolliard et al. / Narayan-Larson DME / Bollmann CSL
function findBestDomainMatch1D(L1, L2, maxN = 8, tol = 0.02) {
    if (L1 <= 0 || L2 <= 0) return { n: 1, m: 1, misFit: 0, effectiveMisFit: 0, sigma1D: 1 };
    const res = Cryst.findBestDomainMatch1D(L1, L2, { maxN, tol, reference: 'A' });
    return {
        n: res.n,
        m: res.m,
        misFit: res.misFit,
        effectiveMisFit: res.effectiveMisFit,
        signedMisfit: res.signedMisfit,
        sigma1D: res.sigma1D
    };
}

function evaluate2DDomainMatch(quat1, quat2, plane1, plane2, dir1, dir2, slideEval = null) {
    // Along the common direction [uvw]1 || [uvw]2 (P2 ≈ P2'), prefer compact 1:1 / low-integer repeats (maxN = 4)
    // Perpendicular to the structural walls (P1 = n*d1_perp ≈ m*d2_perp), allow up to 8 planes to capture 3:4 (10.4 Å) and 6:5 walls
    const matchPar = findBestDomainMatch1D(dir1.lParallel, dir2.lParallel, 4, 0.015);
    const matchPerp = findBestDomainMatch1D(dir1.lPerp, dir2.lPerp, 8, 0.015);

    // 2D Parametric Misfit F0: per Trolliard et al. (2006), the primary structural wall coincidence P1 = n*d1_perp ≈ m*d2_perp
    // (e.g. 3*d_(1-102)sa ≈ 4*d_(020)m ≈ 10.4 Å with F0_perp = 0.15%-0.32%) governs the semi-coherent wall lock-in (75% weight),
    // while the along-wall repeat P2 ≈ P2' (e.g. 5.13 Å vs 5.32 Å, ~3.6%) is accommodated along the cation chains (25% weight).
    const f0 = Math.sqrt(0.25 * Math.pow(matchPar.misFit, 2) + 0.75 * Math.pow(matchPerp.misFit, 2));
    const cellPenalty = 0.002 * Math.max(0, (matchPar.n + matchPar.m) - 2) + 0.0008 * Math.max(0, (matchPerp.n + matchPerp.m) - 7);
    const fEff = Math.sqrt(0.25 * Math.pow(matchPar.effectiveMisFit, 2) + 0.75 * Math.pow(matchPerp.effectiveMisFit, 2)) + cellPenalty;

    // Out-of-plane tilt between N1 and -N2
    const worldN1 = plane1.normal.clone().applyQuaternion(quat1).normalize();
    const worldN2 = plane2.normal.clone().applyQuaternion(quat2).normalize();
    const targetN2 = worldN1.clone().negate();
    const cosTilt = THREE.MathUtils.clamp(Math.abs(worldN2.dot(targetN2)), 0, 1);
    const tiltRad = Math.acos(cosTilt);

    // In-plane angle alpha between Primary [u1 v1 w1] and Secondary [u2 v2 w2] in world space
    const wDir1 = dir1.tParallel.clone().applyQuaternion(quat1).normalize();
    const wDir2 = dir2.tParallel.clone().applyQuaternion(quat2).normalize();
    const wDir2Proj = wDir2.clone().addScaledVector(worldN1, -wDir2.dot(worldN1));
    let alphaRad = 0;
    if (wDir2Proj.lengthSq() > 1e-6) {
        wDir2Proj.normalize();
        const cosAlpha = THREE.MathUtils.clamp(Math.abs(wDir1.dot(wDir2Proj)), 0, 1);
        alphaRad = Math.acos(cosAlpha);
    }

    // Bramfitt / Bollmann 2D Vector Disregistry across both the selected (dir1, dir2) AND any symmetry-equivalent
    // zone axes of Plane 1 and Plane 2 that may come into lock-in when Crystal 2 is twisted by φ:
    const deltaSelected = Math.sqrt(Math.pow(fEff, 2) + 4.0 * Math.pow(Math.sin(alphaRad / 2.0), 2));
    let bestEffectiveDisregistry = deltaSelected;

    // Check if twisting φ has aligned wDir1 with another valid zone axis of Secondary plane2
    const h2 = parseFloat(document.getElementById('ep2_h')?.value) || 0;
    const k2 = parseFloat(document.getElementById('ep2_k')?.value) || 0;
    const l2 = parseFloat(document.getElementById('ep2_l')?.value) || 0;
    const dirs2 = getValidInPlaneDirections(workspaceRight, h2, k2, l2);
    for (const d2Cand of dirs2) {
        const wCand2 = d2Cand.localDir.clone().applyQuaternion(quat2);
        wCand2.addScaledVector(worldN1, -wCand2.dot(worldN1));
        if (wCand2.lengthSq() > 1e-6) {
            wCand2.normalize();
            const candAlpha = Math.acos(THREE.MathUtils.clamp(Math.abs(wDir1.dot(wCand2)), 0, 1));
            const candPar = findBestDomainMatch1D(dir1.lParallel, d2Cand.period, 4, 0.015);
            const candTPerp2 = new THREE.Vector3().crossVectors(plane2.normal, d2Cand.localDir).normalize();
            const candOrtho2 = computeOrthogonalInPlaneInfo(d2Cand.localDir, d2Cand.period, candTPerp2, dirs2, workspaceRight.isHexOrTrigonal);
            const candPerp = findBestDomainMatch1D(dir1.lPerp, candOrtho2.lPerp, 8, 0.015);
            const candFEff = Math.sqrt(0.25 * Math.pow(candPar.effectiveMisFit, 2) + 0.75 * Math.pow(candPerp.effectiveMisFit, 2));
            const candDisreg = Math.sqrt(Math.pow(candFEff, 2) + 4.0 * Math.pow(Math.sin(candAlpha / 2.0), 2));
            if (candDisreg < bestEffectiveDisregistry) {
                bestEffectiveDisregistry = candDisreg;
            }
        }
    }

    // 1. Crystallographic 2D Structural Wall & Domain Score (0 - 100%):
    // Combine the selected direction disregistry (75% weight) and symmetry-equivalent zone-axis lock-in (25% weight)
    const combinedDisregistry = 0.75 * deltaSelected + 0.25 * bestEffectiveDisregistry;
    const tiltFactor = Math.pow(cosTilt, 2);
    const domainScore = 100.0 * Math.exp(-3.0 * combinedDisregistry) * tiltFactor;

    // 2. Real-Space 2D Structural Wall & Cationic Registry Score (0 - 100%):
    // Reflects how well the cationic structural walls (every P1 ≈ 10.4 Å) and surface cations align at (Slide X, Slide Y, Twist φ)
    let atomicScore = domainScore;
    if (slideEval && slideEval.compatibleTotal > 0) {
        const lockScore = (1.0 - slideEval.energy) * 100.0;
        const wallBonus = Math.min(10.0, slideEval.coincidenceRatio * 0.16);
        atomicScore = Math.min(100.0, lockScore + wallBonus) * tiltFactor;
    }

    // Unified Matching Degree: 65% Crystallographic Structural Wall Domain Match + 35% Real-Space Cation Wall Registry
    const matchingDegree = THREE.MathUtils.clamp(0.65 * domainScore + 0.35 * atomicScore, 0, 100);
    const totalMisFit = Math.max(0, 1.0 - matchingDegree / 100.0);

    return {
        matchPar,
        matchPerp,
        f0,
        fEff,
        domainScore,
        atomicScore,
        alphaDeg: THREE.MathUtils.radToDeg(alphaRad),
        tiltDeg: THREE.MathUtils.radToDeg(tiltRad),
        totalMisFitPercent: totalMisFit * 100,
        matchingDegree
    };
}

// Computes the crystallographic 2D orthonormal basis (t_parallel, t_perp, worldNormal1) on Primary plane (h1 k1 l1)
// so Slide X (Δx) moves strictly along Primary [u1 v1 w1] / [u1 v1 t1 w1] and Slide Y (Δy) moves along the orthogonal in-plane axis
function getInterface2DBasis(plane1, dir1) {
    workspaceLeft.crystalMasterGroup.updateMatrixWorld(true);
    const worldNormal1 = plane1.normal.clone()
        .applyQuaternion(workspaceLeft.crystalMasterGroup.quaternion)
        .normalize();

    let tangentX = null;
    if (dir1 && dir1.tParallel) {
        const worldDir1 = dir1.tParallel.clone()
            .applyQuaternion(workspaceLeft.crystalMasterGroup.quaternion);
        // Project strictly onto the interface plane to ensure exact orthogonality with worldNormal1
        worldDir1.addScaledVector(worldNormal1, -worldDir1.dot(worldNormal1));
        if (worldDir1.lengthSq() > 1e-6) {
            tangentX = worldDir1.normalize();
        }
    }
    if (!tangentX) {
        tangentX = new THREE.Vector3(1, 0, 0);
        if (Math.abs(worldNormal1.dot(tangentX)) > 0.9) tangentX.set(0, 1, 0);
        tangentX.crossVectors(tangentX, worldNormal1).normalize();
    }
    const tangentY = new THREE.Vector3().crossVectors(worldNormal1, tangentX).normalize();
    return { worldNormal1, tangentX, tangentY };
}

// Evaluates Trolliard 2D Structural Wall & Cationic Registry Score R and coincidence statistics
// for a candidate rigid-body shift (dx, dy) of the Secondary surface sheet relative to the Primary surface sheet.
// Combines 1D Structural Wall Phase Alignment (matching n*d1_perp ≈ m*d2_perp lines every P1 ≈ 10.4 Å) with 2D Cation Registry.
function evaluateSheetSlideEnergy(dx, dy, surf1, surf2, pairMode, dir1 = null, dir2 = null) {
    if (!surf1 || !surf2 || surf1.length === 0 || surf2.length === 0) {
        return { energy: 1.0, registryScore: 0, coincidenceRatio: 0, coincidenceCount: 0, compatibleTotal: 0, pairCount: 0, meanDrXY: Infinity };
    }
    const res = Cryst.calculateAtomicRegistryScore(surf1, surf2, dx, dy, {
        rc: 1.25,
        repCutoff: 0.65,
        coincidenceCutoff: 0.90,
        pairMode
    });
    let registryScore = Number.isFinite(res.registryScore) ? res.registryScore : (Number.isFinite(res.score) ? res.score : 0);

    // Per Trolliard et al. (2006) Fig. 3b:
    // In corundum (11-20)_sa, the Al3+ cations form symmetric buckled double-rows at y_wall ± 1.03 Å centered on each
    // (1-102)_sa structural wall (y_wall = 0, ±3.48, ±6.96, ±10.44 Å), while Zr4+ cations sit along the (020)_m wall centers
    // (y_wall = 0, ±2.61, ±5.21, ±7.82, ±10.42 Å). Thus the structural walls coincide when dy aligns the wall centers (dy ≈ 0 mod d_perp).
    const d1 = dir1 || (lastInterface2DState && lastInterface2DState.dir1);
    const d2 = dir2 || (lastInterface2DState && lastInterface2DState.dir2);
    if (d1 && d2 && d1.lPerp > 0.5 && d2.lPerp > 0.5) {
        const wallPhaseY = 0.5 * (1.0 + Math.cos((2.0 * Math.PI * dy) / d1.lPerp));
        const chainPhaseX = 0.5 * (1.0 + Math.cos((2.0 * Math.PI * dx) / d1.lParallel));
        const wallLockScore = 0.80 * wallPhaseY + 0.20 * chainPhaseX;
        registryScore = 0.55 * wallLockScore + 0.45 * registryScore;
    }

    const energy = THREE.MathUtils.clamp(1.0 - registryScore, 0, 1);
    return {
        energy,
        registryScore,
        coincidenceRatio: Number.isFinite(res.coincidenceRatio) ? res.coincidenceRatio : 0,
        coincidenceCount: res.coincidenceCount ?? 0,
        compatibleTotal: res.compatibleTotal ?? 0,
        pairCount: res.pairCount ?? res.compatibleTotal ?? 0,
        meanDrXY: res.meanDrXY ?? res.meanNearestDistance ?? Infinity
    };
}

// Cache of latest 2D projected interface state for fast 2D Trolliard Canvas rendering and interactive sheet sliding
let lastInterface2DState = null;
let isBatchOptimizing = false;

// Computes & renders 3D Atom-to-Atom Matching Lines, Sheet-Sliding Energy State, and updates the 2D Trolliard Map
function updateInterfacialAtomLines() {
    disposeGroup(interfaceLinesGroup);
    disposeGroup(interfaceLabelsGroup);

    const statsEl = document.getElementById('epiAtomStatsText');
    const energyEl = document.getElementById('epiEnergyText');
    const showLines = document.getElementById('showEpiLines')?.checked;
    const showLabels = document.getElementById('showEpiDistLabels')?.checked;
    const pairMode = document.getElementById('epiPairMode')?.value || 'all';

    if (currentMode !== 'interface') {
        if (statsEl) statsEl.innerText = 'Linked Pairs: -- | Mean ⟨Δr_xy⟩: -- Å';
        if (energyEl) energyEl.innerText = 'Sheet Energy E_int: -- | Coincidence: --%';
        lastInterface2DState = null;
        return;
    }

    const [h1, k1, l1] = readEpitaxyPlane('ep1');
    const [h2, k2, l2] = readEpitaxyPlane('ep2');

    const plane1 = getPlaneVectorAndDSpacing(workspaceLeft, h1, k1, l1);
    const plane2 = getPlaneVectorAndDSpacing(workspaceRight, h2, k2, l2);
    if (plane1.d === 0) return;

    const dir1 = getDirectionAndOrthogonalInfo(workspaceLeft, 'ep1', h1, k1, l1, plane1);
    const dir2 = getDirectionAndOrthogonalInfo(workspaceRight, 'ep2', h2, k2, l2, plane2);

    workspaceLeft.crystalMasterGroup.updateMatrixWorld(true);
    workspaceLeft.crystalPivotGroup.updateMatrixWorld(true);
    workspaceRight.crystalMasterGroup.updateMatrixWorld(true);
    workspaceRight.crystalPivotGroup.updateMatrixWorld(true);

    const { worldNormal1, tangentX, tangentY } = getInterface2DBasis(plane1, dir1);
    const origin1 = workspaceLeft.crystalMasterGroup.position.clone();
    const origin2 = workspaceRight.crystalMasterGroup.position.clone();
    const currTransX = parseFloat(document.getElementById('epiTransX')?.value) || 0;
    const currTransY = parseFloat(document.getElementById('epiTransY')?.value) || 0;

    const collectVisibleAtoms = (ws, isSecondary) => {
        const list = [];
        const wsOrigin = isSecondary ? origin2 : origin1;
        const activePlanes = ws.getActiveClipPlanes();
        const activePlaneCount = activePlanes.length;
        const pivotMat = ws.crystalPivotGroup.matrixWorld;
        const relToOrigin1 = new THREE.Vector3();
        const relToSelf = new THREE.Vector3();
        ws.speciesRegistry.forEach((entry) => {
            if (!entry.visible) return;
            const cpkColor = entry.color || (ELEMENT_DATA[entry.symbol] && ELEMENT_DATA[entry.symbol].color) || '#cccccc';
            const isAnion = ANION_SYMBOLS.has(entry.symbol);
            entry.meshes.forEach((mesh) => {
                if (!mesh.visible) return;
                const wPos = mesh.position.clone().applyMatrix4(pivotMat);
                let clipped = false;
                for (let p = 0; p < activePlaneCount; p++) {
                    if (activePlanes[p].distanceToPoint(wPos) < -1e-4) {
                        clipped = true;
                        break;
                    }
                }
                if (clipped) return;
                relToOrigin1.subVectors(wPos, origin1);
                relToSelf.subVectors(wPos, wsOrigin);
                const localPlaneDist = relToSelf.dot(worldNormal1);
                const x = relToOrigin1.dot(tangentX);
                const y = relToOrigin1.dot(tangentY);
                list.push({
                    species: entry.symbol,
                    color: cpkColor,
                    isAnion,
                    wPos,
                    localPlaneDist,
                    x,
                    y,
                    x0: isSecondary ? (x - currTransX) : x,
                    y0: isSecondary ? (y - currTransY) : y
                });
            });
        });
        return list;
    };

    const atoms1 = collectVisibleAtoms(workspaceLeft, false);
    const atoms2 = collectVisibleAtoms(workspaceRight, true);

    if (atoms1.length === 0 || atoms2.length === 0) {
        if (statsEl) statsEl.innerText = 'Linked Pairs: 0 | Mean ⟨Δr_xy⟩: -- Å';
        if (energyEl) energyEl.innerText = 'Sheet Energy E_int: -- | Coincidence: --%';
        lastInterface2DState = null;
        renderTrolliard2DMap();
        return;
    }

    // Extract interfacial crystallographic plane slice for Crystal 1 and Crystal 2:
    // Using halfSlab ≈ 2.55 Å around each crystal's central (hkl) plane includes the full interfacial
    // coordination polyhedra (both rhombohedral Al³⁺ sublayers in α-Al₂O₃ and all 4 Zr⁴⁺ sites in m-ZrO₂),
    // ensuring symmetric structural wall centers around (0, 0).
    const extractInterfaceLayer = (atoms, ws, planeObj) => {
        if (ws.isolatedPlaneData) return atoms;
        const halfSlab = Math.max(2.45, Math.min(2.85, (planeObj.d || 2.4) * 1.05));
        const slice = atoms.filter(a => Math.abs(a.localPlaneDist) <= halfSlab);
        return slice.length >= 4 ? slice : atoms;
    };

    const surf1 = extractInterfaceLayer(atoms1, workspaceLeft, plane1);
    const surf2 = extractInterfaceLayer(atoms2, workspaceRight, plane2);

    // Build periodic 2D in-plane lattice tiling across [-13.5 Å, +13.5 Å] so the 2D Trolliard Viewer
    // and Structural Wall analyzer always span multiple P₁ ≈ 10.4 Å supercell domains even when the 3D view is a 1×1×1 cell.
    const buildPeriodic2DLatticeAtoms = (baseAtoms, ws, dirInfo, isSecondary) => {
        if (!baseAtoms || baseAtoms.length === 0 || !dirInfo) return baseAtoms || [];
        const q = ws.crystalMasterGroup.quaternion;
        const wVec1 = dirInfo.tParallel.clone().applyQuaternion(q).multiplyScalar(Math.max(1.5, dirInfo.lParallel || 4.0));
        const conjLocal = (dirInfo.conjugateDir || dirInfo.tPerp).clone();
        const conjLen = Math.max(1.5, dirInfo.conjugatePeriod || dirInfo.directLPerp || dirInfo.lPerp || 4.0);
        const wVec2 = conjLocal.applyQuaternion(q).multiplyScalar(conjLen);

        const t1x = wVec1.dot(tangentX);
        const t1y = wVec1.dot(tangentY);
        const t2x = wVec2.dot(tangentX);
        const t2y = wVec2.dot(tangentY);

        const det = Math.abs(t1x * t2y - t1y * t2x);
        if (det < 0.5) return baseAtoms;

        const maxRangeAng = 13.5;
        const tiled = [];
        const gridN = 3;

        for (let i = -gridN; i <= gridN; i++) {
            for (let j = -gridN; j <= gridN; j++) {
                const shiftX = i * t1x + j * t2x;
                const shiftY = i * t1y + j * t2y;
                for (let k = 0; k < baseAtoms.length; k++) {
                    const a = baseAtoms[k];
                    const x0 = a.x0 + shiftX;
                    const y0 = a.y0 + shiftY;
                    if (Math.abs(x0) > maxRangeAng || Math.abs(y0) > maxRangeAng) continue;

                    let duplicate = false;
                    for (let m = 0; m < tiled.length; m++) {
                        const ex = tiled[m];
                        if (ex.species === a.species && Math.hypot(x0 - ex.x0, y0 - ex.y0) < 0.28) {
                            duplicate = true;
                            break;
                        }
                    }
                    if (!duplicate) {
                        tiled.push({
                            species: a.species,
                            color: a.color,
                            isAnion: a.isAnion,
                            x0,
                            y0,
                            x: isSecondary ? (x0 + currTransX) : x0,
                            y: isSecondary ? (y0 + currTransY) : y0
                        });
                    }
                }
            }
        }
        return tiled.length > 0 ? tiled : baseAtoms;
    };

    const periodicSurf1 = buildPeriodic2DLatticeAtoms(surf1, workspaceLeft, dir1, false);
    const periodicSurf2 = buildPeriodic2DLatticeAtoms(surf2, workspaceRight, dir2, true);

    if (isBatchOptimizing) {
        const slideEval = evaluateSheetSlideEnergy(currTransX, currTransY, periodicSurf1, periodicSurf2, pairMode, dir1, dir2);
        lastInterface2DState = {
            h1, k1, l1, h2, k2, l2,
            dir1, dir2,
            tangentX, tangentY,
            surf1, surf2, periodicSurf1, periodicSurf2,
            currTransX, currTransY,
            pairMode, slideEval
        };
        return;
    }

    const isCompatiblePair = (a1, a2) => {
        if (pairMode === 'cation_cation') return !a1.isAnion && !a2.isAnion;
        if (pairMode === 'same') return a1.species === a2.species || a1.isAnion === a2.isAnion;
        if (pairMode === 'cation_anion') return a1.isAnion !== a2.isAnion;
        return true;
    };

    const linePositions = [];
    const lineColors = [];
    let sumLateralOffset = 0;
    let pairCount = 0;
    const maxLateralCutoff = 3.2; // Å maximum in-plane search radius for pairing

    const cGreen = new THREE.Color(0x00ff44);
    const cYellow = new THREE.Color(0xffee00);
    const cRed = new THREE.Color(0xff2222);

    for (const a1 of surf1) {
        let bestA2 = null;
        let bestDrXY = Infinity;
        let bestDist3D = Infinity;

        for (const a2 of surf2) {
            if (!isCompatiblePair(a1, a2)) continue;

            const dx = a2.x - a1.x;
            const dy = a2.y - a1.y;
            const drXY = Math.hypot(dx, dy);

            if (drXY < bestDrXY && drXY <= maxLateralCutoff) {
                bestDrXY = drXY;
                bestDist3D = a2.wPos.distanceTo(a1.wPos);
                bestA2 = a2;
            }
        }

        if (bestA2) {
            pairCount++;
            sumLateralOffset += bestDrXY;

            if (showLines) {
                // Color interpolation based on lateral in-plane offset Δr_xy (0 Å -> Green, 1.0 Å -> Yellow, >=2.0 Å -> Red)
                const lineColor = new THREE.Color();
                if (bestDrXY <= 1.0) {
                    lineColor.lerpColors(cGreen, cYellow, bestDrXY / 1.0);
                } else {
                    lineColor.lerpColors(cYellow, cRed, Math.min(1.0, (bestDrXY - 1.0) / 1.0));
                }

                linePositions.push(a1.wPos.x, a1.wPos.y, a1.wPos.z);
                linePositions.push(bestA2.wPos.x, bestA2.wPos.y, bestA2.wPos.z);
                lineColors.push(lineColor.r, lineColor.g, lineColor.b);
                lineColors.push(lineColor.r, lineColor.g, lineColor.b);

                if (showLabels && pairCount <= 40) {
                    const hexStr = '#' + lineColor.getHexString();
                    const midPt = new THREE.Vector3().addVectors(a1.wPos, bestA2.wPos).multiplyScalar(0.5);
                    const lblText = `Δr:${bestDrXY.toFixed(2)}Å (${bestDist3D.toFixed(1)}Å)`;
                    const sprite = makeDistanceLabelSprite(lblText, hexStr);
                    sprite.position.copy(midPt);
                    interfaceLabelsGroup.add(sprite);
                }
            }
        }
    }

    if (showLines && linePositions.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
        const mat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            linewidth: 2
        });
        interfaceLinesGroup.add(new THREE.LineSegments(geom, mat));
    }

    const slideEval = evaluateSheetSlideEnergy(currTransX, currTransY, periodicSurf1, periodicSurf2, pairMode, dir1, dir2);

    if (statsEl) {
        if (pairCount > 0) {
            const meanDr = sumLateralOffset / pairCount;
            statsEl.innerText = `Linked Pairs: ${pairCount} | Mean ⟨Δr_xy⟩: ${meanDr.toFixed(2)} Å`;
            statsEl.style.color = meanDr < 0.6 ? '#00ff66' : (meanDr < 1.2 ? '#ffee55' : '#ff6666');
        } else {
            statsEl.innerText = `Linked Pairs: 0 (Increase Supercell or Adjust Slide X/Y)`;
            statsEl.style.color = '#ff8888';
        }
    }

    if (energyEl) {
        const regPct = ((1.0 - slideEval.energy) * 100).toFixed(1);
        energyEl.innerText = `Wall/Cation Registry R: ${regPct}% | Coincident Sites: ${slideEval.coincidenceCount}/${slideEval.compatibleTotal || periodicSurf1.length} (${slideEval.coincidenceRatio.toFixed(0)}%)`;
        energyEl.title = `Trolliard Structural Wall & Cation Registry Score R (0-100%). Combines perpendicular structural wall coincidence (P₁ ≈ 10.4 Å) with 2D cation sublattice alignment.`;
        energyEl.style.color = slideEval.energy < 0.35 ? '#00ff88' : (slideEval.energy < 0.60 ? '#ffee55' : '#ff7777');
    }

    lastInterface2DState = {
        h1, k1, l1, h2, k2, l2,
        dir1, dir2,
        tangentX, tangentY,
        surf1, surf2, periodicSurf1, periodicSurf2,
        currTransX, currTransY,
        pairMode, slideEval
    };

    renderTrolliard2DMap();
}

function calculateEpitaxyMatch() {
    syncEpitaxyCoordSystemUI('1');
    syncEpitaxyCoordSystemUI('2');

    const [h1, k1, l1] = readEpitaxyPlane('ep1');
    const [h2, k2, l2] = readEpitaxyPlane('ep2');

    const plane1 = getPlaneVectorAndDSpacing(workspaceLeft, h1, k1, l1);
    const plane2 = getPlaneVectorAndDSpacing(workspaceRight, h2, k2, l2);

    const dir1 = getDirectionAndOrthogonalInfo(workspaceLeft, 'ep1', h1, k1, l1, plane1);
    const dir2 = getDirectionAndOrthogonalInfo(workspaceRight, 'ep2', h2, k2, l2, plane2);

    if (dir1) {
        document.getElementById('ep1_d').innerText =
            `d:${plane1.d.toFixed(2)}Å | L∥:${dir1.lParallel.toFixed(2)}Å | L⊥:${dir1.lPerp.toFixed(2)}Å`;
    } else {
        const tag1 = workspaceLeft.isHexOrTrigonal ? '[uvtw]' : '[uvw]';
        document.getElementById('ep1_d').innerText = `d:${plane1.d.toFixed(2)}Å | Select valid ${tag1}`;
    }

    if (dir2) {
        document.getElementById('ep2_d').innerText =
            `d:${plane2.d.toFixed(2)}Å | L∥:${dir2.lParallel.toFixed(2)}Å | L⊥:${dir2.lPerp.toFixed(2)}Å`;
    } else {
        const tag2 = workspaceRight.isHexOrTrigonal ? '[uvtw]' : '[uvw]';
        document.getElementById('ep2_d').innerText = `d:${plane2.d.toFixed(2)}Å | Select valid ${tag2}`;
    }

    // Update 3D/2D interfacial atom lines & sheet-sliding coincidence state first
    updateInterfacialAtomLines();

    if (plane1.d === 0 || plane2.d === 0 || !dir1 || !dir2) {
        const scoreElem = document.getElementById('epiScoreText');
        if (scoreElem) {
            scoreElem.innerText = 'Matching Degree: --%';
            scoreElem.style.color = '#888888';
        }
        return;
    }

    const slideEval = (currentMode === 'interface' && lastInterface2DState) ? lastInterface2DState.slideEval : null;

    const state = evaluate2DDomainMatch(
        workspaceLeft.crystalMasterGroup.quaternion,
        workspaceRight.crystalMasterGroup.quaternion,
        plane1, plane2, dir1, dir2,
        slideEval
    );

    const f0Percent = (state.f0 * 100).toFixed(2);
    const fParPercent = (state.matchPar.misFit * 100).toFixed(2);
    const fPerpPercent = (state.matchPerp.misFit * 100).toFixed(2);

    document.getElementById('epiMatchText').innerText =
        `2D Domain Mis-fit F₀: ${f0Percent}% (F∥: ${fParPercent}%, F⊥: ${fPerpPercent}%)`;
    document.getElementById('epiAngleText').innerText =
        `${dir1.dirBracket}₁ ∠ ${dir2.dirBracket}₂ (α): ${state.alphaDeg.toFixed(1)}°` +
        (state.tiltDeg > 0.5 ? ` (Tilt: ${state.tiltDeg.toFixed(1)}°)` : '');

    const scoreElem = document.getElementById('epiScoreText');
    scoreElem.innerText = `Matching Degree: ${state.matchingDegree.toFixed(2)}%`;
    scoreElem.title = `Domain Match: ${state.domainScore.toFixed(1)}% | 2D Sheet Atomic Registry: ${state.atomicScore.toFixed(1)}%`;
    scoreElem.style.color = state.matchingDegree >= 85 ? '#00ff00' : (state.matchingDegree >= 65 ? '#ffff00' : '#ff4444');

    const len1Par = (state.matchPar.n * dir1.lParallel).toFixed(2);
    const len2Par = (state.matchPar.m * dir2.lParallel).toFixed(2);
    const len1Perp = (state.matchPerp.n * dir1.lPerp).toFixed(2);
    const len2Perp = (state.matchPerp.m * dir2.lPerp).toFixed(2);

    document.getElementById('epiSupercellText').innerText =
        `∥ ${dir1.dirBracket}₁∥${dir2.dirBracket}₂: ${state.matchPar.n}×L₁∥ (${len1Par}Å) ≈ ${state.matchPar.m}×L₂∥ (${len2Par}Å)  |  ` +
        `⊥ Walls ${dir1.perpBracket}₁∥${dir2.perpBracket}₂: ${state.matchPerp.n}×d₁⊥ (${len1Perp}Å) ≈ ${state.matchPerp.m}×d₂⊥ (${len2Perp}Å)`;

    const relaxEl = document.getElementById('epiRelaxationText');
    if (relaxEl) {
        const deltaGammaDeg = Math.abs((dir1.gammaDeg ?? 90) - (dir2.gammaDeg ?? 90));
        const effAlphaDeg = deltaGammaDeg > 0.1 ? deltaGammaDeg : state.alphaDeg;
        const relPerp = Cryst.calculateLatticeRelaxation(dir1.lPerp, dir2.lPerp, {
            n: state.matchPerp.n,
            m: state.matchPerp.m,
            alphaDeg: effAlphaDeg
        });
        const relPar = Cryst.calculateLatticeRelaxation(dir1.lParallel, dir2.lParallel, {
            n: state.matchPar.n,
            m: state.matchPar.m,
            alphaDeg: state.alphaDeg
        });

        if (relPerp && relPar) {
            const rawPerpPct = (relPerp.rawMisfit1to1 * 100).toFixed(1);
            const f0PerpPct = (relPerp.absF0 * 100).toFixed(2);
            const signPerp = relPerp.perPlaneAdjustmentB >= 0 ? '+' : '';
            const dislocText = relPerp.extraHalfPlanes > 0
                ? `${relPerp.extraHalfPlanes} extra half-plane / ${relPerp.domainLengthA.toFixed(2)}Å`
                : `0 dislocations (1:1 coherent)`;
            const meanDrStr = (slideEval && Number.isFinite(slideEval.meanDrXY))
                ? ` | Current rigid-lattice ⟨Δr_xy⟩: <b>${slideEval.meanDrXY.toFixed(2)}Å</b>`
                : '';

            relaxEl.innerHTML =
                `<div><b style="color:#ffcc66;">⚠ Rigid-Lattice Assumption:</b> Both crystals are rendered as rigid lattices (no atomic relaxation applied to 3D coordinates).</div>` +
                `<div style="margin-top:2px;"><b style="color:#66ffaa;">⊥ Wall Relaxation (${relPerp.n}:${relPerp.m} ratio, ${dir1.perpBracket}₁∥${dir2.perpBracket}₂):</b> ` +
                `1:1 misfit <b>${rawPerpPct}%</b> → relieved via <b>${dislocText}</b> to residual strain <b>F₀⊥ = ${f0PerpPct}%</b>. ` +
                `Max linear relaxation to form ${relPerp.n}:${relPerp.m} cell: <b>Δu = ${relPerp.domainDiscrepancyAng.toFixed(3)}Å</b> ` +
                `(<b>±${relPerp.maxWallPinnedShiftAng.toFixed(3)}Å</b> from pinned wall, <b>${signPerp}${relPerp.perPlaneAdjustmentB.toFixed(4)}Å/plane</b>).</div>` +
                `<div style="margin-top:2px;"><b style="color:#77ddff;">∥ &amp; Angular Polyhedral Relaxation (Trolliard et al.):</b> ` +
                `∥ ${relPar.n}:${relPar.m} strain <b>F₀∥ = ${(relPar.absF0 * 100).toFixed(2)}%</b> (Δu∥ = ${relPar.domainDiscrepancyAng.toFixed(3)}Å) | ` +
                `Conjugate wall angle mismatch <b>Δγ = ${effAlphaDeg.toFixed(2)}°</b> (${(dir1.gammaDeg ?? 90).toFixed(2)}° vs ${(dir2.gammaDeg ?? 90).toFixed(2)}°) ` +
                `requires <b>±${relPerp.halfPolyhedronBondShiftAng.toFixed(3)}Å</b> (shear γ = ${(relPerp.angularShearStrain * 100).toFixed(1)}%) local ionocovalent bond adjustment across interfacial [ZrO₇]/[AlO₆] polyhedra${meanDrStr}.</div>`;
        }
    }
}

document.getElementById('btnCalcMatch').addEventListener('click', calculateEpitaxyMatch);

// Wire Plane (hkl)/(hkil) and Direction [uvw]/[uvtw] inputs + dropdowns
['1', '2'].forEach(wsId => {
    const prefix = wsId === '1' ? 'ep1' : 'ep2';
    ['h', 'k', 'l'].forEach(coord => {
        document.getElementById(`${prefix}_${coord}`).addEventListener('input', () => {
            syncEpitaxyCoordSystemUI(wsId);
            populateInPlaneDirections(wsId, false);
            calculateEpitaxyMatch();
        });
    });

    document.getElementById(`${prefix}_dirSelect`).addEventListener('change', (e) => {
        const val = e.target.value;
        if (val && val !== 'custom') {
            const [u, v, w] = val.split(',').map(Number);
            document.getElementById(`${prefix}_u`).value = u;
            document.getElementById(`${prefix}_v`).value = v;
            const tInput = document.getElementById(`${prefix}_t`);
            if (tInput) tInput.value = -(u + v);
            document.getElementById(`${prefix}_w`).value = w;
            if (currentMode === 'interface') {
                dockCrystalsFaceToFace();
            } else {
                calculateEpitaxyMatch();
            }
        }
    });

    ['u', 'v', 'w'].forEach(coord => {
        document.getElementById(`${prefix}_${coord}`).addEventListener('input', () => {
            syncEpitaxyCoordSystemUI(wsId);
            populateInPlaneDirections(wsId, true);
            if (currentMode === 'interface') {
                dockCrystalsFaceToFace();
            } else {
                calculateEpitaxyMatch();
            }
        });
    });
});

['showEpiLines', 'epiPairMode', 'showEpiDistLabels'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        calculateEpitaxyMatch();
    });
});

let baseDockQuaternion = new THREE.Quaternion();

function computeDockQuaternionForDirections(plane1, plane2, dir1, dir2) {
    workspaceLeft.crystalMasterGroup.updateMatrixWorld(true);
    const worldNormal1 = plane1.normal.clone()
        .applyQuaternion(workspaceLeft.crystalMasterGroup.quaternion)
        .normalize();

    const targetNormal2 = worldNormal1.clone().negate();
    const localNormal2 = plane2.normal.clone().normalize();

    // Step 1: Rotate Crystal 2 so its contact plane normal opposes Crystal 1's contact plane normal
    const qAlignPlane = new THREE.Quaternion().setFromUnitVectors(localNormal2, targetNormal2);

    // Step 2: Rotate Crystal 2 in-plane around worldNormal1 so [u2 v2 w2] aligns parallel to [u1 v1 w1]
    if (dir1 && dir2) {
        const worldDir1 = dir1.tParallel.clone()
            .applyQuaternion(workspaceLeft.crystalMasterGroup.quaternion)
            .normalize();
        const rotatedDir2 = dir2.tParallel.clone()
            .applyQuaternion(qAlignPlane)
            .normalize();

        // Project both onto the interface plane to compute exact signed in-plane angle
        const v1 = worldDir1.clone().addScaledVector(worldNormal1, -worldDir1.dot(worldNormal1)).normalize();
        const v2 = rotatedDir2.clone().addScaledVector(worldNormal1, -rotatedDir2.dot(worldNormal1)).normalize();

        if (v1.lengthSq() > 1e-6 && v2.lengthSq() > 1e-6) {
            const cross = new THREE.Vector3().crossVectors(v2, v1);
            const sinAngle = cross.dot(worldNormal1);
            const cosAngle = THREE.MathUtils.clamp(v2.dot(v1), -1, 1);
            const inPlaneAngle = Math.atan2(sinAngle, cosAngle);
            const qAlignDir = new THREE.Quaternion().setFromAxisAngle(worldNormal1, inPlaneAngle);
            qAlignPlane.premultiply(qAlignDir);
        }
    }
    return qAlignPlane;
}

function dockCrystalsFaceToFace() {
    const [h1, k1, l1] = readEpitaxyPlane('ep1');
    const [h2, k2, l2] = readEpitaxyPlane('ep2');

    if ((h1 === 0 && k1 === 0 && l1 === 0) || (h2 === 0 && k2 === 0 && l2 === 0)) {
        alert("Please enter valid non-zero Miller indices for both crystals.");
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
    const dir1 = getDirectionAndOrthogonalInfo(workspaceLeft, 'ep1', h1, k1, l1, plane1);
    const dir2 = getDirectionAndOrthogonalInfo(workspaceRight, 'ep2', h2, k2, l2, plane2);

    baseDockQuaternion.copy(computeDockQuaternionForDirections(plane1, plane2, dir1, dir2));

    applyEpitaxyTransform();
}

function applyEpitaxyTransform() {
    const [h1, k1, l1] = readEpitaxyPlane('ep1');
    const plane1 = getPlaneVectorAndDSpacing(workspaceLeft, h1, k1, l1);
    const dir1 = getDirectionAndOrthogonalInfo(workspaceLeft, 'ep1', h1, k1, l1, plane1);

    const { worldNormal1, tangentX, tangentY } = getInterface2DBasis(plane1, dir1);

    const twistDeg = parseFloat(document.getElementById('epiTwist').value) || 0;
    const twistLbl = document.getElementById('twistLabel');
    if (twistLbl) twistLbl.innerText = `Twist φ (${twistDeg.toFixed(1)}°):`;

    const twistQuat = new THREE.Quaternion().setFromAxisAngle(worldNormal1, THREE.MathUtils.degToRad(twistDeg));
    const finalQuat = twistQuat.multiply(baseDockQuaternion);
    workspaceRight.crystalMasterGroup.quaternion.copy(finalQuat);
    workspaceRight.setRotationFromQuaternion(finalQuat);

    const gap = parseFloat(document.getElementById('epiGap').value) || 0;
    const transX = parseFloat(document.getElementById('epiTransX').value) || 0;
    const transY = parseFloat(document.getElementById('epiTransY').value) || 0;

    const slideXLbl = document.getElementById('slideXLabel');
    if (slideXLbl) slideXLbl.innerText = `Slide X∥ (${transX >= 0 ? '+' : ''}${transX.toFixed(2)}Å):`;
    const slideYLbl = document.getElementById('slideYLabel');
    if (slideYLbl) slideYLbl.innerText = `Slide Y⊥ (${transY >= 0 ? '+' : ''}${transY.toFixed(2)}Å):`;
    const gapLbl = document.getElementById('gapLabel');
    if (gapLbl) gapLbl.innerText = `Face Gap (${gap.toFixed(1)}Å):`;

    const finalPos = workspaceLeft.crystalMasterGroup.position.clone()
        .addScaledVector(worldNormal1, gap)
        .addScaledVector(tangentX, transX)
        .addScaledVector(tangentY, transY);

    workspaceRight.crystalMasterGroup.position.copy(finalPos);

    // Suppress redundant rebuild from updateCSGPlanes(): calculateEpitaxyMatch() below rebuilds the lines anyway.
    suppressInterfaceLineRefresh = true;
    try {
        workspaceRight.updateCSGPlanes();
    } finally {
        suppressInterfaceLineRefresh = false;
    }

    // Immediately recalculate Twist-dependent Matching Degree, Sheet Energy, and 2D/3D Atom Matching!
    calculateEpitaxyMatch();
}

// Computes the optimal 2D rigid-body sheet translation (bestDx, bestDy) for a given set of projected surface atoms
// by aligning the Trolliard Cationic Structural Walls (every P₁ ≈ 10.4 Å) and refining 2D cation registry
function findBestSheetSlideForState(surf1, surf2, pairMode, dir1, dir2, initDx = 0, initDy = 0) {
    if (!surf1 || !surf2 || surf1.length === 0 || surf2.length === 0) {
        return { dx: 0, dy: 0, evalRes: { energy: 1, coincidenceRatio: 0, coincidenceCount: 0, pairCount: 0, meanDrXY: Infinity } };
    }

    const lPar1 = dir1 ? dir1.lParallel : 4.0;
    const lPerp1 = dir1 ? dir1.lPerp : 3.5;
    const lPar2 = dir2 ? dir2.lParallel : 4.0;
    const lPerp2 = dir2 ? dir2.lPerp : 2.6;

    // Restrict search to the fundamental 2D wall/chain cell around (0, 0) so the central P₁ structural walls stay aligned
    const rangeX = Math.min(2.8, Math.max(1.2, Math.min(lPar1, lPar2) * 0.50));
    const rangeY = Math.min(2.2, Math.max(1.0, Math.min(lPerp1, lPerp2) * 0.50));

    let bestDx = THREE.MathUtils.clamp(initDx, -rangeX, rangeX);
    let bestDy = THREE.MathUtils.clamp(initDy, -rangeY, rangeY);
    let bestScore = Infinity;

    const scoreCandidate = (dx, dy) => {
        const res = evaluateSheetSlideEnergy(dx, dy, surf1, surf2, pairMode, dir1, dir2);
        // Primary objective: minimize normalized wall + cation misregistry energy E_int(Δx, Δy)
        // Secondary tie-breaker: prefer keeping the central structural wall pinned at (0, 0)
        return res.energy + 0.008 * Math.hypot(dx, dy);
    };

    bestScore = scoreCandidate(bestDx, bestDy);
    const zeroScore = scoreCandidate(0, 0);
    if (zeroScore <= bestScore + 1e-4) {
        bestScore = zeroScore;
        bestDx = 0;
        bestDy = 0;
    }

    // Stage 1: Coarse 2D grid scan (21 x 21 points) across the fundamental structural wall cell
    const coarseSteps = 20;
    for (let ix = 0; ix <= coarseSteps; ix++) {
        const dx = -rangeX + (2 * rangeX * ix) / coarseSteps;
        for (let iy = 0; iy <= coarseSteps; iy++) {
            const dy = -rangeY + (2 * rangeY * iy) / coarseSteps;
            const sc = scoreCandidate(dx, dy);
            if (sc < bestScore) {
                bestScore = sc;
                bestDx = dx;
                bestDy = dy;
            }
        }
    }

    // Stage 2: Fine local 2D grid refinement around (bestDx, bestDy)
    let stepRadius = Math.max(rangeX, rangeY) / coarseSteps;
    for (let pass = 0; pass < 2; pass++) {
        let passBestDx = bestDx;
        let passBestDy = bestDy;
        const subSteps = 6;
        for (let ix = -subSteps; ix <= subSteps; ix++) {
            const dx = THREE.MathUtils.clamp(bestDx + (ix / subSteps) * stepRadius, -rangeX, rangeX);
            for (let iy = -subSteps; iy <= subSteps; iy++) {
                const dy = THREE.MathUtils.clamp(bestDy + (iy / subSteps) * stepRadius, -rangeY, rangeY);
                const sc = scoreCandidate(dx, dy);
                if (sc < bestScore) {
                    bestScore = sc;
                    passBestDx = dx;
                    passBestDy = dy;
                }
            }
        }
        bestDx = passBestDx;
        bestDy = passBestDy;
        stepRadius *= 0.25;
    }

    if (Math.abs(bestDx) < 0.03) bestDx = 0;
    if (Math.abs(bestDy) < 0.03) bestDy = 0;

    const evalRes = evaluateSheetSlideEnergy(bestDx, bestDy, surf1, surf2, pairMode, dir1, dir2);
    return { dx: bestDx, dy: bestDy, evalRes };
}

// Rigid-body 2D sheet-sliding optimizer (Trolliard et al. Structural Wall & Cationic Registry alignment):
// Slides the Secondary crystal surface sheet over the Primary surface sheet in (Δx, Δy) to align the P₁ ≈ 10.4 Å walls
function autoOptimizeSheetSlide() {
    if (currentMode !== 'interface') {
        dockCrystalsFaceToFace();
    }
    if (!lastInterface2DState || !lastInterface2DState.surf1 || !lastInterface2DState.surf2) {
        updateInterfacialAtomLines();
    }
    if (!lastInterface2DState || lastInterface2DState.surf1.length === 0 || lastInterface2DState.surf2.length === 0) {
        return;
    }

    const s1 = lastInterface2DState.periodicSurf1 || lastInterface2DState.surf1;
    const s2 = lastInterface2DState.periodicSurf2 || lastInterface2DState.surf2;
    const { pairMode, dir1, dir2 } = lastInterface2DState;
    const curDx = parseFloat(document.getElementById('epiTransX').value) || 0;
    const curDy = parseFloat(document.getElementById('epiTransY').value) || 0;

    const best = findBestSheetSlideForState(s1, s2, pairMode, dir1, dir2, curDx, curDy);

    document.getElementById('epiTransX').value = best.dx.toFixed(2);
    document.getElementById('epiTransY').value = best.dy.toFixed(2);
    applyEpitaxyTransform();
}

// Automatically searches all valid in-plane direction pairs [uvw]₁ ∥ [uvw]₂, fine epitaxial twist angles φ
// (including Trolliard conjugate-axis accommodation angles), and optimal 2D sheet translations (Δx, Δy)
// to lock into the global maximum Structural Wall Matching Degree (e.g. 3*d_(1-102)sa ≈ 4*d_(020)m ≈ 10.4 Å)
function resolveLPerp(ws, h, k, l, dir, validDirs, planeNormal) {
    const tPerp = new THREE.Vector3().crossVectors(planeNormal, dir.localDir).normalize();
    const ortho = computeOrthogonalInPlaneInfo(dir.localDir, dir.period, tPerp, validDirs, ws.isHexOrTrigonal);
    let lPerp = ortho.lPerp;
    if (ws.unitLatticeMatrix) {
        try {
            const wp = Cryst.findPerpendicularWallPlane(
                ws.unitLatticeMatrix,
                [h, k, l],
                [dir.u, dir.v, dir.w],
                { isHex: ws.isHexOrTrigonal, spaceGroup: ws.crystalData?.space_group }
            );
            if (wp && wp.angleFromPerpDeg < 5.0 && wp.d > 0.5) lPerp = wp.d;
        } catch (_) {}
    }
    return { ortho, lPerp };
}

function autoOptimizeTwistAngle() {
    const [h1, k1, l1] = readEpitaxyPlane('ep1');
    const [h2, k2, l2] = readEpitaxyPlane('ep2');

    const plane1 = getPlaneVectorAndDSpacing(workspaceLeft, h1, k1, l1);
    const plane2 = getPlaneVectorAndDSpacing(workspaceRight, h2, k2, l2);
    if (plane1.d === 0 || plane2.d === 0) return;

    const dirs1 = getValidInPlaneDirections(workspaceLeft, h1, k1, l1);
    const dirs2 = getValidInPlaneDirections(workspaceRight, h2, k2, l2);
    if (dirs1.length === 0 || dirs2.length === 0) {
        dockCrystalsFaceToFace();
        autoOptimizeSheetSlide();
        return;
    }

    // Stage 1: Rank all crystallographic in-plane direction pairs (d1, d2) by Trolliard 2D Structural Wall Coincidence
    // Prioritizes perpendicular Structural Wall misfit F0_perp (n*d1_perp ≈ m*d2_perp, e.g. 3*3.48Å ≈ 4*2.60Å ≈ 10.4Å)
    // combined with compact 1:1 / 1:2 along-wall repeat (P2 ≈ P2') and small coincidence supercell area.
    const resolved2 = dirs2.map(d2 => ({ d2, ...resolveLPerp(workspaceRight, h2, k2, l2, d2, dirs2, plane2.normal) }));
    const candidatePairs = [];
    for (const d1 of dirs1) {
        const { ortho: ortho1, lPerp: lPerp1 } = resolveLPerp(workspaceLeft, h1, k1, l1, d1, dirs1, plane1.normal);
        for (const { d2, ortho: ortho2, lPerp: lPerp2 } of resolved2) {
            const mPar = findBestDomainMatch1D(d1.period, d2.period, 2, 0.015);
            const mPerp = findBestDomainMatch1D(lPerp1, lPerp2, 8, 0.015);
            const domainParLen = 0.5 * (mPar.n * d1.period + mPar.m * d2.period);
            const domainPerpLen = 0.5 * (mPerp.n * lPerp1 + mPerp.m * lPerp2);
            const metricPenalty = 0.0012 * Math.max(0, domainParLen - 6.0) + 0.0005 * Math.max(0, domainPerpLen - 11.0);
            const fEff2D = Math.sqrt(0.20 * Math.pow(mPar.effectiveMisFit, 2) + 0.80 * Math.pow(mPerp.effectiveMisFit, 2)) + metricPenalty;
            const deltaGammaDeg = ortho1.gammaDeg - ortho2.gammaDeg;
            candidatePairs.push({ d1, d2, ortho1, ortho2, fEff2D, deltaGammaDeg });
        }
    }
    candidatePairs.sort((a, b) => a.fEff2D - b.fEff2D);

    // Stage 2: Test the top crystallographic direction pairs across candidate twist angles φ and 2D sheet slides (Δx, Δy)
    const topPairs = candidatePairs.slice(0, Math.min(6, candidatePairs.length));
    let globalBest = {
        pair: topPairs[0],
        twistDeg: 0,
        dx: 0,
        dy: 0,
        matchingDegree: -1
    };

    const setDirectionInputs = (d1, d2) => {
        writeEpitaxyDir('1', d1);
        writeEpitaxyDir('2', d2);
    };

    isBatchOptimizing = true;
    try {
        for (const cand of topPairs) {
            setDirectionInputs(cand.d1, cand.d2);
            const dir1 = getDirectionAndOrthogonalInfo(workspaceLeft, 'ep1', h1, k1, l1, plane1);
            const dir2 = getDirectionAndOrthogonalInfo(workspaceRight, 'ep2', h2, k2, l2, plane2);
            baseDockQuaternion.copy(computeDockQuaternionForDirections(plane1, plane2, dir1, dir2));

            // Build candidate twist angles φ:
            // - 0° (strict parallel zone-axis alignment per Trolliard OR1/OR2)
            // - ±0.5 * Δγ (conjugate-axis angular accommodation)
            const twistSet = new Set([0, -1, 1]);
            if (Math.abs(cand.deltaGammaDeg) > 0.2 && Math.abs(cand.deltaGammaDeg) <= 15) {
                twistSet.add(Number((0.5 * cand.deltaGammaDeg).toFixed(1)));
                twistSet.add(Number((-0.5 * cand.deltaGammaDeg).toFixed(1)));
            }

            for (const twistDeg of twistSet) {
                document.getElementById('epiTwist').value = twistDeg;
                document.getElementById('epiTransX').value = 0;
                document.getElementById('epiTransY').value = 0;
                applyEpitaxyTransform();

                let dx = 0;
                let dy = 0;
                let slideEval = null;
                if (lastInterface2DState && lastInterface2DState.surf1 && lastInterface2DState.surf2) {
                    const s1 = lastInterface2DState.periodicSurf1 || lastInterface2DState.surf1;
                    const s2 = lastInterface2DState.periodicSurf2 || lastInterface2DState.surf2;
                    const bestSlide = findBestSheetSlideForState(
                        s1, s2, lastInterface2DState.pairMode, dir1, dir2, 0, 0
                    );
                    dx = bestSlide.dx;
                    dy = bestSlide.dy;
                    slideEval = bestSlide.evalRes;
                }
                const stateEval = evaluate2DDomainMatch(
                    workspaceLeft.crystalMasterGroup.quaternion,
                    workspaceRight.crystalMasterGroup.quaternion,
                    plane1, plane2, dir1, dir2, slideEval
                );
                if (stateEval.matchingDegree > globalBest.matchingDegree) {
                    globalBest = {
                        pair: cand,
                        twistDeg,
                        dx,
                        dy,
                        matchingDegree: stateEval.matchingDegree
                    };
                }
            }
        }
    } finally {
        isBatchOptimizing = false;
    }

    // Apply the globally optimal [uvw]₁, [uvw]₂, Twist φ, and 2D Sheet Slide (Δx, Δy)
    setDirectionInputs(globalBest.pair.d1, globalBest.pair.d2);
    populateInPlaneDirections('1', true);
    populateInPlaneDirections('2', true);
    document.getElementById('epiTwist').value = globalBest.twistDeg.toFixed(1);
    document.getElementById('epiTransX').value = globalBest.dx.toFixed(2);
    document.getElementById('epiTransY').value = globalBest.dy.toFixed(2);
    dockCrystalsFaceToFace();
}

document.getElementById('btnDockCrystal').addEventListener('click', dockCrystalsFaceToFace);
document.getElementById('btnAutoTwist').addEventListener('click', autoOptimizeTwistAngle);
document.getElementById('btnAutoSlide').addEventListener('click', autoOptimizeSheetSlide);

document.getElementById('btnResetSlideX').addEventListener('click', () => {
    document.getElementById('epiTransX').value = 0;
    applyEpitaxyTransform();
});
document.getElementById('btnResetSlideY').addEventListener('click', () => {
    document.getElementById('epiTransY').value = 0;
    applyEpitaxyTransform();
});
document.getElementById('btnResetTwist').addEventListener('click', () => {
    document.getElementById('epiTwist').value = 0;
    applyEpitaxyTransform();
});

['epiTransX', 'epiTransY', 'epiGap', 'epiTwist'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyEpitaxyTransform);
});

// ============================================================================
// --- INTERACTIVE 2D TROLLIARD INTERFACE & SHEET-SLIDING PROJECTION PANEL ---
// ============================================================================
const trolliard2DWrapper = document.createElement('div');
Object.assign(trolliard2DWrapper.style, {
    position: 'absolute',
    top: '62px',
    left: '345px',
    width: '435px',
    background: 'rgba(14, 18, 26, 0.96)',
    border: '1px solid #3d6b99',
    borderRadius: '8px',
    boxShadow: '0 8px 28px rgba(0, 0, 0, 0.85)',
    color: '#eee',
    fontFamily: 'sans-serif',
    zIndex: '25',
    display: 'none',
    userSelect: 'none',
    overflow: 'hidden'
});

trolliard2DWrapper.innerHTML = `
    <div id="trolliard2DHeader" style="background:linear-gradient(90deg, #162b40, #1f3a52); padding:6px 10px; border-bottom:1px solid #355c82; display:flex; justify-content:space-between; align-items:center; cursor:move;">
        <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12.5px; font-weight:bold; color:#77ddff;">🗺️ 2D Cationic Sublattice Projection (Trolliard Fig. 3)</span>
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
            <button id="btn2DAutoSlide" style="background:#8b4789; color:#fff; border:1px solid #b86bb5; border-radius:3px; font-size:10px; font-weight:bold; padding:2px 6px; cursor:pointer;" title="Align Structural Walls (P₁ ≈ 10.4 Å) & Cationic Registry">⚡ Align Walls</button>
            <button id="btn2DCenter" style="background:#2a3b4c; color:#ddd; border:1px solid #4d6a88; border-radius:3px; font-size:10px; padding:2px 6px; cursor:pointer;" title="Reset 2D View Zoom & Pan">🎯 Fit</button>
            <button id="btnClose2DMap" style="background:#442222; color:#ff9999; border:1px solid #773333; border-radius:3px; font-size:11px; font-weight:bold; padding:1px 6px; cursor:pointer;" title="Hide 2D Interface Map">✕</button>
        </div>
    </div>
    <div style="background:#111722; padding:4px 8px; border-bottom:1px solid #263547; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; font-size:10px;">
        <label style="cursor:pointer; color:#ffdd77; display:flex; align-items:center; gap:3px; font-weight:bold;" title="Project only cations (Al³⁺ and Zr⁴⁺) without Oxygen (O²⁻), matching Trolliard et al. (2006) Fig. 3">
            <input type="checkbox" id="chk2DCationsOnly" checked> ⚛️ Cations Only (No O²⁻)
        </label>
        <label style="cursor:pointer; color:#00ff88; display:flex; align-items:center; gap:3px; font-weight:bold;" title="Highlight Coincident Structural Walls every P₁ = n×d₁⊥ ≈ m×d₂⊥ (e.g. 3×3.48Å ≈ 4×2.61Å ≈ 10.4Å)">
            <input type="checkbox" id="chk2DOPoints" checked> 🧱 Structural Walls (P₁)
        </label>
        <label style="cursor:pointer; color:#ffcc66; display:flex; align-items:center; gap:3px;" title="Show Primary & Secondary 2D cation lines & coincidence supercell (P₁ × P₂)">
            <input type="checkbox" id="chk2DGrids" checked> 📏 Cation Lines
        </label>
        <label style="cursor:pointer; color:#77ddff; display:flex; align-items:center; gap:3px;" title="Show 2D lateral mismatch vectors Δr_xy between paired cations">
            <input type="checkbox" id="chk2DVectors"> 🔗 Δr Vectors
        </label>
        <label style="cursor:pointer; color:#66ffaa; display:flex; align-items:center; gap:3px;" title="Show 2D interfacial wall-alignment landscape as background">
            <input type="checkbox" id="chk2DEnergyMap"> 🔥 Wall Potential
        </label>
    </div>
    <div style="position:relative; width:435px; height:330px; background:#090d14;">
        <canvas id="trolliard2DCanvas" width="435" height="330" style="width:435px; height:330px; display:block; cursor:grab;"></canvas>
    </div>
    <div style="background:#111722; padding:5px 8px; border-top:1px solid #263547; font-size:10.5px; color:#aaa; display:flex; justify-content:space-between; align-items:center;">
        <span>🖱️ <b>Drag:</b> Slide Sheet (Δy⊥, Δx∥) | <b>Shift+Drag:</b> Twist φ | <b>Dbl-Click:</b> Align Walls</span>
        <span id="trolliard2DZoomText" style="color:#88bbdd; font-family:monospace;">Scale: 16 px/Å</span>
    </div>
`;
document.body.appendChild(trolliard2DWrapper);

let trolliard2DZoom = 16.0; // pixels per Å (16 px/Å spans ±13.6 Å horizontally so P₁ = ±10.4 Å walls are clearly visible)
let is2DMapVisible = true;

document.getElementById('btnToggle2DMap').addEventListener('click', () => {
    is2DMapVisible = !is2DMapVisible;
    trolliard2DWrapper.style.display = (currentMode === 'interface' && is2DMapVisible) ? 'block' : 'none';
    if (is2DMapVisible) {
        if (!lastInterface2DState) updateInterfacialAtomLines();
        else renderTrolliard2DMap();
    }
});

document.getElementById('btnClose2DMap').addEventListener('click', () => {
    is2DMapVisible = false;
    trolliard2DWrapper.style.display = 'none';
});

document.getElementById('btn2DAutoSlide').addEventListener('click', autoOptimizeSheetSlide);
document.getElementById('btn2DCenter').addEventListener('click', () => {
    trolliard2DZoom = 16.0;
    const zEl = document.getElementById('trolliard2DZoomText');
    if (zEl) zEl.innerText = `Scale: ${trolliard2DZoom.toFixed(0)} px/Å`;
    renderTrolliard2DMap();
});

['chk2DCationsOnly', 'chk2DEnergyMap', 'chk2DGrids', 'chk2DVectors', 'chk2DOPoints'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderTrolliard2DMap);
});

// Make the 2D Trolliard Panel draggable by its header
(() => {
    const header = document.getElementById('trolliard2DHeader');
    let draggingPanel = false;
    let startX = 0, startY = 0, initLeft = 0, initTop = 0;

    header.addEventListener('pointerdown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        draggingPanel = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = trolliard2DWrapper.getBoundingClientRect();
        initLeft = rect.left;
        initTop = rect.top;
        header.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', (e) => {
        if (!draggingPanel) return;
        const nx = Math.max(0, Math.min(window.innerWidth - 180, initLeft + (e.clientX - startX)));
        const ny = Math.max(50, Math.min(window.innerHeight - 80, initTop + (e.clientY - startY)));
        trolliard2DWrapper.style.left = `${nx}px`;
        trolliard2DWrapper.style.top = `${ny}px`;
    });

    header.addEventListener('pointerup', (e) => {
        draggingPanel = false;
        try { header.releasePointerCapture(e.pointerId); } catch (_) {}
    });
})();

// Interactive 2D Paper-Sheet Sliding & Twisting directly inside the 2D Trolliard Canvas
(() => {
    const canvas2D = document.getElementById('trolliard2DCanvas');
    let draggingSheet = false;
    let lastX = 0, lastY = 0;

    canvas2D.addEventListener('pointerdown', (e) => {
        draggingSheet = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas2D.style.cursor = 'grabbing';
        canvas2D.setPointerCapture(e.pointerId);
    });

    canvas2D.addEventListener('pointermove', (e) => {
        if (!draggingSheet) return;
        const dxPx = e.clientX - lastX;
        const dyPx = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        if (e.shiftKey) {
            // Shift + Drag rotates (twists φ) Secondary sheet in-plane
            const curTwist = parseFloat(document.getElementById('epiTwist').value) || 0;
            let nextTwist = curTwist + dxPx * 0.35;
            if (nextTwist > 180) nextTwist -= 360;
            if (nextTwist < -180) nextTwist += 360;
            document.getElementById('epiTwist').value = nextTwist.toFixed(1);
        } else {
            // In Trolliard Fig. 3b orientation:
            // Screen Horizontal (dxPx) = Perpendicular to Structural Walls (Y⊥, epiTransY)
            // Screen Vertical Upward (-dyPx) = Parallel to Structural Walls (X∥, epiTransX)
            const curX = parseFloat(document.getElementById('epiTransX').value) || 0;
            const curY = parseFloat(document.getElementById('epiTransY').value) || 0;
            const nextY = THREE.MathUtils.clamp(curY + dxPx / trolliard2DZoom, -10, 10);
            const nextX = THREE.MathUtils.clamp(curX - dyPx / trolliard2DZoom, -10, 10);
            document.getElementById('epiTransX').value = nextX.toFixed(2);
            document.getElementById('epiTransY').value = nextY.toFixed(2);
        }
        applyEpitaxyTransform();
    });

    const endDrag = (e) => {
        if (!draggingSheet) return;
        draggingSheet = false;
        canvas2D.style.cursor = 'grab';
        try { canvas2D.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    canvas2D.addEventListener('pointerup', endDrag);
    canvas2D.addEventListener('pointercancel', endDrag);

    canvas2D.addEventListener('dblclick', () => {
        autoOptimizeSheetSlide();
    });

    canvas2D.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        trolliard2DZoom = THREE.MathUtils.clamp(trolliard2DZoom * factor, 10, 65);
        const zEl = document.getElementById('trolliard2DZoomText');
        if (zEl) zEl.innerText = `Scale: ${trolliard2DZoom.toFixed(0)} px/Å`;
        renderTrolliard2DMap();
    }, { passive: false });
})();

// Renders the Top-Down 2D Trolliard Cationic Sublattice & Structural Wall Projection (Trolliard et al. 2006, Fig. 3)
// Oriented to match Fig. 3b of the paper:
// - Vertical axis (upward) = Common direction [u₁v₁w₁] ∥ [u₂v₂w₂] (coordinate X∥), so Structural Walls run VERTICALLY.
// - Horizontal axis (rightward) = Perpendicular to Structural Walls (coordinate Y⊥), showing n×d₁⊥ ≈ m×d₂⊥ ≈ 10.4 Å.
function renderTrolliard2DMap() {
    if (currentMode !== 'interface' || !is2DMapVisible || trolliard2DWrapper.style.display === 'none') {
        return;
    }
    const canvas = document.getElementById('trolliard2DCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W * 0.5;
    const cy = H * 0.54;
    const scale = trolliard2DZoom; // px per Å

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, W, H);

    if (!lastInterface2DState || !lastInterface2DState.surf1 || !lastInterface2DState.surf2) {
        ctx.fillStyle = '#8899aa';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Load Primary & Secondary crystals to view 2D interface projection.', cx, cy);
        return;
    }

    const {
        h1, k1, l1, h2, k2, l2,
        dir1, dir2,
        tangentX, tangentY,
        surf1, surf2, periodicSurf1, periodicSurf2,
        currTransX, currTransY,
        pairMode
    } = lastInterface2DState;

    const cationsOnly = document.getElementById('chk2DCationsOnly')?.checked ?? true;
    const showEnergyMap = document.getElementById('chk2DEnergyMap')?.checked;
    const showGrids = document.getElementById('chk2DGrids')?.checked;
    const showVectors = document.getElementById('chk2DVectors')?.checked;
    const showWalls = document.getElementById('chk2DOPoints')?.checked;

    const rawAtoms1 = periodicSurf1 || surf1;
    const rawAtoms2 = periodicSurf2 || surf2;
    const plotAtoms1 = cationsOnly ? rawAtoms1.filter(a => !a.isAnion) : rawAtoms1;
    const plotAtoms2 = cationsOnly ? rawAtoms2.filter(a => !a.isAnion) : rawAtoms2;

    // Trolliard Fig. 3b screen mapping:
    // Horizontal screen X = Y_perp (perpendicular to structural walls)
    // Vertical screen Y = -X_par (parallel to structural walls)
    const toScreenX = (yPerpAng) => cx + yPerpAng * scale;
    const toScreenY = (xParAng) => cy - xParAng * scale;

    // 1. Optional 2D Interfacial Potential Landscape Heatmap E_int(Δx∥, Δy⊥)
    if (showEnergyMap && plotAtoms1.length > 0 && plotAtoms2.length > 0) {
        const gridCols = 32;
        const gridRows = 24;
        const cellW = W / gridCols;
        const cellH = H / gridRows;

        for (let gx = 0; gx < gridCols; gx++) {
            const worldYPerp = ((gx + 0.5) * cellW - cx) / scale;
            for (let gy = 0; gy < gridRows; gy++) {
                const worldXPar = (cy - (gy + 0.5) * cellH) / scale;
                const ev = evaluateSheetSlideEnergy(worldXPar, worldYPerp, plotAtoms1, plotAtoms2, cationsOnly ? 'cation_cation' : pairMode, dir1, dir2);
                const eNorm = ev.energy;
                let r, g, b;
                if (eNorm < 0.45) {
                    const t = eNorm / 0.45;
                    r = Math.round(8 + t * 18);
                    g = Math.round(85 - t * 45);
                    b = Math.round(65 - t * 20);
                } else {
                    const t = (eNorm - 0.45) / 0.55;
                    r = Math.round(26 + t * 48);
                    g = Math.round(40 - t * 26);
                    b = Math.round(45 - t * 25);
                }
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.38)`;
                ctx.fillRect(gx * cellW, gy * cellH, Math.ceil(cellW), Math.ceil(cellH));
            }
        }
    }

    // Compute in-plane angle α of Secondary [u2 v2 w2] relative to Primary [u1 v1 w1]
    let angle2Rad = 0;
    if (dir2 && dir2.tParallel) {
        const wDir2 = dir2.tParallel.clone()
            .applyQuaternion(workspaceRight.crystalMasterGroup.quaternion);
        const compX = wDir2.dot(tangentX);
        const compY = wDir2.dot(tangentY);
        if (Math.hypot(compX, compY) > 1e-5) {
            angle2Rad = Math.atan2(compY, compX);
        }
    }

    // 2. Render Vertical Cationic Lines & Structural Wall Coincidence Bands (Trolliard et al. Fig. 3b: n×d₁⊥ ≈ m×d₂⊥ ≈ 10.4 Å)
    if (dir1 && dir2) {
        const l1Par = Math.max(0.5, dir1.lParallel);
        const d1Perp = Math.max(0.5, dir1.lPerp);
        const l2Par = Math.max(0.5, dir2.lParallel);
        const d2Perp = Math.max(0.5, dir2.lPerp);

        const mPar = findBestDomainMatch1D(l1Par, l2Par, 4, 0.015);
        const mPerp = findBestDomainMatch1D(d1Perp, d2Perp, 8, 0.015);
        const P1_1 = mPerp.n * d1Perp;
        const P1_2 = mPerp.m * d2Perp;
        const P1_avg = 0.5 * (P1_1 + P1_2);

        const maxWalls1 = Math.min(14, Math.ceil((W * 0.55 / scale) / d1Perp) + 1);
        const maxWalls2 = Math.min(14, Math.ceil((W * 0.55 / scale) / d2Perp) + 1);

        // 2a. Highlight Coincident Structural Walls every P₁ = n×d₁⊥ ≈ m×d₂⊥ (e.g. -10.44 Å, 0.00 Å, +10.44 Å)
        if (showWalls) {
            const maxSuperWalls = Math.floor(maxWalls1 / Math.max(1, mPerp.n));
            for (let k = -maxSuperWalls; k <= maxSuperWalls; k++) {
                const yWall1 = k * P1_1;
                // Find closest Secondary mPerp.m-th wall shifted by currTransY
                const yWall2 = k * P1_2 + currTransY;
                const wallMismatch = Math.abs(yWall1 - yWall2);
                const sx1 = toScreenX(yWall1);
                const sx2 = toScreenX(yWall2);
                const sxMid = 0.5 * (sx1 + sx2);

                // Glowing green Coincident Structural Wall band when Secondary wall is aligned with Primary wall
                const isWallLocked = wallMismatch <= 0.45;
                ctx.save();
                ctx.fillStyle = isWallLocked ? 'rgba(0, 255, 128, 0.13)' : 'rgba(255, 180, 50, 0.08)';
                ctx.fillRect(sxMid - 8, 0, 16, H);

                ctx.strokeStyle = isWallLocked ? '#00ff88' : '#ffaa44';
                ctx.lineWidth = isWallLocked ? 2.4 : 1.5;
                ctx.beginPath();
                ctx.moveTo(sx1, 0);
                ctx.lineTo(sx1, H);
                ctx.stroke();

                // Label the P₁ structural wall coordinate near the bottom
                ctx.fillStyle = isWallLocked ? '#00ff88' : '#ffcc66';
                ctx.font = 'bold 9.5px monospace';
                ctx.textAlign = 'center';
                const wallTag = k === 0 ? 'Wall 0 (0.0Å)' : `${k > 0 ? '+' : ''}${yWall1.toFixed(1)}Å`;
                ctx.fillText(wallTag, sx1, H - 24);
                ctx.restore();
            }

            // Draw P₁ = n×d₁⊥ ≈ m×d₂⊥ dimension arrow between Wall 0 (0.0 Å) and Wall +1 (+P₁ ≈ +10.44 Å)
            const sxZero = toScreenX(0);
            const sxPlusP1 = toScreenX(P1_1);
            if (sxPlusP1 < W - 8) {
                const dimY = 66;
                ctx.save();
                ctx.fillStyle = 'rgba(8, 24, 18, 0.88)';
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 1.2;
                ctx.fillRect(sxZero, dimY - 13, sxPlusP1 - sxZero, 18);
                ctx.strokeRect(sxZero, dimY - 13, sxPlusP1 - sxZero, 18);

                ctx.fillStyle = '#00ff88';
                ctx.font = 'bold 9.5px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`P₁=${P1_avg.toFixed(2)}Å (${mPerp.n}d₁≈${mPerp.m}d₂)`, 0.5 * (sxZero + sxPlusP1), dimY - 1);
                ctx.restore();
            }
        }

        // 2b. Primary & Secondary Vertical Cationic Lines (every d₁⊥ = 3.48 Å and d₂⊥ = 2.61 Å) + Coincidence Supercell Box
        if (showGrids) {
            // Primary Vertical Cation Wall Lines (Gold, spaced every d₁⊥)
            ctx.save();
            for (let iw = -maxWalls1; iw <= maxWalls1; iw++) {
                const isMajor = (iw % mPerp.n) === 0;
                const sx = toScreenX(iw * d1Perp);
                ctx.strokeStyle = isMajor ? 'rgba(255, 204, 68, 0.65)' : 'rgba(255, 204, 68, 0.28)';
                ctx.lineWidth = isMajor ? 1.5 : 1.0;
                ctx.beginPath();
                ctx.moveTo(sx, 0);
                ctx.lineTo(sx, H);
                ctx.stroke();
            }
            ctx.restore();

            // Secondary Vertical Cation Wall Lines (Cyan, spaced every d₂⊥, translated by currTransY and rotated by angle2Rad)
            ctx.save();
            ctx.translate(toScreenX(currTransY), toScreenY(currTransX));
            ctx.rotate(angle2Rad);
            for (let iw = -maxWalls2; iw <= maxWalls2; iw++) {
                const isMajor = (iw % mPerp.m) === 0;
                const sx = iw * d2Perp * scale;
                ctx.strokeStyle = isMajor ? 'rgba(0, 221, 255, 0.75)' : 'rgba(0, 221, 255, 0.30)';
                ctx.lineWidth = isMajor ? 1.5 : 1.0;
                ctx.setLineDash([4, 3]);
                ctx.beginPath();
                ctx.moveTo(sx, -H);
                ctx.lineTo(sx, H);
                ctx.stroke();
            }
            ctx.restore();

            // Highlight Coincidence Supercell Domain Parallelogram (width P₁ = n×d₁⊥, height P₂ = n∥×L₁∥, conjugate angle γ₁)
            const gamma1Rad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(dir1.gammaDeg ?? 90, 30, 150));
            const cot1 = Math.abs(Math.sin(gamma1Rad)) > 0.2 ? (Math.cos(gamma1Rad) / Math.sin(gamma1Rad)) : 0;
            const domW = P1_1 * scale;
            const domH = mPar.n * l1Par * scale;
            const shearY = domW * cot1;

            ctx.save();
            ctx.fillStyle = 'rgba(255, 204, 68, 0.07)';
            ctx.strokeStyle = 'rgba(255, 215, 80, 0.90)';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(cx, cy + domH * 0.5);
            ctx.lineTo(cx + domW, cy + domH * 0.5 - shearY);
            ctx.lineTo(cx + domW, cy - domH * 0.5 - shearY);
            ctx.lineTo(cx, cy - domH * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    // 3. Render 2D Lateral Matching Vectors (Δr_xy) if toggled
    if (showVectors && plotAtoms1.length > 0 && plotAtoms2.length > 0) {
        for (const a1 of plotAtoms1) {
            let bestA2 = null;
            let bestDr = 1.8;
            for (const a2 of plotAtoms2) {
                const dr = Math.hypot(a2.x - a1.x, a2.y - a1.y);
                if (dr < bestDr) {
                    bestDr = dr;
                    bestA2 = a2;
                }
            }
            if (bestA2) {
                ctx.save();
                ctx.strokeStyle = bestDr < 0.75 ? '#00ff88' : '#ffcc44';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(toScreenX(a1.y), toScreenY(a1.x));
                ctx.lineTo(toScreenX(bestA2.y), toScreenY(bestA2.x));
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    // 4. Render Primary Interfacial Surface Cations (Fixed Sheet - Filled Circles ● Al³⁺ per Trolliard Fig. 3)
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#442800';
    for (const a1 of plotAtoms1) {
        const sx = toScreenX(a1.y);
        const sy = toScreenY(a1.x);
        if (sx < -12 || sx > W + 12 || sy < -12 || sy > H + 12) continue;
        const r = a1.isAnion ? 5.2 : 4.6;

        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = a1.isAnion ? 'rgba(255, 80, 80, 0.55)' : '#ffcc44';
        ctx.fill();
        ctx.stroke();
    }

    // 5. Render Secondary Interfacial Surface Cations (Sliding Sheet - Open/Cyan Rings ○ Zr⁴⁺ per Trolliard Fig. 3)
    ctx.lineWidth = 2.2;
    for (const a2 of plotAtoms2) {
        const sx = toScreenX(a2.y);
        const sy = toScreenY(a2.x);
        if (sx < -12 || sx > W + 12 || sy < -12 || sy > H + 12) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, 5.2, 0, Math.PI * 2);
        ctx.fillStyle = a2.isAnion ? 'rgba(255, 100, 100, 0.35)' : 'rgba(0, 40, 65, 0.75)';
        ctx.fill();
        ctx.strokeStyle = a2.isAnion ? '#ff6666' : '#00eeff';
        ctx.stroke();
    }
    ctx.restore();

    // 6. Crystallographic Reference Axes (Vertical = Common Zone Axis [uvw]₁∥[uvw]₂, Horizontal = ⊥ Structural Walls)
    const drawArrow2D = (x0, y0, x1, y1, color, label) => {
        const headLen = 6;
        const ang = Math.atan2(y1 - y0, x1 - x0);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - headLen * Math.cos(ang - Math.PI / 6), y1 - headLen * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(x1 - headLen * Math.cos(ang + Math.PI / 6), y1 - headLen * Math.sin(ang + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        if (label) {
            ctx.font = 'bold 9.5px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(label, x1 + 4, y1 + 3);
        }
        ctx.restore();
    };

    const axX = 28;
    const axY = H - 36;
    const lblDir1 = dir1 ? `${dir1.dirLabel}₁` : '[uvw]₁';
    const lblPerp1 = dir1 ? `⊥ ${dir1.perpLabel}₁` : '⊥ Walls';
    drawArrow2D(axX, axY, axX, axY - 42, '#ffcc44', lblDir1);
    drawArrow2D(axX, axY, axX + 42, axY, '#00ff88', lblPerp1);

    // 7. Top-Left Legend / HUD Overlay inside 2D Canvas
    const p1Label = workspaceLeft.formatPlaneLabel(h1, k1, l1);
    const p2Label = workspaceRight.formatPlaneLabel(h2, k2, l2);
    const twistDeg = parseFloat(document.getElementById('epiTwist')?.value) || 0;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 24, 0.88)';
    ctx.strokeStyle = '#2d4a68';
    ctx.lineWidth = 1;
    ctx.fillRect(6, 6, 286, 46);
    ctx.strokeRect(6, 6, 286, 46);

    ctx.font = 'bold 10.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffcc44';
    ctx.fillText(`● Primary ${p1Label} Cations (d₁⊥=${dir1 ? dir1.lPerp.toFixed(2) : '--'}Å)`, 12, 20);
    ctx.fillStyle = '#00eeff';
    ctx.fillText(`◯ Secondary ${p2Label} Cations (d₂⊥=${dir2 ? dir2.lPerp.toFixed(2) : '--'}Å)`, 12, 34);
    ctx.fillStyle = '#66ffaa';
    ctx.font = '10px monospace';
    ctx.fillText(`Slide Δy⊥:${currTransY >= 0 ? '+' : ''}${currTransY.toFixed(2)}Å  Δx∥:${currTransX >= 0 ? '+' : ''}${currTransX.toFixed(2)}Å  φ:${twistDeg.toFixed(1)}°`, 12, 47);

    // 5 Å Scale Bar in bottom-right corner
    const barAngstrom = 5.0;
    const barPx = barAngstrom * scale;
    const bx = W - barPx - 14;
    const by = H - 12;
    ctx.fillStyle = 'rgba(10, 15, 24, 0.85)';
    ctx.fillRect(bx - 6, by - 16, barPx + 12, 22);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + barPx, by);
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(bx, by + 4);
    ctx.moveTo(bx + barPx, by - 4);
    ctx.lineTo(bx + barPx, by + 4);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${barAngstrom} Å`, bx + barPx * 0.5, by - 5);
    ctx.restore();
}

// --- GLOBAL MOUSE DRAG & ROTATION / SHEET-SLIDING LOGIC ---
let activeDragMode = 'camera';
document.addEventListener('change', e => {
    if (e.target.name === 'dragAction') {
        activeDragMode = e.target.value;
        workspaceLeft.controls.enabled = (activeDragMode === 'camera');
    }
});

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

workspaceLeft.eventZone.addEventListener('pointerdown', (e) => {
    if (activeDragMode === 'camera') return;
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointermove', (e) => {
    if (!isDragging || activeDragMode === 'camera') return;

    const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
    };

    if (activeDragMode === 'slide_sheet') {
        // Direct 3D viewport paper-sheet sliding along (tangentX, tangentY)
        const slideSpeed = 0.025; // Å per pixel
        const curX = parseFloat(document.getElementById('epiTransX').value) || 0;
        const curY = parseFloat(document.getElementById('epiTransY').value) || 0;
        document.getElementById('epiTransX').value = THREE.MathUtils.clamp(curX + deltaMove.x * slideSpeed, -10, 10).toFixed(2);
        document.getElementById('epiTransY').value = THREE.MathUtils.clamp(curY - deltaMove.y * slideSpeed, -10, 10).toFixed(2);
        applyEpitaxyTransform();
        previousMousePosition = { x: e.clientX, y: e.clientY };
        return;
    }

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
    ws.setRotationFromQuaternion(ws.crystalMasterGroup.quaternion);
    ws.updateCSGPlanes();

    if (ws.id === '2') {
        baseDockQuaternion.copy(ws.crystalMasterGroup.quaternion);
        document.getElementById('epiTwist').value = 0;
        document.getElementById('twistLabel').innerText = `Twist φ (0.0°):`;
    }

    // Live update Matching Degree and Atom-to-Atom Lines during 3D manual spin!
    if (epitaxyWrapper.style.display === 'block') calculateEpitaxyMatch();

    previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointerup', () => { isDragging = false; });
window.addEventListener('pointercancel', () => { isDragging = false; });

// --- WORKSPACE MODE SWITCHER ---
document.getElementById('workspaceMode').addEventListener('change', (e) => {
    currentMode = e.target.value;
    const isInterface = currentMode === 'interface';
    const showRight = currentMode !== 'single';

    splitDivider.style.display = currentMode === 'dual' ? 'block' : 'none';
    workspaceRight.eventZone.style.display = currentMode === 'dual' ? 'block' : 'none';
    workspaceRight.uiWrapper.style.display = showRight ? 'block' : 'none';
    workspaceRight.hudLegend.style.display = showRight ? 'flex' : 'none';
    epitaxyWrapper.style.display = isInterface ? 'block' : 'none';
    trolliard2DWrapper.style.display = (isInterface && is2DMapVisible) ? 'block' : 'none';
    if (showRight) workspaceRight.retractor.show();

    ['posX_2', 'posY_2', 'posZ_2'].forEach(id => {
        document.getElementById(id).disabled = isInterface;
    });

    if (isInterface) {
        epitaxyRetractor.show();
        workspaceLeft.retractor.show();
        workspaceRight.scene.remove(workspaceRight.crystalMasterGroup);
        workspaceLeft.scene.add(workspaceRight.crystalMasterGroup);
        populateInPlaneDirections('1', true);
        populateInPlaneDirections('2', true);
        dockCrystalsFaceToFace();
    } else {
        isDragging = false;
        activeDragMode = 'camera';
        workspaceLeft.controls.enabled = true;
        const camRadio = document.querySelector('input[name="dragAction"][value="camera"]');
        if (camRadio) camRadio.checked = true;

        workspaceLeft.scene.remove(workspaceRight.crystalMasterGroup);
        workspaceRight.scene.add(workspaceRight.crystalMasterGroup);
        disposeGroup(interfaceLinesGroup);
        disposeGroup(interfaceLabelsGroup);

        ['posX_2', 'posY_2', 'posZ_2'].forEach(id => {
            document.getElementById(id).value = 0;
        });
        workspaceRight.crystalMasterGroup.position.set(0, 0, 0);
        workspaceRight.updateMagneticAnalytics(false);
    }
    triggerResize();
});

function triggerResize() {
    const w = window.innerWidth;
    const h = window.innerHeight - 50;
    renderer.setSize(w, h);

    if (currentMode === 'single' || currentMode === 'interface') {
        workspaceLeft.eventZone.style.width = '100%';
        updateWorkspaceCameras(workspaceLeft, w / h);
    } else {
        workspaceLeft.eventZone.style.width = '50%';
        const aspect = (w / 2) / h;
        updateWorkspaceCameras(workspaceLeft, aspect);
        updateWorkspaceCameras(workspaceRight, aspect);
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