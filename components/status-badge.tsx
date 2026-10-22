import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type LeaveStatus } from "@/lib/format";

const STATUS_CLASS: Record<LeaveStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  cancelled: "bg-muted text-muted-foreground",
  registered: "bg-sky-100 text-sky-900",
};

export function StatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge className={cn("border-transparent", STATUS_CLASS[status])}>{STATUS_LABEL[status]}</Badge>;
}
