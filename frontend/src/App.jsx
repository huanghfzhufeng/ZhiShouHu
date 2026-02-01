import React, { useState, useEffect } from 'react';
import { Battery, Loader2, ShieldCheck, Smartphone, Lock, Eye, EyeOff, ArrowRight, AlertTriangle, Phone, Navigation, AlertCircle, ChevronDown } from 'lucide-react';
import Home from './pages/Home';
import BottomNav from './components/BottomNav';
import Analysis from './pages/Analysis';
import Alerts from './pages/Alerts';
import Profile from './pages/Profile';
import HealthProfilePage from './pages/HealthProfilePage';
import ReportModal from './components/ReportModal';
import { authApi, healthApi, simulationApi, healthCheck, getStoredUser, contactsApi, setElderId, setAuthStateChangeCallback, API_BASE_URL } from './services/api';

// Debug: Show actual API URL from api.js
const API_URL_DEBUG = API_BASE_URL;

const DEFAULT_DATA = { status: 'safe', heartRate: 72, bloodPressure: '120/80', stepCount: 3500, location: '幸福社区公园', activity: '散步', riskLevel: '低', battery: 85, lastUpdate: '刚刚', message: '正在加载健康数据...' };

const App = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(authApi.isLoggedIn());
    const [authMode, setAuthMode] = useState('login');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    const [currentUser, setCurrentUser] = useState(getStoredUser());
    const [elderName, setElderName] = useState('');
    const [activeTab, setActiveTab] = useState('home');
    const [isSimulationMode, setIsSimulationMode] = useState(false);
    const [data, setData] = useState(DEFAULT_DATA);
    const [loading, setLoading] = useState(false);
    const [backendConnected, setBackendConnected] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [primaryContact, setPrimaryContact] = useState(null);
    const [showNoContactAlert, setShowNoContactAlert] = useState(false);
    const [elders, setElders] = useState([]);
    const [selectedElderId, setSelectedElderId] = useState(null);
    const [showElderSelect, setShowElderSelect] = useState(false);
    const [showHealthProfile, setShowHealthProfile] = useState(false);

    // Set up auth state change callback
    useEffect(() => {
        setAuthStateChangeCallback((loggedIn) => {
            if (!loggedIn) {
                // Token expired or invalid, force logout
                setIsLoggedIn(false);
                setCurrentUser(null);
                setElderName('');
                setData(DEFAULT_DATA);
            }
        });
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const health = await healthCheck();
                setBackendConnected(!!health);
                if (health && isLoggedIn) {
                    // Validate token by trying to fetch user info
                    try {
                        await authApi.getMe();
                        await loadElders();
                        await loadRealtimeData();
                        await loadPrimaryContact();
                    } catch (authError) {
                        // Token invalid, will be handled by interceptor
                        console.warn('Auth validation failed:', authError);
                    }
                }
            } catch (err) {
                console.error("Initial health check failed", err);
            }
        };
        init();

        // Health check interval - retry every 5 seconds if not connected
        const healthInterval = setInterval(async () => {
            if (!backendConnected) {
                const health = await healthCheck();
                if (health) {
                    setBackendConnected(true);
                    if (isLoggedIn) await loadRealtimeData();
                }
            }
        }, 5000);

        // Data refresh interval - refresh every 30 seconds when logged in
        const dataInterval = setInterval(async () => {
            if (isLoggedIn && backendConnected && !loading) {
                await loadRealtimeData();
            }
        }, 30000);

        return () => {
            clearInterval(healthInterval);
            clearInterval(dataInterval);
        };
    }, [isLoggedIn, backendConnected]);

    const loadElders = async () => {
        try {
            const eldersList = await authApi.getMyElders();
            setElders(eldersList);
            // If user has multiple elders, use the first one as default
            if (eldersList.length > 0) {
                const user = getStoredUser();
                if (user && !user.elder_id) {
                    // Set first elder as default if not already set
                    setSelectedElderId(eldersList[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to load elders:', error);
        }
    };

    const handleElderChange = async (elderId) => {
        setSelectedElderId(elderId);
        setElderId(elderId);
        // Update stored user with new elder_id
        const user = getStoredUser();
        if (user) {
            user.elder_id = elderId;
            localStorage.setItem('guardian_user', JSON.stringify(user));
            setCurrentUser(user);
        }
        setShowElderSelect(false);
        setElderName('');
        await loadRealtimeData();
    };

    const loadPrimaryContact = async () => {
        try {
            const contact = await contactsApi.getPrimaryContact();
            setPrimaryContact(contact);
        } catch (error) {
            console.error('Failed to load primary contact:', error);
        }
    };

    const handleEmergencyCall = () => {
        if (primaryContact?.phone) {
            window.location.href = `tel:${primaryContact.phone}`;
        } else {
            setShowNoContactAlert(true);
            setTimeout(() => setShowNoContactAlert(false), 3000);
        }
    };

    const [noElderWarning, setNoElderWarning] = useState(false);

    const loadRealtimeData = async () => {
        try {
            // Check if user has elder_id
            const user = getStoredUser();
            if (!user) {
                console.warn('No user found');
                return;
            }
            
            if (!user.elder_id) {
                console.warn('No elder_id found for current user');
                setNoElderWarning(true);
                setData({
                    ...DEFAULT_DATA,
                    message: '您尚未绑定被监护人，请联系管理员进行绑定。'
                });
                return;
            }
            
            setNoElderWarning(false);

            // Load elder info if not already loaded
            if (!elderName) {
                try {
                    const elderInfo = await authApi.getMyElder();
                    setElderName(elderInfo.username || '被监护人');
                } catch (e) {
                    console.warn('Failed to load elder info:', e);
                }
            }

            const realtimeData = await healthApi.getRealtimeStatus(user.elder_id);
            setData(realtimeData);
            setIsSimulationMode(realtimeData.status === 'danger');
        } catch (error) {
            console.error('Failed to load realtime data:', error);
            // Keep existing data on error
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');
        try {
            const user = await authApi.login(phone, password);
            setCurrentUser(user);
            setIsLoggedIn(true);
            setActiveTab('home');
            await loadRealtimeData();
        } catch (error) {
            console.error('Login failed:', error);
            // 详细错误信息用于调试
            const errMsg = error.response?.data?.detail || error.message || '网络错误';
            const errStatus = error.response?.status || 'N/A';
            setAuthError(`错误[${errStatus}]: ${errMsg}`);
            // Do NOT set isLoggedIn=true on error
        } finally {
            setAuthLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');
        try {
            await authApi.register(phone, password, username || phone.slice(-4));
            setCurrentUser(getStoredUser());
            setIsLoggedIn(true);
            setActiveTab('home');
            await loadRealtimeData();
        } catch (error) {
            console.error('Registration failed:', error);
            setAuthError(error.response?.data?.detail?.includes('already registered') ? '该手机号已注册' : '注册失败，请稍后重试');
            // Do NOT set isLoggedIn=true on error
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = () => {
        authApi.logout();
        setIsLoggedIn(false);
        setCurrentUser(null);
        setElderName('');
        setPhone('');
        setPassword('');
        setUsername('');
        setAuthMode('login');
        setData(DEFAULT_DATA);
        setIsSimulationMode(false);
    };

    const toggleSimulation = async () => {
        setLoading(true);
        try {
            const user = getStoredUser();
            if (!user || !user.elder_id) {
                console.error('No elder_id found');
                setLoading(false);
                return;
            }

            if (!isSimulationMode) {
                const result = await simulationApi.injectAnomaly(user.elder_id);
                setData(result.health_response || { status: 'danger', heartRate: 115, bloodPressure: '145/95', stepCount: 8200, location: '滨河路东段', activity: '快速移动', riskLevel: '高', battery: 82, lastUpdate: '刚刚', message: '检测到异常!' });
                setShowNotification(true);
                setIsSimulationMode(true);
            } else {
                const result = await simulationApi.resetToNormal(user.elder_id);
                setData(result.health_response || DEFAULT_DATA);
                setShowNotification(false);
                setIsSimulationMode(false);
            }
        } catch (error) {
            console.error('Simulation failed:', error);
            setIsSimulationMode(!isSimulationMode);
            setData(isSimulationMode ? DEFAULT_DATA : { status: 'danger', heartRate: 115, bloodPressure: '145/95', stepCount: 8200, location: '滨河路东段', activity: '快速移动', riskLevel: '高', battery: 82, lastUpdate: '1分钟前', message: '检测到偏离常规路线!' });
            setShowNotification(!isSimulationMode);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans antialiased selection:bg-teal-100">
            <div className="w-full min-h-screen bg-slate-50 overflow-hidden relative flex flex-col">
                {!isLoggedIn ? (
                    <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-br from-teal-600 to-emerald-800 rounded-b-[3rem] shadow-xl z-0 overflow-hidden">
                            <div className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                        </div>
                        <div className="flex-1 z-10 flex flex-col px-8 pt-20">
                            <div className="text-white mb-10 mt-6">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-lg border border-white/10">
                                    <ShieldCheck size={36} className="text-white" />
                                </div>
                                <h1 className="text-3xl font-black tracking-tight mb-2">智守护</h1>
                                <p className="text-teal-100 text-sm font-medium tracking-wide opacity-90">多模态老人安全智能预警系统</p>
                            </div>
                            <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200 p-8 flex-1 mb-8 flex flex-col">
                                <div className="flex items-center gap-6 mb-6 border-b border-slate-100 pb-1">
                                    <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className={`pb-3 text-lg font-bold transition-all ${authMode === 'login' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>登录</button>
                                    <button onClick={() => { setAuthMode('register'); setAuthError(''); }} className={`pb-3 text-lg font-bold transition-all ${authMode === 'register' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>注册</button>
                                </div>
                                {authError && <div className="bg-rose-50 text-rose-600 text-sm font-bold px-4 py-3 rounded-xl mb-4">{authError}</div>}
                                <form className="space-y-4 flex-1" onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
                                    {authMode === 'register' && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">用户名</label>
                                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">手机号码</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Smartphone size={20} /></div>
                                            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">密码</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={20} /></div>
                                            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                                        </div>
                                    </div>
                                    <div className="pt-4">
                                        <button type="submit" disabled={authLoading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-slate-300 hover:bg-slate-800 active:scale-[0.98] transition-all flex justify-center items-center gap-2">{authLoading ? <Loader2 size={24} className="animate-spin" /> : <>{authMode === 'login' ? '立即登录' : '注册账号'}<ArrowRight size={20} /></>}</button>
                                    </div>
                                    <div className="text-center pt-2"><p className="text-xs text-slate-400 font-medium">首次使用请先注册账号</p></div>
                                </form>
                                <div className="mt-4 text-center"><p className="text-xs text-slate-400 font-medium">登录即代表同意 <span className="text-teal-600 underline">服务条款</span></p></div>
                                {/* 调试信息 - 可在发布时删除 */}
                                <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded-xl text-center">
                                    <p className="text-sm text-yellow-800 font-bold">DEBUG API: {API_URL_DEBUG}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="bg-white/80 backdrop-blur-xl px-6 pt-12 pb-4 flex justify-between items-center z-30 fixed top-0 left-0 right-0 border-b border-slate-100/50">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                                        {activeTab === 'home' && (elderName || '被监护人')}
                                        {activeTab === 'analysis' && '行为分析'}
                                        {activeTab === 'alerts' && '消息中心'}
                                        {activeTab === 'profile' && '个人中心'}
                                    </h1>
                                    {activeTab === 'home' && elders.length > 1 && (
                                        <button 
                                            onClick={() => setShowElderSelect(!showElderSelect)}
                                            className="p-1 text-slate-400 hover:text-slate-600"
                                        >
                                            <ChevronDown size={18} className={`transition-transform ${showElderSelect ? 'rotate-180' : ''}`} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center text-xs font-medium text-slate-500 mt-1">
                                    <span className={`w-2 h-2 rounded-full mr-2 ${noElderWarning ? 'bg-amber-500' : data.status === 'safe' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                    {noElderWarning ? '未绑定被监护人' : data.status === 'safe' ? '设备在线 · 守护中' : '设备在线 · 异常警报'}
                                    {backendConnected ? (
                                        <span className="ml-2 text-emerald-500 font-bold" title="已连接到服务器">● 在线</span>
                                    ) : (
                                        <span className="ml-2 text-rose-500 font-bold" title="无法连接到服务器">● 离线 (模拟模式)</span>
                                    )}
                                </div>
                                {/* 老人选择下拉菜单 */}
                                {showElderSelect && elders.length > 1 && (
                                    <div className="absolute left-6 top-24 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[180px] overflow-hidden">
                                        {elders.map((elder) => (
                                            <button
                                                key={elder.id}
                                                onClick={() => handleElderChange(elder.id)}
                                                className={`w-full px-4 py-3 text-left text-sm font-bold transition-colors flex items-center gap-2 ${
                                                    currentUser?.elder_id === elder.id 
                                                        ? 'bg-teal-50 text-teal-600' 
                                                        : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${
                                                    currentUser?.elder_id === elder.id ? 'bg-teal-500' : 'bg-slate-300'
                                                }`}></span>
                                                {elder.username}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-full border border-slate-200"><Battery size={12} className="mr-1.5 text-emerald-600" />{data.battery}%</div>
                                <button onClick={toggleSimulation} disabled={loading} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all active:scale-95 flex items-center gap-1 ${isSimulationMode ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-600'}`}>{loading && <Loader2 size={12} className="animate-spin" />}{isSimulationMode ? '关闭模拟' : '模拟异常'}</button>
                            </div>
                        </div>
                        {showNotification && (
                            <div className="absolute top-0 left-0 w-full h-full bg-rose-600/90 z-50 backdrop-blur-md flex flex-col justify-center items-center text-white p-6 animate-in fade-in zoom-in duration-300">
                                <div className="bg-white text-slate-900 rounded-3xl p-8 w-full shadow-2xl border-l-8 border-rose-500">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-2 text-rose-600 font-bold text-xl"><AlertTriangle size={28} /><span>紧急安全预警</span></div>
                                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">刚刚</span>
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3 text-slate-800">检测到高风险行为异常</h3>
                                    <p className="text-slate-600 mb-6 leading-relaxed text-sm">{data.message}</p>
                                    <div className="bg-rose-50 p-4 rounded-2xl mb-6 flex gap-4 text-sm border border-rose-100">
                                        <div className="flex-1"><span className="block text-rose-400 text-xs font-semibold uppercase mb-1">当前心率</span><span className="font-bold text-rose-600 text-lg">{data.heartRate} bpm</span></div>
                                        <div className="flex-1 border-l border-rose-200 pl-4"><span className="block text-rose-400 text-xs font-semibold uppercase mb-1">位置</span><span className="font-bold text-slate-800 text-sm">{data.location}</span></div>
                                    </div>
                                    {showNoContactAlert && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                                            <AlertCircle size={16} className="text-amber-500" />
                                            <span className="text-amber-700 text-sm font-bold">请先在个人中心添加紧急联系人</span>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={handleEmergencyCall}
                                            className="bg-rose-600 text-white py-4 rounded-2xl font-bold flex flex-col justify-center items-center gap-1 shadow-lg"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Phone size={20} />一键呼叫
                                            </div>
                                            {primaryContact && (
                                                <span className="text-xs text-rose-200 font-normal">{primaryContact.name}</span>
                                            )}
                                        </button>
                                        <button onClick={() => { setShowNotification(false); setShowReportModal(true); }} className="bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold flex justify-center items-center gap-2"><Navigation size={20} />查看详情</button>
                                    </div>
                                    <button onClick={() => setShowNotification(false)} className="w-full mt-6 text-slate-400 text-sm py-2">已确认，关闭弹窗</button>
                                </div>
                            </div>
                        )}
                        <ReportModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} data={data} isSimulationMode={isSimulationMode} />
                        <div className="flex-1 overflow-y-auto scrollbar-hide bg-slate-50/50 relative pb-24 pt-24">
                            {showHealthProfile ? (
                                <HealthProfilePage onBack={() => setShowHealthProfile(false)} />
                            ) : (
                                <>
                                    {activeTab === 'home' && <Home data={data} openReport={() => setShowReportModal(true)} />}
                                    {activeTab === 'analysis' && <Analysis />}
                                    {activeTab === 'alerts' && <Alerts isSimulationMode={isSimulationMode} />}
                                    {activeTab === 'profile' && <Profile onLogout={handleLogout} user={currentUser} onOpenHealthProfile={() => setShowHealthProfile(true)} />}
                                </>
                            )}
                        </div>
                        {!showHealthProfile && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} isSimulationMode={isSimulationMode} />}
                    </>
                )}
            </div>
        </div>
    );
};

export default App;