import os
import bpy,json,struct,pathlib,sys
from mathutils import Matrix,Quaternion,Vector
p=(pathlib.Path(os.environ['POCKET_WORLD_MODEL_SOURCE']) / 'realistic_shark.glb');b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);bb=b[28+n:]
def ac(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];d={'MAT4':16,'VEC3':3,'VEC4':4,'SCALAR':1,'VEC2':2}[a['type']];fmt={5126:'f',5123:'H',5121:'B',5125:'I'}[a['componentType']];size=struct.calcsize(fmt);off=v.get('byteOffset',0)+a.get('byteOffset',0);return [struct.unpack_from('<'+fmt*d,bb,off+k*v.get('byteStride',d*size))for k in range(a['count'])]
world={}
def walk(i,parent):
 no=j['nodes'][i];m=Matrix([no['matrix'][k:k+4]for k in range(0,16,4)]).transposed()if 'matrix'in no else Matrix.LocRotScale(Vector(no.get('translation',[0,0,0])),Quaternion([no.get('rotation',[0,0,0,1])[k]for k in [3,0,1,2]]),Vector(no.get('scale',[1,1,1])));world[i]=parent@m
 for c in no.get('children',[]):walk(c,world[i])
walk(0,Matrix.Identity(4));ibms=[Matrix([a[k:k+4]for k in range(0,16,4)]).transposed()for a in ac(j['skins'][0]['inverseBindMatrices'])]
for k,i in enumerate(j['skins'][0]['joints']):
 if not 'end'in j['nodes'][i]['name']:print(i,j['nodes'][i]['name'],'world@ibm',[[round(x,4)for x in row]for row in world[i]@ibms[k]])
for mi,m in enumerate(j['meshes']):
 p=m['primitives'][0];ps=ac(p['attributes']['POSITION']);js=ac(p['attributes']['JOINTS_0']);ws=ac(p['attributes']['WEIGHTS_0']);print(mi,m['name'],'raw bounds',[[min(x[k]for x in ps),max(x[k]for x in ps)]for k in range(3)],'joints',sorted({a for jj,ww in zip(js,ws)for a,w in zip(jj,ww)if w>0}))
