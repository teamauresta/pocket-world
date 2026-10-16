import os
import json,struct,pathlib
p=pathlib.Path(os.environ['POCKET_WORLD_MODEL_SOURCE'])
for name in ['realistic_shark','model_101a_-_adult_common_dolphin','tiger','alligator_-_realistic_3d_model_demo_free']:
 b=(p/(name+'.glb')).read_bytes();j=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
 print(name,'extensions',j.get('extensionsUsed'),'materials',j.get('materials'))
 print('meshes',[(m.get('name'),[(j['accessors'][q['indices']]['count']//3,q['attributes'],q.get('material')) for q in m['primitives']])for m in j['meshes']])
 print('animations',[(a.get('name'),len(a['channels']),[(j['nodes'][c['target']['node']].get('name'),c['target']['path'])for c in a['channels'][:5]])for a in j.get('animations',[])])
 print('nodes',[(i,n)for i,n in enumerate(j['nodes'])if 'mesh'in n or 'scale'in n or 'matrix'in n]);print('skins',[(s.get('name'),len(s['joints']))for s in j.get('skins',[])])
