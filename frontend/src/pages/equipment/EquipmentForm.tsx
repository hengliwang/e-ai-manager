import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, InputNumber, Select, DatePicker, Button, Space, message, Spin, Image } from 'antd';
import locale from 'antd/es/date-picker/locale/zh_CN';
import { ArrowLeftOutlined, UploadOutlined, DeleteOutlined, AimOutlined } from '@ant-design/icons';
import { equipmentApi, type FieldConfig, type FieldOption } from '../../api/equipment';
import dayjs from 'dayjs';
import type { Rule } from 'antd/es/form';

type FieldValue = any;

export default function EquipmentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [initialValues, setInitialValues] = useState<Record<string, FieldValue>>({});
  const [ready, setReady] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<Record<string, { urls: string[]; uploading: boolean }>>({});
  const [geoLoading, setGeoLoading] = useState(false);
  const dataLoadedRef = useRef(false);
  const navigate = useNavigate();

  // 从浏览器获取当前位置，自动填写经纬度
  const handleGetGeoLocation = () => {
    if (!navigator.geolocation) {
      message.error('当前浏览器不支持地理位置定位');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setFieldsValue({
          longitude: String(pos.coords.longitude),
          latitude: String(pos.coords.latitude),
        });
        setGeoLoading(false);
        message.success('已获取当前位置');
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          message.error('定位权限被拒绝，请在浏览器设置中允许定位');
        } else {
          message.error('获取位置失败，请手动输入');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 并行加载字段配置（和编辑数据）
  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    const loadConfigs = equipmentApi.getFieldConfigs().then((res) => res.data || []);

    if (isEdit && id) {
      Promise.all([loadConfigs, equipmentApi.get(Number(id))])
        .then(([configs, equipRes]) => {
          const data = equipRes.data;
          const formValues: Record<string, FieldValue> = {};
          for (const cfg of configs) {
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
          // 加载已有图片/视频到预览状态
          const media: Record<string, { urls: string[]; uploading: boolean }> = {};
          for (const cfg of configs) {
            if ((cfg.field_type === 'image' || cfg.field_type === 'video') && formValues[cfg.field_name]) {
              const urls = String(formValues[cfg.field_name]).split(',').filter(Boolean);
              if (urls.length > 0) media[cfg.field_name] = { urls, uploading: false };
            }
          }
          setFieldConfigs(configs);
          setInitialValues(formValues);
          setMediaFiles(media);
          setReady(true);
        })
        .catch((err) => {
          console.error('加载编辑数据失败:', err);
          dataLoadedRef.current = false;
          setReady(true);
        });
    } else {
      loadConfigs
        .then((configs) => {
          setFieldConfigs(configs);
          setReady(true);
        })
        .catch(() => {
          message.error('字段配置加载失败');
          setReady(true);
        });
    }
  }, []);

  // 级联: 根据父字段值筛选子字段选项
  const getCascadedOptions = useCallback(
    (config: FieldConfig): FieldOption[] => {
      if (!config.cascade_rules || config.cascade_rules.length === 0) {
        return (config.options || []).filter((o) => o.active !== false);
      }
      const rule = config.cascade_rules[0];
      if (!rule?.mapping) {
        return (config.options || []).filter((o) => o.active !== false);
      }
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
      if (config.field_type === 'number' && config.min_value != null) {
        rules.push({
          type: 'number',
          min: config.min_value,
          max: config.max_value,
          message: `范围: ${config.min_value} ~ ${config.max_value ?? '∞'}`,
        });
      }
      if (config.field_type === 'text' && config.regex_pattern) {
        try {
          const regex = new RegExp(config.regex_pattern);
          rules.push({
            pattern: regex,
            message: config.regex_hint || `${config.field_label}格式不正确`,
          });
        } catch {
          // 无效正则，跳过
        }
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
              locale={locale}
              picker={config.date_format === 'month' ? 'month' : undefined}
              format={config.date_format === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'}
              placeholder={`请选择${config.field_label}`}
            />
          </Form.Item>
        );

      case 'video':
      case 'image': {
        const fieldName = config.field_name;
        const files = mediaFiles[fieldName] || { urls: [], uploading: false };

        const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setMediaFiles((prev) => ({ ...prev, [fieldName]: { ...files, uploading: true } }));
          try {
            const res = await equipmentApi.uploadFile(file);
            const newUrl = res.data.file_path;
            const newUrls = [...files.urls, newUrl];
            setMediaFiles((prev) => ({ ...prev, [fieldName]: { urls: newUrls, uploading: false } }));
            form.setFieldValue(fieldName, newUrls.join(','));
            message.success(`${file.name} 上传成功`);
          } catch {
            setMediaFiles((prev) => ({ ...prev, [fieldName]: { ...files, uploading: false } }));
            message.error('文件上传失败');
          }
          // Reset input so same file can be selected again
          e.target.value = '';
        };

        const removeFile = (idx: number) => {
          const newUrls = files.urls.filter((_, i) => i !== idx);
          setMediaFiles((prev) => ({ ...prev, [fieldName]: { ...files, urls: newUrls } }));
          form.setFieldValue(fieldName, newUrls.length ? newUrls.join(',') : undefined);
        };

        return (
          <Form.Item key={fieldName} label={config.field_label} name={fieldName} rules={rules}>
            <div>
              {/* Hidden file input */}
              <input
                type="file"
                id={`upload-${fieldName}`}
                accept={config.field_type === 'video' ? 'video/*,image/*' : 'image/*'}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              {/* Thumbnail previews */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {files.urls.map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 104, height: 104, border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
                    <Image src={url} width={102} height={102} style={{ objectFit: 'cover' }} preview={{ mask: '预览' }} />
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      style={{ position: 'absolute', top: 0, right: 0, borderRadius: '0 8px 0 8px' }}
                      onClick={() => removeFile(idx)}
                    />
                  </div>
                ))}
              </div>
              {/* Upload button */}
              <Button
                icon={<UploadOutlined />}
                loading={files.uploading}
                onClick={() => document.getElementById(`upload-${fieldName}`)?.click()}
                disabled={files.urls.length >= 3}
              >
                {files.uploading ? '上传中...' : `选择${config.field_type === 'video' ? '图片/视频' : '照片'}`}
                {files.urls.length > 0 && ` (${files.urls.length}/3)`}
              </Button>
            </div>
          </Form.Item>
        );
      }

      default:
        return (
          <Form.Item key={config.field_name} label={config.field_label} name={config.field_name} rules={rules}>
            {config.max_length && config.max_length > 200 ? (
              <Input.TextArea rows={3} maxLength={config.max_length} showCount placeholder={`请输入${config.field_label}`} />
            ) : config.field_name === 'longitude' ? (
              <Input
                placeholder="点击右侧按钮自动获取"
                suffix={<AimOutlined style={{ color: geoLoading ? '#1a7a3a' : '#999', cursor: 'pointer' }} onClick={handleGetGeoLocation} />}
                readOnly
              />
            ) : (
              <Input placeholder={`请输入${config.field_label}`} maxLength={config.max_length || undefined} showCount={!!config.max_length} />
            )}
          </Form.Item>
        );
    }
  };

  // Equipment 表的核心列名
  const coreColumns = new Set([
    'category', 'equipment_type', 'equipment_name', 'asset_code', 'cabinet_model',
    'factory_number', 'line_name', 'station_name', 'operation_date', 'manufacturer',
    'province', 'city', 'district', 'street', 'address_detail', 'longitude',
    'latitude', 'customer_name', 'remark',
  ]);

  const onFinish = async (values: Record<string, FieldValue>) => {
    setSubmitting(true);
    const data: Record<string, FieldValue> = {};
    const extraFields: Record<string, FieldValue> = {};
    for (const cfg of fieldConfigs) {
      const val = values[cfg.field_name];
      if (val === undefined) continue;
      let finalVal = val;
      if (cfg.field_type === 'date' && val) {
        finalVal = dayjs.isDayjs(val)
          ? cfg.date_format === 'month'
            ? val.format('YYYY-MM')
            : val.format('YYYY-MM-DD')
          : val;
      } else if (cfg.field_type === 'multi_select' && Array.isArray(val)) {
        finalVal = val;
      }
      if (coreColumns.has(cfg.field_name)) {
        data[cfg.field_name] = finalVal;
      } else {
        extraFields[cfg.field_name] = finalVal;
      }
    }
    if (Object.keys(extraFields).length > 0) {
      data['extra_fields'] = extraFields;
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

  if (!ready) {
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
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={initialValues} style={{ maxWidth: 800 }}>
          {[...fieldConfigs].sort((a, b) => a.sort_order - b.sort_order).map((cfg) => {
            try {
              return renderField(cfg);
            } catch (e) {
              console.error(`渲染字段 ${cfg.field_name} 失败:`, e);
              return null;
            }
          })}
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
