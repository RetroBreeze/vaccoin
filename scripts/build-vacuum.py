"""Rebuild with: blender --background --python scripts/build-vacuum.py
Coordinates below use game axes (Y up, nozzle toward -Z). No external assets.
Canonical reference: public/assets/logo.png. Only head and hose are visible.
"""
import bpy, math, os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
colors = {'body':'83709e', 'trim':'d0b7e5', 'dark':'332b49', 'accent':'ffd329', 'coupler':'04d4cf'}
mats = {}
for name, color in colors.items():
    rgb = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    # glTF stores linear colour; preserve the illustration's sRGB palette.
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new(name); m.diffuse_color=(*linear,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*linear,1)
    bs.inputs['Roughness'].default_value=.85
    mats[name]=m

def mesh(name, verts, faces, material):
    data=bpy.data.meshes.new(name)
    data.from_pydata([(x,-z,y) for x,y,z in verts], [], faces); data.update()
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats[material]); return obj

def rect(w,h,z,y=.08):
    b=.035
    return [(-w/2+b,y-h/2,z),(w/2-b,y-h/2,z),(w/2,y-h/2+b,z),(w/2,y+h/2-b,z),(w/2-b,y+h/2,z),(-w/2+b,y+h/2,z),(-w/2,y+h/2-b,z),(-w/2,y-h/2+b,z)]

def shell(name,rings,mat,cap=False):
    n=len(rings[0]); verts=sum(rings,[])
    faces=[]
    for j in range(len(rings)-1):
        for i in range(n):
            a=j*n+i; b=j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    if cap: faces.extend([tuple(reversed(range(n))),tuple(range((len(rings)-1)*n,len(rings)*n))])
    return mesh(name,verts,faces,mat)

# Broad flattened scoop with angular shoulders, raised lavender edge and gold band.
shell('Flared purple head',[rect(.32,.28,-.15),rect(.48,.34,-.28),rect(.92,.40,-.68),rect(.95,.40,-.76)],'body')
shell('Mouth bevel',[rect(.95,.40,-.76),rect(.97,.42,-.79),rect(.86,.31,-.81)],'trim')
shell('Gold mouth stripe',[rect(.92,.42,-.64),rect(.98,.43,-.77)],'accent')
shell('Recessed intake',[rect(.86,.31,-.81),rect(.68,.20,-.54)],'dark',True)
# Leave the front open: only the back face of the intake cavity is capped.
obj=bpy.data.objects['Recessed intake']
# Recreate cavity without the front cap.
bpy.data.objects.remove(obj,do_unlink=True)
shell('Intake walls',[rect(.86,.31,-.81),rect(.68,.20,-.54)],'dark')
mesh('Intake shadow',rect(.68,.20,-.54),[tuple(range(8))],'dark')
shell('Turquoise coupling',[rect(.30,.27,.08),rect(.36,.32,.025),rect(.36,.32,-.13),rect(.30,.27,-.18)],'coupler',True)
# Ribbed hose curves rearward and left like the trailing hose in the logo.
# 49 cross sections x 12 sides, paired ring ridges, faceted radial normals.
points=[]
for i in range(49):
    t=i/48
    points.append(Vector((-.65*t*t, -.05-.18*math.sin(t*math.pi*.8), .10+1.05*t)))
for i in range(48):
    rings=[]
    for j in (i,i+1):
        p=points[j]
        tangent=(points[min(j+1,48)]-points[max(j-1,0)]).normalized()
        u=tangent.cross(Vector((0,1,0))).normalized(); v=tangent.cross(u).normalized()
        radius=.145 + (.018 if j%4 in (1,2) else 0)
        rings.append([tuple(p+radius*(math.cos(k*math.tau/12)*u+math.sin(k*math.tau/12)*v)) for k in range(12)])
    shell('Hose',rings,'dark' if i%4==0 else 'body')
# A finished cuff on the unseen end, using the same design language.
shell('Rear cuff',[[tuple(points[-1]+Vector((.17*math.cos(k*math.tau/12),.17*math.sin(k*math.tau/12),z))) for k in range(12)] for z in (-.04,.06)],'dark',True)
# Recalculate outward normals and batch into one mesh per material (five draw calls).
for mat in mats:
    bpy.ops.object.select_all(action='DESELECT')
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0].name==mat]
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    o=bpy.context.object; o.name='Vaccoin_'+mat
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    tri=o.modifiers.new('Intentional triangles','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=tri.name)
marker=bpy.data.objects.new('Nozzle',None); marker.location=(0,.81,.08); bpy.context.collection.objects.link(marker)
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'public/assets/vacuum/vaccoin-vacuum.glb'),export_format='GLB',export_yup=True)
print('Vaccoin triangles:',sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'))
