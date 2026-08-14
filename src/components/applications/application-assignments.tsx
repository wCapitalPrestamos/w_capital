"use client";

import { reassignApplication } from "@/actions/applications";
import { ReassignSelect } from "@/components/reassign-select";
import type { Role } from "@/lib/types";

type AssignableProfile = {
    id: string;
    full_name: string;
};

export function ApplicationAssignments({
    applicationId,
    role,
    advisorId,
    analystId,
    advisorOptions,
    analystOptions,
    profileNames,
}: {
    applicationId: string;
    role: Role;
    advisorId: string | null;
    analystId: string | null;
    advisorOptions: AssignableProfile[];
    analystOptions: AssignableProfile[];
    profileNames: Record<string, string>;
}) {
    return (
        <>
            <AssignmentRow label="Asesora">
                {role === "admin" ? (
                    <ReassignSelect
                        value={advisorId}
                        options={advisorOptions}
                        placeholder="Sin asignar"
                        onAssign={(profileId) =>
                            reassignApplication(applicationId, "advisor_id", profileId)
                        }
                    />
                ) : advisorId ? (
                    profileNames[advisorId] ?? "—"
                ) : (
                    "—"
                )}
            </AssignmentRow>
            <AssignmentRow label="Analista">
                {role === "admin" ? (
                    <ReassignSelect
                        value={analystId}
                        options={analystOptions}
                        placeholder="Sin asignar"
                        onAssign={(profileId) =>
                            reassignApplication(applicationId, "analyst_id", profileId)
                        }
                    />
                ) : analystId ? (
                    profileNames[analystId] ?? "—"
                ) : (
                    "—"
                )}
            </AssignmentRow>
        </>
    );
}

function AssignmentRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <div>{children}</div>
        </div>
    );
}