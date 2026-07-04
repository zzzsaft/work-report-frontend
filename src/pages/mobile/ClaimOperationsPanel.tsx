import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Search, X } from "lucide-react";
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
  onConfirmClaim: (startTime: string, endTime: string) => void;
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
  const localStartTime = combineDateTimeLocal(localStartDate, localStartClock);
  const localEndTime = combineDateTimeLocal(localEndDate, localEndClock);
  const timeInvalid = Boolean(localStartTime && localEndTime && new Date(localStartTime).getTime() > new Date(localEndTime).getTime());
  const canConfirmClaim = !loading && !timesLoading && !!localStartTime && !!localEndTime && !timeInvalid;
  const productPageCount = Math.max(1, Math.ceil(productPagination.total / productPagination.pageSize));
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
  const renderOperation = (item: ClaimableOperation) => <article key={item.id} className={item.status !== "available" ? styles.disabled : undefined}><div><strong>{item.operationName}</strong><span className={styles[`claim-status-${item.status}`]}>{item.status === "available" ? "可领取" : item.status === "claimed" ? "已满" : "已关闭"}</span></div><p>{formatProductPartCode(item.productCode, item.partCode)} · 部件号: {item.partNo || "-"} · 工序号: {item.operationNo || "-"}</p><p>{item.operationNote}</p><dl><div><dt>数量</dt><dd>{item.plannedQuantity} 件</dd></div><div><dt>工时</dt><dd>{item.estimatedHours} 小时</dd></div><div><dt>已领</dt><dd>{item.maxClaimWorkers ? `${item.claimedWorkers}/${item.maxClaimWorkers} 人` : `${item.claimedWorkers} 人`}</dd></div></dl><button className={styles["primary-button"]} disabled={loading || item.status !== "available"} onClick={() => void onClaim(item.id)}>{item.status === "claimed" ? "人数已满" : item.status === "closed" ? "已关闭" : "领取工序"}</button></article>;

  if (claimed) return <section className={styles["claim-success"]}><h2>工序确认</h2><p>{formatProductPartCode(claimed.productCode, claimed.partCode)}</p><p>部件号: {claimed.partNo || "-"} · 工序号: {claimed.operationNo || "-"}</p><strong>{claimed.operationName}</strong><div className={styles["time-input-form"]}><div className={styles["time-input-section"]}><span className={styles["field-label"]}>开工时间</span><div className={styles["time-picker-row"]}><label><span>日期</span><input type="date" value={localStartDate} onChange={(e) => setLocalStartDate(e.target.value)} disabled={timesLoading} className={styles["time-input"]} /></label><label><span>时间</span><input type="time" step={300} value={localStartClock} onChange={(e) => setLocalStartClock(e.target.value)} disabled={timesLoading} className={styles["time-input"]} /></label></div></div><div className={styles["time-input-section"]}><span className={styles["field-label"]}>完工时间</span><div className={styles["time-picker-row"]}><label><span>日期</span><input type="date" value={localEndDate} onChange={(e) => setLocalEndDate(e.target.value)} disabled={timesLoading} className={styles["time-input"]} /></label><label><span>时间</span><input type="time" step={300} value={localEndClock} onChange={(e) => setLocalEndClock(e.target.value)} disabled={timesLoading} className={styles["time-input"]} /></label></div></div></div>{timesLoading && <p className={styles["validation-hint"]}>正在读取开完工时间...</p>}{!timesLoading && (!localStartTime || !localEndTime) && <p className={styles["validation-hint"]}>请填写开工时间和完工时间</p>}{timeInvalid && <p className={styles["validation-hint"]}>开工时间不能晚于完工时间</p>}<div className={styles["claim-actions"]}><button className={styles["ghost-button"]} onClick={onCancelClaim}><X />取消</button><button className={styles["primary-button"]} disabled={!canConfirmClaim} onClick={() => { if (canConfirmClaim) onConfirmClaim(localStartTime, localEndTime); }}><CheckCircle2 />确认领取</button></div></section>;

  return <section className={styles["claim-panel"]}>
    <div className={styles["claim-view-tabs"]} aria-label="领取工序视图切换"><button className={view === "search" ? styles.active : undefined} onClick={() => setView("search")}>搜索领取</button><button className={view === "recent" ? styles.active : undefined} onClick={() => setView("recent")}>查看最近</button></div>
    {loading && <div className={styles["claim-loading"]}><span className="spinner" />正在读取...</div>}
    {view === "search" && <section className={cx(styles["claim-workspace"], styles["claim-search-workspace"])} aria-label="搜索结果">
      <div className={styles["section-heading"]}><div><h2>搜索结果</h2><p>按产品、部件、工序逐级选择。</p></div></div>
      <label className={styles["claim-search"]}><Search /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入产品编号搜索" /><button disabled={loading || !keyword.trim()} onClick={() => void search()}>搜索</button></label>
      <div className={styles["claim-filter"]} aria-label="领取状态筛选">{claimOperationFilterOptions.map(([key, label]) => <button key={key} className={filter === key ? styles.active : undefined} onClick={() => { setFilter(key); setSearchPage(1); }}>{label}</button>)}</div>
      <div className={styles["claim-columns"]}>
        <div><div className={styles["claim-list-title"]}><h3>1 产品编号</h3>{!selectedProduct && productPagination.total > 0 && <span>共 {productPagination.total} 个</span>}</div>{selectedProduct ? <button key={selectedProduct.id} className={styles.selected} onClick={() => { setDismissedAutoProductId(selectedProduct.id); setSelectedProduct(null); setSelectedPart(null); setSearchPage(1); }}><strong>{selectedProduct.productCode}</strong><span>{selectedProduct.productName}</span><small>{selectedProduct.orderNo} · 剩余 {selectedProduct.remainingQuantity} 件</small><span className={styles["cancel-select"]}>点击取消选择</span></button> : products.map((item) => <button key={item.id} onClick={() => { setSelectedProduct(item); setSelectedPart(null); setSearchPage(1); setDismissedAutoPartId(null); void onLoadParts(item.id); }}><strong>{item.productCode}</strong><span>{item.productName}</span><small>{item.orderNo} · 剩余 {item.remainingQuantity} 件</small></button>)}{!selectedProduct && productPagination.total > productPagination.pageSize && <div className={styles["claim-pagination"]} aria-label="产品搜索分页"><button disabled={loading || productPagination.page <= 1} onClick={() => void loadProductPage(Math.max(1, productPagination.page - 1))} aria-label="上一页"><ChevronLeft />上一页</button><span>第 {productPagination.page} / {productPageCount} 页</span><button disabled={loading || !productPagination.hasMore} onClick={() => void loadProductPage(Math.min(productPageCount, productPagination.page + 1))} aria-label="下一页">下一页<ChevronRight /></button></div>}</div>
        <div><h3>2 部件编号</h3>{selectedPart ? <button key={selectedPart.id} className={styles.selected} onClick={() => { setDismissedAutoPartId(selectedPart.id); setSelectedPart(null); setSearchPage(1); }}><strong>{selectedPart.partCode}</strong><span>{selectedPart.partNo && `[${selectedPart.partNo}] `}{selectedPart.partName}</span><small>{selectedPart.operationCount} 道工序 · 剩余 {selectedPart.remainingQuantity} 件</small><span className={styles["cancel-select"]}>点击取消选择</span></button> : parts.map((item) => <button key={item.id} onClick={() => { setSelectedPart(item); setSearchPage(1); void onLoadOperations(item.id); }}><strong>{item.partCode}</strong><span>{item.partNo && `[${item.partNo}] `}{item.partName}</span><small>{item.operationCount} 道工序 · 剩余 {item.remainingQuantity} 件</small></button>)}</div>
      </div>
      <div className={styles["claim-operation-list"]} aria-label="搜索工序结果"><div className={styles["claim-list-title"]}><h3>3 工序</h3>{selectedPart && filteredSearchOperations.length > 0 && <span>共 {filteredSearchOperations.length} 道</span>}</div>{selectedPart ? visibleSearchOperations.map(renderOperation) : <div className={styles["empty-inline"]}>请先搜索并选择部件查看工序。</div>}{selectedPart && !filteredSearchOperations.length && <div className={styles["empty-inline"]}>当前筛选下暂无工序</div>}{selectedPart && filteredSearchOperations.length > claimSearchPageSize && <div className={styles["claim-pagination"]} aria-label="工序搜索分页"><button disabled={loading || searchPage <= 1} onClick={() => setSearchPage((page) => Math.max(1, page - 1))} aria-label="上一页"><ChevronLeft />上一页</button><span>第 {searchPage} / {searchPageCount} 页</span><button disabled={loading || searchPage >= searchPageCount} onClick={() => setSearchPage((page) => Math.min(searchPageCount, page + 1))} aria-label="下一页">下一页<ChevronRight /></button></div>}</div>
    </section>}
    {view === "recent" && <section className={cx(styles["claim-workspace"], styles["claim-recent-workspace"])} aria-label="最近可以领取的工序">
      <div className={styles["section-heading"]}><div><h2>最近可以领取的工序</h2><p>不影响上方搜索结果。</p></div><button className={styles["ghost-button"]} disabled={loading} onClick={() => void loadRecent()}><RefreshCw />刷新</button></div>
      <div className={styles["claim-filter-row"]}><div className={cx(styles["claim-filter"], styles["compact-filter"])} aria-label="最近工序日期筛选">{([["today", "当日"], ["all", "全部"]] as const).map(([key, label]) => <button key={key} className={recentDate === key ? styles.active : undefined} onClick={() => setRecentDate(key)}>{label}</button>)}</div><div className={cx(styles["claim-filter"], styles["compact-filter"])} aria-label="最近工序状态筛选">{claimRecentStatusOptions.map(([key, label]) => <button key={key} className={recentStatus === key ? styles.active : undefined} onClick={() => setRecentStatus(key)}>{label}</button>)}</div></div>
      <div className={styles["recent-operation-list"]}>{filteredRecentOperations.map(renderOperation)}</div>
      {!filteredRecentOperations.length && <div className={styles["empty-inline"]}>暂无最近工序，可点击刷新或搜索产品编号查看。</div>}
    </section>}
  </section>;
}
