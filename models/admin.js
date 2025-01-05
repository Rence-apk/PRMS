const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    middleInitial: { type: String },
    lastName: { type: String, required: true },
    bio: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    tinId: { type: String },
    country: { type: String },
    zipCode: { type: String },
    address: { type: String },
    username: { type: String, required: true, unique: true },
    is_superadmin: { type: Boolean, default: false }
});

const AdminModel = mongoose.model('Admin', adminSchema);
module.exports = AdminModel;
