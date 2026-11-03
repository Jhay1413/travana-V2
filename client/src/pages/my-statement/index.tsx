import { useState } from "react";
import { MonthPicker, StatementBody, currentMonth, monthPeriod, useMyHomeworkerStatement, type MonthRef } from "@/features/homeworkers";

export default function MyStatementPage() {
  const [month, setMonth] = useState<MonthRef>(() => currentMonth());
  const { from, to } = monthPeriod(month);
  const statement = useMyHomeworkerStatement(from, to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold xl:text-xl">My statement</h1>
          <p className="text-xs text-muted-foreground xl:text-sm">Your profit share for the selected month (read-only).</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <StatementBody result={statement.data} isLoading={statement.isLoading} isError={statement.isError} />
    </div>
  );
}
