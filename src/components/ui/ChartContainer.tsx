import React, { useState } from 'react';
import { Table, BarChart2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './Card';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface TableColumn<T> {
  header: string;
  accessor: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface ChartContainerProps<T> {
  title: string;
  description?: string;
  children: React.ReactNode;
  tableData?: T[];
  tableColumns?: TableColumn<T>[];
  className?: string;
  headerAction?: React.ReactNode;
}

export function ChartContainer<T>({
  title,
  description,
  children,
  tableData = [],
  tableColumns = [],
  className,
  headerAction,
}: ChartContainerProps<T>) {
  const [viewAsTable, setViewAsTable] = useState(false);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          {tableColumns.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewAsTable(!viewAsTable)}
              aria-label={viewAsTable ? 'Switch to graphical chart view' : 'Switch to accessible table view'}
              className="text-xs h-8 gap-1.5"
            >
              {viewAsTable ? (
                <>
                  <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>View Chart</span>
                </>
              ) : (
                <>
                  <Table className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>View as Table</span>
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {viewAsTable && tableColumns.length > 0 ? (
          <div className="overflow-x-auto max-h-[350px] border rounded-lg">
            <table className="w-full text-sm text-left border-collapse">
              <caption className="sr-only">{title} data table</caption>
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 border-b">
                <tr>
                  {tableColumns.map((col, idx) => (
                    <th
                      key={idx}
                      scope="col"
                      className={cn(
                        'px-4 py-2.5 font-semibold',
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length} className="px-4 py-6 text-center text-slate-500">
                      No data available
                    </td>
                  </tr>
                ) : (
                  tableData.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      {tableColumns.map((col, cIdx) => (
                        <td
                          key={cIdx}
                          className={cn(
                            'px-4 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300',
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          )}
                        >
                          {col.accessor(row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full" aria-hidden={viewAsTable ? 'true' : 'false'}>
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
