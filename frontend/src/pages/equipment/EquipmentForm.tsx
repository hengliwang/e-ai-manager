import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, Button, Space, message, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { equipmentApi, type EquipmentData } from '../../api/equipment';
import dayjs from 'dayjs';

const locationOption = [
  { label: '江苏省', value: '江苏省' },
];

const defaultFieldConfigs = [
  { field_name: 'category', field_label: '设备大类', field_type: 'select', is_required: 'always',
    options: ['土建类', '电器类'] },
  { field_name: 'equipment_type', field_label: '设备类型', field_type: 'select', is_required: 'always' },
  { field_name: 'asset_code', field_label: '资产编码', field_type: 'text', is_required: 'optional' },
  { field_name: 'equipment_name', field_label: '设备名称', field_type: 'text', is_required: 'always' },
  { field_name: 'cabinet_model', field_label: '柜型/型号', field_type: 'text', is_required: 'optional' },
  { field_name: 'factory_number', field_label: '出厂编号', field_type: 'text', is_required: 'optional' },
  { field_name: 'line_name', field_label: '线路名称', field_type: 'text', is_required: 'optional' },
  { field_name: 'station_name', field_label: '站所名称', field_type: 'text', is_required: 'optional' },
  { field_name: 'operation_date', field_label: '投运日期', field_type: 'date', is_required: 'optional' },
  { field_name: 'manufacturer', field_label: '厂家信息', field_type: 'text', is_required: 'optional' },
];

const categoryTypeMap: Record<string, string[]> = {
  '土建类': ['电线杆', '电缆井', '站房', '沟道'],
  '电器类': ['变压器', '开关柜', '架空线路', '断路器'],
};

export default function EquipmentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<string | undefined>();
  const navigate = useNavigate();

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      equipmentApi.get(Number(id)).then((res) => {
        const data = res.data;
        form.setFieldsValue({
          ...data,
          operation_date: data.operation_date ? dayjs(data.operation_date) : undefined,
        });
        setCategory(data.category);
        setLoading(false);
      });
    }
  }, [id]);

  const onFinish = async (values: any) => {
    setSubmitting(true);
    const data = { ...values, operation_date: values.operation_date?.format?.('YYYY-MM-DD') };
    try {
      if (isEdit) {
        await equipmentApi.update(Number(id), data);
        message.success('更新成功');
      } else {
        await equipmentApi.create(data);
        message.success('创建成功');
      }
      navigate('/equipment');
    } catch (err) {
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;

  const typeOptions = category ? categoryTypeMap[category]?.map((t: string) => ({ label: t, value: t })) || [] : [];
  const showElectrical = category === '电器类';
  const showCivil = category !== '电器类';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/equipment')}>返回</Button>
          <h2 style={{ margin: 0 }}>{isEdit ? '编辑设备' : '新增设备'}</h2>
        </Space>
      </div>
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 800 }}
          initialValues={{ province: '江苏省', city: '苏州市' }}
        >
          <Form.Item label="设备大类" name="category" rules={[{ required: true, message: '请选择' }]}>
            <Select
              placeholder="请选择设备大类"
              options={[
                { label: '土建类', value: '土建类' },
                { label: '电器类', value: '电器类' },
              ]}
              onChange={(v) => {
                setCategory(v);
                form.setFieldValue('equipment_type', undefined);
              }}
            />
          </Form.Item>
          <Form.Item label="设备类型" name="equipment_type" rules={[{ required: true, message: '请选择' }]}>
            <Select placeholder="请选择设备类型" options={typeOptions} disabled={!category} />
          </Form.Item>
          <Form.Item label="设备名称" name="equipment_name" rules={[{ required: true, message: '请输入设备名称' }]}>
            <Input placeholder="如：吴中变#1主变" />
          </Form.Item>

          {showElectrical !== false && (
            <>
              <Form.Item label="资产编码" name="asset_code" rules={showElectrical ? [{ required: true, message: '请输入资产编码' }] : []}>
                <Input placeholder="如：SGCC-001" />
              </Form.Item>
              <Form.Item label="投运日期" name="operation_date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="厂家信息" name="manufacturer">
                <Input placeholder="如：特变电工" />
              </Form.Item>
            </>
          )}

          <Form.Item label="线路名称" name="line_name">
            <Input placeholder="线路名称" />
          </Form.Item>
          <Form.Item label="站所名称" name="station_name">
            <Input placeholder="站所名称" />
          </Form.Item>
          <Form.Item label="柜型/型号" name="cabinet_model">
            <Input placeholder="如：KYN28-12" />
          </Form.Item>
          <Form.Item label="出厂编号" name="factory_number">
            <Input placeholder="出厂编号" />
          </Form.Item>

          <Form.Item label="所属客户" name="customer_name" rules={[{ required: true, message: '请输入所属客户' }]}>
            <Input placeholder="如：国网苏州供电公司" />
          </Form.Item>
          <Form.Item label="详细地址" name="address_detail">
            <Input placeholder="详细地址" />
          </Form.Item>
          <Form.Item label="经度" name="longitude">
            <Input placeholder="如：120.632" />
          </Form.Item>
          <Form.Item label="纬度" name="latitude">
            <Input placeholder="如：31.262" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} maxLength={500} placeholder="备注信息" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {isEdit ? '保存修改' : '创建设备'}
              </Button>
              <Button onClick={() => navigate('/equipment')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
