import json,struct,pathlib,hashlib,math
R=pathlib.Path(__file__).resolve().parents[2];E=R/'review/owner-model-lod-evidence';O=R/'public/owner-models/derived'
def load(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def raw(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];size={5126:4,5125:4,5123:2,5121:1}[a['componentType']]*{'MAT4':16,'VEC4':4,'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);return b''.join(b[off+k*v.get('byteStride',size):off+k*v.get('byteStride',size)+size]for k in range(a['count']))
def image(j,b,i):
 v=j['bufferViews'][j['images'][i]['bufferView']];return b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
reports=[]
for name in ['shark','dolphin','tiger','alligator']:
 build=json.loads((E/(name+'-build.json')).read_text());p=pathlib.Path(build['source']);j,b=load(p);assert hashlib.sha256(p.read_bytes()).hexdigest()==build['sha256'];assert p.stat().st_mtime_ns==build['mtimeNs'];result={'species':name,'sourceHashUnchanged':True,'sourceMtimeUnchanged':True,'morphTargets':sum(len(p.get('targets',[]))for m in j['meshes']for p in m['primitives']),'lods':[]}
 for lod in ['near','far']:
  q=O/(name+'-'+lod+'.glb');k,c=load(q);assert j['materials']==k['materials'];assert j.get('textures')==k.get('textures');assert j.get('samplers')==k.get('samplers');assert len(j['images'])==len(k['images']);assert all(image(j,b,i)==image(k,c,i)for i in range(len(j['images'])));assert len(j['skins'])==len(k['skins'])
  for s,t in zip(j['skins'],k['skins']):assert s['joints']==t['joints'] and raw(j,b,s['inverseBindMatrices'])==raw(k,c,t['inverseBindMatrices'])
  assert [n.get('name')for n in j['nodes']]==[n.get('name')for n in k['nodes']]
  for a,d in zip(j['animations'],k['animations']):
   assert a['name']==d['name'] and a['channels']==d['channels']
   for s,t in zip(a['samplers'],d['samplers']):
    assert s.get('interpolation')==t.get('interpolation')
    for field in ['input','output']:assert raw(j,b,s[field])==raw(k,c,t[field])
  count=sum(k['accessors'][pr['indices']]['count']//3 for m in k['meshes']for pr in m['primitives']);assert count<(20000 if lod=='near'else 5000)
  result['lods'].append({'lod':lod,'triangles':count,'bytes':q.stat().st_size,'sha256':hashlib.sha256(q.read_bytes()).hexdigest(),'imagesByteExact':True,'materialsExact':True,'rigAndAnimationBytesExact':True,'boneCount':len(k['skins'][0]['joints']),'clipCount':len(k['animations']),'meshCount':len(k['meshes'])})
 reports.append(result)
(E/'preservation.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))
