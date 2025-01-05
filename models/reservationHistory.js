const mongoose = require('mongoose');

const reservationHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  licensePlate: { type: String, required: true },
  inTime: { type: Date, required: true },
  outTime: { type: Date, required: true },
  vehicleType: { type: String, required: true },
  price: { type: Number, required: true },
  slot: { type: Number, required: true },
  //arrived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }, // Track when the record was created
});

const ReservationHistoryModel = mongoose.model('ReservationHistory', reservationHistorySchema);
module.exports = ReservationHistoryModel;
