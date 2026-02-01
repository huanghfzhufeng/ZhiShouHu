import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Activity, Heart, MapPin, ArrowRight, Footprints, Watch, BatteryLow, BatteryFull, BatteryMedium, Wifi, WifiOff } from 'lucide-react';
import { healthApi, devicesApi, getStoredUser } from '../services/api';
import AMapLocation from '../components/AMapLocation';

const Home = ({ data, openReport }) => {
    const [behaviorScore, setBehaviorScore] = useState({ score: 0, status: '加载中', description: '正在获取评分数据...', has_data: false });
    const [deviceStatus, setDeviceStatus] = useState(null);

    useEffect(() => {
        loadBehaviorScore();
        loadDeviceStatus();
    }, [data]); // Reload when data changes

    const loadBehaviorScore = async () => {
        try {
            const user = getStoredUser();
            if (!user || !user.elder_id) return;
            const scoreData = await healthApi.getBehaviorScore(user.elder_id);
            setBehaviorScore(scoreData);
        } catch (error) {
            console.error('Failed to load behavior score:', error);
            // Fallback to calculated score based on current data
            const fallbackScore = data.status === 'safe' ? 85 : 55;
            setBehaviorScore({
                score: fallbackScore,
                status: data.status === 'safe' ? '状态良好' : '需关注',
                description: data.status === 'safe' 
                    ? '老人各项生理指标保持稳定，生活规律良好。' 
                    : '检测到异常生理指标，建议及时确认老人状况。',
                has_data: true
            });
        }
    };

    const loadDeviceStatus = async () => {
        try {
            const user = getStoredUser();
            if (!user || !user.elder_id) return;
            const status = await devicesApi.getDeviceStatus(user.elder_id);
            setDeviceStatus(status);
        } catch (error) {
            console.error('Failed to load device status:', error);
        }
    };

    const getBatteryIcon = (level) => {
        if (level < 20) return <BatteryLow size={16} className="text-rose-500" />;
        if (level < 50) return <BatteryMedium size={16} className="text-amber-500" />;
        return <BatteryFull size={16} className="text-emerald-500" />;
    };
    return (
        <div className="p-6 space-y-6">
            {/* 核心状态卡片 */}
            <div
                onClick={() => openReport('daily', data)}
                className={`rounded-[2rem] p-7 text-white shadow-xl shadow-slate-200/50 transition-all duration-500 relative overflow-hidden cursor-pointer active:scale-[0.98] ${data.status === 'safe' ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-orange-600'}`}
            >
                {/* 装饰性背景圆 */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>

                {/* 提示点击 */}
                <div className="absolute top-5 right-5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/10 flex items-center gap-1 hover:bg-white/30 transition-colors">
                    查看完整报告 <ArrowRight size={12} />
                </div>

                <div className="flex justify-between items-start mb-8 relative z-10 mt-2">
                    <div>
                        <p className="text-white/80 text-xs font-bold tracking-widest uppercase mb-2">智能分析结果</p>
                        <h2 className="text-4xl font-black flex items-center gap-3 tracking-tighter">
                            {data.status === 'safe' ? '安全' : '高风险'}
                            {data.status === 'safe' ? <ShieldCheck size={36} className="text-emerald-100" /> : <AlertTriangle size={36} className="text-rose-100 animate-pulse" />}
                        </h2>
                    </div>
                </div>

                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity size={16} className="text-emerald-100" />
                        <span className="text-sm font-bold text-white/90">当前情境分析</span>
                    </div>
                    <p className="text-sm leading-relaxed text-white/90 font-medium opacity-90">
                        {data.message}
                    </p>
                </div>
            </div>

            {/* 关键生理指标 */}
            <div className="grid grid-cols-2 gap-5">
                <div className={`bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border transition-all ${data.heartRate > 100 || data.status === 'danger' ? 'border-rose-100 ring-2 ring-rose-50' : 'border-slate-50'}`}>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
                        <Heart size={14} className={data.heartRate > 100 ? "text-rose-500 fill-rose-500 animate-pulse" : "text-slate-400"} />
                        <span>心率 (BPM)</span>
                    </div>
                    <div className={`text-4xl font-black tracking-tighter ${data.heartRate > 100 || data.status === 'danger' ? 'text-rose-500' : 'text-slate-800'}`}>
                        {data.heartRate}
                    </div>
                    <div className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${data.status === 'safe' && data.heartRate <= 100 ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        {data.status === 'safe' && data.heartRate <= 100 ? '范围正常' : '异常偏高'}
                    </div>
                    <svg className={`absolute bottom-0 left-0 w-full h-12 opacity-5 transition-colors duration-500 ${data.heartRate > 100 ? 'text-rose-500' : 'text-slate-800'}`} preserveAspectRatio="none">
                        <path d="M0,20 Q20,5 40,20 T80,20 T120,5 T160,20 V30 H0 Z" fill="currentColor" />
                    </svg>
                </div>

                <div className={`bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border transition-all ${data.status === 'danger' ? 'border-orange-100 ring-2 ring-orange-50' : 'border-slate-50'}`}>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
                        <Activity size={14} />
                        <span>血压 (mmHg)</span>
                    </div>
                    <div className={`text-4xl font-black tracking-tighter ${data.status === 'danger' ? 'text-orange-500' : 'text-slate-800'}`}>
                        {data.bloodPressure}
                    </div>
                    <div className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${data.status === 'safe' ? 'bg-emerald-400' : 'bg-orange-400'}`}></span>
                        {data.status === 'safe' ? '波动平稳' : '异常偏高'}
                    </div>
                </div>
            </div>

            {/* 行为轨迹预览 */}
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-50">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                        <MapPin size={20} className="text-indigo-500" />
                        实时轨迹追踪
                    </h3>
                    <button
                        onClick={() => openReport('map', data)}
                        className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
                    >
                        查看详情
                    </button>
                </div>

                {/* 真实地图组件 - 需要配置 VITE_AMAP_KEY */}
                <AMapLocation 
                    latitude={data.latitude || 30.2741}
                    longitude={data.longitude || 120.1551}
                    status={data.status}
                    locationName={data.location}
                    safeZoneRadius={500}
                    showSafeZone={true}
                    height="192px"
                />

                <div className="flex items-center gap-6 mt-5 text-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Footprints size={18} className="text-slate-400" />
                        <span className="font-bold text-slate-700 text-base">{data.stepCount}</span>
                        <span className="text-xs font-bold text-slate-400">步</span>
                    </div>
                    <div className="h-5 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2 text-slate-500">
                        <MapPin size={18} className="text-slate-400" />
                        <span className="truncate max-w-[150px] font-bold text-slate-700">{data.location}</span>
                    </div>
                </div>
            </div>

            {/* 设备状态卡片 */}
            {deviceStatus && (
                <div className={`p-5 rounded-[2rem] border shadow-sm ${
                    deviceStatus.is_low_battery ? 'bg-gradient-to-r from-rose-50 to-orange-50 border-rose-100' : 'bg-gradient-to-r from-slate-50 to-slate-100/50 border-slate-100'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${deviceStatus.is_low_battery ? 'bg-rose-100' : 'bg-slate-200/70'}`}>
                                <Watch size={20} className={deviceStatus.is_low_battery ? 'text-rose-500' : 'text-slate-500'} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-700">智能手环</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {deviceStatus.sync_status === 'online' ? (
                                        <Wifi size={12} className="text-emerald-500" />
                                    ) : deviceStatus.sync_status === 'warning' ? (
                                        <Wifi size={12} className="text-amber-500" />
                                    ) : (
                                        <WifiOff size={12} className="text-slate-400" />
                                    )}
                                    <span className="text-xs text-slate-500">{deviceStatus.last_sync_text}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {getBatteryIcon(deviceStatus.battery_level)}
                            <span className={`text-lg font-black ${
                                deviceStatus.is_low_battery ? 'text-rose-500' : 'text-slate-700'
                            }`}>
                                {deviceStatus.battery_level}%
                            </span>
                        </div>
                    </div>
                    {deviceStatus.is_low_battery && (
                        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-rose-600 bg-rose-100/50 px-3 py-2 rounded-xl">
                            <BatteryLow size={14} />
                            <span>电量过低，请提醒老人及时充电</span>
                        </div>
                    )}
                </div>
            )}

            <div className={`p-6 rounded-[2rem] border shadow-sm ${behaviorScore.score >= 70 ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-blue-100/50' : 'bg-gradient-to-r from-amber-50/80 to-orange-50/80 border-amber-100/50'}`}>
                <h3 className={`text-xs font-bold mb-2 uppercase tracking-wide opacity-70 ${behaviorScore.score >= 70 ? 'text-blue-800' : 'text-amber-800'}`}>今日行为评分</h3>
                <div className="flex items-end gap-2 mb-3">
                    <span className={`text-4xl font-black tracking-tighter ${behaviorScore.score >= 70 ? 'text-blue-600' : 'text-amber-600'}`}>
                        {behaviorScore.has_data ? behaviorScore.score : '--'}
                    </span>
                    <span className={`text-sm font-bold mb-1.5 ${behaviorScore.score >= 70 ? 'text-blue-400' : 'text-amber-400'}`}>/ 100</span>
                    {behaviorScore.has_data && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 ${behaviorScore.score >= 85 ? 'bg-emerald-100 text-emerald-600' : behaviorScore.score >= 70 ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                            {behaviorScore.status}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-bold opacity-80">
                    {behaviorScore.description}
                </p>
            </div>
        </div>
    );
};

export default Home;