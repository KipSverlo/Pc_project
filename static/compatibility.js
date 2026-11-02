export function checkCompatibility(items){
 const ids=new Set(),messages=[];
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
 const a=items[i],b=items[j];for(const key of ['socket','ram_type']){
 const left=a.specs_json?.[key],right=b.specs_json?.[key];
 if(left&&right&&left!==right){ids.add(a.id);ids.add(b.id);messages.push(`${a.name} и ${b.name}: ${key==='socket'?'разные сокеты':'разный тип памяти'} (${left} / ${right}).`);}
 }}return {ids,messages};
}
