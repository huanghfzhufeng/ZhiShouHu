import React, { useState, useEffect } from 'react';
import { User, Settings, Users, Smartphone, LogOut, ChevronRight, Plus, Trash2, Phone, X, MapPin, ToggleLeft, ToggleRight, Heart, Activity, RotateCcw, Save, Edit3, Bell, Shield, Moon, Sun, Brain } from 'lucide-react';
import { contactsApi, safeZonesApi, settingsApi, getStoredUser } from '../services/api';

const Profile = ({ onLogout, user, onOpenHealthProfile }) => {
    const displayName = user?.username || '用户';
    const roleLabel = user?.role === 'guardian' ? '监护人端' : '老人端';
    
    const [showContacts, setShowContacts] = useState(false);
    const [showSafeZones, setShowSafeZones] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showAccountSettings, setShowAccountSettings] = useState(false);
    const [contacts, setContacts] = useState([]);
    const [safeZones, setSafeZones] = useState([]);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showAddZoneForm, setShowAddZoneForm] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '家人' });
    const [newZone, setNewZone] = useState({ zone_name: '', latitude: '', longitude: '', radius: '100' });

    useEffect(() => {
        if (showContacts) {
            loadContacts();
        }
    }, [showContacts]);

    useEffect(() => {
        if (showSafeZones) {
            loadSafeZones();
        }
    }, [showSafeZones]);

    useEffect(() => {
        if (showSettings) {
            loadSettings();
        }
    }, [showSettings]);

    const loadContacts = async () => {
        setLoading(true);
        try {
            const data = await contactsApi.getContacts();
            setContacts(data);
        } catch (error) {
            console.error('Failed to load contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddContact = async () => {
        if (!newContact.name || !newContact.phone) return;
        try {
            await contactsApi.addContact(newContact);
            setNewContact({ name: '', phone: '', relation: '家人' });
            setShowAddForm(false);
            loadContacts();
        } catch (error) {
            console.error('Failed to add contact:', error);
        }
    };

    const handleDeleteContact = async (id) => {
        try {
            await contactsApi.deleteContact(id);
            loadContacts();
        } catch (error) {
            console.error('Failed to delete contact:', error);
        }
    };

    const handleCall = (phone) => {
        window.location.href = `tel:${phone}`;
    };

    // Safe zones functions
    const loadSafeZones = async () => {
        setLoading(true);
        try {
            const storedUser = getStoredUser();
            if (!storedUser || !storedUser.elder_id) return;
            const data = await safeZonesApi.getZones(storedUser.elder_id);
            setSafeZones(data);
        } catch (error) {
            console.error('Failed to load safe zones:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddZone = async () => {
        if (!newZone.zone_name || !newZone.latitude || !newZone.longitude) return;
        try {
            const storedUser = getStoredUser();
            if (!storedUser || !storedUser.elder_id) return;
            await safeZonesApi.createZone(storedUser.elder_id, {
                zone_name: newZone.zone_name,
                latitude: parseFloat(newZone.latitude),
                longitude: parseFloat(newZone.longitude),
                radius: parseFloat(newZone.radius) || 100
            });
            setNewZone({ zone_name: '', latitude: '', longitude: '', radius: '100' });
            setShowAddZoneForm(false);
            loadSafeZones();
        } catch (error) {
            console.error('Failed to add safe zone:', error);
        }
    };

    const handleDeleteZone = async (id) => {
        try {
            await safeZonesApi.deleteZone(id);
            loadSafeZones();
        } catch (error) {
            console.error('Failed to delete safe zone:', error);
        }
    };

    const handleToggleZone = async (id) => {
        try {
            await safeZonesApi.toggleZone(id);
            loadSafeZones();
        } catch (error) {
            console.error('Failed to toggle safe zone:', error);
        }
    };

    // Settings functions
    const loadSettings = async () => {
        setLoading(true);
        try {
            const storedUser = getStoredUser();
            if (!storedUser || !storedUser.elder_id) return;
            const data = await settingsApi.getSettings(storedUser.elder_id);
            setSettings(data);
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const storedUser = getStoredUser();
            if (!storedUser || !storedUser.elder_id) return;
            await settingsApi.updateSettings(storedUser.elder_id, {
                heart_rate_threshold_high: settings.heart_rate_threshold_high,
                heart_rate_threshold_low: settings.heart_rate_threshold_low,
                systolic_bp_threshold_high: settings.systolic_bp_threshold_high,
                systolic_bp_threshold_low: settings.systolic_bp_threshold_low,
                notification_enabled: settings.notification_enabled
            });
            alert('设置已保存');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('保存失败: ' + (error.response?.data?.detail || '请稍后重试'));
        } finally {
            setSaving(false);
        }
    };

    const handleResetSettings = async () => {
        if (!confirm('确定要恢复默认设置吗？')) return;
        setLoading(true);
        try {
            const storedUser = getStoredUser();
            if (!storedUser || !storedUser.elder_id) return;
            const data = await settingsApi.resetSettings(storedUser.elder_id);
            setSettings(data);
        } catch (error) {
            console.error('Failed to reset settings:', error);
        } finally {
            setLoading(false);
        }
    };

    // 账户设置页面
    if (showAccountSettings) {
        return (
            <div className="pb-10">
                <div className="bg-white px-6 pt-6 pb-4 flex items-center gap-4 border-b border-slate-100">
                    <button onClick={() => setShowAccountSettings(false)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                        <ChevronRight size={24} className="rotate-180" />
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">账户设置</h2>
                </div>

                <div className="p-6 space-y-6">
                    {/* 账户信息 */}
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-slate-400 uppercase">账户信息</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">用户名</span>
                                <span className="text-sm font-bold text-slate-700">{displayName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">手机号</span>
                                <span className="text-sm font-bold text-slate-700">{user?.phone || '未设置'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">账户类型</span>
                                <span className="text-sm font-bold text-slate-700">{roleLabel}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">绑定老人</span>
                                <span className="text-sm font-bold text-slate-700">
                                    {user?.elder_id ? `ID: ${user.elder_id}` : '未绑定'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 通知设置 */}
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-slate-400 uppercase">通知设置</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Bell size={18} className="text-slate-400" />
                                    <span className="text-sm text-slate-700">推送通知</span>
                                </div>
                                <div className="w-12 h-7 bg-teal-500 rounded-full p-1 cursor-pointer">
                                    <div className="w-5 h-5 bg-white rounded-full shadow ml-auto"></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Shield size={18} className="text-slate-400" />
                                    <span className="text-sm text-slate-700">紧急告警</span>
                                </div>
                                <div className="w-12 h-7 bg-teal-500 rounded-full p-1 cursor-pointer">
                                    <div className="w-5 h-5 bg-white rounded-full shadow ml-auto"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 其他设置 */}
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-slate-400 uppercase">其他</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Moon size={18} className="text-slate-400" />
                                    <span className="text-sm text-slate-700">深色模式</span>
                                </div>
                                <div className="w-12 h-7 bg-slate-200 rounded-full p-1 cursor-pointer">
                                    <div className="w-5 h-5 bg-white rounded-full shadow"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 帮助与反馈 */}
                    <div className="text-center space-y-3 pt-4">
                        <button className="text-sm text-slate-500 hover:text-slate-700">用户协议</button>
                        <span className="text-slate-300 mx-2">|</span>
                        <button className="text-sm text-slate-500 hover:text-slate-700">隐私政策</button>
                        <span className="text-slate-300 mx-2">|</span>
                        <button className="text-sm text-slate-500 hover:text-slate-700">意见反馈</button>
                    </div>
                </div>
            </div>
        );
    }

    // 阈值设置页面
    if (showSettings) {
        return (
            <div className="pb-10">
                <div className="bg-white px-6 pt-6 pb-4 flex items-center gap-4 border-b border-slate-100">
                    <button onClick={() => setShowSettings(false)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                        <ChevronRight size={24} className="rotate-180" />
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">预警阈值设置</h2>
                    <button 
                        onClick={handleResetSettings}
                        disabled={loading}
                        className="ml-auto p-2 text-slate-400 hover:text-slate-600 transition-colors"
                        title="恢复默认"
                    >
                        <RotateCcw size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="text-center py-10">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                        </div>
                    ) : settings ? (
                        <>
                            {/* 心率阈值 */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 bg-rose-50 rounded-xl">
                                        <Heart size={20} className="text-rose-500" />
                                    </div>
                                    <h3 className="font-bold text-slate-800">心率阈值 (BPM)</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">下限</label>
                                        <input 
                                            type="number"
                                            value={settings.heart_rate_threshold_low}
                                            onChange={(e) => setSettings({...settings, heart_rate_threshold_low: parseInt(e.target.value) || 0})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                        />
                                        <span className="text-[10px] text-slate-400 mt-1 block">建议: 40-60</span>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">上限</label>
                                        <input 
                                            type="number"
                                            value={settings.heart_rate_threshold_high}
                                            onChange={(e) => setSettings({...settings, heart_rate_threshold_high: parseInt(e.target.value) || 0})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                        />
                                        <span className="text-[10px] text-slate-400 mt-1 block">建议: 90-120</span>
                                    </div>
                                </div>
                            </div>

                            {/* 血压阈值 */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 bg-orange-50 rounded-xl">
                                        <Activity size={20} className="text-orange-500" />
                                    </div>
                                    <h3 className="font-bold text-slate-800">收缩压阈值 (mmHg)</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">下限</label>
                                        <input 
                                            type="number"
                                            value={settings.systolic_bp_threshold_low}
                                            onChange={(e) => setSettings({...settings, systolic_bp_threshold_low: parseInt(e.target.value) || 0})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                        />
                                        <span className="text-[10px] text-slate-400 mt-1 block">建议: 80-100</span>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">上限</label>
                                        <input 
                                            type="number"
                                            value={settings.systolic_bp_threshold_high}
                                            onChange={(e) => setSettings({...settings, systolic_bp_threshold_high: parseInt(e.target.value) || 0})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                        />
                                        <span className="text-[10px] text-slate-400 mt-1 block">建议: 130-160</span>
                                    </div>
                                </div>
                            </div>

                            {/* 保存按钮 */}
                            <button 
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="w-full bg-teal-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-teal-600 transition-colors disabled:opacity-50"
                            >
                                {saving ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                ) : (
                                    <><Save size={20} />保存设置</>
                                )}
                            </button>

                            <p className="text-xs text-slate-400 text-center">
                                设置将用于异常检测引擎，超出阈值时触发预警
                            </p>
                        </>
                    ) : (
                        <div className="text-center py-10 text-slate-400">无法加载设置</div>
                    )}
                </div>
            </div>
        );
    }

    // 安全区域管理页面
    if (showSafeZones) {
        return (
            <div className="pb-10">
                <div className="bg-white px-6 pt-6 pb-4 flex items-center gap-4 border-b border-slate-100">
                    <button onClick={() => setShowSafeZones(false)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                        <ChevronRight size={24} className="rotate-180" />
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">安全区域</h2>
                    <button 
                        onClick={() => setShowAddZoneForm(true)} 
                        className="ml-auto p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-500 font-medium bg-slate-50 p-3 rounded-xl">
                        安全区域用于定义老人的日常活动范围，当老人离开这些区域时系统会发出预警。
                    </p>
                    
                    {loading ? (
                        <div className="text-center py-10">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : safeZones.length === 0 ? (
                        <div className="text-center py-16">
                            <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-400 font-bold">暂无安全区域</p>
                            <p className="text-slate-400 text-sm mt-1">添加安全区域以启用位置预警</p>
                        </div>
                    ) : (
                        safeZones.map((zone) => (
                            <div key={zone.id} className={`bg-white p-5 rounded-2xl shadow-sm border flex items-center gap-4 transition-all ${
                                zone.is_active ? 'border-indigo-100' : 'border-slate-100 opacity-60'
                            }`}>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                                    zone.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
                                }`}>
                                    <MapPin size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                        {zone.zone_name}
                                        {zone.is_active && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded">启用</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        半径: {zone.radius}m
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleToggleZone(zone.id)}
                                    className={`p-3 rounded-xl transition-colors ${
                                        zone.is_active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                    }`}
                                >
                                    {zone.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                </button>
                                <button 
                                    onClick={() => handleDeleteZone(zone.id)}
                                    className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* 添加安全区域弹窗 */}
                {showAddZoneForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-800">添加安全区域</h3>
                                <button onClick={() => setShowAddZoneForm(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">区域名称</label>
                                    <input 
                                        type="text" 
                                        value={newZone.zone_name}
                                        onChange={(e) => setNewZone({...newZone, zone_name: e.target.value})}
                                        placeholder="例如：家、公园、超市"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">纬度</label>
                                        <input 
                                            type="number" 
                                            step="0.0001"
                                            value={newZone.latitude}
                                            onChange={(e) => setNewZone({...newZone, latitude: e.target.value})}
                                            placeholder="30.2741"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">经度</label>
                                        <input 
                                            type="number" 
                                            step="0.0001"
                                            value={newZone.longitude}
                                            onChange={(e) => setNewZone({...newZone, longitude: e.target.value})}
                                            placeholder="120.1551"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">安全半径 (米)</label>
                                    <input 
                                        type="number" 
                                        value={newZone.radius}
                                        onChange={(e) => setNewZone({...newZone, radius: e.target.value})}
                                        placeholder="100"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                </div>
                                <button 
                                    onClick={handleAddZone}
                                    disabled={!newZone.zone_name || !newZone.latitude || !newZone.longitude}
                                    className="w-full bg-indigo-500 text-white py-3.5 rounded-xl font-bold mt-2 hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    添加区域
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 紧急联系人页面
    if (showContacts) {
        return (
            <div className="pb-10">
                <div className="bg-white px-6 pt-6 pb-4 flex items-center gap-4 border-b border-slate-100">
                    <button onClick={() => setShowContacts(false)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                        <ChevronRight size={24} className="rotate-180" />
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">紧急联系人</h2>
                    <button 
                        onClick={() => setShowAddForm(true)} 
                        className="ml-auto p-2 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {loading ? (
                        <div className="text-center py-10">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="text-center py-16">
                            <Users size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-400 font-bold">暂无紧急联系人</p>
                            <p className="text-slate-400 text-sm mt-1">添加联系人以便紧急情况时快速联系</p>
                        </div>
                    ) : (
                        contacts.map((contact) => (
                            <div key={contact.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 font-bold text-lg">
                                    {contact.name[0]}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-800">{contact.name}</div>
                                    <div className="text-sm text-slate-500">{contact.relation} · {contact.phone}</div>
                                </div>
                                <button 
                                    onClick={() => handleCall(contact.phone)}
                                    className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                                >
                                    <Phone size={20} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteContact(contact.id)}
                                    className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* 添加联系人弹窗 */}
                {showAddForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-800">添加紧急联系人</h3>
                                <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">姓名</label>
                                    <input 
                                        type="text" 
                                        value={newContact.name}
                                        onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                                        placeholder="请输入姓名"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">电话</label>
                                    <input 
                                        type="tel" 
                                        value={newContact.phone}
                                        onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                                        placeholder="请输入电话号码"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">关系</label>
                                    <select 
                                        value={newContact.relation}
                                        onChange={(e) => setNewContact({...newContact, relation: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    >
                                        <option value="家人">家人</option>
                                        <option value="朋友">朋友</option>
                                        <option value="邻居">邻居</option>
                                        <option value="医生">医生</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>
                                <button 
                                    onClick={handleAddContact}
                                    disabled={!newContact.name || !newContact.phone}
                                    className="w-full bg-teal-500 text-white py-3.5 rounded-xl font-bold mt-2 hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    添加联系人
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="pb-10">
            {/* 头部用户信息 */}
            <div className="bg-white p-8 pb-10 border-b border-slate-50 mb-6">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 p-1.5 rounded-full border-2 border-indigo-100">
                        <div className="w-full h-full rounded-full bg-indigo-50 flex items-center justify-center">
                            <User size={36} className="text-indigo-500" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{displayName} ({roleLabel})</h2>
                        <p className="text-xs font-bold text-slate-500 mt-2 bg-slate-100 px-3 py-1 rounded-full inline-block">智守护系统用户</p>
                    </div>
                    <button 
                        onClick={() => setShowAccountSettings(true)}
                        className="ml-auto p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <Settings size={22} />
                    </button>
                </div>
            </div>

            {/* 设置列表 */}
            <div className="px-6 space-y-6">

                {/* AI 健康档案入口 - 突出显示 */}
                <div 
                    onClick={onOpenHealthProfile}
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 rounded-[2rem] p-5 text-white shadow-lg shadow-cyan-200/50 cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden"
                >
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Brain size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg">AI 个人健康档案</h3>
                            <p className="text-cyan-100 text-xs mt-0.5">查看 AI 学习的个性化健康基线</p>
                        </div>
                        <ChevronRight size={24} className="text-white/70" />
                    </div>
                </div>

                {/* 紧急联系人和安全区域 */}
                <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-50">
                    <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">紧急安全</h3>
                    </div>
                    <div 
                        onClick={() => setShowContacts(true)}
                        className="p-5 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer group border-b border-slate-50"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-teal-50 rounded-xl text-teal-500 group-hover:bg-teal-100 transition-colors">
                                <Users size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-700">紧急联系人</span>
                        </div>
                        <div className="flex items-center text-slate-400">
                            <span className="text-xs font-bold mr-2">点击管理</span>
                            <ChevronRight size={18} />
                        </div>
                    </div>
                    <div 
                        onClick={() => setShowSafeZones(true)}
                        className="p-5 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer group border-b border-slate-50"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-500 group-hover:bg-indigo-100 transition-colors">
                                <MapPin size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-700">安全区域</span>
                        </div>
                        <div className="flex items-center text-slate-400">
                            <span className="text-xs font-bold mr-2">点击管理</span>
                            <ChevronRight size={18} />
                        </div>
                    </div>
                    <div 
                        onClick={() => setShowSettings(true)}
                        className="p-5 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-500 group-hover:bg-amber-100 transition-colors">
                                <Settings size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-700">预警阈值</span>
                        </div>
                        <div className="flex items-center text-slate-400">
                            <span className="text-xs font-bold mr-2">点击设置</span>
                            <ChevronRight size={18} />
                        </div>
                    </div>
                </div>

                {/* 通用 */}
                <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-50">
                    <div className="p-5 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-slate-100 transition-colors">
                                <Smartphone size={20} className="text-slate-400" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">关于App</span>
                        </div>
                        <span className="text-xs font-bold text-slate-400">v1.2.0 (Beta)</span>
                    </div>
                    <div
                        onClick={onLogout}
                        className="p-5 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer border-t border-slate-50 hover:bg-rose-50/30"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-rose-50 rounded-xl text-rose-400 group-hover:bg-rose-100 transition-colors">
                                <LogOut size={20} className="text-rose-400" />
                            </div>
                            <span className="text-sm font-bold text-rose-500">退出登录</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Profile;