'use strict';

const { toHryvnias } = require('../../shared/money');
const { presentBooking, presentQuote } = require('./bookings.presenter');

class BookingsController {
  constructor(bookingsService) {
    this.bookingsService = bookingsService;
  }

  quote = (req, res) => {
    res.json({ data: presentQuote(this.bookingsService.quote(req.validated.body)) });
  };

  create = (req, res) => {
    const booking = this.bookingsService.create(req.validated.body);
    res.status(201).location(`${req.baseUrl}/${booking.id}`).json({
      message: `Бронювання підтверджено. Загальна вартість: ${toHryvnias(booking.totalPrice)} грн`,
      data: presentBooking(booking),
    });
  };

  list = (req, res) => {
    const { limit, offset } = req.validated.query;
    const { items, total } = this.bookingsService.list(req.validated.query);
    res.json({ data: items.map(presentBooking), pagination: { total, limit, offset } });
  };

  getById = (req, res) => {
    res.json({ data: presentBooking(this.bookingsService.getById(req.validated.params.id)) });
  };

  cancel = (req, res) => {
    const booking = this.bookingsService.cancel(req.validated.params.id);
    res.json({ message: 'Бронювання скасовано', data: presentBooking(booking) });
  };
}

module.exports = { BookingsController };
