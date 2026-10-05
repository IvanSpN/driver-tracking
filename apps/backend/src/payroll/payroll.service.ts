import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/sequelize';
import { Op, QueryTypes, Sequelize } from 'sequelize';
import { Accrual } from '../database/models/accrual.model';
import { PayChannel, Payment } from '../database/models/payment.model';
import { UpsertAccrualDto } from './dto/upsert-accrual.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { parsePeriod, formatPeriod } from '../common/period';
import { toNumber } from '../common/money';

interface PeriodRow {
  period: string;
  accruedWhiteMinor: number;
  accruedBlackMinor: number;
  paidWhiteMinor: number;
  paidBlackMinor: number;
  payments: ReturnType<PayrollService['toPaymentJson']>[];
}

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(Accrual) private readonly accrualModel: typeof Accrual,
    @InjectModel(Payment) private readonly paymentModel: typeof Payment,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  async upsertAccrual(
    driverId: string,
    period: string,
    dto: UpsertAccrualDto,
    createdById: string,
  ) {
    const periodDate = parsePeriod(period);
    const existing = await this.accrualModel.findOne({
      where: { driverId, period: periodDate },
    });

    if (existing) {
      await existing.update({ ...dto, createdById });
      return this.toAccrualJson(existing);
    }

    const created = await this.accrualModel.create({
      driverId,
      period: periodDate,
      ...dto,
      createdById,
    });
    return this.toAccrualJson(created);
  }

  async deleteAccrual(driverId: string, period: string) {
    const periodDate = parsePeriod(period);
    const accrual = await this.accrualModel.findOne({
      where: { driverId, period: periodDate },
    });
    if (!accrual) throw new NotFoundException('Начисление не найдено');
    await accrual.destroy();
  }

  async listPayroll(driverId: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { driverId };
    if (from || to) {
      where.period = {
        ...(from ? { [Op.gte]: parsePeriod(from) } : {}),
        ...(to ? { [Op.lte]: parsePeriod(to) } : {}),
      };
    }

    const [accruals, payments] = await Promise.all([
      this.accrualModel.findAll({ where, order: [['period', 'DESC']] }),
      this.paymentModel.findAll({ where, order: [['paidAt', 'DESC']] }),
    ]);

    const periods = new Map<string, PeriodRow>();
    const ensure = (periodDate: string): PeriodRow => {
      const key = formatPeriod(periodDate);
      let row = periods.get(key);
      if (!row) {
        row = {
          period: key,
          accruedWhiteMinor: 0,
          accruedBlackMinor: 0,
          paidWhiteMinor: 0,
          paidBlackMinor: 0,
          payments: [],
        };
        periods.set(key, row);
      }
      return row;
    };

    for (const a of accruals) {
      const row = ensure(a.period);
      row.accruedWhiteMinor = toNumber(a.whiteMinor);
      row.accruedBlackMinor = toNumber(a.blackMinor);
    }

    for (const p of payments) {
      const row = ensure(p.period);
      const amount = toNumber(p.amountMinor);
      if (p.channel === PayChannel.WHITE) row.paidWhiteMinor += amount;
      else row.paidBlackMinor += amount;
      row.payments.push(this.toPaymentJson(p));
    }

    return [...periods.values()]
      .sort((a, b) => (a.period < b.period ? 1 : -1))
      .map((row) => ({
        ...row,
        dueWhiteMinor: row.accruedWhiteMinor - row.paidWhiteMinor,
        dueBlackMinor: row.accruedBlackMinor - row.paidBlackMinor,
      }));
  }

  async listPayments(driverId: string, period?: string) {
    const where: Record<string, unknown> = { driverId };
    if (period) where.period = parsePeriod(period);

    const rows = await this.paymentModel.findAll({
      where,
      order: [['paidAt', 'DESC']],
    });
    return rows.map((p) => this.toPaymentJson(p));
  }

  async createPayment(
    driverId: string,
    dto: CreatePaymentDto,
    createdById: string,
  ) {
    const payment = await this.paymentModel.create({
      driverId,
      period: parsePeriod(dto.period),
      channel: dto.channel,
      type: dto.type,
      amountMinor: dto.amountMinor,
      paidAt: dto.paidAt,
      method: dto.method,
      note: dto.note,
      createdById,
    });
    return this.toPaymentJson(payment);
  }

  async updatePayment(id: string, dto: UpdatePaymentDto) {
    const payment = await this.findPaymentOrFail(id);
    const { period, ...rest } = dto;
    await payment.update({
      ...rest,
      ...(period ? { period: parsePeriod(period) } : {}),
    });
    return this.toPaymentJson(payment);
  }

  async deletePayment(id: string) {
    const payment = await this.findPaymentOrFail(id);
    await payment.destroy();
  }

  async getTotalDueByDriver(driverIds: string[]): Promise<Map<string, number>> {
    if (driverIds.length === 0) return new Map();

    const rows = await this.sequelize.query<{
      driver_id: string;
      total_due_minor: string;
    }>(
      `
      SELECT d.id AS driver_id,
             COALESCE(a.total_white, 0) + COALESCE(a.total_black, 0)
               - COALESCE(p.total_white, 0) - COALESCE(p.total_black, 0) AS total_due_minor
      FROM drivers d
      LEFT JOIN (
        SELECT driver_id, SUM(white_minor) AS total_white, SUM(black_minor) AS total_black
        FROM accruals GROUP BY driver_id
      ) a ON a.driver_id = d.id
      LEFT JOIN (
        SELECT driver_id,
               SUM(amount_minor) FILTER (WHERE channel = 'WHITE') AS total_white,
               SUM(amount_minor) FILTER (WHERE channel = 'BLACK') AS total_black
        FROM payments GROUP BY driver_id
      ) p ON p.driver_id = d.id
      WHERE d.id IN (:driverIds)
      `,
      { replacements: { driverIds }, type: QueryTypes.SELECT },
    );

    return new Map(rows.map((r) => [r.driver_id, toNumber(r.total_due_minor)]));
  }

  private async findPaymentOrFail(id: string) {
    const payment = await this.paymentModel.findByPk(id);
    if (!payment) throw new NotFoundException('Выплата не найдена');
    return payment;
  }

  private toAccrualJson(a: Accrual) {
    return {
      id: a.id,
      driverId: a.driverId,
      period: formatPeriod(a.period),
      whiteMinor: toNumber(a.whiteMinor),
      blackMinor: toNumber(a.blackMinor),
      note: a.note,
    };
  }

  private toPaymentJson(p: Payment) {
    return {
      id: p.id,
      driverId: p.driverId,
      period: formatPeriod(p.period),
      channel: p.channel,
      type: p.type,
      amountMinor: toNumber(p.amountMinor),
      paidAt: p.paidAt,
      method: p.method,
      note: p.note,
    };
  }
}
