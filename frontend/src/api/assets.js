// Data for the asset screens: the real estate list, manual valuation
// (PWM-F-022, TC-Val-03) and valuation history (PWM-F-023).
// Uses the mock store in mockAssets.js until the asset and valuation endpoints
// exist; see mock.js for the ?mock= preview states.
//
// Contract for the backend (Sateesh, Greeshma). In every endpoint the user id
// comes from the auth cookie, never from the request; repositories filter by
// user_id. Another user's asset gives 403, a missing or deleted one 404, and no
// session 401. Errors use the SAD shape {"error":{"code","message","fields"}}.

import { apiFetch } from './http.js';
import { USE_MOCK } from './mock.js';
import {
  mockCreateAsset,
  mockDeleteAsset,
  mockGetAsset,
  mockListAssets,
  mockUpdateAsset,
  mockUpdateValuation,
  mockValuationHistory,
} from './mockAssets.js';

/**
 * GET /api/assets?type=REAL_ESTATE&page=1&limit=200   (type optional: all types)
 * 200 {"items":[{"id":1,"assetType":"REAL_ESTATE","name":"Flat, Adyar",
 *                "location":"Chennai","purchaseValue":"6500000.00","purchaseDate":"2021-03-15",
 *                "currentValue":"8200000.00","valuedAt":"2026-06-10T05:30:00Z",
 *                "form":null,"purityKarat":null,"weightGrams":null,"purchasePrice":null,
 *                "ticker":null,"exchange":null,"quantity":null,"averageBuyPrice":null,
 *                "accountLabel":null}],
 *      "page":1,"limit":200,"total":1}
 * Only the caller's non-deleted assets. Fields that don't apply to the type are
 * null (B22). valuedAt is when the asset last changed.
 */
export async function listAssets(type) {
  if (USE_MOCK) return mockListAssets(type);
  const query = new URLSearchParams({ page: '1', limit: '200' });
  if (type) query.set('type', type);
  return apiFetch(`/api/assets?${query}`);
}

/**
 * POST /api/assets   (PWM-F-010 to PWM-F-013; body from lib/assetForm.js)
 * body {"assetType":"GOLD","form":"COIN","purityKarat":22,"weightGrams":"20.000",
 *       "purchasePrice":"110000.00","value":"120000.00"}
 * 201 {"success":true,"data":{…the stored row…}}
 * 400 VALIDATION_ERROR with fields[] | 401
 */
export async function createAsset(body) {
  if (USE_MOCK) return mockCreateAsset(body);
  return apiFetch('/api/assets', { method: 'POST', body });
}

/** PUT /api/assets/:id (PWM-F-014): same body as create -> 200 | 400 | 404 | 401 */
export async function updateAsset(id, body) {
  if (USE_MOCK) return mockUpdateAsset(id, body);
  return apiFetch(`/api/assets/${encodeURIComponent(id)}`, { method: 'PUT', body });
}

/** DELETE /api/assets/:id (PWM-F-014): soft delete -> 200 | 404 | 401 */
export async function deleteAsset(id) {
  if (USE_MOCK) return mockDeleteAsset(id);
  return apiFetch(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** GET /api/assets/:id -> 200 one asset (shape as in the list) | 403 | 404 | 401 */
export async function getAsset(id) {
  if (USE_MOCK) return mockGetAsset(id);
  return apiFetch(`/api/assets/${encodeURIComponent(id)}`);
}

/**
 * PUT /api/assets/:id/valuation  (PWM-F-022, SAD 4.5)
 * body {"value":"8500000.00"}   decimal string, >= 0, at most 2 decimals
 * 200 the updated asset, with the new currentValue and valuedAt (now).
 *     In the same transaction the server writes a MANUAL row to valuations,
 *     sets real_estate_details.estimated_value_updated_at and upserts today's
 *     net_worth_snapshots row. Earlier valuation rows are never changed.
 * 400 {"error":{"code":"VALIDATION_ERROR","message":"…","fields":[{"field":"value","message":"…"}]}}
 * 403 FORBIDDEN (not the caller's asset) | 404 NOT_FOUND | 401
 * 422 when the asset is valued from market prices (stock, gold)
 */
export async function updateValuation(id, value) {
  if (USE_MOCK) return mockUpdateValuation(id, value);
  return apiFetch(`/api/assets/${encodeURIComponent(id)}/valuation`, { method: 'PUT', body: { value } });
}

/**
 * GET /api/valuations/history?assetId=…&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=200  (PWM-F-023)
 * from and to are optional and inclusive.
 * 200 {"items":[{"id":"…","assetId":"…","value":"8500000.00","source":"MANUAL",
 *                "valuedAt":"2026-10-19T08:45:00Z"}],
 *      "page":1,"limit":200,"total":4}
 * Newest first (valued_at DESC). source is MANUAL or MARKET.
 * 403 / 404 / 401 as for GET /api/assets/:id.
 */
export async function fetchValuationHistory(assetId, { from, to } = {}) {
  if (USE_MOCK) return mockValuationHistory({ assetId, from, to });
  const query = new URLSearchParams({ assetId, page: '1', limit: '200' });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return apiFetch(`/api/valuations/history?${query}`);
}
