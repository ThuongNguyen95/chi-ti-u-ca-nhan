/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SheetConfig, Transaction } from '../types';
import { fetchUserProfile, appendTransactionsToSheet, getSheetMetaData, UserProfile } from '../utils/googleSheets';
import { Cloud, Lock, ShieldCheck, Check, LogOut, Settings2, HelpCircle, ToggleLeft, Copy, Sliders } from 'lucide-react';

interface SheetsSyncProps {
  config: SheetConfig;
  onChangeConfig: (newConfig: SheetConfig) => void;
  unsyncedTransactions: Transaction[];
  onMarkTransactionsSynced: (ids: string[]) => void;
}

export default function SheetsSync({
  config,
  onChangeConfig,
  unsyncedTransactions,
  onMarkTransactionsSynced,
}: SheetsSyncProps) {
  const [accessToken, setAccessToken] = useState<string>(() => localStorage.getItem('gs_access_token') || '');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'err'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [currentOrigin, setCurrentOrigin] = useState('');

  useEffect(() => {
    setCurrentOrigin(window.location.origin);
  }, []);

  // Try to load user profile if token already exists on load
  useEffect(() => {
    if (accessToken) {
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
  }, [accessToken]);

  // Handle Client-side popup redirection messaging
  useEffect(() => {
    const handleGoogleCallback = (event: MessageEvent) => {
      // Validate incoming origin same as applet origin
      if (!event.origin.includes('.run.app') && !event.origin.includes('localhost') && event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'OAUTH_TOKEN' && event.data?.hash) {
        // Parse oauth params from hash
        const params = new URLSearchParams(event.data.hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          setAccessToken(token);
          setSyncMessage({ type: 'success', text: 'Đăng nhập Google thành công!' });
        } else {
          setSyncMessage({ type: 'err', text: 'Không tìm thấy Access Token trong phản hồi từ Google.' });
        }
      }
    };

    window.addEventListener('message', handleGoogleCallback);
    return () => window.removeEventListener('message', handleGoogleCallback);
  }, []);

  // Note: OAuth callback is processed securely by the dedicated static callback page (/public/oauth_callback.html).
  // This prevents the full React application from loading inside the popup, resolving issues
  // related to Vite development scripts or environment-specific window.fetch getter/setter restrictions.

  const handleLogout = () => {
    setAccessToken('');
    setUserProfile(null);
    localStorage.removeItem('gs_access_token');
    setSyncMessage(null);
  };

  // Standard Popup auth Trigger
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

  const sanitizeAccessToken = (input: string): string => {
    let clean = input.trim();
    
    // Thử trích xuất nếu người dùng dán toàn bộ đoạn JSON từ OAuth Playground
    if (clean.startsWith('{')) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.access_token) {
          return parsed.access_token.trim();
        }
      } catch (e) {}
    }

    // Nếu người dùng dán cả URL callback chứa tham số access_token
    if (clean.includes('access_token=')) {
      try {
        const match = clean.match(/access_token=([^&]+)/);
        if (match && match[1]) {
          return decodeURIComponent(match[1].trim());
        }
      } catch (e) {}
    }

    // Loại bỏ dấu nháy kép hoặc đơn bọc ngoài nếu dán nhầm của JSON
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.substring(1, clean.length - 1).trim();
    }

    return clean;
  };

  // Submit manual playground/developer token
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

  // Triggers Append of local unsynced entries
  const handleSyncToSheets = async () => {
    if (!accessToken) {
      setSyncMessage({ type: 'err', text: 'Vui lòng kết nối tài khoản Google trước' });
      return;
    }

    if (unsyncedTransactions.length === 0) {
      setSyncMessage({ type: 'success', text: 'Tất cả chi tiêu của bạn đã được đồng bộ hóa!' });
      return;
    }

    setIsLoading(true);
    setSyncMessage(null);

    try {
      // First, fetch structure to confirm access
      await getSheetMetaData(accessToken, config);

      // Save transactions online
      const result = await appendTransactionsToSheet(accessToken, config, unsyncedTransactions);
      if (result.success) {
        const syncedIds = unsyncedTransactions.map((t) => t.id);
        onMarkTransactionsSynced(syncedIds);
        setSyncMessage({
          type: 'success',
          text: `Đồng bộ thành công ${result.appendedCount} giao dịch sang trang tính!`,
        });
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      setSyncMessage({
        type: 'err',
        text: error.message || 'Lỗi đồng bộ. Hãy kiểm tra cài đặt chia sẻ hoặc hết hạn Token.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép vào bộ nhớ tạm!');
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5" id="sheets-sync-container">
      <div className="flex items-center justify-between">
        <h3 className="font-sans font-semibold text-lg text-gray-900 tracking-tight flex items-center gap-2">
          <Cloud className="w-5 h-5 text-emerald-600" />
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

      {/* Account Info and Action buttons */}
      {!accessToken ? (
        <div className="bg-gray-50/70 py-6 px-4 rounded-2xl border border-gray-100 text-center space-y-4">
          <div className="p-3 bg-white w-12 h-12 rounded-full shadow-2xs mx-auto flex items-center justify-center border border-gray-1.00">
            <Lock className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Chưa kết nối tài khoản</h4>
            <p className="text-xs text-gray-500 mt-1">
              Đồng bộ bảng dữ liệu chi tiêu trực tiếp sang tệp tài liệu Google Sheet của bạn.
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
      ) : (
        <div className="bg-emerald-50/20 p-4 rounded-xl border border-emerald-50 relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {userProfile?.picture ? (
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
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Đã kết nối
              </span>
              <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                {userProfile?.name || 'Tài khoản Google'}
              </h4>
              <p className="text-xs text-gray-500 font-medium font-mono">{userProfile?.email}</p>
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
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-100 bg-white rounded-lg transition-all cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
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

            <div className="grid grid-cols-2 gap-2">
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
              <p className="text-[10px] text-gray-400 leading-normal mb-2">
                Để thử nghiệm nhanh mà không cần tạo Client ID, hãy lấy Access Token từ{' '}
                <a
                  href="https://developers.google.com/oauthplayground"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline font-semibold"
                >
                  OAuth Playground
                </a>{' '}
                với phạm vi `https://www.googleapis.com/auth/spreadsheets` rồi dán xuống đây.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste Access Token..."
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
