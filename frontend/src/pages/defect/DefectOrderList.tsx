import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Tag, Select, Input, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { defectApi } from '../../api/defect';
import dayjs from 'dayjs';

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'blue', text: '待处理' },
  in_progress: { color: 'orange', text: '处理中' },
  fully_resolved: { color: 'green', text: '已消除' },
  partially_resolved: { color: 'gold', text: '部分消除' },
  cancelled: { color: 'default', text: '已取消' },
};

const severityMap: Record<number, { color: string; text: string }> = {
  1: { color: 'red', text: '危急' },
  2: { color: 'orange', text: '严重' },
  3: { color: 'default', text: '一般' },
};

export default function DefectOrderList() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();

  const fetchData = () => {
    setLoading(true);
    defectApi.list({ skip: (page - 1) * 15, limit: 15, status, keyword: keyword || undefined })
      .then((res) => {
        setData(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, status]);

  const columns = [
    { title: '工单编号', dataIndex: 'order_no', width: 160 },
    { title: '缺陷名称', dataIndex: 'defect_name', width: 150 },
    { title: '缺陷类型', dataIndex: 'defect_type', width: 100 },
    {
      title: '等级', dataIndex: 'severity', width: 80,
      render: (s: number) => <Tag color={severityMap[s]?.color}>{severityMap[s]?.text}</Tag>,
    },
    {
      title: '紧急', dataIndex: 'is_emergency', width: 80,
      render: (v: string) => v === 'true' ? <Tag color="red">紧急</Tag> : <span>-</span>,
    },
    {
      title: '位置', key: 'location', width: 200,
      render: (_: any, r: any) =>
        [r.location_province, r.location_city, r.location_district, r.location_detail].filter(Boolean).join(''),
    },
    { title: '巡检人', dataIndex: 'inspector_name', width: 100 },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 110,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'actions', width: 200, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/defect/${r.id}`)}>详情</Button>
          {r.status === 'pending' && (
            <Button type="link" size="small" onClick={async () => {
              await defectApi.update(r.id, { status: 'in_progress' });
              message.success('已派发处理');
              fetchData();
            }}>派发</Button>
          )}
          {(r.status === 'pending' || r.status === 'in_progress') && (
            <Button type="link" size="small" danger onClick={async () => {
              await defectApi.cancel(r.id);
              message.success('已取消');
              fetchData();
            }}>取消</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>消缺工单管理</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Input
            placeholder="搜索工单编号"
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => { setPage(1); fetchData(); }}
          />
          <Select
            placeholder="状态筛选"
            style={{ width: 120 }}
            allowClear
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '处理中', value: 'in_progress' },
              { label: '已消除', value: 'fully_resolved' },
              { label: '部分消除', value: 'partially_resolved' },
              { label: '已取消', value: 'cancelled' },
            ]}
          />
          <Button type="primary" onClick={() => { setPage(1); fetchData(); }}>搜索</Button>
        </div>
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
    </div>
  );
}
