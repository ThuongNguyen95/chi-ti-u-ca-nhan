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
      colIndex(mappings.wallet_to)
    );

    for (let i = 0; i <= maxIndex; i++) {
      rowData.push('');
    }

    // Get current time string to append along with t.date for "Thời gian" precision
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const fullDateTime = `${t.date} ${timeStr}`;

    // Assign appropriate values to designated columns matching your spreadsheet schema
    rowData[colIndex(mappings.date)] = fullDateTime;
    rowData[colIndex(mappings.note)] = t.note;
    rowData[colIndex(mappings.type)] = t.type === 'income' ? 'Thu nhập' : 'Chi tiêu';
    rowData[colIndex(mappings.amount)] = t.amount;
    rowData[colIndex(mappings.currency)] = 'VND';
    rowData[colIndex(mappings.category)] = t.category;
    
    // Split wallets into spent-from (Tiền đi) and received-to (Tiền đến)
    if (t.type === 'expense') {
      rowData[colIndex(mappings.wallet_from)] = t.wallet;
      rowData[colIndex(mappings.wallet_to)] = '';
    } else {
      rowData[colIndex(mappings.wallet_from)] = '';
      rowData[colIndex(mappings.wallet_to)] = t.wallet;
    }

    return rowData;
  });

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
