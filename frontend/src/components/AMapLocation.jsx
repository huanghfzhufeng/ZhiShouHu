import React, { useEffect, useRef, useState } from 'react';

/**
 * 高德地图位置追踪组件
 * 
 * 使用方法：
 * 1. 在 .env 中配置 VITE_AMAP_KEY=你的高德地图Key
 * 2. 高德地图申请地址: https://lbs.amap.com/
 */
const AMapLocation = ({ 
    latitude = 30.2741, 
    longitude = 120.1551, 
    status = 'safe',
    locationName = '当前位置',
    safeZoneRadius = 500,  // 安全区域半径（米）
    showSafeZone = true,
    height = '192px'
}) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    const circleRef = useRef(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [error, setError] = useState(null);

    // 加载高德地图 SDK
    useEffect(() => {
        const amapKey = import.meta.env.VITE_AMAP_KEY;
        
        if (!amapKey) {
            setError('请配置高德地图 API Key (VITE_AMAP_KEY)');
            return;
        }

        // 检查是否已加载
        if (window.AMap) {
            setMapLoaded(true);
            return;
        }

        // 动态加载高德地图
        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}`;
        script.async = true;
        script.onload = () => {
            setMapLoaded(true);
        };
        script.onerror = () => {
            setError('地图加载失败');
        };
        document.head.appendChild(script);

        return () => {
            // 清理时不移除脚本，因为其他组件可能需要
        };
    }, []);

    // 初始化地图
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !window.AMap) return;

        // 如果地图已存在，只更新位置
        if (mapInstanceRef.current) {
            updateLocation();
            return;
        }

        // 创建地图实例
        const map = new window.AMap.Map(mapRef.current, {
            zoom: 16,
            center: [longitude, latitude],
            mapStyle: 'amap://styles/light', // 使用浅色主题
            viewMode: '2D',
        });

        mapInstanceRef.current = map;

        // 创建位置标记
        const marker = new window.AMap.Marker({
            position: [longitude, latitude],
            title: locationName,
            animation: 'AMAP_ANIMATION_DROP',
        });

        // 自定义标记样式
        const markerContent = document.createElement('div');
        markerContent.className = 'custom-marker';
        markerContent.innerHTML = `
            <div style="
                width: 24px;
                height: 24px;
                background: ${status === 'safe' ? '#10b981' : '#f43f5e'};
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                position: relative;
            ">
                <div style="
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: ${status === 'safe' ? '#10b981' : '#f43f5e'};
                    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                    opacity: 0.75;
                "></div>
            </div>
        `;
        marker.setContent(markerContent);
        marker.setMap(map);
        markerRef.current = marker;

        // 如果启用安全区域显示
        if (showSafeZone) {
            const circle = new window.AMap.Circle({
                center: [longitude, latitude],
                radius: safeZoneRadius,
                strokeColor: status === 'safe' ? '#10b981' : '#f43f5e',
                strokeOpacity: 0.5,
                strokeWeight: 2,
                fillColor: status === 'safe' ? '#10b981' : '#f43f5e',
                fillOpacity: 0.1,
            });
            circle.setMap(map);
            circleRef.current = circle;
        }

        // 添加信息窗口
        const infoWindow = new window.AMap.InfoWindow({
            content: `<div style="padding: 8px; font-size: 12px;">
                <strong>${locationName}</strong><br/>
                <span style="color: ${status === 'safe' ? '#10b981' : '#f43f5e'}">
                    ${status === 'safe' ? '● 正常活动范围内' : '● 偏离常规区域'}
                </span>
            </div>`,
            offset: new window.AMap.Pixel(0, -30),
        });

        marker.on('click', () => {
            infoWindow.open(map, marker.getPosition());
        });

        // 添加 ping 动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ping {
                75%, 100% {
                    transform: scale(2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);

    }, [mapLoaded]);

    // 更新位置
    const updateLocation = () => {
        if (!mapInstanceRef.current || !markerRef.current) return;

        const position = [longitude, latitude];
        
        // 平滑移动到新位置
        mapInstanceRef.current.setCenter(position);
        markerRef.current.setPosition(position);

        // 更新标记颜色
        const markerContent = document.createElement('div');
        markerContent.innerHTML = `
            <div style="
                width: 24px;
                height: 24px;
                background: ${status === 'safe' ? '#10b981' : '#f43f5e'};
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                position: relative;
            ">
                <div style="
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: ${status === 'safe' ? '#10b981' : '#f43f5e'};
                    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                    opacity: 0.75;
                "></div>
            </div>
        `;
        markerRef.current.setContent(markerContent);

        // 更新安全区域颜色
        if (circleRef.current) {
            circleRef.current.setOptions({
                strokeColor: status === 'safe' ? '#10b981' : '#f43f5e',
                fillColor: status === 'safe' ? '#10b981' : '#f43f5e',
            });
        }
    };

    // 监听位置和状态变化
    useEffect(() => {
        if (mapLoaded && mapInstanceRef.current) {
            updateLocation();
        }
    }, [latitude, longitude, status, mapLoaded]);

    // 如果没有配置 API Key，显示占位符
    if (error) {
        return (
            <div 
                style={{ height }} 
                className="bg-slate-100/80 rounded-3xl relative overflow-hidden border border-slate-200/50 flex items-center justify-center"
            >
                <div className="text-center p-4">
                    <p className="text-slate-400 text-sm font-medium">{error}</p>
                    <p className="text-slate-300 text-xs mt-1">
                        申请地址: <a href="https://lbs.amap.com/" target="_blank" rel="noopener" className="text-indigo-400 hover:underline">lbs.amap.com</a>
                    </p>
                </div>
            </div>
        );
    }

    // 加载中状态
    if (!mapLoaded) {
        return (
            <div 
                style={{ height }} 
                className="bg-slate-100/80 rounded-3xl relative overflow-hidden border border-slate-200/50 flex items-center justify-center"
            >
                <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">加载地图...</span>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={mapRef}
            style={{ height }}
            className="rounded-3xl overflow-hidden border border-slate-200/50"
        />
    );
};

export default AMapLocation;
