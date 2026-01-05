import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  orderBy,
  query,
  getDocs,
  limit,
  getDoc // Added getDoc
} from 'firebase/firestore';
import {
  ChevronRight,
  MapPin,
  X,
  Plus,
  Trash2,
  Edit,
  Save,
  Loader,
  AlertTriangle,
  Download,
  ChevronsDown,
  ChevronsUp,
  CheckCircle,
  Activity,
  Users,
  Building,
  Target,
  FileSpreadsheet,
  Info,
  Image as ImageIcon,
  UploadCloud,
  RefreshCw,
  LogIn,
  LogOut,
  UserCog,
  Shield,
  User,
  Settings
} from 'lucide-react';

// ==========================================
// Level 0: Global Config & Constants
// ==========================================

const DOMAIN_SUFFIX = '@ntu.strategy.com';
const ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VISITOR: 'visitor',
  GUEST: 'guest'
};
const ROLE_LABELS = {
  [ROLES.ADMIN]: '網站管理員',
  [ROLES.EDITOR]: '資料庫管理員',
  [ROLES.VISITOR]: '業務人員',
  [ROLES.GUEST]: '訪客 (未登入)'
};

const getAppId = () => {
  if (typeof __app_id !== 'undefined') return __app_id;
  if (typeof window !== 'undefined' && window.__app_id) return window.__app_id;
  return 'ntu-strategy-default-app';
};
const rawAppId = getAppId();
const appId = String(rawAppId).replace(/[^a-zA-Z0-9_-]/g, '_');

// Hardcoded config provided by user
const USER_PROVIDED_CONFIG = {
  apiKey: "AIzaSyD2euHjulZko-qcQzQxJcAv4FHWTtjzqv0",
  authDomain: "ntu-etf2026.firebaseapp.com",
  projectId: "ntu-etf2026",
  storageBucket: "ntu-etf2026.firebasestorage.app",
  messagingSenderId: "21357424438",
  appId: "1:21357424438:web:57dd0394b2bcb47ea34d97",
  measurementId: "G-FBGETJVL6Q"
};

// Robust config retrieval
const getFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
    return USER_PROVIDED_CONFIG;
  } catch (e) {
    console.warn("No valid firebase config found, using hardcoded config.");
    return USER_PROVIDED_CONFIG;
  }
};

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initial Data Structure
const initialSettings = {
  buildings: [
    { name: '行政大樓', code: 'A1' },
    { name: '博雅教學館', code: 'B2' },
  ],
  machineTypes: ['彩色影印機', '黑白影印機', '複合列表機', '單工列表機'],
  equipmentDB: [
    { brand: 'HP', model: 'M479fdw', type: '複合列表機' },
    { brand: 'Canon', model: 'imageRUNNER DX C357i', type: '彩色影印機' },
  ],
  guidelines: [
    { id: 1, title: '學術/行政分組原則', content: '學術單位需確認是否為「獨立空間」。' },
    { id: 2, title: '本牌客戶結案原則', content: '一旦確認為本牌 (EIP 資料建立)，則該筆進攻對象結案。' },
  ],
  talkScripts: [
    { id: 3, title: '初次拜訪', content: '我們提供節能、高效率的設備，協助貴單位達成綠色採購目標。' },
    { id: 4, title: '設備汰換', content: '提供最新的複合機，搭配客製化維護合約，降低運營成本。' },
  ],
  areaMap: [],
};

// Styles
const styles = {
  formInput: "w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none text-slate-800",
  formSelect: "w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none text-slate-800",
  formTextarea: "w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none text-slate-800",
  btnPrimary: "px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30 flex items-center justify-center font-medium active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
  btnSecondary: "px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm flex items-center justify-center font-medium active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
  btnDanger: "px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed",
  btnInfo: "px-4 py-2 bg-sky-50 text-sky-600 border border-sky-200 rounded-lg hover:bg-sky-100 transition flex items-center justify-center font-medium",
  checkbox: "w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
};

// ==========================================
// Level 1: Helpers
// ==========================================

const safeStringify = (data) => JSON.stringify(data);
const safeParse = (data) => {
  if (data === null || data === undefined) return [];
  if (typeof data !== 'string') return data;
  try { return JSON.parse(data); } catch (e) { return []; }
};

const compressImage = (file, maxWidth = 2500, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const useExcelExport = () => {
  useEffect(() => {
    if (typeof window.XLSX === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
      document.head.appendChild(script);
    }
  }, []);

  const s2ab = (s) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  };

  const exportToExcel = (data, filename, sheetName = 'Sheet1', columnHeaders) => {
    if (typeof window.XLSX === 'undefined') {
      alert('Excel 匯出函式庫尚未載入，請稍候再試。');
      return;
    }
    const headerKeys = columnHeaders.map((h) => h.key);
    const headerLabels = columnHeaders.map((h) => h.label);
    const worksheetData = [
      headerLabels,
      ...data.map((row) => headerKeys.map((key) => {
        const value = row[key];
        return Array.isArray(value) ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join('; ') : (value !== undefined ? value : '');
      })),
    ];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    ws['!cols'] = columnHeaders.map((h) => ({ wch: h.width || 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const blob = new Blob([s2ab(XLSX.write(wb, { bookType: 'xlsx', type: 'binary' }))], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().substring(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return exportToExcel;
};

// --- Firestore Reference Helpers (Fixed Paths) ---
const getUnitCollectionRef = (database) => collection(database, 'artifacts', appId, 'public', 'data', 'units');
const getSettingsDocRef = (database) => doc(database, 'artifacts', appId, 'public', 'data', 'settings', 'config');
const getMapChunksRef = (database) => collection(database, 'artifacts', appId, 'public', 'data', 'map_chunks');
const getUserRoleRef = (database, uid) => doc(database, 'artifacts', appId, 'public', 'data', 'users', uid);
const getAllUsersRef = (database) => collection(database, 'artifacts', appId, 'public', 'data', 'users');

// ==========================================
// Level 2: Basic UI Components
// ==========================================

const StatusCard = ({ title, value, icon, gradient }) => (
  <div className={`relative p-6 rounded-2xl shadow-lg text-white bg-gradient-to-br ${gradient} overflow-hidden transform hover:-translate-y-1 transition duration-300`}>
    <div className="absolute top-0 right-0 p-4 opacity-20 transform scale-150">{icon}</div>
    <p className="text-sm font-medium opacity-90 tracking-wide">{title}</p>
    <p className="text-4xl font-extrabold mt-2 tracking-tight">{value}</p>
  </div>
);

const InputGroup = ({ label, children }) => (
  <div className="flex flex-col space-y-1.5">
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

const FilterInput = ({ label, value, onChange }) => (
  <div className="flex flex-col">
    <label className="text-xs font-bold text-slate-500 mb-1">{label}</label>
    <input type="text" value={value} onChange={onChange} className={`${styles.formInput} text-sm`} />
  </div>
);

const FilterSelect = ({ label, value, onChange, children }) => (
  <div className="flex flex-col">
    <label className="text-xs font-bold text-slate-500 mb-1">{label}</label>
    <select value={value} onChange={onChange} className={`${styles.formSelect} text-sm`}>{children}</select>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("ErrorBoundary caught:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">發生預期外的錯誤</h1>
          <p className="text-slate-600 mb-6 max-w-md bg-white p-4 rounded shadow text-left text-sm font-mono overflow-auto">{this.state.error?.toString()}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"><RefreshCw className="w-4 h-4 mr-2" /> 重新整理頁面</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// Level 3: Feature Components
// ==========================================

const LoginModal = ({ isOpen, onClose, auth, setGlobalMessage, db, userId }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const email = `${empId}${DOMAIN_SUFFIX}`;
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Simplified Logic: Just set as VISITOR initially to ensure data creation succeeds
        // The user can change role in Admin panel later or via direct DB edit if needed.
        if (db) {
            await setDoc(getUserRoleRef(db, user.uid), {
              employeeId: empId, role: ROLES.VISITOR, email, createdAt: new Date().toISOString()
            });
            setGlobalMessage({ text: '註冊成功！預設為業務人員權限。', type: 'success' });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setGlobalMessage({ text: '登入成功！', type: 'success' });
      }
      onClose();
    } catch (error) {
      console.error(error);
      let msg = error.message;
      if (error.code === 'auth/invalid-email') msg = '工號格式錯誤';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === "auth/invalid-credential") msg = '工號或密碼錯誤';
      if (error.code === 'auth/email-already-in-use') msg = '此工號已註冊';
      if (error.code === 'auth/operation-not-allowed') msg = '錯誤：未在 Firebase Console 啟用登入功能。請至 Authentication > Sign-in method 開啟 Email/Password。';
      setGlobalMessage({ text: msg, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center justify-center"><Shield className="w-6 h-6 mr-2 text-indigo-600" />{isRegistering ? '註冊新帳號' : '員工登入'}</h2>
        <p className="text-center text-slate-500 mb-6 text-sm">{isRegistering ? '註冊後預設為業務人員權限' : '請使用您的工號與密碼登入'}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">工號</label>
            <div className="relative"><User className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" /><input type="text" required value={empId} onChange={(e) => setEmpId(e.target.value.toUpperCase())} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如: A001" /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••" minLength={6} />
          </div>
          <button type="submit" disabled={isLoading} className={`w-full py-2.5 rounded-lg text-white font-bold transition flex items-center justify-center ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30'}`}>{isLoading ? <Loader className="w-5 h-5 animate-spin" /> : (isRegistering ? '註冊' : '登入')}</button>
        </form>
        <div className="mt-6 text-center text-sm text-slate-600">{isRegistering ? '已經有帳號？' : '還沒有帳號？'}<button onClick={() => setIsRegistering(!isRegistering)} className="ml-1 text-indigo-600 font-bold hover:underline">{isRegistering ? '直接登入' : '立即註冊'}</button></div>
      </div>
    </div>
  );
};

const EditBlock = ({ item, field, onSave, onCancel, collection }) => {
  const [editTitle, setEditTitle] = useState(item.title);
  const [editContent, setEditContent] = useState(item.content);
  const handleSave = () => {
    const updatedCollection = collection.map((i) => i.id === item.id ? { ...i, title: editTitle, content: editContent } : i);
    onSave(field, updatedCollection);
  };
  return (
    <div className="p-3 bg-amber-50 rounded-lg space-y-3 ring-2 ring-amber-400">
      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`${styles.formInput} font-bold text-lg border-amber-300 focus:ring-amber-500`} />
      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className={`${styles.formTextarea} border-amber-300 focus:ring-amber-500`} rows="4" />
      <div className="flex justify-end space-x-2"><button onClick={onCancel} className={`${styles.btnSecondary} text-sm`}>取消</button><button onClick={handleSave} className={`${styles.btnPrimary} text-sm`}><Save className="w-4 h-4 mr-1" /> 儲存</button></div>
    </div>
  );
};

const EquipmentAdder = ({ availableBrands, availableModels, machineTypes, equipmentDB, onAdd, setEquipmentSearch }) => {
  const [newEq, setNewEq] = useState({ brand: '', model: '', type: '' });
  const handleAdd = () => {
    if (newEq.brand && newEq.model && newEq.type) {
      onAdd(newEq);
      setNewEq({ brand: '', model: '', type: '' });
      setEquipmentSearch({ brand: '', model: '' });
    } else { alert('請填寫完整的設備資訊。'); }
  };
  useEffect(() => {
    const match = equipmentDB.find((e) => e.brand === newEq.brand && e.model === newEq.model);
    if (match && newEq.type === '') { setNewEq((p) => ({ ...p, type: match.type })); }
  }, [newEq.brand, newEq.model, equipmentDB]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <select value={newEq.brand} onChange={(e) => { setNewEq((p) => ({ ...p, brand: e.target.value, model: '' })); setEquipmentSearch((p) => ({ ...p, brand: e.target.value })); }} className={`${styles.formSelect} flex-1`}><option value="">選擇廠牌</option>{availableBrands.map((b) => (<option key={b} value={b}>{b}</option>))}</select>
        <select value={newEq.model} onChange={(e) => setNewEq((p) => ({ ...p, model: e.target.value }))} className={`${styles.formSelect} flex-1`}><option value="">選擇型號</option>{availableModels.map((m) => (<option key={m} value={m}>{m}</option>))}</select>
      </div>
      <div className="flex gap-2">
        <select value={newEq.type} onChange={(e) => setNewEq((p) => ({ ...p, type: e.target.value }))} className={`${styles.formSelect} flex-1`}><option value="">選擇類型</option>{machineTypes.map((t) => (<option key={t} value={t}>{t}</option>))}</select>
        <button onClick={handleAdd} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"><Plus className="w-5 h-5" /></button>
      </div>
    </div>
  );
};

const EquipmentList = ({ equipment, setNewUnitData }) => (
  <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-1">
    {(equipment || []).map((eq) => (
      <div key={eq.id} className="flex justify-between items-center p-3 bg-white border border-indigo-100 rounded-lg shadow-sm">
        <div className="text-sm"><span className="font-bold text-slate-800">{eq.brand} {eq.model}</span><span className="block text-xs text-slate-500">{eq.type}</span></div>
        <button onClick={() => setNewUnitData((p) => ({ ...p, equipment: p.equipment.filter((e) => e.id !== eq.id), }))} className="text-gray-400 hover:text-red-500 transition"><X className="w-4 h-4" /></button>
      </div>
    ))}
  </div>
);

const CharacteristicsEditor = ({ characteristics, setNewUnitData }) => {
  const [newChar, setNewChar] = useState('');
  const handleAdd = () => { if (newChar) { setNewUnitData((p) => ({ ...p, characteristics: [...p.characteristics, newChar] })); setNewChar(''); } };
  const handleDelete = (char) => { setNewUnitData((p) => ({ ...p, characteristics: p.characteristics.filter((c) => c !== char) })); };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="text" value={newChar} onChange={(e) => setNewChar(e.target.value)} className={`${styles.formInput} flex-grow`} placeholder="e.g. 預算緊張" />
        <button onClick={handleAdd} className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"><Plus className="w-5 h-5" /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(characteristics || []).map((char, index) => (
          <span key={index} className="flex items-center bg-white border border-amber-200 text-amber-800 text-sm px-3 py-1 rounded-full shadow-sm">{char}<button onClick={() => handleDelete(char)} className="ml-2 text-amber-400 hover:text-amber-600"><X className="w-3 h-3" /></button></span>
        ))}
      </div>
    </div>
  );
};

const HistoryLogAdder = ({ onAdd }) => {
  const [newLog, setNewLog] = useState({ activity: '', item: '', quantity: 1, supplement: '' });
  const handleAdd = () => {
    if (newLog.activity) {
      onAdd({ activity: newLog.activity, promotionalItems: newLog.item ? [{ item: newLog.item, quantity: newLog.quantity }] : [], characteristicSupplement: newLog.supplement });
      setNewLog({ activity: '', item: '', quantity: 1, supplement: '' });
    } else { alert('請填寫實際行為。'); }
  };
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 space-y-3">
      <input type="text" value={newLog.activity} onChange={(e) => setNewLog((p) => ({ ...p, activity: e.target.value }))} className={`${styles.formInput} font-medium`} placeholder="行為紀錄 (e.g. 設備demo)" />
      <div className="flex gap-2">
        <input type="text" value={newLog.item} onChange={(e) => setNewLog((p) => ({ ...p, item: e.target.value }))} className={`${styles.formInput} flex-grow`} placeholder="輔銷物" />
        <input type="number" value={newLog.quantity} onChange={(e) => setNewLog((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className={`${styles.formInput} w-20 text-center`} min="1" />
      </div>
      <textarea value={newLog.supplement} onChange={(e) => setNewLog((p) => ({ ...p, supplement: e.target.value }))} className={`${styles.formTextarea} text-sm`} placeholder="補充說明..." rows="2" />
      <button onClick={handleAdd} className="w-full py-2 bg-emerald-50 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 transition"><Plus className="w-4 h-4 mr-1 inline" /> 加入紀錄</button>
    </div>
  );
};

const HistoryLogList = ({ history }) => (
  <div className="mt-6">
    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">歷史紀錄</h4>
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {(history || []).sort((a, b) => new Date(b.date) - new Date(a.date)).map((log) => (
        <div key={log.id} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-1"><span className="font-bold text-slate-800">{log.activity}</span><span className="text-xs text-slate-400 font-mono">{log.date}</span></div>
          {(log.promotionalItems || []).length > 0 && (<div className="flex flex-wrap gap-1 mt-2">{log.promotionalItems.map((item, i) => (<span key={i} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">{item.item} x{item.quantity}</span>))}</div>)}
          {log.characteristicSupplement && (<p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded">{log.characteristicSupplement}</p>)}
        </div>
      ))}
    </div>
  </div>
);

const UnitTable = ({ units, selectedUnitIds, setSelectedUnitIds, setCurrentTab, setEditingUnitId, setIsNewUnit }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">選取</th>
            <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">類型</th>
            <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">客戶名稱</th>
            <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">聯絡人</th>
            <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">進攻狀態</th>
            <th className="p-3 text-right text-xs font-bold uppercase tracking-wider">檢視</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {units.map((unit) => (
            <tr key={unit.id} className="hover:bg-indigo-50/40 transition">
              <td className="p-3"><input type="checkbox" checked={selectedUnitIds.includes(unit.id)} onChange={() => setSelectedUnitIds((p) => p.includes(unit.id) ? p.filter((id) => id !== unit.id) : [...p, unit.id])} className={styles.checkbox} /></td>
              <td className="p-3 text-sm"><span className={`px-2 py-0.5 rounded text-xs font-bold ${unit.category === 'Academic' ? 'bg-sky-100 text-sky-700' : 'bg-orange-100 text-orange-700'}`}>{unit.category === 'Academic' ? '學術' : '行政'}</span></td>
              <td className="p-3 text-sm font-medium text-gray-900">{unit.name || '未命名'}</td>
              <td className="p-3 text-sm text-gray-600">{unit.contactName || '-'}<span className="block text-xs text-gray-400">{unit.contactPhone || '-'}</span></td>
              <td className="p-3 text-sm"><span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full shadow-sm ${unit.attackStatus === 'client' ? 'bg-emerald-100 text-emerald-800' : unit.attackStatus === 'settled_non_client' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{unit.attackStatus === 'client' ? '本牌客戶' : unit.attackStatus === 'settled_non_client' ? '暫定結案' : '進攻中'}</span></td>
              <td className="p-3 text-right"><button onClick={() => { setCurrentTab('record'); setEditingUnitId(unit.id); setIsNewUnit(false); }} className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition border border-indigo-200">詳細</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {units.length === 0 && <div className="p-8 text-center text-gray-400 bg-gray-50">尚無資料。</div>}
    </div>
  );
};

// ==========================================
// Level 4: Tab Views (MUST be defined before App)
// ==========================================

const UnitRecordView = ({ newUnitData, setNewUnitData, handleSaveUnit, handleAddHistory, isNewUnit, appData, setEditingUnitId, setIsNewUnit, userRole }) => {
  const { equipment, characteristics, history } = newUnitData;
  const [equipmentSearch, setEquipmentSearch] = useState({ brand: '', model: '' });
  
  // Guard against undefined data (prevent white screen)
  const equipmentDB = appData.settings?.equipmentDB || [];
  const buildings = appData.settings?.buildings || [];
  const areaMap = appData.settings?.areaMap || [];
  const machineTypes = appData.settings?.machineTypes || [];

  const availableBrands = [...new Set(equipmentDB.map((e) => e.brand))];
  const availableModels = [...new Set(equipmentDB.filter((e) => e.brand === equipmentSearch.brand).map((e) => e.model))];
  
  const canEdit = userRole === ROLES.ADMIN || userRole === ROLES.EDITOR;
  const canAddHistory = userRole !== ROLES.GUEST;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-2xl space-y-8 max-w-5xl mx-auto my-6 border border-slate-200">
      <div className="flex justify-between items-center border-b pb-6">
        <h3 className="text-2xl font-extrabold text-slate-800">{isNewUnit ? '新增進攻對象' : `編輯/紀錄: ${newUnitData.name}`}</h3>
        <button onClick={() => { setEditingUnitId(null); setIsNewUnit(false); }} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {!canEdit && !isNewUnit && <div className="absolute inset-0 bg-slate-50/50 z-10 cursor-not-allowed"></div>}
        <InputGroup label="單位名稱 (必填)"><input type="text" value={newUnitData.name || ''} onChange={(e) => setNewUnitData((p) => ({ ...p, name: e.target.value }))} className={styles.formInput} disabled={!canEdit && !isNewUnit} /></InputGroup>
        <InputGroup label="棟別"><select value={newUnitData.buildingId || ''} onChange={(e) => setNewUnitData((p) => ({ ...p, buildingId: e.target.value }))} className={styles.formSelect} disabled={!canEdit && !isNewUnit}><option value="">選擇棟別</option>{buildings.map((b) => (<option key={b.code} value={b.code}>{b.name} ({b.code})</option>))}</select></InputGroup>
        <InputGroup label="區域編號"><select value={newUnitData.areaCode || ''} onChange={(e) => setNewUnitData((p) => ({ ...p, areaCode: e.target.value }))} className={styles.formSelect} disabled={!canEdit && !isNewUnit}><option value="">無區域</option>{areaMap.map((a) => (<option key={a.code} value={a.code}>{a.code}</option>))}</select></InputGroup>
        <InputGroup label="進攻狀態"><select value={newUnitData.attackStatus || 'engaged'} onChange={(e) => setNewUnitData((p) => ({ ...p, attackStatus: e.target.value }))} className={styles.formSelect} disabled={!canEdit && !isNewUnit}><option value="engaged">進攻中</option><option value="settled_non_client">已進攻暫定結案</option><option value="client">本牌客戶</option></select></InputGroup>
        <InputGroup label="承辦姓名"><input type="text" value={newUnitData.contactName || ''} onChange={(e) => setNewUnitData((p) => ({ ...p, contactName: e.target.value }))} className={styles.formInput} disabled={!canEdit && !isNewUnit} /></InputGroup>
        <InputGroup label="電話"><input type="text" value={newUnitData.contactPhone || ''} onChange={(e) => setNewUnitData((p) => ({ ...p, contactPhone: e.target.value }))} className={styles.formInput} disabled={!canEdit && !isNewUnit} /></InputGroup>
        <InputGroup label="單位類別"><select value={newUnitData.category || 'Academic'} onChange={(e) => setNewUnitData((p) => ({ ...p, category: e.target.value }))} className={styles.formSelect} disabled={!canEdit && !isNewUnit}><option value="Academic">學術單位</option><option value="Administrative">行政單位</option></select></InputGroup>
        {(newUnitData.category === 'Academic' || newUnitData.category === 'Administrative') && (<InputGroup label="獨立空間分組"><div className="relative"><select value={newUnitData.subgroup || ''} onChange={(e) => setNewUnitData((p) => ({ ...p, subgroup: e.target.value }))} className={styles.formSelect} disabled={!canEdit && !isNewUnit}><option value="">一般</option><option value="獨立空間">獨立空間</option></select><div className="absolute right-0 -bottom-5 text-[10px] text-slate-500 flex items-center"><Info className="w-3 h-3 mr-1" /> 大單位底下獨立空間</div></div></InputGroup>)}
      </div>
      <div className="border-t border-slate-100 my-6"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        {!canEdit && !isNewUnit && <div className="absolute inset-0 bg-slate-50/50 z-10 cursor-not-allowed"></div>}
        <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
          <h4 className="text-lg font-bold mb-4 text-indigo-800 flex items-center"><span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span> 設備清單</h4>
          {canEdit && <EquipmentAdder availableBrands={availableBrands} availableModels={availableModels} machineTypes={machineTypes} equipmentDB={equipmentDB} onAdd={(eq) => setNewUnitData(p => ({...p, equipment: [...p.equipment, {...eq, id: crypto.randomUUID()}]}))} equipmentSearch={equipmentSearch} setEquipmentSearch={setEquipmentSearch} />}
          <EquipmentList equipment={equipment} setNewUnitData={canEdit ? setNewUnitData : () => {}} />
        </div>
        <div className="bg-amber-50/50 p-6 rounded-xl border border-amber-100">
          <h4 className="text-lg font-bold mb-4 text-amber-800 flex items-center"><span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span> 客戶特性</h4>
          {canEdit && <CharacteristicsEditor characteristics={characteristics} setNewUnitData={setNewUnitData} />}
          <div className="flex flex-wrap gap-2 mt-2">{(characteristics || []).map((char, index) => (<span key={index} className="bg-white border border-amber-200 text-amber-800 text-sm px-3 py-1 rounded-full">{char}</span>))}</div>
        </div>
      </div>
      <div className="border-t border-slate-100 my-6"></div>
      <div className="bg-emerald-50/30 p-6 rounded-xl border border-emerald-100">
        <h4 className="text-lg font-bold mb-4 text-emerald-800 flex items-center"><span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span> 記錄本次拜訪行為</h4>
        {canAddHistory && <HistoryLogAdder onAdd={handleAddHistory} />}
        <HistoryLogList history={history} />
      </div>
      <div className="flex justify-end space-x-4 pt-6">
        <button onClick={() => { setEditingUnitId(null); setIsNewUnit(false); }} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition font-medium">取消</button>
        {(canEdit || canAddHistory) && <button onClick={handleSaveUnit} className={`${styles.btnPrimary} bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-2.5`}><Save className="w-5 h-5 mr-2" /> 儲存資料</button>}
      </div>
    </div>
  );
};

const Tab1Calendar = ({ appData, updatePrivateData, exportToExcel }) => {
    return (
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow">
            <Activity className="w-12 h-12 mx-auto mb-4 text-indigo-300"/>
            <h2 className="text-xl font-bold mb-2">行事曆功能</h2>
            <p>目前行事曆僅供瀏覽，請使用左側導覽列切換至「戰情地圖」進行操作。</p>
        </div>
    );
};

const Tab2Guidelines = ({ appData }) => {
  // CRITICAL FIX: Safe access to prevent crash on initial load
  const guidelines = appData.settings?.guidelines || [];
  const talkScripts = appData.settings?.talkScripts || [];

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex items-center space-x-3 mb-6"><Target className="w-8 h-8 text-indigo-600" /><h2 className="text-3xl font-extrabold text-slate-800">攻擊準則</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg mb-4 text-blue-700">核心原則</h3>
          <ul className="list-disc pl-5 space-y-3 text-slate-700">{guidelines.map(g => <li key={g.id}><span className="font-bold">{g.title}</span>: {g.content}</li>)}</ul>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg mb-4 text-emerald-700">標準話術</h3>
          <ul className="list-disc pl-5 space-y-3 text-slate-700">{talkScripts.map(t => <li key={t.id}><span className="font-bold">{t.title}</span>: {t.content}</li>)}</ul>
        </div>
      </div>
    </div>
  );
};

const Tab3TargetsMap = ({ appData, updatePrivateData, deleteUnits, exportToExcel, db, userId, setGlobalMessage, setEditingUnitId, setIsNewUnit, setCurrentTab, userRole }) => {
  const { units, settings } = appData;
  // CRITICAL FIX: Default values to prevent white screen crashes on undefined data
  const areaMap = settings?.areaMap || [];
  const equipmentDB = settings?.equipmentDB || [];
  
  const totalUnits = units.length;
  const currentClients = units.filter((u) => u.attackStatus === 'client').length;
  const adminUnits = units.filter((u) => u.category === 'Administrative').length;
  const academicUnits = units.filter((u) => u.category === 'Academic').length;
  const [filter, setFilter] = useState({ id: '', type: '', name: '', contact: '', phone: '', brand: '', model: '' });
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [mapState, setMapState] = useState({ isDrawing: false, start: null, current: null, areaCodeInput: '' });
  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const canEdit = userRole === ROLES.ADMIN || userRole === ROLES.EDITOR;

  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      // Safety Check: Ensure properties exist before calling .includes
      const unitName = unit.name || '';
      const unitId = unit.id || '';
      const unitContact = unit.contactName || '';
      const unitPhone = unit.contactPhone || '';
      const unitCategory = unit.category || '';

      let equipmentJson = safeParse(unit.equipment);
      if (!Array.isArray(equipmentJson)) equipmentJson = []; 
      
      const hasMatchingEquipment = filter.brand || filter.model ? equipmentJson.some((eq) => (filter.brand === '' || eq.brand.includes(filter.brand)) && (filter.model === '' || eq.model.includes(filter.model))) : true;
      
      return (filter.id === '' || unitId.includes(filter.id)) && 
             (filter.type === '' || unitCategory === filter.type) && 
             (filter.name === '' || unitName.includes(filter.name)) && 
             (filter.contact === '' || unitContact.includes(filter.contact)) && 
             (filter.phone === '' || unitPhone.includes(filter.phone)) && 
             hasMatchingEquipment;
    });
  }, [units, filter]);

  useEffect(() => {
    if (!db || !userId) return; // Strictly waiting for user to be logged in
    const q = query(getMapChunksRef(db), orderBy('index'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) { setMapImageUrl(null); return; }
      setIsMapLoading(true);
      try { const chunks = snapshot.docs.map(doc => doc.data().data); setMapImageUrl(chunks.join('')); } catch (err) { console.error(err); } finally { setIsMapLoading(false); }
    }, (error) => console.log("Map load info:", error.message)); // Swallow init permission error
    return () => unsubscribe();
  }, [db, userId]);

  const uploadMapAsChunks = async (file) => {
    if (!db || !userId) { alert("請先登入"); return; }
    if (file.size > 15 * 1024 * 1024) { alert("檔案過大"); return; }
    try {
      setUploadProgress(10);
      setGlobalMessage({ text: '處理圖片中...', type: 'info' });
      const compressedBase64 = await compressImage(file, 2500, 0.85);
      setUploadProgress(40);
      const CHUNK_SIZE = 800 * 1024;
      const chunks = [];
      for (let i = 0; i < Math.ceil(compressedBase64.length / CHUNK_SIZE); i++) { chunks.push(compressedBase64.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)); }
      setUploadProgress(60);
      const batch = writeBatch(db);
      const mapChunksRef = getMapChunksRef(db);
      const oldSnapshot = await getDocs(mapChunksRef);
      oldSnapshot.forEach((doc) => batch.delete(doc.ref));
      chunks.forEach((chunk, index) => { batch.set(doc(mapChunksRef, `chunk_${index}`), { index, data: chunk }); });
      setUploadProgress(80);
      await batch.commit();
      setUploadProgress(100);
      setGlobalMessage({ text: '地圖上傳成功', type: 'success' });
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (e) { console.error(e); setUploadProgress(0); alert("上傳失敗: " + e.message); }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         <StatusCard title="總家數" value={totalUnits} icon={<Building className="w-6 h-6 text-white" />} gradient="from-indigo-500 to-purple-600" />
         <StatusCard title="本牌家數" value={currentClients} icon={<CheckCircle className="w-6 h-6 text-white" />} gradient="from-emerald-500 to-teal-500" />
         <StatusCard title="行政單位" value={adminUnits} icon={<Users className="w-6 h-6 text-white" />} gradient="from-orange-400 to-red-500" />
         <StatusCard title="學術單位" value={academicUnits} icon={<Users className="w-6 h-6 text-white" />} gradient="from-sky-500 to-blue-600" />
      </div>
      
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 relative">
         {uploadProgress > 0 && (
            <div className="absolute inset-0 z-50 bg-white/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
               <Loader className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
               <h3 className="text-xl font-bold text-slate-800">上傳進度 {uploadProgress}%</h3>
            </div>
         )}
         <div className="p-5 bg-slate-800 text-white flex justify-between items-center">
            <h3 className="text-xl font-bold">校園地圖</h3>
            {canEdit && (
               <div className="flex gap-2">
                  <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded flex items-center">
                     <UploadCloud className="w-4 h-4 mr-2" /> 上傳地圖
                     <input type="file" className="hidden" accept="image/*" onClick={(e) => e.target.value = null} onChange={(e) => e.target.files?.[0] && uploadMapAsChunks(e.target.files[0])} />
                  </label>
               </div>
            )}
         </div>
         <div className="relative w-full aspect-[2/1] bg-slate-100">
            {mapImageUrl ? <img src={mapImageUrl} className="w-full h-full object-contain" /> : <div className="flex items-center justify-center h-full text-slate-400">{isMapLoading ? "載入中..." : "尚無地圖"}</div>}
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6">
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">進攻對象</h3>
            {canEdit && <button onClick={() => { setEditingUnitId(null); setIsNewUnit(true); setCurrentTab('record'); }} className={styles.btnPrimary}><Plus className="w-4 h-4 mr-1"/> 新增</button>}
         </div>
         <UnitTable units={filteredUnits} selectedUnitIds={selectedUnitIds} setSelectedUnitIds={setSelectedUnitIds} setCurrentTab={setCurrentTab} setEditingUnitId={setEditingUnitId} setIsNewUnit={setIsNewUnit} />
      </div>
    </div>
  );
};

const Tab4Record = ({ appData, updateUnit, addDoc, db, userId, exportToExcel }) => {
  return (
    <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow">
       <h2 className="text-xl font-bold mb-2">請先選擇客戶</h2>
       <p>請前往「戰情地圖」點選「詳細」或「新增」來進入編輯模式。</p>
    </div>
  )
};

const Tab5Settings = ({ appData }) => (
  <div className="p-6 text-center bg-white rounded-xl shadow">
     <h2 className="text-xl font-bold mb-2">系統參數設定</h2>
     <p className="text-slate-500">此區域僅供管理員調整系統參數（棟別、設備型號等）。</p>
  </div>
);

const TabAdmin = ({ db, currentUserId }) => {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (!db || !currentUserId) return; // Added guard
    const unsubscribe = onSnapshot(getAllUsersRef(db), (snap) => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [db, currentUserId]);
  
  const updateUserRole = async (uid, role) => { 
      if (!db) return;
      await updateDoc(getUserRoleRef(db, uid), { role }); 
      alert("權限已更新"); 
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-3xl font-extrabold text-slate-800 mb-6">人員權限管理</h2>
      <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">工號</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">權限</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">操作</th></tr></thead>
          <tbody className="bg-white divide-y divide-slate-200">{users.map(u => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium">{u.employeeId}</td>
              <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${u.role === ROLES.ADMIN ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
              <td className="px-6 py-4">{u.id === currentUserId ? <span className="text-slate-400">自己</span> : <select value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value)} className="border rounded px-2 py-1 text-sm"><option value={ROLES.VISITOR}>業務</option><option value={ROLES.EDITOR}>管理</option><option value={ROLES.ADMIN}>站長</option></select>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

// ==========================================
// Level 6: Main App
// ==========================================

const MainApp = () => {
  const [currentTab, setCurrentTab] = useState('targets');
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(ROLES.GUEST);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [globalMessage, setGlobalMessage] = useState({ text: '', type: '' });
  const [appData, setAppData] = useState({ units: [], settings: initialSettings, schedules: [], meetings: [] });

  const [editingUnitId, setEditingUnitId] = useState(null);
  const [isNewUnit, setIsNewUnit] = useState(false);
  
  // State for form data - lifted to App level
  const [newUnitData, setNewUnitData] = useState({
      name: '', category: 'Academic', subgroup: '', buildingId: '', attackStatus: 'engaged', contactName: '', contactPhone: '', areaCode: '', equipment: [], characteristics: [], history: []
  });

  // Initialize Firebase
  useEffect(() => {
    const firebaseConfig = getFirebaseConfig();
    if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        // Safe check for config existence
        // In local dev this might be empty, we handle it by not crashing
        return;
    }
    try {
        const app = initializeApp(firebaseConfig);
        setDb(getFirestore(app));
        setAuth(getAuth(app));
    } catch(e) {
        console.error("Firebase init failed:", e);
    }
  }, []);
  
  // Show config modal if config missing
  const [showConfigModal, setShowConfigModal] = useState(false);
  useEffect(() => {
      const config = getFirebaseConfig();
      if (!config && !showConfigModal) {
          setShowConfigModal(true);
      }
  }, []);


  // Auth Listener
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        if (user.isAnonymous) setUserRole(ROLES.GUEST);
      } else {
        setUserId(null);
        setUserRole(ROLES.GUEST);
        signInAnonymously(auth).catch(console.error);
      }
    });
  }, [auth]);

  // Role Listener
  useEffect(() => {
    if (!db || !userId) return;
    if (auth.currentUser?.isAnonymous) return;
    return onSnapshot(getUserRoleRef(db, userId), (doc) => {
      if (doc.exists()) {
          setUserRole(doc.data().role || ROLES.VISITOR);
      } else {
          // If logged in but no role doc, force VISITOR to prevent GUEST state
          setUserRole(ROLES.VISITOR);
      }
    }, (error) => console.log("Role listener info:", error.message)); 
  }, [db, userId]);

  // Data Listener (Units & Settings)
  useEffect(() => {
    if (!db || !userId) return; // Added guard

    const unsubUnits = onSnapshot(getUnitCollectionRef(db), (snap) => {
      setAppData(p => ({ ...p, units: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }, (error) => console.log("Units listener info:", error.message));

    // Use setDoc merge to ensure doc exists without overwriting
    const settingsRef = getSettingsDocRef(db);
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // CRITICAL FIX: Merge with initialSettings to prevent undefined properties
        setAppData(p => ({ ...p, settings: { ...initialSettings, ...data } }));
      } else {
        // Initialize if missing, but only if authenticated to avoid permission error loop
        if (userId) {
            setDoc(settingsRef, initialSettings, { merge: true }).catch(console.error);
        }
      }
    }, (error) => console.log("Settings listener info:", error.message));
    return () => { unsubUnits(); unsubSettings(); };
  }, [db, userId]);
  
  // Sync form data when editingUnitId changes
  useEffect(() => {
     if (editingUnitId) {
        const unit = appData.units.find(u => u.id === editingUnitId);
        if (unit) {
           setNewUnitData({
              ...unit,
              equipment: typeof unit.equipment === 'string' ? safeParse(unit.equipment) : (unit.equipment || []),
              history: typeof unit.history === 'string' ? safeParse(unit.history) : (unit.history || [])
           });
        }
     } else if (isNewUnit) {
        setNewUnitData({
           name: '', category: 'Academic', subgroup: '', buildingId: '', attackStatus: 'engaged', contactName: '', contactPhone: '', areaCode: '', equipment: [], characteristics: [], history: []
        });
     }
  }, [editingUnitId, isNewUnit, appData.units]);

  const updateUnit = async (id, data) => {
    const dataToSave = {};
    Object.keys(data).forEach(key => {
       if(['equipment', 'history'].includes(key) && Array.isArray(data[key])) {
          dataToSave[key] = safeStringify(data[key]);
       } else {
          dataToSave[key] = data[key];
       }
    });
    await updateDoc(doc(getUnitCollectionRef(db), id), dataToSave);
  };

  const addDocWrapper = async (ref, data) => {
      // Stringify arrays before saving
      const dataToSave = {...data};
      if(Array.isArray(data.equipment)) dataToSave.equipment = safeStringify(data.equipment);
      if(Array.isArray(data.history)) dataToSave.history = safeStringify(data.history);
      return await addDoc(ref, dataToSave);
  };

  const updatePrivateData = async (fields) => {
    if (!db) return;
    try {
      const docRef = getSettingsDocRef(db);
      await setDoc(docRef, fields, { merge: true }); // Changed to setDoc with merge
      setGlobalMessage({ text: '資料更新成功！', type: 'success' });
    } catch (e) {
      console.error('Error updating data:', e);
      setGlobalMessage({ text: `資料更新失敗: ${e.message}`, type: 'error' });
    }
  };

  const renderTabContent = () => {
    if (editingUnitId || isNewUnit) {
       // Logic to find current unit data
       const currentUnit = editingUnitId ? appData.units.find(u => u.id === editingUnitId) : {
          name: '', category: 'Academic', subgroup: '', buildingId: '', attackStatus: 'engaged', contactName: '', contactPhone: '', areaCode: '', equipment: [], characteristics: [], history: []
       };
       // Parse JSON strings back to arrays for the view
       const parsedUnit = {
          ...currentUnit,
          equipment: typeof currentUnit.equipment === 'string' ? safeParse(currentUnit.equipment) : (currentUnit.equipment || []),
          history: typeof currentUnit.history === 'string' ? safeParse(currentUnit.history) : (currentUnit.history || [])
       };

       return (
          <UnitRecordView 
             newUnitData={newUnitData} // Use state passed down
             setNewUnitData={setNewUnitData}
             key={editingUnitId || 'new'}
             isNewUnit={isNewUnit}
             appData={appData}
             userRole={userRole}
             setEditingUnitId={setEditingUnitId}
             setIsNewUnit={setIsNewUnit}
             handleSaveUnit={async () => {
                 try {
                    if (isNewUnit) {
                        await addDocWrapper(getUnitCollectionRef(db), { ...newUnitData, createdAt: new Date().toISOString() });
                    } else {
                        await updateUnit(editingUnitId, newUnitData);
                    }
                    setEditingUnitId(null);
                    setIsNewUnit(false);
                    setGlobalMessage({ text: '儲存成功！', type: 'success' });
                 } catch (e) {
                    console.error(e);
                    alert("儲存失敗: " + e.message);
                 }
             }} 
             handleAddHistory={(newLog) => {
                 const logEntry = { ...newLog, date: new Date().toISOString().substring(0, 10), id: crypto.randomUUID() };
                 setNewUnitData(p => ({ ...p, history: [...p.history, logEntry] }));
             }}
             updateUnit={updateUnit}
             addDoc={addDocWrapper}
             getUnitCollectionRef={() => getUnitCollectionRef(db)}
          />
       )
    }

    if (currentTab === 'admin' && userRole !== ROLES.ADMIN) return <div className="p-8 text-center text-red-500">權限不足</div>;
    
    switch (currentTab) {
      case 'targets': return <Tab3TargetsMap appData={appData} userRole={userRole} db={db} userId={userId} setGlobalMessage={setGlobalMessage} setCurrentTab={setCurrentTab} setEditingUnitId={setEditingUnitId} setIsNewUnit={setIsNewUnit} updatePrivateData={updatePrivateData} />;
      case 'calendar': return <Tab1Calendar appData={appData} />;
      case 'guidelines': return <Tab2Guidelines appData={appData} />;
      case 'record': return <Tab4Record />; // Placeholder
      case 'settings': return <Tab5Settings />;
      case 'admin': return <TabAdmin db={db} currentUserId={userId} />;
      default: return null;
    }
  };

  const navItems = [
    { id: 'targets', label: '戰情地圖', icon: <MapPin className="w-4 h-4" /> },
    { id: 'calendar', label: '行事曆', icon: <Activity className="w-4 h-4" /> },
    { id: 'guidelines', label: '攻擊準則', icon: <Target className="w-4 h-4" /> },
  ];
  if (userRole === ROLES.ADMIN) navItems.push({ id: 'admin', label: '人員管理', icon: <UserCog className="w-4 h-4" /> });

  return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center text-white mr-3"><Activity className="w-6 h-6"/></div>
              <div><h1 className="text-xl font-bold">2026 台大攻略戰情室</h1><p className="text-xs text-slate-500">{userRole === ROLES.GUEST ? '訪客模式' : `${ROLE_LABELS[userRole]} - ${userId?.substring(0,6)}...`}</p></div>
            </div>
            {userRole === ROLES.GUEST ? <button onClick={() => setIsLoginModalOpen(true)} className={`${styles.btnPrimary} flex items-center bg-indigo-700 hover:bg-indigo-800 text-white shadow-md`}><LogIn className="w-4 h-4 mr-2" /> 員工登入</button> : <button onClick={() => signOut(auth)} className={`${styles.btnSecondary} flex items-center`}><LogOut className="w-4 h-4 mr-2" /> 登出</button>}
          </div>
          <div className="max-w-7xl mx-auto px-4"><nav className="flex space-x-1 overflow-x-auto pb-1">{navItems.map(item => (<button key={item.id} onClick={() => { setCurrentTab(item.id); setEditingUnitId(null); setIsNewUnit(false); }} className={`px-5 py-3 text-sm font-medium rounded-t-lg flex items-center space-x-2 ${currentTab === item.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}>{item.icon} <span>{item.label}</span></button>))}</nav></div>
        </header>
        <main className="py-6">{renderTabContent()}</main>
        {globalMessage.text && <div className={`fixed top-24 right-6 p-4 rounded-xl shadow-2xl z-50 flex items-center space-x-3 animate-slide-in ${globalMessage.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}><span className="font-medium">{globalMessage.text}</span><button onClick={() => setGlobalMessage({ text: '', type: '' })}><X className="w-4 h-4" /></button></div>}
        <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} auth={auth} db={db} userId={userId} setGlobalMessage={setGlobalMessage} />
        {showConfigModal && <ConfigModal onSave={(conf) => { localStorage.setItem('manual_firebase_config', JSON.stringify(conf)); window.location.reload(); }} />}
      </div>
  );
};

// Wrap App in ErrorBoundary at the root level
const App = () => {
    return (
        <ErrorBoundary>
            <MainApp />
        </ErrorBoundary>
    )
}

export default App;