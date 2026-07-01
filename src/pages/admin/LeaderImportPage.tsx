import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Upload, Save, X } from "lucide-react";
import { HotTable } from "@handsontable/react-wrapper";
import { registerAllModules } from "handsontable/registry";
import type Handsontable from "handsontable/base";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";
import { workReportRepository } from "@/api/services/workReport.service";
import type { LeaderImportDraft, XftConfig, XftHoursRow, XftManualHoursDraft } from "@/domain/work-report";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { getErrorMessage } from "@/utils/errors";
import { AdminHeader, SearchBox } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

registerAllModules();

const importColumns = [
  { key: "productCode", title: "产品号", width: 180 },
  { key: "partCode", title: "部件号", width: 170 },
  { key: "operationCode", title: "工序号", width: 130 },
  { key: "operationName", title: "工序名", width: 180 },
  { key: "quantity", title: "数量", width: 100 },
  { key: "estimatedHours", title: "工时", width: 100 },
] as const;
type ImportColumnKey = (typeof importColumns)[number]["key"];
type LeaderImportGridRow = Record<ImportColumnKey, string>;
type ImportCellError = { row: number; column: ImportColumnKey; message: string };
const createEmptyImportRow = (): LeaderImportGridRow => ({ productCode: "", partCode: "", operationCode: "", operationName: "", quantity: "", estimatedHours: "" });
const createImportRows = () => [
  { productCode: "CP-JSJ-240623-07", partCode: "PART-CASE-001", operationCode: "OP-080", operationName: "终检复核", quantity: "40", estimatedHours: "1.5" },
  { productCode: "CP-FL-240623-02", partCode: "PART-FLANGE-001", operationCode: "OP-040", operationName: "清洗包装", quantity: "52", estimatedHours: "2" },
  ...Array.from({ length: 18 }, createEmptyImportRow),
];
const hasImportRowValue = (row: LeaderImportGridRow) => Object.values(row).some((value) => value.trim());
const getImportDraftRows = (rows: LeaderImportGridRow[]): LeaderImportDraft[] => rows.filter(hasImportRowValue).map((row) => ({
  productCode: row.productCode.trim(),
  partCode: row.partCode.trim(),
  operationCode: row.operationCode.trim(),
  operationName: row.operationName.trim(),
  quantity: Number(row.quantity),
  estimatedHours: Number(row.estimatedHours),
}));
function validateImportGridRows(rows: LeaderImportGridRow[]) {
  const errors: ImportCellError[] = [];
  const seen = new Map<string, number>();
  rows.forEach((row, rowIndex) => {
    if (!hasImportRowValue(row)) return;
    (["productCode", "partCode", "operationCode", "operationName"] as const).forEach((column) => {
      if (!row[column].trim()) errors.push({ row: rowIndex, column, message: "必填" });
    });
    const quantity = Number(row.quantity);
    if (!row.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) errors.push({ row: rowIndex, column: "quantity", message: "请输入大于 0 的数字" });
    const estimatedHours = Number(row.estimatedHours);
    if (!row.estimatedHours.trim() || !Number.isFinite(estimatedHours) || estimatedHours <= 0) errors.push({ row: rowIndex, column: "estimatedHours", message: "请输入大于 0 的数字" });
    const key = `${row.productCode.trim()}-${row.partCode.trim()}-${row.operationCode.trim()}`;
    if (row.productCode.trim() && row.partCode.trim() && row.operationCode.trim()) {
      const firstRow = seen.get(key);
      if (firstRow !== undefined) {
        errors.push({ row: rowIndex, column: "operationCode", message: `与第 ${firstRow + 1} 行重复` });
        errors.push({ row: firstRow, column: "operationCode", message: `与第 ${rowIndex + 1} 行重复` });
      } else {
        seen.set(key, rowIndex);
      }
    }
  });
  return errors;
}
const currentSalaryPeriod = () => { const now = new Date(); return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`; };
const defaultXftConfig = (): XftConfig => ({ host: "https://api.cmbchina.com", appid: "", appSecret: "", enterpriseId: "", defaultUserId: "U0000", defaultPlatformUserId: "AUTO0001", dataCollectionName: "", importType: "ADD", salaryPeriod: currentSalaryPeriod(), workHoursFieldKey: "", isCheckEmpty: false, enabled: true });
const createManualXftRows = () => [{ staffName: "小灰16", staffNumber: "000002", hours: "8", identityNumber: "", staffId: "" }, ...Array.from({ length: 7 }, () => ({ staffName: "", staffNumber: "", hours: "", identityNumber: "", staffId: "" }))];
type ManualXftGridRow = ReturnType<typeof createManualXftRows>[number];
const hasManualXftValue = (row: ManualXftGridRow) => [row.staffName, row.staffNumber, row.hours, row.identityNumber, row.staffId].some((value) => value.trim());
const getManualXftDraftRows = (rows: ManualXftGridRow[]): XftManualHoursDraft[] => rows.filter(hasManualXftValue).map((row) => ({ staffName: row.staffName.trim(), staffNumber: row.staffNumber.trim(), hours: Number(row.hours), identityNumber: row.identityNumber.trim(), staffId: row.staffId.trim() }));

function XftConfigPanel({ onSaved }: { onSaved: (config: XftConfig) => void }) {
  const [config, setConfig] = useState<XftConfig>(defaultXftConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; workReportRepository.getXftConfig().then((data) => { if (!active) return; setConfig({ ...defaultXftConfig(), ...data, appSecret: "" }); onSaved(data); }).catch((error) => { if (active) setMessage(getErrorMessage(error)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [onSaved]);
  const update = (key: keyof XftConfig, value: string | boolean) => { setMessage(""); setConfig((current) => ({ ...current, [key]: value })); };
  const save = async () => { setSaving(true); setMessage(""); try { const saved = await workReportRepository.saveXftConfig(config); setConfig({ ...saved, appSecret: "" }); onSaved(saved); setMessage("薪福通配置已保存"); } catch (error) { setMessage(getErrorMessage(error)); } finally { setSaving(false); } };
  return <section className={cx(styles["admin-panel"], styles["xft-panel"])}><div className={cx(styles["panel-heading"])}><div><h2>薪福通配置</h2><p>{loading ? "正在读取配置" : config.hasAppSecret ? "密钥已配置，留空不会覆盖" : "请填写薪福通必填配置"}</p></div><button className={cx(styles["admin-primary-action"])} disabled={saving || loading} onClick={() => void save()}><Save />保存配置</button></div>{message && <div className={cx(styles["admin-message"])}>{message}</div>}<div className={cx(styles["xft-config-grid"])}><label className={cx(styles["admin-field"])}>接口地址<input value={config.host} onChange={(event) => update("host", event.target.value)} /></label><label className={cx(styles["admin-field"])}>应用 ID<input value={config.appid} onChange={(event) => update("appid", event.target.value)} /></label><label className={cx(styles["admin-field"])}>应用密钥<input type="password" value={config.appSecret || ""} placeholder={config.hasAppSecret ? "已保存，留空不变" : "必填"} onChange={(event) => update("appSecret", event.target.value)} /></label><label className={cx(styles["admin-field"])}>企业 ID<input value={config.enterpriseId} onChange={(event) => update("enterpriseId", event.target.value)} /></label><label className={cx(styles["admin-field"])}>采集表名称<input value={config.dataCollectionName} onChange={(event) => update("dataCollectionName", event.target.value)} /></label><label className={cx(styles["admin-field"])}>导入类型<input value={config.importType} onChange={(event) => update("importType", event.target.value)} /></label><label className={cx(styles["admin-field"])}>薪资期间<input value={config.salaryPeriod} onChange={(event) => update("salaryPeriod", event.target.value)} /></label><label className={cx(styles["admin-field"])}>工时字段<input value={config.workHoursFieldKey} onChange={(event) => update("workHoursFieldKey", event.target.value)} /></label><label className={cx(styles["admin-field"])}>调用用户<input value={config.defaultUserId} onChange={(event) => update("defaultUserId", event.target.value)} /></label><label className={cx(styles["admin-field"])}>平台用户<input value={config.defaultPlatformUserId} onChange={(event) => update("defaultPlatformUserId", event.target.value)} /></label></div><div className={cx(styles["xft-toggle-row"])}><label><input type="checkbox" checked={config.isCheckEmpty} onChange={(event) => update("isCheckEmpty", event.target.checked)} />校验空值</label><label><input type="checkbox" checked={config.enabled} onChange={(event) => update("enabled", event.target.checked)} />启用集成</label></div></section>;
}

function XftHoursImportPanel({ salaryPeriod }: { salaryPeriod: string }) {
  const [period, setPeriod] = useState(salaryPeriod || currentSalaryPeriod());
  const [preview, setPreview] = useState<XftHoursRow[]>([]);
  const [manualRows, setManualRows] = useState<ManualXftGridRow[]>(createManualXftRows);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (salaryPeriod) setPeriod(salaryPeriod); }, [salaryPeriod]);
  const previewHours = async () => { setLoading(true); setMessage(""); try { const rows = await workReportRepository.previewXftHours(period); setPreview(rows); setMessage(rows.length ? `预览到 ${rows.length} 名员工工时` : "该期间暂无可导入工时"); } catch (error) { setMessage(getErrorMessage(error)); } finally { setLoading(false); } };
  const importSummary = async () => { setLoading(true); setMessage(""); try { const result = await workReportRepository.importXftHours(period); setMessage(result.errors.length ? `薪福通返回错误：${result.errors.map((item) => `第${item.row}行 ${item.message}`).join("；")}` : `已推送 ${result.accepted} 名员工工时`); } catch (error) { setMessage(getErrorMessage(error)); } finally { setLoading(false); } };
  const updateManualRows = (changes: Handsontable.CellChange[] | null, source: Handsontable.ChangeSource) => { if (!changes || source === "loadData") return; setMessage(""); setManualRows((currentRows) => { const nextRows = currentRows.map((row) => ({ ...row })); changes.forEach(([rowIndex, prop, , nextValue]) => { if (typeof prop !== "string" || !(prop in createManualXftRows()[0])) return; while (!nextRows[rowIndex]) nextRows.push({ staffName: "", staffNumber: "", hours: "", identityNumber: "", staffId: "" }); nextRows[rowIndex] = { ...nextRows[rowIndex], [prop]: String(nextValue ?? "") }; }); return nextRows; }); };
  const manualDraftRows = useMemo(() => getManualXftDraftRows(manualRows), [manualRows]);
  const manualErrors = useMemo(() => manualRows.flatMap((row, index) => { if (!hasManualXftValue(row)) return []; const errors: string[] = []; if (!row.staffName.trim()) errors.push("姓名必填"); if (!row.staffNumber.trim()) errors.push("工号必填"); const hours = Number(row.hours); if (!row.hours.trim() || !Number.isFinite(hours) || hours <= 0) errors.push("工时需大于0"); return errors.map((message) => ({ row: index + 1, message })); }), [manualRows]);
  const importManual = async () => { setLoading(true); setMessage(""); try { const result = await workReportRepository.importManualXftHours(manualDraftRows, period); setMessage(result.errors.length ? `薪福通返回错误：${result.errors.map((item) => `第${item.row}行 ${item.message}`).join("；")}` : `已手工推送 ${result.accepted} 名员工工时`); } catch (error) { setMessage(getErrorMessage(error)); } finally { setLoading(false); } };
  return <section className={cx(styles["admin-panel"], styles["xft-panel"])}><div className={cx(styles["panel-heading"])}><div><h2>薪福通工时导入</h2><p>按期间汇总或手工填写员工工时后推送到采集表</p></div><label className={cx(styles["xft-period-input"])}>薪资期间<input value={period} onChange={(event) => setPeriod(event.target.value)} /></label></div>{message && <div className={cx(styles["admin-message"])}>{message}</div>}<div className={cx(styles["xft-import-grid"])}><section><div className={cx(styles["xft-section-head"])}><h3>按员工汇总</h3><div><button className={cx(styles["table-action"])} disabled={loading} onClick={() => void previewHours()}><RefreshCw />预览</button><button className={cx(styles["admin-primary-action"])} disabled={loading} onClick={() => void importSummary()}><Upload />推送</button></div></div><div className={cx(styles["table-wrap"], styles["compact"])}><table><thead><tr><th>姓名</th><th>工号</th><th>工时</th></tr></thead><tbody>{preview.map((row) => <tr key={`${row.staffNumber}-${row.lineId}`}><td>{row.staffName}</td><td>{row.staffNumber}</td><td>{row.hours}</td></tr>)}{!preview.length && <tr><td colSpan={3}>尚未预览</td></tr>}</tbody></table></div></section><section><div className={cx(styles["xft-section-head"])}><h3>手工导入</h3><button className={cx(styles["admin-primary-action"])} disabled={loading || !manualDraftRows.length || manualErrors.length > 0} onClick={() => void importManual()}><Upload />推送手工表</button></div>{manualErrors.length > 0 && <div className={cx(styles["admin-message"], styles["danger"])}>{manualErrors.slice(0, 3).map((item) => `第${item.row}行 ${item.message}`).join("；")}</div>}<div className={cx(styles["leader-import-sheet"], "ht-theme-main")}><HotTable data={manualRows} columns={[{ data: "staffName", width: 110 }, { data: "staffNumber", width: 120 }, { data: "hours", width: 80 }, { data: "identityNumber", width: 150 }, { data: "staffId", width: 110 }]} colHeaders={["姓名", "工号", "工时", "证件号", "员工序号"]} rowHeaders={true} height={240} width="100%" stretchH="all" minSpareRows={3} afterChange={updateManualRows} licenseKey="non-commercial-and-evaluation" /></div></section></div></section>;
}

export default function LeaderImportPage() {
  const canImportOperations = useWorkReportStore((state) => !!state.capabilities?.canImportOperations);
  const [tableRows, setTableRows] = useState<LeaderImportGridRow[]>(createImportRows);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [xftConfig, setXftConfig] = useState<XftConfig>(defaultXftConfig);
  const [searchKeyword, setSearchKeyword] = useState("");
  const rows = useMemo(() => getImportDraftRows(tableRows), [tableRows]);
  const errors = useMemo(() => validateImportGridRows(tableRows), [tableRows]);
  const errorByCell = useMemo(() => {
    const map = new Map<string, string>();
    errors.forEach((error) => map.set(`${error.row}-${error.column}`, error.message));
    return map;
  }, [errors]);

  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return tableRows;
    const keyword = searchKeyword.toLowerCase();
    return tableRows.filter((row) => 
      row.productCode.toLowerCase().includes(keyword) ||
      row.partCode.toLowerCase().includes(keyword) ||
      row.operationCode.toLowerCase().includes(keyword) ||
      row.operationName.toLowerCase().includes(keyword)
    );
  }, [tableRows, searchKeyword]);

  const updateRows = (changes: Handsontable.CellChange[] | null, source: Handsontable.ChangeSource) => {
    if (!changes || source === "loadData") return;
    setMessage("");
    setTableRows((currentRows) => {
      const nextRows = currentRows.map((row) => ({ ...row }));
      changes.forEach(([rowIndex, prop, , nextValue]) => {
        if (typeof prop !== "string" || !importColumns.some((column) => column.key === prop)) return;
        while (!nextRows[rowIndex]) nextRows.push(createEmptyImportRow());
        nextRows[rowIndex] = { ...nextRows[rowIndex], [prop]: String(nextValue ?? "") };
      });
      return nextRows;
    });
  };

  const submit = async () => {
    if (!canImportOperations) {
      setMessage("当前账号没有工序导入权限。");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const result = await workReportRepository.importLeaderOperations(rows);
      setMessage(result.errors.length ? `导入失败：${result.errors.map((item) => `第${item.row}行 ${item.message}`).join("；")}` : `已导入 ${result.accepted} 道工序，可供员工领取`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (<>
    <AdminHeader title="小组长工序导入" description="直接从 Excel 粘贴或在单元格内编辑，格式错误会标红" action={canImportOperations && <button className={cx(styles["admin-primary-action"])} disabled={submitting || !rows.length || errors.length > 0} onClick={() => void submit()}><Upload />确认导入</button>} />
    <XftConfigPanel onSaved={setXftConfig} />
    <XftHoursImportPanel salaryPeriod={xftConfig.salaryPeriod} />
    <section className={cx(styles["admin-panel"], styles["import-panel"])}>
      <div className={cx(styles["import-header"])}>
        <div className={cx(styles["import-summary"])}>
          <span>已填写 {rows.length} 行</span>
          {errors.length > 0 ? <strong className={cx(styles["danger-text"])}>{errors.length} 个单元格需修正</strong> : <strong className={cx(styles["success-text"])}>校验通过</strong>}
        </div>
        <div className={cx(styles["import-search"])}>
          <SearchBox value={searchKeyword} onChange={setSearchKeyword} placeholder="搜索产品号、部件号、工序号或工序名" />
          {searchKeyword && <button className={cx(styles["table-action"])} onClick={() => setSearchKeyword("")}><X />清除</button>}
        </div>
      </div>
      {message && <div className={cx(styles["admin-message"])}>{message}</div>}
      <div className={cx(styles["leader-import-sheet"], "ht-theme-main")}>
        <HotTable
          data={filteredRows}
          columns={importColumns.map((column) => ({ data: column.key, width: column.width }))}
          colHeaders={importColumns.map((column) => column.title)}
          rowHeaders={true}
          height={520}
          width="100%"
          stretchH="all"
          autoWrapRow={true}
          autoWrapCol={true}
          minSpareRows={6}
          manualColumnResize={true}
          contextMenu={["row_above", "row_below", "remove_row", "---------", "undo", "redo"]}
          copyPaste={true}
          comments={true}
          cells={(row, column) => {
            const key = importColumns[column]?.key;
            const error = key ? errorByCell.get(`${row}-${key}`) : undefined;
            const cellProperties: Handsontable.CellProperties = {} as Handsontable.CellProperties;
            if (error) {
              cellProperties.className = "leader-import-invalid";
              cellProperties.comment = { value: error };
            }
            return cellProperties;
          }}
          afterChange={updateRows}
          licenseKey="non-commercial-and-evaluation"
        />
      </div>
    </section>
  </>);
}
