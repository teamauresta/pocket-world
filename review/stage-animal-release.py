"""Prepare an immutable animal payload locally; does not upload or activate."""
from pathlib import Path
import hashlib,json,shutil,os
root=Path(__file__).resolve().parents[1];dist=root/'dist';old=json.loads((root/'review/living-release.json').read_text());shared=Path(os.environ['POCKET_WORLD_PREVIOUS_SITE'])
assert (dist/'lab/lab.html').exists(),'Build main and lab first'
for name,digest in old['files'].items():assert hashlib.sha256((shared/name).read_bytes()).hexdigest()==digest,name
app=hashlib.sha256((dist/'assets/app.js').read_bytes()).hexdigest();lab=hashlib.sha256((dist/'lab/assets/lab.js').read_bytes()).hexdigest();identity=hashlib.sha256((app+lab).encode()).hexdigest();release='r-20261014-animal-'+identity[:12];stage=root/'review'/release
assert not stage.exists(),'Immutable stage exists: verify it; do not overwrite'
shutil.copytree(dist,stage)
# Keep original sky/weather plus the qualified living version side by side.
# No recursive archive duplication and no changed previous release bytes.
for name in old['baseFiles']:
 target=stage/'v1'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(shared/'v1'/name,target)
for name in old['files']:
 if name.startswith('v1/'):continue
 target=stage/'v2'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(shared/name,target)
files={str(p.relative_to(stage)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(stage.rglob('*')) if p.is_file()}
for name,digest in old['baseFiles'].items():assert files['v1/'+name]==digest
for name,digest in old['files'].items():
 if not name.startswith('v1/'):assert files['v2/'+name]==digest
receipt={'release':release,'files':files,'previousRelease':old['release'],'originalRelease':old['baseRelease'],'limits':'Accepted constrained escape policy retained; no native-FPS or full-guide claim.'}
(root/'review/animal-release.json').write_text(json.dumps(receipt,indent=2));print(release,len(files),'files prepared; no live change')
