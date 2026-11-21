import argparse
import json
import math
import sys
from functools import partial
from pathlib import Path

import bpy
from mathutils import Vector


def material(name, color):
    value = bpy.data.materials.get(name)
    if value is not None:
        return value
    rgb = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [part / 12.92 if part <= 0.04045 else ((part + 0.055) / 1.055) ** 2.4 for part in rgb]
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*linear, 1)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*linear, 1)
    shader.inputs["Roughness"].default_value = 0.82
    return value


def finish(obj, name, color):
    obj.name = name
    obj.data.materials.append(material(color, color))
    return obj


def box(name, position, size, color, bevel=0.02, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Soft handmade edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.harden_normals = True
        normal = obj.modifiers.new("Quiet broad faces", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
    return finish(obj, name, color)


def sphere(name, position, size, color, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=position)
    obj = bpy.context.object
    obj.scale = size
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return finish(obj, name, color)


def cylinder(name, position, radius, depth, color, top=None, vertices=24, bevel_segments=2):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=top if top is not None else radius,
                                  depth=depth, location=position)
    obj = bpy.context.object
    bevel = obj.modifiers.new("Turned edge", "BEVEL")
    bevel.width = min(0.012, depth / 5)
    bevel.segments = bevel_segments
    return finish(obj, name, color)


def link(name, a, b, radius, color, vertices=24, bevel_segments=2):
    direction = Vector(b) - Vector(a)
    obj = cylinder(name, (Vector(a) + Vector(b)) / 2, radius, direction.length, color,
                   vertices=vertices, bevel_segments=bevel_segments)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def stroke(name, points, radius, color):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    line = curve.splines.new("POLY")
    line.points.add(len(points) - 1)
    for point, position in zip(line.points, points):
        point.co = (*position, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, color)


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def cottage(details=False):
    start = set(bpy.data.objects)
    segments = 2 if details else 1
    box("Cream plaster", (0, 0, 0.185), (0.47, 0.42, 0.37), "#f1dfb8", 0.024, segments)
    box("Sandstone doorstep base", (0, 0, 0.018), (0.52, 0.46, 0.036), "#b39b74", 0.018, segments)
    vertices = [(-0.3, -0.27, 0.355), (0.3, -0.27, 0.355), (0, -0.27, 0.60),
                (-0.3, 0.27, 0.355), (0.3, 0.27, 0.355), (0, 0.27, 0.60)]
    mesh = bpy.data.meshes.new("Folded roof")
    mesh.from_pydata(vertices, [], [(0, 1, 2), (5, 4, 3), (0, 2, 5, 3), (2, 1, 4, 5), (1, 0, 3, 4)])
    roof = bpy.data.objects.new("Sage roof", mesh)
    bpy.context.collection.objects.link(roof)
    finish(roof, "Sage roof", "#4d7b6c")
    roof["roof"] = True
    bevel = roof.modifiers.new("Soft roof folds", "BEVEL")
    bevel.width = 0.009
    bevel.segments = segments
    for side in (-1, 1):
        for depth in (-0.18, 0, 0.18):
            beam = box("Roof seam", (side * 0.15, depth, 0.48), (0.39, 0.012, 0.012), "#416b5d", 0.004, segments)
            beam["roof"] = True
            beam.rotation_euler.y = side * math.atan2(0.245, 0.3)
    box("Terracotta chimney", (-0.15, 0.10, 0.49), (0.07, 0.075, 0.19), "#b17a5b", 0.008, segments)
    box("Chimney cap", (-0.15, 0.10, 0.59), (0.09, 0.095, 0.025), "#d8b897", 0.006, segments)
    if details:
        box("Oak door", (0, -0.217, 0.115), (0.10, 0.025, 0.19), "#856044", 0.015)
        sphere("Brass door knob", (0.025, -0.236, 0.112), (0.009, 0.009, 0.009), "#e8bf68")
        for x in (-0.14, 0.14):
            box("Warm window", (x, -0.217, 0.235), (0.08, 0.02, 0.08), "#f7d58a", 0.008)
            box("Window upright", (x, -0.231, 0.235), (0.009, 0.012, 0.09), "#f2e7ca", 0.002)
            box("Window crossbar", (x, -0.232, 0.235), (0.09, 0.012, 0.009), "#f2e7ca", 0.002)
            box("Window planter", (x, -0.238, 0.18), (0.10, 0.045, 0.035), "#b68055", 0.006)
            for dx in (-0.025, 0.025):
                sphere("Little window leaf", (x + dx, -0.245, 0.205), (0.025, 0.02, 0.025), "#6d9155")
    return [obj for obj in bpy.data.objects if obj not in start]


def courier(wave=False, runtime=False):
    start = set(bpy.data.objects)
    ball = partial(sphere, segments=10 if runtime else 16, rings=7 if runtime else 10)
    rounded = partial(box, segments=1 if runtime else 2)
    cap = partial(cylinder, vertices=10 if runtime else 24, bevel_segments=1 if runtime else 2)
    pole = partial(link, vertices=8 if runtime else 24, bevel_segments=1 if runtime else 2)
    def part(obj, name):
        obj["rig_part"] = name
        return obj
    for side in (-1, 1):
        name = "foot_left" if side < 0 else "foot_right"
        part(rounded("Walking boot", (side * 0.115, -0.035, 0.085), (0.18, 0.28, 0.16), "#74523d", 0.055), name)
        part(rounded("Trouser leg", (side * 0.11, 0, 0.30), (0.145, 0.15, 0.32), "#354d4f", 0.04), name)
    rounded("Teal travelling coat", (0, 0, 0.705), (0.49, 0.30, 0.56), "#397d7c", 0.085)
    rounded("Coat hem", (0, -0.005, 0.475), (0.48, 0.31, 0.06), "#2c6265", 0.025)
    cap("Neck", (0, 0, 1.005), 0.075, 0.12, "#dcb08a")
    ball("Friendly face", (0, -0.005, 1.22), (0.245, 0.215, 0.255), "#edc59c")
    for side in (-1, 1):
        ball("Ear", (side * 0.238, 0.005, 1.21), (0.05, 0.045, 0.065), "#e6b88e")
        part(ball("Bright eye", (side * 0.082, -0.207, 1.25), (0.025, 0.018, 0.032), "#293e3b"), "eyes")
        part(ball("Eye glint", (side * 0.082 - 0.006, -0.225, 1.26), (0.008, 0.005, 0.01), "#fff5db"), "eyes")
        ball("Warm cheek", (side * 0.148, -0.18, 1.18), (0.035, 0.012, 0.02), "#d79775")
    ball("Nose", (0, -0.225, 1.19), (0.038, 0.045, 0.046), "#e2ad82")
    stroke("Small smile", [(-0.061, -0.208, 1.134), (-0.031, -0.223, 1.117), (0, -0.228, 1.112),
                            (0.031, -0.223, 1.117), (0.061, -0.208, 1.134)], 0.007, "#98644d")
    cap("Hat brim", (0, 0.005, 1.43), 0.335, 0.045, "#e5bf74")
    cap("Hat crown", (0, 0.015, 1.535), 0.232, 0.18, "#d7ac62", 0.206)
    cap("Hat ribbon", (0, 0.015, 1.465), 0.235, 0.035, "#816044", 0.231)
    for side in (-1, 1):
        name = "arm_left" if side < 0 else "arm_right"
        shoulder = (side * 0.25, 0, 0.86)
        elbow = (side * 0.35, -0.005, 0.70)
        hand = (side * 0.35, -0.065, 0.55)
        if side == 1 and wave:
            elbow, hand = (0.41, 0, 1.005), (0.47, -0.02, 1.225)
        part(pole("Coat sleeve", shoulder, elbow, 0.09, "#397d7c"), name)
        part(pole("Coat forearm", elbow, hand, 0.075, "#397d7c"), name)
        part(ball("Mitten hand", hand, (0.078, 0.06, 0.09), "#edc59c"), name)
    pole("Satchel strap", (-0.20, -0.17, 0.93), (0.25, -0.17, 0.52), 0.022, "#d4ad72")
    rounded("Satchel", (0.26, -0.045, 0.53), (0.225, 0.15, 0.205), "#ad794c", 0.035)
    rounded("Satchel flap", (0.26, -0.075, 0.60), (0.235, 0.14, 0.075), "#ca975b", 0.025)
    rounded("Satchel buckle", (0.26, -0.152, 0.56), (0.025, 0.014, 0.035), "#ebc77e", 0.005)
    for z in (0.78, 0.67):
        ball("Coat button", (-0.045, -0.157, z), (0.016, 0.01, 0.016), "#e4c47f")
    part(pole("Rolled map", (-0.355, -0.07, 0.52), (-0.355, -0.07, 0.71), 0.043, "#f5e8c7"), "arm_left")
    objects = [obj for obj in bpy.data.objects if obj not in start]
    for obj in objects:
        if "rig_part" not in obj:
            obj["rig_part"] = "body"
    return objects


def translate(objects, position, scale=1):
    for obj in objects:
        obj.location = obj.location * scale + Vector(position)
        obj.scale *= scale


def camera(position, target, span):
    bpy.ops.object.camera_add(location=position)
    obj = bpy.context.object
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    obj.data.type = "ORTHO"
    obj.data.ortho_scale = span
    bpy.context.scene.camera = obj


def lighting():
    for position, energy, size, color in [
        ((-3, -4, 7), 450, 4, (1, 0.90, 0.74)),
        ((4, -1, 4), 170, 5, (0.77, 0.88, 1)),
        ((0, 4, 5), 260, 3, (1, 0.96, 0.84)),
    ]:
        bpy.ops.object.light_add(type="AREA", location=position)
        light = bpy.context.object
        light.data.energy, light.data.shape, light.data.size, light.data.color = energy, "DISK", size, color
        light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()


def render(path, width=256, height=256):
    print("CRAFT_RENDER", str(path), flush=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = width, height, 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(path)
    scene.world.color = (0.35, 0.35, 0.35)
    scene.view_settings.view_transform = "AgX"
    bpy.ops.render.render(write_still=True)


def export_mesh(objects, path):
    graph = bpy.context.evaluated_depsgraph_get()
    positions, normals, colors, indices, known = [], [], [], [], {}
    for source in objects:
        if source.type != "MESH":
            continue
        obj = source.evaluated_get(graph)
        mesh = obj.to_mesh()
        mesh.calc_loop_triangles()
        rotation = obj.matrix_world.to_3x3().inverted().transposed()
        for triangle in mesh.loop_triangles:
            for loop_index in triangle.loops:
                loop = mesh.loops[loop_index]
                p = obj.matrix_world @ mesh.vertices[loop.vertex_index].co
                n = (rotation @ mesh.corner_normals[loop_index].vector).normalized()
                color = source.data.materials[mesh.polygons[triangle.polygon_index].material_index].diffuse_color
                shade = 0.88 + 0.12 * max(0, n.z)
                vertex = tuple(round(v, 5) for v in (p.x, p.z, -p.y, n.x, n.z, -n.y,
                                                    color[0] * shade, color[1] * shade, color[2] * shade))
                if vertex not in known:
                    known[vertex] = len(positions) // 3
                    positions.extend(vertex[:3])
                    normals.extend(vertex[3:6])
                    colors.extend(vertex[6:])
                indices.append(known[vertex])
        obj.to_mesh_clear()
    path.write_text(json.dumps({"schema": 1, "positions": positions, "normals": normals,
                                "colors": colors, "indices": indices}, separators=(",", ":")), encoding="utf-8")
    print("CRAFT_MESH", json.dumps({"vertices": len(positions) // 3, "triangles": len(indices) // 3}), flush=True)

def painted_mesh(objects, name, pivot=(0, 0, 0), scale=1):
    graph = bpy.context.evaluated_depsgraph_get()
    vertices, normals, colors, roofs, faces, known = [], [], [], [], [], {}
    for source in objects:
        if source.type not in ("MESH", "CURVE"):
            continue
        obj = source.evaluated_get(graph)
        mesh = obj.to_mesh()
        mesh.calc_loop_triangles()
        rotation = obj.matrix_world.to_3x3().inverted().transposed()
        for triangle in mesh.loop_triangles:
            face = []
            for loop_index in triangle.loops:
                point = obj.matrix_world @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
                point = (point - Vector(pivot)) * scale
                normal = (rotation @ mesh.corner_normals[loop_index].vector).normalized()
                color = source.data.materials[mesh.polygons[triangle.polygon_index].material_index].diffuse_color
                shade = 0.9 + 0.1 * max(0, normal.z)
                roof = 1 if source.get("roof", False) else 0
                key = tuple(round(v, 5) for v in (*point, *normal, color[0] * shade, color[1] * shade, color[2] * shade, roof))
                if key not in known:
                    known[key] = len(vertices)
                    vertices.append(key[:3])
                    normals.append(key[3:6])
                    colors.append((*key[6:9], 1))
                    roofs.append(roof)
                face.append(known[key])
            faces.append(face)
        obj.to_mesh_clear()
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(clean_customdata=False)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    # Split vertices retain hard edges without Blender's unstable custom-normal setter.
    color = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="POINT")
    color.data.foreach_set("color", [part for value in colors for part in value])
    mesh.color_attributes.active_color_index = 0
    if any(roofs):
        roof = mesh.attributes.new(name="_ROOF", type="FLOAT", domain="POINT")
        roof.data.foreach_set("value", roofs)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    paint = material("Runtime vertex paint", "#ffffff")
    if paint.node_tree.nodes.get("Painted colors") is None:
        node = paint.node_tree.nodes.new("ShaderNodeVertexColor")
        node.name, node.layer_name = "Painted colors", "Color"
        paint.node_tree.links.new(node.outputs["Color"], paint.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    obj.data.materials.append(paint)
    return obj


def empty(name, position=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location, obj.parent = position, parent
    return obj


def courier_rig(objects):
    root = empty("courier")
    body = empty("body", parent=root)
    pivots = {"body": (0, 0, 0), "arm_left": (-0.25, 0, 0.86), "arm_right": (0.25, 0, 0.86),
              "foot_left": (-0.11, 0, 0.43), "foot_right": (0.11, 0, 0.43), "eyes": (0, -0.213, 1.25)}
    for part, pivot in pivots.items():
        group = body if part == "body" else empty(part, tuple(value * 0.25 for value in pivot),
                                                  root if part.startswith("foot") else body)
        mesh = painted_mesh([obj for obj in objects if obj["rig_part"] == part], f"{part}_mesh", pivot, 0.25)
        mesh.parent = group
    return root


def tree(theme, runtime=False):
    start = set(bpy.data.objects)
    ball = partial(sphere, segments=8 if runtime else 16, rings=5 if runtime else 10)
    pole = partial(link, vertices=8 if runtime else 24, bevel_segments=1 if runtime else 2)
    cone = partial(cylinder, vertices=8 if runtime else 24, bevel_segments=1 if runtime else 2)
    if theme == "coast":
        pole("Palm trunk", (0, 0, 0), (0.04, 0, 0.67), 0.035, "#98734f")
        for index in range(6):
            angle = index * math.tau / 6
            leaf = ball("Palm frond", (0.04 + math.cos(angle) * 0.16, math.sin(angle) * 0.16, 0.70),
                        (0.26, 0.075, 0.035), "#799d74")
            leaf.rotation_euler.z = angle
            leaf.rotation_euler.y = 0.2
    elif theme == "winter":
        cone("Pine trunk", (0, 0, 0.24), 0.035, 0.48, "#887057")
        for z, radius in [(0.36, 0.29), (0.57, 0.24), (0.76, 0.17)]:
            cone("Evergreen tier", (0, 0, z), radius, 0.31, "#527868", 0.015)
            cone("Snow mantle", (0, 0, z + 0.075), radius * 0.86, 0.18, "#e0e7e2", 0)
    else:
        palette = {
            "maple": ("#cb713f", "#e39a51", "#edbc78"),
            "ginkgo": ("#c5ad62", "#dbc47b", "#e7d494"),
            "lavender": ("#87977d", "#9aa797", "#aeb5a6"),
            "orchard": ("#77935e", "#8fa66e", "#a9b980"),
        }.get(theme, ("#819b66", "#9bae78", "#b2be89"))
        pole("Little trunk", (0, 0, 0), (0, 0, 0.58), 0.038, "#947452")
        for index, (x, y, z, size) in enumerate([(-0.15, 0, 0.57, 0.24), (0.15, 0.04, 0.61, 0.24),
                                               (0, -0.10, 0.76, 0.26), (0.03, 0.13, 0.78, 0.22)]):
            ball("Soft leaf crown", (x, y, z), (size, size * 0.86, size * 0.88), palette[index % 3])
        if theme == "orchard":
            for x, y, z in [(-0.19, -0.15, 0.60), (0.16, -0.14, 0.70), (0.04, -0.24, 0.77)]:
                ball("Ripe little apple", (x, y, z), (0.034, 0.034, 0.037), "#bd7259")
    return [obj for obj in bpy.data.objects if obj not in start]


def rose_clump(color):
    for index, (x, y, z) in enumerate([(-0.10, 0.02, 0.27), (0.08, 0.05, 0.34), (0.03, -0.10, 0.24)]):
        link("Rose stem", (x, y, 0.01), (x, y, z), 0.009, "#6b8754")
        sphere("Rose leaf", (x - 0.03, y, z * 0.52), (0.07, 0.025, 0.018), "#789359")
        for layer, count in [(0, 7), (1, 5), (2, 4)]:
            radius = 0.047 - layer * 0.014
            for petal in range(count):
                angle = petal * math.tau / count + layer * 0.65 + index
                obj = sphere("Folded rose petal", (x + math.cos(angle) * radius, y + math.sin(angle) * radius, z + layer * 0.018),
                             (0.041 - layer * 0.008, 0.028 - layer * 0.005, 0.014), color)
                obj.rotation_euler = (0.18 + layer * 0.18, 0, angle)


def roof_tint(objects, color):
    for obj in objects:
        if obj.get("roof", False):
            obj.data.materials.clear()
            obj.data.materials.append(material(color, color))


def make_full_kit(output):
    clear()
    sources = cottage()
    house = painted_mesh(sources, "cottage")
    for obj in sources:
        bpy.data.objects.remove(obj, do_unlink=True)
    sources = courier(runtime=True)
    rig = courier_rig(sources)
    for obj in sources:
        bpy.data.objects.remove(obj, do_unlink=True)
    themes = ["meadow", "coast", "orchard", "winter", "blossom", "maple", "ginkgo", "lavender"]
    for theme in themes:
        sources = tree("meadow" if theme == "blossom" else theme, runtime=True)
        print("CRAFT_TREE", theme, flush=True)
        painted_mesh(sources, f"tree_{theme}")
        for obj in sources:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    rock_source = bpy.context.object
    rock_source.scale = (0.31, 0.27, 0.25)
    finish(rock_source, "Quiet stone", "#ffffff")
    for polygon in rock_source.data.polygons:
        polygon.use_smooth = True
    painted_mesh([rock_source], "rock")
    bpy.data.objects.remove(rock_source, do_unlink=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(output / "world-kit.glb"), export_format="GLB", use_selection=True,
                              export_texcoords=False, export_normals=True, export_vertex_color="ACTIVE",
                              export_attributes=True, export_animations=False, export_skins=False,
                              export_cameras=False, export_lights=False, export_extras=False)
    print("CRAFT_WORLD_KIT", (output / "world-kit.glb").stat().st_size, flush=True)
    for pose in range(6):
        clear()
        sources = courier(runtime=True)
        rig = courier_rig(sources)
        for obj in sources:
            bpy.data.objects.remove(obj, do_unlink=True)
        rig.scale = (4, 4, 4)
        if pose in (1, 2):
            angle = 0.32 if pose == 1 else -0.32
            bpy.data.objects["foot_left"].rotation_euler.x = angle
            bpy.data.objects["foot_right"].rotation_euler.x = -angle
            bpy.data.objects["arm_left"].rotation_euler.x = -angle * 0.8
            bpy.data.objects["arm_right"].rotation_euler.x = angle * 0.8
        elif pose in (3, 5):
            bpy.data.objects["arm_right"].rotation_euler.y = -2.35 if pose == 3 else -2.65
        elif pose == 4:
            bpy.data.objects["eyes"].scale.z = 0.12
        lighting()
        camera((2.3, -8, 2.6), (0, 0, 0.82), 1.86)
        render(output / f"actor-{pose}.png")
    colors = ["#4d7b6c", "#ad7057", "#638aa1", "#8d789b", "#b17f8b", "#ab8b54"]
    for winter in (False, True):
        for variant, color in enumerate(colors):
            for flat in (False, True):
                clear()
                sources = cottage(True)
                roof_tint(sources, color)
                if winter:
                    roof = next(obj for obj in sources if obj.name.startswith("Sage roof"))
                    snow = roof.copy()
                    snow.data = roof.data.copy()
                    bpy.context.collection.objects.link(snow)
                    snow.name = "A little roof snow"
                    snow.location.z += 0.012
                    snow.scale = (0.96, 0.97, 1)
                    snow.data.materials.clear()
                    snow.data.materials.append(material("Soft snow", "#e1e7e1"))
                lighting()
                camera((0.9 if not flat else 0.1, -2, 1.6 if not flat else 3), (0, 0, 0.27), 0.88)
                render(output / f"house-{'snow' if winter else 'day'}-{variant + (6 if flat else 0)}.png", 192, 192)
    for cell in range(12):
        clear()
        if cell < 8:
            tree("meadow" if themes[cell] == "blossom" else themes[cell])
            target, span = (0, 0, 0.46), 1.20
        else:
            rose_clump(["#d5a5a2", "#d3a9c5", "#dec38a", "#e6dfc7"][cell - 8])
            target, span = (0, 0, 0.17), 0.57
        lighting()
        camera((1.1, -3, 2.1), target, span)
        render(output / f"flora-{cell}.png")
    scenes = [("meadow", "field"), ("meadow", "mill"), ("coast", "pond"), ("meadow", "grove"),
              ("meadow", "ridge"), ("orchard", "grove"), ("maple", "grove"), ("ginkgo", "grove"),
              ("lavender", "field"), ("coast", "lighthouse"), ("coast", "reeds"), ("winter", "grove"),
              ("winter", "ridge"), ("winter", "pond"), ("coast", "ridge"), ("meadow", "field")]
    for cell, (theme, kind) in enumerate(scenes):
        clear()
        ground = {"winter": "#c7d2d0", "maple": "#b6a47c", "ginkgo": "#bab68b",
                  "lavender": "#a7aa9c", "coast": "#9bb599"}.get(theme, "#a0b27f")
        box("Miniature ground", (0, 0, 0.06), (2.40, 1.40, 0.14), ground, 0.15)
        if kind in ("pond", "reeds"):
            sphere("Still little pond", (0, 0, 0.13), (0.95, 0.49, 0.04), "#8caeb5")
            for x in (-0.85, 0.78):
                for shift in (-0.06, 0.04):
                    link("Pond reed", (x + shift, 0.18, 0.15), (x + shift, 0.18, 0.50), 0.012, "#7b9270")
        elif kind == "ridge":
            for x, z, size in [(-0.55, 0.36, 0.45), (0, 0.50, 0.62), (0.58, 0.29, 0.36)]:
                sphere("Rounded ridge", (x, 0.08, z), (size, size * 0.62, size * 0.8), "#a5afa7")
                if theme == "winter":
                    sphere("Ridge snow", (x, 0.08, z + size * 0.48), (size * 0.7, size * 0.45, size * 0.25), "#e2e8e2")
        elif kind == "lighthouse":
            cylinder("Lighthouse", (0, 0, 0.58), 0.19, 0.94, "#eee3cb", 0.14)
            cylinder("Lighthouse stripe", (0, 0, 0.67), 0.175, 0.15, "#b47e65", 0.168)
            cylinder("Golden lantern", (0, 0, 1.12), 0.17, 0.17, "#e5c27b")
            cylinder("Lantern roof", (0, 0, 1.26), 0.25, 0.17, "#668d84", 0)
        elif kind == "mill":
            translate(cottage(True), (0, 0.05, 0.15), 1.5)
            for angle in (math.pi / 4, -math.pi / 4):
                sail = box("Windmill sail", (0, -0.47, 0.89), (0.95, 0.04, 0.07), "#dfd3ad", 0.01)
                sail.rotation_euler.y = angle
        else:
            for x, y, scale in [(-0.60, 0.08, 0.75), (0.51, 0.18, 0.90)]:
                translate(tree(theme), (x, y, 0.14), scale)
            if kind == "field":
                for x in (-0.55, -0.20, 0.15, 0.50):
                    box("A planted row", (x, -0.39, 0.15), (0.20, 0.46, 0.05),
                        "#a296af" if theme == "lavender" else "#b8bf91", 0.04)
        lighting()
        camera((4.6, -7, 5.2), (0, 0.02, 0.43), 3.05)
        render(output / f"map-{cell}.png", 256, 192)


def build(output, blend):
    print("CRAFT_BEGIN", bpy.app.version_string, flush=True)
    output.mkdir(parents=True, exist_ok=True)
    clear()
    export_mesh(cottage(), output / "cottage.json")
    clear()
    box("Floating earth", (0, 0.02, 0.08), (2.90, 1.92, 0.28), "#b99869", 0.13)
    box("Velvet meadow", (0, 0.02, 0.235), (2.88, 1.90, 0.12), "#8ca76b", 0.12)
    for index, (x, y) in enumerate([(-1.24, -0.58), (-0.91, -0.58), (-0.58, -0.58), (-0.25, -0.58),
                                   (0.08, -0.58), (0.41, -0.58), (0.41, -0.25), (0.41, 0.08)]):
        stone = box("A little road", (x, y, 0.312), (0.30, 0.30, 0.055), "#e9d8b3", 0.045)
        stone.rotation_euler.z = math.sin(index * 9) * 0.025
    translate(cottage(True), (0.60, 0.43, 0.30), 1.05)
    translate(cottage(True), (-0.94, 0.44, 0.30), 0.75)
    translate(courier(True), (-0.62, -0.36, 0.34), 0.53)
    for x, y, size in [(-1.22, 0.49, 0.13), (1.14, -0.44, 0.18), (1.1, 0.55, 0.14)]:
        sphere("Quiet rounded stone", (x, y, 0.30 + size * 0.35), (size, size * 0.8, size * 0.65), "#929b88")
    for index, (x, y) in enumerate([(-1.13, -0.10), (1.18, 0.12), (0.95, -0.65), (-0.18, 0.56)]):
        for side in (-1, 1):
            sphere("Garden leaf", (x + side * 0.035, y, 0.35), (0.065, 0.035, 0.025), "#567c50")
        link("Little flower stem", (x, y, 0.31), (x, y, 0.48), 0.009, "#577d4c")
        for petal in range(5):
            a = petal * math.tau / 5
            sphere("Small garden petal", (x + math.cos(a) * 0.032, y + math.sin(a) * 0.032, 0.49),
                   (0.031, 0.023, 0.012), "#e6bc76" if index % 2 else "#ddaaa0")
        sphere("Flower heart", (x, y, 0.502), (0.016, 0.016, 0.012), "#b88645")
    lighting()
    camera((4.6, -7, 5.2), (0, 0.02, 0.53), 3.65)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=False, check_existing=False)
    render(output / "little-world.png", 720, 420)
    for wave, name in [(False, "courier"), (True, "courier-wave")]:
        clear()
        courier(wave)
        lighting()
        camera((2.3, -8, 2.6), (0, 0, 0.82), 1.86)
        render(output / f"{name}.png")
    make_full_kit(output)
    print("CRAFT_BUILD", json.dumps({"blender": bpy.app.version_string, "output": str(output), "source": str(blend)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--blend", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    build(args.output, args.blend)
