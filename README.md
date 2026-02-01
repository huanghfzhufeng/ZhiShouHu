# 智守护 - 老年人安全智能预警系统

## 项目简介
基于多模态数据分析的老年人安全智能预警系统，通过运动手环收集老年人的健康数据和位置信息，利用异常检测引擎进行实时分析和预警。

## 技术栈
- **前端**: React 19 + Vite + TailwindCSS + Lucide Icons
- **后端**: FastAPI + Python 3.11
- **数据库**: PostgreSQL 15
- **认证**: JWT (JSON Web Token)
- **部署**: Docker + Docker Compose
- **异常检测**: 基于规则的多模态异常检测引擎

## 核心功能
- ✅ 用户认证系统 (JWT)
- ✅ 实时健康数据监测（心率、血压、步数）
- ✅ GPS位置追踪与安全区域设定
- ✅ 多模态异常检测（心率异常 + 位置偏离 + 活动模式分析）
- ✅ 智能预警系统
- ✅ 历史数据分析与可视化
- ✅ 消息中心与告警管理

## 快速启动（Docker）

### 前置条件
- Docker >= 20.10
- Docker Compose >= 2.0

### 一键启动
```bash
cd senior-guardian-system
docker-compose up -d
```

### 访问系统
- 前端: http://localhost
- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs

### 演示账户
- **监护人账号**: 13800000002 / 123456
- **老人账号**: 13800000001 / 123456

## 本地开发

### 后端开发
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 前端开发
```bash
cd frontend
npm install
npm run dev
```

### 环境变量
在 `backend/.env` 中配置：
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/senior_guardian_db
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=your-openai-key  # 可选
```

## 项目结构
```
senior-guardian-system/
├── backend/
│   ├── app/
│   │   ├── api/          # API路由
│   │   │   ├── auth.py        # 认证相关API
│   │   │   ├── health_records.py  # 健康数据API
│   │   │   ├── simulation.py      # 模拟异常API
│   │   │   └── users.py            # 用户管理API
│   │   ├── services/     # 业务逻辑
│   │   │   ├── anomaly_detector.py  # 异常检测引擎
│   │   │   └── llm_service.py       # LLM服务
│   │   ├── models.py     # 数据模型
│   │   ├── db.py         # 数据库配置
│   │   ├── init_data.py  # 初始化数据
│   │   └── main.py       # 应用入口
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # React组件
│   │   ├── pages/        # 页面组件
│   │   ├── services/     # API服务
│   │   └── App.jsx       # 应用主组件
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
└── docker-compose.yml
```

## 核心模块说明

### 1. 认证系统
- 使用JWT进行用户认证
- 密码使用bcrypt加密存储
- 支持用户注册、登录、token刷新

### 2. 异常检测引擎
**检测维度：**
- 心率异常（>100bpm 或 <50bpm）
- 血压异常（收缩压>140 或 <90）
- 位置偏离（超出预设安全区域）
- 活动模式异常（如夜间异常活动）

**风险评估：**
- 低风险：所有指标正常
- 中风险：单一指标轻微异常
- 高风险：多指标异常或单一指标严重异常

### 3. 数据存储
- User表：用户信息（含密码哈希）
- HealthRecord表：健康数据记录
- Alert表：告警记录

## 模拟异常功能
系统提供「模拟异常」按钮用于演示：
1. 点击「模拟异常」按钮
2. 系统生成异常健康数据（心率升高 + 位置偏离）
3. 异常检测引擎自动分析
4. 触发紧急告警弹窗
5. 保存告警记录到数据库

## Docker 部署说明

### 服务编排
- **db**: PostgreSQL数据库
- **backend**: FastAPI后端服务
- **frontend**: Nginx + React前端

### 数据持久化
数据库数据存储在Docker Volume `postgres_data` 中

### 停止服务
```bash
docker-compose down
```

### 重新构建
```bash
docker-compose up -d --build
```

### 查看日志
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 开发团队
- 项目类型：大学生创新项目
- 技术方向：多模态数据分析 + 智能预警系统

## 许可证
MIT License
