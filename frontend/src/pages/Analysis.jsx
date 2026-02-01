import React, { useEffect, useState } from 'react';
import { Heart, Activity, Footprints, MapPin, Clock, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Calendar, Sparkles, Send, FileText, Bot, X, ChevronDown, ChevronUp, Brain, RefreshCw, User, Zap } from 'lucide-react';
import { healthApi, aiApi, baselineApi, getStoredUser } from '../services/api';

const Analysis = () => {
    const [weeklyStats, setWeeklyStats] = useState(null);
    const [timelineData, setTimelineData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // AI 功能状态
    const [aiQuestion, setAiQuestion] = useState('');
    const [aiReply, setAiReply] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [weeklyReport, setWeeklyReport] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [showAiChat, setShowAiChat] = useState(true);
    
    // AI 健康画像状态
    const [healthProfile, setHealthProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [learningInProgress, setLearningInProgress] = useState(false);

    useEffect(() => {
        loadData();
        loadHealthProfile();
    }, []);

    const loadData = async () => {
        try {
            const user = getStoredUser();
            if (!user || !user.elder_id) {
                console.warn('No elder_id found for current user');
                setLoading(false);
                return;
            }
            const [stats, timeline] = await Promise.all([
                healthApi.getWeeklyStats(user.elder_id),
                healthApi.getDailyTimeline(user.elder_id)
            ]);
            setWeeklyStats(stats);
            setTimelineData(timeline.timeline || []);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadHealthProfile = async () => {
        try {
            const user = getStoredUser();
            if (!user || !user.elder_id) return;
            setProfileLoading(true);
            const data = await baselineApi.getComparison(user.elder_id);
            setHealthProfile(data);
        } catch (error) {
            console.log('No health profile yet:', error.message);
            setHealthProfile(null);
        } finally {
            setProfileLoading(false);
        }
    };

    const handleTriggerLearning = async () => {
        const user = getStoredUser();
        if (!user || !user.elder_id) return;
        
        setLearningInProgress(true);
        try {
            await baselineApi.triggerLearning(user.elder_id, 30);
            // 学习完成后重新加载画像
            await loadHealthProfile();
        } catch (error) {
            console.error('Baseline learning failed:', error);
            alert(error.response?.data?.detail || 'AI 学习失败，请确保有足够的历史数据');
        } finally {
            setLearningInProgress(false);
        }
    };

    const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
    const days = weeklyStats?.days || [];
    const summary = weeklyStats?.summary || {};

    // 计算统计数据
    const avgHeartRate = days.length > 0 
        ? Math.round(days.reduce((sum, d) => sum + d.avg_heart_rate, 0) / days.length) 
        : 0;
    const maxHeartRate = days.length > 0 
        ? Math.max(...days.map(d => d.max_heart_rate)) 
        : 0;
    const totalSteps = days.reduce((sum, d) => sum + d.total_steps, 0);
    const avgSteps = days.length > 0 ? Math.round(totalSteps / days.length) : 0;

    // 生成心率折线图的 SVG path
    const generateHeartRatePath = () => {
        if (days.length === 0) return '';
        const width = 280;
        const height = 80;
        const padding = 10;
        const maxHR = Math.max(...days.map(d => d.max_heart_rate), 100);
        const minHR = Math.min(...days.map(d => d.avg_heart_rate), 60);
        const range = maxHR - minHR || 1;
        
        const points = days.map((d, i) => {
            const x = padding + (i / (days.length - 1 || 1)) * (width - padding * 2);
            const y = height - padding - ((d.avg_heart_rate - minHR) / range) * (height - padding * 2);
            return `${x},${y}`;
        });
        
        return `M ${points.join(' L ')}`;
    };

    // 生成血压数据路径
    const generateBPPath = () => {
        if (days.length === 0) return '';
        const width = 280;
        const height = 80;
        const padding = 10;
        const maxBP = Math.max(...days.map(d => d.avg_systolic_bp), 140);
        const minBP = Math.min(...days.map(d => d.avg_systolic_bp), 90);
        const range = maxBP - minBP || 1;
        
        const points = days.map((d, i) => {
            const x = padding + (i / (days.length - 1 || 1)) * (width - padding * 2);
            const y = height - padding - ((d.avg_systolic_bp - minBP) / range) * (height - padding * 2);
            return `${x},${y}`;
        });
        
        return `M ${points.join(' L ')}`;
    };

    return (
        <div className="p-6 space-y-5">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">健康数据分析</h2>

            {loading ? (
                <div className="h-60 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
            ) : (
                <>
                    {/* 数据概览卡片 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-4 rounded-2xl border border-rose-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Heart size={16} className="text-rose-500" />
                                <span className="text-xs font-bold text-rose-400">平均心率</span>
                            </div>
                            <div className="text-2xl font-black text-rose-600">{avgHeartRate}<span className="text-sm font-bold text-rose-400 ml-1">bpm</span></div>
                            <div className="text-[10px] text-rose-400 mt-1">最高 {maxHeartRate} bpm</div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Footprints size={16} className="text-blue-500" />
                                <span className="text-xs font-bold text-blue-400">日均步数</span>
                            </div>
                            <div className="text-2xl font-black text-blue-600">{avgSteps.toLocaleString()}<span className="text-sm font-bold text-blue-400 ml-1">步</span></div>
                            <div className="text-[10px] text-blue-400 mt-1">本周共 {totalSteps.toLocaleString()} 步</div>
                        </div>
                    </div>

                    {/* 健康状态评估 */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Calendar size={18} className="text-slate-400" />
                                7日健康评估
                            </h3>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                summary.anomaly_days > 2 
                                    ? 'bg-rose-100 text-rose-600' 
                                    : summary.anomaly_days > 0 
                                        ? 'bg-amber-100 text-amber-600' 
                                        : 'bg-emerald-100 text-emerald-600'
                            }`}>
                                {summary.anomaly_days > 2 ? '需要关注' : summary.anomaly_days > 0 ? '轻微异常' : '状态良好'}
                            </span>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">监测记录</span>
                                <span className="font-bold text-slate-700">{summary.total_records || 0} 条</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">异常天数</span>
                                <span className={`font-bold ${summary.anomaly_days > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {summary.anomaly_days || 0} 天
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">数据完整度</span>
                                <span className="font-bold text-slate-700">
                                    {days.length > 0 ? Math.round((days.length / 7) * 100) : 0}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 心率趋势图 */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Heart size={18} className="text-rose-400" />
                            心率趋势
                        </h3>
                        {days.length > 0 ? (
                            <>
                                <div className="relative h-24 mb-2">
                                    <svg className="w-full h-full" viewBox="0 0 280 80" preserveAspectRatio="none">
                                        {/* 背景网格 */}
                                        <line x1="10" y1="20" x2="270" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                                        <line x1="10" y1="40" x2="270" y2="40" stroke="#f1f5f9" strokeWidth="1" />
                                        <line x1="10" y1="60" x2="270" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                                        
                                        {/* 心率曲线 */}
                                        <path 
                                            d={generateHeartRatePath()} 
                                            fill="none" 
                                            stroke="#f43f5e" 
                                            strokeWidth="2.5" 
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        
                                        {/* 数据点 */}
                                        {days.map((d, i) => {
                                            const maxHR = Math.max(...days.map(d => d.max_heart_rate), 100);
                                            const minHR = Math.min(...days.map(d => d.avg_heart_rate), 60);
                                            const range = maxHR - minHR || 1;
                                            const x = 10 + (i / (days.length - 1 || 1)) * 260;
                                            const y = 70 - ((d.avg_heart_rate - minHR) / range) * 60;
                                            return (
                                                <circle 
                                                    key={i} 
                                                    cx={x} 
                                                    cy={y} 
                                                    r="4" 
                                                    fill={d.max_heart_rate > 100 ? '#f43f5e' : '#fb7185'}
                                                    stroke="white"
                                                    strokeWidth="2"
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>
                                <div className="flex justify-between px-1">
                                    {days.slice(-7).map((d, i) => (
                                        <div key={i} className="text-center">
                                            <div className="text-[10px] text-slate-400 font-bold">{weekDays[i]}</div>
                                            <div className={`text-[10px] font-bold ${d.max_heart_rate > 100 ? 'text-rose-500' : 'text-slate-500'}`}>
                                                {d.avg_heart_rate}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-24 flex items-center justify-center text-slate-400 text-sm">暂无数据</div>
                        )}
                    </div>

                    {/* 血压趋势图 */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Activity size={18} className="text-orange-400" />
                            血压趋势 (收缩压)
                        </h3>
                        {days.length > 0 ? (
                            <>
                                <div className="relative h-24 mb-2">
                                    <svg className="w-full h-full" viewBox="0 0 280 80" preserveAspectRatio="none">
                                        <line x1="10" y1="20" x2="270" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                                        <line x1="10" y1="40" x2="270" y2="40" stroke="#f1f5f9" strokeWidth="1" />
                                        <line x1="10" y1="60" x2="270" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                                        
                                        <path 
                                            d={generateBPPath()} 
                                            fill="none" 
                                            stroke="#f97316" 
                                            strokeWidth="2.5" 
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        
                                        {days.map((d, i) => {
                                            const maxBP = Math.max(...days.map(d => d.avg_systolic_bp), 140);
                                            const minBP = Math.min(...days.map(d => d.avg_systolic_bp), 90);
                                            const range = maxBP - minBP || 1;
                                            const x = 10 + (i / (days.length - 1 || 1)) * 260;
                                            const y = 70 - ((d.avg_systolic_bp - minBP) / range) * 60;
                                            return (
                                                <circle 
                                                    key={i} 
                                                    cx={x} 
                                                    cy={y} 
                                                    r="4" 
                                                    fill={d.avg_systolic_bp > 135 ? '#f97316' : '#fb923c'}
                                                    stroke="white"
                                                    strokeWidth="2"
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>
                                <div className="flex justify-between px-1">
                                    {days.slice(-7).map((d, i) => (
                                        <div key={i} className="text-center">
                                            <div className="text-[10px] text-slate-400 font-bold">{weekDays[i]}</div>
                                            <div className={`text-[10px] font-bold ${d.avg_systolic_bp > 135 ? 'text-orange-500' : 'text-slate-500'}`}>
                                                {d.avg_systolic_bp}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-24 flex items-center justify-center text-slate-400 text-sm">暂无数据</div>
                        )}
                    </div>

                    {/* AI 健康画像卡片 */}
                    <div className="bg-gradient-to-br from-cyan-50 to-teal-50 p-5 rounded-2xl border border-cyan-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-cyan-700 flex items-center gap-2">
                                <Brain size={18} className="text-cyan-500" />
                                AI 个性化健康画像
                            </h3>
                            <button
                                onClick={handleTriggerLearning}
                                disabled={learningInProgress}
                                className="flex items-center gap-1 text-xs font-bold text-cyan-600 bg-white px-3 py-1.5 rounded-full border border-cyan-200 hover:bg-cyan-50 transition-colors disabled:opacity-50"
                            >
                                {learningInProgress ? (
                                    <><RefreshCw size={12} className="animate-spin" /> 学习中...</>
                                ) : (
                                    <><Zap size={12} /> 触发学习</>
                                )}
                            </button>
                        </div>
                        
                        {profileLoading ? (
                            <div className="h-24 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600"></div>
                            </div>
                        ) : healthProfile?.has_profile ? (
                            <div className="space-y-4">
                                {/* 基线对比 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white p-3 rounded-xl border border-cyan-100">
                                        <div className="text-[10px] text-cyan-500 font-bold mb-1">当前心率</div>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-xl font-black ${healthProfile.comparison?.heart_rate?.status !== '正常' ? 'text-rose-500' : 'text-cyan-700'}`}>
                                                {healthProfile.current?.heart_rate}
                                            </span>
                                            <span className="text-xs text-slate-400">bpm</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1">
                                            个人基线: {healthProfile.baseline?.heart_rate_range} bpm
                                        </div>
                                        {healthProfile.comparison?.heart_rate?.deviation_percent > 0 && (
                                            <div className={`text-[10px] mt-1 font-bold ${healthProfile.comparison?.heart_rate?.status !== '正常' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {healthProfile.comparison?.heart_rate?.status === '正常' ? '✓ 在正常范围' : `↑ 偏离 ${healthProfile.comparison?.heart_rate?.deviation_percent}%`}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-cyan-100">
                                        <div className="text-[10px] text-cyan-500 font-bold mb-1">今日步数</div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black text-cyan-700">
                                                {healthProfile.current?.steps?.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-slate-400">步</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1">
                                            日均: {healthProfile.baseline?.daily_steps_mean?.toLocaleString()} 步
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 健康摘要 */}
                                {healthProfile.profile_summary?.health_summary && (
                                    <div className="bg-white p-3 rounded-xl border border-cyan-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User size={14} className="text-cyan-500" />
                                            <span className="text-xs font-bold text-cyan-600">AI 分析结论</span>
                                            <span className="text-[10px] text-slate-400 ml-auto">
                                                置信度 {Math.round((healthProfile.profile_summary?.confidence || 0) * 100)}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            {healthProfile.profile_summary?.health_summary}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white/60 p-4 rounded-xl text-center">
                                <Brain size={32} className="text-cyan-300 mx-auto mb-2" />
                                <p className="text-sm text-cyan-600 font-bold">尚未建立个人健康画像</p>
                                <p className="text-xs text-slate-500 mt-1">点击“触发学习”让 AI 分析历史数据</p>
                                <p className="text-[10px] text-slate-400 mt-1">需要至少 10 条健康记录</p>
                            </div>
                        )}
                    </div>

                    {/* 今日活动时间线 */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Clock size={18} className="text-indigo-400" />
                            今日活动轨迹
                        </h3>
                        {timelineData.length > 0 ? (
                            <div className="space-y-3 max-h-48 overflow-y-auto">
                                {timelineData.filter(e => !e.predicted).slice(0, 8).map((event, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-3 h-3 rounded-full ${event.activity?.includes('异常') ? 'bg-rose-400' : 'bg-teal-400'}`}></div>
                                            {i < Math.min(timelineData.filter(e => !e.predicted).length, 8) - 1 && (
                                                <div className="w-0.5 h-8 bg-slate-200"></div>
                                            )}
                                        </div>
                                        <div className="flex-1 pb-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-slate-700">{event.location || '未知位置'}</span>
                                                <span className="text-xs text-slate-400 font-medium">{event.time}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {event.activity} · 心率 {event.heart_rate} bpm
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-24 flex items-center justify-center text-slate-400 text-sm">今日暂无活动记录</div>
                        )}
                    </div>

                    {/* AI 智能助手区域 */}
                    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 p-5 rounded-2xl border border-violet-200">
                        <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setShowAiChat(!showAiChat)}
                        >
                            <h3 className="font-bold text-violet-700 flex items-center gap-2">
                                <Sparkles size={18} className="text-violet-500" />
                                AI 健康助手
                            </h3>
                            <button className="text-violet-400 hover:text-violet-600">
                                {showAiChat ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                        </div>
                        
                        {showAiChat && (
                            <div className="mt-4 space-y-4">
                                {/* 智能周报按钮 */}
                                <button
                                    onClick={async () => {
                                        const user = getStoredUser();
                                        if (!user?.elder_id) return;
                                        setReportLoading(true);
                                        setShowReport(true);
                                        try {
                                            const data = await aiApi.getWeeklyReport(user.elder_id);
                                            setWeeklyReport(data);
                                        } catch (e) {
                                            setWeeklyReport({ report: '生成报告失败，请稍后重试', has_ai: false });
                                        } finally {
                                            setReportLoading(false);
                                        }
                                    }}
                                    disabled={reportLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-white text-violet-600 py-3 rounded-xl font-bold text-sm border border-violet-200 hover:bg-violet-50 transition-colors disabled:opacity-50"
                                >
                                    <FileText size={16} />
                                    {reportLoading ? '生成中...' : '生成 AI 智能周报'}
                                </button>
                                
                                {/* AI 对话输入 */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={aiQuestion}
                                        onChange={(e) => setAiQuestion(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && aiQuestion.trim()) {
                                                handleAiChat();
                                            }
                                        }}
                                        placeholder="问问 AI，如“父亲今天状态怎么样？”"
                                        className="flex-1 bg-white border border-violet-200 rounded-xl py-2.5 px-4 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    />
                                    <button
                                        onClick={handleAiChat}
                                        disabled={aiLoading || !aiQuestion.trim()}
                                        className="px-4 bg-violet-500 text-white rounded-xl hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {aiLoading ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <Send size={16} />
                                        )}
                                    </button>
                                </div>
                                
                                {/* AI 回复 */}
                                {aiReply && (
                                    <div className="bg-white rounded-xl p-4 border border-violet-100">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                                                <Bot size={16} className="text-violet-500" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-slate-700 leading-relaxed">{aiReply.reply}</p>
                                                {aiReply.suggestions && aiReply.suggestions.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {aiReply.suggestions.slice(0, 2).map((s, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => {
                                                                    setAiQuestion(s);
                                                                }}
                                                                className="text-[10px] text-violet-500 bg-violet-50 px-2 py-1 rounded-full hover:bg-violet-100 transition-colors"
                                                            >
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 健康建议 */}
                    <div className={`p-4 rounded-2xl border ${
                        summary.anomaly_days > 0 
                            ? 'bg-amber-50 border-amber-200' 
                            : 'bg-emerald-50 border-emerald-200'
                    }`}>
                        <div className="flex items-start gap-3">
                            {summary.anomaly_days > 0 ? (
                                <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            ) : (
                                <CheckCircle size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                                <h4 className={`text-sm font-bold ${summary.anomaly_days > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    {summary.anomaly_days > 0 ? '健康提醒' : '健康状态良好'}
                                </h4>
                                <p className={`text-xs mt-1 ${summary.anomaly_days > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {summary.anomaly_days > 0 
                                        ? `过去7天检测到 ${summary.anomaly_days} 天存在指标异常，建议关注老人日常作息，必要时咨询医生。`
                                        : `过去7天各项生理指标保持稳定，平均心率 ${avgHeartRate} bpm，日均步数 ${avgSteps}，生活规律良好。`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* AI 周报弹窗 */}
            {showReport && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Sparkles size={18} className="text-violet-500" />
                                AI 智能周报
                            </h3>
                            <button 
                                onClick={() => setShowReport(false)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            {reportLoading ? (
                                <div className="text-center py-10">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mb-3"></div>
                                    <p className="text-slate-500 text-sm">AI 正在分析健康数据...</p>
                                </div>
                            ) : weeklyReport ? (
                                <div className="space-y-4">
                                    {!weeklyReport.has_ai && (
                                        <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                                            💡 未配置 AI API，显示基础分析报告
                                        </div>
                                    )}
                                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                        {weeklyReport.report}
                                    </div>
                                    {weeklyReport.generated_at && (
                                        <div className="text-[10px] text-slate-400 text-right">
                                            生成时间: {weeklyReport.generated_at}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-400">加载失败</div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100">
                            <button
                                onClick={() => setShowReport(false)}
                                className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // AI 对话处理
    async function handleAiChat() {
        if (!aiQuestion.trim()) return;
        const user = getStoredUser();
        if (!user?.elder_id) return;
        
        setAiLoading(true);
        try {
            const data = await aiApi.chat(aiQuestion, user.elder_id);
            setAiReply(data);
            setAiQuestion('');
        } catch (e) {
            setAiReply({ reply: '抱歉，暂时无法回答，请稍后重试。', suggestions: [] });
        } finally {
            setAiLoading(false);
        }
    }
};

export default Analysis;
