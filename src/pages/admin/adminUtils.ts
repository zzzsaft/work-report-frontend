import type { PermissionGroup } from "@/domain/work-report";

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export const permissionOptions: Array<{ value: PermissionGroup; label: string; description: string }> = [
  { value: "worker", label: "普通员工", description: "移动端领取、报工和查看个人统计" },
  { value: "leader", label: "小组长", description: "可导入工序并查看小组任务" },
  { value: "admin", label: "管理员", description: "可进入后台并管理分配、异常和权限" },
];
