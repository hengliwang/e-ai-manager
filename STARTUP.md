# 电网智能巡检管理平台 - 启动说明

## 环境要求

- **Python** 3.9+
- **Node.js** 18+
- **npm** 9+

## 项目结构

```
wang/
├── backend/          # FastAPI 后端
├── frontend/         # React 前端
├── photos/           # 照片存储目录
├── smart-grid-platform.tar.gz   # 打包文件
└── STARTUP.md        # 本说明文件
```

---

## 一、后端启动

### 1. 进入后端目录并安装依赖

```bash
cd backend
pip install fastapi uvicorn sqlalchemy python-jose pydantic python-multipart
```

### 2. 启动服务

```bash
python main.py
```

启动后可访问:
- API 服务: http://localhost:8000
- API 文档: http://localhost:8000/docs

### 3. 预置账号

| 用户名 | 密码 | 角色 | 真实姓名 |
|--------|------|------|----------|
| admin | admin123 | 系统管理员 | 系统管理员 |
| zhangming | 123456 | 巡检员 | 张明 |
| lixin | 123456 | 巡检员 | 李新 |
| wangqiang | 123456 | 运维负责人 | 王强 |
| zhaolei | 123456 | 检修班组 | 赵磊 |

---

## 二、前端启动

### 1. 进入前端目录并安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

启动后访问: http://localhost:5173

### 3. 生产构建（可选）

```bash
npm run build
```

构建产物在 `frontend/dist/` 目录，可使用 nginx 等静态服务部署。

---

## 三、验证系统

1. 确保后端已启动（http://localhost:8000/docs 可访问）
2. 确保前端已启动（http://localhost:5173 可访问）
3. 浏览器打开 http://localhost:5173
4. 使用 `admin / admin123` 登录
5. 依次验证各模块:
   - **数据看板**: 首页统计卡片和图表
   - **设备档案**: 设备列表、详情、新增/编辑、照片时间轴
   - **巡检任务**: 任务列表、状态流转、AI 审核
   - **消缺工单**: 工单列表、处理闭环

---

## 四、常见问题

**Q: 前端页面空白或 API 请求失败？**
A: 确认后端已启动在 8000 端口，前端 dev server 会自动代理 `/api` 请求到后端。

**Q: 登录报错 "Invalid token"？**
A: 确认后端 `smart_grid.db` 已生成且包含预置用户数据。如未生成，删除 `backend/smart_grid.db` 后重新运行 `python main.py`。

**Q: 端口被占用？**
A: 后端默认 8000 端口，前端默认 5173 端口。如需修改后端端口，编辑 `backend/main.py` 最后一行 `uvicorn.run` 的 `port` 参数。

---

## 五、技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| UI 组件库 | Ant Design 5 |
| 图表 | ECharts |
| 状态管理 | Zustand |
| 路由 | React Router 6 |
| 构建工具 | Vite |
| 后端框架 | FastAPI (Python) |
| ORM | SQLAlchemy |
| 数据库 | SQLite |
| 认证 | JWT (python-jose) |
