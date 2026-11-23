<script type="module">
import {mountP0Portal} from "__CP052_URI__";
import {mountR6Visual} from "__R6_URI__";
const fixture = {"profile": {"level": 42, "health": {"value": 90, "max": 100}, "experience": {"value": 10, "max": 100}, "money": 450, "badges": [], "missions": {"gems": 0, "campaignProgression": 0}, "rank": {"unranked": true, "rank": -1, "numberOfPlayers": 0, "score": 0}, "effect": {"healed": false, "timeLeft": 0, "effect": "", "hasTimeDisplay": false}, "kingChallengeTier": 0}, "inventory": {"categories": [{"category": "weapon", "capacity": 4, "active": {"id": 0, "rarity": 1, "itemCategory": 0, "itemLevel": 0, "attack": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}, "defense": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}, "speed": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}}, "reserves": [{"slot": 1, "display": {"id": 10, "rarity": 1, "itemCategory": 0, "itemLevel": 0, "attack": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}, "defense": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}, "speed": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}}}, {"slot": 2, "display": {"id": 10, "rarity": 1, "itemCategory": 0, "itemLevel": 0, "attack": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}, "defense": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}, "speed": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}}}]}, {"category": "armor", "capacity": 2, "active": {"id": 0, "rarity": 1, "itemCategory": 1, "itemLevel": 0, "attack": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}, "defense": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}, "speed": {"baseValue": 0, "upgradeValue": 0, "maximum": {"kind": "unknown"}}}, "reserves": []}, {"category": "potion", "capacity": 2, "active": {"id": 0, "rarity": 1, "itemCategory": 2, "nature": 0, "power": 0, "maximumPower": {"kind": "unknown"}}, "reserves": [{"slot": 1, "display": {"id": 6, "rarity": 1, "itemCategory": 2, "nature": 0, "power": 0, "maximumPower": {"kind": "unknown"}}}]}, {"category": "object", "capacity": 2, "active": {"id": 0, "rarity": 1, "itemCategory": 3, "nature": 0, "power": 0, "maximumPower": {"kind": "unknown"}}, "reserves": []}], "materials": [], "talismans": {"kind": "not_reported"}, "plants": {"kind": "not_reported"}}};
let session=true, invalid=false, failures=[];
const fakeFetch = async (path,options={})=>{
  if(options.credentials!=='same-origin')failures.push('CREDENTIALS_NOT_SAME_ORIGIN');
  if(options.method==='GET'&&path.startsWith('/v1/me/')){
    if(!session || invalid)return new Response(JSON.stringify({state:'unauthorized'}),{status:401,headers:{'content-type':'application/json'}});
    const section=path.split('/').pop();
    if(!(section in fixture))return new Response('{}',{status:404,headers:{'content-type':'application/json'}});
    const json={state:'ready',asOf:'2026-11-23T17:40:00Z',data:fixture[section]};
    return new Response(JSON.stringify(json),{status:200,headers:{'content-type':'application/json'}});
  }
  if(path==='/v1/session/logout'){
    session=false;
    return new Response(JSON.stringify({status:'signed_out'}),{status:200,headers:{'content-type':'application/json'}});
  }
  failures.push('UNEXPECTED_PATH:'+path);
  return new Response('{}',{status:404,headers:{'content-type':'application/json'}});
};
window.__bootError=null;
try {
  window.__visual=(mountR6Visual)(document);
  window.__portal=mountP0Portal(document,{fetcher:fakeFetch});
  window.__test={get requests(){return failures},setInvalid(flag){invalid=flag},setSession(flag){session=flag},getState(){return window.__portal.reader.getState()}};
  window.__booted=true;
} catch(e){window.__bootError=String(e);}
</script>