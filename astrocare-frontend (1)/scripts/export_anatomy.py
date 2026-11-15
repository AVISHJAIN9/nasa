"""
Z-Anatomy Blender Export Pipeline
Exports and processes Z-Anatomy meshes into a lightweight, region-tagged glTF binary (anatomy.glb).
Run via: blender --background <Startup.blend> --python scripts/export_anatomy.py
"""

import sys
import os
import json
import re

try:
    import bpy
    import mathutils
except ImportError:
    print("Warning: bpy module not available. This script must be run inside Blender.")
    sys.exit(0)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
REGIONS_JSON = os.path.join(SCRIPT_DIR, "anatomy_regions.json")
OUTPUT_GLB = os.path.join(PROJECT_ROOT, "public", "models", "anatomy.glb")

# Non-commercial or excessively detailed keywords to exclude
EXCLUDE_KEYWORDS = [
    "inner_ear", "innerear", "ear_inner", "cochlea", "semicircular",
    "kidney", "renal", "nephron", # Lissie Cowley CC-BY-NC 4.0
    "nc", "noncommercial", "non-commercial",
    "eyelash", "teeth_root", "nail_cuticle"
]

def load_regions():
    with open(REGIONS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["regions"]

def should_exclude(obj_name):
    low = obj_name.lower()
    return any(k in low for k in EXCLUDE_KEYWORDS)

def determine_layer(obj):
    name = obj.name.lower()
    coll_names = [c.name.lower() for c in obj.users_collection]
    full = name + " " + " ".join(coll_names)

    if any(k in full for k in ["bone", "skeleton", "skeletal", "vertebra", "skull", "cranium", "costal", "cartilage"]):
        return "skeleton"
    if any(k in full for k in ["muscle", "musculature", "tendon", "ligament", "myo"]):
        return "muscles"
    return "surface"

def assign_region(obj, regions, body_min, body_size):
    name = obj.name.lower()
    coll_names = [c.name.lower() for c in obj.users_collection]
    full_str = name + " " + " ".join(coll_names)

    # 1. Regex rule
    for r in regions:
        pattern = r.get("regex")
        if pattern and re.search(pattern, full_str, re.IGNORECASE):
            return r["id"]

    # 2. Centroid fallback
    matrix = obj.matrix_world
    if len(obj.data.vertices) > 0:
        local_centroid = sum((v.co for v in obj.data.vertices), mathutils.Vector()) / len(obj.data.vertices)
        world_centroid = matrix @ local_centroid
        
        # Normalised [0, 1] relative to body
        norm_x = (world_centroid.x - (body_min.x + body_size.x / 2)) / (body_size.x if body_size.x > 0 else 1.0)
        norm_y = (world_centroid.z - body_min.z) / (body_size.z if body_size.z > 0 else 1.0) # Z is up in Blender
        norm_z = (world_centroid.y - (body_min.y + body_size.y / 2)) / (body_size.y if body_size.y > 0 else 1.0)

        for r in regions:
            bbox = r.get("bbox", {})
            y_min = bbox.get("yMin", 0.0)
            y_max = bbox.get("yMax", 1.0)
            x_min = bbox.get("xMin", -1.0)
            x_max = bbox.get("xMax", 1.0)

            if y_min <= norm_y <= y_max and x_min <= norm_x <= x_max:
                return r["id"]

    return None

def main():
    print("=" * 60)
    print("Starting Z-Anatomy Export Pipeline")
    print("=" * 60)

    regions = load_regions()
    region_ids = [r["id"] for r in regions]

    # Collect mesh objects
    mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    print(f"Total scene mesh objects found: {len(mesh_objs)}")

    # Calculate overall bounding box
    min_co = mathutils.Vector((float('inf'), float('inf'), float('inf')))
    max_co = mathutils.Vector((float('-inf'), float('-inf'), float('-inf')))

    valid_objs = []
    for obj in mesh_objs:
        if should_exclude(obj.name):
            continue
        valid_objs.append(obj)
        for corner in [obj.matrix_world @ mathutils.Vector(b) for b in obj.bound_box]:
            min_co.x = min(min_co.x, corner.x)
            min_co.y = min(min_co.y, corner.y)
            min_co.z = min(min_co.z, corner.z)
            max_co.x = max(max_co.x, corner.x)
            max_co.y = max(max_co.y, corner.y)
            max_co.z = max(max_co.z, corner.z)

    body_size = max_co - min_co
    print(f"Body bounding dimensions: {body_size.x:.2f} x {body_size.y:.2f} x {body_size.z:.2f}")

    # Map meshes by (region_id, layer)
    buckets = {} # (region_id, layer) -> [objs]

    for obj in valid_objs:
        layer = determine_layer(obj)
        reg_id = assign_region(obj, regions, min_co, body_size)
        key = (reg_id, layer)
        if key not in buckets:
            buckets[key] = []
        buckets[key].append(obj)

    # Process and merge per bucket
    print("\nMerging meshes per region and layer...")
    merged_objs = []

    for (reg_id, layer), objs in buckets.items():
        node_name = f"r:{reg_id}:{layer}" if reg_id else f"context:{layer}"
        
        # Deselect all
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]

        if len(objs) > 1:
            bpy.ops.object.join()
        
        merged = bpy.context.view_layer.objects.active
        merged.name = node_name

        # Decimate modifier
        decimate = merged.modifiers.new(name="Decimate", type='DECIMATE')
        decimate.ratio = 0.25 # Budget down to ~8MB
        bpy.ops.object.modifier_apply(modifier="Decimate")

        # Strip materials
        merged.data.materials.clear()

        merged_objs.append(merged)

    # Normalize body: centered, height = 1.8 units, Y-up, feet at Y=0
    # In Blender coordinate system: Z is up, Y is forward.
    scale_factor = 1.8 / body_size.z if body_size.z > 0 else 1.0
    for obj in merged_objs:
        obj.location.x = (obj.location.x - (min_co.x + body_size.x / 2)) * scale_factor
        obj.location.y = (obj.location.y - (min_co.y + body_size.y / 2)) * scale_factor
        obj.location.z = (obj.location.z - min_co.z) * scale_factor
        obj.scale *= scale_factor

    # Export glTF
    os.makedirs(os.path.dirname(OUTPUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_draco_mesh_compression_enable=False, # No Draco as required
        export_materials='NONE' # Flat colours in code
    )

    size_mb = os.path.getsize(OUTPUT_GLB) / (1024 * 1024)
    print(f"\nSuccessfully exported glTF binary to: {OUTPUT_GLB}")
    print(f"Export file size: {size_mb:.2f} MB")
    print("=" * 60)

if __name__ == "__main__":
    main()
