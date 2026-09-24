import { useMemo, type ReactNode, type HTMLAttributes } from "react";
import { DataTable, type DataTableColumnDef } from "@jc-times/business-ui/data-table";

export type ReportTableRow = {
  id: string;
  cells: ReactNode[];
  className?: string;
  onClick?: HTMLAttributes<HTMLTableRowElement>["onClick"];
};
export type ReportTableColumn = { title: ReactNode; width?: number };

/** Presentation adapter for existing server-filtered reporting lists. */
export function ReportTable({ columns, rows, emptyTitle = "暂无数据", className }: {
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
  emptyTitle?: ReactNode;
  className?: string;
}) {
  const definitions = useMemo<DataTableColumnDef<ReportTableRow>[]>(() => columns.map((column, index) => ({
    id: `column-${index}`,
    header: typeof column.title === "string" ? column.title : "选择",
    Header: () => column.title,
    Cell: ({ row }) => row.original.cells[index],
    size: column.width,
    minSize: column.width ?? 80,
  })), [columns]);
  return <div className={["work-report-table", className].filter(Boolean).join(" ")}>
    <DataTable options={{
      columns: definitions, data: rows, getRowId: (row) => row.id,
      enableSorting: false, enableColumnActions: false, enableColumnFilters: false,
      enableGlobalFilter: false, enablePagination: false, enableTopToolbar: false,
      enableBottomToolbar: false, enableDensityToggle: false, enableHiding: false,
      enableFullScreenToggle: false, enableStickyHeader: true,
      initialState: { density: "compact" },
      muiTableBodyRowProps: ({ row }) => ({
        className: row.original.className, onClick: row.original.onClick,
        tabIndex: row.original.onClick ? 0 : undefined,
        onKeyDown: row.original.onClick ? (event) => {
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            event.currentTarget.click();
          }
        } : undefined,
      }),
      muiTablePaperProps: { elevation: 0 },
      muiTableHeadCellProps: { sx: { fontFamily: "inherit", fontWeight: 700 } },
      muiTableBodyCellProps: { sx: { fontFamily: "inherit" } },
      muiTableContainerProps: { sx: { maxHeight: "calc(100vh - 320px)", minHeight: 360 } },
      renderEmptyRowsFallback: () => <p style={{ padding: 20, color: "var(--muted)" }}>{emptyTitle}</p>,
    }} />
  </div>;
}
