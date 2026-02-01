import React, { useEffect, useState } from 'react';
import { Bell, Heart, MapPin, Smartphone, Info, AlertTriangle, CheckCheck, Filter, Clock, ChevronRight } from 'lucide-react';
import { healthApi, getStoredUser } from '../services/api';

const Alerts = ({ isSimulationMode }) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markingRead, setMarkingRead] = useState(null);
    const [filter, setFilter] = useState('all'); // all, unread, health, location, device

    useEffect(() => {
        loadAlerts();
    }, [isSimulationMode]);

    const loadAlerts = async () => {
        try {
            const user = getStoredUser();
            if (!user || !user.elder_id) {
                setLoading(false);
                return;
            }
            const data = await healthApi.getAlerts(user.elder_id);
            setAlerts(data);
        } catch (error) {
            console.error('Failed to load alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (alertId) => {
        setMarkingRead(alertId);
        try {
            await healthApi.markAlertAsRead(alertId);
            setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a));
        } catch (error) {
            console.error('Failed to mark alert as read:', error);
        } finally {
            setMarkingRead(null);
        }
    };

    const handleMarkAllAsRead = async () => {
        const user = getStoredUser();
        if (!user || !user.elder_id) return;
        
        setMarkingRead('all');
        try {
            await healthApi.markAllAlertsAsRead(user.elder_id);
            setAlerts(alerts.map(a => ({ ...a, is_read: true })));
        } catch (error) {
            console.error('Failed to mark all alerts as read:', error);
        } finally {
            setMarkingRead(null);
        }
    };

    // 消息类型配置
    const alertTypeConfig = {
        health: { 
            icon: Heart, 
            label: '健康预警', 
            color: 'text-rose-500', 
            bg: 'bg-rose-50',
            border: 'border-rose-200'
        },
        anomaly_detection: { 
            icon: AlertTriangle, 
            label: '异常检测', 
            color: 'text-amber-500', 
            bg: 'bg-amber-50',
            border: 'border-amber-200'
        },
        location: { 
            icon: MapPin, 
            label: '位置提醒', 
            color: 'text-indigo-500', 
            bg: 'bg-indigo-50',
            border: 'border-indigo-200'
        },
        device: { 
            icon: Smartphone, 
            label: '设备状态', 
            color: 'text-slate-500', 
            bg: 'bg-slate-100',
            border: 'border-slate-200'
        },
        daily_report: { 
            icon: Info, 
            label: '日常报告', 
            color: 'text-teal-500', 
            bg: 'bg-teal-50',
            border: 'border-teal-200'
        },
    };

    const getConfig = (type) => alertTypeConfig[type] || alertTypeConfig.daily_report;

    // 严重程度标签
    const severityConfig = {
        high: { label: '紧急', class: 'bg-rose-500 text-white' },
        warning: { label: '警告', class: 'bg-amber-100 text-amber-700' },
        info: { label: '提醒', class: 'bg-slate-100 text-slate-600' },
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    };

    const unreadCount = alerts.filter(a => !a.is_read).length;
    
    // 过滤消息
    const filteredAlerts = alerts.filter(a => {
        if (filter === 'all') return true;
        if (filter === 'unread') return !a.is_read;
        return a.alert_type === filter;
    });

    // 按日期分组
    const groupByDate = (alerts) => {
        const groups = {};
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        alerts.forEach(alert => {
            const dateStr = new Date(alert.timestamp).toDateString();
            let key;
            if (dateStr === today) key = '今天';
            else if (dateStr === yesterday) key = '昨天';
            else key = new Date(alert.timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(alert);
        });
        return groups;
    };

    const groupedAlerts = groupByDate(filteredAlerts);

    return (
        <div className="pb-6">
            {/* 统计概览 */}
            {!loading && alerts.length > 0 && (
                <div className="px-6 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 ? (
                                <span className="text-sm font-bold text-slate-700">
                                    <span className="text-teal-600">{unreadCount}</span> 条未读
                                </span>
                            ) : (
                                <span className="text-sm font-bold text-slate-400">全部已读</span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                disabled={markingRead === 'all'}
                                className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-50"
                            >
                                <CheckCheck size={14} />
                                {markingRead === 'all' ? '处理中...' : '全部已读'}
                            </button>
                        )}
                    </div>
                    
                    {/* 筛选标签 */}
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                        {[
                            { key: 'all', label: '全部' },
                            { key: 'unread', label: '未读' },
                            { key: 'health', label: '健康' },
                            { key: 'location', label: '位置' },
                            { key: 'device', label: '设备' },
                        ].map(item => (
                            <button
                                key={item.key}
                                onClick={() => setFilter(item.key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                    filter === item.key 
                                        ? 'bg-slate-800 text-white' 
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                            >
                                {item.label}
                                {item.key === 'unread' && unreadCount > 0 && (
                                    <span className="ml-1 bg-teal-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 消息列表 */}
            <div className="px-6">
                {loading ? (
                    <div className="text-center py-16">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                        <p className="text-slate-400 text-sm mt-3">加载中...</p>
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="text-center py-16">
                        <Bell size={48} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-slate-400 font-bold">
                            {filter === 'all' ? '暂无消息' : '没有符合条件的消息'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(groupedAlerts).map(([date, dateAlerts]) => (
                            <div key={date}>
                                {/* 日期分隔 */}
                                <div className="flex items-center gap-2 py-2">
                                    <Clock size={12} className="text-slate-300" />
                                    <span className="text-xs font-bold text-slate-400">{date}</span>
                                    <div className="flex-1 h-px bg-slate-100"></div>
                                </div>
                                
                                {/* 该日期的消息 */}
                                <div className="space-y-3">
                                    {dateAlerts.map((alert) => {
                                        const config = getConfig(alert.alert_type);
                                        const Icon = config.icon;
                                        const severity = severityConfig[alert.severity] || severityConfig.info;
                                        const isUnread = !alert.is_read;
                                        
                                        return (
                                            <div 
                                                key={alert.id} 
                                                onClick={() => isUnread && handleMarkAsRead(alert.id)}
                                                className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                                                    isUnread 
                                                        ? `${config.border} shadow-sm` 
                                                        : 'border-slate-100 opacity-70'
                                                }`}
                                            >
                                                <div className="flex gap-3">
                                                    {/* 图标 */}
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                                                        <Icon size={18} className={config.color} />
                                                    </div>
                                                    
                                                    {/* 内容 */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-sm font-bold ${isUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                                                                {config.label}
                                                            </span>
                                                            {alert.severity === 'high' && (
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${severity.class}`}>
                                                                    {severity.label}
                                                                </span>
                                                            )}
                                                            {isUnread && alert.severity !== 'high' && (
                                                                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                                            )}
                                                        </div>
                                                        <p className={`text-xs leading-relaxed line-clamp-2 ${
                                                            isUnread ? 'text-slate-600' : 'text-slate-400'
                                                        }`}>
                                                            {alert.description}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* 时间 */}
                                                    <div className="text-right shrink-0">
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {formatTime(alert.timestamp)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* 底部提示 */}
            {!loading && alerts.length > 0 && (
                <div className="text-center text-[10px] text-slate-300 pt-8 pb-4 font-medium">
                    显示最近 {alerts.length} 条消息
                </div>
            )}
        </div>
    );
};

export default Alerts;
