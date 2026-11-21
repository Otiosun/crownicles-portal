'use strict';
/* CP037 — CROWNICLES VISUAL LAB. Five presentations, ONE identity.
 * All numeric data below are fabricated fixtures shaped after CP018/033/034/035.
 * NO networking, authorization, item mutation, or live gameplay is simulated.
 * Core remains authoritative. A selected specimen is not an action request.
 */
const catalog=Object.freeze([
 {key:'material:5',category:'material',label:'Cristal de ametista',subtitle:'Material · coleção de demonstração',glyph:'✦',image:'./assets/amethyst.webp',alt:'Cristal ilustrativo facetado e coberto de musgo',facts:[['QUANTIDADE','3 unidades'],['IDENTIFICADOR','#5'],['GRUPO','Material']]},
 {key:'weapon:0',category:'equipment',label:'Espada de madeira',subtitle:'Arma · espaço equipado',glyph:'♰',facts:[['ESPAÇO','Equipado'],['NÍVEL DO ITEM','1'],['RARIDADE','1']]},
 {key:'weapon:1',category:'equipment',label:'Punhal',subtitle:'Arma · reserva 1',glyph:'♰',facts:[['ESPAÇO','Reserva 1'],['NÍVEL DO ITEM','1'],['RARIDADE','1']]},
 {key:'armor:0',category:'equipment',label:'Escudo de madeira',subtitle:'Armadura · espaço equipado',glyph:'◈',facts:[['ESPAÇO','Equipado'],['NÍVEL DO ITEM','1'],['RARIDADE','1']]},
 {key:'potion:0',category:'potion',label:'Poção vermelha',subtitle:'Poção · espaço equipado',glyph:'✧',facts:[['ESPAÇO','Equipado'],['USOS','1 / 2'],['IDENTIFICADOR','#1']]},
 {key:'object:0',category:'other',label:'Dado mágico',subtitle:'Objeto · espaço equipado',glyph:'⬡',facts:[['ESPAÇO','Equipado'],['IDENTIFICADOR','#2'],['RARIDADE','1']]},
 {key:'seed:0',category:'other',label:'Trevo dourado',subtitle:'Semente · espaço 0',glyph:'❧',facts:[['TIPO','Semente'],['IDENTIFICADOR','#2']]},
 {key:'plant:1',category:'other',label:'Trevo dourado',subtitle:'Planta · espaço 1',glyph:'❧',facts:[['TIPO','Planta'],['ESPAÇO','1']]}
]);
// Correct an inherited illustration trap: an image of a purple potion MUST NOT be
// attached to the red potion. Exact identity beats having art in every row.

const petFixture=Object.freeze({state:'ready',packet:{pet:{typeId:7,nickname:'Lume',rarity:2,sex:'f',loveLevel:4,force:12,feedDelay:0},hasTalisman:true,expeditionInProgress:undefined}});
const gardenFixture=Object.freeze({state:'ready',data:{homeLevel:3,totalPlots:4,accessMode:'full',plots:[
 {slot:0,plantId:0,growthProgress:0,isReady:false,readyAtTimestamp:0},
 {slot:1,plantId:3,growthProgress:.64,isReady:false,readyAtTimestamp:1795212000},
 {slot:2,plantId:2,growthProgress:1,isReady:true,readyAtTimestamp:0},
 {slot:3,plantId:0,growthProgress:0,isReady:false,readyAtTimestamp:0}
],plantStorage:Array.from({length:10},(_,i)=>({plantId:i+1,quantity:i===1?3:i===2?2:0,maxCapacity:5})),seedPlantId:2,wateringAvailableAt:null}});
const propertyFixture=Object.freeze({state:'ready',data:{home:{cityId:'cidade-demo-A',level:3,chestSlots:{weapon:1,armor:1,potion:1,object:1},cookingSlots:2,gardenPlots:4,bedHealthRegeneration:3},apartments:[
 {apartmentId:17,cityId:'cidade-demo-A',mapLocationId:111,purchasePrice:3000,accumulatedRent:212,isRented:true,canClaim:true},
 {apartmentId:18,cityId:'cidade-demo-B',mapLocationId:112,purchasePrice:3000,accumulatedRent:0,isRented:false,canClaim:false}
],minRentToClaim:100}});
// CP038 read model: synthetically shaped CP035 bundle, projected by a strict
// versioned adapter. No endpoint or session is invoked by this offline preview.
const chestFixture={state:'ready',data:{homeCityId:'cidade-demo-A',accessibleFromCityId:'cidade-demo-A',accessMode:'main_home',
 slotsPerCategory:{weapon:1,armor:1,potion:1,object:1},chestItems:[{slot:1,category:2,details:{id:1,itemCategory:2,rarity:1,nature:1,power:2,maxPower:4,usages:1,maxUsages:2}}]}};
const DEMONSTRATION_BUNDLE={state:'ready',version:1,sections:{pet:petFixture,garden:gardenFixture,property:propertyFixture,chest:chestFixture}};
let readBundle=PortalContract.normalizeBundle(DEMONSTRATION_BUNDLE);
if(readBundle.state!=='ready')throw Error('INVALID_LAB_BUNDLE');
function readDomain(name){return readBundle.state==='ready'?(readBundle.sections[name]||{state:'unavailable'}):{state:'unavailable'};}
// Pure test-only injection seam; deliberately not attached to window or a fetcher.
function applyReadBundleForTest(input){const next=PortalContract.normalizeBundle(input);readBundle=next;
 state.scenario='ready';state.selectedPlot=next.state==='ready'&&next.sections.garden?.state==='ready'?next.sections.garden.data.plots[0]?.slot??0:0;
 state.selectedApartment=next.state==='ready'&&next.sections.property?.state==='ready'?next.sections.property.data.apartments[0]?.apartmentId??0:0;
 render();putHash();return next.state;
}
const page={
 profile:{path:'personagem',chapter:'CAPÍTULO I — A VIAJANTE',eyebrow:'CADERNO DE CAMPO · Nº 001',title:'Todo caminho<br><em>deixa marcas.</em>',lead:'Uma vida medida não apenas por vitórias, mas por tudo o que se escolheu carregar.',over:'O RETRATO DE UMA JORNADA'},
 inventory:{path:'inventario',chapter:'CAPÍTULO II — O QUE SE CARREGA',eyebrow:'ARQUIVO DE PERTENCES · Nº 002',title:'Tudo o que<br><em>permanece.</em>',lead:'Cada objeto guarda uma possibilidade. Examine sem perder de vista o caminho.',over:'O INVENTÁRIO DE UMA JORNADA'},
 companion:{path:'companheiro',chapter:'CAPÍTULO III — O VÍNCULO',eyebrow:'REGISTRO DE COMPANHEIRO · Nº 003',title:'Um vínculo<br><em>na jornada.</em>',lead:'Um vínculo é mais do que um número. Seus dados permanecem claros, mesmo sem um retrato individual.',over:'O VÍNCULO DE UMA JORNADA'},
 garden:{path:'jardim',chapter:'CAPÍTULO IV — O CULTIVO',eyebrow:'CADERNO DE CULTIVO · Nº 004',title:'Tempo de<br><em>florescer.</em>',lead:'Cada espaço conserva seu próprio ritmo. O progresso é leitura; as decisões continuam no jogo.',over:'O TEMPO E SUAS RAÍZES'},
 property:{path:'patrimonio',chapter:'CAPÍTULO V — OS LUGARES',eyebrow:'ARQUIVO DE PATRIMÔNIO · Nº 005',title:'Aonde a vida<br><em>retorna.</em>',lead:'Uma casa e os lugares adquiridos durante a jornada, vistos sem abandonar as regras do mundo.',over:'VESTÍGIOS DE PERTENCIMENTO'}
};
const byKey=new Map(catalog.map(i=>[i.key,i]));
const state={view:'profile',filter:'all',query:'',selected:'material:5',selectedPlot:1,selectedApartment:17,art:true,scenario:'ready'};
const $=id=>document.getElementById(id);
const els={stage:$('experience'),side:$('scene-side'),profile:$('profile-section'),inventory:$('inventory-section'),companion:$('companion-section'),garden:$('garden-section'),property:$('property-section'),sectionId:$('section-id'),eyebrow:$('eyebrow'),title:$('page-title'),lead:$('lead'),sceneArt:$('scene-art'),centre:$('visual-centre'),fallback:$('visual-fallback'),fallbackNumber:$('fallback-number'),over:$('scene-overline'),counter:$('scene-counter'),profileCaption:$('profile-scene-caption'),detailCaption:$('detail-scene-caption'),detailIndex:$('object-index'),detailName:$('object-name'),detailSubtitle:$('object-subtitle'),detailFacts:$('object-facts'),items:$('inventory-list'),itemCount:$('inventory-count'),search:$('search-items'),artToggle:$('toggle-art'),prev:$('previous-item'),next:$('next-item'),announce:$('announce')};
function node(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e;}
function safeText(id,v){$(id).textContent=String(v);}
function normal(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();}
function filtered(){const q=normal(state.query);return catalog.filter(i=>(state.filter==='all'||i.category===state.filter)&&normal(i.label+' '+i.subtitle).includes(q));}
function announce(message){els.announce.textContent='';requestAnimationFrame(()=>els.announce.textContent=message);}
function currentDomainStatus(section){const name=section==='companion'?'pet':section;
 return state.scenario!=='ready'?state.scenario:readDomain(name).state;
}
function putHash(){let path=page[state.view].path;
 if(state.view==='inventory'&&filtered().some(x=>x.key===state.selected))path+='/'+encodeURIComponent(state.selected);
 if(state.view==='garden'&&currentDomainStatus('garden')==='ready'&&readDomain('garden').data.plots.some(x=>x.slot===state.selectedPlot))path+='/'+state.selectedPlot;
 if(state.view==='property'&&currentDomainStatus('property')==='ready'&&readDomain('property').data.apartments.some(x=>x.apartmentId===state.selectedApartment))path+='/'+state.selectedApartment;
 try{history.replaceState(null,'','#'+path);}catch{location.hash='#'+path;}
}
function readHash(){let val;try{val=decodeURIComponent(location.hash.slice(1));}catch{return;}
 if(val==='personagem')state.view='profile';
 else if(val==='inventario'||val.startsWith('inventario/')){state.view='inventory';const k=val.slice('inventario/'.length);if(byKey.has(k))state.selected=k;}
 else if(val==='companheiro')state.view='companion';
 else if(val==='jardim'||val.startsWith('jardim/')){state.view='garden';const m=/^jardim\/(\d+)$/.exec(val);const g=readDomain('garden');if(m&&g.state==='ready'&&g.data.plots.some(p=>p.slot===Number(m[1])))state.selectedPlot=Number(m[1]);}
 else if(val==='patrimonio'||val.startsWith('patrimonio/')){state.view='property';const m=/^patrimonio\/(\d+)$/.exec(val);const p=readDomain('property');if(m&&p.state==='ready'&&p.data.apartments.some(a=>a.apartmentId===Number(m[1])))state.selectedApartment=Number(m[1]);}
}
function renderArt(src,cls,alt,description){const status=['companion','garden','property'].includes(state.view)?currentDomainStatus(state.view):state.scenario;const art=Boolean(src&&state.art&&status==='ready');els.centre.classList.toggle('no-art',!art);els.sceneArt.hidden=!art;els.fallback.hidden=art;els.fallback.dataset.inventory=state.view==='inventory'?'true':'false';els.fallbackNumber.textContent=status==='ready'?'SEM REPRESENTAÇÃO NESTE ESTUDO':'SEM INFORMAÇÕES VISUAIS';
 if(art){els.sceneArt.src=src;els.sceneArt.className=cls;els.sceneArt.alt=alt;}else{els.sceneArt.removeAttribute('src');els.sceneArt.alt='';els.sceneArt.className='';}
 els.centre.setAttribute('aria-label',description);
}
function renderFacts(facts){els.detailFacts.replaceChildren();for(const [k,v] of facts){const e=node('div');e.append(node('small',null,k),node('strong',null,v));els.detailFacts.append(e);}}
function setDetail(title,subtitle,facts,index='',paging=false){els.detailName.textContent=title;els.detailSubtitle.textContent=subtitle;els.detailIndex.textContent=index;renderFacts(facts);els.prev.hidden=!paging;els.next.hidden=!paging;}
function renderInventory(){const entries=filtered();els.items.replaceChildren();for(const item of entries){const b=node('button','inventory-item');b.type='button';b.dataset.key=item.key;b.setAttribute('aria-pressed',String(item.key===state.selected));const g=node('span','item-glyph',item.glyph);g.setAttribute('aria-hidden','true');const body=node('span','item-body');body.append(node('b',null,item.label),node('small',null,item.subtitle));const arr=node('span','item-arr','↗');arr.setAttribute('aria-hidden','true');b.append(g,body,arr);b.addEventListener('click',()=>selectItem(item.key));els.items.append(b);}if(!entries.length)els.items.append(node('p','empty-message','Nenhum pertence corresponde à busca.'));
 els.itemCount.textContent=`${entries.length} ${entries.length===1?'registro':'registros'} nesta seleção · dados sintéticos`;
 document.querySelectorAll('.filter-option').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter)));
 if(!entries.length){setDetail('Nenhum resultado','Altere a busca ou o filtro para continuar.',[],'— / —',true);els.prev.disabled=true;els.next.disabled=true;renderArt(null,'','','Sem item selecionado');return;}
 const item=byKey.get(state.selected);
 const actual=entries.find(x=>x.key===item?.key)||entries[0];if(actual.key!==state.selected)state.selected=actual.key;
 const pos=entries.findIndex(x=>x.key===state.selected);
 setDetail(actual.label,actual.subtitle,actual.facts,`${String(pos+1).padStart(2,'0')} / ${String(entries.length).padStart(2,'0')}`,true);
 els.prev.disabled=entries.length<2;els.next.disabled=entries.length<2;
 renderArt(actual.image,'object-art',actual.alt||'',actual.image?'Arte conceitual deste material, não oficial':'Este item não tem ilustração vinculada');
}
const plants=new Map([[0,'Vazio'],[1,'Erva comum'],[2,'Trevo dourado'],[3,'Musgo lunar'],[4,'Raiz de ferro'],[5,'Cogumelo noturno'],[6,'Folha venenosa'],[7,'Bulbo de fogo'],[8,'Planta carnívora'],[9,'Flor de cristal'],[10,'Árvore ancestral']]);
function row(tag,heading,detail,pressed,attrs={}){const b=node('button', 'collection-entry');b.type='button';b.setAttribute('aria-pressed',String(pressed));for(const [k,v] of Object.entries(attrs))b.dataset[k]=String(v);const sym=node('span','entry-mark',pressed?'✦':'◇');sym.setAttribute('aria-hidden','true');const box=node('span','entry-copy');box.append(node('strong',null,heading),node('small',null,detail));b.append(sym,box,node('span','entry-arrow','↗'));b.lastChild.setAttribute('aria-hidden','true');return b;}
function smallFacts(dest,items){dest.replaceChildren();for(const [k,v] of items){const e=node('div','compact-fact');e.append(node('small',null,k),node('strong',null,v));dest.append(e);}}
const statusCopy={absent:['Sem registro','Este conjunto de dados não existe para o personagem deste cenário.'],restricted:['Consulta restrita','As condições de acesso não foram atendidas; nenhum dado particular é exibido.'],not_initialized:['Ainda não inicializado','O Core não disponibilizou os registros necessários. A consulta não fabrica espaços vazios.'],unavailable:['Consulta indisponível','Os dados não foram considerados seguros ou consistentes para exibição.']};
function eraseDomain(section){
 const fields={companion:['pet-name','pet-love','pet-type','pet-rarity','pet-expedition','pet-talisman','pet-bond'],
  garden:['garden-access','garden-plots','garden-seed','garden-watering'],
  property:['home-city','home-level','minimum-rent']}[section];
 for(const id of fields)safeText(id,'—');
 if(section==='garden'){$('garden-summary').replaceChildren();$('garden-plots-list').replaceChildren();}
 if(section==='property'){$('home-summary').replaceChildren();$('property-list').replaceChildren();clearChest();}
}
function statusFor(section){const code=currentDomainStatus(section);
 const status=$(section==='companion'?'pet-status':section+'-status');const wrapper=$(section+'-section');
 wrapper.dataset.status=code;status.hidden=code==='ready';
 if(code!=='ready'){
  eraseDomain(section);const [title,body]=statusCopy[code]||statusCopy.unavailable;
  status.replaceChildren(node('strong',null,title),node('p',null,body));
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 }else{status.replaceChildren();status.removeAttribute('role');status.removeAttribute('aria-live');}
 return code;
}
function renderCompanion(){if(statusFor('companion')!=='ready'){setDetail('Vínculo indisponível','Sem dados para inspeção neste cenário.',[],'—');renderArt(null,'','','Nenhum retrato de companheiro');return;}
 const d=readDomain('pet').packet;safeText('pet-name',d.pet.nickname||'Sem apelido');safeText('pet-love',d.pet.loveLevel);safeText('pet-type','#'+d.pet.typeId);safeText('pet-rarity',d.pet.rarity);safeText('pet-expedition',d.expeditionInProgress?'Em andamento':'Sem viagem');safeText('pet-talisman',d.hasTalisman===undefined?'Não informado':d.hasTalisman?'Registrado':'Não registrado');safeText('pet-bond',`${d.pet.force} de força · sexo ${d.pet.sex.toUpperCase()}`);
 setDetail('Um vínculo em vigília','Imagem ambiental ilustrativa — não identifica a espécie', [['TIPO NO CORE','#'+d.pet.typeId],['AFETO',String(d.pet.loveLevel)],['EXPEDIÇÃO',d.expeditionInProgress?'Registrada':'Ausente']],'FIG. III');
 renderArt('./assets/owl.webp','panel-art','Coruja conceitual pousada em ruínas de floresta; pode não corresponder à espécie do pet','Ilustração atmosférica independente dos dados do companheiro');
}
function renderGarden(){if(statusFor('garden')!=='ready'){setDetail('Cultivo indisponível','Sem dados para inspeção neste cenário.',[],'—');renderArt(null,'','','Nenhuma ilustração de jardim');return;}
 const d=readDomain('garden').data;safeText('garden-access',d.accessMode==='readOnly'?'Acesso remoto · leitura':'Acesso local · leitura');safeText('garden-plots',d.totalPlots);const ready=d.plots.filter(p=>p.isReady).length;const growing=d.plots.filter(p=>p.plantId>0&&!p.isReady).length;
 smallFacts($('garden-summary'),[['PRONTOS',ready],['CRESCENDO',growing],['ESTOQUE',d.plantStorage.reduce((a,x)=>a+x.quantity,0)]]);
 const target=$('garden-plots-list');target.replaceChildren();for(const plot of d.plots){const description=plot.plantId===0?'Espaço sem planta':plot.isReady?'Pronto para colheita no jogo':Math.round(plot.growthProgress*100)+'% do crescimento';const b=row('button',`Canteiro ${plot.slot+1} · ${plants.get(plot.plantId)||'ID #'+plot.plantId}`,description,plot.slot===state.selectedPlot,{slot:plot.slot});b.addEventListener('click',()=>{state.selectedPlot=plot.slot;render();putHash();announce(`Canteiro ${plot.slot+1} selecionado`)});target.append(b);}
 safeText('garden-seed',plants.get(d.seedPlantId)||'#'+d.seedPlantId);safeText('garden-watering',d.wateringAvailableAt===null?'Sem espera registrada':'Horário de consulta congelado');
 const p=d.plots.find(p=>p.slot===state.selectedPlot)||d.plots[0];const desc=p.plantId===0?'Canteiro vazio':p.isReady?'Pronto no cenário fictício':Math.round(p.growthProgress*100)+'% do ciclo ilustrativo';setDetail('Canteiro '+(p.slot+1),plants.get(p.plantId)||`Espécie #${p.plantId}`,[['SITUAÇÃO',desc],['ID DA PLANTA','#'+p.plantId],['MODO','Somente leitura']],`0${p.slot+1} / 0${d.totalPlots}`);
 renderArt('./assets/botanical.webp','panel-art','Estudo pictórico de cristal com pequenas plantas, não retrata a planta identificada no canteiro','Cena botânica ilustrativa, não corresponde a um lote real');
}
const categoryDisplay=['Arma','Armadura','Poção','Objeto'];
function clearChest(){
 $('chest-items').replaceChildren();safeText('chest-summary','Sem dados');$('chest-inspection').open=false;
}
function renderChest(){
 const domain=readDomain('chest');$('chest-items').replaceChildren();
 if(domain.state!=='ready'){
  const copy={restricted:'Acesso não permitido nesta localização',absent:'Sem baú registrado',not_initialized:'Espaços não inicializados',unavailable:'Consulta indisponível'};
  safeText('chest-summary',copy[domain.state]||'Consulta indisponível');return;
 }
 const entries=domain.data.chestItems;
 safeText('chest-summary',`${entries.length} ${entries.length===1?'item':'itens'} guardado${entries.length===1?'':'s'}`);
 if(!entries.length){$('chest-items').append(node('p','empty-message','Nenhum item guardado.'));return;}
 for(const item of entries){
  const c=node('div','chest-entry');const name=node('span',null,`${categoryDisplay[item.category]} #${item.details.id}`);
  const info=node('small',null,`Espaço ${item.slot} · raridade ${item.details.rarity}`);
  c.append(name,info);$('chest-items').append(c);
 }
}
function renderProperty(){if(statusFor('property')!=='ready'){setDetail('Patrimônio indisponível','Sem dados para inspeção neste cenário.',[],'—');renderArt(null,'','','Sem imagem de imóvel');return;}
 const d=readDomain('property').data;renderChest();
 safeText('home-city',d.home?'Localização fictícia · '+d.home.cityId:'Sem residência principal');
 safeText('home-level',d.home?.level??'—');
 smallFacts($('home-summary'),d.home?[['BAÚ',Object.values(d.home.chestSlots).reduce((a,x)=>a+x,0)+' espaços'],['COZINHA',d.home.cookingSlots+' locais'],['JARDIM',d.home.gardenPlots+' canteiros']]:[['RESIDÊNCIA','Sem registro'],['APARTAMENTOS',d.apartments.length],['CONSULTA','Somente leitura']]);
 const target=$('property-list');target.replaceChildren();for(const a of d.apartments){const detail=`${a.accumulatedRent} moedas acumuladas · ${a.isRented?'alugado':'sem locação'}`;const b=row('button',`Apartamento #${a.apartmentId} · Cidade ${a.cityId.slice(-1)}`,detail,a.apartmentId===state.selectedApartment,{apartmentId:a.apartmentId});b.addEventListener('click',()=>{state.selectedApartment=a.apartmentId;render();putHash();announce(`Apartamento ${a.apartmentId} selecionado`)});target.append(b);}
 safeText('minimum-rent',d.minRentToClaim+' moedas');
 if(!d.apartments.length){target.append(node('p','empty-message','Nenhum apartamento registrado.'));
  setDetail('Nenhum apartamento','Não há apartamento para inspecionar neste cenário.',[],'—');
  renderArt(null,'','','Nenhum imóvel ilustrado');return;
 }
 const a=d.apartments.find(a=>a.apartmentId===state.selectedApartment)||d.apartments[0];setDetail(`Apartamento ${a.apartmentId}`,'Estudo ambiental de arquitetura, não é retrato do imóvel',[['ALUGUEL',a.accumulatedRent+' moedas'],['SITUAÇÃO',a.isRented?'Alugado':'Sem locação'],['LIMIAR',a.canClaim?'Atingido':'Não atingido']],`${a.apartmentId} / ARQUIVO`);
 renderArt('./assets/forest.webp','panel-art scenic-art','Ruínas arquitetônicas em um caminho arborizado, ilustração atmosférica e não imagem do apartamento','Paisagem ambiental ilustrativa, não representa a moradia real');
}
function render(){const d=page[state.view];if(!d)return;els.stage.dataset.view=state.view;els.side.dataset.type=state.view;for(const name of ['profile','inventory','companion','garden','property'])els[name].hidden=state.view!==name;els.profileCaption.hidden=state.view!=='profile';els.detailCaption.hidden=state.view==='profile';
 safeText('scene-detail-label',{inventory:'OBJETO EM FOCO',companion:'REGISTRO DE VÍNCULO',garden:'CANTEIRO EM FOCO',property:'IMÓVEL EM FOCO'}[state.view]||'REGISTRO');els.sectionId.textContent=d.chapter;els.eyebrow.textContent=d.eyebrow;els.title.innerHTML=d.title;els.lead.textContent=d.lead;els.over.textContent=d.over;els.counter.textContent=`${String(Object.keys(page).indexOf(state.view)+1).padStart(2,'0')} / 05`;
 document.querySelectorAll('.nav-option').forEach(btn=>{if(btn.dataset.view===state.view)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')});
 els.artToggle.firstChild.textContent=state.art?'Ocultar ilustração ':'Mostrar ilustração ';els.artToggle.setAttribute('aria-pressed',String(state.art));
 document.querySelectorAll('[data-scenario]').forEach(btn=>{btn.setAttribute('aria-pressed',String(btn.dataset.scenario===state.scenario));btn.disabled=!['companion','garden','property'].includes(state.view)&&btn.dataset.scenario!=='ready';});
 if(state.view==='profile'){renderArt('./assets/portrait.webp','portrait-art','Retrato conceitual de viajante com capa e bolsa','Retrato de personagem conceitual; não é o avatar autenticado');}
 if(state.view==='inventory')renderInventory();if(state.view==='companion')renderCompanion();if(state.view==='garden')renderGarden();if(state.view==='property')renderProperty();
}
function switchView(name){if(!Object.prototype.hasOwnProperty.call(page,name))return;state.view=name;state.scenario='ready';render();putHash();announce('Área selecionada: '+name);}
function selectItem(k){if(!byKey.has(k))return false;state.selected=k;state.view='inventory';state.scenario='ready';render();putHash();announce('Objeto selecionado: '+byKey.get(k).label);return true;}
function cycle(dir){const all=filtered();if(all.length<2)return;const n=all.findIndex(i=>i.key===state.selected);const to=all[((n<0?0:n)+dir+all.length)%all.length];selectItem(to.key);}
function setScenario(status){if(!['ready','absent','restricted','not_initialized','unavailable'].includes(status))return;if(status!=='ready'&&!['companion','garden','property'].includes(state.view))return;state.scenario=status;render();putHash();announce('Estado de laboratório: '+status);}
document.querySelectorAll('.nav-option').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
document.querySelectorAll('.filter-option').forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.filter;state.scenario='ready';const a=filtered();if(a.length&&!a.some(i=>i.key===state.selected))state.selected=a[0].key;render();putHash();announce('Filtro aplicado: '+btn.textContent)}));
els.search.addEventListener('input',()=>{state.query=els.search.value;const a=filtered();if(a.length&&!a.some(i=>i.key===state.selected))state.selected=a[0].key;renderInventory();putHash();});
els.artToggle.addEventListener('click',()=>{state.art=!state.art;render();announce(state.art?'Ilustração mostrada':'Ilustração ocultada; texto preservado')});
els.prev.addEventListener('click',()=>cycle(-1));els.next.addEventListener('click',()=>cycle(1));
document.querySelectorAll('[data-scenario]').forEach(btn=>btn.addEventListener('click',()=>setScenario(btn.dataset.scenario)));
window.addEventListener('hashchange',()=>{readHash();state.scenario='ready';render();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&state.view==='inventory'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();els.search.focus();}
 if(e.key==='Escape'&&document.activeElement===els.search){els.search.value='';state.query='';renderInventory();els.search.blur();}
});
readHash();render();
