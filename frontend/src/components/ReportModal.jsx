import React, { useEffect, useState } from 'react';
import { X, Calendar, Share2, Phone, Navigation, Clock, Heart, MapPin, Footprints, Loader2, AlertCircle } from 'lucide-react';
import { healthApi, contactsApi, getStoredUser } from '../services/api';

const ReportModal = ({ isOpen, onClose, data, isSimulationMode }) => {
    const [timelineData, setTimelineData] = useState([]);
    const [scoreData, setScoreData] = useState({ score: 0, status: '加载中', description: '', has_data: false });
    const [loading, setLoading] = useState(true);
    const [primaryContact, setPrimaryContact] = useState(null);
    const [showNoContactAlert, setShowNoContactAlert] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadTimelineAndScore();
            loadPrimaryContact();
        }
    }, [isOpen, data]);

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

    const loadTimelineAndScore = async () => {
        setLoading(true);
        try {
            const user = getStoredUser();
            if (!user || !user.elder_id) {
                setLoading(false);
                return;
            }
            
            // Load both timeline and score in parallel
            const [timeline, score] = await Promise.all([
                healthApi.getDailyTimeline(user.elder_id),
                healthApi.getBehaviorScore(user.elder_id)
            ]);
            
            setTimelineData(timeline.timeline || []);
            setScoreData(score);
        } catch (error) {
            console.error('Failed to load timeline/score:', error);
            // Fallback data
            setTimelineData([{
                time: '--:--',
                title: '加载失败',
                normal: true,
                heartRate: data.heartRate || 72,
                bloodPressure: data.bloodPressure || '120/80',
                description: '无法加载时间线数据',
                predicted: false
            }]);
            setScoreData({
                score: data.status === 'safe' ? 85 : 55,
                status: data.status === 'safe' ? '状态良好' : '需关注',
                description: data.message || '',
                has_data: true
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !data) return null;

    const score = scoreData.has_data ? scoreData.score : (isSimulationMode || data.status === 'danger' ? 62 : 95);
    const scoreStatus = scoreData.has_data ? scoreData.status : (score >= 80 ? '状态优秀' : score >= 60 ? '需关注' : '需立即关注');
    const scoreColor = score >= 80 ? 'bg-emerald-400/20 text-emerald-50' : 'bg-rose-500/80 text-white';

    return (
        <div className="absolute inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="px-6 pt-14 pb-6 bg-white flex justify-between items-center shadow-sm sticky top-0 z-20">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                        <Calendar size={20} />
                    </div>
                    今日行为监测
                </h2>
                <button 
                    onClick={onClose} 
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                    <X size={22} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                
                {/* Score Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] p-7 text-white shadow-xl shadow-indigo-200/50 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                    
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <span className="text-indigo-100 text-xs font-bold uppercase tracking-widest opacity-80">综合安全评分</span>
                            <div className="text-6xl font-black mt-2 tracking-tighter">
                                {score}
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl text-xs font-bold backdrop-blur-md border border-white/10 ${scoreColor}`}>
                            {scoreStatus}
                        </div>
                    </div>
                    <div className="mt-8">
                        <p className="text-indigo-100 text-xs font-bold mb-2 uppercase tracking-wide opacity-70">AI 智能分析摘要</p>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-sm font-medium leading-7 border border-white/5 text-indigo-50">
                            {data.message || (isSimulationMode 
                                ? '今日出现离群行为。上午 10:00 偏离常去路线，伴随心率升高，建议立即电话确认。' 
                                : '李建国先生今日作息非常规律。晨练时长达标，血压心率均在理想范围内，无跌倒风险。')}
                        </div>
                    </div>
                </div>

                {/* Current Status Cards */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-3">
                            <Heart size={14} className={data.heartRate > 100 ? 'text-rose-500' : ''} />
                            当前心率
                        </div>
                        <div className={`text-3xl font-black ${data.heartRate > 100 ? 'text-rose-500' : 'text-slate-800'}`}>
                            {data.heartRate} <span className="text-sm font-bold text-slate-400">bpm</span>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-3">
                            <Footprints size={14} />
                            今日步数
                        </div>
                        <div className="text-3xl font-black text-slate-800">
                            {data.stepCount?.toLocaleString() || '3,500'}
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                <div className="mb-8">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 px-2 text-lg">
                        <Clock size={20} className="text-indigo-500" />
                        全天轨迹追踪
                    </h3>
                    
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 size={24} className="animate-spin text-indigo-500" />
                            <span className="ml-2 text-slate-500">加载时间线...</span>
                        </div>
                    ) : timelineData.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">暂无时间线数据</div>
                    ) : (
                    <div className="relative pl-4 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200/60">
                        {timelineData.map((item, index) => (
                            <div key={index} className={`relative pl-10 ${item.predicted ? 'opacity-60' : ''}`}>
                                {/* Node */}
                                <div className={`absolute left-0 top-1 w-10 h-10 bg-white border-4 rounded-full flex items-center justify-center z-10 shadow-sm ${item.normal ? 'border-slate-50' : 'border-rose-50'}`}>
                                    <div className={`w-3 h-3 rounded-full ${item.predicted ? 'bg-slate-300' : item.normal ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`}></div>
                                </div>
                                
                                {/* Card */}
                                <div className={`p-5 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border ${
                                    item.predicted 
                                        ? 'bg-slate-50 border-slate-100 border-dashed' 
                                        : item.normal 
                                            ? 'bg-white border-slate-100' 
                                            : 'bg-white border-rose-100 ring-1 ring-rose-50'
                                }`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className={`text-base font-bold ${item.normal ? 'text-slate-800' : 'text-rose-600'}`}>
                                            {item.title}
                                        </h4>
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${item.normal ? 'text-slate-400 bg-slate-50' : 'text-rose-500 bg-rose-50'}`}>
                                            {item.time}
                                        </span>
                                    </div>
                                    
                                    {!item.predicted && (
                                        <>
                                            <div className="flex gap-4 mt-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">心率</span>
                                                    <span className={`text-sm font-bold ${item.heartRate > 100 ? 'text-rose-500' : 'text-slate-600'}`}>
                                                        {item.heartRate} bpm
                                                    </span>
                                                </div>
                                                <div className="w-px h-8 bg-slate-100"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">血压</span>
                                                    <span className="text-sm font-bold text-slate-600">{item.bloodPressure}</span>
                                                </div>
                                            </div>
                                            {item.description && (
                                                <p className="text-sm text-slate-500 leading-relaxed mt-3">
                                                    {item.description}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    )}
                </div>

                {/* Location Info */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-8">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-3">
                        <MapPin size={14} />
                        当前位置
                    </div>
                    <p className="text-lg font-bold text-slate-800">{data.location || '幸福社区公园'}</p>
                    <p className="text-sm text-slate-500 mt-1">{data.activity || '散步中'}</p>
                </div>

                {/* 无联系人提示 */}
                {showNoContactAlert && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
                        <AlertCircle size={20} className="text-amber-500" />
                        <span className="text-amber-700 text-sm font-bold">请先在个人中心添加紧急联系人</span>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4 pb-6">
                    <button 
                        onClick={handleEmergencyCall}
                        className="bg-rose-500 text-white py-4 rounded-2xl font-bold flex flex-col justify-center items-center gap-1 active:scale-95 transition-transform shadow-lg shadow-rose-200"
                    >
                        <div className="flex items-center gap-2">
                            <Phone size={20} />
                            一键呼叫
                        </div>
                        {primaryContact && (
                            <span className="text-xs text-rose-200 font-normal">{primaryContact.name}</span>
                        )}
                    </button>
                    <button 
                        onClick={onClose}
                        className="bg-slate-900 text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-slate-200"
                    >
                        <X size={18} />
                        关闭
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ReportModal;
