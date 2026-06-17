import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Card, Input, Select, Button, Space, Tag, Popconfirm, message } from 'antd';
import { PlusOutlined, ExportOutlined, UploadOutlined, SearchOutlined } from '@ant-design/icons';
import { equipmentApi, type EquipmentData } from '../../api/equipment';
import dayjs from 'dayjs';

export default function EquipmentList() {
  const [data, setData] = useState<EquipmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const navigate = useNavigate();

  const fetchData = (p = page, kw = keyword, cat = category) => {
    setLoading(true);
    equipmentApi.list({ skip: (p - 1) * 15, limit: 15, keyword: kw, category: cat })
      .then((res) => {
        setData(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: number) => {
    await equipmentApi.delete(id);
    message.success('删除成功');
    fetchData();
  };

  const columns = [
    { title: '设备名称', dataIndex: 'equipment_name', key: 'equipment_name', width: 180 },
    {
      title: '设备大类', dataIndex: 'category', key: 'category', width: 100,
      render: (v: string) => <Tag color={v === '电器类' ? 'blue' : 'orange'}>{v}</Tag>,
    },
    { title: '设备类型', dataIndex: 'equipment_type', key: 'equipment_type', width: 120 },
    { title: '资产编码', dataIndex: 'asset_code', key: 'asset_code', width: 130 },
    {
      title: '地址', key: 'address', width: 200,
      render: (_: any, r: EquipmentData) =>
        [r.province, r.city, r.district, r.street, r.address_detail].filter(Boolean).join(''),
    },
    { title: '所属客户', dataIndex: 'customer_name', key: 'customer_name', width: 150 },
    {
      title: '照片', dataIndex: 'photo_count', key: 'photo_count', width: 70,
      render: (v: number) => v ? `${v}张` : '-',
    },
    {
      title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 110,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'actions', width: 160, fixed: 'right' as const,
      render: (_: any, r: EquipmentData) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/equipment/${r.id}`)}>查看</Button>
          <Button type="link" size="small" onClick={() => navigate(`/equipment/${r.id}/edit`)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id!)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>设备档案管理</h2>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="搜索设备名称/编码/地址"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => { setPage(1); fetchData(1, keyword, category); }}
            />
            <Select
              placeholder="设备大类"
              style={{ width: 120 }}
              allowClear
              value={category}
              onChange={(v) => { setCategory(v); setPage(1); fetchData(1, keyword, v); }}
              options={[
                { label: '土建类', value: '土建类' },
                { label: '电器类', value: '电器类' },
              ]}
            />
            <Button type="primary" onClick={() => { setPage(1); fetchData(1, keyword, category); }}>
              搜索
            </Button>
          </Space>
          <Space>
            <Button icon={<UploadOutlined />}>批量导入</Button>
            <Button icon={<ExportOutlined />}>导出Excel</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/equipment/new')}>
              新增设备
            </Button>
          </Space>
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
            onChange: (p) => { setPage(p); fetchData(p, keyword, category); },
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>
    </div>
  );
}
