export const NORMAL_DATA = {
    status: 'safe',
    heartRate: 72,
    bloodPressure: '120/80',
    stepCount: 3500,
    location: '幸福社区公园',
    activity: '散步 (符合日常规律)',
    riskLevel: '低',
    battery: 85,
    lastUpdate: '刚刚',
    message: '父亲正在公园进行日常晨练，各项指标正常。'
};

export const ALERT_DATA = {
    status: 'danger',
    heartRate: 115,
    bloodPressure: '145/95',
    stepCount: 8200,
    location: '滨河路东段 (非日常区域)',
    activity: '快速移动 (步频异常)',
    riskLevel: '高',
    battery: 82,
    lastUpdate: '1分钟前',
    message: '检测到偏离常规路线，且心率与步频骤升，疑似迷路或突发状况！'
};

export const HISTORY_ALERTS = [
    { id: 1, type: 'info', title: '日常行为报告', desc: '父亲已结束晨练返回家中，今日运动量达标。', time: '上午 10:30', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 2, type: 'system', title: '设备电量充足', desc: '智能手环昨夜已充满电，当前电量 100%。', time: '上午 07:00', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 3, type: 'warning', title: '轻微血压波动', desc: '昨日晚间检测到血压轻微升高 (135/90)，请留意饮食。', time: '昨天 20:15', color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 4, type: 'info', title: '到达常去地点', desc: '检测到到达“幸福社区菜市场”。', time: '昨天 15:20', color: 'text-blue-600', bg: 'bg-blue-50' },
];
