import sys,runpy,json,struct,pathlib,copy,hashlib
sys.argv=['build.py','--']
f=runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / 'scripts/owner-model-lods/build.py'))
src=(pathlib.Path(__file__).resolve().parents[1] / 'public/owner-models/native/eagle.glb');original=src.read_bytes();j,b=f['parse'](original);jj=copy.deepcopy(j);bb=bytearray(b);reports=[]
# Both eye spheres and beak unchanged; all seven primitives retained.
targets=[72,126,1000,950,1450,1200,72]
for mi,m in enumerate(j['meshes']):
 p=m['primitives'][0];data,report=f['reduce'](j,b,p,targets[mi],m['name']);reports.append(report)
 if data:
  attrs,ind=data;dest=jj['meshes'][mi]['primitives'][0];dest['attributes']={k:f['append'](jj,bb,v,'VEC'+str(len(v[0])),5126)for k,v in attrs.items()};dest['indices']=f['append'](jj,bb,ind,'SCALAR',5125)
jj['buffers']=[{'byteLength':len(bb)}];jb=json.dumps(jj,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);bb+=bytes([0])*((-len(bb))%4)
payload=struct.pack('<4sII',b'glTF',2,28+len(jb)+len(bb))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(bb),b'BIN'+bytes([0]))+bb
out=(pathlib.Path(__file__).resolve().parents[1] / 'public/owner-models/derived/eagle-far.glb');out.write_bytes(payload)
manifest={'sourceSHA256':hashlib.sha256(original).hexdigest(),'file':'eagle-far.glb','sha256':hashlib.sha256(payload).hexdigest(),'triangles':sum(r['after']for r in reports),'parts':reports,'sourceClips':0,'motion':'runtime generated wing hinges, not authored','eyesAndBeak':'all three source primitives byte-exact','materialsTexturesNodes':'original JSON unchanged','license':j['asset']['extras'],'method':'installed Blender CPU topology collapse; UV and source normals interpolated; no source binary changes'}
assert manifest['triangles']<5000
out.with_name('individual-eagle-manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2));assert src.read_bytes()==original
