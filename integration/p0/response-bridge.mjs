/**
 * CP041 — CP012/014 read-response -> UX-P0 navigation events (LAB ONLY).
 * No fetch, OIDC, cookies, persistence, DB, gateway route or UI rendering.
 * The input is a transport envelope returned by the trusted, SERVER-side
 * CP013/014 authorized gateway. In particular, this does not authorize access.
 */
import { transition } from '../../lab/ux-p0-003/machine.mjs';
import { isProjectedP0 } from './projection-guard.mjs';

const SECTIONS = new Set(['profile', 'inventory']);
const STATES = new Set(['ready', 'restricted', 'not_initialized', 'unavailable']);
const own = (x, key) => Object.prototype.hasOwnProperty.call(x, key);
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => Object.keys(x).every(k => keys.includes(k));
const iso = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x) && Number.isFinite(Date.parse(x));

/**
 * Map the CP014 {status,body} transport envelope to a pure UX-P0 event.
 * Only status=401 destroys the entire session. Unexpected data is never
 * projected as ready, and error details are never copied to state.
 */
export function mapReadResponse({section, epoch, requestId}, response) {
  if (!SECTIONS.has(section) || !Number.isSafeInteger(epoch) || epoch < 1 ||
      !Number.isSafeInteger(requestId) || requestId < 1) {
    throw new TypeError('INVALID_P0_REQUEST_CONTEXT');
  }
  const base = {type:'FETCH_FINISHED', section, epoch, requestId};
  if (response?.status === 401) return {...base,domainState:'unauthorized'};
  const body = response?.body;
  if (response?.status !== 200 || !record(body) || !STATES.has(body.state)) {
    return {...base,domainState:'unavailable'};
  }
  if (body.state !== 'ready') {
    if (!exact(body,['state','asOf']) || !iso(body.asOf)) return {...base,domainState:'unavailable'};
    return {...base,domainState:body.state};
  }
  if (!exact(body,['state','asOf','data']) || !own(body,'data') ||
      !iso(body.asOf) || !record(body.data) || !isProjectedP0(section,body.data)) {
    return {...base,domainState:'unavailable'};
  }
  // Strictly check the projected DTO a SECOND time in the browser, in addition
  // to the UX machine's root allowlist. This is NOT authorization. The trusted
  // server must already have projected CP014 data. No raw game packets.
  return {...base,domainState:'ready',asOf:body.asOf,data:body.data};
}

/** Initiate one read for a known session epoch. No I/O is performed. */
export function startRead(state, section, requestId) {
  if (!SECTIONS.has(section)) throw new TypeError('UNKNOWN_P0_SECTION');
  const token = Object.freeze({section, epoch:state.epoch, requestId});
  const next = transition(state,{type:'FETCH_STARTED', ...token});
  return {state:next, token:next===state?null:token};
}

/** Complete a known read; the machine discards stale epochs/request IDs. */
export function finishRead(state, token, response) {
  if (!token) return state;
  return transition(state, mapReadResponse(token,response));
}
