import math
import os
import re
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymatgen.core import Structure, Lattice
from pymatgen.io.cif import CifParser

app = FastAPI(title="Crystallography Viewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

_SG_CRYSTAL_SYSTEMS = (
    (2, "triclinic"),
    (15, "monoclinic"),
    (74, "orthorhombic"),
    (142, "tetragonal"),
    (167, "trigonal"),
    (194, "hexagonal"),
    (230, "cubic"),
)


def _determine_crystal_system(lattice: Lattice, sg_num) -> str:
    if sg_num is not None:
        for max_sg, system in _SG_CRYSTAL_SYSTEMS:
            if sg_num <= max_sg:
                return system
        return "cubic"

    a, b, c = lattice.abc
    alpha, beta, gamma = lattice.angles
    if abs(alpha - 90) < 0.1 and abs(beta - 90) < 0.1 and abs(gamma - 120) < 0.1:
        return "hexagonal"
    if abs(alpha - 90) < 0.1 and abs(beta - 90) < 0.1 and abs(gamma - 90) < 0.1:
        if abs(a - b) < 0.05 and abs(b - c) < 0.05:
            return "cubic"
        return "tetragonal" if abs(a - b) < 0.05 else "orthorhombic"
    if abs(alpha - 90) < 0.1 and abs(gamma - 90) < 0.1 and abs(beta - 90) >= 0.1:
        return "monoclinic"
    return "triclinic"


def extract_site_symbol(site) -> str:
    """Safely extract the chemical element symbol for both ordered and disordered/doped CIF sites."""
    try:
        if getattr(site, "is_ordered", True):
            sp = site.specie
            return getattr(sp, "symbol", str(sp))
    except Exception:
        pass
    try:
        dominant_sp = max(site.species.items(), key=lambda x: x[1])[0]
        return getattr(dominant_sp, "symbol", str(dominant_sp))
    except Exception:
        cleaned = re.sub(r"[^A-Za-z]", "", getattr(site, "species_string", "X"))
        return cleaned[:2].capitalize() if cleaned else "X"


def format_structure_response(structure: Structure):
    lattice = structure.lattice
    reciprocal_matrix = lattice.reciprocal_lattice.matrix

    # Pymatgen provides the 3x3 lattice vector matrix in Cartesian Angstroms
    lattice_matrix = lattice.matrix.tolist()
    # Pymatgen reciprocal_lattice.matrix uses the solid-state physics 2pi convention: a_i . b_j = 2pi delta_ij
    reciprocal_matrix_physics = reciprocal_matrix.tolist()
    # Crystallographic convention: a_i . b_j = delta_ij (WITHOUT 2pi) so that |g_hkl| = 1/d_hkl in A^-1
    reciprocal_matrix_cryst = (reciprocal_matrix / (2.0 * math.pi)).tolist()

    # Space group info
    sg_num = None
    try:
        space_group, sg_num = structure.get_space_group_info()
    except Exception:
        space_group = "Unknown"

    crystal_system = _determine_crystal_system(lattice, sg_num)

    atoms = []
    for site in structure:
        sym = extract_site_symbol(site)
        try:
            if getattr(site, "is_ordered", True):
                occ = float(getattr(site, "occupancy", 1.0))
            else:
                occ = float(max(site.species.values()))
        except Exception:
            occ = 1.0
        atoms.append({
            "species": sym,
            "position": site.coords.tolist(),
            "occupancy": occ
        })

    return {
        "crystal_system": crystal_system,
        "space_group": space_group,
        "lattice_matrix": lattice_matrix,
        "reciprocal_matrix": reciprocal_matrix_cryst,
        "reciprocal_matrix_physics": reciprocal_matrix_physics,
        "reciprocal_convention": "crystallographic_no_2pi",
        "atoms": atoms
    }


def build_preset_structure(material: str) -> Structure:
    material = material.lower().strip()
    if material == "alumina":
        cif_path = os.path.join(DATA_DIR, "alumina.cif")
        if os.path.exists(cif_path):
            try:
                parser = CifParser(cif_path, occupancy_tolerance=10.0)
                structs = parser.parse_structures(primitive=False)
                if structs:
                    return structs[0]
            except Exception:
                pass
        # Standard α-Al2O3 (Corundum, R-3c No. 167, hexagonal setting)
        # Lattice parameters: a = 4.759 A, c = 12.991 A
        lat = Lattice.hexagonal(4.759, 12.991)
        return Structure.from_spacegroup(
            "R-3c", lat, ["Al", "O"], [[0.0, 0.0, 0.352], [0.306, 0.0, 0.25]]
        )
    elif material == "zirconia_m":
        # Monoclinic ZrO2 (Baddeleyite, P2_1/c No. 14)
        # Lattice parameters: a = 5.147 A, b = 5.212 A, c = 5.315 A, beta = 99.23 deg
        lat = Lattice.monoclinic(5.147, 5.212, 5.315, 99.23)
        return Structure.from_spacegroup(
            "P2_1/c", lat,
            ["Zr", "O", "O"],
            [[0.2758, 0.0404, 0.2089], [0.069, 0.342, 0.345], [0.451, 0.758, 0.479]]
        )
    elif material == "zirconia_t":
        # Tetragonal ZrO2 (P4_2/nmc No. 137)
        # Lattice parameters: a = 3.596 A, c = 5.184 A
        lat = Lattice.tetragonal(3.596, 5.184)
        return Structure.from_spacegroup(
            "P4_2/nmc", lat,
            ["Zr", "O"],
            [[0.0, 0.0, 0.0], [0.0, 0.5, 0.205]]
        )
    elif material in ("zirconia_3ytzp", "tz3y", "3ytzp"):
        # Tetragonal 3Y-TZP (~3 mol% Y2O3-stabilized ZrO2, P4_2/nmc No. 137)
        # Yashima et al. (1996), Scott (1975)
        # Lattice parameters: a = 3.605 A, c = 5.178 A
        lat = Lattice.tetragonal(3.605, 5.178)
        return Structure.from_spacegroup(
            "P4_2/nmc", lat,
            [{"Zr": 0.94, "Y": 0.06}, {"O": 0.97}],
            [[0.0, 0.0, 0.0], [0.0, 0.5, 0.203]]
        )
    elif material == "zirconia_c":
        # Cubic Fluorite ZrO2 (Fm-3m No. 225)
        lat = Lattice.cubic(5.128)
        return Structure.from_spacegroup(
            "Fm-3m", lat,
            ["Zr", "O"],
            [[0.0, 0.0, 0.0], [0.25, 0.25, 0.25]]
        )
    else:
        raise HTTPException(status_code=404, detail=f"Unknown preset material '{material}'.")


def _finalize_structure(structure: Structure, sc_x: int, sc_y: int, sc_z: int):
    if sc_x > 1 or sc_y > 1 or sc_z > 1:
        structure.make_supercell([sc_x, sc_y, sc_z])
    return format_structure_response(structure)


@app.get("/crystal/{material}")
async def get_preset_crystal(
    material: str,
    sc_x: int = Query(1, ge=1, le=10),
    sc_y: int = Query(1, ge=1, le=10),
    sc_z: int = Query(1, ge=1, le=10)
):
    try:
        structure = build_preset_structure(material)
        return _finalize_structure(structure, sc_x, sc_y, sc_z)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preset load error: {str(e)}")


@app.post("/crystal/upload")
async def upload_cif(
    file: UploadFile = File(...),
    sc_x: int = Query(1, ge=1, le=10),
    sc_y: int = Query(1, ge=1, le=10),
    sc_z: int = Query(1, ge=1, le=10)
):
    try:
        contents = await file.read()
        cif_text = contents.decode("utf-8", errors="ignore")

        parser = CifParser.from_str(cif_text, occupancy_tolerance=10.0)
        structures = parser.parse_structures(primitive=False)
        if not structures:
            raise HTTPException(status_code=400, detail="Could not parse any valid crystallographic structures from this CIF.")

        return _finalize_structure(structures[0], sc_x, sc_y, sc_z)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CIF processing error: {str(e)}")
