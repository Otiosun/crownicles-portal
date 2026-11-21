/** CP018 candidate. Install under Core/src/commands/player only in isolated checkout.
 * No registration, command execution, collector, lazy initialization, or automatic action.
 * Caller supplies authenticated actor and transaction (CP017 gate remains mandatory).
 */
import type { Transaction } from "sequelize";
import { Player } from "../../core/database/game/models/Player";
import { PetEntity } from "../../core/database/game/models/PetEntity";
import { PetExpedition } from "../../core/database/game/models/PetExpedition";
import { PlayerTalismans } from "../../core/database/game/models/PlayerTalismans";
import { Guild } from "../../core/database/game/models/Guild";
import { CommandUtils } from "../../core/utils/CommandUtils";
import { ExpeditionConstants, ExpeditionLocationType } from "../../../../Lib/src/constants/ExpeditionConstants";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import type { CommandPetPacketRes, PetExpeditionInfo } from "../../../../Lib/src/packets/commands/CommandPetPacket";
import type { CommandGuildStoragePacketRes, FoodStorage } from "../../../../Lib/src/packets/commands/CommandGuildStoragePacket";

type State = "restricted" | "unavailable" | "absent";
type Result<T> = {state: State} | {state: "ready"; packet: T};
type PetData = Pick<CommandPetPacketRes, "pet" | "hasTalisman" | "expeditionInProgress">;
type PantryData = Pick<CommandGuildStoragePacketRes, "guildName" | "foods">;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
async function ownPlayer(actor: string, transaction: Transaction): Promise<{state: State} | {state:"ready"; player:Player}> {
 if (typeof actor !== "string" || !UUID.test(actor) || !transaction) throw Error("PORTAL_QUERY_CONTEXT_REQUIRED");
 const player = await Player.findOne({where:{keycloakId:actor},transaction});
 if (!player || player.keycloakId !== actor) return {state:"unavailable"};
 if (player.banned || !player.hasStartedToPlay() || !CommandUtils.checkEffects(player, [], [], CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD)) return {state:"restricted"};
 return {state:"ready",player};
}
export async function readExistingPetForPortal(actor: string,transaction: Transaction): Promise<Result<PetData>> {
 const result = await ownPlayer(actor,transaction);
 if(result.state!=="ready") return result;
 const player=result.player;
 if(!player.petId) return {state:"absent"}; // native null/0 sentinel
 const pet=await PetEntity.findOne({where:{id:player.petId},transaction});
 if(!pet || pet.id!==player.petId) return {state:"unavailable"};
 const expedition=await PetExpedition.findOne({where:{playerId:player.id,status:ExpeditionConstants.STATUS.IN_PROGRESS},transaction});
 if(expedition && (expedition.playerId!==player.id || expedition.petId!==pet.id || expedition.status!==ExpeditionConstants.STATUS.IN_PROGRESS)) return {state:"unavailable"};
 const talisman=await PlayerTalismans.findOne({where:{playerId:player.id},transaction});
 if(talisman && talisman.playerId!==player.id) return {state:"unavailable"};
 // Native asOwnedPet provides exactly the packet fields. An absent talisman row is
 // unreported, not initialized by querying; do NOT call findOrCreate.
 const expeditionInProgress:PetExpeditionInfo|undefined=expedition?{
  endTime:expedition.endDate.getTime(),startTime:expedition.startDate.getTime(),riskRate:expedition.riskRate,
  difficulty:expedition.difficulty,locationType:expedition.locationType as ExpeditionLocationType,
  mapLocationId:expedition.mapLocationId,foodConsumed:expedition.foodConsumed
 }:undefined;
 return {state:"ready",packet:{pet:pet.asOwnedPet(),hasTalisman:talisman?.hasTalisman,expeditionInProgress}};
}
export async function readExistingPantryForPortal(actor:string,transaction:Transaction):Promise<Result<PantryData>> {
 const result=await ownPlayer(actor,transaction);
 if(result.state!=="ready")return result;
 const player=result.player;
 if(!player.guildId)return {state:"absent"};
 const guild=await Guild.findOne({where:{id:player.guildId},transaction});
 if(!guild||guild.id!==player.guildId)return {state:"unavailable"};
 // Membership of the authenticated actor is derived from its row; no requested guild.
 const foodCaps=GuildDomainConstants.getFoodCaps(guild.pantryLevel);
 const foods:FoodStorage[]=PetConstants.PET_FOOD_BY_ID.map((id,index)=>({id,amount:guild.getDataValue(id as keyof Guild) as number,maxAmount:foodCaps[index]}));
 return {state:"ready",packet:{guildName:guild.name,foods}};
}
