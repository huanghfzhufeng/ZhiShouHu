import React from 'react';
// Import custom icons
import iconProfile from '../assets/icons/个人中心.png';
import iconNotify from '../assets/icons/通知.png';
// Using standard Lucide icons for others or mapping available PNGs
// Generic mapping based on available filenames:
// 成长.png -> Analysis?
// 连接.png -> Home? 
// 聚合.png -> Dashboard?
import iconAnalysis from '../assets/icons/成长.png';
import iconHome from '../assets/icons/连接.png';

const BottomNav = ({ activeTab, setActiveTab, isSimulationMode }) => {
    return (
        <div className="bg-white/90 backdrop-blur-lg border-t border-slate-200 px-6 py-3 flex justify-between items-center pb-8 fixed bottom-0 left-0 right-0 z-20">

            {/* Home / Guardian */}
            <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'home' ? 'text-teal-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <div className="w-7 h-7 overflow-hidden">
                    <img src={iconHome} alt="Home" className={`w-full h-full object-contain ${activeTab === 'home' ? 'opacity-100' : 'opacity-50 grayscale'}`} />
                </div>
                <span className="text-[10px] font-bold">守护</span>
            </button>

            {/* Analysis */}
            <button
                onClick={() => setActiveTab('analysis')}
                className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'analysis' ? 'text-teal-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <div className="w-7 h-7 overflow-hidden">
                    <img src={iconAnalysis} alt="Analysis" className={`w-full h-full object-contain ${activeTab === 'analysis' ? 'opacity-100' : 'opacity-50 grayscale'}`} />
                </div>
                <span className="text-[10px] font-bold">分析</span>
            </button>

            {/* Alerts */}
            <button
                onClick={() => setActiveTab('alerts')}
                className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative ${activeTab === 'alerts' ? 'text-teal-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <div className="relative w-7 h-7">
                    <img src={iconNotify} alt="Alerts" className={`w-full h-full object-contain ${activeTab === 'alerts' ? 'opacity-100' : 'opacity-50 grayscale'}`} />
                    {isSimulationMode && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm"></span>}
                </div>
                <span className="text-[10px] font-bold">消息</span>
            </button>

            {/* Profile */}
            <button
                onClick={() => setActiveTab('profile')}
                className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'profile' ? 'text-teal-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <div className="w-7 h-7 overflow-hidden">
                    <img src={iconProfile} alt="Profile" className={`w-full h-full object-contain ${activeTab === 'profile' ? 'opacity-100' : 'opacity-50 grayscale'}`} />
                </div>
                <span className="text-[10px] font-bold">我的</span>
            </button>
        </div>
    );
};

export default BottomNav;