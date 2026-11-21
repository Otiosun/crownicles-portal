const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
class FakeNode{
 constructor(name='div'){this.tagName=name.toUpperCase();this.attributes={};this.children=[];this.dataset={};this.className='';this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';this.value='';this.listeners={};this.lastChild=null;this.firstChild={textContent:''};this.classList={_new:new Set(),add:x=>this.classList._new.add(x),remove:x=>this.classList._new.delete(x),contains:x=>this.classList._new.has(x),toggle:(x,force)=>force===undefined?(this.classList._new.has(x)?(this.classList._new.delete(x),false):(this.classList._new.add(x),true)):(force?this.classList._new.add(x):this.classList._new.delete(x),force)};}
 addEventListener(n,f){(this.listeners[n]??=[]).push(f)}
 click(){if(this.disabled)return;for(const f of this.listeners.click||[])f({target:this})}
 input(s){this.value=s;for(const f of this.listeners.input||[])f({target:this})}
 setAttribute(k,v){this.attributes[k]=String(v)}
 removeAttribute(k){delete this.attributes[k]}
 getAttribute(k){return this.attributes[k]??null}
 replaceChildren(...n){this.children=n;this.lastChild=n.at(-1)??null}
 append(...n){this.children.push(...n);this.lastChild=this.children.at(-1)}
 focus(){this.focused=true}
 blur(){this.focused=false}
}
function fixture(hash='#personagem'){
 const ids=['experience','scene-side','profile-section','inventory-section','companion-section','garden-section','property-section','section-id','scene-detail-label','eyebrow','page-title','lead','scene-art','visual-centre','visual-fallback','fallback-number','scene-overline','scene-counter','profile-scene-caption','detail-scene-caption','object-index','object-name','object-subtitle','object-facts','inventory-list','inventory-count','search-items','toggle-art','previous-item','next-item','announce','pet-name','pet-love','pet-type','pet-rarity','pet-expedition','pet-talisman','pet-bond','pet-status','garden-access','garden-plots','garden-summary','garden-plots-list','garden-seed','garden-watering','garden-status','home-city','home-level','home-summary','property-list','minimum-rent','property-status','chest-inspection','chest-items','chest-summary'];
 const nodes=Object.fromEntries(ids.map(x=>[x,new FakeNode(x)]));nodes['toggle-art'].firstChild={textContent:'Ocultar ilustração '};
 const nav=['profile','inventory','companion','garden','property'].map(x=>{const el=new FakeNode('button');el.dataset.view=x;return el});
 const filters=['all','equipment','potion','material','other'].map(x=>{const el=new FakeNode('button');el.dataset.filter=x;el.textContent=x;return el});
 const scenario=['ready','absent','restricted','not_initialized','unavailable'].map(x=>{const el=new FakeNode('button');el.dataset.scenario=x;return el});
 const document={activeElement:{tagName:'BODY'},getElementById:n=>nodes[n]??(()=>{throw Error('UNKNOWN_ID_'+n)})(),createElement:name=>new FakeNode(name),querySelectorAll(sel){if(sel==='.nav-option')return nav;if(sel==='.filter-option')return filters;if(sel==='[data-scenario]')return scenario;throw Error('UNKNOWN_SELECTOR_'+sel);},addEventListener(n,f){(this.listeners??={})[n]=f;}};
 nodes['search-items'].focus=()=>{document.activeElement=nodes['search-items']};nodes['search-items'].blur=()=>{document.activeElement={tagName:'BODY'}};
 const location={hash},history={replaceState(_a,_b,h){location.hash=h}};
 const window={listeners:{},addEventListener(k,f){this.listeners[k]=f}};
 const src=fs.readFileSync(__dirname+'/../contract-adapter.js','utf8')+'\n'+fs.readFileSync(__dirname+'/../app.js','utf8')+'\n;globalThis.__testApi={state,page,catalog,selectItem,switchView,setScenario,readHash,render,filtered,readDomain,applyReadBundleForTest};';
 const context={document,window,location,history,console,requestAnimationFrame:f=>f(),Object,Map,Set,Date,encodeURIComponent,decodeURIComponent};vm.runInNewContext(src,context,{filename:'app.js'});
 return {nodes,nav,filters,scenario,document,location,window,api:context.__testApi};
}
test('opens the original profile without a network request',()=>{let f=fixture();assert.equal(f.api.state.view,'profile');assert.equal(f.nodes['scene-art'].src,'./assets/portrait.webp');assert.equal(f.nodes['profile-section'].hidden,false);assert.equal(f.nodes['garden-section'].hidden,true)});
test('five tabs map to one consistent experience and a verified hash',()=>{const f=fixture();for(const [i,k] of ['profile','inventory','companion','garden','property'].entries()){f.nav[i].click();assert.equal(f.api.state.view,k);assert.equal(f.nodes['experience'].dataset.view,k);assert.equal(f.nav[i].getAttribute('aria-current'),'page')}assert.equal(f.location.hash,'#patrimonio/17')});
test('companion uses native type ID, not invented species identity',()=>{const f=fixture();f.nav[2].click();assert.equal(f.nodes['pet-name'].textContent,'Lume');assert.equal(f.nodes['pet-type'].textContent,'#7');assert.equal(f.nodes['pet-expedition'].textContent,'Sem viagem');assert.equal(f.nodes['scene-art'].src,'./assets/owl.webp');assert.match(f.nodes['scene-art'].alt,/pode não corresponder/)});
test('garden has four plots, preserves IDs, safe selection and deep link',()=>{const f=fixture();f.nav[3].click();const list=f.nodes['garden-plots-list'].children;assert.equal(list.length,4);assert.equal(f.nodes['garden-plots'].textContent,'4');assert.equal(f.nodes['object-name'].textContent,'Canteiro 2');list[2].click();assert.equal(f.nodes['object-name'].textContent,'Canteiro 3');assert.equal(f.location.hash,'#jardim/2');assert.equal(f.nodes['garden-plots-list'].children[2].getAttribute('aria-pressed'),'true')});
test('garden does not expose mutation links and respects illustration identity caveat',()=>{const f=fixture();f.nav[3].click();assert.equal(f.nodes['garden-seed'].textContent,'Trevo dourado');assert.equal(f.nodes['garden-watering'].textContent,'Sem espera registrada');assert.match(f.nodes['scene-art'].alt,/não retrata a planta identificada/);assert.equal(f.nodes['detail-scene-caption'].hidden,false)});
test('property uses canonical property fields with no rent action',()=>{const f=fixture();f.nav[4].click();assert.equal(f.nodes['home-level'].textContent,'3');assert.equal(f.nodes['property-list'].children.length,2);assert.equal(f.nodes['minimum-rent'].textContent,'100 moedas');assert.equal(f.nodes['object-name'].textContent,'Apartamento 17');f.nodes['property-list'].children[1].click();assert.equal(f.location.hash,'#patrimonio/18');assert.equal(f.nodes['object-facts'].children[0].children[1].textContent,'0 moedas');assert.equal(f.nodes['object-facts'].children[2].children[1].textContent,'Não atingido')});
test('restricted scenario hides domain data and stage art',()=>{const f=fixture();f.nav[4].click();f.scenario[2].click();assert.equal(f.nodes['property-section'].dataset.status,'restricted');assert.equal(f.nodes['property-status'].hidden,false);assert.equal(f.nodes['scene-art'].hidden,true);assert.equal(f.nodes['object-name'].textContent,'Patrimônio indisponível')});
test('absent companion uses explicit safe state',()=>{const f=fixture();f.nav[2].click();f.scenario[1].click();assert.equal(f.nodes['companion-section'].dataset.status,'absent');assert.equal(f.nodes['pet-status'].children[0].textContent,'Sem registro');assert.equal(f.nodes['scene-art'].hidden,true)});
test('not initialized garden is not fabricated as empty plots',()=>{const f=fixture();f.nav[3].click();f.scenario[3].click();assert.equal(f.nodes['garden-section'].dataset.status,'not_initialized');assert.equal(f.nodes['object-facts'].children.length,0);assert.equal(f.nodes['scene-art'].hidden,true)});
test('back to ready does not retain disabled status',()=>{const f=fixture();f.nav[3].click();f.scenario[1].click();f.scenario[0].click();assert.equal(f.nodes['garden-status'].hidden,true);assert.equal(f.nodes['garden-plots-list'].children.length,4);assert.equal(f.nodes['scene-art'].hidden,false)});
test('inventory search folds accents and filters correctly',()=>{const f=fixture();f.nav[1].click();assert.equal(f.nodes['inventory-list'].children.length,8);f.nodes['search-items'].input('trevo');assert.equal(f.nodes['inventory-list'].children.length,2);assert.match(f.nodes['inventory-count'].textContent,/2 registros/);f.filters[3].click();assert.equal(f.nodes['inventory-list'].children.length,1);assert.equal(f.nodes['object-name'].textContent,'Nenhum resultado')});
test('red potion cannot receive the purple potion artwork',()=>{const f=fixture();f.nav[1].click();assert.equal(f.api.selectItem('potion:0'),true);assert.equal(f.nodes['object-name'].textContent,'Poção vermelha');assert.equal(f.nodes['scene-art'].hidden,true);assert.equal(f.nodes['scene-art'].src,'./assets/amethyst.webp');assert.equal(f.nodes['scene-art'].attributes.src,undefined)});
test('zero search results cannot expose stale art',()=>{const f=fixture();f.nav[1].click();f.nodes['search-items'].input('<script>');assert.equal(f.nodes['object-name'].textContent,'Nenhum resultado');assert.equal(f.nodes['scene-art'].hidden,true);assert.equal(f.nodes['next-item'].disabled,true)});
test('inventory paging respects current filter',()=>{const f=fixture();f.nav[1].click();f.filters[1].click();const first=f.api.state.selected;f.nodes['next-item'].click();assert.notEqual(first,f.api.state.selected);assert.equal(f.api.catalog.find(i=>i.key===f.api.state.selected).category,'equipment')});
test('art toggling preserves all current fact text',()=>{const f=fixture();f.nav[4].click();const name=f.nodes['object-name'].textContent,amount=f.nodes['object-facts'].children[0].children[1].textContent;f.nodes['toggle-art'].click();assert.equal(f.nodes['scene-art'].hidden,true);assert.equal(f.nodes['object-name'].textContent,name);assert.equal(f.nodes['object-facts'].children[0].children[1].textContent,amount);f.nodes['toggle-art'].click();assert.equal(f.nodes['scene-art'].hidden,false)});
test('valid deep links reconstruct garden and property selection',()=>{for(const [hash,v,field,num] of [['#jardim/2','garden','selectedPlot',2],['#patrimonio/18','property','selectedApartment',18],['#inventario/weapon%3A1','inventory','selected','weapon:1'],['#companheiro','companion',null,null]]){const f=fixture(hash);assert.equal(f.api.state.view,v);if(field)assert.equal(f.api.state[field],num)}});
test('invalid hash inputs do not select invalid entity',()=>{const f=fixture('#jardim/999999');assert.equal(f.api.state.selectedPlot,1);const g=fixture('#inventario/__proto__');assert.equal(g.api.state.selected,'material:5');assert.equal(g.api.selectItem('unknown'),false)});
test('lab JS has no network/HTTP/mutation entrypoint',()=>{const src=fs.readFileSync(__dirname+'/../app.js','utf8');assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|axios\s*\(/);assert.doesNotMatch(src,/\/api\/|\.save\s*\(|\.update\s*\(/);});

test('non-applicable scenarios cannot cover profile or inventory with false security state',()=>{const f=fixture();f.scenario[2].click();assert.equal(f.api.state.scenario,'ready');f.nav[1].click();f.scenario[1].click();assert.equal(f.api.state.scenario,'ready');assert.equal(f.nodes['inventory-list'].children.length,8)});

test('unavailable scenario removes all detailed display on garden',()=>{const f=fixture();f.nav[3].click();f.scenario[4].click();assert.equal(f.nodes['garden-section'].dataset.status,'unavailable');assert.equal(f.nodes['scene-art'].hidden,true);assert.equal(f.nodes['object-facts'].children.length,0)});

test('restricted property physically erases previous apartment identifiers, amount and selection DOM',()=>{
 const f=fixture();f.nav[4].click();assert.equal(f.nodes['property-list'].children.length,2);
 f.scenario[2].click();
 assert.equal(f.nodes['home-city'].textContent,'—');assert.equal(f.nodes['home-level'].textContent,'—');
 assert.equal(f.nodes['minimum-rent'].textContent,'—');
 assert.equal(f.nodes['property-list'].children.length,0);assert.equal(f.nodes['home-summary'].children.length,0);
 assert.equal(f.nodes['scene-art'].hidden,true);assert.equal(f.nodes['object-facts'].children.length,0);
 assert.equal(f.location.hash,'#patrimonio');
});
test('garden restriction erases previous plots, seed, percentages and hashed plot identifier',()=>{
 const f=fixture('#jardim/1');assert.equal(f.nodes['garden-plots-list'].children.length,4);
 f.scenario[4].click();assert.equal(f.nodes['garden-plots-list'].children.length,0);
 assert.equal(f.nodes['garden-summary'].children.length,0);
 assert.equal(f.nodes['garden-seed'].textContent,'—');
 assert.equal(f.nodes['garden-watering'].textContent,'—');assert.equal(f.location.hash,'#jardim');
});
test('companion restriction erases nickname, sex, attributes and art',()=>{
 const f=fixture();f.nav[2].click();assert.equal(f.nodes['pet-name'].textContent,'Lume');
 f.scenario[1].click();for(const id of ['pet-name','pet-love','pet-type','pet-rarity','pet-expedition','pet-talisman','pet-bond'])assert.equal(f.nodes[id].textContent,'—');
 assert.equal(f.nodes['scene-art'].hidden,true);
});
test('invalid CP035 bundle fails all protected sections closed, even after a successful read',()=>{
 const f=fixture();f.nav[4].click();const bad={state:'ready',version:1,sections:{property:{state:'ready',data:{apartments:[],home:{cityId:'x'},minRentToClaim:100}}}};
 assert.equal(f.api.applyReadBundleForTest(bad),'unavailable');
 assert.equal(f.nodes['property-section'].dataset.status,'unavailable');assert.equal(f.nodes['property-list'].children.length,0);
 assert.equal(f.location.hash,'#patrimonio');
 f.nav[3].click();assert.equal(f.nodes['garden-section'].dataset.status,'unavailable');
});
test('CP035 accepts property state ready with null home and zero apartments as absence of a sub-entity',()=>{
 const f=fixture();f.nav[4].click();const raw={state:'ready',version:1,sections:{property:{state:'ready',data:{home:null,apartments:[],minRentToClaim:100}}}};
 assert.equal(f.api.applyReadBundleForTest(raw),'ready');
 assert.equal(f.nodes['home-level'].textContent,'—');
 assert.equal(f.nodes['property-list'].children.length,1);
 assert.equal(f.nodes['object-name'].textContent,'Nenhum apartamento');
 assert.equal(f.nodes['scene-art'].hidden,true);
});
test('search with no matching items removes stale inventory item from deep link',()=>{
 const f=fixture();f.nav[1].click();assert.match(f.location.hash,/material/);
 f.nodes['search-items'].input('não existe xyz');
 assert.equal(f.location.hash,'#inventario');
 assert.equal(f.nodes['scene-art'].hidden,true);
});
test('non-API lab never fetches data or mutates a database',()=>{
 for(const name of ['app.js','contract-adapter.js']){const code=fs.readFileSync(__dirname+'/../'+name,'utf8');
  assert.doesNotMatch(code,/\bfetch\s*\(|new\s+WebSocket\s*\(|\bXMLHttpRequest\b/);
 }
});

test('property can inspect read-only native chest fields without an action button',()=>{
 const f=fixture();f.nav[4].click();
 assert.equal(f.nodes['chest-summary'].textContent,'1 item guardado');
 assert.equal(f.nodes['chest-items'].children.length,1);
 const child=f.nodes['chest-items'].children[0];
 assert.equal(child.children[0].textContent,'Poção #1');
 assert.match(child.children[1].textContent,/Espaço 1/);
});
test('chest contents disappear from DOM when property becomes restricted',()=>{
 const f=fixture();f.nav[4].click();
 assert.equal(f.nodes['chest-items'].children.length,1);
 f.scenario[2].click();
 assert.equal(f.nodes['chest-items'].children.length,0);
 assert.equal(f.nodes['chest-inspection'].open,false);
 assert.equal(f.nodes['chest-summary'].textContent,'Sem dados');
});
test('restricted native chest cannot reveal items even when global property is ready',()=>{
 const f=fixture();f.nav[4].click();
 const property=f.api.readDomain('property');
 const raw={state:'ready',version:1,sections:{property,chest:{state:'restricted'}}};
 assert.equal(f.api.applyReadBundleForTest(raw),'ready');
 assert.equal(f.nodes['property-section'].dataset.status,'ready');
 assert.equal(f.nodes['chest-items'].children.length,0);
 assert.equal(f.nodes['chest-summary'].textContent,'Acesso não permitido nesta localização');
});
test('malicious nickname is added using textContent, not HTML injection',()=>{
 const f=fixture();f.nav[2].click();
 const pet=f.api.readDomain('pet');
 pet.packet.pet.nickname='<svg onload=alert(1)>';
 assert.equal(f.api.applyReadBundleForTest({state:'ready',version:1,sections:{pet}}),'ready');
 assert.equal(f.nodes['pet-name'].textContent,'<svg onload=alert(1)>');
 assert.equal(f.nodes['pet-name'].children.length,0);
});
