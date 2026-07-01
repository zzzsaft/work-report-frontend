import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { statusLabel } from "@/domain/work-report";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

export function AdminHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <header className={cx(styles["admin-page-header"])}><div><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
export function LoadingTable() { return <div className={styles["admin-loading"]}><span className="spinner" />正在读取生产数据...</div>; }
export function AdminError({ message, retry }: { message: string; retry: () => void }) { return <div className={cx(styles["admin-loading"])}><span>{message}</span><button className={cx(styles["table-action"])} onClick={retry}>重试</button></div>; }
export function AdminStatus({ status }: { status: string }) { return <span className={cx(styles["admin-status"], styles[status])}>{statusLabel[status as keyof typeof statusLabel] || ({ in_progress: "生产中", completed: "已完成", pending: "待生产", exception: "异常", available: "可分配", claimed: "已满", closed: "已关闭" }[status] || status)}</span>; }
export function SearchBox({ value, onChange, placeholder = "搜索工单、产品或人员" }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className={cx(styles["search-box"])}><Search /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>; }
