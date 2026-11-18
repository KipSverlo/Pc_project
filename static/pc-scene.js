import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {prepareModel,proceduralPart,disposePart} from './assembly.js';
import {SOCKETS,DEFAULT_SOCKET,attachPart,createSocketMarkers} from './sockets.js';
export class PCScene{
 constructor(container,{onStatus=()=>{},onSocket=()=>{},hero=false}={}){
 this.container=container;this.onStatus=onStatus;this.onSocket=onSocket;this.hero=hero;this.parts=new Map();this.revision=0;this.expanded=false;this.caseVisible=true;this.slotsVisible=true;this.highlight=null;this.ramSocket='dimmA2';
 this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#0d0d12');this.assembly=new THREE.Group();this.assembly.name='pcAssembly';this.scene.add(this.assembly);
// Пустой корпус-витрина: сцена не выглядит чёрным прямоугольником до выбора деталей.
this.showcase=proceduralPart('case');this.showcase.name='showcase';this.scene.add(this.showcase);
 this.camera=new THREE.PerspectiveCamera(37,1,.1,80);this.camera.position.set(5,2.8,8);this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;container.append(this.renderer.domElement);
 this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,.7);this.controls.minDistance=4;this.controls.maxDistance=15;this.controls.enablePan=false;this.controls.addEventListener('change',()=>this.render());
 this.scene.add(new THREE.AmbientLight(0xe6ddf3,.9));for(const [color,intensity,pos] of [[0xffffff,2,[3,5,6]],[0xd284ed,1,[-4,1,1]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);this.scene.add(light);}
 const floor=new THREE.Mesh(new THREE.CircleGeometry(4,64),new THREE.MeshStandardMaterial({color:0x15141c,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.23;this.scene.add(floor);
 this.markers=createSocketMarkers();this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
 container.addEventListener('pointermove',event=>{if(!this.markers.visible)return;const r=container.getBoundingClientRect();this.pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects(this.markers.children)[0];this.setHighlight(hit?.object.userData.socketId||null);});
 container.addEventListener('pointerleave',()=>this.setHighlight(null));
 this.resize=new ResizeObserver(()=>{const r=container.getBoundingClientRect();this.camera.aspect=r.width/Math.max(r.height,1);this.camera.updateProjectionMatrix();this.renderer.setSize(r.width,r.height);this.render();});this.resize.observe(container);
 this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.onStatus('WebGL прерван. Обнови страницу.');});
 if(hero){this.controls.autoRotate=true;this.controls.autoRotateSpeed=.65;this.renderer.setAnimationLoop(()=>{this.controls.update();this.render();});}
 }
 render(){this.scene.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);}
 setHighlight(id){if(id===this.highlight)return;this.highlight=id;for(const marker of this.markers.children)marker.material.opacity=marker.userData.socketId===id?.65:.025;this.onSocket(id);this.render();}
 async setParts(items,badIds=new Set()){
 const revision=++this.revision;this.items=items;this.badIds=badIds;
 // Отцепляем детей перед удалением платы: выбор сохраняется при её замене.
 for(const obj of this.parts.values())this.assembly.add(obj);
 this.markers.removeFromParent();
 for(const [type,obj]of this.parts)if(!items.some(c=>c.type===type&&c.id===obj.userData.id)){obj.removeFromParent();disposePart(obj);this.parts.delete(type);}
 this.onStatus('Загрузка 3D-моделей…');
 const failures=[];
 await Promise.all(items.map(async c=>{
 if(this.parts.get(c.type)?.userData.id===c.id)return;
 try{
 const model=['case','psu'].includes(c.type)?proceduralPart(c.type):prepareModel((await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(c.model_url)).scene,c.type);
 if(revision!==this.revision){disposePart(model);return;}
 model.userData={type:c.type,id:c.id};model.traverse(n=>{n.userData.partId=c.id;});this.parts.set(c.type,model);
 }catch(error){failures.push(c.name);console.error('Model load failed',c.model_url,error);}
 }));
 if(revision!==this.revision)return;
 this.place();this.onStatus(failures.length?'Не загрузились: '+failures.join(', '):'Модели загружены. Масштаб и точки крепления настроены для демонстрационной платы.');this.render();
 }
 place(){
 const board=this.parts.get('motherboard');
 for(const [type,obj]of this.parts){
 this.assembly.add(obj);obj.rotation.set(0,0,0);obj.position.set(0,0,0);
 if(type==='case')obj.visible=this.caseVisible;
 else if(type==='psu')obj.position.set(-.65,-1.57,.9);
 else if(type==='motherboard')obj.position.set(0,.25,0);
 else if(board){attachPart(board,obj,type==='ram'?this.ramSocket:DEFAULT_SOCKET[type]);if(this.expanded)obj.position.z+=type==='cpu'?1.6:type==='ram'?1.1:.7;}
 else{obj.position.set(type==='cpu'?-1:type==='ram'?1:0,type==='gpu'?-.8:.6,1);}
 obj.traverse(n=>{if(n.userData.partId!==obj.userData.id)return;for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[]){if(!m.emissive)continue;if(!m.userData.originalEmissive)m.userData.originalEmissive={color:m.emissive.clone(),intensity:m.emissiveIntensity};if(this.badIds.has(obj.userData.id)){m.emissive.set('#ff264d');m.emissiveIntensity=.7;}else{m.emissive.copy(m.userData.originalEmissive.color);m.emissiveIntensity=m.userData.originalEmissive.intensity;}}});
 }
 if(board){board.add(this.markers);this.markers.visible=this.slotsVisible&&!this.hero;}else this.markers.removeFromParent();
// Витринный корпус уступает место выбранному корпусу из каталога.
this.showcase.visible=!this.parts.has('case');this.render();
 }
 reset(){this.camera.position.set(5,2.8,8);this.controls.target.set(0,0,.7);this.controls.update();this.render();}
}
