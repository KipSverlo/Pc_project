import * as THREE from './vendor/three.module.js';
const profiles={motherboard:{rotation:[Math.PI/2,0,0],scale:3.05/26.654},cpu:{rotation:[Math.PI/2,0,0],scale:.4/3.162},ram:{rotation:[Math.PI/2,0,0],scale:1.42/.608},gpu:{rotation:[0,0,Math.PI/2],scale:3/30.187},storage:{rotation:[Math.PI/2,0,0],scale:.8/4.332}};
export function prepareModel(model,type){
 const profile=profiles[type],rotated=new THREE.Group();rotated.add(model);rotated.rotation.set(...profile.rotation);rotated.scale.setScalar(profile.scale);rotated.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(rotated),center=bounds.getCenter(new THREE.Vector3());
 if(type==='motherboard'){const pcb=model.getObjectByName('Object_226');if(pcb)new THREE.Box3().setFromObject(pcb).getCenter(center);}
 rotated.position.copy(center).negate();
 if(['cpu','ram','storage'].includes(type))rotated.position.z=-bounds.min.z;
 if(type==='gpu'){const pcb=model.getObjectByName('motherboard_RTX_3080_0');if(pcb){const b=new THREE.Box3().setFromObject(pcb);rotated.position.x-=b.getCenter(new THREE.Vector3()).x;rotated.position.y-=b.getCenter(new THREE.Vector3()).y;rotated.position.z-=b.min.z;}}
 const root=new THREE.Group();root.add(rotated);return root;
}
export function proceduralPart(type){
 const group=new THREE.Group(),dark=new THREE.MeshStandardMaterial({color:0x1c1b22,metalness:.6,roughness:.42});
 function box(size,position,material=dark){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);group.add(mesh);return mesh;}
 if(type==='psu'){
 box([1.6,.86,1.5],[0,0,0]);
 for(let i=0;i<10;i++)box([1.1,.025,.025],[0,-.3+i*.065,.76],new THREE.MeshStandardMaterial({color:0x55515d}));
 box([.3,.23,.03],[-.4,-.1,-.76],new THREE.MeshStandardMaterial({color:0x050508}));return group;
 }
 // Отдельные стенки, стойки и стекло оставляют внутренности видимыми.
 box([3.6,.07,2.35],[0,-2.05,.95]);box([3.6,.07,2.35],[0,2.05,.95]);box([3.6,4.1,.04],[0,0,-.22]);box([.10,4.1,2.35],[1.75,0,.95]);
 for(const x of [-1.75,1.75])for(const z of [-.2,2.1])box([.07,4.1,.07],[x,0,z]);
 box([3.45,3.96,.02],[0,0,2.1],new THREE.MeshPhysicalMaterial({color:0xaca0ba,transparent:true,opacity:.12,roughness:.15,metalness:.1,depthWrite:false,side:THREE.DoubleSide}));
 for(const y of [-1.1,0,1.1]){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.43,.022,8,48),new THREE.MeshStandardMaterial({color:0xa357c1,emissive:0x742a93,emissiveIntensity:.5}));ring.rotation.y=Math.PI/2;ring.position.set(1.69,y,.95);group.add(ring);
 for(let i=0;i<7;i++){const fin=new THREE.Mesh(new THREE.BoxGeometry(.025,.16,.32),dark);fin.position.set(1.68,y+Math.cos(i*Math.PI*2/7)*.22,.95+Math.sin(i*Math.PI*2/7)*.22);fin.rotation.x=i*Math.PI*2/7;group.add(fin);}}
 for(const x of [-1.4,1.4])box([.35,.13,1.8],[x,-2.14,.95]);return group;
}
export function disposePart(part){const textures=new Set();part.traverse(n=>{n.geometry?.dispose();for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[]){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}});textures.forEach(t=>t.dispose());}
