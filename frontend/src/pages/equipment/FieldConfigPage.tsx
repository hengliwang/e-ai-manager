import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Button, Space, message, Modal, Form, Input, Select, InputNumber,
  Tag, Popconfirm, Tooltip, Switch
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { equipmentApi, type FieldConfig, type FieldOption } from '../../api/equipment';

const fieldTypeLabels: Record<string, string> = {
  text: '文本输入',
  number: '数值输入',
  date: '日期选择',
  select: '下拉单选',
  multi_select: '下拉多选',
  image: '图片上传',
  video: '多媒体',
};

export default function FieldConfigPage() {
  const [configs, setConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<FieldConfig | null>(null);
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [managingConfig, setManagingConfig] = useState<FieldConfig | null>(null);
  const [form] = Form.useForm();
  const [optionForm] = Form.useForm();
  const navigate = useNavigate();

  const fetchConfigs = () => {
    setLoading(true);
    equipmentApi
      .getFieldConfigs(true)
      .then((res) => {
        setConfigs(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchConfigs(); }, []);

  // 打开新增/编辑弹窗
  const openModal = (config?: FieldConfig) => {
    setEditingConfig(config || null);
    if (config) {
      form.setFieldsValue(config);
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  // 保存字段配置
  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editingConfig) {
        await equipmentApi.updateFieldConfig(editingConfig.id, values);
        message.success('更新成功');
      } else {
        await equipmentApi.createFieldConfig(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchConfigs();
    } catch {
      message.error('保存失败');
    }
  };

  // 删除字段配置
  const handleDelete = async (id: number) => {
    try {
      await equipmentApi.deleteFieldConfig(id);
      message.success('删除成功');
      fetchConfigs();
    } catch {
      message.error('删除失败');
    }
  };

  // 打开选项管理弹窗
  const openOptionModal = (config: FieldConfig) => {
    setManagingConfig(config);
    setOptionModalOpen(true);
  };

  // 选项管理: 添加
  const handleAddOption = async (configId: number) => {
    const values = await optionForm.validateFields();
    try {
      await equipmentApi.manageOptions(configId, {
        action: 'add',
        option: { label: values.label, value: values.value, active: true },
      });
      message.success('选项已添加');
      optionForm.resetFields();
      fetchConfigs();
    } catch {
      message.error('添加失败');
    }
  };

  // 选项管理: 编辑
  const handleEditOption = async (configId: number, oldValue: string) => {
    Modal.confirm({
      title: '编辑选项',
      content: (
        <Form layout="vertical">
          <Form.Item label="显示名" initialValue={oldValue}>
            <Input id="opt-label" placeholder="显示名" />
          </Form.Item>
          <Form.Item label="值" initialValue={oldValue}>
            <Input id="opt-value" placeholder="值" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const label = (document.getElementById('opt-label') as HTMLInputElement)?.value;
        const value = (document.getElementById('opt-value') as HTMLInputElement)?.value;
        try {
          await equipmentApi.manageOptions(configId, {
            action: 'update',
            old_value: oldValue,
            option: { label: label || oldValue, value: value || oldValue, active: true },
          });
          message.success('选项已更新');
          fetchConfigs();
        } catch {
          message.error('更新失败');
        }
      },
    });
  };

  // 选项管理: 删除
  const handleRemoveOption = async (configId: number, value: string) => {
    try {
      await equipmentApi.manageOptions(configId, { action: 'remove', old_value: value });
      message.success('选项已删除');
      fetchConfigs();
    } catch {
      message.error('删除失败');
    }
  };

  // 选项管理: 启用/禁用
  const handleToggleOption = async (configId: number, value: string) => {
    try {
      await equipmentApi.manageOptions(configId, { action: 'toggle', old_value: value });
      fetchConfigs();
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    { title: '字段名', dataIndex: 'field_name', key: 'field_name', width: 140 },
    { title: '显示标题', dataIndex: 'field_label', key: 'field_label', width: 130 },
    {
      title: '类型', dataIndex: 'field_type', key: 'field_type', width: 100,
      render: (t: string) => fieldTypeLabels[t] || t,
    },
    {
      title: '必填', dataIndex: 'is_required', key: 'is_required', width: 70,
      render: (v: string) => (
        <Tag color={v === 'always' ? 'red' : v === 'dynamic' ? 'orange' : 'default'}>
          {v === 'always' ? '必填' : v === 'dynamic' ? '动态' : '选填'}
        </Tag>
      ),
    },
    {
      title: '状态', dataIndex: 'is_active', key: 'is_active', width: 70,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '选项数', key: 'options_count', width: 70,
      render: (_: any, r: FieldConfig) =>
        r.options ? r.options.filter((o) => o.active !== false).length : '-',
    },
    {
      title: '校验/限制', key: 'constraints', ellipsis: true,
      render: (_: any, r: FieldConfig) => {
        const parts: string[] = [];
        if (r.max_length) parts.push(`最长${r.max_length}字`);
        if (r.regex_pattern) parts.push(`正则: ${r.regex_pattern}`);
        if (r.min_value !== undefined) parts.push(`[${r.min_value},${r.max_value}]`);
        if (r.decimal_places) parts.push(`${r.decimal_places}位小数`);
        return parts.join(' | ') || '-';
      },
    },
    {
      title: '操作', key: 'actions', width: 220,
      render: (_: any, record: FieldConfig) => (
        <Space>
          {(record.field_type === 'select' || record.field_type === 'multi_select') && record.options && (
            <Tooltip title="管理选项">
              <Button size="small" icon={<SettingOutlined />} onClick={() => openOptionModal(record)} />
            </Tooltip>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/equipment')}>返回</Button>
          <h2 style={{ margin: 0 }}>基础属性配置</h2>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          新增字段
        </Button>
      </div>

      <Card>
        <Table
          dataSource={configs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 字段配置编辑弹窗 */}
      <Modal
        title={editingConfig ? '编辑字段配置' : '新增字段配置'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ is_required: 'optional', field_type: 'text', sort_order: 0, is_active: 'active' }}>
          <Form.Item label="字段名(key)" name="field_name" rules={[{ required: true }]} tooltip="数据库字段名，英文">
            <Input placeholder="如: equipment_name" />
          </Form.Item>
          <Form.Item label="显示标题" name="field_label" rules={[{ required: true }]}>
            <Input placeholder="如: 设备名称" />
          </Form.Item>
          <Form.Item label="输入类型" name="field_type" rules={[{ required: true }]}>
            <Select options={Object.entries(fieldTypeLabels).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
          <Form.Item label="必填状态" name="is_required">
            <Select
              options={[
                { label: '必填', value: 'always' },
                { label: '动态(按条件)', value: 'dynamic' },
                { label: '选填', value: 'optional' },
              ]}
            />
          </Form.Item>
          <Form.Item label="排序号" name="sort_order">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item label="状态" name="is_active">
            <Select options={[{ label: '启用', value: 'active' }, { label: '禁用', value: 'disabled' }]} />
          </Form.Item>
          <Form.Item label="最大字符数" name="max_length" tooltip="适用于 text 类型">
            <InputNumber min={1} max={5000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="正则校验" name="regex_pattern" tooltip="适用于 text 类型">
            <Input placeholder='如: ^[A-Z]+-[\d]+$' />
          </Form.Item>
          <Form.Item label="正则提示" name="regex_hint">
            <Input placeholder="校验失败时显示的提示文字" />
          </Form.Item>
          <Space>
            <Form.Item label="最小值" name="min_value" tooltip="适用于 number 类型">
              <InputNumber min={-99999} />
            </Form.Item>
            <Form.Item label="最大值" name="max_value">
              <InputNumber min={-99999} />
            </Form.Item>
            <Form.Item label="小数位" name="decimal_places">
              <InputNumber min={0} max={10} />
            </Form.Item>
          </Space>
          <Form.Item label="日期格式" name="date_format" tooltip="适用于 date 类型">
            <Select
              allowClear
              options={[
                { label: '年月日 (YYYY-MM-DD)', value: 'date' },
                { label: '年月 (YYYY-MM)', value: 'month' },
              ]}
            />
          </Form.Item>
          <Form.Item label="默认值" name="default_value" tooltip='特殊值: "today" 表示当天'>
            <Input placeholder='today 或具体值' />
          </Form.Item>
        </Form>
      </Modal>

      {/* 选项管理弹窗 */}
      <Modal
        title={`选项管理 - ${managingConfig?.field_label || ''}`}
        open={optionModalOpen}
        onCancel={() => setOptionModalOpen(false)}
        footer={null}
        width={600}
      >
        {managingConfig && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Form form={optionForm} layout="inline">
                <Form.Item label="显示名" name="label" rules={[{ required: true }]}>
                  <Input placeholder="显示名" />
                </Form.Item>
                <Form.Item label="值" name="value" rules={[{ required: true }]}>
                  <Input placeholder="值" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={() => handleAddOption(managingConfig.id)}>
                    添加选项
                  </Button>
                </Form.Item>
              </Form>
            </div>
            <Table
              dataSource={(managingConfig.options || []).map((o, i) => ({ ...o, _key: i }))}
              rowKey="_key"
              pagination={false}
              size="small"
              columns={[
                { title: '显示名', dataIndex: 'label', key: 'label' },
                { title: '值', dataIndex: 'value', key: 'value' },
                {
                  title: '状态', dataIndex: 'active', key: 'active',
                  render: (v: boolean, record: FieldOption) => (
                    <Switch
                      checked={v !== false}
                      size="small"
                      onChange={() => handleToggleOption(managingConfig.id, record.value)}
                    />
                  ),
                },
                {
                  title: '操作', key: 'ops',
                  render: (_: any, record: FieldOption) => (
                    <Space>
                      <Button size="small" onClick={() => handleEditOption(managingConfig.id, record.value)}>编辑</Button>
                      <Popconfirm title="确定删除?" onConfirm={() => handleRemoveOption(managingConfig.id, record.value)}>
                        <Button size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
