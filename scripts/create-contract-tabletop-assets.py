import bpy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

ASSETS = [
    {
        "source": ROOT / "assets/models/Walnut tabletop.glb",
        "target": ROOT / "assets/models/contract/tabletop-wood-source.glb",
        "object_name": "tabletop_wood_source",
        "mesh_name": "tabletop_wood_source_mesh",
        "material_name": "tabletop_wood_material"
    },
    {
        "source": ROOT / "assets/models/live-edge-walnut-river-tabletop.glb",
        "target": ROOT / "assets/models/contract/tabletop-live-edge-source.glb",
        "object_name": "tabletop_live_edge_source",
        "mesh_name": "tabletop_live_edge_source_mesh",
        "material_name": "tabletop_live_edge_material"
    },
    {
        "source": ROOT / "assets/models/textures/epoxy-edited-multi-grey.glb",
        "target": ROOT / "assets/models/contract/tabletop-epoxy-source.glb",
        "object_name": "tabletop_epoxy_source",
        "mesh_name": "tabletop_epoxy_source_mesh",
        "material_name": "tabletop_epoxy_material"
    }
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def normalize_imported_asset(spec):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(spec["source"]))

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError(f"No mesh objects imported from {spec['source']}")

    for index, obj in enumerate(mesh_objects):
        suffix = "" if index == 0 else f"_{index + 1}"
        obj.name = f"{spec['object_name']}{suffix}"
        obj.data.name = f"{spec['mesh_name']}{suffix}"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)

        for material_index, material in enumerate(obj.data.materials):
            if not material:
                continue
            material.name = spec["material_name"] if material_index == 0 else f"{spec['material_name']}_{material_index + 1}"

    spec["target"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(spec["target"]),
        export_format="GLB",
        export_apply=True,
        export_yup=True
    )


def main():
    for spec in ASSETS:
        normalize_imported_asset(spec)
        print(f"Wrote {spec['target'].relative_to(ROOT)}")


if __name__ == "__main__":
    main()
