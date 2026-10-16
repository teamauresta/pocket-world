"""Local derived assets only. Preserve supplied EZ-Tree512 images; never claim native1024 photographic acquisition."""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image
root=Path('public/tex');out=root/'leaf-detail';out.mkdir(exist_ok=True);records=[]
for species in ['ash','aspen','oak','pine']:
 src=root/('leaf_'+species+'.webp');original=src.read_bytes();digest=hashlib.sha256(original).hexdigest()
 for size in [512,1024]:
  base=np.asarray(Image.open(src).convert('RGBA').resize((size,size),Image.Resampling.LANCZOS)).astype(np.float32)/255
  cards=[];normals=[]
  for variant,gain in enumerate([(1.,1.,1.),(1.045,.985,.945),(.95,1.025,1.045)]):
   rgba=base.copy();rgba[:,:,:3]=np.clip(rgba[:,:,:3]*np.array(gain),0,1);rgba[:,:,3]=base[:,:,3]
   # Matching image-derived bump plus small variant-specific microdetail.
   luminance=rgba[:,:,0]*.2126+rgba[:,:,1]*.7152+rgba[:,:,2]*.0722
   h=luminance*base[:,:,3];dy,dx=np.gradient(h);nx=-dx*1.8;ny=dy*1.8;nz=np.ones_like(nx);length=np.sqrt(nx*nx+ny*ny+nz*nz)
   normal=np.stack((nx/length*.5+.5,ny/length*.5+.5,nz/length*.5+.5,np.ones_like(nx)),axis=2)
   normal[base[:,:,3]<.02]=[.5,.5,1,1]
   cards.append(np.rint(rgba*255).astype(np.uint8));normals.append(np.rint(normal*255).astype(np.uint8))
  color=np.concatenate(cards,axis=1);name=f'{species}-{size}-color.png';Image.fromarray(color,'RGBA').save(out/name,optimize=True)
  row={'species':species,'sizePerCell':size,'variants':3,'source':str(src),'sourceSize':[512,512],'sourceSha256':digest,'color':name,'colorSha256':hashlib.sha256((out/name).read_bytes()).hexdigest(),'provenance':'Three colour-processed variants from existing EZ-Tree512 source, reconstructed to output resolution; no new photographic detail/native1024 provenance claim.'}
  if size==1024:
   normal=np.concatenate(normals,axis=1);name=f'{species}-{size}-normal.png';Image.fromarray(normal,'RGBA').save(out/name,optimize=True);row.update(normal=name,normalSha256=hashlib.sha256((out/name).read_bytes()).hexdigest(),normalMethod='Image-derived luminance gradient, not measured physical normals.')
  assert hashlib.sha256(src.read_bytes()).hexdigest()==digest;records.append(row)
(out/'provenance.json').write_text(json.dumps(records,indent=2));print('12 derived colour/normal atlases; original512 sources unchanged')
