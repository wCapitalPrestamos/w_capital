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

// Chips del rediseño: pastilla 22px, fondo suave por tono
export const chipTone = {
  neutral: "bg-line-2 text-ink-2",
  info: "bg-brand-soft text-brand-ink",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  blue: "bg-blue-soft text-blue",
} as const;

export type ChipTone = keyof typeof chipTone;

export function Chip({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap",
        chipTone[tone],
        className,
      )}
      {...props}
    />
  );
}

const applicationTones: Record<ApplicationStatus, ChipTone> = {
  draft: "neutral",
  docs_pending: "warn",
  under_review: "info",
  approved: "ok",
  rejected: "bad",
  disbursed: "blue",
  cancelled: "neutral",
};

const loanTones: Record<LoanStatus, ChipTone> = {
  active: "ok",
  paid_off: "neutral",
  overdue: "bad",
  written_off: "neutral",
};

const installmentTones: Record<InstallmentStatus, ChipTone> = {
  pending: "neutral",
  partial: "warn",
  paid: "ok",
  overdue: "bad",
};

const leadTones: Record<LeadStage, ChipTone> = {
  new: "info",
  contacted: "neutral",
  interested: "warn",
  applying: "ok",
  discarded: "neutral",
};

const reviewTones: Record<ReviewStatus, ChipTone> = {
  pending: "warn",
  approved: "ok",
  rejected: "bad",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Chip tone={applicationTones[status]}>{applicationStatusLabels[status]}</Chip>;
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <Chip tone={loanTones[status]}>{loanStatusLabels[status]}</Chip>;
}

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  return <Chip tone={installmentTones[status]}>{installmentStatusLabels[status]}</Chip>;
}

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return <Chip tone={leadTones[stage]}>{leadStageLabels[stage]}</Chip>;
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Chip tone={reviewTones[status]}>{reviewStatusLabels[status]}</Chip>;
}
