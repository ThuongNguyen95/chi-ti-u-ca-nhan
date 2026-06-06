/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note: string;
  wallet: string;
  synced: boolean;
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
  };
  hasHeaders: boolean;
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
