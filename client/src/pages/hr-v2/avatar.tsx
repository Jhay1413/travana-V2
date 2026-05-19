import type { Employee } from "./_data";

export function Avatar({ employee, size = "md" }: { employee: Employee; size?: "sm" | "md" | "lg" }) {
  const sz =
    size === "lg"
      ? "w-16 h-16 text-lg"
      : size === "sm"
        ? "w-8 h-8 text-xs"
        : "w-10 h-10 text-sm";
  return (
    <div
      className={`${sz} ${employee.avatarColor} rounded-full flex items-center justify-center font-semibold flex-none`}
      data-testid={`avatar-${employee.id}`}
    >
      {employee.initials}
    </div>
  );
}
