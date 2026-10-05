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
