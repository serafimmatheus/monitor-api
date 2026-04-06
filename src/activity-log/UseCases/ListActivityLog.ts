import { ErrorBadRequest } from "../../errors/ErrorBadRequest.js";
import { ErrorForbidden } from "../../errors/ErrorForbidden.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { formatUserLabel } from "../../lib/createActivityLog.js";

export class ListActivityLog {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    options: {
      patientId?: string;
      page?: number;
      pageSize?: number;
      /** ISO 8601 */
      from?: string;
      /** ISO 8601 */
      to?: string;
    },
  ) {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));

    const links = await this.prisma.patientCaregiver.findMany({
      where: { userId },
      select: { patientId: true },
    });
    const allowed = new Set(links.map((l) => l.patientId));

    if (options.patientId) {
      if (!allowed.has(options.patientId)) {
        throw new ErrorForbidden("Sem acesso a este paciente");
      }
    }

    if (!options.patientId && allowed.size === 0) {
      return {
        items: [] as Array<{
          id: string;
          patientId: string;
          patientName: string;
          actorUserId: string;
          actorLabel: string;
          action: string;
          summary: string;
          createdAt: string;
        }>,
        page,
        pageSize,
        total: 0,
      };
    }

    const baseWhere =
      options.patientId !== undefined
        ? { patientId: options.patientId }
        : { patientId: { in: [...allowed] } };

    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    if (options.from !== undefined && options.from.trim() !== "") {
      const d = new Date(options.from);
      if (Number.isNaN(d.getTime())) {
        throw new ErrorBadRequest("Parâmetro «from» não é uma data válida (ISO 8601).");
      }
      fromDate = d;
    }
    if (options.to !== undefined && options.to.trim() !== "") {
      const d = new Date(options.to);
      if (Number.isNaN(d.getTime())) {
        throw new ErrorBadRequest("Parâmetro «to» não é uma data válida (ISO 8601).");
      }
      toDate = d;
    }
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new ErrorBadRequest(
        "O início do intervalo («from») não pode ser depois do fim («to»).",
      );
    }

    const createdAt: { gte?: Date; lte?: Date } = {};
    if (fromDate) createdAt.gte = fromDate;
    if (toDate) createdAt.lte = toDate;
    const where =
      Object.keys(createdAt).length > 0
        ? { ...baseWhere, createdAt }
        : baseWhere;

    const [total, rows] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          patient: { select: { name: true } },
          actor: { select: { name: true, email: true } },
        },
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        patientName: r.patient.name,
        actorUserId: r.actorUserId,
        actorLabel: formatUserLabel(r.actor),
        action: r.action,
        summary: r.summary,
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  }
}
