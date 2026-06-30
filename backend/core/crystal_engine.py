from pymatgen.core import Structure
from typing import Dict, Any

class CrystalProcessor:
    def __init__(self, filepath: str):
        self.structure = Structure.from_file(filepath)

    def get_visualization_data(self) -> Dict[str, Any]:
        lattice = self.structure.lattice
        
        atoms = []
        for site in self.structure:
            atoms.append({
                "species": site.specie.symbol,
                "position": [site.coords[0], site.coords[1], site.coords[2]]
            })

        return {
            "formula": self.structure.composition.reduced_formula,
            "lattice_parameters": {
                "a": lattice.a,
                "b": lattice.b,
                "c": lattice.c,
                "alpha": lattice.alpha,
                "beta": lattice.beta,
                "gamma": lattice.gamma
            },
            "lattice_matrix": lattice.matrix.tolist(),
            "atoms": atoms,
            "space_group": self.structure.get_space_group_info()[0]
        }