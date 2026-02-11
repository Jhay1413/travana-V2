import * as React from "react";
import { format, parse, parseISO, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;

  const tryYmd = parse(value, "yyyy-MM-dd", new Date());
  if (isValid(tryYmd)) return tryYmd;

  const tryIso = parseISO(value);
  if (isValid(tryIso)) return tryIso;

  const tryDmy = parse(value, "dd/MM/yyyy", new Date());
  if (isValid(tryDmy)) return tryDmy;

  const native = new Date(value);
  if (isValid(native)) return native;

  return undefined;
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  "data-testid": testId,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => parseDate(value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-testid={testId}
          className={cn(
            "h-10 w-full justify-start rounded-xl border-black/10 bg-white/70 px-3 text-left text-sm font-normal hover:bg-white/80",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span className="opacity-50">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[9999] w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          defaultMonth={selectedDate}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
