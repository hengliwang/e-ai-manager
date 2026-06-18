import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, InputNumber, Select, DatePicker, Button, Space, message, Spin, Upload } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { equipmentApi, type FieldConfig, type FieldOption } from '../../api/equipment';
import dayjs from 'dayjs';
import type { Rule } from 'antd/es/form';
import type { UploadFile, RcFile } from 'antd/es/upload';

type FieldValue = any;

export default function EquipmentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadFile[]>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  // 加载字段配置
  useEffect(() => {
    equipmentApi
      .getFieldConfigs()
      .then((res) => {
        setFieldConfigs(res.data || []);
        setConfigsLoading(false);
      })
      .catch(() => {
        message.error('字段配置加载失败');
        setConfigsLoading(false);
      });
  }, []);

  // 加载编辑数据
  useEffect(() => {
    if (isEdit && id && fieldConfigs.length > 0) {
      setLoading(true);
      equipmentApi
        .get(Number(id))
        .then((res) => {
          const data = res.data;
          const formValues: Record<string, FieldValue> = {};
          for (const cfg of fieldConfigs) {
            const val = data[cfg.field_name];
            if (val !== undefined && val !== null) {
              if (cfg.field_type === 'date') {
                formValues[cfg.field_name] = val ? dayjs(val) : undefined;
              } else if (cfg.field_type === 'multi_select') {
                formValues[cfg.field_name] = Array.isArray(val) ? val : [val];
              } else {
                formValues[cfg.field_name] = val;
              }
            }
          }
          if (data.extra_fields) {
            Object.entries(data.extra_fields).forEach(([k, v]) => {
              formValues[k] = v;
            });
          }
          form.setFieldsValue(formValues);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id, fieldConfigs]);

  // 级联: 根据父字段值筛选子字段选项
  const getCascadedOptions = useCallback(
    (config: FieldConfig): FieldOption[] => {
      if (!config.cascade_rules || config.cascade_rules.length === 0) {
        return (config.options || []).filter((o) => o.active !== false);
      }
      const rule = config.cascade_rules[0];
      const parentValue = form.getFieldValue(rule.field);
      if (!parentValue || !rule.mapping[parentValue]) {
        return (config.options || []).filter((o) => o.active !== false);
      }
      const allowedValues = rule.mapping[parentValue];
      return (config.options || []).filter(
        (o) => allowedValues.includes(o.value) && o.active !== false
      );
    },
    [form]
  );

  // 可见性判断
  const isFieldVisible = useCallback(
    (config: FieldConfig): boolean => {
      if (!config.visibility_rules || config.visibility_rules.length === 0) return true;
      for (const rule of config.visibility_rules) {
        const val = form.getFieldValue(rule.field);
        const values = (rule.value || '').split(',');
        const op = rule.operator || 'in';
        let match = false;
        if (op === 'contains' || op === 'contains_any') {
          match = val && values.some((v: string) => String(val).includes(v));
        } else {
          match = values.includes(val);
        }
        if (rule.action === 'hide') match = !match;
        if (!match) return false;
      }
      return true;
    },
    [form]
  );

  // 动态必填
  const isFieldRequired = useCallback(
    (config: FieldConfig): boolean => {
      if (config.is_required === 'always') return true;
      if (config.is_required === 'dynamic' && config.required_rules) {
        for (const rule of config.required_rules) {
          const val = form.getFieldValue(rule.field);
          const values = (rule.value || '').split(',');
          const op = rule.operator || 'in';
          if (op === 'contains' || op === 'contains_any') {
            if (val && values.some((v: string) => String(val).includes(v))) return true;
          } else {
            if (values.includes(val)) return true;
          }
        }
      }
      return false;
    },
    [form]
  );

  // 构建 antd 校验规则
  const buildRules = useCallback(
    (config: FieldConfig): Rule[] => {
      const rules: Rule[] = [];
      const required = isFieldRequired(config);
      if (required) {
        rules.push({ required: true, message: `请输入${config.field_label}` });
      }
      if (config.field_type === 'number' && config.min_value !== undefined) {
        rules.push({
          type: 'number',
          min: config.min_value,
          max: config.max_value,
          message: `范围: ${config.min_value} ~ ${config.max_value ?? '∞'}`,
        });
      }
      if (config.field_type === 'text' && config.regex_pattern) {
        rules.push({
          pattern: new RegExp(config.regex_pattern),
          message: config.regex_hint || `${config.field_label}格式不正确`,
        });
      }
      if (config.max_length && config.max_length <= 200) {
        rules.push({ max: config.max_length, message: `最多${config.max_length}个字符` });
      }
      return rules;
    },
    [isFieldRequired]
  );

  // 渲染单个字段
  const renderField = (config: FieldConfig) => {
    if (!isFieldVisible(config)) return null;
    const rules = buildRules(config);

    switch (config.field_type) {
      case 'select':
        return (
          <Form.Item key={config.field_name} label={config.field_label} name={config.field_name} rules={rules}>
            <Select
              placeholder={`请选择${config.field_label}`}
              options={getCascadedOptions(config).map((o) => ({
                label: o.label,
                value: o.value,
                disabled: !o.active,
              }))}
              onChange={() => setTimeout(() => form.validateFields(), 0)}
            />
          </Form.Item>
        );

      case 'multi_select':
        return (
          <Form.Item key={config.field_name} label={config.field_label} name={config.field_name} rules={rules}>
            <Select
              mode="multiple"
              placeholder={`请选择${config.field_label}`}
              options={(config.options || [])
                .filter((o) => o.active !== false)
                .map((o) => ({ label: o.label, value: o.value }))}
            />
          </Form.Item>
        );

      case 'number':
        return (
          <Form.Item key={config.field_name} label={config.field_label} name={config.field_name} rules={rules}>
            <InputNumber
              style={{ width: '100%' }}
              placeholder={`请输入${config.field_label}`}
              min={config.min_value}
              max={config.max_value}
              precision={config.decimal_places}
            />
          </Form.Item>
        );

      case 'date':
        return (
          <Form.Item key={config.field_name} label={config.field_label} name={config.field_name} rules={rules}>
            <DatePicker
              style={{ width: '100%' }}
              picker={config.date_format === 'month' ? 'month' : undefined}
              format={config.date_format === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'}
              placeholder={`请选择${config.field_label}`}
            />
          </Form.Item>
        );

      case 'video':
      case 'image': {
        const isVideo = config.field_type === 'video';
        const accept = isVideo ? 'video/*,image/*' : 'image/*';
        const fileList = uploadedFiles[config.field_name] || [];

        const customUpload = async (options: any) => {
          const { file, onSuccess, onError } = options;
          setUploading((prev) => ({ ...prev, [config.field_name]: true }));
          try {
            const res = await equipmentApi.uploadFile(file as RcFile);
            const filePath = res.data.file_path;
            form.setFieldValue(config.field_name, filePath);
            setUploadedFiles((prev) => ({
              ...prev,
              [config.field_name]: [{ uid: file.uid, name: file.name, status: 'done', url: filePath }],
            }));
            onSuccess(res.data, file);
            message.success(`${file.name} 上传成功`);
          } catch {
            onError(new Error('上传失败'));
            message.error('文件上传失败');
          } finally {
            setUploading((prev) => ({ ...prev, [config.field_name]: false }));
          }
        };

        return (
          <Form.Item key={config.field_name} label={config.field_label} name={config.field_name} rules={rules}>
            <div>
              <Upload
                accept={accept}
                maxCount={3}
                fileList={fileList}
                customRequest={customUpload}
                listType="picture-card"
                onRemove={() => {
                  setUploadedFiles((prev) => ({ ...prev, [config.field_name]: [] }));
                  form.setFieldValue(config.field_name, undefined);
                }}
                onChange={(info) => {
                  setUploadedFiles((prev) => ({ ...prev, [config.field_name]: info.fileList }));
                }}
              >
                {fileList.length < 3 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>
                      {uploading[config.field_name] ? '上传中...' : isVideo ? '图片/视频' : '照片'}
                    </div>
                  </div>
                )}
              </Upload>
            </div>
          </Form.Item>
        );
      }

      default:
        return (
          <Form.Item key={config.field_name} label={config.field_label} name={config.field_name} rules={rules}>
            {config.max_length && config.max_length > 200 ? (
              <Input.TextArea rows={3} maxLength={config.max_length} showCount placeholder={`请输入${config.field_label}`} />
            ) : (
              <Input placeholder={`请输入${config.field_label}`} maxLength={config.max_length || undefined} showCount={!!config.max_length} />
            )}
          </Form.Item>
        );
    }
  };

  const onFinish = async (values: Record<string, FieldValue>) => {
    setSubmitting(true);
    const data: Record<string, FieldValue> = {};
    for (const cfg of fieldConfigs) {
      const val = values[cfg.field_name];
      if (val === undefined) continue;
      if (cfg.field_type === 'date' && val) {
        data[cfg.field_name] = dayjs.isDayjs(val)
          ? cfg.date_format === 'month'
            ? val.format('YYYY-MM')
            : val.format('YYYY-MM-DD')
          : val;
      } else if (cfg.field_type === 'multi_select' && Array.isArray(val)) {
        data[cfg.field_name] = val;
      } else {
        data[cfg.field_name] = val;
      }
    }
    try {
      if (isEdit) {
        await equipmentApi.update(Number(id), data as any);
        message.success('更新成功');
      } else {
        await equipmentApi.create(data as any);
        message.success('创建成功');
      }
      navigate('/equipment');
    } catch {
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (configsLoading || loading) {
    return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/equipment')}>
            返回
          </Button>
          <h2 style={{ margin: 0 }}>{isEdit ? '编辑设备' : '新增设备'}</h2>
        </Space>
      </div>
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 800 }} onValuesChange={() => form.validateFields()}>
          {fieldConfigs.sort((a, b) => a.sort_order - b.sort_order).map(renderField)}
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
