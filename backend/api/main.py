from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymatgen.core import Structure
from pymatgen.symmetry.analyzer import SpacegroupAnalyzer
import os

app = FastAPI()

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/crystal/{material}")
def get_crystal(material: str):
    # Adjust this path if your CIF files are stored differently
    cif_path = f"../data/{material}.cif"
    
    if not os.path.exists(cif_path):
        return {"error": f"CIF file not found at {cif_path}"}

    # 1. Load the raw structure from the CIF
    raw_structure = Structure.from_file(cif_path)

    # 2. THE FIX: Generate the full Conventional Unit Cell
    sga = SpacegroupAnalyzer(raw_structure)
    conv_structure = sga.get_conventional_standard_structure()

    # 3. Extract the physical Lattice Matrix
    lattice_matrix = conv_structure.lattice.matrix.tolist()

    # 4. Extract Atoms (using .coords for precise Cartesian Angstroms)
    atoms = []
    for site in conv_structure.sites:
        atoms.append({
            "species": site.specie.symbol,
            "position": site.coords.tolist() 
        })

    return {
        "lattice_matrix": lattice_matrix,
        "atoms": atoms,
        "space_group": sga.get_space_group_symbol(),
        "crystal_system": sga.get_crystal_system()
    }