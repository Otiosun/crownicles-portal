/** CP033 isolated candidate. No decorator, route, collector or mutation.
 * Destination: Core/src/commands/player/PortalGardenQuery.ts.
 * Caller must supply authenticated actor and verified SELECT-only transaction.
 */
import type { Transaction } from "sequelize";
import { Player } from "../../core/database/game/models/Player";
import { Home } from "../../core/database/game/models/Home";
import { HomeGardenSlot } from "../../core/database/game/models/HomeGardenSlot";
import { HomePlantStorage } from "../../core/database/game/models/HomePlantStorage";
import { PlayerPlantSlot } from "../../core/database/game/models/PlayerPlantSlot";
import { PlayerTalismans } from "../../core/database/game/models/PlayerTalismans";
import { InventoryInfo } from "../../core/database/game/models/InventoryInfo";
import { Maps } from "../../core/maps/Maps";
import { CommandUtils } from "../../core/utils/CommandUtils";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { GardenAccessMode } from "../../../../Lib/src/types/GardenAccessMode";
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { PlantConstants, PLANT_SLOT_TYPE } from "../../../../Lib/src/constants/PlantConstants";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const nonnegativeInt = (x: number) => Number.isSafeInteger(x) && x >= 0;
type Failure = {state:"restricted"|"unavailable"|"not_initialized"} | {state:"absent";reason:"no_home"|"no_garden"};
type Plot = {slot:number;plantId:number;growthProgress:number;isReady:boolean;readyAtTimestamp:number};
type GardenView = {homeLevel:number;totalPlots:number;accessMode:GardenAccessMode;plots: Plot[];plantStorage:{plantId:number;quantity:number;maxCapacity:number}[];seedPlantId:number;wateringAvailableAt:number|null};
type Result = Failure | {state:"ready";data:GardenView};
const unavailable = ():Failure => ({state:"unavailable"});
const missing = ():Failure => ({state:"not_initialized"});

export async function readExistingGardenForPortal(actor:string, transaction:Transaction):Promise<Result> {
 if(typeof actor!=="string" || !UUID.test(actor) || !transaction) throw Error("PORTAL_QUERY_CONTEXT_REQUIRED");
 const player=await Player.findOne({where:{keycloakId:actor},transaction});
 if(!player || player.keycloakId!==actor || !nonnegativeInt(player.id)) return unavailable();
 if(player.banned || !player.hasStartedToPlay() || !CommandUtils.checkEffects(player,[],[],CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD) || !CommandUtils.verifyWhereAllowed(player.mapLinkId,[],[WhereAllowed.CONTINENT])) return {state:"restricted"};
 const home=await Home.findOne({where:{ownerId:player.id},transaction});
 if(!home) return {state:"absent",reason:"no_home"};
 if(home.ownerId!==player.id || !nonnegativeInt(home.id)) return unavailable();
 const level=home.getLevel();
 if(!level || level.level!==home.level) return unavailable();
 const {gardenPlots,gardenEarthQuality,gardenPlantStorageCapacity}=level.features;
 if(!nonnegativeInt(gardenPlots)||!nonnegativeInt(gardenPlantStorageCapacity))return unavailable();
 if(gardenPlots===0) return {state:"absent",reason:"no_garden"};
 // Native resolveGardenAccess: home-city and not travelling; away requires talisman.
 let accessMode:GardenAccessMode=GardenAccessMode.FULL;
 if(Maps.isTravelling(player)||player.getCurrentCityId()!==home.cityId){
  const tal=await PlayerTalismans.findOne({where:{playerId:player.id},transaction});
  if(!tal) return missing(); // do not replace missing record with assumed false
  if(tal.playerId!==player.id || typeof tal.hasRemoteHarvestTalisman!=="boolean")return unavailable();
  if(!tal.hasRemoteHarvestTalisman)return {state:"restricted"};
  accessMode=GardenAccessMode.READ_ONLY;
 }
 // Deliberately avoid native getOfPlayer/initializeSlots/ensureSlotsForLevel.
 const info=await InventoryInfo.findOne({where:{playerId:player.id},transaction});
 if(!info)return missing();
 if(info.playerId!==player.id || !nonnegativeInt(info.plantSlots))return unavailable();
 const slots=await HomeGardenSlot.findAll({where:{homeId:home.id},order:[["slot","ASC"]],transaction});
 const storage=await HomePlantStorage.findAll({where:{homeId:home.id},order:[["plantId","ASC"]],transaction});
 const seed=await PlayerPlantSlot.findOne({where:{playerId:player.id,slotType:PLANT_SLOT_TYPE.SEED,slot:0},transaction});
 // Unknown IDs/out-of-range rows/duplicates are inconsistent, not empty slots.
 const validPlant=(id:number)=>id===0||!!PlantConstants.getPlantById(id as Parameters<typeof PlantConstants.getPlantById>[0]);
 const plantIds=new Set<number>(PlantConstants.getAllPlants().map(p=>p.id));
 const seenSlots=new Set<number>(),seenPlants=new Set<number>();
 const plots:Plot[]=[];
 for(const slot of slots){
  if(slot.homeId!==home.id || !nonnegativeInt(slot.slot)||slot.slot>=gardenPlots||seenSlots.has(slot.slot)||!validPlant(slot.plantId))return unavailable();
  seenSlots.add(slot.slot);
  const plant=PlantConstants.getPlantById(slot.plantId);
  if(slot.plantId!==0 && (!(slot.plantedAt instanceof Date)||!Number.isFinite(slot.plantedAt.valueOf())))return unavailable();
  const effective=plant?GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds,gardenEarthQuality):0;
  if(plant&&(!Number.isFinite(effective)||effective<=0))return unavailable();
  // Native growth helpers, same units as buildGardenPlotsData. No duplicate balance formula.
  const isReady=slot.isReady(effective),growthProgress=slot.getGrowthProgress(effective);
  if(typeof isReady!=="boolean"||!Number.isFinite(growthProgress)||growthProgress<0||growthProgress>1)return unavailable();
  const readyAtTimestamp=plant&&slot.plantedAt&&!isReady?Math.ceil((slot.plantedAt.valueOf()+effective*TimeConstants.MS_TIME.SECOND)/TimeConstants.MS_TIME.SECOND):0;
  if(!nonnegativeInt(readyAtTimestamp))return unavailable();
  plots.push({slot:slot.slot,plantId:slot.plantId,growthProgress,isReady,readyAtTimestamp});
 }
 const plantStorage:GardenView["plantStorage"]=[];
 for(const entry of storage){
  if(entry.homeId!==home.id||!plantIds.has(entry.plantId)||seenPlants.has(entry.plantId)||!nonnegativeInt(entry.quantity))return unavailable();
  seenPlants.add(entry.plantId);
  // Keep native quantity even if an old record exceeds current capacity.
  plantStorage.push({plantId:entry.plantId,quantity:entry.quantity,maxCapacity:gardenPlantStorageCapacity});
 }
 if(seed&&(seed.playerId!==player.id||seed.slotType!==PLANT_SLOT_TYPE.SEED||seed.slot!==0||!validPlant(seed.plantId)))return unavailable();
 // No fake zeros when native command would initialize rows.
 if(seenSlots.size!==gardenPlots||seenPlants.size!==plantIds.size||!seed)return missing();
 if(player.lastGardenWatered!==null&&(!(player.lastGardenWatered instanceof Date)||!Number.isFinite(player.lastGardenWatered.valueOf())))return unavailable();
 const next=player.lastGardenWatered===null?null:player.lastGardenWatered.valueOf()+GardenConstants.WATERING_COOLDOWN_MS;
 const wateringAvailableAt=next!==null&&next>Date.now()?next:null;
 // Native eligibility fields intentionally excluded: readOnly allows harvest in original,
 // but this portal has no mutation route or collector, and cannot promise eligibility.
 return {state:"ready",data:{homeLevel:home.level,totalPlots:gardenPlots,accessMode,plots,plantStorage,seedPlantId:seed.plantId,wateringAvailableAt}};
}
