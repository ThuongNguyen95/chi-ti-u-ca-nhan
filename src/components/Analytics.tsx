/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Transaction } from '../types';
import { PieChart, TrendingUp, TrendingDown, Wallet, Sparkles } from 'lucide-react';

interface AnalyticsProps {
  transactions: Transaction[];
}

export default function Analytics({ transactions }: AnalyticsProps) {
  const [activeCurrency, setActiveCurrency] = useState<'VND' | 'INR'>('VND');

  // Filter transactions based on active currency
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => (t.currency || 'VND') === activeCurrency);
  }, [transactions, activeCurrency]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((t) => {
      if (t.type === 'income') {
        income += t.amount;
      } else {
        expense += t.amount;
      }
    });

    const net = income - expense;
    const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

    return { income, expense, net, savingsRate };
  }, [filteredTransactions]);

  // Aggregate expenditures by category
  const categoryExpenses = useMemo(() => {
    const categories: Record<string, number> = {};
    let totalExpense = 0;

    filteredTransactions.forEach((t) => {
      if (t.type === 'expense') {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
        totalExpense += t.amount;
      }
    });

    return Object.entries(categories)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  // Beautiful SVG pie chart calculations
  const pieChartPaths = useMemo(() => {
    const list = categoryExpenses;
    if (list.length === 0) return [];

    let accumulatedPercentage = 0;
    const colors = [
      '#EF4444', // Red
      '#F59E0B', // Amber
      '#3B82F6', // Blue
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#06B6D4', // Cyan
      '#10B981', // Emerald
      '#6B7280', // Gray
    ];

    return list.map((item, index) => {
      const percentage = item.percentage;
      const startAngle = (accumulatedPercentage / 100) * 360;
      accumulatedPercentage += percentage;
      const endAngle = (accumulatedPercentage / 100) * 360;

      // Coordinate converter helper
      const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
          x: centerX + radius * Math.cos(angleInRadians),
          y: centerY + radius * Math.sin(angleInRadians),
        };
      };

      // Draw path elements
      const x = 100;
      const y = 100;
      const r = 80;
      const start = polarToCartesian(x, y, r, startAngle);
      const end = polarToCartesian(x, y, r, endAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

      let d = '';
      if (percentage === 100) {
        // Full circle
        d = `M ${x} ${y - r} A ${r} ${r} 0 1 1 ${x - 0.01} ${y - r} Z`;
      } else {
        d = [
          `M ${x} ${y}`,
          `L ${start.x} ${start.y}`,
          `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
          'Z',
        ].join(' ');
      }

      return {
        ...item,
        path: d,
        color: colors[index % colors.length],
      };
    });
  }, [categoryExpenses]);

  // Format currency dynamically
  const formatCurrency = (num: number) => {
    if (activeCurrency === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(num);
    } else {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(num).replace(/₫/g, 'đ');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6" id="analytics-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <h3 className="font-sans font-semibold text-lg text-gray-900 tracking-tight flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-600" />
            Phân tích & Thống kê tài chính
          </h3>
          {stats.savingsRate >= 30 && (
            <div className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 animate-fade-in flex-shrink-0">
              <Sparkles className="w-3 h-3" />
              Tiết kiệm tốt: {stats.savingsRate}%
            </div>
          )}
        </div>
        
        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-150 text-xs font-semibold self-start">
          <button
            type="button"
            onClick={() => setActiveCurrency('VND')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeCurrency === 'VND'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            VND đ
          </button>
          <button
            type="button"
            onClick={() => setActiveCurrency('INR')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeCurrency === 'INR'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            INR ₹
          </button>
        </div>
      </div>

      {/* Grid summarizing Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Income */}
        <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <TrendingUp className="w-4 h-4" />
            Tổng Thu Nhập
          </div>
          <p className="mt-2 text-lg font-mono font-bold text-emerald-700 tracking-tight">
            {formatCurrency(stats.income)}
          </p>
        </div>

        {/* Total Expense */}
        <div className="p-4 bg-rose-50/40 rounded-xl border border-rose-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <TrendingDown className="w-4 h-4" />
            Tổng Chi Tiêu
          </div>
          <p className="mt-2 text-lg font-mono font-bold text-red-600 tracking-tight">
            {formatCurrency(stats.expense)}
          </p>
        </div>

        {/* Balance Status */}
        <div className={`p-4 rounded-xl border ${
          stats.net >= 0
            ? 'bg-blue-50/40 border-blue-100 text-blue-700'
            : 'bg-amber-50/40 border-amber-100 text-amber-700'
        }`}>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Wallet className="w-4 h-4" />
            Tài Khoản Hiện Có
          </div>
          <p className="mt-2 text-lg font-mono font-bold tracking-tight">
            {formatCurrency(stats.net)}
          </p>
        </div>
      </div>

      {/* Visual Expense Category Breakdown */}
      <div className="border-t border-gray-100 pt-5">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Cơ cấu chi phí theo nhóm
        </h4>

        {categoryExpenses.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">
            Hãy bắt đầu ghi các khoản chi tiêu để kích hoạt biểu đồ phân tách.
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* SVG Interactive Pie view */}
            <div className="relative w-40 h-40 flex-shrink-0">
              <svg width="100%" height="100%" viewBox="0 0 200 200" className="transform -rotate-90">
                {pieChartPaths.map((item, idx) => (
                  <path
                    key={idx}
                    d={item.path}
                    fill={item.color}
                    className="hover:scale-102 hover:opacity-90 transition-transform origin-center cursor-pointer"
                    title={`${item.name}: ${item.percentage}%`}
                  />
                ))}
                {/* Visual donut hole overlay */}
                <circle cx="100" cy="100" r="50" fill="white" />
              </svg>
              {/* Dynamic center saving stat */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-400">Tiết kiệm</span>
                <span className="text-sm font-bold text-gray-800">{stats.savingsRate}%</span>
              </div>
            </div>

            {/* Structured Table representing category values */}
            <div className="w-full space-y-2.5">
              {pieChartPaths.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-gray-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 font-medium">{item.percentage}%</span>
                    <span className="font-mono text-gray-600 font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              ))}
              {categoryExpenses.length > 5 && (
                <div className="text-center text-[10px] text-gray-400 font-medium italic pt-1">
                  + {categoryExpenses.length - 5} nhóm chi tiêu khác nữa
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Savings Goal indicator */}
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-500 font-medium">Sức khỏe tài chính:</span>
        <span className={`font-semibold ${
          stats.savingsRate >= 40
            ? 'text-emerald-600'
            : stats.savingsRate >= 20
            ? 'text-blue-600'
            : stats.savingsRate >= 10
            ? 'text-amber-500'
            : 'text-rose-500'
        }`}>
          {stats.savingsRate >= 40
            ? 'Xuất sắc! Tiếp tục duy trì 💎'
            : stats.savingsRate >= 20
            ? 'An toàn. Đang đi đúng hướng 📈'
            : stats.savingsRate >= 10
            ? 'Cần lưu ý tích lũy thêm ⚠️'
            : 'Chi tiêu vượt quá định mức tích lũy 🚨'}
        </span>
      </div>
    </div>
  );
}
