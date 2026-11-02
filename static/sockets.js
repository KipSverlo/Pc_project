import * as THREE from './vendor/three.module.js';
// Оси платы: X вправо, Y вверх, Z к стеклу. Единица = 100 мм.
export const SOCKETS = {
 cpu:{type:'cpu',label:'Сокет процессора',position:[.14,.60,.04],rotation:[0,0,0],size:[.42,.42,.025]},
 dimmA1:{type:'ram',label:'DIMM A1',position:[.642,.59,.04],rotation:[0,0,0],size:[.07,1.42,.025]},
 dimmA2:{type:'ram',label:'DIMM A2',position:[.744,.59,.04],rotation:[0,0,0],size:[.07,1.42,.025]},
 dimmB1:{type:'ram',label:'DIMM B1',position:[.846,.59,.04],rotation:[0,0,0],size:[.07,1.42,.025]},
 dimmB2:{type:'ram',label:'DIMM B2',position:[.948,.59,.04],rotation:[0,0,0],size:[.07,1.42,.025]},
 pcie:{type:'gpu',label:'PCIe x16',position:[-.355,-.31,.12],rotation:[0,0,0],size:[.91,.07,.025]},
 m2:{type:'storage',label:'M.2',position:[-.32,-.10,.07],rotation:[0,0,0],size:[1,.22,.025]},
};
export const DEFAULT_SOCKET={cpu:'cpu',ram:'dimmA2',gpu:'pcie',storage:'m2'};
export function attachPart(parentPart,childPart,socketId){
 const socket=SOCKETS[socketId];
 if(!socket||socket.type!==childPart.userData.type)throw Error('Неподходящий сокет: '+socketId);
 parentPart.add(childPart);childPart.position.set(...socket.position);childPart.rotation.set(...socket.rotation);childPart.scale.set(1,1,1);childPart.userData.socketId=socketId;return childPart;
}
export function createSocketMarkers(){
 const group=new THREE.Group();group.name='socket-markers';
 for(const [id,socket] of Object.entries(SOCKETS)){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...socket.size),new THREE.MeshBasicMaterial({color:0xd633ff,transparent:true,opacity:.025,depthTest:false,depthWrite:false}));
  mesh.position.set(...socket.position);mesh.renderOrder=10;mesh.userData.socketId=id;group.add(mesh);
 }return group;
}
