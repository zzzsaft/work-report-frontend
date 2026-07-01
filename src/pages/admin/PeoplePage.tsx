import { CheckCircle2 } from "lucide-react";
import { AdminHeader } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

export default function PeoplePage() {
  const people = [{ name: "张师傅", group: "生产一组", hours: 8.6, overtime: .6, operations: 3 }, { name: "王师傅", group: "生产一组", hours: 8.2, overtime: .2, operations: 4 }, { name: "李师傅", group: "生产二组", hours: 7.8, overtime: 0, operations: 3 }, { name: "赵师傅", group: "生产二组", hours: 9.1, overtime: 1.1, operations: 5 }];
  return <><AdminHeader title="人员统计" description="查看每日工时、出勤与加班情况" /><section className={cx(styles["admin-panel"])}><div className={cx(styles["table-wrap"])}><table><thead><tr><th>生产人员</th><th>班组</th><th>今日工时</th><th>加班</th><th>完成工序</th><th>出勤状态</th></tr></thead><tbody>{people.map((item) => <tr key={item.name}><td><div className={cx(styles["person-cell"])}><span>{item.name.slice(0,1)}</span><strong>{item.name}</strong></div></td><td>{item.group}</td><td>{item.hours} 小时</td><td>{item.overtime} 小时</td><td>{item.operations} 道</td><td><span className={cx(styles["attendance-normal"])}><CheckCircle2 />正常</span></td></tr>)}</tbody></table></div></section></>;
}
