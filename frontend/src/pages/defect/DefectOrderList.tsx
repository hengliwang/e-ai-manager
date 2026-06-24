import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Tag, Select, Input, message, Modal, Form, Row, Col, Statistic, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { defectApi, type DefectOrder, type OrderStatistics } from '../../api/defect';
import { equipmentApi } from '../../api/equipment';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'blue', text: '待处理' },
  in_progress: { color: 'orange', text: '处理中' },
  fully_resolved: { color: 'green', text: '已全部消除' },
  partially_resolved: { color: 'gold', text: '已部分消除' },
  cancelled: { color: 'default', text: '已取消' },
};

const severityMap: Record<number, { color: string; text: string }> = {
  1: { color: 'red', text: '一级(危急)' },
  2: { color: 'orange', text: '二级(严重)' },
  3: { color: 'blue', text: '三级(一般)' },
};

export default function DefectOrderList() {
  const [data, setData] = useState<DefectOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [severity, setSeverity] = useState<number | undefined>();
  const [keyword, setKeyword] = useState('');
  const [stats, setStats] = useState<OrderStatistics>({
    total: 0, pending_count: 0, in_progress_count: 0,
    fully_resolved_count: 0, partially_resolved_count: 0, overdue_count: 0,
  });
  const [createModal, setCreateModal] = useState(false);
  const [assignModal, setAssignModal] = useState<{ open: boolean; orderId: number }>({ open: false, orderId: 0 });
  const [cancelModal, setCancelModal] = useState<{ open: boolean; orderId: number }>({ open: false, orderId: 0 });
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [cancelForm] = Form.useForm();
  const [equipmentOptions, setEquipmentOptions] = useState<any[]>([]);
  const navigate = useNavigate();
  const { canManageUsers } = useAuthStore();
  const user = useAuthStore((s) => s.user);

  const fetchData = useCallback(() => {
    setLoading(true);
    defectApi.list({ skip: (page - 1) * 15, limit: 15, status, severity, keyword: keyword || undefined })
      .then((res) => {
        setData(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page, status, severity, keyword]);

  const fetchStats = useCallback(() => {
    defectApi.getStatistics().then((res) => setStats(res.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); fetchStats(); }, [fetchData, fetchStats]);

  const refresh = () => { fetchData(); fetchStats(); };

  const handleCreate = async (values: any) => {
    await defectApi.create(values);
    message.success('工单创建成功');
    setCreateModal(false);
    form.resetFields();
    refresh();
  };

  const handleAssign = async (values: { repairer_id: number }) => {
    await defectApi.assign(assignModal.orderId, values.repairer_id);
    message.success('已派发');
    setAssignModal({ open: false, orderId: 0 });
    assignForm.resetFields();
    refresh();
  };

  const handleCancel = async (values: { reason: string }) => {
    await defectApi.cancel(cancelModal.orderId, values.reason);
    message.success('工单已取消');
    setCancelModal({ open: false, orderId: 0 });
    cancelForm.resetFields();
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
    { title: '工单编号', dataIndex: 'order_no', width: 160 },
    { title: '缺陷名称', dataIndex: 'defect_name', width: 140 },
    { title: '缺陷类型', dataIndex: 'defect_type', width: 100 },
    {
      title: '等级', dataIndex: 'severity', width: 100,
      render: (s: number) => <Tag color={severityMap[s]?.color}>{severityMap[s]?.text}</Tag>,
    },
    {
      title: '紧急', dataIndex: 'is_emergency', width: 70,
      render: (v: string) => v === 'true' ? <Tag color="red">紧急</Tag> : <span>-</span>,
    },
    { title: '设备名称', dataIndex: 'equipment_name', width: 140, render: (v: string) => v || '-' },
    { title: '设备类型', dataIndex: 'equipment_type', width: 90, render: (v: string) => v || '-' },
    { title: '所属客户', dataIndex: 'customer_name', width: 120, render: (v: string) => v || '-' },
    {
      title: '位置', key: 'location', width: 180,
      render: (_: any, r: DefectOrder) =>
        [r.location_province, r.location_city, r.location_district, r.location_detail].filter(Boolean).join(''),
    },
    { title: '上报人', dataIndex: 'inspector_name', width: 80, render: (v: string) => v || '-' },
    { title: '处理人', dataIndex: 'repairer_name', width: 80, render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', width: 110,
      render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>,
    },
    {
      title: '超期天数', dataIndex: 'overdue_days', width: 90,
      render: (v: number) => v ? <Tag color="red">{v}天</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    { title: '最近处理日期', dataIndex: 'last_processed_date', width: 110, render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-' },
    { title: '最近处理人', dataIndex: 'last_processor_name', width: 90, render: (v: string) => v || '-' },
    {
      title: '创建时间', dataIndex: 'created_at', width: 110,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'actions', width: 280, fixed: 'right' as const,
      render: (_: any, r: DefectOrder) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/defect/${r.id}`)}>详情</Button>
          {r.can_assign && (
            <Button type="link" size="small" onClick={() => { assignForm.resetFields(); setAssignModal({ open: true, orderId: r.id }); }}>派发</Button>
          )}
          {r.can_start && user && (
            <Popconfirm title="确认开始处理？将自动指派自己为处理人" onConfirm={async () => {
              await defectApi.assign(r.id, user.id);
              message.success('已开始处理');
              refresh();
            }}>
              <Button type="link" size="small">开始处理</Button>
            </Popconfirm>
          )}
          {r.can_cancel && (
            <Button type="link" size="small" danger onClick={() => { cancelForm.resetFields(); setCancelModal({ open: true, orderId: r.id }); }}>取消</Button>
          )}
          {r.can_delete && (
            <Popconfirm title="确认删除？物理删除后不可恢复" onConfirm={async () => {
              await defectApi.delete(r.id);
              message.success('工单已删除');
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
    { title: '工单总数', value: stats.total, icon: <ClockCircleOutlined />, color: '#1890ff', statusKey: '' },
    { title: '待处理', value: stats.pending_count, icon: <ExclamationCircleOutlined />, color: '#faad14', statusKey: 'pending' },
    { title: '处理中', value: stats.in_progress_count, icon: <ClockCircleOutlined />, color: '#fa8c16', statusKey: 'in_progress' },
    { title: '已消除', value: stats.fully_resolved_count, icon: <CheckCircleOutlined />, color: '#52c41a', statusKey: 'fully_resolved' },
    { title: '部分消除', value: stats.partially_resolved_count, icon: <ExclamationCircleOutlined />, color: '#faad14', statusKey: 'partially_resolved' },
    { title: '超期未处理', value: stats.overdue_count, icon: <WarningOutlined />, color: '#ff4d4f', statusKey: '' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>消缺工单管理</h2>
        {canManageUsers && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { loadEquipment(); setCreateModal(true); }}>
            创建工单
          </Button>
        )}
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {statItems.map((s) => (
          <Col span={4} key={s.title}>
            <Card size="small" style={{ textAlign: 'center', cursor: 'pointer' }}
              onClick={() => {
                if (s.statusKey !== undefined) { setStatus(s.statusKey || undefined); setPage(1); }
              }}>
              <Statistic value={s.value} prefix={s.icon} valueStyle={{ color: s.color, fontSize: 24 }} />
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{s.title}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="搜索编号/缺陷/设备/人员"
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => { setPage(1); fetchData(); }}
          />
          <Select
            placeholder="状态筛选"
            style={{ width: 140 }}
            allowClear
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '处理中', value: 'in_progress' },
              { label: '已全部消除', value: 'fully_resolved' },
              { label: '已部分消除', value: 'partially_resolved' },
              { label: '已取消', value: 'cancelled' },
            ]}
          />
          <Select
            placeholder="缺陷等级"
            style={{ width: 130 }}
            allowClear
            value={severity}
            onChange={(v) => { setSeverity(v); setPage(1); }}
            options={[
              { label: '一级(危急)', value: 1 },
              { label: '二级(严重)', value: 2 },
              { label: '三级(一般)', value: 3 },
            ]}
          />
          <Button type="primary" onClick={() => { setPage(1); fetchData(); }}>搜索</Button>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 2100 }}
          pagination={{
            current: page,
            total,
            pageSize: 15,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* 创建工单 */}
      <Modal title="创建消缺工单" open={createModal}
        onCancel={() => setCreateModal(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="设备" name="equipment_id" rules={[{ required: true }]}>
            <Select showSearch placeholder="搜索选择设备" options={equipmentOptions} onSearch={loadEquipment} filterOption={false} />
          </Form.Item>
          <Form.Item label="缺陷类型" name="defect_type" rules={[{ required: true }]}>
            <Select options={[
              { label: '本体', value: '本体' },
              { label: '附属设施', value: '附属设施' },
              { label: '接地装置', value: '接地装置' },
              { label: '基础', value: '基础' },
              { label: '通道环境', value: '通道环境' },
            ]} />
          </Form.Item>
          <Form.Item label="缺陷名称" name="defect_name" rules={[{ required: true }]}>
            <Input placeholder="如：绝缘子破损" />
          </Form.Item>
          <Form.Item label="缺陷等级" name="severity" initialValue={2}>
            <Select options={[
              { label: '一级(危急)', value: 1 },
              { label: '二级(严重)', value: 2 },
              { label: '三级(一般)', value: 3 },
            ]} />
          </Form.Item>
          <Form.Item label="紧急抢修" name="is_emergency" initialValue="false">
            <Select options={[
              { label: '否', value: 'false' },
              { label: '是', value: 'true' },
            ]} />
          </Form.Item>
          <Form.Item label="缺陷描述" name="description">
            <Input.TextArea rows={3} placeholder="缺陷详细描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 派发工单 */}
      <Modal title="派发工单" open={assignModal.open}
        onCancel={() => setAssignModal({ open: false, orderId: 0 })} onOk={() => assignForm.submit()}>
        <Form form={assignForm} layout="vertical" onFinish={handleAssign}>
          <Form.Item label="处理人" name="repairer_id" rules={[{ required: true }]}>
            <Select options={[
              { label: '赵强 (检修一班)', value: 5 },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 取消工单 */}
      <Modal title="取消工单" open={cancelModal.open}
        onCancel={() => setCancelModal({ open: false, orderId: 0 })} onOk={() => cancelForm.submit()}>
        <Form form={cancelForm} layout="vertical" onFinish={handleCancel}>
          <Form.Item label="取消原因" name="reason" rules={[{ required: true }]}>
            <Select placeholder="请选择取消原因" options={[
              { label: '重复派单', value: '重复派单' },
              { label: '缺陷已自然消除', value: '缺陷已自然消除' },
              { label: '设备已停运', value: '设备已停运' },
              { label: '其他', value: '其他' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
