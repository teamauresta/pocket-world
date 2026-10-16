import os
"""Topology-only CPU Blender reduction; original glTF graph/materials/rig/clips retained.
Build raw Blender meshes per primitive, interpolate vertex groups with collapse,
and append reduced geometry accessors to original binary. No import/export rig drift.
"""
import bpy,bmesh,sys,json,struct,pathlib,hashlib,copy,time,math
from array import array
ROOT=pathlib.Path(__file__).resolve().parents[2]
SRC=pathlib.Path(os.environ['POCKET_WORLD_MODEL_SOURCE'])
OUT=ROOT/'public/owner-models/derived';OUT.mkdir(parents=True,exist_ok=True)
E=ROOT/'review/owner-model-lod-evidence';E.mkdir(parents=True,exist_ok=True)
FILES={'shark':'realistic_shark','dolphin':'model_101a_-_adult_common_dolphin','tiger':'tiger','alligator':'alligator_-_realistic_3d_model_demo_free'}
COMP={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
DIMS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def parse(b):
 n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);return j,b[28+n:]
def accessor(j,b,idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];fmt,size=COMP[a['componentType']];d=DIMS[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size*d)
 vals=[struct.unpack_from('<'+fmt*d,b,off+i*stride) for i in range(a['count'])]
 if a.get('normalized'): vals=[tuple(max(-1,x/(2**(8*size-(1 if fmt.islower() else 0))-1)) for x in row)for row in vals]
 return vals

def append(j,b,vals,typ,component=5126):
 while len(b)%4:b.append(0)
 offset=len(b);fmt,size=COMP[component];flat=[x for row in vals for x in row];a=array(fmt,flat);b.extend(a.tobytes());vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(a)*size})
 ac={'bufferView':vi,'componentType':component,'count':len(vals),'type':typ}
 if typ=='VEC3':ac.update(min=[min(x[k]for x in vals)for k in range(3)],max=[max(x[k]for x in vals)for k in range(3)])
 ai=len(j['accessors']);j['accessors'].append(ac);return ai

def reduce(j,b,p,target,label):
 at=p['attributes'];pos=accessor(j,b,at['POSITION']);idx=accessor(j,b,p['indices']);faces=[tuple(x[0]for x in idx[i:i+3])for i in range(0,len(idx),3)]
 if len(faces)<=target:return None,{'label':label,'before':len(faces),'after':len(faces),'protected':True}
 mesh=bpy.data.meshes.new(label);mesh.from_pydata(pos,[],faces);mesh.update();obj=bpy.data.objects.new(label,mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 # UV/colour are per-corner and are interpolated by Blender collapse.
 for name,ai in at.items():
  if name.startswith('TEXCOORD_'):
   data=accessor(j,b,ai);layer=mesh.uv_layers.new(name=name)
   for loop in mesh.loops:layer.data[loop.index].uv=data[loop.vertex_index]
  if name.startswith('COLOR_'):
   data=accessor(j,b,ai);layer=mesh.color_attributes.new(name=name,type='FLOAT_COLOR',domain='CORNER')
   for loop in mesh.loops:
    val=data[loop.vertex_index];layer.data[loop.index].color=(*val,1) if len(val)==3 else val
 # Preserve/interpolate original smooth normals explicitly as POINT vector data.
 ns=accessor(j,b,at['NORMAL']) if 'NORMAL'in at else None
 if ns:
  na=mesh.attributes.new('source_normal','FLOAT_VECTOR','POINT')
  for v,n in zip(na.data,ns):v.vector=n
 if 'JOINTS_0'in at:
  joints=accessor(j,b,at['JOINTS_0']);weights=accessor(j,b,at['WEIGHTS_0']);mx=max(max(x)for x in joints)
  for k in range(mx+1):obj.vertex_groups.new(name=str(k))
  for vi,(js,ws)in enumerate(zip(joints,weights)):
   for ji,w in zip(js,ws):
    if w>0:obj.vertex_groups[ji].add([vi],w,'REPLACE')
 # Weld exact duplicate positions (glTF seam splits); UVs remain per-corner.
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bm.to_mesh(mesh);bm.free();mesh.update()
 mod=obj.modifiers.new('CPU topology reduction BEFORE skin','DECIMATE');mod.decimate_type='COLLAPSE';mod.ratio=max(.001,target/len(faces)*.985);mod.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=mod.name);mesh=obj.data;mesh.calc_loop_triangles()
 # Split UV seams while retaining independently interpolated weights. No welding of parts.
 records={};indices=[];output={k:[]for k in at if k!='TANGENT'}
 max_dropped=0;max_influences=0
 for tri in mesh.loop_triangles:
  for li in tri.loops:
   loop=mesh.loops[li];v=mesh.vertices[loop.vertex_index];r={'POSITION':tuple(v.co)}
   if ns:
    n=mesh.attributes['source_normal'].data[v.index].vector.copy();n.normalize();r['NORMAL']=tuple(n)
   for name in at:
    if name.startswith('TEXCOORD_'):r[name]=tuple(mesh.uv_layers[name].data[li].uv)
    if name.startswith('COLOR_'):r[name]=tuple(mesh.color_attributes[name].data[li].color)
   if 'JOINTS_0'in at:
    influences=sorted([(g.group,g.weight)for g in v.groups if g.weight>1e-8 and obj.vertex_groups[g.group].name!='LOD_BOUNDARY_PROTECT'],key=lambda x:-x[1]);max_influences=max(max_influences,len(influences));max_dropped=max(max_dropped,sum(w for _,w in influences[4:]));influences=influences[:4];total=sum(w for _,w in influences)
    assert total>0,(label,'unweighted vertex')
    r['JOINTS_0']=tuple([g for g,w in influences]+[0]*(4-len(influences)));r['WEIGHTS_0']=tuple([w/total for g,w in influences]+[0]*(4-len(influences)))
   key=tuple((k,r[k])for k in sorted(r))
   if key not in records:
    records[key]=len(records)
    for k in output:output[k].append(r[k])
   indices.append((records[key],))
 report={'label':label,'before':len(faces),'after':len(indices)//3,'vertices':len(records),'maxInfluencesBeforeFourWeightPacking':max_influences,'maxDroppedWeight':max_dropped,'tangent':'recomputed by renderer from retained smooth normals and UV'if 'TANGENT'in at else 'source absent'}
 bpy.data.objects.remove(obj,do_unlink=True);bpy.data.meshes.remove(mesh)
 return (output,indices),report

def main(species):
 f=SRC/(FILES[species]+'.glb');original=f.read_bytes();j,b=parse(original);stat=f.stat();sha=hashlib.sha256(original).hexdigest();before=sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes']for p in m['primitives']);result={'species':species,'source':str(f),'sha256':sha,'size':stat.st_size,'mtimeNs':stat.st_mtime_ns,'originalTriangles':before,'lods':[]}
 # Consolidate importer-split body chunks sharing identical material/attribute layout.
 # Keep every eye/jaw/tooth part separately; no anatomical deletion.
 if species in ['shark','dolphin']:
  count=4 if species=='shark'else 2;bb0=bytearray(b);parts=[j['meshes'][i]['primitives'][0]for i in range(count)];attrs={k:[]for k in parts[0]['attributes']};inds=[];offset=0
  for p in parts:
   for k,ai in p['attributes'].items():attrs[k].extend(accessor(j,b,ai))
   inds.extend((x[0]+offset,)for x in accessor(j,b,p['indices']));offset+=j['accessors'][p['attributes']['POSITION']]['count']
  p=parts[0];p['attributes']={k:append(j,bb0,v,'VEC'+str(len(v[0])),5123 if k.startswith('JOINTS')else 5126)for k,v in attrs.items()};p['indices']=append(j,bb0,inds,'SCALAR',5125)
  for node in j['nodes']:
   if 'mesh'in node:
    if 0<node['mesh']<count:node.pop('mesh');node.pop('skin',None)
    elif node['mesh']>=count:node['mesh']-=count-1
  j['meshes']=[j['meshes'][0]]+j['meshes'][count:];b=bytes(bb0)
 for lod,budget in [('near',19000),('far',4800)]:
  jj=copy.deepcopy(j);bb=bytearray(b);prims=[(mi,pi,p)for mi,m in enumerate(j['meshes'])for pi,p in enumerate(m['primitives'])];counts=[j['accessors'][p['indices']]['count']//3 for mi,pi,p in prims]
  # Eyes preserved at near; far keeps meaningful eye geometry, every part remains.
  mins=[]
  for (mi,pi,p),n in zip(prims,counts):
   name=j['meshes'][mi].get('name','').lower();eye='eye'in name
   mins.append(min(n, n if eye and lod=='near' else 160 if eye else 220 if 'tooth'in name or 'jaw'in name else 80))
  remaining=budget-sum(mins);den=sum(max(0,n-mn)for n,mn in zip(counts,mins));reports=[]
  for (mi,pi,p),n,mn in zip(prims,counts,mins):
   target=mn+int(remaining*max(0,n-mn)/max(den,1));print(species,lod,mi,n,'->',target,flush=True);data,report=reduce(j,b,p,target,j['meshes'][mi].get('name',str(mi)));reports.append(report)
   if data:
    attrs,ind=data;dest=jj['meshes'][mi]['primitives'][pi];dest['attributes']={k:append(jj,bb,v,'VEC'+str(len(v[0])),5123 if k.startswith('JOINTS')else 5126)for k,v in attrs.items()};dest['indices']=append(jj,bb,ind,'SCALAR',5125)
  # Remove unused original accessors/bufferViews and compact binary losslessly.
  used=set()
  for m in jj['meshes']:
   for p in m['primitives']:used.update(p['attributes'].values());used.add(p['indices'])
  for s in jj.get('skins',[]):used.add(s['inverseBindMatrices'])
  for a in jj.get('animations',[]):
   for s in a['samplers']:used.update([s['input'],s['output']])
  amap={old:new for new,old in enumerate(sorted(used))};jj['accessors']=[jj['accessors'][i]for i in sorted(used)]
  for m in jj['meshes']:
   for p in m['primitives']:p['attributes']={k:amap[v]for k,v in p['attributes'].items()};p['indices']=amap[p['indices']]
  for s in jj.get('skins',[]):s['inverseBindMatrices']=amap[s['inverseBindMatrices']]
  for a in jj.get('animations',[]):
   for s in a['samplers']:s['input']=amap[s['input']];s['output']=amap[s['output']]
  views=set(a['bufferView']for a in jj['accessors']);views.update(i['bufferView']for i in jj.get('images',[])if 'bufferView'in i);vmap={old:new for new,old in enumerate(sorted(views))};newbin=bytearray();newviews=[]
  for vi in sorted(views):
   v=copy.deepcopy(jj['bufferViews'][vi]);offset=v.get('byteOffset',0)
   while len(newbin)%4:newbin.append(0)
   v['byteOffset']=len(newbin);newbin.extend(bb[offset:offset+v['byteLength']]);newviews.append(v)
  for a in jj['accessors']:a['bufferView']=vmap[a['bufferView']]
  for i in jj.get('images',[]):
   if 'bufferView'in i:i['bufferView']=vmap[i['bufferView']]
  jj['bufferViews']=newviews;jj['buffers']=[{'byteLength':len(newbin)}];jb=json.dumps(jj,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);newbin+=b'\0'*((-len(newbin))%4)
  payload=struct.pack('<4sII',b'glTF',2,28+len(jb)+len(newbin))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(newbin),b'BIN\0')+newbin
  out=OUT/(species+'-'+lod+'.glb');out.write_bytes(payload);r={'file':str(out.relative_to(ROOT)),'triangles':sum(x['after']for x in reports),'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'parts':reports};result['lods'].append(r);assert r['triangles']< (20000 if lod=='near'else 5000),r
 assert hashlib.sha256(f.read_bytes()).hexdigest()==sha and f.stat().st_mtime_ns==stat.st_mtime_ns
 (E/(species+'-build.json')).write_text(json.dumps(result,indent=2))
for species in sys.argv[sys.argv.index('--')+1:]:main(species)
