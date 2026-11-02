import assert from 'node:assert/strict';
import * as T from './static/vendor/three.module.js';
import {SOCKETS,attachPart} from './static/sockets.js';
import {checkCompatibility} from './static/compatibility.js';
const assembly=new T.Group(),board=new T.Group();assembly.add(board);board.position.set(2,3,4);board.rotation.y=.4;
for(const [id,s]of Object.entries(SOCKETS)){const child=new T.Group();child.userData.type=s.type;attachPart(board,child,id);assembly.updateMatrixWorld(true);assert.equal(child.parent,board);assert.ok(child.getWorldPosition(new T.Vector3()).distanceTo(board.localToWorld(new T.Vector3(...s.position)))<1e-8);const replacement=new T.Group();assembly.add(replacement);attachPart(replacement,child,id);assert.equal(child.parent,replacement);}
const cpu={id:1,name:'CPU',specs_json:{socket:'AM5',ram_type:'DDR5'}},boardSpec={id:2,name:'Board',specs_json:{socket:'LGA1700',ram_type:'DDR5'}};assert.equal(checkCompatibility([cpu,boardSpec]).ids.size,2);boardSpec.specs_json.socket='AM5';assert.equal(checkCompatibility([cpu,boardSpec]).ids.size,0);assert.equal(checkCompatibility([cpu,{id:3,name:'RAM',specs_json:{ram_type:'DDR4'}}]).ids.size,2);console.log('Socket transforms, reparenting, socket and RAM conflicts: OK');
