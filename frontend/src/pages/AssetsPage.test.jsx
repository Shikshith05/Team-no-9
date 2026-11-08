// @vitest-environment jsdom
// B23: add, edit and delete assets on the Assets screen (PWM-F-010 to PWM-F-014,
// TC-Asset-01). Only fetch is replaced: a tiny in-memory API answers like the
// backend (B22), so the real api/assets.js and http.js code runs.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AssetsPage from './AssetsPage.jsx';

const reply = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), { status });

const PROPERTY = {
  id: 1,
  assetType: 'REAL_ESTATE',
  name: 'Flat, Adyar',
  location: 'Chennai',
  purchaseValue: '6500000.00',
  purchaseDate: '2021-03-15',
  currentValue: '8200000.00',
  valuedAt: '2026-06-10T05:30:00Z',
};
const GOLD = {
  id: 2,
  assetType: 'GOLD',
  name: 'Gold coin (22K)',
  currentValue: '120000.00',
  valuedAt: '2026-06-10T05:30:00Z',
  form: 'COIN',
  purityKarat: 22,
  weightGrams: '20.000',
  purchasePrice: '110000.00',
};

let items;
let calls;
let next; // a forced reply for the next write request

function fakeApi(url, init = {}) {
  const method = init.method ?? 'GET';
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({ method, url, body });
  if (method !== 'GET' && next) {
    const forced = next;
    next = null;
    return Promise.resolve(forced);
  }
  if (method === 'GET' && url.startsWith('/api/assets?')) {
    return Promise.resolve(reply(200, { items, page: 1, limit: 200, total: items.length }));
  }
  const id = Number(url.split('/').pop());
  if (method === 'POST') {
    const asset = { id: 100 + items.length, assetType: body.assetType, name: body.assetName ?? body.ticker ?? body.accountLabel, currentValue: body.value };
    items = [...items, { ...body, ...asset }];
    return Promise.resolve(reply(201, { success: true, data: asset }));
  }
  if (method === 'PUT') {
    items = items.map((a) => (a.id === id ? { ...a, ...body, name: body.assetName ?? a.name, currentValue: body.value } : a));
    return Promise.resolve(reply(200, { success: true, data: {} }));
  }
  if (method === 'DELETE') {
    items = items.filter((a) => a.id !== id);
    return Promise.resolve(reply(200, { success: true }));
  }
  return Promise.resolve(reply(404, { error: { code: 'NOT_FOUND', message: 'Not found.', fields: [] } }));
}

const writes = () => calls.filter((c) => c.method !== 'GET');
const listLoads = () => calls.filter((c) => c.method === 'GET').length;
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function renderPage() {
  render(<AssetsPage />);
  await screen.findByRole('button', { name: 'Add asset' });
  await waitFor(() => expect(screen.queryByText('Loading your assets')).toBeNull());
}

async function openAddForm(type) {
  fireEvent.click(screen.getByRole('button', { name: 'Add asset' }));
  await screen.findByTestId('asset-form');
  if (type) fill('Asset type', type);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('token', 'jwt');
  window.location.hash = '#/assets';
  items = [PROPERTY, GOLD];
  calls = [];
  next = null;
  vi.stubGlobal('fetch', vi.fn(fakeApi));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('asset list', () => {
  it('groups the assets by type with their details and actions', async () => {
    await renderPage();
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/assets?page=1&limit=200' });

    const property = screen.getByTestId('property');
    expect(property.textContent).toContain('Chennai');
    expect(within(property).getByRole('link', { name: 'Update value of Flat, Adyar' })).toBeTruthy();

    const gold = screen.getByRole('heading', { name: 'Gold coin (22K)', level: 3 }).closest('li');
    expect(gold.textContent).toContain('Coin · 22K · 20.000 g');
    expect(gold.textContent).toContain('Purchase price');
    expect(within(gold).getByRole('button', { name: 'Edit Gold coin (22K)' })).toBeTruthy();
    expect(within(gold).getByRole('button', { name: 'Delete Gold coin (22K)' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Real estate (1)', 'Gold (1)']);
  });

  it('shows an empty state when there are no assets', async () => {
    items = [];
    await renderPage();
    expect(screen.getByTestId('assets-empty').textContent).toContain('No assets yet');
  });
});

describe('add form', () => {
  it('shows the fields of the chosen type', async () => {
    await renderPage();
    await openAddForm();
    const labels = () =>
      [...screen.getByTestId('asset-form').querySelectorAll('label')].map((l) => l.textContent).filter((t) => t !== 'Asset type');

    expect(labels()).toEqual(['Property name', 'Location', 'Purchase value (₹)', 'Purchase date', 'Current estimated value (₹)']);
    fill('Asset type', 'GOLD');
    expect(labels()).toEqual(['Form', 'Purity (karat)', 'Weight (grams)', 'Purchase price (₹)', 'Current value (₹)', 'Name (optional)']);
    fill('Asset type', 'STOCK');
    expect(labels()).toEqual(['Ticker symbol', 'Exchange', 'Quantity', 'Average buy price (₹)', 'Current value (₹)', 'Name (optional)']);
    fill('Asset type', 'CASH');
    expect(labels()).toEqual(['Account label', 'Current balance (₹)', 'Name (optional)']);
  });

  it('invalid input shows errors next to the fields, focuses the first, and sends nothing', async () => {
    await renderPage();
    await openAddForm('GOLD');
    fill('Purity (karat)', '25');
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }));

    const purity = screen.getByLabelText('Purity (karat)');
    expect(purity.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('asset-purityKarat-error').textContent).toBe('Enter a whole number of karats from 1 to 24.');
    expect(document.getElementById('asset-weightGrams-error').textContent).toBe('Enter the weight.');
    expect(document.activeElement).toBe(purity);
    expect(writes()).toEqual([]);

    // Errors update as the user fixes them.
    fill('Purity (karat)', '22');
    expect(document.getElementById('asset-purityKarat-error')).toBeNull();
  });

  it('creates a stock holding with POST /api/assets, then refreshes the list', async () => {
    await renderPage();
    const loadsBefore = listLoads();
    await openAddForm('STOCK');
    fill('Ticker symbol', 'infy');
    fill('Quantity', '10');
    fill('Average buy price (₹)', '1,450');
    fill('Current value (₹)', '15000');
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }));

    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true);
    expect((await screen.findByRole('status')).textContent).toBe('Stocks asset added.');
    expect(writes()).toEqual([
      {
        method: 'POST',
        url: '/api/assets',
        body: { assetType: 'STOCK', ticker: 'INFY', exchange: 'NSE', quantity: '10', averageBuyPrice: '1450.00', value: '15000.00' },
      },
    ]);
    await waitFor(() => expect(listLoads()).toBeGreaterThan(loadsBefore));
    expect(await screen.findByRole('heading', { name: 'INFY', level: 3 })).toBeTruthy();
    expect(screen.queryByTestId('asset-form')).toBeNull();
  });

  it('shows the server field errors next to the inputs (SAD error format)', async () => {
    await renderPage();
    await openAddForm('CASH');
    fill('Account label', 'Savings');
    fill('Current balance (₹)', '100');
    next = reply(400, {
      error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields: [{ field: 'value', message: 'Value is too large.' }] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }));

    await waitFor(() => expect(document.getElementById('asset-value-error')?.textContent).toBe('Value is too large.'));
    expect(screen.getByLabelText('Current balance (₹)').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Add asset' }).disabled).toBe(false);
  });

  it('a 401 ends the session and asks the user to log in again', async () => {
    await renderPage();
    await openAddForm('CASH');
    fill('Account label', 'Savings');
    fill('Current balance (₹)', '100');
    next = reply(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token.', fields: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }));

    await waitFor(() => expect(window.location.hash).toBe('#/login'));
    expect(localStorage.getItem('token')).toBeNull();
    expect(await screen.findByTestId('session-expired')).toBeTruthy();
  });
});

describe('edit form', () => {
  it('is prefilled and saves with PUT /api/assets/:id', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Gold coin (22K)' }));
    await screen.findByRole('heading', { name: 'Edit Gold coin (22K)' });

    expect(screen.getByLabelText('Asset type').value).toBe('GOLD');
    expect(screen.getByLabelText('Form').value).toBe('COIN');
    expect(screen.getByLabelText('Purity (karat)').value).toBe('22');
    expect(screen.getByLabelText('Weight (grams)').value).toBe('20.000');
    expect(screen.getByLabelText('Name (optional)').value).toBe('Gold coin (22K)');

    fill('Weight (grams)', '25.5');
    fill('Current value (₹)', '150000');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect((await screen.findByRole('status')).textContent).toBe('Gold coin (22K) was updated.');
    expect(writes()).toEqual([
      {
        method: 'PUT',
        url: '/api/assets/2',
        body: {
          assetType: 'GOLD',
          form: 'COIN',
          purityKarat: 22,
          weightGrams: '25.5',
          purchasePrice: '110000.00',
          value: '150000.00',
          assetName: 'Gold coin (22K)',
        },
      },
    ]);
    await waitFor(() => expect(screen.getByText('Coin · 22K · 25.5 g')).toBeTruthy());
  });

  it('cancel closes the form without a request', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Flat, Adyar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('asset-form')).toBeNull();
    expect(writes()).toEqual([]);
  });
});

describe('delete', () => {
  it('asks in an in-page dialog, then soft-deletes with DELETE /api/assets/:id', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Flat, Adyar' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Flat, Adyar?' });
    expect(dialog.textContent).toContain('no longer count toward your net worth');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect((await screen.findByRole('status')).textContent).toBe('Flat, Adyar was deleted.');
    expect(writes()).toEqual([{ method: 'DELETE', url: '/api/assets/1', body: undefined }]);
    await waitFor(() => expect(screen.queryByTestId('property')).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('Cancel and Escape close the dialog without deleting', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Flat, Adyar' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Flat, Adyar' }));
    fireEvent.keyDown(await screen.findByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(writes()).toEqual([]);
    expect(screen.getByTestId('property')).toBeTruthy();
  });

  it('a server error is shown inside the dialog', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Flat, Adyar' }));
    next = reply(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again later.', fields: [] } });
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    expect((await within(screen.getByRole('alertdialog')).findByRole('alert')).textContent).toBe(
      "We couldn't delete it. Something went wrong. Please try again later.",
    );
    expect(screen.getByTestId('property')).toBeTruthy();
  });
});
