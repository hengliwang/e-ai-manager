import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Checkbox, message } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (err: any) {
      message.error(err.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div style={{ fontSize: 80, marginBottom: 24 }}>⚡</div>
        <h1>电网智能巡检管理平台</h1>
        <p>端云协同 · 数据驱动 · 安全可控</p>
        <div style={{ marginTop: 48, opacity: 0.7, fontSize: 14 }}>
          <div>✓ 标准化设备档案与数据采集</div>
          <div style={{ marginTop: 8 }}>✓ AI辅助缺陷识别与智能定级</div>
          <div style={{ marginTop: 8 }}>✓ 全流程数字化巡检闭环</div>
          <div style={{ marginTop: 8 }}>✓ 管理驾驶舱全局可视</div>
        </div>
      </div>
      <div className="login-right">
        <h2>用户登录</h2>
        <Form
          name="login"
          onFinish={onFinish}
          style={{ width: '100%' }}
          size="large"
          initialValues={{ remember: true }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input prefix={<SafetyCertificateOutlined />} placeholder="验证码" style={{ flex: 1 }} />
              <Button style={{ width: 120, height: 40 }}>获取验证码</Button>
            </div>
          </Form.Item>
          <Form.Item>
            <Checkbox>我已阅读并同意《用户服务协议》</Checkbox>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, color: '#999', fontSize: 13 }}>
          测试账号：admin / admin123
        </div>
      </div>
    </div>
  );
}
