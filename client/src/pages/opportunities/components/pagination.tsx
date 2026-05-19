import { useOpportunities } from "./opportunities-context";

export function Pagination({ totalPages }: { totalPages: number }) {
  const { filters, set } = useOpportunities();
  const page = filters.page;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <div
        className="text-[10px] text-black/40 dark:text-white/40 tabular-nums"
        data-testid="text-opportunities-pageinfo"
      >
        Page {page} of {totalPages}
      </div>
      <div className="flex items-center gap-1">
        <PagerBtn
          disabled={page <= 1}
          onClick={() => set("page", 1)}
          testId="button-opportunities-first"
        >
          First
        </PagerBtn>
        <PagerBtn
          disabled={page <= 1}
          onClick={() => set("page", Math.max(1, page - 1))}
          testId="button-opportunities-prev"
        >
          Prev
        </PagerBtn>
        <PagerBtn
          disabled={page >= totalPages}
          onClick={() => set("page", Math.min(totalPages, page + 1))}
          testId="button-opportunities-next"
        >
          Next
        </PagerBtn>
        <PagerBtn
          disabled={page >= totalPages}
          onClick={() => set("page", totalPages)}
          testId="button-opportunities-last"
        >
          Last
        </PagerBtn>
      </div>
    </div>
  );
}

function PagerBtn({
  disabled,
  onClick,
  testId,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg px-2 py-1 text-[10px] font-medium bg-black/5 dark:bg-white/5 disabled:opacity-30 hover:bg-black/10 dark:hover:bg-white/10 transition"
      data-testid={testId}
    >
      {children}
    </button>
  );
}
