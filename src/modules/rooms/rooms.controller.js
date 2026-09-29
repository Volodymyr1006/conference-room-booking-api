'use strict';

const { formatDisplayDate, formatTime } = require('../../shared/dateTime');
const { presentRoom, presentAvailableRoom } = require('./rooms.presenter');

/**
 * Контролер: приймає вже перевірені дані запиту (req.validated), викликає сервіс
 * і формує HTTP-відповідь. Бізнес-логіки тут немає.
 */
class RoomsController {
  constructor(roomsService) {
    this.roomsService = roomsService;
  }

  list = (req, res) => {
    res.json({ data: this.roomsService.list().map(presentRoom) });
  };

  getById = (req, res) => {
    res.json({ data: presentRoom(this.roomsService.getById(req.validated.params.id)) });
  };

  create = (req, res) => {
    const room = this.roomsService.create(req.validated.body);
    res.status(201).location(`${req.baseUrl}/${room.id}`).json({
      message: 'Зал успішно створено',
      data: presentRoom(room),
    });
  };

  update = (req, res) => {
    const room = this.roomsService.update(req.validated.params.id, req.validated.body);
    res.json({ message: 'Інформацію про зал успішно оновлено', data: presentRoom(room) });
  };

  remove = (req, res) => {
    const { id } = req.validated.params;
    this.roomsService.remove(id);
    res.json({ message: 'Зал успішно видалено', data: { id } });
  };

  addService = (req, res) => {
    const room = this.roomsService.addService(req.validated.params.id, req.validated.body);
    res.status(201).json({ message: 'Послугу успішно додано', data: presentRoom(room) });
  };

  removeService = (req, res) => {
    const { id, serviceId } = req.validated.params;
    const room = this.roomsService.removeService(id, serviceId);
    res.json({ message: 'Послугу успішно видалено', data: presentRoom(room) });
  };

  searchAvailable = (req, res) => {
    const { slot, rooms } = this.roomsService.findAvailable(req.validated.query);
    res.json({
      search: {
        date: formatDisplayDate(slot.date),
        startTime: formatTime(slot.startMinute),
        endTime: formatTime(slot.endMinute),
        capacity: req.validated.query.capacity,
      },
      total: rooms.length,
      data: rooms.map(presentAvailableRoom),
    });
  };
}

module.exports = { RoomsController };
