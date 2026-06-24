import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Tag, Tabs, Statistic, Row, Col, message, Modal, Form, DatePicker, Select, Input, Popconfirm, Upload } from 'antd';
import { PlusOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, PauseCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { inspectionApi, type InspectionTask, type TaskStatistics } from '../../api/inspection';
import { equipmentApi } from '../../api/equipment';
import { useAuthStore } from '../../store/authStore';

const statusTabs = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待巡检' },
  { key: 'in_progress', label: '进行中' },
  { key: 'submitted', label: '待审核' },
  { key: 'completed', label: '已巡检' },
];

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'blue', text: '待巡检' },
  in_progress: { color: 'orange', text: '进行中' },
  submitted: { color: 'purple', text: '待审核' },
  completed: { color: 'green', text: '已巡检' },
  rejected: { color: 'red', text: '已驳回' },
  cancelled: { color: 'default', text: '已取消' },
  suspended: { color: 'warning', text: '已挂起' },
};

const priorityMap: Record<number, { color: string; text: string }> = {
  1: { color: 'red', text: '危急' },
  2: { color: 'orange', text: '严重' },
  3: { color: 'default', text: '一般' },
};

const typeMap: Record<string, string> = {
  full_line: '一线一档', periodic: '周期巡视', special: '特殊巡视', work_order: '工单巡视',
};

export default function InspectionTaskCenter() {
  const [data, setData] = useState<InspectionTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('');
  const [stats, setStats] = useState<TaskStatistics>({ total: 0, pending_count: 0, in_progress_count: 0, submitted_count: 0, completed_count: 0, suspended_count: 0 });
  const [createModal, setCreateModal] = useState(false);
  const [suspendModal, setSuspendModal] = useState<{ open: boolean; taskId: number }>({ open: false, taskId: 0 });
  const [cancelModal, setCancelModal] = useState<{ open: boolean; taskId: number }>({ open: false, taskId: 0 });
  const [resumeModal, setResumeModal] = useState<{ open: boolean; taskId: number }>({ open: false, taskId: 0 });
  const [form] = Form.useForm();
  const [suspendForm] = Form.useForm();
  const [cancelForm] = Form.useForm();
  const [resumeForm] = Form.useForm();
  const [equipmentOptions, setEquipmentOptions] = useState<any[]>([]);
  const navigate = useNavigate();
  const { canManageUsers } = useAuthStore();

  const fetchData = useCallback(() => {
    setLoading(true);
    inspectionApi.list({ skip: (page - 1) * 15, limit: 15, status: activeTab || undefined })
      .then((res) => {
        setData(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page, activeTab]);

  const fetchStats = useCallback(() => {
    inspectionApi.getStatistics().then((res) => setStats(res.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); fetchStats(); }, [fetchData, fetchStats]);

  const refresh = () => { fetchData(); fetchStats(); };

  const handleCreate = async (values: any) => {
    await inspectionApi.create({
      ...values,
      inspection_date: values.inspection_date.format('YYYY-MM-DD'),
    });
    message.success('任务创建成功');
    setCreateModal(false);
    form.resetFields();
    refresh();
  };

  const handleSuspend = async (values: { reason: string }) => {
    await inspectionApi.suspend(suspendModal.taskId, values.reason);
    message.success('任务已挂起');
    setSuspendModal({ open: false, taskId: 0 });
    suspendForm.resetFields();
    refresh();
  };

  const handleCancel = async (values: { reason: string }) => {
    await inspectionApi.cancel(cancelModal.taskId, values.reason);
    message.success('任务已取消');
    setCancelModal({ open: false, taskId: 0 });
    cancelForm.resetFields();
    refresh();
  };

  const handleResume = async (values: { reason: string; expected_time?: any; material?: any }) => {
    const materialPath = values.material?.fileList?.[0]?.name || values.material?.fileList?.[0]?.response?.path || undefined;
    const expectedTime = values.expected_time?.format?.('YYYY-MM-DD') || values.expected_time || undefined;
    await inspectionApi.resume(resumeModal.taskId, values.reason, materialPath, expectedTime);
    message.success('任务已恢复');
    setResumeModal({ open: false, taskId: 0 });
    resumeForm.resetFields();
    refresh();
  };

  const loadEquipment = (keyword?: string) => {
    equipmentApi.list({ limit: 100, keyword }).then((res) => {
      setEquipmentOptions(res.data.items.map((e: any) => ({
        label: `${e.equipment_name} (${e.equipment_type})`,
        value: e.id,
      })));
    });
  };

  const columns = [
    { title: '任务编号', dataIndex: 'task_no', width: 150 },
    { title: '设备名称', dataIndex: 'equipment_name', width: 160 },
    { title: '设备类型', dataIndex: 'equipment_type', width: 90 },
    {
      title: '巡检类型', dataIndex: 'inspection_type', width: 100,
      render: (t: string) => typeMap[t] || t,
    },
    { title: '巡检人', dataIndex: 'inspector_name', width: 90 },
    { title: '巡检日期', dataIndex: 'inspection_date', width: 110 },
    {
      title: '优先级', dataIndex: 'priority', width: 80,
      render: (p: number) => <Tag color={priorityMap[p]?.color}>{priorityMap[p]?.text}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>,
    },
    { title: '区域', dataIndex: 'location_district', width: 80, render: (v: string) => v || '-' },
    { title: '上次巡检日期', dataIndex: 'last_inspection_date', width: 110, render: (v: string) => v || '-' },
    { title: '上次巡检人', dataIndex: 'last_inspector_name', width: 90, render: (v: string) => v || '-' },
    { title: '上次缺陷', dataIndex: 'last_defect_summary', width: 120, render: (v: string) => v ? <span style={{ color: v === '无' ? '#999' : '#ff4d4f' }}>{v}</span> : '-' },
    {
      title: '操作', key: 'actions', width: 340, fixed: 'right' as const,
      render: (_: any, r: InspectionTask) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/inspection/${r.id}`)}>详情</Button>
          {r.can_review && (
            <Button type="link" size="small" onClick={() => navigate(`/inspection/${r.id}/review`)}>审核</Button>
          )}
          {r.can_accept && (
            <Button type="link" size="small" onClick={async () => { await inspectionApi.start(r.id); refresh(); }}>开始</Button>
          )}
          {r.can_suspend && (
            <Button type="link" size="small" onClick={() => { suspendForm.resetFields(); setSuspendModal({ open: true, taskId: r.id }); }}>挂起</Button>
          )}
          {r.can_resume && (
            <Button type="link" size="small" onClick={() => { resumeForm.resetFields(); setResumeModal({ open: true, taskId: r.id }); }}>恢复</Button>
          )}
          {r.can_resubmit && (
            <Popconfirm title="确认重新派发此任务？将退回至待巡检状态" onConfirm={async () => {
              await inspectionApi.resubmit(r.id);
              message.success('任务已重新派发');
              refresh();
            }}>
              <Button type="link" size="small" style={{ color: '#722ed1' }}>重新派发</Button>
            </Popconfirm>
          )}
          {r.can_cancel && (
            <Button type="link" size="small" danger onClick={() => { cancelForm.resetFields(); setCancelModal({ open: true, taskId: r.id }); }}>取消</Button>
          )}
          {r.can_delete && (
            <Popconfirm title="确认删除？物理删除后不可恢复" onConfirm={async () => {
              await inspectionApi.delete(r.id);
              message.success('任务已删除');
              refresh();
            }}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const statItems = [
    { title: '任务总数', value: stats.total, icon: <ClockCircleOutlined />, color: '#1890ff' },
    { title: '待巡检', value: stats.pending_count, icon: <ExclamationCircleOutlined />, color: '#faad14' },
    { title: '进行中', value: stats.in_progress_count, icon: <ClockCircleOutlined />, color: '#fa8c16' },
    { title: '待审核', value: stats.submitted_count, icon: <ExclamationCircleOutlined />, color: '#722ed1' },
    { title: '已巡检', value: stats.completed_count, icon: <CheckCircleOutlined />, color: '#52c41a' },
    { title: '已挂起', value: stats.suspended_count, icon: <PauseCircleOutlined />, color: '#999' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>巡检任务中心</h2>
        {canManageUsers && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { loadEquipment(); setCreateModal(true); }}>
            创建任务
          </Button>
        )}
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {statItems.map((s) => (
          <Col span={4} key={s.title}>
            <Card size="small" style={{ textAlign: 'center', cursor: 'pointer' }}
              onClick={() => {
                if (s.title === '任务总数') setActiveTab('');
                else if (s.title === '待巡检') setActiveTab('pending');
                else if (s.title === '进行中') setActiveTab('in_progress');
                else if (s.title === '待审核') setActiveTab('submitted');
                else if (s.title === '已巡检') setActiveTab('completed');
                setPage(1);
              }}>
              <Statistic value={s.value} prefix={s.icon} valueStyle={{ color: s.color, fontSize: 24 }} />
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{s.title}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={(k) => { setActiveTab(k); setPage(1); }} items={statusTabs.map((t) => ({ key: t.key, label: t.label }))} />
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1800 }}
          pagination={{
            current: page,
            total,
            pageSize: 15,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      <Modal title="创建巡检任务" open={createModal}
        onCancel={() => setCreateModal(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="设备" name="equipment_id" rules={[{ required: true }]}>
            <Select showSearch placeholder="搜索选择设备" options={equipmentOptions} onSearch={loadEquipment} filterOption={false} />
          </Form.Item>
          <Form.Item label="巡检人" name="inspector_id" rules={[{ required: true }]}>
            <Select options={[
              { label: '张明 (巡检一班)', value: 3 },
              { label: '李新 (巡检二班)', value: 4 },
            ]} />
          </Form.Item>
          <Form.Item label="巡检日期" name="inspection_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="巡检类型" name="inspection_type" initialValue="periodic">
            <Select options={[
              { label: '周期巡视', value: 'periodic' },
              { label: '一线一档', value: 'full_line' },
              { label: '特殊巡视', value: 'special' },
              { label: '工单巡视', value: 'work_order' },
            ]} />
          </Form.Item>
          <Form.Item label="优先级" name="priority" initialValue={2}>
            <Select options={[
              { label: '危急', value: 1 },
              { label: '严重', value: 2 },
              { label: '一般', value: 3 },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="挂起任务" open={suspendModal.open}
        onCancel={() => setSuspendModal({ open: false, taskId: 0 })} onOk={() => suspendForm.submit()}>
        <Form form={suspendForm} layout="vertical" onFinish={handleSuspend}>
          <Form.Item label="挂起原因" name="reason" rules={[{ required: true }]}>
            <Select placeholder="请选择挂起原因" options={[
              { label: '天气原因（暴雨/台风/大雪）', value: '天气原因' },
              { label: '设备停运', value: '设备停运' },
              { label: '道路阻断', value: '道路阻断' },
              { label: '待停电计划', value: '待停电计划' },
              { label: '其他', value: '其他' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="取消任务" open={cancelModal.open}
        onCancel={() => setCancelModal({ open: false, taskId: 0 })} onOk={() => cancelForm.submit()}>
        <Form form={cancelForm} layout="vertical" onFinish={handleCancel}>
          <Form.Item label="取消原因" name="reason" rules={[{ required: true }]}>
            <Select placeholder="请选择取消原因" options={[
              { label: '设备停运', value: '设备停运' },
              { label: '道路阻断', value: '道路阻断' },
              { label: '重复派单', value: '重复派单' },
              { label: '其他', value: '其他' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="解除挂起" open={resumeModal.open}
        onCancel={() => setResumeModal({ open: false, taskId: 0 })} onOk={() => resumeForm.submit()}>
        <Form form={resumeForm} layout="vertical" onFinish={handleResume}>
          <Form.Item label="恢复原因" name="reason" rules={[{ required: true }]}>
            <Select placeholder="请选择恢复原因" options={[
              { label: '天气好转', value: '天气好转' },
              { label: '计划执行', value: '计划执行' },
              { label: '设备恢复运行', value: '设备恢复运行' },
              { label: '道路恢复通行', value: '道路恢复通行' },
              { label: '其他', value: '其他' },
            ]} />
          </Form.Item>
          <Form.Item label="佐证材料" name="material" extra="支持上传图片或文件（如工作票、天气报告等）">
            <Upload maxCount={1} beforeUpload={() => false} listType="text">
              <Button icon={<UploadOutlined />}>上传文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="预计执行时间" name="expected_time">
            <DatePicker style={{ width: '100%' }} placeholder="选择预计执行日期" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
