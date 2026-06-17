import axios from 'axios';

const request = axios.create({
  baseURL: '',
  timeout: 30000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 登录接口返回 401 是因为密码错误，不要清除 token 和跳转
      if (error.config?.url !== '/api/auth/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default request;
