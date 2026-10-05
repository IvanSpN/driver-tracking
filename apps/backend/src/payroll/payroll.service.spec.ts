import { NotFoundException } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { validate } from 'class-validator';
import { Accrual } from '../database/models/accrual.model';
import { Driver } from '../database/models/driver.model';
import {
  PayChannel,
  Payment,
  PaymentType,
} from '../database/models/payment.model';
import { PayrollService } from './payroll.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpsertAccrualDto } from './dto/upsert-accrual.dto';

describe('PayrollService payment channel', () => {
  const payment = {
    id: 'payment-id',
    driverId: 'driver-id',
    period: '2026-10-01',
    channel: PayChannel.BLACK,
    amountMinor: '10000',
    update: jest.fn(),
  };
  const payments = { create: jest.fn(), findByPk: jest.fn() };
  const drivers = { findByPk: jest.fn() };
  const service = new PayrollService(
    {} as typeof Accrual,
    payments as unknown as typeof Payment,
    drivers as unknown as typeof Driver,
    {} as Sequelize,
  );
  const input: CreatePaymentDto = {
    period: '2026-10',
    type: PaymentType.SALARY,
    amountMinor: 10000,
    paidAt: '2026-10-05',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    drivers.findByPk.mockResolvedValue({ isOfficial: true });
    payments.create.mockResolvedValue(payment);
    payments.findByPk.mockResolvedValue(payment);
  });

  it.each([
    [true, PayChannel.WHITE],
    [false, PayChannel.BLACK],
  ])(
    'uses the driver employment status (%s) for a new payment',
    async (isOfficial, channel) => {
      drivers.findByPk.mockResolvedValue({ isOfficial });
      await service.createPayment('driver-id', input, 'user-id');
      expect(drivers.findByPk).toHaveBeenCalledWith('driver-id', {
        paranoid: false,
      });
      expect(payments.create).toHaveBeenCalledWith(
        expect.objectContaining({ channel }),
      );
    },
  );

  it('keeps explicit channels compatible with existing API clients', async () => {
    await service.createPayment(
      'driver-id',
      { ...input, channel: PayChannel.BLACK },
      'user-id',
    );
    expect(payments.create).toHaveBeenCalledWith(
      expect.objectContaining({ channel: PayChannel.BLACK }),
    );
  });

  it('does not reclassify an existing payment when editing it', async () => {
    const result = await service.updatePayment('payment-id', {
      amountMinor: 20000,
    });
    expect(payment.update).toHaveBeenCalledWith({ amountMinor: 20000 });
    expect(result.channel).toBe(PayChannel.BLACK);
    expect(drivers.findByPk).not.toHaveBeenCalled();
  });

  it('rejects a payment for a missing driver', async () => {
    drivers.findByPk.mockResolvedValue(null);
    await expect(
      service.createPayment('missing', input, 'user-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(payments.create).not.toHaveBeenCalled();
  });

  it('accepts a new payment without a channel', async () => {
    expect(
      await validate(Object.assign(new CreatePaymentDto(), input)),
    ).toEqual([]);
  });
});

describe('PayrollService monthly accrual amount', () => {
  const accrual = {
    id: 'accrual-id',
    driverId: 'driver-id',
    period: '2026-10-01',
    whiteMinor: '60000',
    blackMinor: '40000',
    note: null,
    update: jest.fn(),
  };
  const accruals = { findOne: jest.fn(), create: jest.fn() };
  const drivers = { findByPk: jest.fn() };
  const service = new PayrollService(
    accruals as unknown as typeof Accrual,
    {} as typeof Payment,
    drivers as unknown as typeof Driver,
    {} as Sequelize,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    accrual.whiteMinor = '60000';
    accrual.blackMinor = '40000';
    drivers.findByPk.mockResolvedValue({ isOfficial: true });
    accruals.findOne.mockResolvedValue(null);
    accruals.create.mockImplementation(
      (values: { whiteMinor: number; blackMinor: number }) =>
        Promise.resolve({
          ...accrual,
          whiteMinor: String(values.whiteMinor),
          blackMinor: String(values.blackMinor),
        }),
    );
    accrual.update.mockImplementation(
      (values: { whiteMinor?: number; blackMinor?: number }) => {
        if (values.whiteMinor !== undefined)
          accrual.whiteMinor = String(values.whiteMinor);
        if (values.blackMinor !== undefined)
          accrual.blackMinor = String(values.blackMinor);
        return Promise.resolve(accrual);
      },
    );
  });

  it.each([true, false])(
    'saves one total for either driver status (%s)',
    async (isOfficial) => {
      drivers.findByPk.mockResolvedValue({ isOfficial });
      const result = await service.upsertAccrual(
        'driver-id',
        '2026-10',
        { amountMinor: 123456 },
        'user-id',
      );
      expect(result.amountMinor).toBe(123456);
      expect(result.whiteMinor + result.blackMinor).toBe(123456);
    },
  );

  it('preserves both parts of a historical accrual when its total is unchanged', async () => {
    accruals.findOne.mockResolvedValue(accrual);
    const result = await service.upsertAccrual(
      'driver-id',
      '2026-10',
      { amountMinor: 100000, note: 'Заметка' },
      'user-id',
    );
    expect(result.amountMinor).toBe(100000);
    expect(accrual.update).toHaveBeenCalledWith({
      note: 'Заметка',
      createdById: 'user-id',
    });
    expect(result.whiteMinor).toBe(60000);
    expect(result.blackMinor).toBe(40000);
  });

  it('replaces a historical split with the new total without counting any part twice', async () => {
    accruals.findOne.mockResolvedValue(accrual);
    const result = await service.upsertAccrual(
      'driver-id',
      '2026-10',
      { amountMinor: 75050 },
      'user-id',
    );
    expect(result.amountMinor).toBe(75050);
    expect(result.whiteMinor + result.blackMinor).toBe(75050);
    expect(accruals.create).not.toHaveBeenCalled();
  });

  it.each([0, 123456])(
    'accepts a single non-negative amount: %s',
    async (amountMinor) => {
      expect(
        await validate(Object.assign(new UpsertAccrualDto(), { amountMinor })),
      ).toEqual([]);
    },
  );

  it.each([undefined, -1, 1.5])(
    'rejects a missing, negative or fractional amount: %s',
    async (amountMinor) => {
      const errors = await validate(
        Object.assign(new UpsertAccrualDto(), { amountMinor }),
      );
      expect(errors.some((error) => error.property === 'amountMinor')).toBe(
        true,
      );
    },
  );
});
