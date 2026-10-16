"""Undo double-applied authored mesh bind transforms in nonbody shark parts.
Source stores geometry in different mesh spaces but shares body inverse-bind palette.
Recovered transform = bodyBind^-1 * partBind^-1 * bodyBind, tested against retained authored transforms.
"""
import json,struct,pathlib,numpy as np,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
def load(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),bytearray(b[28+n:])
def save(p,j,b):
 jb=json.dumps(j,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);b+=b'\0'*((-len(b))%4);p.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(jb)+len(b))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(b),b'BIN\0')+b)
def arr(j,b,ai):
 a=j['accessors'][ai];v=j['bufferViews'][a['bufferView']];return np.ndarray((a['count'],3),dtype='<f4',buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4))
for lod in ['near','far']:
 p=ROOT/'public/owner-models/derived'/('shark-'+lod+'.glb');j,b=load(p)
 body=np.array(j['nodes'][13]['matrix']).reshape(4,4).T
 for mesh,ni in [(1,18),(2,18),(3,21),(4,23),(5,25)]:
  part=np.array(j['nodes'][ni]['matrix']).reshape(4,4).T
  # Original body positions are already in body-local glTF coordinates. Map malformed
  # parts out of the extra part-object transform, then through the body's basis.
  mode=sys.argv[1] if len(sys.argv)>1 else 'inverse'
  if mode=='inverse':fix=np.linalg.inv(body)@np.linalg.inv(part)@body
  elif mode=='bodyinverse':fix=np.linalg.inv(part)@body
  elif mode=='partinverse':fix=np.linalg.inv(part)
  elif mode=='relative':fix=np.linalg.inv(body)@part
  else:fix=body@np.linalg.inv(part)@np.linalg.inv(body)
  pr=j['meshes'][mesh]['primitives'][0]
  for attr in ['POSITION','NORMAL']:
   a=arr(j,b,pr['attributes'][attr]);a[:]=(np.c_[a,np.ones(len(a))]@fix.T)[:,:3] if attr=='POSITION'else a@np.linalg.inv(fix[:3,:3]);
   if attr=='NORMAL':a[:]/=np.maximum(np.linalg.norm(a,axis=1)[:,None],1e-12)
   else:j['accessors'][pr['attributes'][attr]].update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
 save(ROOT/'review/owner-model-lod-evidence'/('shark-'+lod+'-'+mode+'.glb'),j,b)
