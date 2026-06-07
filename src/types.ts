/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  amount: number;
  currency?: 'VND' | 'INR';
  category: string;
  note: string;
  wallet: string;
  synced: boolean;
  rawDateTime?: string; // Original, untampered Google Sheets date/time value (keeps formatting intact)
  startDate?: string;   // Column I: Ngày bắt đầu (YYYY-MM-DD or raw format)
  endDate?: string;     // Column J: Ngày kết thúc (YYYY-MM-DD or raw format)
}

export interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
  clientId: string;
  columnMapping: {
    date: string;       // e.g., "A"
    note: string;       // e.g., "B"
    type: string;       // e.g., "C"
    amount: string;     // e.g., "D"
    currency: string;   // e.g., "E"
    category: string;   // e.g., "F"
    wallet_from: string; // e.g., "G" (Tiền đi)
    wallet_to: string;   // e.g., "H" (Tiền đến)
    startDate: string;  // e.g., "I" (Ngày bắt đầu)
    endDate: string;    // e.g., "J" (Ngày kết thúc)
  };
  hasHeaders: boolean;
  transactionStartRow?: number; // Row index where transacton records start (e.g., 6)
  autoSync?: boolean;
}

export const CATEGORIES_EXPENSE = [
  'Ăn uống 🍔',
  'Di chuyển 🚗',
  'Mua sắm 🛍️',
  'Giải trí 🍿',
  'Sinh hoạt phí 🏠',
  'Sức khỏe 💊',
  'Giáo dục 📚',
  'Khác 🌀'
];

export const CATEGORIES_INCOME = [
  'Lương 💵',
  'Thưởng 💰',
  'Đầu tư 📈',
  'Quà tặng 🎁',
  'Phụ cấp 💳',
  'Khác ✨'
];

export const WALLETS = [
  'Tiền mặt 💵',
  'Tài khoản ngân hàng 💳',
  'Ví điện tử (Momo/ZaloPay) 📱',
  'Tiết kiệm 🐷'
];
