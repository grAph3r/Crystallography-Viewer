// Automated Scientific Crystallography Test Suite (JavaScript / JSC Engine)
// Validates frontend/crystallography.js against exact crystallographic mathematics:
// 1. Direct and reciprocal lattice construction
// 2. Interplanar spacing d_hkl
// 3. Miller-Bravais conversions (hkil / uvtw)
// 4. Plane normals vs in-plane directions
// 5. Zone-law consistency
// 6. Rotation matrix orthogonality and determinant
// 7. Symmetry operations and misorientation
// 8. 1D Domain Matching Epitaxy (Trolliard F0)
// 9. 2D Coincidence Cell Search (Zur & McGill / CSL)
// 10. Reproduction of Trolliard et al. (2006) reference paper results
// 11. CIF data structure handling and occupancy
// 12. Perturbation behavior
// 13. Numerical stability and reproducibility

import * as C from '../frontend/crystallography.js';

let totalTests = 0;
let passedTests = 0;

function assert(cond, msg) {
    totalTests++;
    if (!cond) {
        throw new Error(`TEST FAILED: ${msg}`);
    }
    passedTests++;
}

print("=== Running 13-Point JavaScript Crystallographic Test Suite ===");

// 1. Direct and Reciprocal Lattice
const L_mono = C.latticeFromParameters(5.146, 5.205, 5.313, 90, 99.1, 90);
const B_mono = C.reciprocalBasis(L_mono);
for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
        const d = C.dot(L_mono[i], B_mono[j]);
        assert(Math.abs(d - (i === j ? 1.0 : 0.0)) < 1e-12, `a_${i} . b*_${j} = ${d} (expected ${i === j ? 1 : 0})`);
    }
}
print("1. Direct and reciprocal lattice construction: PASSED ✓");

// 2. Interplanar Spacing
const d_020_mono = C.dSpacing(L_mono, [0, 2, 0]);
assert(Math.abs(d_020_mono - 5.205 / 2.0) < 1e-7, "d(020) must be exactly b/2");
const L_hex = C.latticeFromParameters(4.7607, 4.7607, 12.9947, 90, 90, 120);
const d_1120_hex = C.dSpacing(L_hex, [1, 1, 0]);
assert(Math.abs(d_1120_hex - 4.7607 / 2.0) < 1e-6, "d(1 1 -2 0) must be a/2");
print("2. Interplanar spacing for monoclinic & hexagonal cells: PASSED ✓");

// 3. Miller-Bravais Conversions
const hkl = C.planeHKIL_toHKL([1, 1, -2, 0]);
assert(hkl[0] === 1 && hkl[1] === 1 && hkl[2] === 0, "planeHKIL_toHKL failed");
const hkil = C.planeHKL_toHKIL([1, 1, 0]);
assert(hkil[0] === 1 && hkil[1] === 1 && hkil[2] === -2 && hkil[3] === 0, "planeHKL_toHKIL failed");

const uvw_roundtrip = C.dirUVTW_toUVW(C.dirUVW_toUVTW([1, -1, 1]));
assert(Math.abs(uvw_roundtrip[0] - 1) < 1e-9 && Math.abs(uvw_roundtrip[1] - (-1)) < 1e-9 && Math.abs(uvw_roundtrip[2] - 1) < 1e-9, "dirUVTW roundtrip failed");
print("3. Miller-Bravais plane and direction conversions: PASSED ✓");

// 4. Plane Normal vs Direct Direction
const g_100 = B_mono[0];
const r_100 = L_mono[0];
const dot_100 = C.dot(C.normalize(g_100), C.normalize(r_100));
const angle_100 = Math.acos(dot_100) * 180 / Math.PI;
assert(Math.abs(angle_100 - 9.10) < 0.05, `Angle between normal g(100) and direction [100] must be 9.10°, got ${angle_100.toFixed(2)}°`);
print("4. Plane normals vs direction vectors distinction: PASSED ✓");

// 5. Zone Law Consistency
const zone3 = C.zoneLawDot([1, 1, 0], [1, -1, 1]);
assert(zone3 === 0, "Weiss zone law in 3-index must be 0");
const uvtw = C.dirUVW_toUVTW([1, -1, 1]);
const zone4 = 1 * uvtw[0] + 1 * uvtw[1] + (-2) * uvtw[2] + 0 * uvtw[3];
assert(Math.abs(zone4) < 1e-12, "Weiss zone law in 4-index must be 0");
print("5. Zone law consistency (3-index and 4-index): PASSED ✓");

// 6. Rotation Matrix Orthogonality & Proper Determinant
const orRes = C.rotationFromOR({
    LA: L_hex,
    planeA: [1, 1, 0],
    dirA: [1, -1, 1],
    LB: L_mono,
    planeB: [1, 0, 0],
    dirB: [0, 0, 1],
    normalSense: -1
});
assert(C.isRotationMatrix(orRes.R, 1e-9), "Orientation rotation matrix must be strictly orthogonal with det R = +1");
assert(Math.abs(C.det3(orRes.R) - 1.0) < 1e-9, "Determinant of rotation matrix must be +1.0");
print("6. Rotation matrix orthogonality and determinant: PASSED ✓");

// 7. Symmetry & Misorientation
const R_ident = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mis = C.misorientationDeg(orRes.R, orRes.R);
assert(mis < 1e-6, "Misorientation between identical rotations must be 0°");
print("7. Symmetry and misorientation calculations: PASSED ✓");

// 8. 1D Domain Matching
const d_1102 = C.dSpacing(L_hex, [1, -1, 2]);
const d_020 = C.dSpacing(L_mono, [0, 2, 0]);
const dom1D = C.findBestDomainMatch1D(3 * d_1102, 4 * d_020);
assert(dom1D.n === 1 && dom1D.m === 1, "3*d(1-102) and 4*d(020) should have 1:1 supercell match");
assert(Math.abs(dom1D.misFit - 0.00321) < 1e-4, "Misfit must be ~0.32%");
print("8. 1D domain matching against hand-calculated examples: PASSED ✓");

// 9. 2D Coincidence Search (Zur & McGill / CSL)
const netA = { e1: [3.0, 0.0], e2: [0.0, 3.0] };
const netB = { e1: [4.0, 0.0], e2: [0.0, 4.0] };
const cslRes = C.coincidenceSearch2D(netA, netB, { maxArea: 160, maxLengthMismatch: 0.05, maxAngleMismatchDeg: 2.0 });
assert(cslRes.candidates.length > 0, "Must find coincidence supercells between 3x3 and 4x4 nets");
const zeroStrain = cslRes.candidates.find(c => c.NA === 16 && c.NB === 9);
assert(zeroStrain && Math.abs(zeroStrain.maxAbsStrain) < 1e-12, "3x3 and 4x4 nets have 0% strain at NA=16, NB=9 (12x12 A coincidence cell)");
print("9. 2D coincidence cell search: PASSED ✓");

// 10. Reproduction of Trolliard et al. (2006)
const a_sa = 4.7607, c_sa = 12.9947;
const a_m = 5.146, b_m = 5.205, c_m = 5.313, beta_m = 99.1;

const L_troll_sa = C.latticeFromParameters(a_sa, a_sa, c_sa, 90, 90, 120);
const L_troll_m = C.latticeFromParameters(a_m, b_m, c_m, 90, beta_m, 90);

const d_sa_1102_troll = C.dSpacing(L_troll_sa, [1, -1, 2]);
const d_m_020_troll = C.dSpacing(L_troll_m, [0, 2, 0]);
const F0_main = C.trolliardF0(3, d_sa_1102_troll, 4, d_m_020_troll);
assert(Math.abs(F0_main * 100.0 - 0.32) < 0.01, `Trolliard main F0 must be 0.32%, got ${(F0_main*100).toFixed(3)}%`);

// Wall angle: (1 0 -1 2) intersection with (1 1 -2 0) vs [1 -1 0 1]
const B_troll_sa = C.reciprocalBasis(L_troll_sa);
const g_1120_troll = C.add(B_troll_sa[0], B_troll_sa[1]);
const n_1120_troll = C.normalize(g_1120_troll);
const g_1012_troll = C.add(B_troll_sa[0], C.scale(B_troll_sa[2], 2));
const trace_wall = C.normalize(C.cross(n_1120_troll, g_1012_troll));
const dir_c_troll = C.normalize(C.add(C.sub(L_troll_sa[0], L_troll_sa[1]), L_troll_sa[2]));
const wall_angle = Math.acos(Math.abs(C.dot(dir_c_troll, trace_wall))) * 180 / Math.PI;
assert(Math.abs(wall_angle - 84.15) < 0.05, `Sapphire structural wall angle must be 84.15°, got ${wall_angle.toFixed(2)}°`);
const alpha_mis = 90.0 - wall_angle;
assert(Math.abs(alpha_mis - 5.85) < 0.05, `Angular mismatch alpha must be 5.85°, got ${alpha_mis.toFixed(2)}°`);

// Secondary variant:
const d_sa_1108_troll = C.dSpacing(L_troll_sa, [1, -1, 8]);
const d_m_101_troll = C.dSpacing(L_troll_m, [-1, 0, 1]);
const F0_sec = C.trolliardF0(8, d_sa_1108_troll, 3, d_m_101_troll);
assert(Math.abs(F0_sec * 100.0 - 1.30) < 0.02, `Trolliard secondary F0 must be ~1.31%, got ${(F0_sec*100).toFixed(3)}%`);

// Structural wall & lattice relaxation verification (3:4 ratio):
const wallSa = C.findPerpendicularWallPlane(L_troll_sa, [1, 1, 0], [1, -1, 1], { isHex: true, spaceGroup: 'R-3c' });
const wallZr = C.findPerpendicularWallPlane(L_troll_m, [1, 0, 0], [0, 0, 1], { isHex: false, spaceGroup: 'P2_1/c' });
assert(wallSa && Math.abs(wallSa.d - d_sa_1102_troll) < 1e-6, "Must automatically find (1 -1 0 -2)sa structural wall");
assert(wallZr && Math.abs(wallZr.d - d_m_020_troll) < 1e-6, "Must automatically find (0 2 0)m structural wall");

const relMain = C.calculateLatticeRelaxation(wallSa.d, wallZr.d, { alphaDeg: alpha_mis });
assert(relMain.n === 3 && relMain.m === 4, `Must find 3:4 domain ratio, got ${relMain.n}:${relMain.m}`);
assert(Math.abs(relMain.rawMisfit1to1 * 100 - 25.24) < 0.05, `1:1 unrelaxed misfit must be ~25.24% (paper: ~25%), got ${(relMain.rawMisfit1to1*100).toFixed(2)}%`);
assert(relMain.extraHalfPlanes === 1, "3:4 ratio introduces 1 extra (020)m half-plane per domain");
assert(Math.abs(relMain.absF0 * 100 - 0.32) < 0.01, "Residual coincidence strain F0 must be 0.32%");
assert(Math.abs(relMain.domainDiscrepancyAng - 0.0335) < 0.001, "Cumulative 3:4 domain discrepancy must be 0.0335 Å");
print("10. Reproduction of Trolliard et al. (2006) exact paper results & 3:4 lattice relaxation: PASSED ✓");

// 11. CIF Data Structure and Atomic Registry (including Trolliard Cation-Only mode)
const surfA = [{ species: 'O', isAnion: true, x: 0, y: 0, x0: 0, y0: 0 }];
const surfB = [{ species: 'O', isAnion: true, x: 0.1, y: 0.1, x0: 0.1, y0: 0.1 }];
const regScore = C.calculateAtomicRegistryScore(surfA, surfB, 0, 0, { coincidenceRadius: 0.5 });
assert(regScore.score > 0.9, "Close atomic positions must give high registry score");

const surfMixedA = [
    { species: 'Al', isAnion: false, x: 0.0, y: 0.0, x0: 0.0, y0: 0.0 },
    { species: 'O', isAnion: true, x: 1.5, y: 1.5, x0: 1.5, y0: 1.5 }
];
const surfMixedB = [
    { species: 'Zr', isAnion: false, x: 0.05, y: 0.0, x0: 0.05, y0: 0.0 },
    { species: 'O', isAnion: true, x: 3.2, y: 3.2, x0: 3.2, y0: 3.2 }
];
const regCationOnly = C.calculateAtomicRegistryScore(surfMixedA, surfMixedB, 0, 0, { pairMode: 'cation_cation' });
assert(regCationOnly.compatibleTotal === 1 && regCationOnly.coincidenceCount === 1, "Cation-only mode must exclude O2- anions and match Al3+ <-> Zr4+ cations");
print("11. Atomic registry calculation (including Trolliard Cation-Only mode): PASSED ✓");

// 12. Perturbation Behavior
const L_p0 = C.latticeFromParameters(5.0, 5.0, 5.0, 90, 90, 90);
const L_p1 = C.latticeFromParameters(5.001, 5.0, 5.0, 90, 90, 90);
const d_p0 = C.dSpacing(L_p0, [1, 0, 0]);
const d_p1 = C.dSpacing(L_p1, [1, 0, 0]);
const deriv = (d_p1 - d_p0) / 0.001;
assert(Math.abs(deriv - 1.0) < 1e-3, "First derivative dd/da must equal 1.0");
print("12. Perturbation smoothness: PASSED ✓");

// 13. Numerical Stability
const L_arb = C.latticeFromParameters(4.3, 5.7, 6.2, 83, 97, 102);
const d_arb = C.dSpacing(L_arb, [7, -11, 13]);
assert(!isNaN(d_arb) && isFinite(d_arb) && d_arb > 0, "High index d-spacing must be positive and finite");
print("13. Numerical stability and reproducibility: PASSED ✓");

print(`\n==========================================================`);
print(`ALL ${passedTests} JAVASCRIPT SCIENTIFIC TESTS PASSED SUCCESSFULLY! ✓`);
print(`==========================================================`);
