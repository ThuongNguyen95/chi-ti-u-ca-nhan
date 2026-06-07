/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar, PiggyBank, Plus, Bell, Trash2, CheckCircle, AlertTriangle, Sparkles, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface SavingsAccount {
  id: string;
  name: string;
  amount: number;
  currency: 'VND' | 'INR';
  startDate: string;
  maturityDate: string; // Date of expiration
  interestRate?: number; // Yearly interest e.g., 5.5%
  isWithdrawn: boolean;
}

interface SavingsManagerProps {
  onSavingsChange?: (savings: SavingsAccount[]) => void;
}

const LOCAL_STORAGE_SAVINGS_KEY = 'v_savings_accounts_term';

export default function SavingsManager({ onSavingsChange }: SavingsManagerProps) {
  const [savingsList, setSavingsList] = useState<SavingsAccount[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [currency, setCurrency] = useState<'VND' | 'INR'>('VND');
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load savings
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SAVINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSavingsList(parsed);
      if (onSavingsChange) onSavingsChange(parsed);
    } else {
      // Default sample savings account
      const samples: SavingsAccount[] = [
        {
          id: 'save-sample-1',
          name: 'Sổ tiết kiệm Vietcombank 6 Tháng',
          amount: 50000000,
          currency: 'VND',
          startDate: '2026-01-07',
          maturityDate: '2026-07-07',
          interestRate: 4.8,
          isWithdrawn: false,
        },
        {
          id: 'save-sample-2',
          name: 'Mua xe mới năm sau',
          amount: 15000000,
          currency: 'VND',
          startDate: '2025-06-01',
          maturityDate: '2026-06-01',
          interestRate: 5.2,
          isWithdrawn: false,
        }
      ];
      setSavingsList(samples);
      localStorage.setItem(LOCAL_STORAGE_SAVINGS_KEY, JSON.stringify(samples));
      if (onSavingsChange) onSavingsChange(samples);
    }
  }, []);

  const saveList = (updated: SavingsAccount[]) => {
    setSavingsList(updated);
    localStorage.setItem(LOCAL_STORAGE_SAVINGS_KEY, JSON.stringify(updated));
    if (onSavingsChange) onSavingsChange(updated);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên tài khoản/sổ tiết kiệm');
      return;
    }

    const parsedAmt = parseInt(amount, 10);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setErrorMsg('Vui lòng nhập số tiền gửi hợp lệ');
      return;
    }

    if (!maturityDate) {
      setErrorMsg('Vui lòng chọn ngày đáo hạn/hết hạn');
      return;
    }

    if (new Date(maturityDate) <= new Date(startDate)) {
      setErrorMsg('Ngày hết hạn phải sau ngày bắt đầu gửi');
      return;
    }

    const newAcc: SavingsAccount = {
      id: `save-${Date.now()}`,
      name: name.trim(),
      amount: parsedAmt,
      currency,
      startDate,
      maturityDate,
      interestRate: interestRate ? parseFloat(interestRate) : undefined,
      isWithdrawn: false,
    };

    const nextList = [newAcc, ...savingsList];
    saveList(nextList);

    // Reset Form
    setName('');
    setAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setMaturityDate('');
    setInterestRate('');
    setShowAddForm(false);
  };

  const handleWithdraw = (id: string) => {
    const confirmed = window.confirm('Quý khách xác nhận đã rút/tất toán số tiền tiết kiệm này về tài khoản chính? Trạng thái sẽ được đổi thành Đã Tất Toán.');
    if (!confirmed) return;

    const nextList = savingsList.map((s) => s.id === id ? { ...s, isWithdrawn: true } : s);
    saveList(nextList);
  };

  const handleDelete = (id: string) => {
    const confirmed = window.confirm('Có chắc chắn muốn xóa vĩnh viễn sổ tiết kiệm này khỏi ứng dụng?');
    if (!confirmed) return;

    const nextList = savingsList.filter((s) => s.id !== id);
    saveList(nextList);
  };

  // Check expired active accounts
  const todayStr = new Date().toISOString().split('T')[0];
  const expiredActiveAccounts = savingsList.filter(
    (s) => !s.isWithdrawn && s.maturityDate <= todayStr
  );

  const formatCurrency = (amt: number, curr: 'VND' | 'INR') => {
    if (curr === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 1,
      }).format(amt);
    } else {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(amt).replace(/₫/g, 'đ');
    }
  };

  const getDaysRemaining = (mature: string) => {
    const t = new Date(todayStr).getTime();
    const m = new Date(mature).getTime();
    const diff = m - t;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4" id="savings-manager-card">
      
      {/* Title & Add Actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-sans font-bold text-gray-900 text-md tracking-tight flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-emerald-600" />
          Tiết kiệm có thời hạn
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.8 rounded-xl border border-emerald-100 flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {showAddForm ? 'Hủy' : 'Thêm sổ mới'}
        </button>
      </div>

      {/* Global Notifications Alert Banner directly derived from Expiration date */}
      <AnimatePresence>
        {expiredActiveAccounts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-amber-50 text-amber-900 border border-amber-200/50 p-4 rounded-xl flex items-start gap-3 shadow-2xs"
            id="savings-expiry-notification"
          >
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 mt-0.5 animate-bounce">
              <Bell className="w-4 h-4" />
            </div>
            <div className="space-y-1.5 flex-1">
              <span className="text-xs font-bold block">Thông báo đáo hạn tiết kiệm!</span>
              <div className="text-[11px] text-amber-800 leading-relaxed font-medium">
                Quý khách có <span className="font-bold underline text-red-600">{expiredActiveAccounts.length} mục tiết kiệm</span> đã hết hạn gửi và đến thời điểm đáo hạn:
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {expiredActiveAccounts.map((acc) => (
                    <li key={acc.id}>
                      <span className="font-bold text-gray-900">{acc.name}</span>: <span className="font-mono text-red-700">{formatCurrency(acc.amount, acc.currency)}</span> (Ngày hết hạn: {acc.maturityDate})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adding Savings Account form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddAccount}
            className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3 overflow-hidden text-xs"
          >
            <div className="flex justify-between items-center pb-1 border-b border-gray-200">
              <span className="font-bold text-gray-800 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                Mở sổ tiết kiệm kỳ hạn mới
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrency('VND')}
                  className={`px-2 py-0.5 rounded font-bold ${currency === 'VND' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                >
                  đ
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('INR')}
                  className={`px-2 py-0.5 rounded font-bold ${currency === 'INR' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                >
                  ₹
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Tên sổ tiết kiệm / Mục tiêu</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Tiết kiệm BIDV 6 Tháng"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 bg-white rounded-lg border border-gray-250 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Số tiền gửi</label>
                  <input
                    type="number"
                    placeholder="Số tiền gửi"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-gray-250 font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Lãi suất (%/năm)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ví dụ: 4.8"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-gray-250 font-mono focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Ngày gửi</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-gray-250 font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Ngày đáo hạn / Hết hạn</label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-gray-250 font-mono focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <p className="text-[11px] font-semibold text-red-500 flex items-center gap-1 bg-red-50 py-1.5 px-3.5 rounded-lg border border-red-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Tạo Sổ Tiết Kiệm
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Savings checklist */}
      <div className="space-y-2.5">
        {savingsList.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Chưa có sổ tiết kiệm có thời hạn nào.</p>
        ) : (
          savingsList.map((acc) => {
            const daysLeft = getDaysRemaining(acc.maturityDate);
            const isExpired = daysLeft <= 0 && !acc.isWithdrawn;
            const statusClass = acc.isWithdrawn
              ? 'bg-gray-100 text-gray-400 line-through'
              : isExpired
              ? 'bg-red-50 border-red-200'
              : 'bg-emerald-50/10 border-gray-100';

            return (
              <div
                key={acc.id}
                className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-all duration-200 ${statusClass}`}
              >
                {/* Details */}
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-1.8 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{acc.name}</span>
                    {acc.isWithdrawn ? (
                      <span className="text-[9px] font-bold uppercase bg-gray-200 text-gray-500 px-2 py-0.5 rounded">
                        Đã tất toán
                      </span>
                    ) : isExpired ? (
                      <span className="text-[9px] font-bold uppercase bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">
                        Sổ đã Hết hạn
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Đang tích lũy
                      </span>
                    )}

                    {acc.interestRate && (
                      <span className="text-[9px] font-bold bg-amber-50 text-amber-800 px-1.8 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                        <TrendingUp className="w-2.5 h-2.5 text-amber-500" />
                        Lãi suất {acc.interestRate}%/năm
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500 text-[11px] font-medium pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-500" />
                      Kỳ hạn: {acc.startDate} → <span className="font-bold text-gray-700">{acc.maturityDate}</span>
                    </span>
                    {!acc.isWithdrawn && (
                      <span className={`font-semibold ${isExpired ? 'text-red-600 underline' : 'text-gray-600'}`}>
                        {isExpired ? 'Đã quá hạn đáo hạn!' : `Còn lại: ${daysLeft} ngày`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount / Action */}
                <div className="flex items-center justify-between md:justify-end gap-3.5 pt-2 md:pt-0 border-t md:border-none border-gray-100">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Tiền gửi</span>
                    <span className="font-mono font-bold text-gray-900 text-md">
                      {formatCurrency(acc.amount, acc.currency)}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    {!acc.isWithdrawn && (
                      <button
                        onClick={() => handleWithdraw(acc.id)}
                        className="p-1.8 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 cursor-pointer"
                        title="Tất toán sổ / Đóng tài khoản"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="p-1.8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 cursor-pointer"
                      title="Xóa sổ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
