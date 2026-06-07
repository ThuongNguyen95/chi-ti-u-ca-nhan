/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Transaction, SheetConfig } from './types';
import TransactionForm from './components/TransactionForm';
import TransactionsList from './components/TransactionsList';
import Analytics from './components/Analytics';
import SheetsSync from './components/SheetsSync';
import SavingsManager from './components/SavingsManager';
import { Wallet, Cloud, BookOpen, Trash2, ShieldCheck, RefreshCw, Smartphone, Sparkles } from 'lucide-react';
import { appendTransactionsToSheet, fetchTransactionsFromSheet, overwriteSheetWithTransactions } from './utils/googleSheets';

const LOCAL_STORAGE_KEY = 'v_personal_expenses';
const CONFIG_STORAGE_KEY = 'v_sheets_sync_config';

const INITIAL_MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'mock-1',
    date: '2026-06-01',
    type: 'income',
    amount: 18000000,
    category: 'Lương 💵',
    wallet: 'Tài khoản ngân hàng 💳',
    note: 'Lương chuyển khoản tháng 6',
    synced: false,
  },
  {
    id: 'mock-2',
    date: '2026-06-01',
    type: 'expense',
    amount: 4500000,
    category: 'Sinh hoạt phí 🏠',
    wallet: 'Tài khoản ngân hàng 💳',
    note: 'Thanh toán tiền thuê nhà và dịch vụ',
    synced: false,
  },
  {
    id: 'mock-3',
    date: '2026-06-02',
    type: 'expense',
    amount: 850000,
    category: 'Ăn uống 🍔',
    wallet: 'Ví điện tử (Momo/ZaloPay) 📱',
    note: 'Đi siêu thị mua nguyên liệu tuần',
    synced: false,
  },
  {
    id: 'mock-4',
    date: '2026-06-03',
    type: 'expense',
    amount: 1200000,
    category: 'Mua sắm 🛍️',
    wallet: 'Tài khoản ngân hàng 💳',
    note: 'Mua đôi giày thể thao chạy bộ mới',
    synced: false,
  },
  {
    id: 'mock-5',
    date: '2026-06-04',
    type: 'income',
    amount: 500000,
    category: 'Thưởng 💰',
    wallet: 'Ví điện tử (Momo/ZaloPay) 📱',
    note: 'Thưởng KPI dự án tuần',
    synced: false,
  },
  {
    id: 'mock-6',
    date: '2026-06-05',
    type: 'expense',
    amount: 45000,
    category: 'Ăn uống 🍔',
    wallet: 'Tiền mặt 💵',
    note: 'Bún chả buổi trưa',
    synced: false,
  }
];

const DEFAULT_CONFIG: SheetConfig = {
  spreadsheetId: '1B18ue0ejdFaBItGo-VTnphOI_ADKGybMKU2r-pt5jxA',
  sheetName: 'Sheet1',
  clientId: '',
  columnMapping: {
    date: 'A',
    note: 'B',
    type: 'C',
    amount: 'D',
    currency: 'E',
    category: 'F',
    wallet_from: 'G',
    wallet_to: 'H'
  },
  hasHeaders: true,
  transactionStartRow: 6,
  autoSync: true
};

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [config, setConfig] = useState<SheetConfig>(DEFAULT_CONFIG);
  const [accessToken, setAccessToken] = useState<string>(() => localStorage.getItem('gs_access_token') || '');
  const [isPulling, setIsPulling] = useState(false);
  const [pullInfo, setPullInfo] = useState<string>('');

  // Load initial states
  useEffect(() => {
    const savedTxs = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedTxs) {
      setTransactions(JSON.parse(savedTxs));
    } else {
      setTransactions(INITIAL_MOCK_TRANSACTIONS);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_MOCK_TRANSACTIONS));
    }

    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  // Save transactions on modification
  const saveTransactions = (updated: Transaction[]) => {
    setTransactions(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  };

  const getDeletedSignatures = (): string[] => {
    try {
      const raw = localStorage.getItem('v_deleted_tx_signatures');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const addDeletedSignature = (t: Omit<Transaction, 'id' | 'synced'>) => {
    try {
      const sigs = getDeletedSignatures();
      const sig = `${t.date}_${t.type}_${t.amount}_${t.currency || 'VND'}_${t.note.trim().toLowerCase()}`;
      if (!sigs.includes(sig)) {
        sigs.push(sig);
        if (sigs.length > 1000) sigs.shift(); // Keep a safe historical depth
        localStorage.setItem('v_deleted_tx_signatures', JSON.stringify(sigs));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportTransactions = (importedTxs: Transaction[]) => {
    // Completely overwrite local transactions with imported ones from Google Sheets
    const updated = importedTxs.map((imp) => ({
      ...imp,
      id: imp.id || `sheet-tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      synced: true
    }));

    // Sort newest first
    updated.sort((a, b) => b.date.localeCompare(a.date));

    setTransactions(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return updated.length;
  };

  // Auto Pull from Google Sheets when connected and autoSync is enabled
  useEffect(() => {
    if (!accessToken || !config.autoSync || !config.spreadsheetId) return;

    const pullFromSheets = async () => {
      setIsPulling(true);
      setPullInfo('Đang tự động kiểm tra dữ liệu mới từ Google Sheets...');
      try {
        const fetched = await fetchTransactionsFromSheet(accessToken, config);
        const count = handleImportTransactions(fetched);
        setPullInfo(`Đồng bộ thành công: Sổ chi tiêu đã được cập nhật chính xác với ${count} giao dịch từ Google Sheets!`);
      } catch (err: any) {
        console.warn('Lỗi tự động tải dữ liệu từ Google Sheets:', err);
        setPullInfo('Không thể tự động tải dữ liệu từ Google Sheets.');
      } finally {
        setIsPulling(false);
        // Clear status alert after 5s
        setTimeout(() => {
          setPullInfo('');
        }, 5000);
      }
    };

    pullFromSheets();

    // Check periodically for updates on Google Sheets every 60 seconds
    const interval = setInterval(pullFromSheets, 60000);
    return () => clearInterval(interval);
  }, [accessToken, config.autoSync, config.spreadsheetId, config.sheetName]);

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id' | 'synced'>) => {
    const fresh: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      synced: false
    };
    
    // Save locally first
    const nextList = [fresh, ...transactions];
    saveTransactions(nextList);

    // If autoSync is enabled and connected, append to Google Sheets immediately
    if (config.autoSync && accessToken) {
      try {
        const res = await appendTransactionsToSheet(accessToken, config, [fresh]);
        if (res.success) {
          setTransactions((prev) => {
            const updated = prev.map((t) => t.id === fresh.id ? { ...t, synced: true } : t);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
          setPullInfo('Đã tự động đồng bộ giao dịch mới lên Google Sheets!');
          setTimeout(() => setPullInfo(''), 3000);
        }
      } catch (err) {
        console.error('Không thể tự động đồng bộ lên Google Sheets:', err);
      }
    }
  };

  const handleTwoWaySync = async (localList: Transaction[] = transactions): Promise<Transaction[]> => {
    if (!accessToken || !config.spreadsheetId) {
      throw new Error('Vui lòng kết nối tài khoản Google trước.');
    }

    // Overwrite sheet with the current robust local list directly!
    // Since Google Sheets is the master directory, having the app direct write ensures perfect sync of deletions, edits, or ordering.
    await overwriteSheetWithTransactions(accessToken, config, localList);

    // Save and mark as synced locally
    const syncedList = localList.map((t) => ({ ...t, synced: true }));
    setTransactions(syncedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(syncedList));

    return syncedList;
  };

  const handleDeleteTransaction = async (id: string) => {
    const confirmed = window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn giao dịch này khỏi sổ theo dõi không?');
    if (!confirmed) return;

    const toDelete = transactions.find((t) => t.id === id);
    if (toDelete) {
      addDeletedSignature(toDelete);
    }

    const nextList = transactions.filter((t) => t.id !== id);
    saveTransactions(nextList);

    // Auto-sync deletion if enabled
    if (config.autoSync && accessToken) {
      try {
        setPullInfo('Đang tự động xóa và đồng bộ hai chiều cùng Google Sheets...');
        await handleTwoWaySync(nextList);
        setPullInfo('Đã tự động đồng bộ thay đổi (xóa) trên Google Sheets!');
        setTimeout(() => setPullInfo(''), 3000);
      } catch (err: any) {
        console.error('Auto sync deletion failed:', err);
        setPullInfo(`Lỗi tự động xóa: ${err.message || ''}`);
        setTimeout(() => setPullInfo(''), 4000);
      }
    }
  };

  const handleEditTransaction = async (updatedTx: Transaction) => {
    const oldTx = transactions.find((t) => t.id === updatedTx.id);
    if (oldTx) {
      addDeletedSignature(oldTx);
    }

    const nextList = transactions.map((t) => t.id === updatedTx.id ? updatedTx : t);
    saveTransactions(nextList);

    // Auto-sync edit if enabled and connected
    if (config.autoSync && accessToken) {
      try {
        setPullInfo('Đang đồng bộ giao dịch được chỉnh sửa và đồng bộ hai chiều...');
        await handleTwoWaySync(nextList);
        setPullInfo('Đã tự động cập nhật và đồng bộ chỉnh sửa thành công!');
        setTimeout(() => setPullInfo(''), 3000);
      } catch (err: any) {
        console.error('Auto sync edit failed:', err);
        setPullInfo(`Lỗi đồng bộ chỉnh sửa: ${err.message || ''}`);
        setTimeout(() => setPullInfo(''), 4000);
      }
    }
  };

  const handleMarkTransactionsSynced = (ids: string[]) => {
    const nextList = transactions.map((t) => {
      if (ids.includes(t.id)) {
        return { ...t, synced: true };
      }
      return t;
    });
    saveTransactions(nextList);
  };

  const handleChangeConfig = (newConfig: SheetConfig) => {
    setConfig(newConfig);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
  };

  const handleResetToMock = () => {
    const confirmed = window.confirm('Lưu ý: Thao tác này sẽ xóa mọi dữ liệu ghi chép hiện có của bạn trên thiết bị để tải lại dữ liệu mẫu. Xác nhận?');
    if (!confirmed) return;

    saveTransactions(INITIAL_MOCK_TRANSACTIONS);
  };

  // Divide unsynced entries
  const unsyncedTransactions = transactions.filter((t) => !t.synced);

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8 border-t-4 border-emerald-600" id="main-applet">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Global Header Banner */}
        <header className="bg-white rounded-2xl border border-gray-100 shadow-2xs p-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden" id="applet-header">
          {/* Subtle background visual flair */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full filter blur-xl pointer-events-none" />

          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shadow-2xs">
              <Wallet className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-sans font-bold text-xl text-gray-900 tracking-tight">
                  Quản Lý Sổ Chi Tiêu Cá Nhân
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-50 text-emerald-700 px-2.1 py-0.5 rounded-full border border-emerald-100">
                  Lite App
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 font-medium">
                Thống kê chi tiêu trực quan & Đồng bộ trực tiếp lên mẫu Google Sheets của bạn.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleResetToMock}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 text-xs font-semibold rounded-xl transition-all border border-gray-150 flex items-center gap-1 cursor-pointer"
              title="Khôi phục lại dữ liệu mẫu"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tải lại mẫu
            </button>
            <div className="bg-emerald-50/50 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 border border-emerald-100">
              <Smartphone className="w-3.5 h-3.5" />
              Android Sync Ready
            </div>
          </div>
        </header>

        {/* Auto Sync Banner Indicator */}
        {accessToken && config.autoSync && (
          <div className="bg-emerald-50 text-emerald-800 text-[11px] px-4 py-2.5 rounded-xl border border-emerald-100 flex items-center justify-between gap-2 shadow-2xs animate-fade-in font-medium">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>
                {pullInfo || 'Đồng bộ tự động hai chiều : Đang hoạt động thông suốt (Kiểm tra cập nhật mỗi phút)'}
              </span>
            </div>
            {isPulling && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 flex-shrink-0" />
            )}
          </div>
        )}

        {/* Bento Grid Application Body Dashboard */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-hub">

          {/* LEFT PANEL: Log entry form (span-4) */}
          <div className="lg:col-span-4 space-y-6">
            <TransactionForm onAddTransaction={handleAddTransaction} />
            <SavingsManager />
            <SheetsSync
              config={config}
              onChangeConfig={handleChangeConfig}
              transactions={transactions}
              unsyncedTransactions={unsyncedTransactions}
              onMarkTransactionsSynced={handleMarkTransactionsSynced}
              accessToken={accessToken}
              setAccessToken={setAccessToken}
              onImportTransactions={handleImportTransactions}
              onTwoWaySync={handleTwoWaySync}
            />
          </div>

          {/* RIGHT PANEL: Analytics dashboards & Transaction Logs (span-8) */}
          <div className="lg:col-span-8 space-y-6">
            <Analytics transactions={transactions} />
            <TransactionsList
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransaction}
              onEditTransaction={handleEditTransaction}
            />
          </div>

        </main>

        {/* Applet Footer branding credits */}
        <footer className="text-center py-6 text-xs text-gray-400 font-medium" id="applet-footer">
          <p>© 2026 Quản Lý Chi Tiêu Cá Nhân · Đồng bộ Google Sheets APIs bằng tài khoản của bạn</p>
        </footer>

      </div>
    </div>
  );
}
