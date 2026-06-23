from database import SessionLocal, engine, Base
from models.user import User, UserRole
from models.equipment import FieldConfig, Equipment, EquipmentPhoto
from models.inspection_task import InspectionTask, InspectionType, TaskStatus, InspectionStrategy
from models.defect_order import DefectOrder, DefectOrderStatus
from services.auth_service import hash_password
from datetime import datetime


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 检查是否已初始化
    if db.query(User).count() > 0:
        db.close()
        return

    # ===== 用户 =====
    users = [
        User(username="admin", password=hash_password("admin123"), real_name="系统管理员", role=UserRole.ADMIN, phone="13800000001", department="技术部", region="苏州市"),
        User(username="wangwei", password=hash_password("123456"), real_name="王伟", role=UserRole.MANAGER, phone="13800000002", department="运维部", region="吴中区"),
        User(username="zhangming", password=hash_password("123456"), real_name="张明", role=UserRole.INSPECTOR, phone="13800000003", department="巡检一班", region="吴中区"),
        User(username="lixin", password=hash_password("123456"), real_name="李新", role=UserRole.INSPECTOR, phone="13800000004", department="巡检二班", region="姑苏区"),
        User(username="zhaoqiang", password=hash_password("123456"), real_name="赵强", role=UserRole.REPAIRER, phone="13800000005", department="检修一班", region="吴中区"),
    ]
    db.add_all(users)
    db.flush()

    # ===== 字段配置 =====
    # 选项统一用 dict 格式: {"label": "显示名", "value": "值", "active": true}
    field_configs = [
        # 1. 设备大类 - 单选下拉框
        FieldConfig(field_name="category", field_label="设备大类", field_type="select", is_required="always",
                    options=[
                        {"label": "土建类", "value": "土建类", "active": True},
                        {"label": "电器类", "value": "电器类", "active": True},
                    ], sort_order=1),
        # 2. 设备类型 - 单选下拉框 + 级联联动
        FieldConfig(field_name="equipment_type", field_label="设备类型", field_type="select", is_required="always",
                    options=[
                        {"label": "电线杆", "value": "电线杆", "active": True},
                        {"label": "电缆井", "value": "电缆井", "active": True},
                        {"label": "站房", "value": "站房", "active": True},
                        {"label": "沟道", "value": "沟道", "active": True},
                        {"label": "变压器", "value": "变压器", "active": True},
                        {"label": "开关柜", "value": "开关柜", "active": True},
                        {"label": "架空线路", "value": "架空线路", "active": True},
                        {"label": "断路器", "value": "断路器", "active": True},
                    ],
                    cascade_rules=[{"field": "category", "mapping": {
                        "土建类": ["电线杆", "电缆井", "站房", "沟道"],
                        "电器类": ["变压器", "开关柜", "架空线路", "断路器"],
                    }}],
                    sort_order=2),
        # 3. 设备名称 - 文本输入 + 最大字符限制
        FieldConfig(field_name="equipment_name", field_label="设备名称", field_type="text", is_required="always",
                    max_length=100, sort_order=3),
        # 4. 资产编码 - 文本输入 + 正则校验 (动态必填)
        FieldConfig(field_name="asset_code", field_label="资产编码", field_type="text", is_required="dynamic",
                    max_length=50, regex_pattern=r"^[A-Z]+-[\d]+$",
                    regex_hint="格式: 大写字母-数字, 如 SGCC-001",
                    required_rules=[{"field": "category", "value": "电器类"}],
                    visibility_rules=[{"field": "category", "value": "电器类", "action": "show"}],
                    sort_order=4),
        # 5. 投运日期 - 日期选择 (年月日) + 默认当天
        FieldConfig(field_name="operation_date", field_label="投运日期", field_type="date", is_required="dynamic",
                    date_format="date", default_value="today",
                    required_rules=[{"field": "category", "value": "电器类"}],
                    visibility_rules=[{"field": "category", "value": "电器类", "action": "show"}],
                    sort_order=5),
        # 6. 厂家信息 - 文本输入
        FieldConfig(field_name="manufacturer", field_label="厂家信息", field_type="text", is_required="dynamic",
                    max_length=100,
                    required_rules=[{"field": "category", "value": "电器类"}],
                    visibility_rules=[{"field": "category", "value": "电器类", "action": "show"}],
                    sort_order=6),
        # 7. 设备型号 - 文本输入
        FieldConfig(field_name="cabinet_model", field_label="柜型/型号", field_type="text", is_required="dynamic",
                    max_length=100,
                    required_rules=[{"field": "equipment_type", "value": "开关柜", "operator": "contains"}],
                    visibility_rules=[{"field": "equipment_type", "value": "柜", "action": "show", "operator": "contains"}],
                    sort_order=7),
        # 8. 出厂编号 - 文本输入
        FieldConfig(field_name="factory_number", field_label="设备出厂编号", field_type="text", is_required="dynamic",
                    regex_pattern=r"^[A-Z]\d{6,}$", regex_hint="大写字母开头+6位以上数字，如 F2020001",
                    required_rules=[{"field": "equipment_type", "value": "柜,变压器", "operator": "contains_any"}],
                    visibility_rules=[{"field": "equipment_type", "value": "柜,变压器", "action": "show", "operator": "contains_any"}],
                    sort_order=8),
        # 9. 线路名称 - 文本输入
        FieldConfig(field_name="line_name", field_label="线路名称", field_type="text", is_required="optional",
                    max_length=100,
                    visibility_rules=[{"field": "equipment_type", "value": "电线杆,架空线路", "action": "show", "operator": "in"}],
                    sort_order=9),
        # 10. 站所名称 - 文本输入
        FieldConfig(field_name="station_name", field_label="站所名称", field_type="text", is_required="optional",
                    max_length=100,
                    visibility_rules=[{"field": "equipment_type", "value": "站房,开关柜", "action": "show", "operator": "in"}],
                    sort_order=10),
        # 11. 省 - 文本输入 (地址-级联)
        FieldConfig(field_name="province", field_label="省", field_type="text", is_required="always",
                    max_length=50, sort_order=11),
        # 12. 市 - 文本输入
        FieldConfig(field_name="city", field_label="市", field_type="text", is_required="always",
                    max_length=50, sort_order=12),
        # 13. 区 - 文本输入
        FieldConfig(field_name="district", field_label="区", field_type="text", is_required="always",
                    max_length=50, sort_order=13),
        # 14. 街道 - 文本输入
        FieldConfig(field_name="street", field_label="街道", field_type="text", is_required="always",
                    max_length=100, sort_order=14),
        # 15. 详细地址 - 文本输入
        FieldConfig(field_name="address_detail", field_label="详细地址", field_type="text", is_required="always",
                    max_length=255, sort_order=15),
        # 16. 经度 - GPS定位
        FieldConfig(field_name="longitude", field_label="经度", field_type="number", is_required="always",
                    min_value=73, max_value=135, decimal_places=6, sort_order=16),
        # 17. 纬度 - GPS定位
        FieldConfig(field_name="latitude", field_label="纬度", field_type="number", is_required="always",
                    min_value=17, max_value=54, decimal_places=6, sort_order=17),
        # 18. 所属客户 - 文本输入
        FieldConfig(field_name="customer_name", field_label="所属客户", field_type="text", is_required="always",
                    max_length=100, sort_order=18),
        # 19. 现场照片 - 图片集 (需求文档: 土建类需全景+杆号/标识, 电器类需全景+铭牌+仪表读数)
        FieldConfig(field_name="site_photos", field_label="现场照片", field_type="image", is_required="always",
                    sort_order=19),
        # 20. 备注 - 多行文本 (最大500字符)
        FieldConfig(field_name="remark", field_label="备注", field_type="text", is_required="optional",
                    max_length=500, sort_order=20),
        # === 扩展字段 (非需求文档核心字段) ===
        # 21. 电压等级 - 数值输入
        FieldConfig(field_name="voltage_level", field_label="电压等级(kV)", field_type="number", is_required="optional",
                    min_value=0.1, max_value=1000, decimal_places=2,
                    visibility_rules=[{"field": "equipment_type", "value": "变压器,开关柜,架空线路,断路器", "action": "show", "operator": "in"}],
                    sort_order=21),
        # 22. 杆塔高度 - 数值输入
        FieldConfig(field_name="tower_height", field_label="杆塔高度(m)", field_type="number", is_required="optional",
                    min_value=0, max_value=200, decimal_places=1,
                    visibility_rules=[{"field": "equipment_type", "value": "电线杆,架空线路", "action": "show", "operator": "in"}],
                    sort_order=22),
        # 23. 缺陷等级 - 多选下拉框
        FieldConfig(field_name="defect_level", field_label="缺陷等级", field_type="multi_select", is_required="optional",
                    options=[
                        {"label": "一级", "value": "一级", "active": True},
                        {"label": "二级", "value": "二级", "active": True},
                        {"label": "三级", "value": "三级", "active": True},
                        {"label": "四级", "value": "四级", "active": True},
                    ], sort_order=23),
        # 24. 竣工日期 - 日期选择 (仅年月)
        FieldConfig(field_name="completion_date", field_label="竣工日期", field_type="date", is_required="optional",
                    date_format="month", sort_order=24),
        # 25. 联系人手机 - 文本输入 + 正则校验
        FieldConfig(field_name="contact_phone", field_label="联系人手机", field_type="text", is_required="optional",
                    regex_pattern=r"^1[3-9]\d{9}$", regex_hint="请输入正确的11位手机号",
                    max_length=11, sort_order=25),
    ]
    db.add_all(field_configs)
    db.flush()

    # ===== 设备档案 =====
    equipment_list = [
        Equipment(category="电器类", equipment_type="变压器", asset_code="SGCC-001", equipment_name="吴中变#1主变",
                  manufacturer="特变电工", operation_date="2020-03-15",
                  province="江苏省", city="苏州市", district="吴中区", street="长桥街道",
                  address_detail="苏蠡路88号", longitude="120.632", latitude="31.262",
                  customer_name="苏州供电公司", remark="重点设备", created_by=1, photo_count=3),
        Equipment(category="电器类", equipment_type="开关柜", asset_code="SGCC-002", equipment_name="吴中变10kV高压柜",
                  cabinet_model="KYN28-12", factory_number="F2020001",
                  manufacturer="正泰电器", operation_date="2021-06-20",
                  province="江苏省", city="苏州市", district="吴中区", street="长桥街道",
                  address_detail="苏蠡路88号", longitude="120.632", latitude="31.262",
                  customer_name="苏州供电公司", created_by=1, photo_count=4),
        Equipment(category="土建类", equipment_type="电线杆", equipment_name="吴中线#001杆",
                  line_name="吴中线", province="江苏省", city="苏州市", district="吴中区", street="木渎镇",
                  address_detail="金山路100号", longitude="120.518", latitude="31.272",
                  customer_name="苏州供电公司", remark="老旧电杆，需重点巡视", created_by=1, photo_count=2),
        Equipment(category="土建类", equipment_type="电缆井", equipment_name="木渎站#003井",
                  station_name="木渎变电站", province="江苏省", city="苏州市", district="吴中区", street="木渎镇",
                  address_detail="竹园路200号", longitude="120.520", latitude="31.275",
                  customer_name="苏州供电公司", created_by=1, photo_count=2),
        Equipment(category="电器类", equipment_type="架空线路", equipment_name="木渎-胥口联络线",
                  line_name="木渎-胥口联络线", province="江苏省", city="苏州市", district="吴中区", street="胥口镇",
                  address_detail="孙武路300号", longitude="120.495", latitude="31.240",
                  customer_name="苏州供电公司", created_by=2, photo_count=5),
        Equipment(category="土建类", equipment_type="电线杆", equipment_name="姑苏线#005杆",
                  line_name="姑苏线", province="江苏省", city="苏州市", district="姑苏区", street="观前街道",
                  address_detail="人民路500号", longitude="120.618", latitude="31.304",
                  customer_name="苏州供电公司", created_by=2, photo_count=2),
        Equipment(category="电器类", equipment_type="断路器", asset_code="SGCC-003", equipment_name="胥口变#1断路器",
                  manufacturer="ABB电气", operation_date="2022-01-10",
                  province="江苏省", city="苏州市", district="吴中区", street="胥口镇",
                  address_detail="孙武路300号", longitude="120.495", latitude="31.241",
                  customer_name="苏州供电公司", created_by=1, photo_count=3),
        Equipment(category="土建类", equipment_type="站房", equipment_name="木渎站10kV配电房",
                  station_name="木渎变电站", province="江苏省", city="苏州市", district="吴中区", street="木渎镇",
                  address_detail="竹园路201号", longitude="120.521", latitude="31.274",
                  customer_name="苏州供电公司", created_by=1, photo_count=4),
        Equipment(category="土建类", equipment_type="沟道", equipment_name="胥口线#001沟道",
                  province="江苏省", city="苏州市", district="吴中区", street="胥口镇",
                  address_detail="环城路50号", longitude="120.493", latitude="31.238",
                  customer_name="苏州供电公司", remark="需定期清理", created_by=2, photo_count=2),
        Equipment(category="电器类", equipment_type="变压器", asset_code="SGCC-004", equipment_name="姑苏变#2主变",
                  manufacturer="特变电工", operation_date="2019-08-25",
                  province="江苏省", city="苏州市", district="姑苏区", street="观前街道",
                  address_detail="人民路501号", longitude="120.619", latitude="31.303",
                  customer_name="苏州供电公司", remark="重点设备", created_by=1, photo_count=3),
    ]
    db.add_all(equipment_list)
    db.flush()

    # ===== 巡检任务 =====
    tasks = [
        InspectionTask(task_no="INSP20260616001", inspection_type=InspectionType.PERIODIC,
                       status=TaskStatus.PENDING, equipment_id=1, inspector_id=3,
                       inspection_date="2026-06-17", priority=2,
                       location_province="江苏省", location_city="苏州市", location_district="吴中区",
                       customer_name="苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616002", inspection_type=InspectionType.SPECIAL,
                       status=TaskStatus.PENDING, equipment_id=3, inspector_id=3,
                       inspection_date="2026-06-17", priority=1,
                       location_province="江苏省", location_city="苏州市", location_district="吴中区",
                       customer_name="苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616003", inspection_type=InspectionType.PERIODIC,
                       status=TaskStatus.IN_PROGRESS, equipment_id=2, inspector_id=4,
                       inspection_date="2026-06-16", priority=2,
                       location_province="江苏省", location_city="苏州市", location_district="姑苏区",
                       customer_name="苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616004", inspection_type=InspectionType.PERIODIC,
                       status=TaskStatus.SUBMITTED, equipment_id=4, inspector_id=3,
                       inspection_date="2026-06-15", priority=3,
                       location_province="江苏省", location_city="苏州市", location_district="吴中区",
                       customer_name="苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616005", inspection_type=InspectionType.FULL_LINE,
                       status=TaskStatus.COMPLETED, equipment_id=5, inspector_id=4, reviewer_id=2,
                       inspection_date="2026-06-10", priority=2,
                       location_province="江苏省", location_city="苏州市", location_district="吴中区",
                       customer_name="苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616006", inspection_type=InspectionType.PERIODIC,
                       status=TaskStatus.SUSPENDED, equipment_id=6, inspector_id=4,
                       inspection_date="2026-06-16", priority=2,
                       location_province="江苏省", location_city="苏州市", location_district="姑苏区",
                       customer_name="苏州供电公司", suspend_reason="暴雨天气，暂停巡检", created_by=2),
    ]
    db.add_all(tasks)

    db.commit()
    db.close()
    print("✅ 种子数据初始化完成！")


if __name__ == "__main__":
    init_db()
