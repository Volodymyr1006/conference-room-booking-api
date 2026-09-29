'use strict';

const {
  presentPeriod,
  presentSummary,
  presentRoomPerformance,
  presentServicePopularity,
  presentTariff,
  presentHour,
} = require('./reports.presenter');

class ReportsController {
  constructor(reportsService) {
    this.reportsService = reportsService;
  }

  summary = (req, res) => {
    const period = req.validated.query;
    res.json({ period: presentPeriod(period), data: presentSummary(this.reportsService.getSummary(period)) });
  };

  rooms = (req, res) => {
    const period = req.validated.query;
    res.json({
      period: presentPeriod(period),
      data: this.reportsService.getRoomsPerformance(period).map(presentRoomPerformance),
    });
  };

  services = (req, res) => {
    const period = req.validated.query;
    res.json({
      period: presentPeriod(period),
      data: this.reportsService.getServicesPopularity(period).map(presentServicePopularity),
    });
  };

  tariffs = (req, res) => {
    const period = req.validated.query;
    res.json({
      period: presentPeriod(period),
      data: this.reportsService.getTariffsBreakdown(period).map(presentTariff),
    });
  };

  hourlyDemand = (req, res) => {
    const period = req.validated.query;
    res.json({
      period: presentPeriod(period),
      data: this.reportsService.getHourlyDemand(period).map(presentHour),
    });
  };
}

module.exports = { ReportsController };
