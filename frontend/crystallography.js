// =====================================================================================
// crystallography.js — dependency-free crystallographic mathematics for the
// Crystallography Viewer (Al2O3 / ZrO2 interface analysis).
//
// This module contains NO rendering and NO DOM access so it can be unit-tested in any
// JavaScript engine (browser, Node, or macOS JavaScriptCore `jsc -m`).
//
// -------------------------------------------------------------------------------------
// CONVENTIONS (used everywhere in this file — see CONVENTIONS export)
// -------------------------------------------------------------------------------------
//  * A lattice basis is a 3x3 array of ROWS: L = [a, b, c], each row a Cartesian vector
//    in Ångström, expressed in one fixed orthonormal "crystal Cartesian" frame (the frame
//    in which the CIF/pymatgen lattice matrix is given).
//  * Reciprocal basis: crystallographer's convention WITHOUT 2π:
//        a_i · a*_j = δ_ij ,  a* = (b × c)/V, b* = (c × a)/V, c* = (a × b)/V
//    so  g_hkl = h a* + k b* + l c*  has |g_hkl| = 1/d_hkl  (Å⁻¹).
//  * Direction [uvw]  →  r = u a + v b + w c  (Å).
//  * Plane (hkl)      →  unit normal n̂ = g_hkl/|g_hkl|,  d_hkl = 1/|g_hkl|.
//  * Weiss zone law: [uvw] lies in (hkl)  ⇔  h u + k v + l w = 0.
//  * Miller–Bravais (hexagonal/trigonal, hexagonal axes a1, a2, c):
//        (hkil): i = −(h + k); the 3-index plane is (hkl) (drop i).
//        [UVTW] → [uvw] = [U − T, V − T, W]           (requires U + V + T = 0)
//        [uvw]  → [UVTW] = [(2u − v)/3, (2v − u)/3, −(u + v)/3, w]
//        4-index zone law: hU + kV + iT + lW = 0 (identical to the 3-index law).
//  * Centred lattices: the conventional cell (e.g. hexagonal axes of R-centred corundum)
//    is used for INDEXING, while the true translation lattice (primitive cell) is used for
//    PERIODS, surface nets and coincidence cells. Conventional rows A = M·P with integer M.
//  * Interface frame: z = n̂_A (normal of crystal A's interface plane, pointing from A
//    into B), x = a chosen in-plane reference direction, y = z × x.
//  * Rotation R maps crystal-B Cartesian vectors into crystal-A Cartesian: v_A = R v_B.
// =====================================================================================

export const CONVENTIONS = Object.freeze({
    basis: 'Row-vector bases L = [a, b, c]; Cartesian Å in the CIF/pymatgen crystal frame.',
    reciprocal: 'a_i · a*_j = δ_ij (no 2π); |g_hkl| = 1/d_hkl in Å⁻¹.',
    direction: '[uvw] → r = u a + v b + w c.',
    plane: '(hkl) → g = h a* + k b* + l c*; n̂ = g/|g|; d = 1/|g|.',
    zone: 'h u + k v + l w = 0  ⇔  hU + kV + iT + lW = 0.',
    millerBravais: 'i = −(h+k); [UVTW]→[U−T, V−T, W]; [uvw]→[(2u−v)/3, (2v−u)/3, −(u+v)/3, w].',
    centring: 'Conventional rows A = M·P (M integer, |det M| = lattice points per conventional cell).',
    interfaceFrame: 'z = n̂_A (A → B), x = reference in-plane direction of A, y = z × x.',
    rotation: 'v_A = R v_B, R orthogonal with det R = +1.',
    linearMismatch: "f = (L_B − L_A)/L_ref with L_ref = L_A ('A', reference/substrate) or (L_A+L_B)/2 ('mean').",
    trolliardF0: 'F0 = (n_A d_A − n_B d_B)/(n_A d_A)   [Trolliard et al., J. Mater. Chem. 16 (2006) 3640].',
    strain2D: 'G = U V⁻¹ (columns = coincidence-cell edges of A and of B); polar decomposition G = R_p S; principal strains = eig(S) − 1.'
});

// -------------------------------------------------------------------------------------
// Small vector / matrix helpers (3D arrays, row-major 3x3)
// -------------------------------------------------------------------------------------
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const scale = (a, s) => a.map(x => x * s);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a));
export const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
];
export function normalize(a) {
    const n = norm(a);
    if (!(n > 0)) throw new Error('Cannot normalize a zero-length vector.');
    return scale(a, 1 / n);
}
export const det3 = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

export function inv3(m) {
    const d = det3(m);
    if (Math.abs(d) < 1e-12) throw new Error('Singular 3x3 matrix (degenerate lattice basis).');
    const c = [
        [m[1][1] * m[2][2] - m[1][2] * m[2][1], m[0][2] * m[2][1] - m[0][1] * m[2][2], m[0][1] * m[1][2] - m[0][2] * m[1][1]],
        [m[1][2] * m[2][0] - m[1][0] * m[2][2], m[0][0] * m[2][2] - m[0][2] * m[2][0], m[0][2] * m[1][0] - m[0][0] * m[1][2]],
        [m[1][0] * m[2][1] - m[1][1] * m[2][0], m[0][1] * m[2][0] - m[0][0] * m[2][1], m[0][0] * m[1][1] - m[0][1] * m[1][0]]
    ];
    return c.map(r => r.map(x => x / d));
}
export const transpose = (m) => m[0].map((_, j) => m.map(r => r[j]));
export const matMul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
/** row vector × matrix: (x M)_j = Σ_i x_i M_ij */
export const vecMat = (x, M) => M[0].map((_, j) => x.reduce((s, xi, i) => s + xi * M[i][j], 0));
/** matrix × column vector */
export const matVec = (M, x) => M.map(r => dot(r, x));

const RAD = 180 / Math.PI;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** Angle between two vectors in degrees, range [0, 180]. */
export function angleDeg(a, b) {
    return Math.acos(clamp(dot(a, b) / (norm(a) * norm(b)), -1, 1)) * RAD;
}
/** Angle between two LINES (sign-insensitive), range [0, 90]. */
export function lineAngleDeg(a, b) {
    const t = angleDeg(a, b);
    return Math.min(t, 180 - t);
}

// -------------------------------------------------------------------------------------
// Integer / rational helpers
// -------------------------------------------------------------------------------------
export function gcd(a, b) {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    while (b) { [a, b] = [b, a % b]; }
    return a;
}
export const gcdArr = (arr) => arr.reduce((g, x) => gcd(g, x), 0);
export function isIntegerVector(v, tol = 1e-8) {
    return v.every(x => Math.abs(x - Math.round(x)) <= tol);
}
/** Divides an integer vector by the gcd of its entries (sign preserved). */
export function reduceIntegerVector(v) {
    if (!isIntegerVector(v, 1e-6)) throw new Error(`Expected an integer vector, got [${v.join(', ')}].`);
    const r = v.map(Math.round);
    const g = gcdArr(r);
    if (g === 0) throw new Error('Zero index vector.');
    return r.map(x => x / g);
}
/**
 * Expresses a rational vector as  num/den  with the smallest common denominator ≤ maxDen.
 * Throws if no such denominator exists (prevents silent rounding).
 */
export function rationalVector(v, maxDen = 48, tol = 1e-6) {
    for (let den = 1; den <= maxDen; den++) {
        const s = v.map(x => x * den);
        if (isIntegerVector(s, tol * den)) {
            const num = s.map(Math.round);
            const g = gcd(gcdArr(num), den);
            return { num: num.map(x => x / g), den: den / g };
        }
    }
    throw new Error(`Vector [${v.join(', ')}] is not rational with denominator ≤ ${maxDen}.`);
}
/** Smallest integer vector parallel (same sense) to a rational vector. */
export function integerDirection(v, maxDen = 48) {
    const { num } = rationalVector(v, maxDen);
    return reduceIntegerVector(num);
}
export function formatIndices(v, brackets = '[]') {
    return `${brackets[0]}${v.map(x => `${x}`).join(' ')}${brackets[1]}`;
}
/** Formats a rational direction as e.g. "1/3[2 -2 1]" (3-index) or "1/3[2 -2 0 1]" (4-index). */
export function formatRationalDirection(v, fourIndex = false, maxDen = 48) {
    let w = v;
    if (fourIndex) w = dirUVW_toUVTW(v);
    const { num, den } = rationalVector(w, maxDen * 3);
    return den === 1 ? formatIndices(num) : `1/${den}${formatIndices(num)}`;
}

// -------------------------------------------------------------------------------------
// A. Direct & reciprocal lattice
// -------------------------------------------------------------------------------------
/** Lattice rows from cell parameters (Å, degrees). a ∥ x, b in the xy plane. */
export function latticeFromParameters(a, b, c, alphaDeg, betaDeg, gammaDeg) {
    const al = alphaDeg / RAD, be = betaDeg / RAD, ga = gammaDeg / RAD;
    const cx = c * Math.cos(be);
    const cy = c * (Math.cos(al) - Math.cos(be) * Math.cos(ga)) / Math.sin(ga);
    const cz2 = c * c - cx * cx - cy * cy;
    if (!(cz2 > 0)) throw new Error('Invalid cell parameters: angles do not define a real cell.');
    return [
        [a, 0, 0],
        [b * Math.cos(ga), b * Math.sin(ga), 0],
        [cx, cy, Math.sqrt(cz2)]
    ];
}
export function cellParameters(L) {
    const [a, b, c] = L;
    return {
        a: norm(a), b: norm(b), c: norm(c),
        alpha: angleDeg(b, c), beta: angleDeg(a, c), gamma: angleDeg(a, b)
    };
}
export const cellVolume = (L) => Math.abs(det3(L));
export const metricTensor = (L) => L.map(r => L.map(s => dot(r, s)));

/** Reciprocal basis rows (a*, b*, c*) with a_i·a*_j = δ_ij (no 2π factor). */
export function reciprocalBasis(L) {
    const [a, b, c] = L;
    const V = dot(a, cross(b, c));
    if (Math.abs(V) < 1e-10) throw new Error('Degenerate lattice: zero cell volume.');
    return [scale(cross(b, c), 1 / V), scale(cross(c, a), 1 / V), scale(cross(a, b), 1 / V)];
}
/** Cartesian vector of a direction [uvw] (Å). */
export const directionToCartesian = (L, uvw) => vecMat(uvw, L);
/** Reciprocal-lattice vector g_hkl (Å⁻¹), normal to (hkl). */
export const planeNormalCartesian = (L, hkl) => vecMat(hkl, reciprocalBasis(L));
/** Interplanar spacing d_hkl = 1/|g_hkl| (Å). */
export function dSpacing(L, hkl) {
    if (hkl.every(x => x === 0)) throw new Error('(000) is not a plane.');
    return 1 / norm(planeNormalCartesian(L, hkl));
}
export const zoneLawDot = (hkl, uvw) => dot(hkl, uvw);
export const isInZone = (hkl, uvw, tol = 1e-9) => Math.abs(zoneLawDot(hkl, uvw)) <= tol;
/** Zone axis common to two planes: [uvw] = (h1k1l1) × (h2k2l2), reduced. */
export const zoneAxis = (hkl1, hkl2) => reduceIntegerVector(cross(hkl1, hkl2));
/** Plane containing two directions: (hkl) = [uvw]1 × [uvw]2, reduced. */
export const planeFromDirections = (uvw1, uvw2) => reduceIntegerVector(cross(uvw1, uvw2));
export const angleBetweenDirections = (L, d1, d2) => angleDeg(directionToCartesian(L, d1), directionToCartesian(L, d2));
export const angleBetweenPlanes = (L, p1, p2) => angleDeg(planeNormalCartesian(L, p1), planeNormalCartesian(L, p2));
/** Angle between a direction and a plane (0° = lies in the plane). */
export function angleDirectionToPlaneDeg(L, uvw, hkl) {
    return 90 - lineAngleDeg(directionToCartesian(L, uvw), planeNormalCartesian(L, hkl));
}

// -------------------------------------------------------------------------------------
// Miller–Bravais conversions (exact; throw on invalid input)
// -------------------------------------------------------------------------------------
export function planeHKIL_toHKL(hkil) {
    const [h, k, i, l] = hkil;
    if (Math.abs(i + h + k) > 1e-9) throw new Error(`Invalid Miller–Bravais plane (${hkil.join(' ')}): i must equal −(h+k).`);
    return [h, k, l];
}
export const planeHKL_toHKIL = ([h, k, l]) => [h, k, -(h + k), l];
export function dirUVTW_toUVW(uvtw) {
    const [U, V, T, W] = uvtw;
    if (Math.abs(U + V + T) > 1e-9) throw new Error(`Invalid Miller–Bravais direction [${uvtw.join(' ')}]: U+V+T must be 0.`);
    return [U - T, V - T, W];
}
/** Exact (possibly fractional) 4-index components of a 3-index direction. */
export const dirUVW_toUVTW = ([u, v, w]) => [(2 * u - v) / 3, (2 * v - u) / 3, -(u + v) / 3, w];
/** Smallest-integer 4-index direction parallel to [uvw]. */
export const dirUVW_toUVTW_int = (uvw) => reduceIntegerVector(dirUVW_toUVTW(uvw).map(x => 3 * x));
/** Smallest-integer 3-index direction parallel to [UVTW]. */
export const dirUVTW_toUVW_int = (uvtw) => reduceIntegerVector(dirUVTW_toUVW(uvtw));

// -------------------------------------------------------------------------------------
// Centring & true translation lattice
// -------------------------------------------------------------------------------------
/**
 * Integer matrix M with conventional rows A = M·P (P = primitive rows, same Cartesian frame).
 * |det M| = number of lattice points per conventional cell (1 = P, 2 = C/I, 3 = R(hex), 4 = F).
 */
export function centringMatrix(conv, prim = conv, tol = 1e-3) {
    if (!prim) prim = conv;
    const Mf = matMul(conv, inv3(prim));
    const M = Mf.map(r => r.map(Math.round));
    const Mflat = M.flat();
    const err = Math.max(...Mf.flat().map((x, i) => Math.abs(x - Mflat[i])));
    if (err > tol) {
        throw new Error(`Primitive and conventional bases are not commensurate (max deviation ${err.toExponential(2)}). ` +
            'They must describe the same translation lattice in the same Cartesian frame.');
    }
    const d = Math.round(det3(M));
    if (d === 0) throw new Error('Singular centring matrix.');
    return { M, det: Math.abs(d), Minv: inv3(M) };
}

/** Shortest lattice translation parallel to the conventional direction uvw (may be fractional, e.g. 1/3[2 -2 1]). */
export function shortestLatticeVectorAlong(conv, prim = conv, uvw) {
    if (!prim) prim = conv;
    if (uvw.every(x => Math.abs(x) < 1e-12)) throw new Error('[000] is not a direction.');
    const { M, Minv } = centringMatrix(conv, prim);
    const uvwInt = integerDirection(uvw);
    const n = reduceIntegerVector(vecMat(uvwInt, M));        // primitive integer coordinates
    const convFrac = vecMat(n, Minv);                          // conventional fractional coords
    const cart = vecMat(n, prim);
    return { primCoords: n, convFrac, cart, length: norm(cart), uvwInt };
}

/** Unimodular column reduction: returns integer basis of {n ∈ Z³ : h·n = 0}. */
function integerKernel3(h) {
    const w = h.slice();
    const U = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // columns are the transformed basis
    for (let guard = 0; guard < 200; guard++) {
        const nz = [0, 1, 2].filter(j => w[j] !== 0);
        if (nz.length <= 1) {
            const p = nz.length ? nz[0] : 0;
            return [0, 1, 2].filter(j => j !== p).map(j => [U[0][j], U[1][j], U[2][j]]);
        }
        let p = nz[0];
        for (const j of nz) if (Math.abs(w[j]) < Math.abs(w[p])) p = j;
        for (const j of nz) {
            if (j === p) continue;
            const q = Math.trunc(w[j] / w[p]);
            w[j] -= q * w[p];
            for (let r = 0; r < 3; r++) U[r][j] -= q * U[r][p];
        }
    }
    throw new Error('Integer kernel computation did not converge.');
}

/** Gauss–Lagrange reduction of a 2D lattice basis given as {v: Cartesian, c: integer coords}. */
function gaussReduce(b1, b2) {
    let x = { v: b1.v.slice(), c: b1.c.slice() };
    let y = { v: b2.v.slice(), c: b2.c.slice() };
    for (let guard = 0; guard < 1000; guard++) {
        if (dot(x.v, x.v) > dot(y.v, y.v)) [x, y] = [y, x];
        const mu = Math.round(dot(x.v, y.v) / dot(x.v, x.v));
        if (mu === 0) return [x, y];
        y = { v: sub(y.v, scale(x.v, mu)), c: sub(y.c, scale(x.c, mu)) };
    }
    throw new Error('Gauss reduction did not converge.');
}

/**
 * Two-dimensional translation net of the TRUE lattice lying in the conventional plane (hkl).
 * Returns a Gauss-reduced, right-handed (t1 × t2 ∥ +g_hkl) basis.
 */
export function surfaceNet(conv, prim, hkl) {
    if (!isIntegerVector(hkl) || hkl.every(x => x === 0)) throw new Error(`Invalid plane indices (${hkl.join(' ')}).`);
    const { M, Minv, det } = centringMatrix(conv, prim);
    // g·P_j = (M⁻¹ h)_j  → primitive Miller indices of the same plane orientation
    const hp = reduceIntegerVector(matVec(Minv, hkl).map(x => x * det));
    const ker = integerKernel3(hp);
    let [b1, b2] = gaussReduce(
        { v: vecMat(ker[0], prim), c: ker[0] },
        { v: vecMat(ker[1], prim), c: ker[1] }
    );
    const g = planeNormalCartesian(conv, hkl);
    if (dot(cross(b1.v, b2.v), g) < 0) b2 = { v: scale(b2.v, -1), c: scale(b2.c, -1) };
    const area = norm(cross(b1.v, b2.v));
    if (!(area > 1e-8)) throw new Error('Degenerate surface net.');
    const Vp = cellVolume(prim);
    const dNet = Vp / area;
    const dHKL = 1 / norm(g);
    const toConv = (c) => vecMat(c, Minv);
    return {
        hkl: hkl.slice(),
        primitiveHKL: hp,
        normal: normalize(g),
        t1: b1.v, t2: b2.v,
        t1Prim: b1.c, t2Prim: b2.c,
        t1Conv: toConv(b1.c), t2Conv: toConv(b2.c),
        area,
        gammaDeg: angleDeg(b1.v, b2.v),
        dNet, dHKL,
        // (hkl) is itself a lattice-plane family only if d_hkl equals the net-plane spacing
        hklIsLatticePlane: Math.abs(dNet - dHKL) < 1e-6 * dNet,
        centringPoints: det,
        toConv
    };
}

/**
 * Lattice directions lying in (hkl), built from the true surface net (so centred lattices give the
 * correct shortest period, e.g. 1/3⟨1̄101⟩ in corundum). Unique up to sign, sorted by period.
 */
export function inPlaneLatticeDirections(conv, prim, hkl, maxCoef = 3, limit = 16) {
    const net = surfaceNet(conv, prim, hkl);
    const out = [];
    const seen = new Set();
    for (let i = -maxCoef; i <= maxCoef; i++) {
        for (let j = -maxCoef; j <= maxCoef; j++) {
            if ((i === 0 && j === 0) || gcd(i, j) !== 1) continue;
            const cart = add(scale(net.t1, i), scale(net.t2, j));
            const convFrac = add(scale(net.t1Conv, i), scale(net.t2Conv, j));
            const uvwInt = integerDirection(convFrac);
            // canonical sign: first non-zero conventional index positive
            const first = uvwInt.find(x => x !== 0);
            const key = (first < 0 ? uvwInt.map(x => -x) : uvwInt).join(',');
            if (seen.has(key)) continue;
            seen.add(key);
            const s = first < 0 ? -1 : 1;
            out.push({
                netCoef: [s * i, s * j],
                cart: scale(cart, s),
                convFrac: scale(convFrac, s),
                uvwInt: uvwInt.map(x => s * x),
                period: norm(cart)
            });
        }
    }
    out.sort((a, b) => a.period - b.period || a.uvwInt.join().localeCompare(b.uvwInt.join()));
    return { net, directions: out.slice(0, limit) };
}

// -------------------------------------------------------------------------------------
// B. Orientation relationships
// -------------------------------------------------------------------------------------
export function isRotationMatrix(R, tol = 1e-9) {
    const RtR = matMul(transpose(R), R);
    const orth = RtR.every((r, i) => r.every((x, j) => Math.abs(x - (i === j ? 1 : 0)) <= tol));
    return orth && Math.abs(det3(R) - 1) <= tol;
}
/** Rotation angle (degrees) of a proper rotation matrix. */
export const rotationAngleDeg = (R) => Math.acos(clamp((R[0][0] + R[1][1] + R[2][2] - 1) / 2, -1, 1)) * RAD;

/**
 * Builds the rotation R (v_A = R v_B) defined by an orientation relationship
 *     (hkl)_A ∥ (hkl)_B   and   [uvw]_A ∥ [uvw]_B.
 * normalSense = +1 : g_A ∥ g_B (standard OR notation);  −1 : g_A ∥ −g_B (face-to-face docking).
 * The directions should lie in their planes (zone law). If they do not, the out-of-plane
 * angle is REPORTED and the in-plane projection is used — never silently ignored.
 */
export function rotationFromOR({ LA, planeA, dirA, LB, planeB, dirB, normalSense = +1 }) {
    const nA = normalize(planeNormalCartesian(LA, planeA));
    const nB = scale(normalize(planeNormalCartesian(LB, planeB)), normalSense);
    const rA = directionToCartesian(LA, dirA);
    const rB = directionToCartesian(LB, dirB);
    const devA = 90 - lineAngleDeg(rA, nA);
    const devB = 90 - lineAngleDeg(rB, nB);
    const pA = sub(rA, scale(nA, dot(rA, nA)));
    const pB = sub(rB, scale(nB, dot(rB, nB)));
    if (norm(pA) < 1e-9 || norm(pB) < 1e-9) throw new Error('Direction is parallel to the plane normal; OR is undefined.');
    const xA = normalize(pA), xB = normalize(pB);
    const TA = [xA, cross(nA, xA), nA];   // rows
    const TB = [xB, cross(nB, xB), nB];
    const R = matMul(transpose(TA), TB);   // R = TAᵀ TB  maps B-frame → A-frame
    return {
        R,
        zoneLawA: zoneLawDot(planeA, dirA),
        zoneLawB: zoneLawDot(planeB, dirB),
        dirOutOfPlaneDegA: devA,
        dirOutOfPlaneDegB: devB
    };
}
/** Angle (deg, sign-insensitive) between plane (hkl)_A and plane (hkl)_B after applying R. */
export function planeParallelismDeviation(R, LA, planeA, LB, planeB) {
    return lineAngleDeg(planeNormalCartesian(LA, planeA), matVec(R, planeNormalCartesian(LB, planeB)));
}
/** Angle (deg, sign-insensitive) between direction [uvw]_A and [uvw]_B after applying R. */
export function directionParallelismDeviation(R, LA, dirA, LB, dirB) {
    return lineAngleDeg(directionToCartesian(LA, dirA), matVec(R, directionToCartesian(LB, dirB)));
}

// -------------------------------------------------------------------------------------
// Symmetry
// -------------------------------------------------------------------------------------
/** Converts fractional point-group rotations W (x' = W x for column fractional coords) to Cartesian. */
export function symmetryOpsCartesian(L, opsFrac) {
    const At = transpose(L);           // column basis
    const AtInv = inv3(At);
    return opsFrac.map(W => matMul(matMul(At, W), AtInv));
}
/** Proper rotations (det +1); improper ops are multiplied by −1 (Laue-class equivalence; valid for lattice geometry). */
export const properParts = (opsCart) => opsCart.map(S => (det3(S) < 0 ? S.map(r => r.map(x => -x)) : S));
export function equivalentDirections(uvw, opsFrac) {
    const set = new Map();
    for (const W of opsFrac) {
        const d = matVec(W, uvw).map(x => Math.round(x * 1e6) / 1e6);
        set.set(d.join(','), d);
    }
    return [...set.values()];
}
export function equivalentPlanes(hkl, opsFrac) {
    const set = new Map();
    for (const W of opsFrac) {
        const h = vecMat(hkl, inv3(W)).map(x => Math.round(x * 1e6) / 1e6); // h' = h W⁻¹
        set.set(h.join(','), h);
    }
    return [...set.values()];
}
/**
 * Smallest rotation angle between two orientation relationships R1, R2 (v_A = R v_B), taking the
 * proper symmetry rotations of both crystals into account:  min over S_A, S_B of ∠(R1ᵀ S_A R2 S_B).
 */
export function misorientationDeg(R1, R2, symCartA = [], symCartB = []) {
    const SA = symCartA.length ? properParts(symCartA) : [[[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
    const SB = symCartB.length ? properParts(symCartB) : [[[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
    const R1t = transpose(R1);
    let best = Infinity;
    for (const a of SA) {
        const left = matMul(R1t, matMul(a, R2));
        for (const b of SB) best = Math.min(best, rotationAngleDeg(matMul(left, b)));
    }
    return best;
}

// -------------------------------------------------------------------------------------
// 1D periodicity matching
// -------------------------------------------------------------------------------------
/** Signed linear mismatch f = (L_B − L_A)/L_ref.  reference: 'A' (L_ref = L_A) or 'mean'. */
export function linearMismatch(LA, LB, reference = 'A') {
    if (!(LA > 0) || !(LB > 0)) throw new Error('Lengths must be positive.');
    const ref = reference === 'mean' ? 0.5 * (LA + LB) : reference === 'B' ? LB : LA;
    return (LB - LA) / ref;
}
/** Trolliard et al. (2006) linear parametric misfit: F0 = (n_A d_A − n_B d_B)/(n_A d_A). */
export const trolliardF0 = (nA, dA, nB, dB) => (nA * dA - nB * dB) / (nA * dA);

/**
 * 1D domain (periodicity) matching n·L_A ≈ m·L_B with coprime (n, m), n, m ≤ maxN.
 * Selection rule (explicit): the SHORTEST coincidence length n·L_A whose |f| ≤ tol;
 * if none satisfies tol, the pair with smallest |f|. No hidden penalties.
 * NOTE: this is a ONE-dimensional periodicity match, not a 2D coincidence lattice.
 */
export function findBestDomainMatch1D(LA, LB, { maxN = 6, tol = 0.02, reference = 'A' } = {}) {
    if (!(LA > 0) || !(LB > 0)) return { n: 1, m: 1, misFit: NaN, signedMisfit: NaN, length: NaN, candidates: [] };
    const cands = [];
    for (let n = 1; n <= maxN; n++) {
        for (let m = 1; m <= maxN; m++) {
            if (gcd(n, m) !== 1) continue;
            const f = linearMismatch(n * LA, m * LB, reference);
            cands.push({ n, m, signedMisfit: f, misFit: Math.abs(f), length: n * LA });
        }
    }
    const within = cands.filter(c => c.misFit <= tol).sort((a, b) => a.length - b.length || a.misFit - b.misFit);
    const best = within[0] || cands.slice().sort((a, b) => a.misFit - b.misFit)[0];
    return {
        ...best,
        effectiveMisFit: best.misFit,   // kept for backwards compatibility (no penalty applied)
        sigma1D: best.n * best.m,
        withinTolerance: within.length > 0,
        tol, reference,
        candidates: cands.sort((a, b) => a.misFit - b.misFit).slice(0, 8)
    };
}

/**
 * Computes the strain and lattice relaxation metrics required to overcome the misfit between two
 * rigid lattices via n:m domain matching and local elastic/ionocovalent relaxation, following
 * Trolliard et al., J. Mater. Chem. 16 (2006) 3640-3650.
 *
 * Distinguishes:
 *  1. Direct 1:1 unrelaxed misfit f_1:1 = (L_A - L_B) / L_A (e.g. 25.24% for d(1-102)_sa vs d(020)_m).
 *  2. Periodic geometrical interface dislocations: |n - m| extra half-planes per coincidence period P = n*L_A,
 *     which reduce the misfit from f_1:1 to the residual parametric misfit F0 = (n*L_A - m*L_B) / (n*L_A)
 *     (e.g. 3:4 ratio reduces 25.24% -> 0.32%).
 *  3. Maximum linear elastic strain & atomic displacement required to deform the rigid supercell m*L_B
 *     into exact coincidence with n*L_A:
 *       - Cumulative domain discrepancy: Δu_domain = |n*L_A - m*L_B| (Å)
 *       - Maximum atomic shift from a pinned structural wall (at ±P/2): Δu_max = 0.5 * |n*L_A - m*L_B| (Å)
 *       - Per-plane spacing adjustment in crystal B: Δd_B = (n*L_A - m*L_B) / m (Å/plane)
 *  4. Angular mismatch α accommodation (e.g. α = 90° - 84.15° = 5.85° between structural walls):
 *       - Chordal shear strain: γ_α = 2 * sin(α / 2)
 *       - Local bond-length adjustment across a coordination polyhedron of span d_poly (~2.6 Å):
 *         Δu_poly = d_poly * sin(α) (±0.5 * d_poly * sin(α) about polyhedron center).
 */
export function calculateLatticeRelaxation(LA, LB, opts = {}) {
    if (!(LA > 0) || !(LB > 0)) {
        return null;
    }
    const maxN = opts.maxN ?? 8;
    const tol = opts.tol ?? 0.02;
    const alphaDeg = Math.abs(opts.alphaDeg ?? 0);
    const polyhedronSpan = opts.polyhedronSpan ?? 2.60; // Å typical [ZrO7] / [AlO6] interfacial polyhedron width

    let n = opts.n;
    let m = opts.m;
    if (!(n > 0) || !(m > 0)) {
        const best1D = findBestDomainMatch1D(LA, LB, { maxN, tol, reference: 'A' });
        n = best1D.n;
        m = best1D.m;
    }

    // 1. Direct 1:1 unrelaxed misfit (referenced to Primary crystal A, per Trolliard Eq.)
    const signedMisfit1to1 = (LA - LB) / LA;
    const rawMisfit1to1 = Math.abs(signedMisfit1to1);

    // 2. Domain coincidence lengths (n:m ratio)
    const domainLengthA = n * LA;
    const domainLengthB = m * LB;
    const extraHalfPlanes = Math.abs(n - m);
    const dislocationSpacing = extraHalfPlanes > 0 ? (domainLengthA / extraHalfPlanes) : Infinity;

    // 3. Residual coincidence misfit F0 and linear elastic strain
    const signedF0 = trolliardF0(n, LA, m, LB); // (n*LA - m*LB) / (n*LA)
    const absF0 = Math.abs(signedF0);
    const strainOnB = (domainLengthA - domainLengthB) / domainLengthB; // (n*LA - m*LB) / (m*LB)
    const symmetricStrain = Math.abs(domainLengthA - domainLengthB) / (domainLengthA + domainLengthB);

    // 4. Maximum linear relaxation displacements (in Å)
    const domainDiscrepancyAng = Math.abs(domainLengthA - domainLengthB);
    const maxWallPinnedShiftAng = 0.5 * domainDiscrepancyAng; // max shift at midpoint between structural walls
    const perPlaneAdjustmentB = (domainLengthA - domainLengthB) / m;

    // 5. Angular mismatch relaxation (if α > 0)
    const alphaRad = alphaDeg * (Math.PI / 180);
    const angularShearStrain = 2 * Math.sin(0.5 * alphaRad);
    const polyhedronBondShiftAng = polyhedronSpan * Math.sin(alphaRad);
    const halfPolyhedronBondShiftAng = 0.5 * polyhedronBondShiftAng;

    return {
        n,
        m,
        LA,
        LB,
        signedMisfit1to1,
        rawMisfit1to1,
        domainLengthA,
        domainLengthB,
        extraHalfPlanes,
        dislocationSpacing,
        signedF0,
        absF0,
        misfitReductionFactor: rawMisfit1to1 > 1e-9 ? (rawMisfit1to1 / Math.max(absF0, 1e-9)) : 1,
        strainOnB,
        symmetricStrain,
        domainDiscrepancyAng,
        maxWallPinnedShiftAng,
        perPlaneAdjustmentB,
        alphaDeg,
        angularShearStrain,
        polyhedronBondShiftAng,
        halfPolyhedronBondShiftAng
    };
}

/**
 * Finds the crystallographic "structural wall" plane (h_w k_w l_w) that contains the in-plane
 * direction [u v w] (Weiss zone law: h_w*u + k_w*v + l_w*w = 0) and is perpendicular (or closest
 * to perpendicular) to the interface plane (h_int k_int l_int), following Trolliard et al. (2006).
 *
 * Examples:
 *  - Sapphire (1 1 -2 0) with [1 -1 0 1]: returns (1 -1 0 -2) / (-1 1 0 2) with d = 3.481 Å.
 *  - Sapphire (1 1 -2 0) with [4 -4 0 1]: returns (1 -1 0 -8) / (-1 1 0 8) with d = 1.511 Å.
 *  - Monoclinic ZrO2 (1 0 0) with [0 0 1]: returns (0 1 0) (and 2_1 screw-axis harmonic (0 2 0) with d = 2.603 Å).
 *  - Monoclinic ZrO2 (0 1 0) with [1 0 1]: returns (-1 0 1) with d = 3.978 Å.
 */
export function findPerpendicularWallPlane(L, hklInt, uvwDir, opts = {}) {
    const maxIdx = opts.maxIdx ?? 9;
    const isHex = Boolean(opts.isHex);
    const spaceGroup = String(opts.spaceGroup || '');
    const isRhombohedral = isHex && spaceGroup.trim().startsWith('R');
    const nInt = planeNormalCartesian(L, hklInt);
    const rDirRaw = directionToCartesian(L, uvwDir);
    const rProj = sub(rDirRaw, scale(nInt, dot(rDirRaw, nInt)));
    if (norm(rProj) < 1e-6) return null;
    const rDir = normalize(rProj);
    const tPerp = normalize(cross(nInt, rDir));

    let bestHkl = null;
    let bestAngle = 999;
    let bestNormSum = 999;
    // Reciprocal basis is loop-invariant: compute once instead of once per candidate plane.
    const recip = reciprocalBasis(L);

    for (let h = -maxIdx; h <= maxIdx; h++) {
        for (let k = -maxIdx; k <= maxIdx; k++) {
            for (let l = -maxIdx; l <= maxIdx; l++) {
                if (h === 0 && k === 0 && l === 0) continue;
                // Cheap zone-law test first; the gcd test only runs for the few surviving candidates.
                if (Math.abs(h * uvwDir[0] + k * uvwDir[1] + l * uvwDir[2]) > 1e-5) continue;
                if (gcdArr([h, k, l]) !== 1) continue;
                const first = h !== 0 ? h : (k !== 0 ? k : l);
                if (first < 0) continue;

                const nWall = vecMat([h, k, l], recip);
                const ang = lineAngleDeg(nWall, tPerp);
                const normSum = Math.abs(h) + Math.abs(k) + Math.abs(l);
                if (ang < bestAngle - 0.15 || (Math.abs(ang - bestAngle) <= 0.15 && normSum < bestNormSum)) {
                    bestAngle = ang;
                    bestNormSum = normSum;
                    bestHkl = [h, k, l];
                }
            }
        }
    }

    if (!bestHkl) return null;

    // Check systematic reflection conditions / sublattice harmonics:
    // 1. P2_1/c (0k0): 2_1 screw axis along b requires k = 2n -> (010) halved to (020)m
    // 2. R-3c hexagonal axes (hkil): rhombohedral centering requires -h+k+l = 3n (or h-k+l = 3n);
    //    additionally, c-glide on {1 1 -2 l} requires l = 2n, and {0 0 0 l} requires l = 6n.
    let effectiveHkl = bestHkl.slice();
    if (
        bestHkl[0] === 0 && Math.abs(bestHkl[1]) === 1 && bestHkl[2] === 0 &&
        (spaceGroup.includes('2_1') || spaceGroup.includes('21') || opts.halve010)
    ) {
        effectiveHkl = [0, 2, 0];
    } else if (isRhombohedral) {
        const [bh, bk, bl] = bestHkl;
        if (bh === 0 && bk === 0 && Math.abs(bl) === 1) {
            // Basal (0001) in R-3c: oxygen/cation layers repeat at c/6 -> (0006)
            effectiveHkl = [0, 0, 6];
        } else {
            const rMod = (((-bh + bk + bl) % 3) + 3) % 3 !== 0 && (((bh - bk + bl) % 3) + 3) % 3 !== 0;
            let mult = rMod ? 3 : 1;
            // Check c-glide condition for {h, h, -2h, l} planes (i.e. bh === bk) in R-3c: l must be even
            if (bh === bk && (bl * mult) % 2 !== 0) {
                mult *= 2;
            }
            if (mult > 1) {
                effectiveHkl = [bh * mult, bk * mult, bl * mult];
            }
        }
    }

    const d = dSpacing(L, effectiveHkl);
    const label = isHex
        ? `(${effectiveHkl[0]} ${effectiveHkl[1]} ${-(effectiveHkl[0] + effectiveHkl[1])} ${effectiveHkl[2]})`
        : `(${effectiveHkl[0]} ${effectiveHkl[1]} ${effectiveHkl[2]})`;

    return {
        hkl: effectiveHkl,
        coprimeHkl: bestHkl,
        d,
        dFundamental: dSpacing(L, bestHkl),
        angleFromPerpDeg: bestAngle,
        label
    };
}

// -------------------------------------------------------------------------------------
// 2D geometry
// -------------------------------------------------------------------------------------
/** Orthonormal interface frame: z = normal, x = in-plane projection of refDir, y = z × x. */
export function interfaceFrame(normal, refDir) {
    const z = normalize(normal);
    let p = sub(refDir, scale(z, dot(refDir, z)));
    if (norm(p) < 1e-9) throw new Error('Reference direction is parallel to the interface normal.');
    const x = normalize(p);
    return { x, y: cross(z, x), z };
}
export const projectTo2D = (frame, v) => [dot(v, frame.x), dot(v, frame.y)];
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
const len2 = (a) => Math.hypot(a[0], a[1]);
const ang2 = (a, b) => Math.acos(clamp(dot2(a, b) / (len2(a) * len2(b)), -1, 1)) * RAD;
const wrap180 = (t) => { let x = ((t + 180) % 360 + 360) % 360 - 180; return x <= -180 ? x + 360 : x; };
/** Wraps to (−90, 90]: 2D Bravais nets are centrosymmetric, so θ and θ+180° are equivalent. */
const wrap90 = (t) => { let x = wrap180(t); if (x > 90) x -= 180; if (x <= -90) x += 180; return x; };

/** All index-N sublattices of a 2D lattice in Hermite normal form: s1 = (a,0), s2 = (b,c), ac = N, 0 ≤ b < a. */
export function hnfSublattices2D(N) {
    const out = [];
    for (let a = 1; a <= N; a++) {
        if (N % a) continue;
        const c = N / a;
        for (let b = 0; b < a; b++) out.push([[a, 0], [b, c]]);
    }
    return out;
}

/** Polar decomposition of a 2x2 matrix G (det > 0): G = R(θ) S. Returns θ (deg) and principal stretches of S. */
export function polarDecomposition2D(G) {
    const [[g11, g12], [g21, g22]] = G;
    const theta = Math.atan2(g21 - g12, g11 + g22);
    const c = Math.cos(theta), s = Math.sin(theta);
    // S = Rᵀ G
    const s11 = c * g11 + s * g21, s12 = c * g12 + s * g22;
    const s21 = -s * g11 + c * g21, s22 = -s * g12 + c * g22;
    const sym12 = 0.5 * (s12 + s21);
    const tr = s11 + s22, dif = s11 - s22;
    const rad = Math.sqrt(0.25 * dif * dif + sym12 * sym12);
    return { thetaDeg: theta * RAD, stretches: [0.5 * tr + rad, 0.5 * tr - rad], S: [[s11, sym12], [sym12, s22]] };
}

function shortBases2D(w1, w2, coef = 2) {
    // enumerate short vectors of the lattice (w1, w2) and all right-handed primitive bases from them
    const area = cross2(w1, w2);
    const vecs = [];
    for (let i = -coef; i <= coef; i++) for (let j = -coef; j <= coef; j++) {
        if (i === 0 && j === 0) continue;
        vecs.push({ v: [i * w1[0] + j * w2[0], i * w1[1] + j * w2[1]], c: [i, j] });
    }
    const bases = [];
    for (const s of vecs) for (const t of vecs) {
        const cr = cross2(s.v, t.v);
        if (Math.abs(cr - area) <= 1e-9 * Math.abs(area)) bases.push([s, t]);
    }
    return bases;
}

/**
 * Genuine two-dimensional coincidence-cell search (Zur & McGill, J. Appl. Phys. 55 (1984) 378 type).
 *
 * netA, netB: { e1:[x,y], e2:[x,y] } primitive 2D bases of each crystal's interface net, expressed in
 *             the common interface frame (B already placed face-to-face, i.e. its normal = −z).
 * For every pair of sublattice indices (N_A, N_B) with N·area ≤ maxArea, all Hermite-normal-form
 * supercells are enumerated, Gauss-reduced, and compared edge-by-edge:
 *     ε_i = (|v_i| − |u_i|)/L_ref,  Δγ = γ_B − γ_A,  G = U V⁻¹ = R(θ) S,  principal strains = eig(S) − 1.
 * θ is the extra rotation of B (about +z, counter-clockwise) that best superimposes the cells.
 * opts.rotationConstraint = { thetaDeg, tolDeg } restricts θ (e.g. to the current orientation).
 */
export function coincidenceSearch2D(netA, netB, opts = {}) {
    const o = {
        maxArea: 250, maxLengthMismatch: 0.05, maxAngleMismatchDeg: 6, maxAreaMismatch: 0.08,
        reference: 'A', sortBy: 'area', warnArea: 150, warnIndex: 10, maxCandidates: 40,
        rotationConstraint: null, coef: 2, ...opts
    };
    const areaA = Math.abs(cross2(netA.e1, netA.e2));
    const areaB = Math.abs(cross2(netB.e1, netB.e2));
    if (!(areaA > 1e-8) || !(areaB > 1e-8)) throw new Error('Degenerate 2D net (zero area).');
    if (cross2(netA.e1, netA.e2) < 0 || cross2(netB.e1, netB.e2) < 0) {
        throw new Error('Both 2D bases must be right-handed in the interface frame (e1 × e2 > 0).');
    }
    const supercell = (net, H) => {
        const s1 = [H[0][0] * net.e1[0] + H[0][1] * net.e2[0], H[0][0] * net.e1[1] + H[0][1] * net.e2[1]];
        const s2 = [H[1][0] * net.e1[0] + H[1][1] * net.e2[0], H[1][0] * net.e1[1] + H[1][1] * net.e2[1]];
        // Gauss-reduce in 2D, tracking coefficients w.r.t. (e1, e2)
        let [x, y] = gaussReduce({ v: [...s1, 0], c: H[0].slice() }, { v: [...s2, 0], c: H[1].slice() });
        if (cross2(x.v, y.v) < 0) y = { v: scale(y.v, -1), c: scale(y.c, -1) };
        return { w1: [x.v[0], x.v[1]], w2: [y.v[0], y.v[1]], c1: x.c, c2: y.c };
    };
    const NAmax = Math.floor(o.maxArea / areaA + 1e-9);
    const NBmax = Math.floor(o.maxArea / areaB + 1e-9);
    const results = [];
    const bCache = new Map();
    for (let NA = 1; NA <= NAmax; NA++) {
        const SA = NA * areaA;
        for (let NB = 1; NB <= NBmax; NB++) {
            const SB = NB * areaB;
            const areaMis = (SB - SA) / SA;
            if (Math.abs(areaMis) > o.maxAreaMismatch) continue;
            if (!bCache.has(NB)) {
                bCache.set(NB, hnfSublattices2D(NB).map(H => {
                    const sc = supercell(netB, H);
                    return { H, sc, bases: shortBases2D(sc.w1, sc.w2, o.coef) };
                }));
            }
            for (const HA of hnfSublattices2D(NA)) {
                const a = supercell(netA, HA);
                const u1 = a.w1, u2 = a.w2;
                const lu1 = len2(u1), lu2 = len2(u2);
                const gA = ang2(u1, u2);
                for (const bEntry of bCache.get(NB)) {
                    for (const [s, t] of bEntry.bases) {
                        const lv1 = len2(s.v), lv2 = len2(t.v);
                        const e1 = linearMismatch(lu1, lv1, o.reference);
                        if (Math.abs(e1) > o.maxLengthMismatch) continue;
                        const e2 = linearMismatch(lu2, lv2, o.reference);
                        if (Math.abs(e2) > o.maxLengthMismatch) continue;
                        const gB = ang2(s.v, t.v);
                        const dG = gB - gA;
                        if (Math.abs(dG) > o.maxAngleMismatchDeg) continue;
                        // G maps B-cell edges onto A-cell edges: G [v1 v2] = [u1 u2]
                        const Vd = s.v[0] * t.v[1] - s.v[1] * t.v[0];
                        const Vinv = [[t.v[1] / Vd, -t.v[0] / Vd], [-s.v[1] / Vd, s.v[0] / Vd]];
                        const U = [[u1[0], u2[0]], [u1[1], u2[1]]];
                        const G = [
                            [U[0][0] * Vinv[0][0] + U[0][1] * Vinv[1][0], U[0][0] * Vinv[0][1] + U[0][1] * Vinv[1][1]],
                            [U[1][0] * Vinv[0][0] + U[1][1] * Vinv[1][0], U[1][0] * Vinv[0][1] + U[1][1] * Vinv[1][1]]
                        ];
                        const pd = polarDecomposition2D(G);
                        const thetaPolar = wrap90(pd.thetaDeg);
                        if (o.rotationConstraint) {
                            const d = Math.abs(wrap90(thetaPolar - o.rotationConstraint.thetaDeg));
                            if (d > o.rotationConstraint.tolDeg) continue;
                        }
                        const strains = pd.stretches.map(l => l - 1);
                        const coefB1 = [s.c[0] * bEntry.sc.c1[0] + s.c[1] * bEntry.sc.c2[0], s.c[0] * bEntry.sc.c1[1] + s.c[1] * bEntry.sc.c2[1]];
                        const coefB2 = [t.c[0] * bEntry.sc.c1[0] + t.c[1] * bEntry.sc.c2[0], t.c[0] * bEntry.sc.c1[1] + t.c[1] * bEntry.sc.c2[1]];
                        const warnings = [];
                        if (SA > o.warnArea) warnings.push(`Large coincidence cell (${SA.toFixed(1)} Å² > ${o.warnArea} Å²): small mismatch may be an artefact of cell size.`);
                        if (NA > o.warnIndex || NB > o.warnIndex) warnings.push(`High sublattice index (N_A=${NA}, N_B=${NB}).`);
                        results.push({
                            NA, NB,
                            SA: [a.c1, a.c2], SB: [coefB1, coefB2],   // integer edge coefficients w.r.t. each net basis
                            u1, u2, v1: s.v, v2: t.v,
                            lenU1: lu1, lenU2: lu2, lenV1: lv1, lenV2: lv2,
                            eps1: e1, eps2: e2,
                            gammaA: gA, gammaB: gB, dGamma: dG,
                            thetaPolarDeg: thetaPolar,
                            thetaEdgeDeg: wrap180(Math.atan2(u1[1], u1[0]) * RAD - Math.atan2(s.v[1], s.v[0]) * RAD),
                            principalStrains: strains,
                            maxAbsStrain: Math.max(Math.abs(strains[0]), Math.abs(strains[1])),
                            areaA: SA, areaB: SB, areaMismatch: areaMis,
                            reference: o.reference,
                            warnings
                        });
                    }
                }
            }
        }
    }
    // Deduplicate and drop multiples of smaller cells with the same rotation & strain
    const key = (r) => [r.NA, r.NB, r.eps1.toFixed(5), r.eps2.toFixed(5), r.dGamma.toFixed(4), r.thetaPolarDeg.toFixed(3)].join('|');
    const uniq = new Map();
    for (const r of results) if (!uniq.has(key(r))) uniq.set(key(r), r);
    let list = [...uniq.values()];
    list.sort((p, q) => p.areaA - q.areaA || p.maxAbsStrain - q.maxAbsStrain);
    const kept = [];
    for (const r of list) {
        const isMultiple = kept.some(k =>
            r.areaA > k.areaA + 1e-6 &&
            Math.abs(Math.round(r.areaA / k.areaA) - r.areaA / k.areaA) < 1e-6 &&
            Math.abs(wrap90(r.thetaPolarDeg - k.thetaPolarDeg)) < 0.05 &&
            Math.abs(r.maxAbsStrain - k.maxAbsStrain) < 1e-4);
        if (!isMultiple) kept.push(r);
    }
    if (o.sortBy === 'strain') kept.sort((p, q) => p.maxAbsStrain - q.maxAbsStrain || p.areaA - q.areaA);
    return {
        candidates: kept.slice(0, o.maxCandidates),
        totalFound: kept.length,
        areaA, areaB,
        bounds: {
            maxArea: o.maxArea, maxLengthMismatch: o.maxLengthMismatch, maxAngleMismatchDeg: o.maxAngleMismatchDeg,
            maxAreaMismatch: o.maxAreaMismatch, NAmax, NBmax, reference: o.reference, sortBy: o.sortBy,
            rotationConstraint: o.rotationConstraint
        }
    };
}

// -------------------------------------------------------------------------------------
// Atomic registry (geometric heuristic — NOT an energy)
// -------------------------------------------------------------------------------------
/**
 * Geometric atomic-registry score of two projected interfacial atom layers.
 *   R(Δ) = ½ [ ⟨exp(−d_i²/2σ²)⟩_{i∈A} + ⟨exp(−d_j²/2σ²)⟩_{j∈B} ]   ∈ [0, 1]
 * d_i = in-plane distance from atom i to the nearest compatible atom of the other layer, with
 * layer B translated by Δ = (dx, dy). Only atoms inside the overlap of both layers' footprints are
 * counted (finite-slab edge effects). σ and the compatibility rule are user choices.
 * This is a dimensionless geometric measure of coincidence; it contains no interatomic potential,
 * charge, relaxation or elastic energy and must not be interpreted as an interfacial energy.
 */
export function calculateAtomicRegistryScore(surfA, surfB, dx = 0, dy = 0, opts = {}) {
    const sigma = opts.sigma ?? opts.rc ?? 1.10;
    const repCutoff = opts.repCutoff ?? 0.72;
    const coincidenceRadius = opts.coincidenceRadius ?? opts.coincidenceCutoff ?? 0.75;
    const maxLateralCutoff = opts.maxLateralCutoff ?? 3.2;
    const pairMode = opts.pairMode ?? 'all';
    const empty = {
        score: 0,
        registryScore: 0,
        misregistry: 1,
        energy: 1,
        coincidenceCount: 0,
        compatibleTotal: 0,
        coincidenceRatio: 0,
        pairCount: 0,
        meanNearestDistance: Infinity,
        meanDrXY: Infinity,
        nA: 0,
        nB: 0
    };
    if (!surfA || !surfB || surfA.length === 0 || surfB.length === 0) return empty;

    const twoS2 = 2 * sigma * sigma;
    const repCutoffSq = repCutoff * repCutoff;
    const twoRepSigmaSq = 2 * 0.45 * 0.45;
    const coincSq = coincidenceRadius * coincidenceRadius;
    const maxLatSq = maxLateralCutoff * maxLateralCutoff;
    const isCompatiblePair = (a1, a2) =>
        pairMode === 'all' ||
        pairMode === 'cation_cation' ||
        (pairMode === 'same' && (a1.species === a2.species || a1.isAnion === a2.isAnion)) ||
        (pairMode === 'cation_anion' && a1.isAnion !== a2.isAnion);

    // 1. Forward pass (Primary surfA -> Secondary surfB shifted by (dx, dy))
    let sumGaussian1 = 0;
    let repPenalty1 = 0;
    let coincidenceCount = 0;
    let pairCount = 0;
    let sumDrXY = 0;
    let compatibleTotal1 = 0;

    let minX1 = Infinity, maxX1 = -Infinity, minY1 = Infinity, maxY1 = -Infinity;
    const lenA = surfA.length;
    const lenB = surfB.length;
    const cationsOnly = pairMode === 'cation_cation';

    // Shifted layer-B coordinates are loop-invariant: compute them once (Float64 keeps exact doubles)
    // instead of once per (i, j) pair in both passes.
    const bX = new Float64Array(lenB);
    const bY = new Float64Array(lenB);
    const bSkip = new Uint8Array(lenB);
    for (let j = 0; j < lenB; j++) {
        const a2 = surfB[j];
        bSkip[j] = cationsOnly && a2.isAnion ? 1 : 0;
        bX[j] = (a2.x0 !== undefined ? a2.x0 : a2.x) + dx;
        bY[j] = (a2.y0 !== undefined ? a2.y0 : a2.y) + dy;
    }

    for (let i = 0; i < lenA; i++) {
        const a1 = surfA[i];
        if (cationsOnly && a1.isAnion) continue;
        const x1 = a1.x;
        const y1 = a1.y;
        if (x1 < minX1) minX1 = x1;
        if (x1 > maxX1) maxX1 = x1;
        if (y1 < minY1) minY1 = y1;
        if (y1 > maxY1) maxY1 = y1;

        let bestDrSq = Infinity;
        let worstRepSq = Infinity;
        let hasCompatible = false;

        for (let j = 0; j < lenB; j++) {
            if (bSkip[j]) continue;
            const dX = bX[j] - x1;
            const dY = bY[j] - y1;
            const drSq = dX * dX + dY * dY;

            if (isCompatiblePair(a1, surfB[j])) {
                hasCompatible = true;
                if (drSq < bestDrSq) bestDrSq = drSq;
            } else if (drSq < worstRepSq) {
                worstRepSq = drSq;
            }
        }

        if (hasCompatible) {
            compatibleTotal1++;
            sumGaussian1 += Math.exp(-bestDrSq / twoS2);
            if (worstRepSq < repCutoffSq) {
                repPenalty1 += 0.35 * Math.exp(-worstRepSq / twoRepSigmaSq);
            }
            if (bestDrSq <= coincSq) coincidenceCount++;
            if (bestDrSq <= maxLatSq) {
                pairCount++;
                sumDrXY += Math.sqrt(bestDrSq);
            }
        }
    }

    if (compatibleTotal1 === 0) {
        return { ...empty, nA: lenA, nB: lenB };
    }

    // 2. Reverse pass (Secondary surfB -> Primary surfA) for mutual symmetry
    let sumGaussian2 = 0;
    let compatibleTotal2 = 0;
    let minX2 = Infinity, maxX2 = -Infinity, minY2 = Infinity, maxY2 = -Infinity;

    for (let j = 0; j < lenB; j++) {
        if (bSkip[j]) continue;
        const a2 = surfB[j];
        const sx2 = bX[j];
        const sy2 = bY[j];
        if (sx2 < minX2) minX2 = sx2;
        if (sx2 > maxX2) maxX2 = sx2;
        if (sy2 < minY2) minY2 = sy2;
        if (sy2 > maxY2) maxY2 = sy2;

        let bestDrSq = Infinity;
        let hasCompatible = false;
        for (let i = 0; i < lenA; i++) {
            const a1 = surfA[i];
            if (cationsOnly && a1.isAnion) continue;
            if (!isCompatiblePair(a1, a2)) continue;
            hasCompatible = true;
            const dX = sx2 - a1.x;
            const dY = sy2 - a1.y;
            const drSq = dX * dX + dY * dY;
            if (drSq < bestDrSq) bestDrSq = drSq;
        }
        if (hasCompatible) {
            compatibleTotal2++;
            sumGaussian2 += Math.exp(-bestDrSq / twoS2);
        }
    }

    // 3. Smooth 2D footprint overlap weight (penalizes sliding finite slabs completely apart without zeroing out single-atom tests)
    const spanX1 = Math.max(2.0, maxX1 - minX1);
    const spanY1 = Math.max(2.0, maxY1 - minY1);
    const spanX2 = Math.max(2.0, maxX2 - minX2);
    const spanY2 = Math.max(2.0, maxY2 - minY2);
    const ovX = Math.max(0, Math.min(maxX1, maxX2) - Math.max(minX1, minX2));
    const ovY = Math.max(0, Math.min(maxY1, maxY2) - Math.max(minY1, minY2));
    const minArea = Math.min(spanX1 * spanY1, spanX2 * spanY2);
    const hasFiniteArea = (maxX1 - minX1 > 0.5 && maxY1 - minY1 > 0.5 && maxX2 - minX2 > 0.5 && maxY2 - minY2 > 0.5);
    const overlapFrac = hasFiniteArea ? clamp((ovX * ovY) / Math.max(1.0, minArea), 0.15, 1.0) : 1.0;
    const overlapWeight = Math.min(1.0, 0.35 + 0.65 * overlapFrac);

    const meanGaussian1 = Math.max(0, (sumGaussian1 - repPenalty1) / compatibleTotal1);
    const meanGaussian2 = compatibleTotal2 > 0 ? (sumGaussian2 / compatibleTotal2) : meanGaussian1;
    const score = clamp((0.60 * meanGaussian1 + 0.40 * meanGaussian2) * overlapWeight, 0, 1);
    const energy = 1.0 - score;
    const coincidenceRatio = (coincidenceCount / compatibleTotal1) * 100.0;
    const meanDrXY = pairCount > 0 ? (sumDrXY / pairCount) : Infinity;

    return {
        score,
        registryScore: score,
        misregistry: energy,
        energy,
        coincidenceCount,
        compatibleTotal: compatibleTotal1,
        coincidenceRatio,
        pairCount,
        meanNearestDistance: meanDrXY,
        meanDrXY,
        nA: lenA,
        nB: lenB,
        sigma,
        coincidenceRadius,
        pairMode
    };
}

