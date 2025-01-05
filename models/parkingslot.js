const mongoose = require('mongoose');

const parkingSlotSchema = new mongoose.Schema({
  slotNumber: {
    type: Number,
    required: true,
    min: 1
  },
  vehicleType: {
    type: String,
    enum: ['motorcycle', 'car'],
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true 
  }
});

const ParkingSlot = mongoose.model('ParkingSlot', parkingSlotSchema);

module.exports = ParkingSlot;
