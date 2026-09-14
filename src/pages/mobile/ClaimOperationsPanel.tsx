import { Button, NumericInput, DateInput, EmptyState, Pagination, RovingTabList, RovingTabPanel, SegmentedControl, TextInput } from "@jc-times/business-ui";
import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Search, X } from "lucide-react";
import type { PaginatedResult } from "@/api/services/workReport.repository";
import type { ClaimableOperation, ClaimablePart, ClaimableProduct } from "@/domain/work-report";
import {
  claimOperationFilterOptions, claimRecentStatusOptions, claimSearchPageSize, combineDateTimeLocal, cx,
  formatProductPartCode, isSameLocalDay, splitDateTimeLocal,
  type ClaimOperationFilter, type ClaimPanelView, type ClaimRecentDateFilter,
} from "./mobileUtils";
import sharedStyles from "./mobileShared.module.less";
import pageStyles from "./ClaimOperationsPage.module.less";

const styles = { ...pageStyles, ...sharedStyles };

export function ClaimOperationsPanel({
  loading, products, productPagination, parts, operations, recentOperations = [], claimed, startTime, endTime, timesLoading, onSearch, onLoadRecent, onLoadParts, onLoadOperations, onClaim, onConfirmClaim, onCancelClaim,
}: {
  loading: boolean;
  products: ClaimableProduct[];
  productPagination: PaginatedResult<ClaimableProduct>;
  parts: ClaimablePart[];
  operations: ClaimableOperation[];
  recentOperations?: ClaimableOperation[];
  claimed: ClaimableOperation | null;
  startTime: string;
  endTime: string;
  timesLoading: boolean;
  onSearch: (keyword: string, page?: number, pageSize?: number) => Promise<void>;
  onLoadRecent?: () => Promise<void>;
  onLoadParts: (productId: string) => Promise<void>;
  onLoadOperations: (partId: string) => Promise<void>;
  onClaim: (operationId: string) => void;
  onConfirmClaim: (startTime: string, endTime: string, quantity: number) => void;
  onCancelClaim: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ClaimableProduct | null>(null);
  const [selectedPart, setSelectedPart] = useState<ClaimablePart | null>(null);
  const [dismissedAutoProductId, setDismissedAutoProductId] = useState<string | null>(null);
  const [dismissedAutoPartId, setDismissedAutoPartId] = useState<string | null>(null);
  const [view, setView] = useState<ClaimPanelView>("search");
  const [filter, setFilter] = useState<ClaimOperationFilter>("all");
  const [searchPage, setSearchPage] = useState(1);
  const [recentDate, setRecentDate] = useState<ClaimRecentDateFilter>("all");
  const [recentStatus, setRecentStatus] = useState<Exclude<ClaimOperationFilter, "claimed">>("available");
  const initialStart = splitDateTimeLocal(startTime);
  const initialEnd = splitDateTimeLocal(endTime);
  const [localStartDate, setLocalStartDate] = useState(initialStart.date);
  const [localStartClock, setLocalStartClock] = useState(initialStart.time);
  const [localEndDate, setLocalEndDate] = useState(initialEnd.date);
  const [localEndClock, setLocalEndClock] = useState(initialEnd.time);
  const [reportQuantity, setReportQuantity] = useState("");
  const localStartTime = combineDateTimeLocal(localStartDate, localStartClock);
  const localEndTime = combineDateTimeLocal(localEndDate, localEndClock);
  const timeInvalid = Boolean(localStartTime && localEndTime && new Date(localStartTime).getTime() > new Date(localEndTime).getTime());
  const quantityValue = Number(reportQuantity);
  const quantityInvalid = !reportQuantity.trim() || !Number.isInteger(quantityValue) || quantityValue < 1;
  const canConfirmClaim = !loading && !timesLoading && !!localStartTime && !!localEndTime && !timeInvalid && !quantityInvalid;
  const filteredSearchOperations = operations.filter((item) => filter === "all" ? true : item.status === filter);
  const searchPageCount = Math.max(1, Math.ceil(filteredSearchOperations.length / claimSearchPageSize));
  const visibleSearchOperations = filteredSearchOperations.slice((searchPage - 1) * claimSearchPageSize, searchPage * claimSearchPageSize);
  const filteredRecentOperations = recentOperations.filter((item) => {
    const matchesDate = recentDate === "all" ? true : isSameLocalDay(item.plannedStart);
    const matchesStatus = recentStatus === "all" ? true : item.status === "available";
    return matchesDate && matchesStatus;
  });

  useEffect(() => {
    const nextStart = splitDateTimeLocal(startTime);
    const nextEnd = splitDateTimeLocal(endTime);
    setLocalStartDate(nextStart.date);
    setLocalStartClock(nextStart.time);
    setLocalEndDate(nextEnd.date);
    setLocalEndClock(nextEnd.time);
  }, [startTime, endTime]);

  useEffect(() => {
    setReportQuantity(claimed?.plannedQuantity != null ? String(claimed.plannedQuantity) : "");
  }, [claimed?.id, claimed?.plannedQuantity]);

  const search = async () => {
    setSelectedProduct(null);
    setSelectedPart(null);
    setDismissedAutoProductId(null);
    setDismissedAutoPartId(null);
    setSearchPage(1);
    await onSearch(keyword, 1, productPagination.pageSize);
  };
  const loadProductPage = async (page: number) => {
    setSelectedProduct(null);
    setSelectedPart(null);
    setDismissedAutoProductId(null);
    setDismissedAutoPartId(null);
    setSearchPage(1);
    await onSearch(keyword, page, productPagination.pageSize);
  };
  useEffect(() => { setSearchPage(1); }, [filter, selectedPart?.id]);
  useEffect(() => {
    if (searchPage > searchPageCount) setSearchPage(searchPageCount);
  }, [searchPage, searchPageCount]);
  useEffect(() => {
    if (view !== "search" || selectedProduct || productPagination.total !== 1 || products.length !== 1) return;
    const [product] = products;
    if (!product || dismissedAutoProductId === product.id) return;

    setSelectedProduct(product);
    setSelectedPart(null);
    setDismissedAutoPartId(null);
    void onLoadParts(product.id);
  }, [dismissedAutoProductId, onLoadParts, productPagination.total, products, selectedProduct, view]);
  useEffect(() => {
    if (view !== "search" || !selectedProduct || selectedPart || parts.length !== 1) return;
    const [part] = parts;
    if (!part || dismissedAutoPartId === part.id) return;

    setSelectedPart(part);
    setSearchPage(1);
    void onLoadOperations(part.id);
  }, [dismissedAutoPartId, onLoadOperations, parts, selectedPart, selectedProduct, view]);
  const loadRecent = async () => { await onLoadRecent?.(); };
  const renderOperation = (item: ClaimableOperation) => {
    const noPermission = item.hasPermission === false;
    const disabled = loading || item.status !== "available" || noPermission;
    return <article key={item.id} className={cx(item.status !== "available" ? styles.disabled : undefined, noPermission && styles["no-permission"])}><div><strong>{item.operationName}</strong>{noPermission ? <span className={styles["claim-status-no-permission"]}>无权限</span> : <span className={styles[`claim-status-${item.status}`]}>{item.status === "available" ? "可领取" : item.status === "claimed" ? "已满" : "已关闭"}</span>}</div><p>{formatProductPartCode(item.productCode, item.partCode)} · 部件号: {item.partNo || "-"} · 工序号: {item.operationNo || "-"}</p><p>{item.operationNote}</p><dl><div><dt>数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>工时</dt><dd>{item.estimatedHours} 小时</dd></div><div><dt>已领</dt><dd>{item.maxClaimWorkers ? `${item.claimedWorkers}/${item.maxClaimWorkers} 人` : `${item.claimedWorkers} 人`}</dd></div></dl>{noPermission ? <p className={styles["no-permission-hint"]}>您的班组未分配该工序</p> : <Button variant="primary" className={styles["primary-button"]} disabled={disabled} onClick={() => void onClaim(item.id)}>{item.status === "claimed" ? "人数已满" : item.status === "closed" ? "已关闭" : "领取工序"}</Button>}</article>;
  };

  if (claimed) return <section className={styles["claim-success"]}><h2>工序确认</h2><p>{formatProductPartCode(claimed.productCode, claimed.partCode)}</p><p>部件号: {claimed.partNo || "-"} · 工序号: {claimed.operationNo || "-"}</p><strong>{claimed.operationName}</strong><div className={styles["time-input-form"]}><div className={styles["time-input-section"]}><span className={styles["field-label"]}>开工时间</span><div className={styles["time-picker-row"]}><label><span>日期</span><DateInput  value={localStartDate} onValueChange={(value) => setLocalStartDate(value)} disabled={timesLoading} inputClassName={styles["time-input"]} /></label><label><span>时间</span><TextInput type="time" step={300} value={localStartClock} onChange={(e) => setLocalStartClock(e.target.value)} disabled={timesLoading} className={styles["time-input"]} /></label></div></div><div className={styles["time-input-section"]}><span className={styles["field-label"]}>完工时间</span><div className={styles["time-picker-row"]}><label><span>日期</span><DateInput  value={localEndDate} onValueChange={(value) => setLocalEndDate(value)} disabled={timesLoading} inputClassName={styles["time-input"]} /></label><label><span>时间</span><TextInput type="time" step={300} value={localEndClock} onChange={(e) => setLocalEndClock(e.target.value)} disabled={timesLoading} className={styles["time-input"]} /></label></div></div><div className={styles["time-input-section"]}><NumericInput label="报工数量（件）" min="1" step="1" useGrouping={false} value={reportQuantity} onDraftChange={setReportQuantity} onValueCommit={setReportQuantity} className={styles["time-input"]} /></div></div>{timesLoading && <p className={styles["validation-hint"]}>正在读取开完工时间...</p>}{!timesLoading && (!localStartTime || !localEndTime) && <p className={styles["validation-hint"]}>请填写开工时间和完工时间</p>}{timeInvalid && <p className={styles["validation-hint"]}>开工时间不能晚于完工时间</p>}{!timesLoading && quantityInvalid && <p className={styles["validation-hint"]}>报工数量必须为不小于 1 的整数</p>}<div className={styles["claim-actions"]}><Button variant="ghost" className={styles["ghost-button"]} onClick={onCancelClaim}><X />取消</Button><Button variant="primary" className={styles["primary-button"]} disabled={!canConfirmClaim} onClick={() => { if (canConfirmClaim) onConfirmClaim(localStartTime, localEndTime, quantityValue); }}><CheckCircle2 />确认领取</Button></div></section>;

  return <section className={styles["claim-panel"]}>
    <RovingTabList<ClaimPanelView> groupId="claim-view" label="领取工序视图切换" value={view} onChange={setView} options={[{value: "search", label: "搜索领取"}, {value: "recent", label: "查看最近"}]} />
    {loading && <div className={styles["claim-loading"]}><span className="spinner" />正在读取...</div>}
    {view === "search" && <RovingTabPanel groupId="claim-view" value="search"><section className={cx(styles["claim-workspace"], styles["claim-search-workspace"])} aria-label="搜索结果">
      <div className={styles["section-heading"]}><div><h2>搜索结果</h2><p>按产品、部件、工序逐级选择。</p></div></div>
      <label className={styles["claim-search"]}><Search /><TextInput value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入产品编号或工单号搜索" /><Button variant="ghost" disabled={loading || !keyword.trim()} onClick={() => void search()}>搜索</Button></label>
      <SegmentedControl<ClaimOperationFilter> aria-label="领取状态筛选" value={filter} onChange={(value) => { setFilter(value); setSearchPage(1); }} options={claimOperationFilterOptions.map(([value, label]) => ({ value, label }))} variant="soft" />
      <div className={styles["claim-columns"]}>
        <div><div className={styles["claim-list-title"]}><h3>1 产品编号</h3>{!selectedProduct && productPagination.total > 0 && <span>共 {productPagination.total} 个</span>}</div>{selectedProduct ? <Button variant="ghost" key={selectedProduct.id} className={styles.selected} onClick={() => { setDismissedAutoProductId(selectedProduct.id); setSelectedProduct(null); setSelectedPart(null); setSearchPage(1); }}><strong>{selectedProduct.productCode}</strong><span>{selectedProduct.productName}</span><small>{selectedProduct.orderNo} · 剩余 {selectedProduct.remainingQuantity} 件</small><span className={styles["cancel-select"]}>点击取消选择</span></Button> : products.map((item) => { const noPerm = item.hasPermission === false; return <Button variant="ghost" key={item.id} className={noPerm ? styles["no-permission"] : undefined} disabled={noPerm} onClick={() => { if (noPerm) return; setSelectedProduct(item); setSelectedPart(null); setSearchPage(1); setDismissedAutoPartId(null); void onLoadParts(item.id); }}><strong>{item.productCode}</strong><span>{item.productName}</span>{noPerm ? <small className={styles["no-permission-hint"]}>无权限</small> : <small>{item.orderNo} · 剩余 {item.remainingQuantity} 件</small>}</Button>; })}{!selectedProduct && productPagination.total > productPagination.pageSize && <fieldset className="work-report-pagination" aria-label="产品搜索分页" disabled={loading}><Pagination compact totalItems={productPagination.total} page={productPagination.page} pageSize={productPagination.pageSize} onPageChange={(page) => void loadProductPage(page)} /></fieldset>}</div>
        <div><h3>2 部件编号</h3>{selectedPart ? <Button variant="ghost" key={selectedPart.id} className={styles.selected} onClick={() => { setDismissedAutoPartId(selectedPart.id); setSelectedPart(null); setSearchPage(1); }}><strong>{selectedPart.partCode}</strong><span>{selectedPart.partNo && `[${selectedPart.partNo}] `}{selectedPart.partName}</span><small>{selectedPart.operationCount} 道工序 · 剩余 {selectedPart.remainingQuantity} 件</small><span className={styles["cancel-select"]}>点击取消选择</span></Button> : parts.map((item) => { const noPerm = item.hasPermission === false; return <Button variant="ghost" key={item.id} className={noPerm ? styles["no-permission"] : undefined} disabled={noPerm} onClick={() => { if (noPerm) return; setSelectedPart(item); setSearchPage(1); void onLoadOperations(item.id); }}><strong>{item.partCode}</strong><span>{item.partNo && `[${item.partNo}] `}{item.partName}</span>{noPerm ? <small className={styles["no-permission-hint"]}>无权限</small> : <small>{item.operationCount} 道工序 · 剩余 {item.remainingQuantity} 件</small>}</Button>; })}</div>
      </div>
      <div className={styles["claim-operation-list"]} aria-label="搜索工序结果"><div className={styles["claim-list-title"]}><h3>3 工序</h3>{selectedPart && filteredSearchOperations.length > 0 && <span>共 {filteredSearchOperations.length} 道</span>}</div>{selectedPart ? visibleSearchOperations.map(renderOperation) : <EmptyState className={styles["empty-inline"]} compact title={<>请先搜索并选择部件查看工序。</>} />}{selectedPart && !filteredSearchOperations.length && <EmptyState className={styles["empty-inline"]} compact title={<>当前筛选下暂无工序</>} />}{selectedPart && filteredSearchOperations.length > claimSearchPageSize && <fieldset className="work-report-pagination" aria-label="工序搜索分页" disabled={loading}><Pagination compact totalItems={filteredSearchOperations.length} page={searchPage} pageSize={claimSearchPageSize} onPageChange={setSearchPage} /></fieldset>}</div>
    </section></RovingTabPanel>}
    {view === "recent" && <RovingTabPanel groupId="claim-view" value="recent"><section className={cx(styles["claim-workspace"], styles["claim-recent-workspace"])} aria-label="最近可以领取的工序">
      <div className={styles["section-heading"]}><div><h2>最近可以领取的工序</h2><p>不影响上方搜索结果。</p></div><Button variant="ghost" className={styles["ghost-button"]} disabled={loading} onClick={() => void loadRecent()}><RefreshCw />刷新</Button></div>
      <div className={styles["claim-filter-row"]}><SegmentedControl<ClaimRecentDateFilter> aria-label="最近工序日期筛选" value={recentDate} onChange={setRecentDate} options={[{value: "today", label: "当日"}, {value: "all", label: "全部"}]} variant="soft" /><SegmentedControl<Exclude<ClaimOperationFilter, "claimed">> aria-label="最近工序状态筛选" value={recentStatus} onChange={setRecentStatus} options={claimRecentStatusOptions.map(([value, label]) => ({ value, label }))} variant="soft" /></div>
      <div className={styles["recent-operation-list"]}>{filteredRecentOperations.map(renderOperation)}</div>
      {!filteredRecentOperations.length && <EmptyState className={styles["empty-inline"]} compact title={<>暂无最近工序，可点击刷新或搜索产品编号查看。</>} />}
    </section></RovingTabPanel>}
  </section>;
}
