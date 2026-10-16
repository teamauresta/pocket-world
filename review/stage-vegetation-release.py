"""Prepare an immutable vegetation payload locally. No upload or activation."""
from pathlib import Path
import hashlib,json,shutil,os
root=Path(__file__).resolve().parents[1];dist=root/'dist'
old=json.loads((root/'review/animal-release.json').read_text())
shared=Path(os.environ['POCKET_WORLD_PREVIOUS_SITE'])
assert (dist/'lab/lab.html').exists(),'Build main and lab first'
for name,digest in old['files'].items():assert hashlib.sha256((shared/name).read_bytes()).hexdigest()==digest,name
base={str(p.relative_to(dist)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(dist.rglob('*')) if p.is_file()}
identity=hashlib.sha256(json.dumps(base,sort_keys=True).encode()).hexdigest();release='r-20261014-vegetation-'+identity[:12];stage=root/'review'/release
assert not stage.exists(),'Immutable stage already exists; inspect, do not overwrite'
shutil.copytree(dist,stage)
for name in old['files']:
 target=stage/(name if name.startswith(('v1/','v2/')) else 'v3/'+name)
 target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(shared/name,target)
files={str(p.relative_to(stage)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(stage.rglob('*')) if p.is_file()}
for name,digest in old['files'].items():assert files[name if name.startswith(('v1/','v2/')) else 'v3/'+name]==digest
receipt={'release':release,'files':files,'baseFiles':base,'previousRelease':old['release'],'limits':'Unqualified local vegetation candidate; no upload or activation. Software WebGL is not hardware FPS. Owner-model replacements are separate unfinished integration.'}
(root/'review/vegetation-final-candidate.json').write_text(json.dumps(receipt,indent=2));print(release,len(files),'immutable files; no live change')
