/** CP035: composition ONLY. No HTTP, no session resolver, no mutations.
 * Caller MUST derive actor from a verified server session and supply a real
 * REPEATABLE READ transaction using a SELECT-only DB principal (not checked here).
 */
import type { Transaction } from "sequelize";
import { readPropertyForPortal, readChestForPortal } from "./PortalPropertyQuery";
import { readExistingGardenForPortal } from "./PortalGardenQuery";
import { readExistingPetForPortal, readExistingPantryForPortal } from "./PortalCompanionsQuery";
export const PORTAL_SECTION_NAMES = ["property", "chest", "garden", "pet", "pantry"] as const;
export type PortalSection = typeof PORTAL_SECTION_NAMES[number];
type SectionResult =
 | Awaited<ReturnType<typeof readPropertyForPortal>>
 | Awaited<ReturnType<typeof readChestForPortal>>
 | Awaited<ReturnType<typeof readExistingGardenForPortal>>
 | Awaited<ReturnType<typeof readExistingPetForPortal>>
 | Awaited<ReturnType<typeof readExistingPantryForPortal>>;
export type PortalBundle =
 | { state: "unavailable" }
 | { state: "ready"; version: 1; sections: Partial<Record<PortalSection, SectionResult>> };
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const allowed = new Set<string>(PORTAL_SECTION_NAMES);
function validate(actor:string,transaction:Transaction,sections:readonly PortalSection[],now:Date):void {
 if(typeof actor!=="string"||!UUID.test(actor)||!transaction||transaction.finished) throw Error("PORTAL_CONTEXT_INVALID");
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())) throw Error("PORTAL_TIME_INVALID");
 if(!Array.isArray(sections)||sections.length===0||sections.length>5||sections.some(x=>typeof x!=="string"||!allowed.has(x))||new Set(sections).size!==sections.length) throw Error("PORTAL_SECTIONS_INVALID");
}
/** Caller owns the transaction. All candidates independently load the subject;
 * there is no claim of a stable snapshot until the SQL gate actually passes. */
export async function readPortalSectionsForServer(actor:string,transaction:Transaction,sections:readonly PortalSection[],now:Date=new Date()):Promise<PortalBundle>{
 validate(actor,transaction,sections,now);
 const results:Partial<Record<PortalSection,SectionResult>>=Object.create(null);
 try{
  for(const name of sections){
   let result:SectionResult;
   switch(name){
    case "property":result=await readPropertyForPortal(actor,transaction,now);break;
    case "chest":result=await readChestForPortal(actor,transaction);break;
    case "garden":result=await readExistingGardenForPortal(actor,transaction);break;
    case "pet":result=await readExistingPetForPortal(actor,transaction);break;
    case "pantry":result=await readExistingPantryForPortal(actor,transaction);break;
   }
   // A corrupt, missing-identity, or otherwise unavailable section fails
   // the ENTIRE bundle so earlier sections are not released with it.
   if(!result||!["ready","absent","restricted","not_initialized"].includes(result.state)) return {state:"unavailable"};
   results[name]=result;
  }
 }catch{return {state:"unavailable"};} // Never expose internal DB errors.
 return {state:"ready",version:1,sections:results};
}
