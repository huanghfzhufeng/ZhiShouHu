import React, { useEffect, useState } from 'react';
import { 
    Brain, Heart, Activity, Footprints, MapPin, Clock, Sun, Moon, 
    AlertTriangle, CheckCircle, RefreshCw, ArrowLeft, Zap, TrendingUp,
    Home, TreePine, ShoppingBag, Sparkles, Shield, Calendar
} from 'lucide-react';
import { baselineApi, getStoredUser, authApi } from '../services/api';

const HealthProfilePage = ({ onBack }) => {
    const [profile, setProfile] = useState(null);
    const [comparison, setComparison] = useState(null);
    const [loading, setLoading] = useState(true);
    const [learningInProgress, setLearningInProgress] = useState(false);
    const [elderName, setElderName] = useState('老人');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const user = getStoredUser();
            if (!user?.elder_id) return;

            // 获取老人信息
            try {
                const elderInfo = await authApi.getMyElder();
                setElderName(elderInfo.username || '老人');
            } catch (e) {
                console.warn('Failed to load elder info');
            }

            // 获取健康画像
            try {
                const profileData = await baselineApi.getProfile(user.elder_id);
                setProfile(profileData);
            } catch (e) {
                console.log('No profile yet');
                setProfile(null);
            }

            // 获取对比数据
            try {
                const compData = await baselineApi.getComparison(user.elder_id);
                setComparison(compData);
            } catch (e) {
                console.log('No comparison data');
            }
        } catch (error) {
            console.error('Failed to load health profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTriggerLearning = async () => {
        const user = getStoredUser();
        if (!user?.elder_id) return;

        setLearningInProgress(true);
        try {
            const result = await baselineApi.triggerLearning(user.elder_id, 30);
            setProfile(result);
            // 重新加载对比数据
            const compData = await baselineApi.getComparison(user.elder_id);
            setComparison(compData);
        } catch (error) {
            console.error('Learning failed:', error);
            alert(error.response?.data?.detail || 'AI 学习失败，请确保有足够的历史数据（至少10条）');
        } finally {
            setLearningInProgress(false);
        }
    };

    const getDataQualityInfo = (quality) => {
        const map = {
            'excellent': { label: '优秀', color: 'text-emerald-600', bg: 'bg-emerald-100' },
            'good': { label: '良好', color: 'text-blue-600', bg: 'bg-blue-100' },
            'fair': { label: '一般', color: 'text-amber-600', bg: 'bg-amber-100' },
            'insufficient': { label: '不足', color: 'text-slate-500', bg: 'bg-slate-100' }
        };
        return map[quality] || map['insufficient'];
    };

    const parseJsonField = (field) => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        try {
            return JSON.parse(field);
        } catch {
            return [];
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600 mx-auto mb-3"></div>
                    <p className="text-slate-500 text-sm">加载健康档案...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-slate-50 pb-24">
            {/* 顶部导航 */}
            <div className="bg-white/80 backdrop-blur-xl px-4 pt-12 pb-4 sticky top-0 z-10 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-slate-800">{elderName}的健康档案</h1>
                        <p className="text-xs text-slate-500">AI 个性化健康画像</p>
                    </div>
                    <button
                        onClick={handleTriggerLearning}
                        disabled={learningInProgress}
                        className="flex items-center gap-1.5 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 rounded-xl shadow-lg shadow-cyan-200 hover:shadow-xl transition-all disabled:opacity-50"
                    >
                        {learningInProgress ? (
                            <><RefreshCw size={16} className="animate-spin" /> 学习中</>
                        ) : (
                            <><Zap size={16} /> 更新画像</>
                        )}
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {!profile ? (
                    /* 未建立画像时的引导界面 */
                    <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
                        <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <Brain size={40} className="text-cyan-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">尚未建立健康档案</h2>
                        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                            点击「更新画像」让 AI 分析历史健康数据，<br/>
                            建立专属的个性化健康基线
                        </p>
                        <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Sparkles size={16} className="text-cyan-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700">个性化阈值</p>
                                    <p className="text-xs text-slate-500">根据个人数据自动计算健康阈值</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Shield size={16} className="text-teal-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700">精准预警</p>
                                    <p className="text-xs text-slate-500">减少误报，提高异常检测准确性</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-4">需要至少 10 条健康记录才能开始学习</p>
                    </div>
                ) : (
                    <>
                        {/* 画像概览卡片 */}
                        <div className="bg-gradient-to-br from-cyan-500 to-teal-600 rounded-3xl p-5 text-white shadow-xl shadow-cyan-200/50 relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                            
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                        <Brain size={24} />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-lg">AI 健康画像</h2>
                                        <p className="text-cyan-100 text-xs">
                                            基于 {profile.learning_days || 30} 天数据学习
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black">
                                        {Math.round((profile.confidence_score || 0) * 100)}%
                                    </div>
                                    <div className="text-xs text-cyan-100">置信度</div>
                                </div>
                            </div>

                            {/* 数据质量 */}
                            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 relative z-10">
                                <Calendar size={14} />
                                <span className="text-sm">
                                    数据质量：
                                    <span className={`font-bold ml-1 ${getDataQualityInfo(profile.data_quality).color} bg-white/20 px-2 py-0.5 rounded`}>
                                        {getDataQualityInfo(profile.data_quality).label}
                                    </span>
                                </span>
                                {profile.last_learning_at && (
                                    <span className="text-xs text-cyan-200 ml-auto">
                                        更新于 {new Date(profile.last_learning_at).toLocaleDateString()}
                                    </span>
                                )}
                            </div>

                            {/* 健康摘要 */}
                            {profile.health_summary && (
                                <div className="mt-4 bg-white/10 rounded-xl p-3 relative z-10">
                                    <p className="text-sm leading-relaxed">{profile.health_summary}</p>
                                </div>
                            )}
                        </div>

                        {/* 生理基线 */}
                        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                <Heart size={18} className="text-rose-500" />
                                生理基线
                            </h3>
                            
                            <div className="space-y-4">
                                {/* 心率基线 */}
                                <div className="bg-rose-50 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-rose-700">心率范围</span>
                                        <span className="text-xs text-rose-500">
                                            平均 {profile.learned_hr_mean?.toFixed(0) || '--'} bpm
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-black text-rose-600">
                                            {profile.learned_hr_low?.toFixed(0) || '--'}
                                        </span>
                                        <div className="flex-1 h-2 bg-rose-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full"
                                                style={{ 
                                                    marginLeft: `${((profile.learned_hr_low || 60) - 40) / 100 * 100}%`,
                                                    width: `${((profile.learned_hr_high || 100) - (profile.learned_hr_low || 60)) / 100 * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                        <span className="text-2xl font-black text-rose-600">
                                            {profile.learned_hr_high?.toFixed(0) || '--'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between mt-2 text-xs text-rose-400">
                                        <span>静息 {profile.resting_hr?.toFixed(0) || '--'} bpm</span>
                                        <span>单位: bpm</span>
                                    </div>
                                    
                                    {/* 当前值对比 */}
                                    {comparison?.current?.heart_rate && (
                                        <div className="mt-3 pt-3 border-t border-rose-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-rose-500">当前心率</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-lg font-black ${
                                                        comparison.comparison?.heart_rate?.status !== '正常' 
                                                            ? 'text-rose-600' 
                                                            : 'text-emerald-600'
                                                    }`}>
                                                        {comparison.current.heart_rate} bpm
                                                    </span>
                                                    {comparison.comparison?.heart_rate?.status === '正常' ? (
                                                        <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                                                            ✓ 正常
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                                                            ↑ {comparison.comparison?.heart_rate?.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 血压基线 */}
                                <div className="bg-orange-50 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-orange-700">血压基线</span>
                                        <Activity size={16} className="text-orange-400" />
                                    </div>
                                    <div className="text-2xl font-black text-orange-600">
                                        {profile.learned_systolic_mean?.toFixed(0) || '--'}/{profile.learned_diastolic_mean?.toFixed(0) || '--'}
                                        <span className="text-sm font-bold text-orange-400 ml-2">mmHg</span>
                                    </div>
                                    {comparison?.current?.systolic_bp && (
                                        <div className="mt-2 text-xs text-orange-500">
                                            当前: {comparison.current.systolic_bp}/{comparison.current.diastolic_bp} mmHg
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 活动规律 */}
                        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                <Footprints size={18} className="text-blue-500" />
                                活动规律
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-amber-50 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sun size={16} className="text-amber-500" />
                                        <span className="text-xs font-bold text-amber-600">起床时间</span>
                                    </div>
                                    <div className="text-xl font-black text-amber-700">
                                        {profile.wake_time || '06:30'}
                                    </div>
                                </div>
                                <div className="bg-indigo-50 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Moon size={16} className="text-indigo-500" />
                                        <span className="text-xs font-bold text-indigo-600">入睡时间</span>
                                    </div>
                                    <div className="text-xl font-black text-indigo-700">
                                        {profile.sleep_time || '21:30'}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-2xl p-4 mt-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-blue-700">日均步数</span>
                                    <TrendingUp size={16} className="text-blue-400" />
                                </div>
                                <div className="text-2xl font-black text-blue-600">
                                    {profile.daily_steps_mean?.toLocaleString() || '--'}
                                    <span className="text-sm font-bold text-blue-400 ml-2">步</span>
                                </div>
                                {comparison?.current?.steps !== undefined && (
                                    <div className="mt-2 text-xs text-blue-500">
                                        今日: {comparison.current.steps?.toLocaleString()} 步
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 位置习惯 */}
                        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                <MapPin size={18} className="text-emerald-500" />
                                位置习惯
                            </h3>
                            
                            <div className="space-y-3">
                                <div className="flex items-center justify-between bg-emerald-50 rounded-xl p-3">
                                    <div className="flex items-center gap-3">
                                        <Home size={18} className="text-emerald-500" />
                                        <span className="text-sm font-bold text-emerald-700">在家比例</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-2 bg-emerald-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${(profile.home_stay_ratio || 0.7) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-sm font-black text-emerald-600">
                                            {Math.round((profile.home_stay_ratio || 0.7) * 100)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                                    <div className="flex items-center gap-3">
                                        <Clock size={18} className="text-slate-500" />
                                        <span className="text-sm font-bold text-slate-700">外出偏好</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 bg-white px-3 py-1 rounded-lg">
                                        {profile.outdoor_preference === 'morning' ? '🌅 上午' : 
                                         profile.outdoor_preference === 'afternoon' ? '☀️ 下午' : '🌙 傍晚'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* AI 风险评估 */}
                        {(parseJsonField(profile.risk_factors).length > 0 || parseJsonField(profile.personalized_advice).length > 0) && (
                            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                    <Sparkles size={18} className="text-violet-500" />
                                    AI 健康建议
                                </h3>

                                {/* 风险因素 */}
                                {parseJsonField(profile.risk_factors).length > 0 && (
                                    <div className="mb-4">
                                        <div className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            识别的风险因素
                                        </div>
                                        <div className="space-y-2">
                                            {parseJsonField(profile.risk_factors).map((risk, i) => (
                                                <div key={i} className="flex items-start gap-2 bg-amber-50 rounded-xl p-3">
                                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0"></span>
                                                    <span className="text-sm text-amber-700">{risk}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 个性化建议 */}
                                {parseJsonField(profile.personalized_advice).length > 0 && (
                                    <div>
                                        <div className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-1">
                                            <CheckCircle size={12} />
                                            个性化建议
                                        </div>
                                        <div className="space-y-2">
                                            {parseJsonField(profile.personalized_advice).map((advice, i) => (
                                                <div key={i} className="flex items-start gap-2 bg-emerald-50 rounded-xl p-3">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></span>
                                                    <span className="text-sm text-emerald-700">{advice}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 技术说明 */}
                        <div className="bg-slate-100 rounded-2xl p-4 text-center">
                            <p className="text-xs text-slate-500">
                                💡 健康画像基于 AI 分析 {profile.total_records_analyzed || 0} 条历史数据生成
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                建议定期更新画像以获得更精准的个性化分析
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default HealthProfilePage;
