import { Badge } from "@/components/ui/badge";
import {
  applicationStatusLabels,
  installmentStatusLabels,
  leadStageLabels,
  loanStatusLabels,
  reviewStatusLabels,
} from "@/lib/labels";
import type {
  ApplicationStatus,
  InstallmentStatus,
  LeadStage,
  LoanStatus,
  ReviewStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const tone = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-accent text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
} as const;

type Tone = keyof typeof tone;

const applicationTones: Record<ApplicationStatus, Tone> = {
  draft: "neutral",
  docs_pending: "warning",
  under_review: "info",
  approved: "success",
  rejected: "danger",
  disbursed: "success",
  cancelled: "neutral",
};

const loanTones: Record<LoanStatus, Tone> = {
  active: "info",
  paid_off: "success",
  overdue: "danger",
  written_off: "neutral",
};

const installmentTones: Record<InstallmentStatus, Tone> = {
  pending: "neutral",
  partial: "warning",
  paid: "success",
  overdue: "danger",
};

const leadTones: Record<LeadStage, Tone> = {
  new: "info",
  contacted: "neutral",
  interested: "warning",
  applying: "success",
  discarded: "neutral",
};

const reviewTones: Record<ReviewStatus, Tone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function StatusBadge({ label, toneKey }: { label: string; toneKey: Tone }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent", tone[toneKey])}>
      {label}
    </Badge>
  );
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <StatusBadge label={applicationStatusLabels[status]} toneKey={applicationTones[status]} />
  );
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <StatusBadge label={loanStatusLabels[status]} toneKey={loanTones[status]} />;
}

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  return (
    <StatusBadge label={installmentStatusLabels[status]} toneKey={installmentTones[status]} />
  );
}

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return <StatusBadge label={leadStageLabels[stage]} toneKey={leadTones[stage]} />;
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <StatusBadge label={reviewStatusLabels[status]} toneKey={reviewTones[status]} />;
}
