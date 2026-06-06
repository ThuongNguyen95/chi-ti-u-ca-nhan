/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction, CATEGORIES_EXPENSE, CATEGORIES_INCOME, WALLETS } from '../types';
import { Search, Filter, Trash2, CloudCheck, CloudOff, AlertCircle } from 'lucide-react';

interface TransactionsListProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
}

export default function TransactionsList({ transactions, onDeleteTransaction }: TransactionsListProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterWallet, setFilterWallet] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Helper formatting for currency
  const formatCurrency = (amount: number, type: 'income' | 'expense') => {
    const symbol = type === 'income' ? '+' : '-';
    const formatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
    return `${symbol}${formatted}`;
  };

  // Extract unique months from transactions for dropdown filtering
  const months = Array.from(
    new Set(transactions.map((t) => t.date.slice(0, 7))) // "YYYY-MM"
  ).sort((a, b) => b.localeCompare(a)); // Descending order standard

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      search.trim() === '' ||
      t.note.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType === 'all' || t.type === filterType;

    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;

    const matchesWallet = filterWallet === 'all' || t.wallet === filterWallet;

    const matchesMonth = filterMonth === 'all' || t.date.startsWith(filterMonth);

    return matchesSearch && matchesType && matchesCategory && matchesWallet && matchesMonth;
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6" id="tx-list-container">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-sans font-semibold text-lg text-gray-900 tracking-tight flex items-center gap-2">
          Sổ nhật ký thu chi
          <span className="text-xs bg-gray-100 text-gray-500 font-normal px-2.5 py-1 rounded-full">
            {filteredTransactions.length} bản ghi
          </span>
        </h3>

        {/* Clear Filter Indicators */}
        {(search || filterType !== 'all' || filterCategory !== 'all' || filterWallet !== 'all' || filterMonth !== 'all') && (
          <button
            onClick={() => {
              setSearch('');
              setFilterType('all');
              setFilterCategory('all');
              setFilterWallet('all');
              setFilterMonth('all');
            }}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline cursor-pointer self-start"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="space-y-3 mb-5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm nội dung, danh mục..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 text-xs rounded-xl border border-gray-100 focus:bg-white focus:border-emerald-500 focus:outline-hidden focus:ring-3 focus:ring-emerald-50 transition-all text-gray-700"
          />
        </div>

        {/* Dropdowns Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* Filter Type */}
          <div>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setFilterCategory('all'); // reset category as lists differs
              }}
              className="w-full px-2.5 py-1.8 bg-gray-50 text-xs text-gray-600 font-medium rounded-lg border border-gray-150 focus:outline-hidden"
            >
              <option value="all">Tất cả thu/chi</option>
              <option value="expense">Khoản Chi tiêu 💸</option>
              <option value="income">Khoản Thu nhập 💰</option>
            </select>
          </div>

          {/* Filter Category */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-2.5 py-1.8 bg-gray-50 text-xs text-gray-600 font-medium rounded-lg border border-gray-150 focus:outline-hidden"
            >
              <option value="all">Tất cả danh mục</option>
              {filterType === 'all'
                ? [...CATEGORIES_EXPENSE, ...CATEGORIES_INCOME].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))
                : (filterType === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
            </select>
          </div>

          {/* Filter Wallet */}
          <div>
            <select
              value={filterWallet}
              onChange={(e) => setFilterWallet(e.target.value)}
              className="w-full px-2.5 py-1.8 bg-gray-50 text-xs text-gray-600 font-medium rounded-lg border border-gray-150 focus:outline-hidden"
            >
              <option value="all">Tất cả ví/thẻ</option>
              {WALLETS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Month */}
          <div>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-2.5 py-1.8 bg-gray-50 text-xs text-gray-600 font-medium rounded-lg border border-gray-150 focus:outline-hidden"
            >
              <option value="all">Tất cả thời gian</option>
              {months.map((m) => {
                const [year, month] = m.split('-');
                return (
                  <option key={m} value={m}>
                    Tháng {month}/{year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions list Table/Card View */}
      <div className="overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-gray-150 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">Chưa có giao dịch nào khớp với bộ lọc</p>
            <p className="text-xs text-gray-400 mt-1">Sử dụng form bên trái để ghi thêm dữ liệu chi tiêu cá nhân.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {filteredTransactions.map((t) => {
              const isExpense = t.type === 'expense';
              return (
                <div
                  key={t.id}
                  id={`tx-item-${t.id}`}
                  className="group flex items-center justify-between p-3.5 bg-gray-50 hover:bg-emerald-50/20 rounded-xl border border-gray-100/70 hover:border-emerald-100 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    {/* Synchronized state Badge icon */}
                    <div className="relative">
                      {t.synced ? (
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 relative group/icon" title="Đã đồng bộ lên Google Sheets">
                          <CloudCheck className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-600 relative group/icon animate-pulse" title="Đang ở máy - chưa đồng bộ">
                          <CloudOff className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white text-gray-600 border border-gray-100">
                          {t.category}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {t.date}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {t.note || `Nhập từ ${t.wallet}`}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[11px] text-gray-400">Nguồn: {t.wallet}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-mono font-bold tracking-tight ${
                        isExpense ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatCurrency(t.amount, t.type)}
                    </span>
                    <button
                      type="button"
                      id={`tx-delete-btn-${t.id}`}
                      onClick={() => onDeleteTransaction(t.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title="Xóa giao dịch này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
