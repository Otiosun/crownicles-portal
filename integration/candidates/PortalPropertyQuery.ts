/**
 * CP034, isolated read-only candidate for Crownicles Core 6.2.0.b.
 * Destination when integrated: Core/src/commands/player/PortalPropertyQuery.ts.
 * This is NOT a route or an authorization provider. The caller MUST authenticate
 * the Keycloak subject server-side, bind it to `actor`, and supply a consistent
 * read-only database transaction. No arbitrary playerId, homeId or cityId input.
 *
 * Unlike buildChestData(), this MUST NEVER initialize missing rows. It returns
 * not_initialized instead of fabricating empty slots. Mutations remain in Core.
 */
import type { Transaction } from "sequelize";
import { Player } from "../../core/database/game/models/Player";
import { Home } from "../../core/database/game/models/Home";
import { HomeChestSlot } from "../../core/database/game/models/HomeChestSlot";
import { Apartment } from "../../core/database/game/models/Apartment";
import { Maps } from "../../core/maps/Maps";
import { CommandUtils } from "../../core/utils/CommandUtils";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { CityDataController } from "../../data/City";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import type { ItemWithDetails } from "../../../../Lib/src/types/ItemWithDetails";

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const safe = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;
const positive = (n: number): boolean => safe(n) && n > 0;
const categoryNames = ["weapon", "armor", "potion", "object"] as const;
const missing = (): Failure => ({state: "not_initialized"});
const unavailable = (): Failure => ({state: "unavailable"});

type CategoryName = typeof categoryNames[number];
type Capacities = Record<CategoryName, number>;
type Failure = {state: "unavailable" | "not_initialized" | "restricted"} | {state: "absent"; reason: "no_home"};
type PropertyView = {
 home: null | {cityId: string; level: number; chestSlots: Capacities; cookingSlots: number; gardenPlots: number; bedHealthRegeneration: number};
 apartments: {
  apartmentId: number; cityId: string; mapLocationId: number;
  purchasePrice: number; accumulatedRent: number; isRented: boolean; canClaim: boolean;
 }[];
 minRentToClaim: number;
};
type ChestEntry = {slot: number; category: ItemCategory; details: ItemWithDetails};
type ChestView = {homeCityId: string; accessibleFromCityId: string; accessMode: "main_home" | "owned_apartment"; slotsPerCategory: Capacities; chestItems: ChestEntry[]};
type PropertyResult = Failure | {state: "ready"; data: PropertyView};
type ChestResult = Failure | {state: "ready"; data: ChestView};

function assertContext(actor: string, transaction: Transaction): void {
 if(typeof actor !== "string" || !UUID.test(actor) || !transaction) throw new Error("PORTAL_QUERY_CONTEXT_REQUIRED");
}
function isValidCityId(s: unknown): s is string {
 return typeof s === "string" && s.length > 0 && s.length <= 128;
}
async function getActor(actor: string, transaction: Transaction): Promise<Player | null> {
 const player = await Player.findOne({where: {keycloakId: actor}, transaction});
 if(!player || player.keycloakId !== actor || !positive(player.id) || player.banned || !player.hasStartedToPlay()) return null;
 return player;
}
function getCaps(value: unknown): Capacities | null {
 if(!value || typeof value !== "object") return null;
 const o = value as Record<string, number>;
 if(!categoryNames.every(n => safe(o[n]))) return null;
 return {weapon: o.weapon, armor: o.armor, potion: o.potion, object: o.object};
}

/** Portfolio is view-only, even away from home. A future route must decide
 * whether the notary's location prerequisite also applies to displaying rent.
 * `canClaim` mirrors the original notary's *snapshot eligibility*, never a
 * promise that a portal mutation endpoint exists or would accept an action.
 */
export async function readPropertyForPortal(actor: string, transaction: Transaction, now: Date = new Date()): Promise<PropertyResult> {
 assertContext(actor, transaction);
 if(!(now instanceof Date) || !Number.isFinite(now.valueOf())) throw new Error("PORTAL_QUERY_INVALID_TIME");
 const player = await getActor(actor, transaction);
 if(!player) return unavailable();
 const home = await Home.findOne({where: {ownerId: player.id}, transaction});
 let homeView: PropertyView["home"] = null;
 if(home) {
  if(home.ownerId !== player.id || !positive(home.id) || !isValidCityId(home.cityId)) return unavailable();
  const level = home.getLevel();
  if(!level || !level.features || level.level !== home.level || !positive(home.level)) return unavailable();
  const chestSlots = getCaps(level.features.chestSlots);
  const {cookingSlots, gardenPlots, bedHealthRegeneration} = level.features;
  if(!chestSlots || ![cookingSlots, gardenPlots, bedHealthRegeneration].every(safe)) return unavailable();
  homeView = {cityId: home.cityId, level: home.level, chestSlots, cookingSlots, gardenPlots, bedHealthRegeneration};
 }
 const apartments = await Apartment.findAll({where: {ownerId: player.id}, order: [["cityId", "ASC"]], transaction});
 const seenIds = new Set<number>(), seenCities = new Set<string>();
 const summaries: PropertyView["apartments"] = [];
 for(const a of apartments) {
  if(a.ownerId !== player.id || !positive(a.id) || seenIds.has(a.id) || !isValidCityId(a.cityId) || seenCities.has(a.cityId) || !safe(a.purchasePrice)) return unavailable();
  seenIds.add(a.id); seenCities.add(a.cityId);
  if(!(a.lastRentClaimedAt instanceof Date) || !Number.isFinite(a.lastRentClaimedAt.valueOf())) return unavailable();
  // Native controller lookup mirrors buildOwnedApartmentSummary in ReportCityService.
  const city = CityDataController.instance.getById(a.cityId);
  if(!city || !Array.isArray(city.maps) || !positive(city.maps[0])) return unavailable();
  // Native Apartment methods retain rounding, floor, cap and home-city logic.
  const accumulatedRent = a.getAccumulatedRent(now);
  const isRented = a.isRentedFor(home);
  if(!safe(accumulatedRent) || typeof isRented !== "boolean") return unavailable();
  summaries.push({apartmentId: a.id, cityId: a.cityId, mapLocationId: city.maps[0], purchasePrice: a.purchasePrice, accumulatedRent, isRented, canClaim: isRented && accumulatedRent >= HomeConstants.MIN_RENT_TO_CLAIM});
 }
 if(!safe(HomeConstants.MIN_RENT_TO_CLAIM)) return unavailable();
 return {state: "ready", data: {home: homeView, apartments: summaries, minRentToClaim: HomeConstants.MIN_RENT_TO_CLAIM}};
}

function asNumber(v: unknown): number | null {return typeof v === "number" && Number.isFinite(v) ? v : null;}
function asNumberTriple(value: unknown): {baseValue: number; upgradeValue: number; maxValue: number} | null {
 if(!value || typeof value !== "object") return null;
 const v = value as Record<string, unknown>;
 const baseValue = asNumber(v.baseValue), upgradeValue = asNumber(v.upgradeValue), maxValue = asNumber(v.maxValue);
 return baseValue === null || upgradeValue === null || maxValue === null ? null : {baseValue, upgradeValue, maxValue};
}
/** Whitelist the original ItemWithDetails union. Never return model instances,
 * arbitrary object keys or another user's raw inventory metadata to the UI. */
function projectDetails(d: ItemWithDetails, itemId: number, category: ItemCategory): ItemWithDetails | null {
 if(!d || typeof d !== "object" || d.id !== itemId || d.itemCategory !== category || (!safe(d.rarity) || d.rarity > 8)) return null;
 if("attack" in d) {
  const attack = asNumberTriple(d.attack), defense = asNumberTriple(d.defense), speed = asNumberTriple(d.speed);
  if(!attack || !defense || !speed || !safe(d.itemLevel)) return null;
  if(d.itemEnchantmentId !== undefined && typeof d.itemEnchantmentId !== "string") return null;
  return {id: d.id, rarity: d.rarity, itemCategory: d.itemCategory, itemLevel: d.itemLevel, attack, defense, speed, ...(d.itemEnchantmentId === undefined ? {} : {itemEnchantmentId: d.itemEnchantmentId})};
 }
 if(!("nature" in d) || !safe(d.nature) || d.nature > 7 || asNumber(d.power) === null || asNumber(d.maxPower) === null) return null;
 if(d.usages !== undefined && !safe(d.usages)) return null;
 if(d.maxUsages !== undefined && !safe(d.maxUsages)) return null;
 return {id: d.id, rarity: d.rarity, itemCategory: d.itemCategory, nature: d.nature, power: d.power, maxPower: d.maxPower,
  ...(d.usages === undefined ? {} : {usages: d.usages}), ...(d.maxUsages === undefined ? {} : {maxUsages: d.maxUsages})};
}

/** Chest location is resolved solely from authoritative player location. Never
 * trust a client-supplied city, home or apartment ID. Read access is limited to
 * the native home-city/apartment-city cases; read-only is NOT deposit permission.
 */
export async function readChestForPortal(actor: string, transaction: Transaction): Promise<ChestResult> {
 assertContext(actor, transaction);
 const player = await getActor(actor, transaction);
 if(!player) return unavailable();
 // Preserve the native city interaction's started/dead and location guards.
 if(!CommandUtils.checkEffects(player, [], [], CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD) ||
  !CommandUtils.verifyWhereAllowed(player.mapLinkId, [], [WhereAllowed.CONTINENT]) || Maps.isTravelling(player) || !player.insideCity) return {state: "restricted"};
 const home = await Home.findOne({where: {ownerId: player.id}, transaction});
 if(!home) return {state: "absent", reason: "no_home"};
 if(home.ownerId !== player.id || !positive(home.id) || !isValidCityId(home.cityId)) return unavailable();
 const level = home.getLevel();
 const caps = level && level.features && level.level === home.level ? getCaps(level.features.chestSlots) : null;
 if(!level || !caps || !positive(home.level)) return unavailable();
 const cityId = player.getCurrentCityId();
 if(!isValidCityId(cityId)) return {state: "restricted"};
 let accessMode: ChestView["accessMode"] = "main_home";
 if(cityId !== home.cityId) {
  const apartment = await Apartment.findOne({where: {ownerId: player.id, cityId}, transaction});
  if(!apartment) return {state: "restricted"};
  if(apartment.ownerId !== player.id || apartment.cityId !== cityId || !positive(apartment.id)) return unavailable();
  accessMode = "owned_apartment";
 }
 const allChestSlots = await HomeChestSlot.findAll({where: {homeId: home.id}, transaction});
 const filled: ChestEntry[] = [], seen = new Set<string>();
 for(const slot of allChestSlots) {
  const cat = slot.itemCategory as ItemCategory, name = categoryNames[cat];
  if(slot.homeId !== home.id || !name || !positive(slot.slot) || slot.slot > caps[name] || !safe(slot.itemId) || !safe(slot.itemLevel)) return unavailable();
  const key = `${cat}:${slot.slot}`;
  if(seen.has(key)) return unavailable();
  seen.add(key);
  if(slot.itemId === 0) continue;
  if(!slot.getItem()) return unavailable(); // missing data controller item is not an empty slot
  let native: ItemWithDetails;
  try {native = slot.itemWithDetails(player);} catch {return unavailable();}
  const details = projectDetails(native, slot.itemId, cat);
  if(!details) return unavailable();
  filled.push({slot: slot.slot, category: cat, details});
 }
 const expected = Object.values(caps).reduce((sum, n) => sum + n, 0);
 if(seen.size !== expected) return missing(); // native buildChestData() would create missing rows
 filled.sort((a,b) => a.category - b.category || a.slot - b.slot);
 return {state: "ready", data: {homeCityId: home.cityId, accessibleFromCityId: cityId, accessMode, slotsPerCategory: caps, chestItems: filled}};
}
