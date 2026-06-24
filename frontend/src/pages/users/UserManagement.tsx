import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Modal, Form, message, Popconfirm, Typography } from 'antd';
import { PlusOutlined, SearchOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import { usersApi, type UserData, type CreateUserData, type UpdateUserData } from '../../api/users';
import { useAuthStore } from '../../store/authStore';

const roleMap: Record<string, { color: string; text: string }> = {
  admin: { color: 'red', text: '系统管理员' },
  manager: { color: 'blue', text: '运维负责人' },
  inspector: { color: 'green', text: '一线巡检员' },
  repairer: { color: 'orange', text: '检修员' },
};

const accountTypeMap: Record<string, string> = {
  employee: '员工',
  customer: '客户',
  regulator: '监管方',
};

export default function UserManagement() {
  const [data, setData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';

  const fetchData = useCallback(() => {
    setLoading(true);
    usersApi.list({ skip: (page - 1) * 15, limit: 15, keyword: keyword || undefined, role: roleFilter })
      .then((res) => {
        setData(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page, keyword, roleFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role: 'inspector', account_type: 'employee' });
    setModalOpen(true);
  };

  const handleEdit = (record: UserData) => {
    setEditingUser(record);
    form.setFieldsValue({
      real_name: record.real_name,
      role: record.role,
      employee_id: record.employee_id || '',
      phone: record.phone || '',
      account_type: record.account_type,
      department: record.department || '',
      region: record.region || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (editingUser) {
      await usersApi.update(editingUser.id, values as UpdateUserData);
      message.success('用户信息更新成功');
    } else {
      await usersApi.create(values as CreateUserData);
      message.success('用户创建成功');
    }
    setModalOpen(false);
    form.resetFields();
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await usersApi.delete(id);
    message.success('用户已删除');
    fetchData();
  };

  const handleToggleStatus = async (record: UserData) => {
    await usersApi.toggleStatus(record.id);
    message.success(record.is_active ? '账号已禁用' : '账号已启用');
    fetchData();
  };

  const handleResetPassword = () => {
    passwordForm.validateFields().then(async (values) => {
      if (passwordUserId === null) return;
      await usersApi.resetPassword(passwordUserId, values.password);
      message.success('密码重置成功');
      setPasswordModalOpen(false);
      passwordForm.resetFields();
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'real_name', width: 100 },
    { title: '工号', dataIndex: 'employee_id', width: 100, render: (v: string) => v || '-' },
    { title: '手机号', dataIndex: 'phone', width: 130, render: (v: string) => v || '-' },
    {
      title: '角色', dataIndex: 'role', width: 120,
      render: (r: string) => <Tag color={roleMap[r]?.color}>{roleMap[r]?.text || r}</Tag>,
    },
    {
      title: '账号类型', dataIndex: 'account_type', width: 100,
      render: (t: string) => accountTypeMap[t] || t,
    },
    { title: '部门', dataIndex: 'department', width: 120, render: (v: string) => v || '-' },
    { title: '片区', dataIndex: 'region', width: 100, render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'is_active', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 280, fixed: 'right' as const,
      render: (_: any, r: UserData) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
          <Button type="link" size="small" onClick={() => {
            setPasswordUserId(r.id);
            passwordForm.resetFields();
            setPasswordModalOpen(true);
          }}>重置密码</Button>
          <Popconfirm
            title={r.is_active ? '确认禁用该账号？' : '确认启用该账号？'}
            onConfirm={() => handleToggleStatus(r)}
          >
            <Button type="link" size="small" danger={r.is_active}>
              {r.is_active ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
          {r.id !== currentUser?.id && (
            <Popconfirm title="确认删除该用户？此操作不可恢复。" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>用户管理</h2>
        <Space>
          <Button icon={<ExportOutlined />} disabled>导出</Button>
          <Button icon={<ImportOutlined />} disabled>导入</Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增用户</Button>
          )}
        </Space>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索用户名/姓名/手机号/工号"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 280 }}
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          />
          <Select
            placeholder="角色筛选"
            allowClear
            style={{ width: 150 }}
            value={roleFilter}
            onChange={(v) => { setRoleFilter(v); setPage(1); }}
            options={[
              { label: '系统管理员', value: 'admin' },
              { label: '运维负责人', value: 'manager' },
              { label: '一线巡检员', value: 'inspector' },
              { label: '检修员', value: 'repairer' },
            ]}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            total,
            pageSize: 15,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="用户名" name="username" rules={[{ required: !editingUser, message: '请输入用户名' }]}>
            <Input disabled={!!editingUser} placeholder="登录用用户名" />
          </Form.Item>
          {!editingUser && (
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
              <Input.Password placeholder="初始密码" />
            </Form.Item>
          )}
          <Form.Item label="姓名" name="real_name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item label="工号" name="employee_id" style={{ width: 220 }}>
              <Input placeholder="员工工号（唯一）" />
            </Form.Item>
            <Form.Item label="手机号" name="phone" style={{ width: 260 }}>
              <Input placeholder="11位手机号" maxLength={11} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item label="角色" name="role" rules={[{ required: true }]} style={{ width: 220 }}>
              <Select options={[
                { label: '系统管理员', value: 'admin' },
                { label: '运维负责人', value: 'manager' },
                { label: '一线巡检员', value: 'inspector' },
                { label: '检修员', value: 'repairer' },
              ]} />
            </Form.Item>
            <Form.Item label="账号类型" name="account_type" style={{ width: 260 }}>
              <Select options={[
                { label: '员工', value: 'employee' },
                { label: '客户', value: 'customer' },
                { label: '监管方', value: 'regulator' },
              ]} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item label="部门" name="department" style={{ width: 220 }}>
              <Input placeholder="所属部门" />
            </Form.Item>
            <Form.Item label="片区" name="region" style={{ width: 260 }}>
              <Input placeholder="管辖区域" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="重置密码"
        open={passwordModalOpen}
        onCancel={() => { setPasswordModalOpen(false); passwordForm.resetFields(); }}
        onOk={handleResetPassword}
      >
        <Form form={passwordForm} layout="vertical">
          <Typography.Text type="secondary">为用户设置新密码，至少6位</Typography.Text>
          <Form.Item name="password" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]} style={{ marginTop: 12 }}>
            <Input.Password placeholder="新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
