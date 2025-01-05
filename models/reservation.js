const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  licensePlate: { type: String, required: true },
  inTime: { type: Date, required: true },
  outTime: { type: Date, required: true },
  vehicleType: { type: String, required: true },
  price: { type: Number, required: true },
  slot: { type: Number, required: true },
  arrived: {type:Boolean, default:false},
  DQR:{type:Boolean, default: false,},
  exit_id:{type: String, required:true},
});

const ReservationModel = mongoose.model('Reservation', reservationSchema);
module.exports = ReservationModel;
