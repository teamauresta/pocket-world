// Small canvas-painted textures for foliage cards (bamboo sprays, palm fronds, ferns, wildflowers).
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

function make(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

const leafPath = (g, len, wid) => {
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(wid, -len * 0.35, 0, -len);
  g.quadraticCurveTo(-wid, -len * 0.35, 0, 0);
  g.closePath();
};

// A spray of narrow bamboo leaves fanning out from the bottom centre
// Each spray now has four actual leaf ribbons; this texture is one detailed blade.
export function bambooLeafTexture() {
  return make(256,1024,(g,w,h)=>{
    g.clearRect(0,0,w,h);const gradient=g.createLinearGradient(0,0,w,0);
    gradient.addColorStop(0,'#42672b');gradient.addColorStop(.45,'#91a84e');gradient.addColorStop(.52,'#5d8738');gradient.addColorStop(1,'#355b26');
    g.fillStyle=gradient;g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(184,194,104,.75)';g.lineWidth=3;g.beginPath();g.moveTo(w*.5,0);g.lineTo(w*.5,h);g.stroke();
    g.lineWidth=.8;
    for(let i=0;i<48;i++){const y=i*h/48;for(const side of [-1,1]){g.beginPath();g.moveTo(w*.5,y);g.lineTo(w*(.5+side*.48),y-h*.045);g.stroke();}}
    g.strokeStyle='rgba(30,64,22,.22)';for(let x=8;x<w;x+=13){g.beginPath();g.moveTo(x,0);g.lineTo(x+3,h);g.stroke();}
  });
}

// Palm frond: rachis down the middle, long leaflets angled toward the tip
export function palmFrondTexture() {
  return make(512, 1024, (g, w, h) => {
    const r = mulberry32(9);
    g.clearRect(0, 0, w, h);
    const n = 58;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const y = h * (0.97 - t * 0.93);
      const len = (w * 0.52) * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 1.05))) * (0.88 + r() * 0.2);
      for (const side of [-1, 1]) {
        g.save();
        g.translate(w / 2, y);
        g.rotate(side * (0.95 + r() * 0.15));
        const tone = 62 + r() * 38;
        g.fillStyle = `rgb(${tone * 0.62},${tone + 58},${tone * 0.3})`;
        leafPath(g, len * (i % 11 === 4 ? .7 : 1), 21);
        g.fill();
        g.strokeStyle="rgba(170,188,104,.4)";g.lineWidth=1.2;g.beginPath();g.moveTo(0,0);g.lineTo(0,-len*.94);g.stroke();
        g.restore();
      }
    }
    g.strokeStyle = 'rgb(125,112,62)';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(w / 2, h * 0.03); g.lineTo(w / 2, h); g.stroke();
  });
}

// Fern frond: pinnae shrinking toward the tip
export function fernTexture() {
  return make(256, 512, (g, w, h) => {
    const r = mulberry32(17);
    g.clearRect(0, 0, w, h);
    const n = 22;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const y = h * (0.97 - t * 0.92);
      const len = (w * 0.47) * (1 - t * 0.85) * (0.9 + r() * 0.2);
      for (const side of [-1, 1]) {
        g.save();
        g.translate(w / 2, y);
        g.rotate(side * 1.25);
        const tone = 60 + r() * 30;
        g.fillStyle = `rgb(${tone * 0.55},${tone + 60},${tone * 0.35})`;
        leafPath(g, len, 5 * (1 - t * 0.6));
        g.fill();
        g.restore();
      }
    }
    g.strokeStyle = 'rgb(60,90,30)';
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h * 0.04); g.stroke();
  });
}

// Bark rings for palm trunks
export function palmBarkTexture() {
  return make(256, 1024, (g, w, h) => {
    const r = mulberry32(3);
    g.fillStyle = 'rgb(120,100,75)';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 28 + r() * 15) {
      g.fillStyle = `rgba(60,45,30,${0.5 + r() * 0.3})`;
      g.fillRect(0, y, w, 2 + r() * 2);
      g.fillStyle = `rgba(170,150,115,${0.25 + r() * 0.2})`;
      g.fillRect(0, y + 3, w, 2);
    }
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(${80 + r() * 60},${70 + r() * 40},${50 + r() * 30},0.25)`;
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    }
  });
}

// Big glossy jungle leaf (banana / elephant-ear style)
export function bigLeafTexture() {
  return make(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, h, 0, 0);
    grd.addColorStop(0, 'rgb(35,95,30)');
    grd.addColorStop(1, 'rgb(70,140,45)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(w / 2, h);
    g.bezierCurveTo(w * 1.05, h * 0.7, w * 0.95, h * 0.15, w / 2, 0);
    g.bezierCurveTo(w * 0.05, h * 0.15, -w * 0.05, h * 0.7, w / 2, h);
    g.fill();
    g.strokeStyle = 'rgba(160,190,90,0.7)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 4); g.stroke();
    g.lineWidth = 1;
    for (let i = 1; i < 14; i++) {
      const y = h * (1 - i / 14);
      g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w * 0.7, y - 10, w * 0.92, y - 22); g.stroke();
      g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w * 0.3, y - 10, w * 0.08, y - 22); g.stroke();
    }
  });
}
