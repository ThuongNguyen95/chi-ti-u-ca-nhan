/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Transaction, CATEGORIES_EXPENSE, CATEGORIES_INCOME, WALLETS } from '../types';
import { PlusCircle, Info, Calendar, DollarSign, Wallet, Tag, FileText } from 'lucide-react';

interface TransactionFormProps {
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'synced'>) => void;
}

export default function TransactionForm({ onAddTransaction }: TransactionFormProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountInput, setAmountInput] = useState<string>('');
  const [currency, setCurrency] = useState<'VND' | 'INR'>('VND');
  const [category, setCategory] = useState<string>('');
  const [wallet, setWallet] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Pre-fill fields with smart defaults
  useEffect(() => {
    // Current local date in YYYY-MM-DD
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);

    setWallet(WALLETS[0]);
  }, []);

  // Update default category when type transitions
  useEffect(() => {
    const list = type === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;
    setCategory(list[0]);
  }, [type]);

  // Format money for visual guidance (VND or INR)
  const formatAmount = (value: string, cur: 'VND' | 'INR' = 'VND') => {
    const numeric = value.replace(/\D/g, '');
    if (!numeric) return '';
    if (cur === 'INR') {
      return new Intl.NumberFormat('en-IN').format(parseInt(numeric, 10));
    } else {
      return new Intl.NumberFormat('vi-VN').format(parseInt(numeric, 10));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setAmountInput(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmount = parseInt(amountInput, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg(`Vui lòng nhập số tiền hợp lệ lớn hơn 0 ${currency === 'INR' ? '₹' : 'đ'}`);
      return;
    }

    if (!date) {
      setErrorMsg('Vui lòng chọn ngày giao dịch');
      return;
    }

    onAddTransaction({
      date,
      type,
      amount: parsedAmount,
      currency,
      category,
      note: note.trim(),
      wallet
    });

    // Reset input fields, keeping wallet and date for fast batch logging
    setAmountInput('');
    setNote('');
  };

  const categoryList = type === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6" id="tx-form-container">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-sans font-semibold text-lg text-gray-900 tracking-tight flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-emerald-600" />
          Ghi chép giao dịch mới
        </h3>
        <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button
            type="button"
            id="type-expense-btn"
            onClick={() => setType('expense')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              type === 'expense'
                ? 'bg-red-50 text-red-600 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Chi tiêu 💸
          </button>
          <button
            type="button"
            id="type-income-btn"
            onClick={() => setType('income')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              type === 'income'
                ? 'bg-emerald-50 text-emerald-600 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Thu nhập 💰
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} id="tx-submit-form" className="space-y-4">
        {errorMsg && (
          <div className="bg-red-50 text-red-600 text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 font-medium border border-red-100 animate-pulse">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Amount Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Số tiền ({currency})
            </label>
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-150 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setCurrency('VND')}
                className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                  currency === 'VND'
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                VND (đ)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('INR')}
                className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                  currency === 'INR'
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                INR (₹)
              </button>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <span className="text-sm font-semibold">{currency === 'INR' ? '₹' : 'đ'}</span>
            </div>
            <input
              type="text"
              id="tx-amount-input"
              value={formatAmount(amountInput, currency)}
              onChange={handleAmountChange}
              placeholder="0"
              className="w-full pl-8 pr-12 py-3 bg-gray-50 focus:bg-white text-gray-900 font-mono text-xl font-bold rounded-xl border border-gray-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-hidden transition-all placeholder:text-gray-300"
              autoComplete="off"
              required
            />
            {amountInput && (
              <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold text-gray-400 font-mono animate-fade-in">
                {currency}
              </span>
            )}
          </div>
          {amountInput && (
            <div className="mt-1 text-xs text-gray-400 italic">
              Bằng chữ: <span className="font-medium text-emerald-600">{formatAmount(amountInput, currency)} {currency === 'INR' ? 'Rupees' : 'đồng'}</span>
            </div>
          )}
        </div>

        {/* Date, Category, Wallet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" /> Ngày giao dịch
            </label>
            <input
              type="date"
              id="tx-date-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 focus:bg-white text-gray-900 rounded-xl border border-gray-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-hidden transition-all text-sm font-medium"
              required
            />
          </div>

          {/* Wallet Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Wallet className="w-3 h-3 text-gray-400" /> Tài khoản / Ví
            </label>
            <select
              id="tx-wallet-select"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 focus:bg-white text-gray-900 rounded-xl border border-gray-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-hidden transition-all text-sm font-medium"
            >
              {WALLETS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Bubble Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Tag className="w-3 h-3 text-gray-400" /> Danh mục phân loại
          </label>
          <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 rounded-xl border border-gray-100 max-h-36 overflow-y-auto">
            {categoryList.map((cat) => {
              const matches = cat === category;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    matches
                      ? type === 'expense'
                        ? 'bg-red-500 text-white shadow-xs scale-102 font-semibold'
                        : 'bg-emerald-500 text-white shadow-xs scale-102 font-semibold'
                      : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-950 border border-gray-100'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Note Area */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <FileText className="w-3 h-3 text-gray-400" /> Diễn giải / Ghi chú
          </label>
          <input
            type="text"
            id="tx-note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Ăn trưa bún chả, Mua sữa cho bé..."
            className="w-full px-3.5 py-2.5 bg-gray-50 focus:bg-white text-gray-900 rounded-xl border border-gray-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-hidden transition-all text-sm placeholder:text-gray-400"
            maxLength={100}
            autoComplete="off"
          />
        </div>

        <button
          type="submit"
          id="tx-add-btn"
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 ${
            type === 'expense'
              ? 'bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-100 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-100 text-white'
          }`}
        >
          {type === 'expense' ? 'Ghi khoản chi 💸' : 'Ghi khoản thu 💰'}
        </button>
      </form>
    </div>
  );
}
