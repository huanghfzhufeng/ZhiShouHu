import axios from 'axios';

// Backend API Base URL
// Hardcoded for APK to ensure it always points to the correct server
export const API_BASE_URL = 'http://1.15.122.48:8000/api';

// Token management
const TOKEN_KEY = 'guardian_token';
const USER_KEY = 'guardian_user';
const ELDER_ID_KEY = 'guardian_elder_id';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

export const getStoredUser = () => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
};
export const setStoredUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));
export const removeStoredUser = () => localStorage.removeItem(USER_KEY);

export const getElderId = () => {
    const user = getStoredUser();
    if (user && user.elder_id) {
        return user.elder_id;
    }
    return localStorage.getItem(ELDER_ID_KEY) || null;
};
export const setElderId = (id) => localStorage.setItem(ELDER_ID_KEY, id);

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Auth state change callback - set by App.jsx to handle logout
let onAuthStateChange = null;
export const setAuthStateChangeCallback = (callback) => {
    onAuthStateChange = callback;
};

// Response interceptor - handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            removeToken();
            removeStoredUser();
            // Notify app to update auth state
            if (onAuthStateChange) {
                onAuthStateChange(false);
            }
        }
        return Promise.reject(error);
    }
);

// ============ Auth API ============
export const authApi = {
    login: async (phone, password) => {
        const response = await api.post('/auth/login', { phone, password });
        const { access_token } = response.data;
        setToken(access_token);
        // Fetch user info after login
        const userInfo = await authApi.getMe();
        setStoredUser(userInfo);
        if (userInfo.elder_id) {
            setElderId(userInfo.elder_id);
        }
        return userInfo;
    },

    register: async (phone, password, username, elderId = null) => {
        const payload = {
            phone,
            password,
            username,
            role: 'guardian',
        };
        // Only include elder_id if explicitly provided
        if (elderId !== null && elderId !== undefined) {
            payload.elder_id = elderId;
        }
        const response = await api.post('/auth/register', payload);
        // Auto login after register
        await authApi.login(phone, password);
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    getMyElder: async () => {
        const response = await api.get('/auth/elder');
        return response.data;
    },

    getMyElders: async () => {
        const response = await api.get('/auth/elders');
        return response.data;
    },

    logout: () => {
        removeToken();
        removeStoredUser();
    },

    isLoggedIn: () => {
        return !!getToken();
    }
};

// ============ Health Data API ============
export const healthApi = {
    // Get real-time status (main home page data)
    getRealtimeStatus: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/realtime-status/${id}`);
        return response.data;
    },

    // Get alerts list
    getAlerts: async (elderId, limit = 20) => {
        const id = elderId || getElderId();
        const response = await api.get(`/alerts/${id}?limit=${limit}`);
        return response.data;
    },

    // Mark single alert as read
    markAlertAsRead: async (alertId) => {
        const response = await api.put(`/alerts/${alertId}/read`);
        return response.data;
    },

    // Mark all alerts as read
    markAllAlertsAsRead: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.put(`/alerts/${id}/read-all`);
        return response.data;
    },

    // Get unread alert count
    getUnreadAlertCount: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/alerts/${id}/unread-count`);
        return response.data;
    },

    // Get weekly statistics for charts
    getWeeklyStats: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/weekly-stats/${id}`);
        return response.data;
    },

    // Get health records
    getRecords: async (elderId, limit = 50) => {
        const id = elderId || getElderId();
        const response = await api.get(`/health-records/${id}?limit=${limit}`);
        return response.data;
    },

    // Get latest record
    getLatestRecord: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/health-records/latest/${id}`);
        return response.data;
    },

    // Get today's activity timeline
    getDailyTimeline: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/daily-timeline/${id}`);
        return response.data;
    },

    // Get today's behavior score
    getBehaviorScore: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/behavior-score/${id}`);
        return response.data;
    },
};

// ============ Simulation API ============
export const simulationApi = {
    injectAnomaly: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.post(`/simulation/inject-anomaly?user_id=${id}`);
        return response.data;
    },

    resetToNormal: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.post(`/simulation/reset?user_id=${id}`);
        return response.data;
    },

    getWeeklyReport: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/simulation/weekly-report/${id}`);
        return response.data;
    },
};

// ============ Settings API ============
export const settingsApi = {
    getSettings: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/settings/${id}`);
        return response.data;
    },

    updateSettings: async (elderId, settings) => {
        const id = elderId || getElderId();
        const response = await api.put(`/settings/${id}`, settings);
        return response.data;
    },

    resetSettings: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.post(`/settings/${id}/reset`);
        return response.data;
    },
};

// ============ Devices API ============
export const devicesApi = {
    getDevices: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/devices/${id}`);
        return response.data;
    },

    getDeviceStatus: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/devices/${id}/status`);
        return response.data;
    },
};

// ============ Safe Zones API ============
export const safeZonesApi = {
    getZones: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/safe-zones/${id}`);
        return response.data;
    },

    createZone: async (elderId, zone) => {
        const id = elderId || getElderId();
        const response = await api.post(`/safe-zones/${id}`, zone);
        return response.data;
    },

    updateZone: async (zoneId, zone) => {
        const response = await api.put(`/safe-zones/${zoneId}`, zone);
        return response.data;
    },

    deleteZone: async (zoneId) => {
        const response = await api.delete(`/safe-zones/${zoneId}`);
        return response.data;
    },

    toggleZone: async (zoneId) => {
        const response = await api.put(`/safe-zones/${zoneId}/toggle`);
        return response.data;
    },
};

// ============ Contacts API ============
export const contactsApi = {
    getContacts: async () => {
        const response = await api.get('/contacts/');
        return response.data;
    },

    addContact: async (contact) => {
        const response = await api.post('/contacts/', contact);
        return response.data;
    },

    deleteContact: async (contactId) => {
        const response = await api.delete(`/contacts/${contactId}`);
        return response.data;
    },

    getPrimaryContact: async () => {
        const response = await api.get('/contacts/primary');
        return response.data;
    },
};

// ============ AI API ============
export const aiApi = {
    // AI 对话
    chat: async (message, elderId) => {
        const id = elderId || getElderId();
        const response = await api.post('/ai/chat', { message, elder_id: id });
        return response.data;
    },

    // 生成智能周报
    getWeeklyReport: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/ai/weekly-report/${id}`);
        return response.data;
    },
};

// ============ AI Baseline API ============
export const baselineApi = {
    // 触发 AI 基线学习
    triggerLearning: async (elderId, days = 30) => {
        const id = elderId || getElderId();
        const response = await api.post('/baseline/learn', { elder_id: id, days });
        return response.data;
    },

    // 获取健康画像
    getProfile: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/baseline/profile/${id}`);
        return response.data;
    },

    // 获取当前数据与基线对比
    getComparison: async (elderId) => {
        const id = elderId || getElderId();
        const response = await api.get(`/baseline/comparison/${id}`);
        return response.data;
    },
};

// ============ Health Check ============
export const healthCheck = async () => {
    try {
        const response = await api.get('/health');
        return response.data;
    } catch (error) {
        console.error('Backend health check failed:', error);
        return null;
    }
};

// Legacy user API (for backwards compatibility)
export const userApi = {
    register: authApi.register,
    getUser: async (userId) => {
        const response = await api.get(`/users/${userId}`);
        return response.data;
    },
    getAllUsers: async () => {
        const response = await api.get('/users/');
        return response.data;
    },
};

export default api;
