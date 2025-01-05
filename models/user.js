const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    block: { type: String },
    lot: { type: String },
    subdivision: { type: String },
    barangay: { type: String },
    municipality: { type: String },
    province: { type: String }
}, { _id: false });

const LicenseSchema = new mongoose.Schema({
    frontImageUrl: { type: String, required: true },
    backImageUrl: { type: String, required: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    dob: { type: Date, required: true },
    name: { type: String, required: true },
    contact: { type: String, required: true },
    profileImageUrl: {type: String, required: true},
    license: LicenseSchema,
    address: addressSchema,
    verified: {  type: Boolean,    default: false,},
    resetPasswordToken: String,
    resetPasswordExpires: Date,
});

module.exports = mongoose.model('UserInfo', userSchema);