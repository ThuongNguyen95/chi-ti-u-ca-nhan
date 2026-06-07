/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, SheetConfig } from '../types';

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
}

export async function fetchUserProfile(accessToken: string): Promise<UserProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  return response.json();
}

/**
 * Helper to turn various Google Sheets date-time string formats safely back to YYYY-MM-DD
 */
export function parseDateString(rawDate: string): string {
  const clean = rawDate.trim().split(' ')[0] || '';
  if (!clean) {
    return new Date().toISOString().split('T')[0];
  }

  // Check for DD/MM/YYYY or DD-MM-YYYY
  let match = clean.match(/^(\d{1,2})([/\-])(\d{1,2})\2(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[3].padStart(2, '0');
    const year = match[4];
    return `${year}-${month}-${day}`;
  }

  // Check for YYYY/MM/DD or YYYY-MM-DD
  match = clean.match(/^(\d{4})([/\-])(\d{1,2})\2(\d{1,2})$/);
  if (match) {
    const year = match[1];
    const month = match[3].padStart(2, '0');
    const day = match[4].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback: try parsing with JavaScript Date
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}

  return new Date().toISOString().split('T')[0];
}

/**
 * Appends a list of transactions to Google Sheets
 */
export async function appendTransactionsToSheet(
  accessToken: string,
  config: SheetConfig,
  transactions: Transaction[]
): Promise<{ success: boolean; appendedCount: number }> {
  // We'll group columns based on mappings
  // Default structure typically expects rows where columns map to date, type, amount, category, wallets, note.
  // Standard Sheets Append API accepts an array of rows
  const rows = transactions.map((t) => {
    // Generate a row based on column mappings.
    const rowData: any[] = [];
    const mappings = config.columnMapping;

    const colIndex = (col: string): number => {
      const char = col.trim().toUpperCase().charCodeAt(0);
      return char - 65; // 'A' -> 0, 'B' -> 1
    };

    // Fill row with placeholders
    const maxIndex = Math.max(
      colIndex(mappings.date),
      colIndex(mappings.note),
      colIndex(mappings.type),
      colIndex(mappings.amount),
      colIndex(mappings.currency),
      colIndex(mappings.category),
      colIndex(mappings.wallet_from),
      colIndex(mappings.wallet_to),
      mappings.startDate ? colIndex(mappings.startDate) : -1,
      mappings.endDate ? colIndex(mappings.endDate) : -1
    );

    for (let i = 0; i <= maxIndex; i++) {
      rowData.push('');
    }

    // Get original date-time format if existing, otherwise format YYYY-MM-DD to DD/MM/YYYY with current time
    let dateToWrite = t.rawDateTime;
    if (!dateToWrite) {
      const parts = t.date.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        dateToWrite = `${day}/${month}/${year} ${timeStr}`;
      } else {
        dateToWrite = t.date;
      }
    }

    // Assign appropriate values to designated columns matching your spreadsheet schema
    rowData[colIndex(mappings.date)] = dateToWrite;
    rowData[colIndex(mappings.note)] = t.note;
    rowData[colIndex(mappings.type)] = t.type === 'income' ? 'Thu' : 'Chi';
    rowData[colIndex(mappings.amount)] = t.type === 'expense' ? -t.amount : t.amount;
    rowData[colIndex(mappings.currency)] = t.currency || 'VND';
    rowData[colIndex(mappings.category)] = t.category;
    
    // Split wallets into spent-from (Tiền đi) and received-to (Tiền đến)
    if (t.type === 'expense') {
      rowData[colIndex(mappings.wallet_from)] = t.wallet;
      rowData[colIndex(mappings.wallet_to)] = '';
    } else {
      rowData[colIndex(mappings.wallet_from)] = '';
      rowData[colIndex(mappings.wallet_to)] = t.wallet;
    }

    if (mappings.startDate) {
      rowData[colIndex(mappings.startDate)] = t.startDate || '';
    }
    if (mappings.endDate) {
      rowData[colIndex(mappings.endDate)] = t.endDate || '';
    }

    return rowData;
  });

  const syncMethod = localStorage.getItem('gs_sync_method') || 'oauth';
  if (syncMethod === 'appsscript') {
    const scriptUrl = localStorage.getItem('gs_appsscript_url') || '';
    const scriptKey = localStorage.getItem('gs_appsscript_key') || '';
    if (!scriptUrl) throw new Error('Chưa cấu hình URL Google Apps Script.');

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'append',
        key: scriptKey,
        data: rows,
      }),
    });

    if (!response.ok) throw new Error('Không thể đồng bộ bổ sung qua Google Apps Script Web App.');
    const resData = await response.json();
    if (!resData.success) throw new Error(resData.error || 'Lỗi bổ sung dữ liệu tại Apps Script.');
    return {
      success: true,
      appendedCount: transactions.length,
    };
  }

  const range = `${config.sheetName}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: rows,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Không thể đồng bộ sang Google Sheets. Vặn lại Client ID hoặc Quyền.');
  }

  return {
    success: true,
    appendedCount: transactions.length,
  };
}

/**
 * Reads sheet values to analyze current headers and matching row counts
 */
export async function getSheetMetaData(
  accessToken: string,
  config: SheetConfig
): Promise<{ rowCount: number; headers: string[] }> {
  const range = `${config.sheetName}!A1:Z5`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errData = await response.json();
      detail = errData.error?.message || response.statusText;
    } catch (e) {
      detail = response.statusText;
    }
    throw new Error(`Không thể đọc cấu trúc bảng tính (Chi tiết: ${detail}). Hãy kiểm tra lại Spreadsheet ID hoặc tên Sheet Tab.`);
  }

  const data = await response.json();
  const rows = data.values || [];
  const headers = rows[0] || [];

  return {
    rowCount: rows.length,
    headers,
  };
}

/**
 * Helper to parse amount string from Google Sheets considering thousand and decimal separators of different locales
 */
export function parseAmountString(str: string, currency: 'VND' | 'INR' = 'VND'): number {
  let clean = str.trim();
  if (!clean) return 0;

  // Keep only digits, dots, commas, hyphens/minus
  clean = clean.replace(/[^0-9.,-]/g, '');
  if (!clean) return 0;

  const dots = (clean.match(/\./g) || []).length;
  const commas = (clean.match(/,/g) || []).length;

  if (dots > 1) {
    if (commas === 1) {
      const parts = clean.split(',');
      const val = parseFloat(parts[0].replace(/\./g, '') + '.' + parts[1]);
      return currency === 'VND' ? Math.round(val) : parseFloat(val.toFixed(2));
    }
    return Math.round(parseFloat(clean.replace(/\./g, '')));
  }

  if (commas > 1) {
    if (dots === 1) {
      const parts = clean.split('.');
      const val = parseFloat(parts[0].replace(/,/g, '') + '.' + parts[1]);
      return currency === 'VND' ? Math.round(val) : parseFloat(val.toFixed(2));
    }
    return Math.round(parseFloat(clean.replace(/,/g, '')));
  }

  if (dots === 1 && commas === 1) {
    const dotIdx = clean.indexOf('.');
    const commaIdx = clean.indexOf(',');
    if (commaIdx > dotIdx) {
      const parts = clean.split(',');
      const val = parseFloat(parts[0].replace(/\./g, '') + '.' + parts[1]);
      return currency === 'VND' ? Math.round(val) : parseFloat(val.toFixed(2));
    } else {
      const parts = clean.split('.');
      const val = parseFloat(parts[0].replace(/,/g, '') + '.' + parts[1]);
      return currency === 'VND' ? Math.round(val) : parseFloat(val.toFixed(2));
    }
  }

  if (dots === 1 && commas === 0) {
    const parts = clean.split('.');
    const before = parts[0];
    const after = parts[1];

    if (currency === 'VND') {
      if (after.length === 3) {
        return parseInt(before + after, 10);
      } else {
        return Math.round(parseFloat(clean));
      }
    } else {
      if (after.length === 3) {
        return parseInt(before + after, 10);
      } else {
        return parseFloat(parseFloat(clean).toFixed(2));
      }
    }
  }

  if (commas === 1 && dots === 0) {
    const parts = clean.split(',');
    const before = parts[0];
    const after = parts[1];

    if (after.length === 3) {
      return parseInt(before + after, 10);
    } else {
      const val = parseFloat(before + '.' + after);
      return currency === 'VND' ? Math.round(val) : parseFloat(val.toFixed(2));
    }
  }

  return Math.round(parseFloat(clean));
}

/**
 * Parses raw grid rows from Google Sheets into robust Application Transaction objects
 */
export function parseRowsToTransactions(rows: any[][], config: SheetConfig): Transaction[] {
  if (rows.length === 0) return [];

  const mappings = config.columnMapping;
  const colIndex = (col: string): number => {
    const char = col.trim().toUpperCase().charCodeAt(0);
    return char - 65; // 'A' -> 0, etc.
  };

  const idxDate = colIndex(mappings.date);
  const idxNote = colIndex(mappings.note);
  const idxType = colIndex(mappings.type);
  const idxAmount = colIndex(mappings.amount);
  const idxCurrency = colIndex(mappings.currency);
  const idxCategory = colIndex(mappings.category);
  const idxWalletFrom = colIndex(mappings.wallet_from);
  const idxWalletTo = colIndex(mappings.wallet_to);
  const idxStartDate = mappings.startDate ? colIndex(mappings.startDate) : -1;
  const idxEndDate = mappings.endDate ? colIndex(mappings.endDate) : -1;

  // Flexible Offset Start Row: if hasHeaders is true, we fallback to 6 (for our beautiful template with headers on row 5, trans start on row 6).
  // Otherwise, fallback to 2 or 1.
  const startRow = (config.transactionStartRow !== undefined ? config.transactionStartRow : (config.hasHeaders ? 6 : 1)) - 1;
  const transactions: Transaction[] = [];

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Read mapped columns safely, handle array bounds
    const rawDate = row[idxDate] !== undefined ? String(row[idxDate]) : '';
    const rawNote = row[idxNote] !== undefined ? String(row[idxNote]) : '';
    const rawType = row[idxType] !== undefined ? String(row[idxType]) : '';
    const rawAmount = row[idxAmount] !== undefined ? String(row[idxAmount]) : '';
    const rawCurrency = row[idxCurrency] !== undefined ? String(row[idxCurrency]) : '';
    const rawCategory = row[idxCategory] !== undefined ? String(row[idxCategory]) : '';
    const rawWalletFrom = row[idxWalletFrom] !== undefined ? String(row[idxWalletFrom]) : '';
    const rawWalletTo = row[idxWalletTo] !== undefined ? String(row[idxWalletTo]) : '';
    const rawStartDate = idxStartDate !== -1 && row[idxStartDate] !== undefined ? String(row[idxStartDate]) : '';
    const rawEndDate = idxEndDate !== -1 && row[idxEndDate] !== undefined ? String(row[idxEndDate]) : '';

    // Skip if crucial fields are empty
    if (!rawDate && !rawAmount) continue;

    // 1. Parsing date robustly (supporting dd/MM/yyyy or yyyy-MM-dd cleanly)
    const date = parseDateString(rawDate);

    // 2. Parse type
    const typeStr = rawType.trim().toLowerCase();
    const type: 'income' | 'expense' = (typeStr === 'thu' || typeStr.includes('thu nhập') || typeStr.includes('income')) ? 'income' : 'expense';

    // 3. Parse currency
    const currency: 'VND' | 'INR' = (rawCurrency.trim().toUpperCase() === 'INR' || rawCurrency.trim() === '₹') ? 'INR' : 'VND';

    // 4. Parse amount using the robust parser helper (support and convert negative values for expenses)
    const rawParsedAmount = parseAmountString(rawAmount, currency);
    const amount = Math.abs(rawParsedAmount);
    if (isNaN(amount) || amount === 0) continue;

    // 5. Parse category
    const category = rawCategory.trim() || (type === 'income' ? 'Khác ✨' : 'Khác 🌀');

    // 6. Parse wallet based on transaction type
    let wallet = '';
    if (type === 'expense') {
      wallet = rawWalletFrom.trim();
    } else {
      wallet = rawWalletTo.trim();
    }
    if (!wallet) {
      wallet = (rawWalletFrom || rawWalletTo || '').trim() || 'Tiền mặt 💵';
    }

    transactions.push({
      id: `sheet-${i}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 4)}`,
      date,
      type,
      amount,
      currency,
      category,
      note: rawNote.trim(),
      wallet,
      synced: true, // Mark as synced as it came from the spreadsheet
      rawDateTime: rawDate.trim(), // Cache original spreadsheet formatted date-time string
      startDate: rawStartDate.trim() || undefined,
      endDate: rawEndDate.trim() || undefined,
    });
  }

  return transactions;
}

/**
 * Fetches all transactions from Google Sheets and parses them back to Transaction objects
 */
export async function fetchTransactionsFromSheet(
  accessToken: string,
  config: SheetConfig
): Promise<Transaction[]> {
  const syncMethod = localStorage.getItem('gs_sync_method') || 'oauth';
  if (syncMethod === 'appsscript') {
    const scriptUrl = localStorage.getItem('gs_appsscript_url') || '';
    const scriptKey = localStorage.getItem('gs_appsscript_key') || '';
    if (!scriptUrl) throw new Error('Chưa cấu hình URL Google Apps Script.');

    const url = `${scriptUrl}?action=fetch&key=${encodeURIComponent(scriptKey)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Không thể đồng bộ qua Google Apps Script Web App.');
    
    const resData = await response.json();
    if (!resData.success) throw new Error(resData.error || 'Lỗi lấy dữ liệu tại Apps Script.');

    const rows = resData.values || [];
    return parseRowsToTransactions(rows, config);
  }

  const range = `${config.sheetName}!A1:Z2000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errData = await response.json();
      detail = errData.error?.message || response.statusText;
    } catch (e) {
      detail = response.statusText;
    }
    throw new Error(`Không thể tải dữ liệu tự động từ Sheets (Chi tiết: ${detail})`);
  }

  const data = await response.json();
  const rows = data.values || [];
  return parseRowsToTransactions(rows, config);
}

/**
 * Overwrites the entire Google Sheet tab (or everything below the headers) with the given transactions list.
 * This is crucial for synchronizing deletions and updates perfectly from the app.
 */
export async function overwriteSheetWithTransactions(
  accessToken: string,
  config: SheetConfig,
  transactions: Transaction[]
): Promise<{ success: boolean }> {
  const syncMethod = localStorage.getItem('gs_sync_method') || 'oauth';
  if (syncMethod === 'appsscript') {
    const scriptUrl = localStorage.getItem('gs_appsscript_url') || '';
    const scriptKey = localStorage.getItem('gs_appsscript_key') || '';
    if (!scriptUrl) throw new Error('Chưa cấu hình URL Google Apps Script.');

    const rows = mapTransactionsToRows(transactions, config);

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'push',
        key: scriptKey,
        data: rows,
      }),
    });

    if (!response.ok) throw new Error('Không thể đồng bộ lưu đè qua Google Apps Script Web App.');
    const resData = await response.json();
    if (!resData.success) throw new Error(resData.error || 'Lỗi lưu dữ liệu tại Apps Script.');
    return { success: true };
  }

  // Calculate mapped columns boundaries to avoid wiping out other formatting/columns on Google Sheet
  const mappings = config.columnMapping;
  const cols = [
    mappings.date,
    mappings.note,
    mappings.type,
    mappings.amount,
    mappings.currency,
    mappings.category,
    mappings.wallet_from,
    mappings.wallet_to,
    mappings.startDate,
    mappings.endDate
  ].map((c) => c ? c.trim().toUpperCase() : '').filter(Boolean);

  const minColumn = cols.reduce((min, curr) => (curr < min ? curr : min), 'Z');
  const maxColumn = cols.reduce((max, curr) => (curr > max ? curr : max), 'A');

  // Flexible Offset Start Row: prevent clearing summary blocks (e.g. Rows 1-5).
  // Fallback to startRow 6 for standard layouts with headers on Row 5, and transactions starting on Row 6.
  const writeStartRow = config.transactionStartRow !== undefined ? config.transactionStartRow : (config.hasHeaders ? 6 : 1);

  // 1. Clear existing data below headers or everything if no headers (within mapped column range only!)
  const clearRange = `${config.sheetName}!${minColumn}${writeStartRow}:${maxColumn}2000`;
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`;

  const clearResponse = await fetch(clearUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!clearResponse.ok) {
    const errData = await clearResponse.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Không thể xóa dữ liệu cũ trên Google Sheets.');
  }

  if (transactions.length === 0) {
    return { success: true };
  }

  const rows = mapTransactionsToRows(transactions, config);

  // 3. Write rows back to Google Sheets starting from the design range matching minColumn
  const writeRange = `${config.sheetName}!${minColumn}${writeStartRow}`;
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;

  const writeResponse = await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: rows,
    }),
  });

  if (!writeResponse.ok) {
    const errData = await writeResponse.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Không thể cập nhật danh sách giao dịch lên Google Sheets.');
  }

  return { success: true };
}

/**
 * Maps application Transaction list into physical table rows aligned with Google Sheet column mappings
 */
export function mapTransactionsToRows(transactions: Transaction[], config: SheetConfig): any[][] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const mappings = config.columnMapping;

  const colIndex = (col: string): number => {
    const char = col.trim().toUpperCase().charCodeAt(0);
    return char - 65;
  };

  const cols = [
    mappings.date,
    mappings.note,
    mappings.type,
    mappings.amount,
    mappings.currency,
    mappings.category,
    mappings.wallet_from,
    mappings.wallet_to,
    mappings.startDate,
    mappings.endDate
  ].map((c) => c ? c.trim().toUpperCase() : '').filter(Boolean);

  const minColumn = cols.reduce((min, curr) => (curr < min ? curr : min), 'Z');
  const maxColumn = cols.reduce((max, curr) => (curr > max ? curr : max), 'A');

  const minIndex = colIndex(minColumn);
  const maxIndex = colIndex(maxColumn);
  const getCellIndex = (col: string): number => {
    return colIndex(col) - minIndex;
  };

  return sorted.map((t) => {
    const rowData: any[] = [];
    const size = maxIndex - minIndex + 1;
    for (let i = 0; i < size; i++) {
      rowData.push('');
    }

    let dateToWrite = t.rawDateTime;
    if (!dateToWrite) {
      const parts = t.date.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        dateToWrite = `${day}/${month}/${year} ${timeStr}`;
      } else {
        dateToWrite = t.date;
      }
    }

    rowData[getCellIndex(mappings.date)] = dateToWrite;
    rowData[getCellIndex(mappings.note)] = t.note;
    rowData[getCellIndex(mappings.type)] = t.type === 'income' ? 'Thu' : 'Chi';
    rowData[getCellIndex(mappings.amount)] = t.type === 'expense' ? -t.amount : t.amount;
    rowData[getCellIndex(mappings.currency)] = t.currency || 'VND';
    rowData[getCellIndex(mappings.category)] = t.category;

    if (t.type === 'expense') {
      rowData[getCellIndex(mappings.wallet_from)] = t.wallet;
      rowData[getCellIndex(mappings.wallet_to)] = '';
    } else {
      rowData[getCellIndex(mappings.wallet_from)] = '';
      rowData[getCellIndex(mappings.wallet_to)] = t.wallet;
    }

    if (mappings.startDate) {
      rowData[getCellIndex(mappings.startDate)] = t.startDate || '';
    }
    if (mappings.endDate) {
      rowData[getCellIndex(mappings.endDate)] = t.endDate || '';
    }

    return rowData;
  });
}
