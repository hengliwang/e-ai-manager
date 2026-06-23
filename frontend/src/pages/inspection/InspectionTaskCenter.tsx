import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Tag, Select, Tabs, message, Modal, Form, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { inspectionApi } from '../../api/inspection';
import { equipmentApi } from '../../api/equipment';

const statusTabs = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待接单' },
  { key: 'in_progress', label: '待巡检' },
  { key: 'submitted', label: '待审核' },
  { key: 'completed', label: '待验收' },
];

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'blue', text: '待巡检' },
  in_progress: { color: 'orange', text: '进行中' },
  submitted: { color: 'purple', text: '待审核' },
  completed: { color: 'green', text: '已巡检' },
  rejected: { color: 'red', text: '已驳回' },
  cancelled: { color: 'default', text: '已取消' },
  suspended: { color: 'default', text: '已挂起' },
};

const priorityMap: Record<number, { color: string; text: string }> = {
  1: { color: 'red', text: '危急' },
  2: { color: 'orange', text: '严重' },
  3: { color: 'default', text: '一般' },
};

export default function InspectionTaskCenter() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [equipmentOptions, setEquipmentOptions] = useState<any[]>([]);
  const navigate = useNavigate();

  const fetchData = () => {
    setLoading(true);
    inspectionApi.list({ skip: (page - 1) * 15, limit: 15, status: activeTab || undefined })
      .then((res) => {
        setData(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, activeTab]);

  const handleCreate = async (values: any) => {
    await inspectionApi.create({
      ...values,
      inspection_date: values.inspection_date.format('YYYY-MM-DD'),
    });
    message.success('任务创建成功');
    setCreateModal(false);
    form.resetFields();
    fetchData();
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
    { title: '任务编号', dataIndex: 'task_no', width: 160 },
    { title: '设备名称', dataIndex: 'equipment_name', width: 160 },
    { title: '设备类型', dataIndex: 'equipment_type', width: 100 },
    {
      title: '巡检类型', dataIndex: 'inspection_type', width: 100,
      render: (t: string) => {
        const map: Record<string, string> = { full_line: '一线一档', periodic: '周期巡视', special: '特殊巡视', work_order: '工单巡视' };
        return map[t] || t;
      },
    },
    { title: '巡检人', dataIndex: 'inspector_name', width: 100 },
    { title: '巡检日期', dataIndex: 'inspection_date', width: 110 },
    {
      title: '优先级', dataIndex: 'priority', width: 80,
      render: (p: number) => <Tag color={priorityMap[p]?.color}>{priorityMap[p]?.text}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 200, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/inspection/${r.id}`)}>详情</Button>
          {r.status === 'submitted' && (
            <Button type="link" size="small" onClick={() => navigate(`/inspection/${r.id}/review`)}>审核</Button>
          )}
          {r.status === 'pending' && (
            <>
              <Button type="link" size="small" onClick={async () => {
                await inspectionApi.start(r.id);
                message.success('任务已开始');
                fetchData();
              }}>开始</Button>
              <Button type="link" size="small" danger onClick={async () => {
                await inspectionApi.cancel(r.id, '重复派单');
                message.success('任务已取消');
                fetchData();
              }}>取消</Button>
            </>
          )}
          {(r.status === 'pending' || r.status === 'in_progress') && (
            <Button type="link" size="small" onClick={async () => {
              await inspectionApi.suspend(r.id, '天气原因');
              message.success('任务已挂起');
              fetchData();
            }}>挂起</Button>
          )}
          {r.status === 'suspended' && (
            <Button type="link" size="small" onClick={async () => {
              await inspectionApi.resume(r.id);
              message.success('任务已恢复');
              fetchData();
            }}>恢复</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>巡检任务中心</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          loadEquipment();
          setCreateModal(true);
        }}>
          创建任务
        </Button>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={(k) => { setActiveTab(k); setPage(1); }} items={statusTabs.map((t) => ({
          key: t.key,
          label: t.label,
        }))} />
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
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
        title="创建巡检任务"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="设备" name="equipment_id" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="搜索选择设备"
              options={equipmentOptions}
              onSearch={loadEquipment}
              filterOption={false}
            />
          </Form.Item>
          <Form.Item label="巡检人" name="inspector_id" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '张明 (巡检一班)', value: 3 },
                { label: '李新 (巡检二班)', value: 4 },
              ]}
            />
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
    </div>
  );
}
