import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/models/contract/tabletop-wood-source.glb"
EPOXY_SOURCE = ROOT / "assets/models/contract/tabletop-epoxy-source.glb"
OUTPUT_DIR = ROOT / "assets/models/contract"
REVIEW_DIR = ROOT / "output/edge-profile-review"
UNITS_PER_INCH = 0.0254
CHAMFER_WIDTH_IN = 0.5
ROUNDED_CORNER_RADIUS_IN = 5
ANGLED_CORNER_CUT_IN = 8

VARIANTS = {
    "chamfered": {
        "target": OUTPUT_DIR / "tabletop-wood-chamfered-source.glb",
        "preview": REVIEW_DIR / "tabletop-wood-chamfered.png",
        "object": "tabletop_wood_chamfered_source",
        "mesh": "tabletop_wood_chamfered_source_mesh",
        "material": "tabletop_wood_chamfered_material",
        "label": "Chamfered edges"
    },
    "rounded": {
        "target": OUTPUT_DIR / "tabletop-wood-rounded-corners-source.glb",
        "preview": REVIEW_DIR / "tabletop-wood-rounded-corners.png",
        "object": "tabletop_wood_rounded_corners_source",
        "mesh": "tabletop_wood_rounded_corners_source_mesh",
        "material": "tabletop_wood_rounded_corners_material",
        "label": "Rounded corners"
    },
    "angled": {
        "target": OUTPUT_DIR / "tabletop-wood-angled-corners-source.glb",
        "preview": REVIEW_DIR / "tabletop-wood-angled-corners.png",
        "object": "tabletop_wood_angled_corners_source",
        "mesh": "tabletop_wood_angled_corners_source_mesh",
        "material": "tabletop_wood_angled_corners_material",
        "label": "Angled corners"
    }
}

EPOXY_VARIANTS = {
    "chamfered": {
        "target": OUTPUT_DIR / "tabletop-epoxy-chamfered-source.glb",
        "object": "tabletop_epoxy_chamfered_source",
        "mesh": "tabletop_epoxy_chamfered_source_mesh",
        "material": "tabletop_epoxy_chamfered_material"
    },
    "rounded": {
        "target": OUTPUT_DIR / "tabletop-epoxy-rounded-corners-source.glb",
        "object": "tabletop_epoxy_rounded_corners_source",
        "mesh": "tabletop_epoxy_rounded_corners_source_mesh",
        "material": "tabletop_epoxy_rounded_corners_material"
    },
    "angled": {
        "target": OUTPUT_DIR / "tabletop-epoxy-angled-corners-source.glb",
        "object": "tabletop_epoxy_angled_corners_source",
        "mesh": "tabletop_epoxy_angled_corners_source_mesh",
        "material": "tabletop_epoxy_angled_corners_material"
    }
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_source(source=SOURCE):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f"Expected one tabletop mesh in {source}, found {len(mesh_objects)}")
    obj = mesh_objects[0]
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    return obj


def bounds_for(obj):
    obj.update_from_editmode()
    obj.update_tag()
    coords = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    return {
        "min_x": min(coord.x for coord in coords),
        "max_x": max(coord.x for coord in coords),
        "min_y": min(coord.y for coord in coords),
        "max_y": max(coord.y for coord in coords),
        "min_z": min(coord.z for coord in coords),
        "max_z": max(coord.z for coord in coords)
    }


def rename_asset(obj, spec):
    obj.name = spec["object"]
    obj.data.name = spec["mesh"]
    for index, material in enumerate(obj.data.materials):
        if material:
            material.name = spec["material"] if index == 0 else f"{spec['material']}_{index + 1}"


def export_asset(obj, spec):
    rename_asset(obj, spec)
    spec["target"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=str(spec["target"]),
        export_format="GLB",
        export_apply=True,
        export_yup=True
    )


def set_origin_for_review(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")


def replace_outer_roundover_with_chamfer(obj, width):
    mesh = obj.data
    bounds = bounds_for(obj)
    top_z = bounds["max_z"]
    chamfer_bottom_z = top_z - width
    changed = 0

    for vertex in mesh.vertices:
        distance_to_outer_edge = min(
            vertex.co.x - bounds["min_x"],
            bounds["max_x"] - vertex.co.x,
            vertex.co.y - bounds["min_y"],
            bounds["max_y"] - vertex.co.y
        )
        if distance_to_outer_edge < 0 or distance_to_outer_edge > width:
            continue
        if vertex.co.z < chamfer_bottom_z or vertex.co.z > top_z:
            continue

        # Reuse the authored perimeter band, but flatten it onto one consistent bevel plane.
        target_z = chamfer_bottom_z + distance_to_outer_edge
        if abs(vertex.co.z - target_z) <= 0.000001:
            continue
        vertex.co.z = target_z
        changed += 1

    mesh.update()
    return changed


def bevel_top_exterior_edges(obj, width):
    mesh = obj.data
    bounds = bounds_for(obj)
    top_z = bounds["max_z"]
    edge_faces = {edge.index: [] for edge in mesh.edges}
    edge_index_by_key = {tuple(sorted(edge.vertices)): edge.index for edge in mesh.edges}

    for polygon in mesh.polygons:
        for edge_key in polygon.edge_keys:
            edge_index = edge_index_by_key.get(tuple(sorted(edge_key)))
            if edge_index is not None:
                edge_faces[edge_index].append(polygon)

    selected_count = 0
    for edge in mesh.edges:
        edge.select = False
        vertices = [mesh.vertices[index].co for index in edge.vertices]
        midpoint = (vertices[0] + vertices[1]) * 0.5
        distance_to_outer_edge = min(
            midpoint.x - bounds["min_x"],
            bounds["max_x"] - midpoint.x,
            midpoint.y - bounds["min_y"],
            bounds["max_y"] - midpoint.y
        )
        touches_top = max(vertex.z for vertex in vertices) >= top_z - 0.00001
        has_top_face = any(
            abs(polygon.normal.z) > 0.6 and all(mesh.vertices[index].co.z >= top_z - 0.00001 for index in polygon.vertices)
            for polygon in edge_faces[edge.index]
        )
        has_side_face = any(abs(polygon.normal.z) < 0.6 for polygon in edge_faces[edge.index])

        if touches_top and has_top_face and has_side_face and distance_to_outer_edge <= 0.00001:
            edge.select = True
            selected_count += 1

    if selected_count == 0:
        raise RuntimeError("Could not find top exterior edges for chamfer bevel")

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="EDGE")
    bpy.ops.mesh.bevel(offset=width, segments=1, affect="EDGES")
    bpy.ops.object.mode_set(mode="OBJECT")

    mesh.update()
    return selected_count


def create_chamfered(source=SOURCE):
    obj = import_source(source)
    bounds = bounds_for(obj)
    width = min(CHAMFER_WIDTH_IN * UNITS_PER_INCH, (bounds["max_z"] - bounds["min_z"]) * 0.5)
    changed = replace_outer_roundover_with_chamfer(obj, width)
    if changed == 0:
        raise RuntimeError("Could not find top exterior vertices for chamfer")

    weighted_normals = obj.modifiers.new("weighted_chamfer_normals", "WEIGHTED_NORMAL")
    weighted_normals.keep_sharp = True

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=weighted_normals.name)
    return obj


def rounded_rect_points(bounds, radius, segments=12):
    min_x, max_x = bounds["min_x"], bounds["max_x"]
    min_y, max_y = bounds["min_y"], bounds["max_y"]
    radius = min(radius, (max_x - min_x) * 0.49, (max_y - min_y) * 0.49)
    corners = [
        (max_x - radius, min_y + radius, -math.pi / 2, 0),
        (max_x - radius, max_y - radius, 0, math.pi / 2),
        (min_x + radius, max_y - radius, math.pi / 2, math.pi),
        (min_x + radius, min_y + radius, math.pi, math.pi * 1.5)
    ]
    points = []
    for cx, cy, start, end in corners:
        for step in range(segments + 1):
            if points and step == 0:
                continue
            angle = start + ((end - start) * (step / segments))
            points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return points


def angled_rect_points(bounds, cut):
    min_x, max_x = bounds["min_x"], bounds["max_x"]
    min_y, max_y = bounds["min_y"], bounds["max_y"]
    cut = min(cut, (max_x - min_x) * 0.49, (max_y - min_y) * 0.49)
    return [
        (min_x + cut, min_y),
        (max_x - cut, min_y),
        (max_x, min_y + cut),
        (max_x, max_y - cut),
        (max_x - cut, max_y),
        (min_x + cut, max_y),
        (min_x, max_y - cut),
        (min_x, min_y + cut)
    ]


def create_prism(name, points, min_z, max_z):
    verts = [(x, y, min_z) for x, y in points] + [(x, y, max_z) for x, y in points]
    count = len(points)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, next_index + count, index + count))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def boolean_clip_to_footprint(obj, points):
    bounds = bounds_for(obj)
    z_pad = (bounds["max_z"] - bounds["min_z"]) * 2
    cutter = create_prism(
        "edge_profile_outer_footprint_cutter",
        points,
        bounds["min_z"] - z_pad,
        bounds["max_z"] + z_pad
    )

    modifier = obj.modifiers.new("authored_outer_footprint_clip", "BOOLEAN")
    modifier.operation = "INTERSECT"
    modifier.solver = "EXACT"
    modifier.object = cutter

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

    normals = obj.modifiers.new("weighted_profile_normals", "WEIGHTED_NORMAL")
    normals.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normals.name)
    return obj


def apply_weighted_normals(obj, name="weighted_profile_normals"):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    normals = obj.modifiers.new(name, "WEIGHTED_NORMAL")
    normals.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normals.name)
    obj.select_set(False)
    return obj


def reshape_rounded_corners(obj, radius):
    bounds = bounds_for(obj)
    radius = min(radius, (bounds["max_x"] - bounds["min_x"]) * 0.49, (bounds["max_y"] - bounds["min_y"]) * 0.49)
    corners = [
        (bounds["min_x"] + radius, bounds["min_y"] + radius, -1, -1),
        (bounds["max_x"] - radius, bounds["min_y"] + radius, 1, -1),
        (bounds["max_x"] - radius, bounds["max_y"] - radius, 1, 1),
        (bounds["min_x"] + radius, bounds["max_y"] - radius, -1, 1)
    ]
    changed = 0

    for vertex in obj.data.vertices:
        for center_x, center_y, sign_x, sign_y in corners:
            if (vertex.co.x - center_x) * sign_x < 0 or (vertex.co.y - center_y) * sign_y < 0:
                continue
            offset_x = vertex.co.x - center_x
            offset_y = vertex.co.y - center_y
            distance = math.hypot(offset_x, offset_y)
            if distance <= radius or distance <= 0:
                continue
            vertex.co.x = center_x + (offset_x / distance * radius)
            vertex.co.y = center_y + (offset_y / distance * radius)
            changed += 1
            break

    obj.data.update()
    return changed


def reshape_angled_corners(obj, cut):
    bounds = bounds_for(obj)
    cut = min(cut, (bounds["max_x"] - bounds["min_x"]) * 0.49, (bounds["max_y"] - bounds["min_y"]) * 0.49)
    corners = [
        (bounds["min_x"], bounds["min_y"], 1, 1),
        (bounds["max_x"], bounds["min_y"], -1, 1),
        (bounds["max_x"], bounds["max_y"], -1, -1),
        (bounds["min_x"], bounds["max_y"], 1, -1)
    ]
    changed = 0

    for vertex in obj.data.vertices:
        for corner_x, corner_y, sign_x, sign_y in corners:
            local_x = (vertex.co.x - corner_x) * sign_x
            local_y = (vertex.co.y - corner_y) * sign_y
            if local_x < 0 or local_y < 0 or local_x > cut or local_y > cut:
                continue
            if local_x + local_y >= cut:
                continue
            push = (cut - local_x - local_y) * 0.5
            vertex.co.x += sign_x * push
            vertex.co.y += sign_y * push
            changed += 1
            break

    obj.data.update()
    return changed


def create_rounded(source=SOURCE):
    obj = import_source(source)
    bounds = bounds_for(obj)
    points = rounded_rect_points(bounds, ROUNDED_CORNER_RADIUS_IN * UNITS_PER_INCH, segments=18)
    return boolean_clip_to_footprint(obj, points)


def create_angled(source=SOURCE):
    obj = import_source(source)
    bounds = bounds_for(obj)
    points = angled_rect_points(bounds, ANGLED_CORNER_CUT_IN * UNITS_PER_INCH)
    return boolean_clip_to_footprint(obj, points)


def setup_review_scene(obj, label):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    set_origin_for_review(obj)
    bounds = bounds_for(obj)
    center = Vector((
        (bounds["min_x"] + bounds["max_x"]) * 0.5,
        (bounds["min_y"] + bounds["max_y"]) * 0.5,
        (bounds["min_z"] + bounds["max_z"]) * 0.5
    ))
    diagonal = math.sqrt(
        (bounds["max_x"] - bounds["min_x"]) ** 2
        + (bounds["max_y"] - bounds["min_y"]) ** 2
        + (bounds["max_z"] - bounds["min_z"]) ** 2
    )

    bpy.ops.object.light_add(type="AREA", location=(center.x - 1.1, center.y - 1.4, center.z + 2.0))
    key = bpy.context.object
    key.name = "review_key_light"
    key.data.energy = 550
    key.data.size = 3.0

    bpy.ops.object.camera_add(location=(center.x + 1.35, center.y - 2.6, center.z + 1.1), rotation=(math.radians(63), 0, math.radians(28)))
    camera = bpy.context.object
    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 45
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(diagonal * 0.58, 1.2)
    bpy.context.scene.camera = camera

    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    if hasattr(bpy.context.scene, "eevee"):
        bpy.context.scene.eevee.taa_render_samples = 64
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 1000
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.world.color = (0.78, 0.8, 0.82)

    font_curve = bpy.data.curves.new("review_label_curve", "FONT")
    font_curve.body = label
    font_curve.align_x = "CENTER"
    font_curve.size = 0.07
    text_obj = bpy.data.objects.new("review_label", font_curve)
    text_obj.location = (center.x, bounds["max_y"] + 0.16, bounds["max_z"] + 0.02)
    bpy.context.collection.objects.link(text_obj)


def render_preview(spec):
    setup_review_scene([obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.name.startswith("tabletop_wood")][0], spec["label"])
    bpy.context.scene.render.filepath = str(spec["preview"])
    bpy.ops.render.render(write_still=True)


def main():
    creators = {
        "chamfered": create_chamfered,
        "rounded": create_rounded,
        "angled": create_angled
    }
    for key, creator in creators.items():
        obj = creator(SOURCE)
        spec = VARIANTS[key]
        export_asset(obj, spec)
        render_preview(spec)
        print(f"Wrote {spec['target'].relative_to(ROOT)}")
        print(f"Wrote {spec['preview'].relative_to(ROOT)}")
    for key, creator in creators.items():
        obj = creator(EPOXY_SOURCE)
        spec = EPOXY_VARIANTS[key]
        export_asset(obj, spec)
        print(f"Wrote {spec['target'].relative_to(ROOT)}")


if __name__ == "__main__":
    main()
