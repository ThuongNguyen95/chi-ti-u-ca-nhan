/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SheetConfig, Transaction } from '../types';
import { fetchUserProfile, appendTransactionsToSheet, getSheetMetaData, fetchTransactionsFromSheet, UserProfile, overwriteSheetWithTransactions } from '../utils/googleSheets';
import { Cloud, Lock, ShieldCheck, Check, LogOut, Settings2, HelpCircle, ToggleLeft, Copy, Sliders, RefreshCw, Key, User, BookOpen } from 'lucide-react';

interface SheetsSyncProps {
  config: SheetConfig;
  onChangeConfig: (newConfig: SheetConfig) => void;
  transactions: Transaction[];
  unsyncedTransactions: Transaction[];
  onMarkTransactionsSynced: (ids: string[]) => void;
  accessToken: string;
  setAccessToken: (token: string) => void;
  onImportTransactions: (imported: Transaction[]) => number;
  onTwoWaySync: (localList?: Transaction[]) => Promise<Transaction[]>;
}

export default function SheetsSync({
  config,
  onChangeConfig,
  transactions,
  unsyncedTransactions,
  onMarkTransactionsSynced,
  accessToken,
  setAccessToken,
  onImportTransactions,
  onTwoWaySync,
}: SheetsSyncProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'err'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [currentOrigin, setCurrentOrigin] = useState('');

  // App Script persistent login States
  const [syncMethod, setSyncMethod] = useState<'oauth' | 'appsscript'>(() => {
    return (localStorage.getItem('gs_sync_method') as 'oauth' | 'appsscript') || 'oauth';
  });
  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('gs_appsscript_url') || '');
  const [scriptKey, setScriptKey] = useState(() => localStorage.getItem('gs_appsscript_key') || '');
  const [isAppsScriptLoggedIn, setIsAppsScriptLoggedIn] = useState(() => {
    return !!localStorage.getItem('gs_appsscript_url') && !!localStorage.getItem('gs_appsscript_key');
  });

  useEffect(() => {
    setCurrentOrigin(window.location.origin);
  }, []);

  // Try to load user profile if token already exists on load
  useEffect(() => {
    if (accessToken && syncMethod === 'oauth') {
      setIsLoading(true);
      fetchUserProfile(accessToken)
        .then((profile) => {
          setUserProfile(profile);
          localStorage.setItem('gs_access_token', accessToken);
        })
        .catch(async (err) => {
          console.error('Initial token load failed:', err);
          try {
            if (config.spreadsheetId) {
              await getSheetMetaData(accessToken, config);
            }
            setUserProfile({
              name: 'Tài khoản Playground',
              email: 'Chỉ có quyền Google Sheets',
              picture: '',
            });
          } catch (metaErr) {
            console.error('Sheet metadata check also failed:', metaErr);
            handleLogout();
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [accessToken, syncMethod]);

  // Handle Client-side popup redirection messaging
  useEffect(() => {
    const handleGoogleCallback = (event: MessageEvent) => {
      if (!event.origin.includes('.run.app') && !event.origin.includes('localhost') && event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'OAUTH_TOKEN' && event.data?.hash) {
        const params = new URLSearchParams(event.data.hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          setAccessToken(token);
          setSyncMethod('oauth');
          localStorage.setItem('gs_sync_method', 'oauth');
          setSyncMessage({ type: 'success', text: 'Đăng nhập Google thành công!' });
        } else {
          setSyncMessage({ type: 'err', text: 'Không tìm thấy Access Token trong phản hồi từ Google.' });
        }
      }
    };

    window.addEventListener('message', handleGoogleCallback);
    return () => window.removeEventListener('message', handleGoogleCallback);
  }, [setAccessToken]);

  const handleLogout = () => {
    setAccessToken('');
    setUserProfile(null);
    localStorage.removeItem('gs_access_token');
    
    // Apps script reset
    localStorage.removeItem('gs_appsscript_url');
    localStorage.removeItem('gs_appsscript_key');
    setIsAppsScriptLoggedIn(false);
    setScriptUrl('');
    setScriptKey('');

    setSyncMessage(null);
  };

  const handleGoogleAuthPopup = () => {
    setSyncMessage(null);
    if (!config.clientId) {
      setSyncMessage({
        type: 'err',
        text: 'Vui lòng điền Google OAuth Client ID trong mục cấu hình trước khi kết nối.',
      });
      setShowAdvanced(true);
      return;
    }

    const redirectUri = `${window.location.origin}/oauth_callback.html`;
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(config.clientId.trim())}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `include_granted_scopes=true&` +
      `state=sheets_sync_auth`;

    const width = 550;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const authWindow = window.open(
      authUrl,
      'google_oauth_popup',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
    );

    if (!authWindow) {
      setSyncMessage({
        type: 'err',
        text: 'Popup bị chặn bởi trình duyệt. Vui lòng cho phép hiện popup để tiếp tục đăng nhập Google.',
      });
    }
  };

  const handleAppsScriptLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setSyncMessage(null);

    if (!scriptUrl.trim()) {
      setSyncMessage({ type: 'err', text: 'Vui lòng nhập Đường dẫn Web App (Tài khoản).' });
      return;
    }

    if (!scriptKey.trim()) {
      setSyncMessage({ type: 'err', text: 'Vui lòng nhập Mật khẩu bảo mật.' });
      return;
    }

    setIsLoading(true);
    // Test fetch transactions
    const testUrl = `${scriptUrl.trim()}?action=fetch&key=${encodeURIComponent(scriptKey.trim())}`;
    
    fetch(testUrl)
      .then(res => {
         if (!res.ok) throw new Error('Không thể kết nối đến Apps Script Web App.');
         return res.json();
      })
      .then(data => {
         if (data && data.success === false) {
           throw new Error(data.error || 'Mật khẩu bảo mật không khớp.');
         }
         // Save credentials
         localStorage.setItem('gs_sync_method', 'appsscript');
         localStorage.setItem('gs_appsscript_url', scriptUrl.trim());
         localStorage.setItem('gs_appsscript_key', scriptKey.trim());
         setSyncMethod('appsscript');
         setIsAppsScriptLoggedIn(true);
         setSyncMessage({ type: 'success', text: 'Đăng nhập Mật Khẩu qua Google Apps Script thành công! Trình trạng hoạt động: Ổn định vĩnh viễn.' });
      })
      .catch((err) => {
         console.error(err);
         setSyncMessage({ type: 'err', text: `Đăng nhập thất bại: ${err.message || 'Kiểm tra lại đường dẫn/mật khẩu.'}` });
      })
      .finally(() => setIsLoading(false));
  };

  const sanitizeAccessToken = (input: string): string => {
    let clean = input.trim();
    if (clean.startsWith('{')) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.access_token) {
          return parsed.access_token.trim();
        }
      } catch (e) {}
    }
    if (clean.includes('access_token=')) {
      try {
        const match = clean.match(/access_token=([^&]+)/);
        if (match && match[1]) {
          return decodeURIComponent(match[1].trim());
        }
      } catch (e) {}
    }
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.substring(1, clean.length - 1).trim();
    }
    return clean;
  };

  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    setIsLoading(true);
    setSyncMessage(null);

    const token = sanitizeAccessToken(manualToken);

    try {
      const profile = await fetchUserProfile(token);
      setUserProfile(profile);
      setAccessToken(token);
      setSyncMethod('oauth');
      localStorage.setItem('gs_sync_method', 'oauth');
      localStorage.setItem('gs_access_token', token);
      setManualToken('');
      setSyncMessage({ type: 'success', text: 'Nhập Token thủ công thành công!' });
    } catch (err) {
      console.warn('Không lấy được profile, thử kiểm tra quyền truy cập Sheet:', err);
      try {
        if (config.spreadsheetId) {
          await getSheetMetaData(token, config);
        }
        setUserProfile({
          name: 'Tài khoản Playground',
          email: 'Chỉ có quyền Google Sheets',
          picture: '',
        });
        setAccessToken(token);
        setSyncMethod('oauth');
        localStorage.setItem('gs_sync_method', 'oauth');
        localStorage.setItem('gs_access_token', token);
        setManualToken('');
        setSyncMessage({
          type: 'success',
          text: config.spreadsheetId 
            ? 'Nhập Token thành công! (Quyền truy cập Sheets hợp lệ)' 
            : 'Nhập Token thành công! Hãy điền thêm Spreadsheet ID bên dưới để sẵn sàng đồng bộ.',
        });
      } catch (sheetErr: any) {
        console.error('Quyền truy cập Sheet thất bại:', sheetErr);
        setSyncMessage({
          type: 'err',
          text: `Token không hợp lệ hoặc không có quyền truy cập bảng tính này. Lỗi: ${sheetErr.message || ''}`,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncToSheets = async () => {
    const isScript = syncMethod === 'appsscript';
    if (!accessToken && !isScript) {
      setSyncMessage({ type: 'err', text: 'Vui lòng kết nối tài khoản hoặc cấu hình Apps Script trước.' });
      return;
    }

    setIsLoading(true);
    setSyncMessage(null);

    try {
      if (!isScript) {
        await getSheetMetaData(accessToken, config);
      }
      const syncedList = await onTwoWaySync();
      setSyncMessage({
        type: 'success',
        text: `Đồng bộ hai chiều hoàn tất thành công! Toàn bộ ${syncedList.length} giao dịch hiện đã khớp dữ liệu và được bảo toàn 100% trên cả thiết bị và bản gốc Google Sheets.`,
      });
    } catch (error: any) {
      console.error('Sync failed:', error);
      setSyncMessage({
        type: 'err',
        text: error.message || 'Lỗi đồng bộ. Hãy kiểm tra cài đặt chia sẻ hoặc mật khẩu bảo mật.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullFromSheets = async () => {
    const isScript = syncMethod === 'appsscript';
    if (!accessToken && !isScript) {
      setSyncMessage({ type: 'err', text: 'Vui lòng kết nối tài khoản hoặc cấu hình Apps Script trước.' });
      return;
    }

    setIsLoading(true);
    setSyncMessage(null);

    try {
      const fetched = await fetchTransactionsFromSheet(accessToken, config);
      const addedCount = onImportTransactions(fetched);
      setSyncMessage({
        type: 'success',
        text: `Đã tải đồng bộ thành công ${addedCount} giao dịch từ Google Sheets về ứng dụng. Toàn bộ dữ liệu cục bộ đã được cập nhật chính xác tuyệt đối theo file Google Sheets gốc của bạn!`,
      });
    } catch (error: any) {
      console.error('Pull failed:', error);
      setSyncMessage({
        type: 'err',
        text: error.message || 'Lỗi tải dữ liệu. Hãy kiểm tra cài đặt chia sẻ hoặc mật khẩu bảo mật.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép vào bộ nhớ tạm!');
  };

  const appScriptSetupCode = `// Google Apps Script - Sổ chi tiêu Cá Nhân 🐷
// Hướng dẫn: Mở Google Sheet > Tiện ích mở rộng > Apps Script > Dán đè mã bên dưới vào và chọn Triển khai dưới dạng Web App!
var SECURITY_KEY = "Mật_Khẩu_Của_Bạn"; // Thay mật khẩu bảo mật của riêng bạn ở đây

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var action = e.parameter.action;
  var key = e.parameter.key;
  
  if (e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      if (body.key) key = body.key;
      if (body.action) action = body.action;
    } catch(err) {}
  }
  
  if (key !== SECURITY_KEY) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sai Mật khẩu bảo mật!" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  if (action === "fetch") {
    var rows = sheet.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify({ success: true, values: rows }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "push") {
    try {
      var body = JSON.parse(e.postData.contents);
      var rowsToSave = body.data;
      var startRow = 6;
      if (sheet.getLastRow() >= startRow) {
        sheet.getRange(startRow, 1, sheet.getLastRow() - startRow + 1, sheet.getLastColumn()).clearContent();
      }
      if (rowsToSave && rowsToSave.length > 0) {
        sheet.getRange(startRow, 1, rowsToSave.length, rowsToSave[0].length).setValues(rowsToSave);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "append") {
    try {
      var body = JSON.parse(e.postData.contents);
      var rowsToAppend = body.data;
      if (rowsToAppend && rowsToAppend.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Hành động khách hàng không hợp lệ!" }))
                       .setMimeType(ContentService.MimeType.JSON);
}`;

  const hasActiveSession = (syncMethod === 'oauth' && !!accessToken) || (syncMethod === 'appsscript' && isAppsScriptLoggedIn);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5" id="sheets-sync-container">
      <div className="flex items-center justify-between">
        <h3 className="font-sans font-semibold text-lg text-gray-900 tracking-tight flex items-center gap-2">
          <Cloud className="w-5 h-5 text-emerald-600 animate-pulse" />
          Đồng bộ Google Sheets
        </h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-gray-50 rounded-lg transition-all border border-gray-100 cursor-pointer"
          title="Thiết lập liên kết nâng cao"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Synchronize Message Banner */}
      {syncMessage && (
        <div
          className={`text-xs py-3 px-3.5 rounded-xl font-medium border flex items-start gap-2 ${
            syncMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="flex-1">{syncMessage.text}</p>
        </div>
      )}

      {/* METHOD CHOOSE TAB BAR IF NOT LOGGED IN */}
      {!hasActiveSession && (
        <div className="flex bg-gray-50/70 p-1 rounded-xl border border-gray-100 gap-1 text-xs">
          <button
            onClick={() => {
               setSyncMethod('appsscript');
               localStorage.setItem('gs_sync_method', 'appsscript');
               setSyncMessage(null);
            }}
            className={`flex-1 py-2 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${syncMethod === 'appsscript' ? 'bg-white text-gray-900 shadow-xs border border-gray-100' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <Key className="w-3.5 h-3.5 text-amber-550" />
            Tài Khoản & Mật Khẩu
          </button>
          <button
            onClick={() => {
               setSyncMethod('oauth');
               localStorage.setItem('gs_sync_method', 'oauth');
               setSyncMessage(null);
            }}
            className={`flex-1 py-2 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${syncMethod === 'oauth' ? 'bg-white text-gray-900 shadow-xs border border-gray-100' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <User className="w-3.5 h-3.5 text-blue-550" />
            Google Account (OAuth)
          </button>
        </div>
      )}

      {/* RENDER ACTIVE LOGIN METHOD PORTALS */}
      {!hasActiveSession ? (
        syncMethod === 'appsscript' ? (
          /* APPS SCRIPT WEB APP PASSWORD FLOW FORM */
          <form onSubmit={handleAppsScriptLogin} className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 space-y-4">
            <div className="text-center pb-2 border-b border-gray-150">
              <h4 className="text-xs font-bold text-gray-700 uppercase flex items-center justify-center gap-1.5">
                <Key className="w-4 h-4 text-emerald-600 animate-pulse" />
                Đăng nhập ổn định tuyệt đối (Dành cho Android APK / Điện thoại)
              </h4>
              <p className="text-[10px] text-gray-450 mt-1 max-w-[270px] mx-auto leading-relaxed font-semibold">
                Sử dụng kết nối Google Apps Script để tránh hết hạn Token (không bao giờ bị đăng xuất). Hoàn hảo cho thiết bị Android, iOS, hoặc Web.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                  Đường dẫn Web App (Tài khoản)
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  required
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg placeholder-gray-300 font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                  Mật khẩu bảo mật
                </label>
                <input
                  type="password"
                  placeholder="Nhập SECURITY_KEY bạn cấu hình"
                  required
                  value={scriptKey}
                  onChange={(e) => setScriptKey(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-hidden"
                />
              </div>
            </div>

            <button
               type="submit"
               disabled={isLoading}
               className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
               {isLoading ? 'Đang kiểm tra kết nối...' : 'Đăng nhập & Duy trì kết nối vĩnh viễn 🔑'}
            </button>

            {/* Help install collapsible code */}
            <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 text-[10px] text-amber-900 space-y-1.5 leading-relaxed font-semibold">
               <span className="font-bold flex items-center gap-1.5">
                 <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                 Cách cài đặt mã Apps Script trên Google Sheet:
               </span>
               <ol className="list-decimal list-inside space-y-1">
                 <li>Mở file Google Sheet của bạn trên máy tính</li>
                 <li>Chọn menu <b>Tiện ích mở rộng (Extensions)</b> &gt; <b>Apps Script</b></li>
                 <li>Dán đè tất cả mã script hỗ trợ và đổi mật khẩu bất kỳ</li>
                 <li>Nhấn <b>Triển khai (Deploy)</b> &gt; <b>Tạo phiên bản triển khai mới</b></li>
                 <li>Chọn loại: <b>Ứng dụng Web (Web App)</b>, phân quyền: <b>Bất kỳ ai (Anyone)</b> rồi nhấn Triển khai.</li>
                 <li>Copy link Web App sinh ra dán vào ô "Web App" bên trên và đăng nhập!</li>
               </ol>
               <button
                 type="button"
                 onClick={() => copyToClipboard(appScriptSetupCode)}
                 className="mt-1 w-full py-1.5 bg-white text-[10px] font-bold text-emerald-700 hover:text-white border border-emerald-200 hover:bg-emerald-600 rounded-md transition-all flex items-center justify-center gap-1.5"
               >
                 <Copy className="w-3.5 h-3.5" />
                 Copy Đoạn Mã Apps Script Mẫu
               </button>
            </div>
          </form>
        ) : (
          /* STANDARD OAUTH LOG IN BANNER */
          <div className="bg-gray-50/70 py-6 px-4 rounded-2xl border border-gray-100 text-center space-y-4 animate-fadeIn">
            <div className="p-3 bg-white w-12 h-12 rounded-full shadow-2xs mx-auto flex items-center justify-center border border-gray-1.00">
              <Lock className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Chưa kết nối tài khoản</h4>
              <p className="text-xs text-gray-500 mt-1">
                Đồng bộ bảng dữ liệu chi tiêu trực tiếp sang tệp tài liệu Google Sheet của bạn qua OAuth 2.0.
              </p>
            </div>

            <button
              onClick={handleGoogleAuthPopup}
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {isLoading ? 'Đang kết nối...' : 'Kết nối Google Sheets 🚀'}
            </button>
          </div>
        )
      ) : (
        /* RENDER LOGGED IN SESSION DASHBOARD ACTION PANEL */
        <div className="space-y-4">
          <div className="bg-emerald-50/20 p-4 rounded-xl border border-emerald-50 relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 text-xs">
              {syncMethod === 'appsscript' ? (
                <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-sm border border-amber-300">
                  🔑
                </div>
              ) : userProfile?.picture ? (
                <img
                  src={userProfile.picture}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-emerald-400 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm border border-emerald-300">
                  G
                </div>
              )}
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${syncMethod === 'appsscript' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {syncMethod === 'appsscript' ? 'Kết nối Ổn định vĩnh viễn' : 'OAuth Đã kết nối'}
                </span>
                <h4 className="text-sm font-bold text-gray-900 leading-tight">
                  {syncMethod === 'appsscript' ? 'Apps Script Web App' : (userProfile?.name || 'Tài khoản Google')}
                </h4>
                <p className="text-[11px] text-gray-400 font-medium font-mono truncate max-w-[200px]">
                  {syncMethod === 'appsscript' ? `${scriptUrl.substring(0, 48)}...` : userProfile?.email}
                </p>
              </div>
            </div>

            <div className="flex gap-2 self-start sm:self-center">
              <button
                onClick={handleSyncToSheets}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isLoading ? (
                  'Đang đồng bộ...'
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    Đồng bộ ngay ({unsyncedTransactions.length})
                  </>
                )}
              </button>
              <button
                onClick={handlePullFromSheets}
                disabled={isLoading}
                className="bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-150 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Tải tất cả các dòng chi tiêu từ Google Sheets về ứng dụng"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                Tải về từ Sheets
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-100 bg-white rounded-lg transition-all cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chế độ đồng bộ tự động toggle options */}
          <div className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-150 flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="auto-sync-checkbox"
                checked={!!config.autoSync}
                onChange={(e) => onChangeConfig({ ...config, autoSync: e.target.checked })}
                className="w-4 h-4 mt-0.5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer accent-emerald-600"
              />
              <label htmlFor="auto-sync-checkbox" className="cursor-pointer select-none">
                <span className="text-xs font-semibold text-gray-800 block">Kích hoạt chế độ đồng bộ tự động (Auto Sync)</span>
                <span className="text-[10px] text-gray-400 font-medium leading-tight">
                  Tự động đẩy chi tiêu mới lên Google Sheets khi thêm và luôn đồng bộ hai chiều ngầm mỗi phút.
                </span>
              </label>
            </div>
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.autoSync ? 'bg-emerald-400' : 'bg-gray-300'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.autoSync ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
            </span>
          </div>
        </div>
      )}

      {/* Advanced Configurations panel */}
      {showAdvanced && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-150 space-y-4 animate-fadeIn">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            Cấu hình & Đồng bộ chi tiết
          </h4>

          {/* Spreadsheet ID & Tab Name inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                Spreadsheet ID
              </label>
              <input
                type="text"
                value={config.spreadsheetId}
                onChange={(e) => onChangeConfig({ ...config, spreadsheetId: e.target.value })}
                placeholder="1B18ue0ejdFaBItGo-VTnphOI_ADKGybMKU2r-pt5jxA"
                className="w-full bg-white px-3 py-2 text-xs rounded-lg border border-gray-150 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                  Sheet Tab Name
                </label>
                <input
                  type="text"
                  value={config.sheetName}
                  onChange={(e) => onChangeConfig({ ...config, sheetName: e.target.value })}
                  placeholder="Sheet1"
                  className="w-full bg-white px-3 py-2 text-xs rounded-lg border border-gray-150 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1 truncate" title="Dòng bắt đầu ghi dữ liệu">
                  Dòng bắt đầu ghi
                </label>
                <input
                  type="number"
                  min={1}
                  value={config.transactionStartRow || 6}
                  onChange={(e) => onChangeConfig({ ...config, transactionStartRow: parseInt(e.target.value, 10) || 6 })}
                  placeholder="6"
                  className="w-full bg-white px-3 py-2 text-xs rounded-lg border border-gray-150 focus:border-emerald-500 focus:outline-hidden font-mono font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={config.clientId || ''}
                  onChange={(e) => onChangeConfig({ ...config, clientId: e.target.value })}
                  placeholder="OAuth Client ID"
                  className="w-full bg-white px-3 py-2 text-xs rounded-lg border border-gray-150 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Column Mapping UI */}
          <div className="border-t border-gray-150 pt-3">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Gán cột trên Google Sheets (Mapping)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.keys(config.columnMapping).map((key) => {
                const mapField = key as keyof typeof config.columnMapping;
                const label = key === 'date' ? 'Thời gian'
                            : key === 'note' ? 'Nội dung'
                            : key === 'type' ? 'Loại'
                            : key === 'amount' ? 'Số tiền'
                            : key === 'currency' ? 'Tiền Tệ'
                            : key === 'category' ? 'Danh mục'
                            : key === 'wallet_from' ? 'Tiền đi 🔴'
                            : key === 'wallet_to' ? 'Tiền đến 🟢'
                            : key === 'startDate' ? 'Tiết kiệm: Ngày BĐ'
                            : key === 'endDate' ? 'Tiết kiệm: Ngày ĐH'
                            : key;
                return (
                  <div key={key}>
                    <span className="block text-[9px] text-gray-500 font-medium truncate mb-0.5">{label}</span>
                    <input
                      type="text"
                      maxLength={2}
                      value={config.columnMapping[mapField]}
                      onChange={(e) => {
                        const nextMap = { ...config.columnMapping };
                        nextMap[mapField] = e.target.value.toUpperCase();
                        onChangeConfig({ ...config, columnMapping: nextMap });
                      }}
                      className="w-full text-center bg-white py-1 text-xs font-semibold text-gray-800 rounded border border-gray-150 uppercase"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Manual Token Developer Sandbox fallback option */}
          <form onSubmit={handleManualTokenSubmit} className="border-t border-gray-150 pt-3 space-y-2">
            <div>
              <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Lối tắt: Dùng Access Token trực tiếp
              </span>
              <p className="text-[10px] text-gray-400 leading-normal mb-2 font-medium">
                ⚠️ Dành cho nhà phát triển kiểm thử nhanh qua Google Playroom:
                <br />
                Mở <a
                  href="https://developers.google.com/oauthplayground"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline font-bold"
                >
                  OAuth Playground
                </a>, lập scope <code className="bg-gray-100 px-1 py-0.5 rounded text-[9px] font-mono text-gray-700 font-bold">https://www.googleapis.com/auth/spreadsheets</code>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ya29.a0Ax..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="flex-1 bg-white px-3 py-2 text-xs rounded-lg border border-gray-150 focus:border-emerald-500 focus:outline-hidden font-mono"
                />
                <button
                  type="submit"
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Dùng
                </button>
              </div>
            </div>
          </form>

          {/* Helper details about GCloud setup credentials */}
          <div className="bg-emerald-50/10 p-3 rounded-xl border border-emerald-100/30 text-[11px] text-gray-500 space-y-2.5">
            <h5 className="font-bold text-gray-700 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
              Cách lấy Google OAuth Client ID cá nhân:
            </h5>
            <ol className="list-decimal list-inside space-y-1 pl-1 line-height-relaxed text-gray-500">
              <li>
                Mở{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline font-semibold"
                >
                  GCP Console Credentials
                </a>
              </li>
              <li>Tạo "OAuth client ID" mới dạng Web Application</li>
              <li>
                Thêm địa chỉ này vào dòng <b>Authorized JavaScript origins</b>:
                <div className="flex items-center gap-1 bg-white border border-gray-150 p-1.5 rounded mt-1 font-mono text-[9px] text-gray-600">
                  <span className="flex-1 overflow-x-hidden text-ellipsis">{currentOrigin}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentOrigin)}
                    className="p-1 hover:bg-gray-100 rounded text-emerald-600"
                    title="Copy Origin"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </li>
              <li>
                Thêm địa chỉ này vào dòng <b>Authorized redirect URIs</b>:
                <div className="flex items-center gap-1 bg-white border border-gray-150 p-1.5 rounded mt-1 font-mono text-[9px] text-gray-600">
                  <span className="flex-1 overflow-x-hidden text-ellipsis">{currentOrigin}/oauth_callback.html</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${currentOrigin}/oauth_callback.html`)}
                    className="p-1 hover:bg-gray-100 rounded text-emerald-600"
                    title="Copy Redirect URI"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </li>
              <li>Sao chép Client ID nhận được và dán vào ô bên trên.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
