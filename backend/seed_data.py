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
    field_configs = [
        FieldConfig(field_name="category", field_label="设备大类", field_type="select", is_required="always",
                    options=["土建类", "电器类"], sort_order=1),
        FieldConfig(field_name="equipment_type", field_label="设备类型", field_type="select", is_required="always",
                    options=["电线杆", "电缆井", "变电所", "变电站", "开关柜", "变压器", "架空线路", "断路器"],
                    parent_field_id=None, cascade_rules=[{"field": "category", "mapping": {"土建类": ["电线杆", "电缆井", "站房", "沟道"], "电器类": ["变压器", "开关柜", "架空线路", "断路器"]}}],
                    sort_order=2),
        FieldConfig(field_name="asset_code", field_label="资产编码", field_type="text", is_required="dynamic",
                    required_rules=[{"field": "category", "value": "电器类"}],
                    visibility_rules=[{"field": "category", "value": "电器类", "action": "show"}],
                    sort_order=3),
        FieldConfig(field_name="operation_date", field_label="投运日期", field_type="date", is_required="dynamic",
                    required_rules=[{"field": "category", "value": "电器类"}],
                    visibility_rules=[{"field": "category", "value": "电器类", "action": "show"}],
                    sort_order=4),
        FieldConfig(field_name="manufacturer", field_label="厂家信息", field_type="text", is_required="dynamic",
                    required_rules=[{"field": "category", "value": "电器类"}],
                    visibility_rules=[{"field": "category", "value": "电器类", "action": "show"}],
                    sort_order=5),
        FieldConfig(field_name="equipment_name", field_label="设备名称", field_type="text", is_required="always",
                    sort_order=6),
        FieldConfig(field_name="cabinet_model", field_label="柜型/型号", field_type="text", is_required="dynamic",
                    required_rules=[{"field": "equipment_type", "value": "开关柜", "operator": "contains"}],
                    visibility_rules=[{"field": "equipment_type", "value": "柜", "action": "show", "operator": "contains"}],
                    sort_order=7),
        FieldConfig(field_name="factory_number", field_label="设备出厂编号", field_type="text", is_required="dynamic",
                    required_rules=[{"field": "equipment_type", "value": "柜,变压器", "operator": "contains_any"}],
                    visibility_rules=[{"field": "equipment_type", "value": "柜,变压器", "action": "show", "operator": "contains_any"}],
                    sort_order=8),
        FieldConfig(field_name="line_name", field_label="线路名称", field_type="text", is_required="optional",
                    visibility_rules=[{"field": "equipment_type", "value": "电线杆,架空线路", "action": "show", "operator": "in"}],
                    sort_order=9),
        FieldConfig(field_name="station_name", field_label="站所名称", field_type="text", is_required="optional",
                    visibility_rules=[{"field": "equipment_type", "value": "变电所,变电站,开关柜", "action": "show", "operator": "in"}],
                    sort_order=10),
        FieldConfig(field_name="province", field_label="省", field_type="text", is_required="always", sort_order=11),
        FieldConfig(field_name="city", field_label="市", field_type="text", is_required="always", sort_order=12),
        FieldConfig(field_name="district", field_label="区", field_type="text", is_required="always", sort_order=13),
        FieldConfig(field_name="customer_name", field_label="所属客户", field_type="text", is_required="always", sort_order=14),
    ]
    db.add_all(field_configs)
    db.flush()

    # ===== 设备档案 =====
    equipment_list = [
        Equipment(category="电器类", equipment_type="变压器", asset_code="SGCC-001", equipment_name="吴中变#1主变",
                  manufacturer="特变电工", operation_date="2020-03-15",
                  province="江苏省", city="苏州市", district="吴中区", street="长桥街道",
                  address_detail="苏蠡路88号", longitude="120.632", latitude="31.262",
                  customer_name="国网苏州供电公司", remark="重点设备", created_by=1, photo_count=3),
        Equipment(category="电器类", equipment_type="开关柜", asset_code="SGCC-002", equipment_name="吴中变10kV高压柜",
                  cabinet_model="KYN28-12", factory_number="F2020001",
                  manufacturer="正泰电器", operation_date="2021-06-20",
                  province="江苏省", city="苏州市", district="吴中区", street="长桥街道",
                  address_detail="苏蠡路88号", longitude="120.632", latitude="31.262",
                  customer_name="国网苏州供电公司", created_by=1, photo_count=4),
        Equipment(category="土建类", equipment_type="电线杆", equipment_name="吴中线#001杆",
                  line_name="吴中线", province="江苏省", city="苏州市", district="吴中区", street="木渎镇",
                  address_detail="金山路100号", longitude="120.518", latitude="31.272",
                  customer_name="国网苏州供电公司", remark="老旧电杆，需重点巡视", created_by=1, photo_count=2),
        Equipment(category="土建类", equipment_type="电缆井", equipment_name="木渎站#003井",
                  station_name="木渎变电站", province="江苏省", city="苏州市", district="吴中区", street="木渎镇",
                  address_detail="竹园路200号", longitude="120.520", latitude="31.275",
                  customer_name="国网苏州供电公司", created_by=1, photo_count=2),
        Equipment(category="电器类", equipment_type="架空线路", equipment_name="木渎-胥口联络线",
                  line_name="木渎-胥口联络线", province="江苏省", city="苏州市", district="吴中区", street="胥口镇",
                  address_detail="孙武路300号", longitude="120.495", latitude="31.240",
                  customer_name="国网苏州供电公司", created_by=2, photo_count=5),
        Equipment(category="土建类", equipment_type="电线杆", equipment_name="姑苏线#005杆",
                  line_name="姑苏线", province="江苏省", city="苏州市", district="姑苏区", street="观前街道",
                  address_detail="人民路500号", longitude="120.618", latitude="31.304",
                  customer_name="国网苏州供电公司", created_by=2, photo_count=2),
    ]
    db.add_all(equipment_list)
    db.flush()

    # ===== 巡检任务 =====
    tasks = [
        InspectionTask(task_no="INSP20260616001", inspection_type=InspectionType.PERIODIC,
                       status=TaskStatus.PENDING, equipment_id=1, inspector_id=3,
                       inspection_date="2026-06-17", priority=2,
                       location_province="江苏省", location_city="苏州市", location_district="吴中区",
                       customer_name="国网苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616002", inspection_type=InspectionType.SPECIAL,
                       status=TaskStatus.PENDING, equipment_id=3, inspector_id=3,
                       inspection_date="2026-06-17", priority=1,
                       location_province="江苏省", location_city="苏州市", location_district="吴中区",
                       customer_name="国网苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616003", inspection_type=InspectionType.PERIODIC,
                       status=TaskStatus.IN_PROGRESS, equipment_id=2, inspector_id=4,
                       inspection_date="2026-06-16", priority=2,
                       location_province="江苏省", location_city="苏州市", location_district="姑苏区",
                       customer_name="国网苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616004", inspection_type=InspectionType.PERIODIC,
                       status=TaskStatus.SUBMITTED, equipment_id=4, inspector_id=3,
                       inspection_date="2026-06-15", priority=3,
                       location_province="江苏省", location_city="苏州市", location_district="吴中区",
                       customer_name="国网苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616005", inspection_type=InspectionType.FULL_LINE,
                       status=TaskStatus.COMPLETED, equipment_id=5, inspector_id=4, reviewer_id=2,
                       inspection_date="2026-06-10", priority=2,
                       location_province="江苏省", location_city="苏州市", location_district="吴中区",
                       customer_name="国网苏州供电公司", created_by=2),
        InspectionTask(task_no="INSP20260616006", inspection_type=InspectionType.PERIODIC,
                       status=TaskStatus.SUSPENDED, equipment_id=6, inspector_id=4,
                       inspection_date="2026-06-16", priority=2,
                       location_province="江苏省", location_city="苏州市", location_district="姑苏区",
                       customer_name="国网苏州供电公司", suspend_reason="暴雨天气，暂停巡检", created_by=2),
    ]
    db.add_all(tasks)

    db.commit()
    db.close()
    print("✅ 种子数据初始化完成！")


if __name__ == "__main__":
    init_db()
