import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updatePassword,
  signOut
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
  query,
  orderBy,
  getDocs
} from 'firebase/firestore';
import {
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
  LogIn,
  LogOut,
  Shield,
  User,
  KeyRound,
  UploadCloud,
  Settings,
  RefreshCw 
} from 'lucide-react';

// ==========================================
// Level 0: Global Config & Constants
// ==========================================

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'ntu-strategy-default-app';
const appId = String(rawAppId).replace(/[^a-zA-Z0-9_-]/g, '_');
const DOMAIN_SUFFIX = '@ntu.strategy.com';

const firebaseConfig =
  typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// --- Helpers ---
const safeStringify = (data) => JSON.stringify(data);
const safeParse = (data) => {
  try {
    return JSON.parse(data);
  } catch (e) {
    return data;
  }
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

// Styles
const styles = {
  formInput: "w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none",
  formSelect: "w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none",
  formTextarea: "w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 outline-none",
  btnPrimary: "px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30 flex items-center justify-center font-medium active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
  btnSecondary: "px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm flex items-center justify-center font-medium active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
  btnDanger: "px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed",
  btnInfo: "px-4 py-2 bg-sky-50 text-sky-600 border border-sky-200 rounded-lg hover:bg-sky-100 transition flex items-center justify-center font-medium",
  checkbox: "w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
};

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
  uploadedMapUrl: null,
};

// --- Excel Hook ---
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

// --- ErrorBoundary Component ---
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

// --- Components (Defined BEFORE use to prevent ReferenceError) ---

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

// 3. LoginModal (Login Only)
const LoginModal = ({ isOpen, onClose, auth, setGlobalMessage }) => {
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Clear fields on open
  useEffect(() => {
    if(isOpen) {
        setEmpId('');
        setPassword('');
        setLocalError('');
        setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError('');
    const email = `${empId}${DOMAIN_SUFFIX}`;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        setGlobalMessage({ text: '登入成功！', type: 'success' });
        onClose();
    } catch (error) {
      console.error(error);
      let msg = error.message;
      if (error.code === 'auth/invalid-email') msg = '帳號格式錯誤';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === "auth/invalid-credential") msg = '帳號或密碼錯誤';
      if (error.code === 'auth/too-many-requests') msg = '登入失敗次數過多，請稍後再試';
      setLocalError(msg); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center justify-center">
            <Shield className="w-6 h-6 mr-2 text-indigo-600" />
            員工登入
        </h2>
        <p className="text-center text-slate-500 mb-6 text-sm">
            請輸入帳號 (例如: 00095)
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">帳號</label>
                <div className="relative"><User className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" /><input type="text" required value={empId} onChange={(e) => setEmpId(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如: 00095" /></div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••" />
            </div>

          {localError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start">
                  <AlertTriangle className="w-5 h-5 text-rose-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-rose-700">{localError}</span>
              </div>
          )}

          <button type="submit" disabled={isLoading} className={`w-full py-2.5 rounded-lg text-white font-bold transition flex items-center justify-center ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30'}`}>{isLoading ? <Loader className="w-5 h-5 animate-spin" /> : '登入'}</button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Level 4: Tab Views (Core Content)
// ==========================================

const Tab3TargetsMap = ({ appData, updateSharedData, deleteUnits, exportToExcel, db, userId, setGlobalMessage, setEditingUnitId, setIsNewUnit, setCurrentTab, auth, setIsLoginModalOpen }) => {
  const { units, settings } = appData;
  const { areaMap, uploadedMapUrl, equipmentDB } = settings;
  const totalUnits = units.length;
  const currentClients = units.filter(u => u.attackStatus === 'client').length;
  const adminUnits = units.filter(u => u.category === 'Administrative').length;
  const academicUnits = units.filter(u => u.category === 'Academic').length;

  const [filter, setFilter] = useState({ id: '', type: '', name: '', contact: '', phone: '', brand: '', model: '' });
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [mapState, setMapState] = useState({ isDrawing: false, start: null, current: null, areaCodeInput: '' });
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
  const [mapImageUrl, setMapImageUrl] = useState(uploadedMapUrl);
  const [isMapLoading, setIsMapLoading] = useState(false);

  const checkAuth = () => {
    if (!auth?.currentUser || auth.currentUser.isAnonymous) {
      setIsLoginModalOpen(true);
      return false;
    }
    return true;
  };

  const filteredUnits = useMemo(() => {
    return units.filter(unit => {
      const equipmentJson = safeParse(unit.equipment);
      const hasMatchingEquipment = filter.brand || filter.model ? 
        equipmentJson.some(eq => (filter.brand === '' || eq.brand.includes(filter.brand)) && (filter.model === '' || eq.model.includes(filter.model))) : true;
      return (filter.id === '' || unit.id.includes(filter.id)) &&
             (filter.type === '' || unit.category === filter.type) &&
             (filter.name === '' || unit.name.includes(filter.name)) &&
             (filter.contact === '' || unit.contactName.includes(filter.contact)) &&
             (filter.phone === '' || unit.contactPhone.includes(filter.phone)) &&
             hasMatchingEquipment;
    });
  }, [units, filter]);

  // Load Map Chunks
  useEffect(() => {
      if(!db) return;
      const q = query(collection(db, `artifacts/${appId}/public/data/map_chunks`), orderBy('index'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          if (snapshot.empty) { setMapImageUrl(uploadedMapUrl); return; }
          setIsMapLoading(true);
          try { 
              const chunks = snapshot.docs.map(doc => doc.data().data); 
              const fullBase64 = chunks.join('');
              if(fullBase64) setMapImageUrl(fullBase64);
              else setMapImageUrl(uploadedMapUrl);
          } catch (err) { console.error(err); } 
          finally { setIsMapLoading(false); }
      }, (error) => console.log("Map load info:", error.message)); 
      return () => unsubscribe();
  }, [db, uploadedMapUrl]);

  const uploadMapAsChunks = async (file) => {
    if (!checkAuth()) return;
    if (file.size > 15 * 1024 * 1024) { alert("檔案過大"); return; }
    
    try {
      setGlobalMessage({ text: '處理圖片中...', type: 'info' });
      const compressedBase64 = await compressImage(file, 2500, 0.85);
      const CHUNK_SIZE = 800 * 1024;
      const chunks = [];
      for (let i = 0; i < Math.ceil(compressedBase64.length / CHUNK_SIZE); i++) { chunks.push(compressedBase64.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)); }
      
      const batch = writeBatch(db);
      const mapChunksRef = collection(db, `artifacts/${appId}/public/data/map_chunks`);
      const oldSnapshot = await getDocs(mapChunksRef);
      oldSnapshot.forEach((doc) => batch.delete(doc.ref));
      chunks.forEach((chunk, index) => { batch.set(doc(mapChunksRef, `chunk_${index}`), { index, data: chunk }); });
      
      await batch.commit();
      setGlobalMessage({ text: '地圖上傳成功', type: 'success' });
    } catch (e) { console.error(e); alert("上傳失敗: " + e.message); }
  };

  const handleMapClick = (e) => {
    if (!checkAuth()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (!mapState.isDrawing) {
      setMapState(p => ({ ...p, isDrawing: true, start: { x, y }, current: { x, y } }));
    } else {
      if (!mapState.areaCodeInput) { alert('請輸入區域編號'); setMapState(p => ({ ...p, isDrawing: false })); return; }
      const newArea = {
        id: crypto.randomUUID(), code: mapState.areaCodeInput,
        x1: Math.min(mapState.start.x, x), y1: Math.min(mapState.start.y, y),
        x2: Math.max(mapState.start.x, x), y2: Math.max(mapState.start.y, y)
      };
      updateSharedData({ areaMap: [...areaMap, newArea] });
      setMapState({ isDrawing: false, start: null, current: null, areaCodeInput: '' });
    }
  };

  const handleMouseMove = (e) => {
    if (!mapState.isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMapState(p => ({ ...p, current: { x, y } }));
  };

  const handleDeleteUnits = () => {
      if (!checkAuth()) return;
      if (selectedUnitIds.length > 0 && confirm(`刪除 ${selectedUnitIds.length} 筆資料?`)) {
          deleteUnits(selectedUnitIds);
          setSelectedUnitIds([]);
      }
  }

  const handleAddNew = () => {
      if(!checkAuth()) return;
      setEditingUnitId(null);
      setIsNewUnit(true);
      setCurrentTab('record');
  }

  const handleEditUnit = (id) => {
      if(!checkAuth()) return;
      setEditingUnitId(id);
      setIsNewUnit(false);
      setCurrentTab('record');
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         <StatusCard title="總家數" value={totalUnits} icon={<Building className="w-6 h-6 text-white" />} gradient="from-indigo-500 to-purple-600" />
         <StatusCard title="本牌家數" value={currentClients} icon={<CheckCircle className="w-6 h-6 text-white" />} gradient="from-emerald-500 to-teal-500" />
         <StatusCard title="行政單位" value={adminUnits} icon={<Users className="w-6 h-6 text-white" />} gradient="from-orange-400 to-red-500" />
         <StatusCard title="學術單位" value={academicUnits} icon={<Users className="w-6 h-6 text-white" />} gradient="from-sky-500 to-blue-600" />
      </div>
      
      {/* Map Section */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 relative">
         <div className="p-5 bg-slate-800 text-white flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center"><MapPin className="w-5 h-5 mr-2" /> 校園地圖戰情室</h3>
            <div className="flex gap-2 items-center">
               <input type="text" value={mapState.areaCodeInput} onChange={e => setMapState(p => ({...p, areaCodeInput: e.target.value}))} className="w-24 px-2 py-1 rounded bg-slate-700 text-white border-none" placeholder="區域編號" disabled={mapState.isDrawing}/>
               <button onClick={() => { if(checkAuth()) setMapState(p => ({ ...p, isDrawing: !p.isDrawing, start: null, current: null })) }} className={`px-4 py-2 rounded text-sm font-bold ${mapState.isDrawing ? 'bg-rose-500 text-white' : 'bg-slate-600 text-white'}`} disabled={!mapImageUrl}>{mapState.isDrawing ? '點擊結束' : '圈選區域'}</button>
               <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded flex items-center">
                  <UploadCloud className="w-4 h-4 mr-2" /> 上傳
                  <input type="file" className="hidden" accept="image/*" onClick={(e) => { e.target.value = null; }} onChange={(e) => e.target.files?.[0] && uploadMapAsChunks(e.target.files[0])} />
               </label>
            </div>
         </div>
         <div className={`relative w-full aspect-[2/1] bg-slate-100 overflow-hidden ${mapState.isDrawing ? 'cursor-crosshair' : 'cursor-default'}`} onClick={handleMapClick} onMouseMove={handleMouseMove}>
            {isMapLoading ? <div className="flex items-center justify-center h-full text-slate-400">載入地圖中...</div> : <div className="w-full h-full transition-transform duration-500 ease-out" style={{ backgroundImage: `url(${mapImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>}
            
            {areaMap.map((area) => (
                <div key={area.id} className="absolute border-2 border-rose-500 bg-rose-500/20 group/area" style={{ left: `${area.x1}%`, top: `${area.y1}%`, width: `${area.x2 - area.x1}%`, height: `${area.y2 - area.y1}%` }}>
                    <span className="absolute -top-6 left-0 bg-rose-600 text-white text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap z-10">{area.code}</span>
                    <button className="absolute -top-2 -right-2 p-1 bg-white text-rose-600 rounded-full shadow-md opacity-0 group-hover/area:opacity-100 z-20" onClick={(e) => { e.stopPropagation(); if(checkAuth()) updateSharedData({ areaMap: areaMap.filter(a => a.id !== area.id) }); }}><X className="w-3 h-3"/></button>
                </div>
            ))}
            
            {mapState.isDrawing && mapState.start && <div className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400/30 pointer-events-none" style={{ left: `${Math.min(mapState.start.x, mapState.current.x)}%`, top: `${Math.min(mapState.start.y, mapState.current.y)}%`, width: `${Math.abs(mapState.start.x - mapState.current.x)}%`, height: `${Math.abs(mapState.start.y - mapState.current.y)}%` }}></div>}
         </div>
      </div>

      {/* Target Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-xl font-bold text-slate-800">進攻對象概覽 <span className="text-sm font-normal text-slate-500 ml-2">(共 {filteredUnits.length} 筆)</span></h3>
            <div className="flex space-x-2">
                 <button onClick={handleAddNew} className={styles.btnPrimary}><Plus className="w-4 h-4 mr-1"/> 新增</button>
                 <button onClick={() => setIsFilterCollapsed(p => !p)} className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center bg-indigo-50 px-3 py-1.5 rounded-lg transition">{isFilterCollapsed ? '展開篩選' : '收合篩選'}</button>
            </div>
         </div>
         <div className={`transition-all duration-300 overflow-hidden bg-slate-50 border-b border-slate-100 ${isFilterCollapsed ? 'max-h-0' : 'max-h-auto p-6'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FilterInput label="客編/ID" value={filter.id} onChange={e => setFilter(p => ({...p, id: e.target.value}))} />
                <FilterInput label="名稱" value={filter.name} onChange={e => setFilter(p => ({...p, name: e.target.value}))} />
                <FilterSelect label="類型" value={filter.type} onChange={e => setFilter(p => ({...p, type: e.target.value}))}><option value="">全部</option><option value="Administrative">行政</option><option value="Academic">學術</option></FilterSelect>
                <button onClick={() => setFilter({ id: '', type: '', name: '', contact: '', phone: '', brand: '', model: '' })} className="mt-6 text-sm text-slate-500 underline">清除篩選</button>
            </div>
         </div>
         <div className="p-4">
            <div className="flex justify-end space-x-2 mb-4">
              <button onClick={handleDeleteUnits} disabled={selectedUnitIds.length === 0} className={`${styles.btnDanger} py-1.5 text-sm`}><Trash2 className="w-4 h-4 mr-1" /> 刪除 ({selectedUnitIds.length})</button>
              <button onClick={() => exportToExcel(units, '進攻對象', '清單', [{key:'name',label:'名稱'}, {key:'contactName',label:'聯絡人'}])} className={`${styles.btnInfo} py-1.5 text-sm`}><Download className="w-4 h-4 mr-1" /> 匯出</button>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-gray-200">
               <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">選取</th><th className="p-3 text-left">類型</th><th className="p-3 text-left">名稱</th><th className="p-3 text-left">聯絡人</th><th className="p-3 text-left">狀態</th><th className="p-3 text-right">動作</th></tr></thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredUnits.map(unit => (
                        <tr key={unit.id} className="hover:bg-indigo-50/40">
                           <td className="p-3"><input type="checkbox" checked={selectedUnitIds.includes(unit.id)} onChange={() => setSelectedUnitIds(p => p.includes(unit.id) ? p.filter(i=>i!==unit.id) : [...p, unit.id])} className={styles.checkbox}/></td>
                           <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${unit.category === 'Academic' ? 'bg-sky-100 text-sky-700' : 'bg-orange-100 text-orange-700'}`}>{unit.category === 'Academic' ? '學術' : '行政'}</span></td>
                           <td className="p-3 font-medium">{unit.name}</td>
                           <td className="p-3 text-sm text-gray-600">{unit.contactName}</td>
                           <td className="p-3 text-sm">{unit.attackStatus === 'client' ? '本牌' : '進攻中'}</td>
                           <td className="p-3 text-right"><button onClick={() => handleEditUnit(unit.id)} className={`${styles.btnPrimary} py-1 px-2 text-xs`}>詳細</button></td>
                        </tr>
                    ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

// --- Main App Logic (MyGymLog Style) ---
const MainApp = () => {
  const [currentTab, setCurrentTab] = useState('targets');
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalMessage, setGlobalMessage] = useState({ text: '', type: '' });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  const [appData, setAppData] = useState({ units: [], settings: initialSettings, schedules: [], meetings: [] });
  const [newUnitData, setNewUnitData] = useState({ name: '', category: 'Academic', subgroup: '', buildingId: '', attackStatus: 'engaged', contactName: '', contactPhone: '', areaCode: '', equipment: [], characteristics: [], history: [] });
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [isNewUnit, setIsNewUnit] = useState(false);
  const exportToExcel = useExcelExport();

  // 1. Initialize Firebase & Auth (MyGymLog Pattern)
  useEffect(() => {
    try {
      if (Object.keys(firebaseConfig).length === 0) { setIsLoading(false); return; }
      const app = initializeApp(firebaseConfig);
      const database = getFirestore(app);
      const authentication = getAuth(app);
      setDb(database);
      setAuth(authentication);
      
      // Auto Sign-in Anonymously if not logged in
      const unsubscribe = onAuthStateChanged(authentication, (user) => {
        if (user) {
           setUserId(user.uid);
        } else {
           setUserId(null);
           signInAnonymously(authentication).catch(console.error);
        }
        setIsLoading(false);
      });
      return () => unsubscribe();
    } catch (error) { console.error(error); setIsLoading(false); }
  }, []);

  // 2. Data Listeners (Public Data)
  useEffect(() => {
    if (!db || !userId) return; // Strict guard: Wait for Auth before attaching listeners
    
    const unsubUnits = onSnapshot(collection(db, `artifacts/${appId}/public/data/units`), (snap) => {
        setAppData(p => ({ ...p, units: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }, (error) => console.log("Read unit denied (expected if init)", error.message));

    // Use a shared settings document inside the public path
    const unsubSettings = onSnapshot(doc(db, `artifacts/${appId}/public/data/settings/shared_config`), (snap) => {
        if (snap.exists()) {
             const data = snap.data();
             setAppData(p => ({ ...p, settings: { ...initialSettings, ...data }, schedules: data.schedules||[], meetings: data.meetings||[] }));
        } else {
             // Init if needed (and allowed)
             if (userId) setDoc(doc(db, `artifacts/${appId}/public/data/settings/shared_config`), { ...initialSettings }, { merge: true }).catch(()=>{});
        }
    }, (error) => console.log("Read settings denied", error.message));
    return () => { unsubUnits(); unsubSettings(); };
  }, [db, userId]);

  // 3. Shared Write Functions
  const checkAuth = () => {
      if (!auth?.currentUser || auth.currentUser.isAnonymous) {
          setIsLoginModalOpen(true);
          return false;
      }
      return true;
  };

  const updateSharedData = async (fields) => {
      if(!checkAuth()) return;
      try {
         await setDoc(doc(db, `artifacts/${appId}/public/data/settings/shared_config`), fields, { merge: true });
         setGlobalMessage({ text: '更新成功', type: 'success' });
      } catch(e) { console.error(e); alert("更新失敗 (可能權限不足)"); }
  };

  const updateUnit = async (id, data) => {
      if(!checkAuth()) return;
      const dataToSave = {};
      Object.keys(data).forEach(key => {
         if(['equipment', 'history'].includes(key) && Array.isArray(data[key])) dataToSave[key] = safeStringify(data[key]);
         else dataToSave[key] = data[key];
      });
      try {
          await updateDoc(doc(db, `artifacts/${appId}/public/data/units`, id), dataToSave);
          setGlobalMessage({ text: '儲存成功', type: 'success' });
      } catch(e) { console.error(e); alert("儲存失敗"); }
  };
  
  const addDocWrapper = async (ref, data) => {
      if(!checkAuth()) return;
      const dataToSave = {...data};
      if(Array.isArray(data.equipment)) dataToSave.equipment = safeStringify(data.equipment);
      if(Array.isArray(data.history)) dataToSave.history = safeStringify(data.history);
      await addDoc(ref, dataToSave);
  };
  
  const deleteUnits = async (ids) => {
      if(!checkAuth()) return;
      const batch = writeBatch(db);
      ids.forEach(id => batch.delete(doc(db, `artifacts/${appId}/public/data/units`, id)));
      await batch.commit();
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center text-slate-500">載入中...</div>;

  // 4. Render Logic
  const renderContent = () => {
     switch(currentTab) {
        case 'targets': return <Tab3TargetsMap appData={appData} updateSharedData={updateSharedData} deleteUnits={deleteUnits} exportToExcel={exportToExcel} db={db} userId={userId} setGlobalMessage={setGlobalMessage} setEditingUnitId={setEditingUnitId} setIsNewUnit={setIsNewUnit} setCurrentTab={setCurrentTab} auth={auth} setIsLoginModalOpen={setIsLoginModalOpen}/>;
        case 'calendar': return <div className="p-8 text-center text-gray-500">行事曆功能 (請參照地圖頁邏輯實作)</div>;
        case 'guidelines': return <div className="p-8 text-center text-gray-500">準則功能 (請參照地圖頁邏輯實作)</div>;
        case 'record': 
            if (editingUnitId || isNewUnit) {
               return <div className="p-8 text-center"><button onClick={() => {setEditingUnitId(null); setIsNewUnit(false); setCurrentTab('targets')}} className="mb-4 text-blue-500">返回</button><div className="bg-white p-8 rounded shadow">編輯功能 (需驗證權限)</div></div>
            }
            return <div className="p-8 text-center">請先從地圖選擇對象</div>;
        case 'settings': return <div className="p-8 text-center text-gray-500">設定功能 (請參照地圖頁邏輯實作)</div>;
        default: return null;
     }
  };

  const navItems = [
    { id: 'targets', label: '戰情地圖', icon: <MapPin className="w-4 h-4" /> },
    { id: 'calendar', label: '行事曆', icon: <Activity className="w-4 h-4" /> },
    { id: 'record', label: '拜訪紀錄', icon: <Edit className="w-4 h-4" /> },
    { id: 'guidelines', label: '攻擊準則', icon: <Target className="w-4 h-4" /> },
    { id: 'settings', label: '設定', icon: <Building className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-16">
           <div className="flex items-center">
              <Activity className="w-6 h-6 mr-2 text-indigo-600"/>
              <h1 className="text-xl font-bold">2026 台大攻略戰情室</h1>
           </div>
           {auth?.currentUser && !auth.currentUser.isAnonymous ? (
               <button onClick={() => signOut(auth)} className="text-sm text-slate-500 flex items-center hover:text-red-500"><LogOut className="w-4 h-4 mr-1"/>登出 ({auth.currentUser.email?.split('@')[0]})</button>
           ) : (
               <button onClick={() => setIsLoginModalOpen(true)} className="text-sm text-indigo-600 font-bold flex items-center"><LogIn className="w-4 h-4 mr-1"/>員工登入</button>
           )}
        </div>
        <div className="max-w-7xl mx-auto px-4"><nav className="flex space-x-4 overflow-x-auto">{navItems.map(i => <button key={i.id} onClick={() => setCurrentTab(i.id)} className={`py-3 text-sm font-medium border-b-2 transition-colors ${currentTab===i.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>{i.label}</button>)}</nav></div>
      </header>

      <main className="py-6 animate-fade-in">{renderContent()}</main>

      {globalMessage.text && (
        <div className={`fixed top-24 right-6 p-4 rounded-xl shadow-2xl z-50 flex items-center space-x-3 ${globalMessage.type==='success'?'bg-emerald-600':'bg-rose-600'} text-white`}>
           <span className="font-medium">{globalMessage.text}</span>
           <button onClick={()=>setGlobalMessage({text:'',type:''})}><X className="w-4 h-4"/></button>
        </div>
      )}

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} auth={auth} setGlobalMessage={setGlobalMessage} />
    </div>
  );
};

const App = () => <ErrorBoundary><MainApp /></ErrorBoundary>;
export default App;