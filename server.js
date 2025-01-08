const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const QRCode = require('qrcode');

const AdminModel = require("./models/admin");
const UserInfoModel = require("./models/user");
const ParkingSlotModel = require("./models/parkingslot");
const ReservationModel = require("./models/reservation");
const ReservationHistoryModel = require('./models/reservationHistory');
const { check, validationResult } = require("express-validator");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const url = process.env.MONGO_URI_ADMIN;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose
  .connect(url) 
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });


// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .send({ message: "Internal Server Error", error: err.message });
};

// Register route
app.post('/register', [
  check('email').isEmail(),
  check('password').isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, middleInitial, lastName, bio, email, password, phone, tinId, country, zipCode, address, username } = req.body;

  try {
      const existingAdmin = await AdminModel.findOne({ $or: [{ email }, { username }] });
      if (existingAdmin) return res.status(409).send({ message: 'Admin with this email or username already exists.' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = new AdminModel({
          firstName, middleInitial, lastName, bio, email, password: hashedPassword, phone, tinId, country, zipCode, address, username
      });
      await newAdmin.save();
      res.status(201).send({ message: 'Admin registered successfully' });
  } catch (err) {
      console.error('Error in /register:', err);
      res.status(500).send({ message: 'Internal Server Error', error: err.message });
  }
});

// Login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await AdminModel.findOne({ username });
    if (!admin)
      return res.status(401).send({ message: "Invalid username or password" });

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid)
      return res.status(401).send({ message: "Invalid username or password" });

    res.send({
      message: "Login successful",
      user: {
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        is_superadmin: admin.is_superadmin || false,
      },
    });
  } catch (err) {
    console.error("Error in /login:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Get admin profile route
app.get("/admin", async (req, res) => {
  const { username } = req.query;

  try {
    const admin = await AdminModel.findOne({ username });
    if (!admin) return res.status(404).send({ message: "Admin not found" });

    res.send({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phone: admin.phone,
      address: {
        fullAddress: admin.address,
        postalCode: admin.zipCode,
        tinId: admin.tinId,
      },
      job: admin.job || "N/A",
      location: admin.country || "N/A",
    });
  } catch (err) {
    console.error("Error in /admin:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Get list of admin
app.get("/admin-list", async (req, res) => {
  const { username } = req.query;

  try {
    const loggedInAdmin = await AdminModel.findOne({ username });
    if (!loggedInAdmin || !loggedInAdmin.is_superadmin) {
      return res
        .status(403)
        .send({
          message: "Access denied. Only superadmins can access the admin list.",
        });
    }

    const admins = await AdminModel.find(
      { is_superadmin: false },
      "username email"
    );
    res.send(admins);
  } catch (err) {
    console.error("Error in /admin-list:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Endpoint to delete an admin
app.delete("/delete-admin", async (req, res) => {
  const { username } = req.query;

  if (!username) {
      return res.status(400).json({ message: "Username is required." });
  }

  try {
      const admin = await AdminModel.findOne({ username });

      if (!admin) {
          return res.status(404).json({ message: "Admin not found." });
      }

      // Check if the admin is a superadmin
      if (admin.is_superadmin) {
          return res.status(403).json({ message: "Cannot delete a superadmin." });
      }

      // Delete the admin
      await AdminModel.deleteOne({ username });
      return res.status(200).json({ message: `Admin ${username} deleted successfully.` });
  } catch (error) {
      console.error("Error deleting admin:", error);
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Endpoint to count non-superadmin accounts
app.get("/admin-count", async (req, res) => {
  try {
    const count = await AdminModel.countDocuments({ is_superadmin: false });
    res.send({ count });
  } catch (err) {
    console.error("Error in /admin-count:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Endpoint to edit the admin profile
app.put("/edit-profile", async (req, res) => {
  const {
    username,
    firstName,
    middleInitial,
    lastName,
    bio,
    email,
    phone,
    tinId,
    country,
    zipCode,
    address,
  } = req.body;

  try {
    const updatedAdmin = await AdminModel.findOneAndUpdate(
      { username },
      {
        firstName,
        middleInitial,
        lastName,
        bio,
        email,
        phone,
        tinId,
        country,
        zipCode,
        address,
      },
      { new: true }
    );

    if (!updatedAdmin) {
      return res.status(404).send({ message: "Admin not found" });
    }

    res.send({ message: "Profile updated successfully", updatedAdmin });
  } catch (err) {
    console.error("Error updating profile:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Backend route for getting user list
app.get("/user-list", async (req, res) => {
  const email = req.query.email; 
  try {
      let query = {};
      if (email) {
          query.email = email; 
      } else {
          const filter = req.query.filter;
          if (filter === 'verified') {
              query.verified = true; 
          } else if (filter === 'not-verified') {
              query.verified = false; 
          }
      }

      // Fetch user information based on the query
      const users = await UserInfoModel.find(query, "name email profileImageUrl verified license");
      console.log("Fetched users:", users);

      if (users.length === 0) {
          return res.status(404).send({ message: "No users found" });
      }

      res.status(200).send(users);
  } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).send({ message: "Internal Server Error", error: err.message });
  }
});

//Verify user route
app.put('/verify-user', async (req, res) => {
  const { email } = req.body;
  try {
      const user = await UserInfoModel.findOneAndUpdate(
          { email },
          { verified: true },
          { new: true }
      );

      if (!user) {
          return res.status(404).send({ message: 'User not found' });
      }

      res.status(200).send({ message: 'User verified successfully', user });
  } catch (error) {
      console.error('Error verifying user:', error);
      res.status(500).send({ message: 'Internal Server Error', error: error.message });
  }
});

// Endpoint to count user accounts
app.get("/user-count", async (req, res) => {
  try {
    const count = await UserInfoModel.countDocuments();
    res.status(200).send({ count });
  } catch (err) {
    console.error("Error fetching user count:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Route to add multiple parking slots
app.post("/add-slot", async (req, res) => {
  const { slotNumber, size } = req.body;

  try {
    const lastSlot = await ParkingSlotModel.findOne()
      .sort({ slotNumber: -1 })
      .limit(1);
    let startingSlotNumber = lastSlot ? lastSlot.slotNumber + 1 : 1;
    let parkingSlots = [];

    for (let i = 0; i < slotNumber; i++) {
      let currentSlotNumber = startingSlotNumber + i;
      while (await ParkingSlotModel.exists({ slotNumber: currentSlotNumber })) {
        currentSlotNumber++; 
      }

      parkingSlots.push({
        slotNumber: currentSlotNumber,
        vehicleType: size,
      });
    }

    await ParkingSlotModel.insertMany(parkingSlots);

    res
      .status(201)
      .send({
        message: `${slotNumber} ${size} parking slots added successfully starting from slot ${startingSlotNumber}`,
      });
  } catch (err) {
    console.error("Error adding parking slots:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Route to get all parking slots
app.get("/get-parking-slots", async (req, res) => {
  try {
    const parkingSlots = await ParkingSlotModel.find();
    res.status(200).json(parkingSlots);
  } catch (err) {
    console.error("Error fetching parking slots:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Endpoint to get slot and vehicleType
app.get("/reservations", async (req, res) => {
  try {
    const reservations = await ReservationModel.find({}, "slot vehicleType");
    res.status(200).json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

//Route to save Reservation History
app.get('/reservation/history', async (req, res) => {
  try {
    const allReservations = await ReservationModel.find();
    if (!allReservations || allReservations.length === 0) {
      return res.status(404).json({ message: 'No reservations to save.' });
    }

    const reservationHistoryData = [];

    for (const reservation of allReservations) {
      const exists = await ReservationHistoryModel.findOne({
        userId: reservation.userId,
        licensePlate: reservation.licensePlate,
        inTime: reservation.inTime,
        outTime: reservation.outTime,
        vehicleType: reservation.vehicleType,
        price: reservation.price,
        slot: reservation.slot,
      });
      if (!exists) {
        reservationHistoryData.push({
          userId: reservation.userId,
          licensePlate: reservation.licensePlate,
          inTime: reservation.inTime,
          outTime: reservation.outTime,
          vehicleType: reservation.vehicleType,
          price: reservation.price,
          slot: reservation.slot,
        });
      }
    }

    if (reservationHistoryData.length > 0) {
      await ReservationHistoryModel.insertMany(reservationHistoryData);
    }

    res.status(200).json({
      message: 'All reservations retrieved successfully. New reservations saved to history.',
      allReservations,
    });
  } catch (error) {
    console.error('Error retrieving reservations:', error);
    res.status(500).json({ message: 'Error retrieving reservations.', error: error.message });
  }
});



// Endpoint to count available slots based on vehicleType
app.get("/available-parking-slots-count", async (req, res) => {
  try {
    const parkingSlots = await ParkingSlotModel.find();

    const reservations = await ReservationModel.find();

    const occupiedSlots = new Set(
      reservations.map((reservation) => reservation.slot)
    );

    let availableMotorcycleSlots = 0;
    let availableCarSlots = 0;

    parkingSlots.forEach((slot) => {
      const isOccupied = occupiedSlots.has(slot.slotNumber);
      if (!isOccupied) {
        if (slot.vehicleType === "motorcycle") {
          availableMotorcycleSlots++;
        } else if (slot.vehicleType === "car") {
          availableCarSlots++;
        }
      }
    });

    // Send response with available slots count
    res.status(200).json({
      availableMotorcycleSlots,
      availableCarSlots,
    });
  } catch (err) {
    console.error("Error fetching available parking slots count:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Endpoint to count all available parking slots (motorcycles and cars)
app.get("/available-parking-slots-total", async (req, res) => {
  try {
    const parkingSlots = await ParkingSlotModel.find();

    const reservations = await ReservationModel.find();

    const occupiedSlots = new Set(
      reservations.map((reservation) => reservation.slot)
    );

    let totalAvailableSlots = 0;

    parkingSlots.forEach((slot) => {
      const isOccupied = occupiedSlots.has(slot.slotNumber);
      if (!isOccupied) {
        totalAvailableSlots++;
      }
    });

    res.status(200).json({
      totalAvailableSlots,
    });
  } catch (err) {
    console.error("Error fetching total available parking slots count:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

app.get("/api/data", async (req, res) => {
  try {
    const users = await UserInfoModel.find();
    const reservations = await ReservationModel.find({ arrived: false }); // Fetch only reservations with 'arrived' false

    // Join the data based on email and userId
    const combinedData = users.map((user) => {
      const userReservations = reservations.filter(
        (reservation) => reservation.userId === user.email
      );
      return {
        ...user._doc,
        reservations: userReservations,
      };
    });

    res.status(200).json(combinedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// //API for parked vehicles
// app.get("/api/parked", async (req, res) => {
//   try {
//     const users = await UserInfoModel.find();
//     const reservations = await ReservationModel.find();

//     // Get the current time once to avoid repeated calls
//     const currentTime = new Date();

//     // Filter expired reservations and delete them
//     const validReservations = reservations.filter((reservation) => {
//       if (!reservation.arrived && new Date(reservation.outTime) <= currentTime) {
//         // Mark for deletion (skip expired ones)
//         ReservationModel.deleteOne({ _id: reservation._id });
//         return false; // Filter out the expired reservations
//       }
//       return true; // Keep valid reservations
//     });

//     // Join the data based on email and userId
//     const combinedData = users.map((user) => {
//       const userReservations = validReservations.filter(
//         (reservation) => reservation.userId === user.email
//       );
//       return {
//         ...user._doc,
//         reservations: userReservations,
//       };
//     });

//     res.status(200).json(combinedData);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

app.get("/api/parked", async (req, res) => {
  try {
    const users = await UserInfoModel.find();
    const reservations = await ReservationModel.find();

    // Get the current time once to avoid repeated calls
    const currentTime = new Date();

    // Check for expired reservations and delete them if necessary
    await Promise.all(
      reservations.map(async (reservation) => {
        if (!reservation.arrived && new Date(reservation.outTime) <= currentTime) {
          // Delete the reservation if arrived is false and outTime has passed
          await ReservationModel.deleteOne({ _id: reservation._id });
        }
      })
    );

    // Filter reservations after deletion
    const updatedReservations = await ReservationModel.find();

    // Join the data based on email and userId
    const combinedData = users.map((user) => {
      const userReservations = updatedReservations.filter(
        (reservation) => reservation.userId === user.email
      );
      return {
        ...user._doc, 
        reservations: userReservations, 
      };
    });

    res.status(200).json(combinedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


//Get reservation count
app.get("/api/reservation-count", async (req, res) => {
  try {
    const totalReservations = await ReservationModel.countDocuments({ arrived: false });
    res.json({ totalReservations });
  } catch (error) {
    console.error("Error fetching reservation count:", error);
    res.status(500).send("Internal Server Error");
  }
});


// Endpoint to get data for charts
app.get("/api/charts", async (req, res) => {
  try {
    const reservationCount = await ReservationHistoryModel.aggregate([
      {
        $group: {
          _id: { month: { $month: "$inTime" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.month": 1 } }, 
    ]);

    const totalReservationPrice = await ReservationHistoryModel.aggregate([
      {
        $group: {
          _id: { month: { $month: "$inTime" } },
          totalPrice: { $sum: "$price" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    const chartData = {
      reservationCount,
      totalReservationPrice,
    };

    res.status(200).json(chartData);
  } catch (error) {
    console.error("Error fetching chart data:", error);
    res.status(500).send({ message: "Internal Server Error", error: error.message });
  }
});

//Route for fetching all slot with reservation
app.get("/parking-slots-info", async (req, res) => {
  try {
    const parkingSlots = await ParkingSlotModel.find();

    const reservations = await ReservationModel.find();

    const occupiedSlots = new Map(
      reservations.map((reservation) => [
        reservation.slot,
        { arrived: reservation.arrived, reservationId: reservation._id },
      ])
    );

    const slotsInfo = parkingSlots.map((slot) => {
      const occupiedSlotInfo = occupiedSlots.get(slot.slotNumber);
      const isOccupied = !!occupiedSlotInfo;
      
      return {
        slotNumber: slot.slotNumber,
        status: isOccupied ? "occupied" : "available", 
        vehicleType: slot.vehicleType,

        reservationId: isOccupied ? occupiedSlotInfo.reservationId : undefined,
        arrived: isOccupied ? occupiedSlotInfo.arrived : undefined,
      };
    });

    res.status(200).json(slotsInfo);
  } catch (err) {
    console.error("Error fetching parking slots info:", err);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: err.message });
  }
});

// Endpoint to delete a parking slot by slotNumber
app.delete("/delete-parking-slot", async (req, res) => {
  const { slotNumber } = req.query;

  if (!slotNumber) {
    return res.status(400).json({ message: "Slot number is required." });
  }

  try {
    const slot = await ParkingSlotModel.findOneAndDelete({ slotNumber: Number(slotNumber) });

    if (!slot) {
      return res.status(404).json({ message: "Parking slot not found." });
    }

    res.status(200).json({ message: `Parking slot ${slotNumber} deleted successfully.` });
  } catch (error) {
    console.error("Error deleting parking slot:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


//count occupied slot
app.get("/occupied-slots-count", async (req, res) => {
  try {
    const occupiedSlotsByType = await ReservationModel.aggregate([
      { $match: { arrived: true } },
      {
        $lookup: {
          from: "parkingslots", 
          localField: "slot",
          foreignField: "slotNumber",
          as: "slotInfo"
        }
      },
      { $unwind: "$slotInfo" },
      {
        $group: {
          _id: "$slotInfo.vehicleType",
          count: { $sum: 1 } 
        }
      }
    ]);

    const occupiedSlots = occupiedSlotsByType.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({ occupiedSlots });
  } catch (err) {
    console.error("Error fetching occupied slots count by vehicle type:", err);
    res.status(500).send({ message: "Internal Server Error", error: err.message });
  }
});


// Get All Reservation History Data with User Name
app.get('/api/reservation-history', async (req, res) => {
  try {
    const users = await UserInfoModel.find();
    const reservations = await ReservationHistoryModel.find();

    // Join the data based on email and userId
    const combinedData = users.map((user) => {
      const userReservations = reservations.filter(
        (reservation) => reservation.userId === user.email
      );
      return {
        ...user._doc, 
        reservations: userReservations, 
      };
    });

    res.status(200).json(combinedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// API for Entrance
app.get('/api/validate-id/:id', async (req, res) => {
  const id = req.params.id;

  // Check if ID is provided and valid
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ valid: false, message: 'Invalid ID format' });
  }

  try {
    // Check if the ID exists and has not been used before
    const reservation = await ReservationModel.findOne({ _id: id });

    if (reservation) {
      // Check if the ID has already been marked as arrived
      if (reservation.arrived) {
        return res.status(400).json({
          valid: false,
          message: 'ID has already been used'
        });
      }

      // Mark the reservation as arrived
      reservation.arrived = true;
      await reservation.save();

      return res.status(200).json({
        valid: true,
        message: 'ID is valid and reservation updated successfully',
        reservation
      });
    } else {
      return res.status(404).json({ valid: false, message: 'ID not found' });
    }
  } catch (error) {
    console.error('Error validating ID:', error);
    return res.status(500).json({ valid: false, message: 'Error validating ID', error });
  }
});


// API for validating and deleting reservation by exit_id
app.get('/api/validate-exit-id/:exit_id', async (req, res) => {
  const exit_id = req.params.exit_id;

  // Validate exit_id format (if necessary)
  if (!exit_id) {
    return res.status(400).json({ valid: false, message: 'exit_id is required' });
  }

  try {
    // Check if the exit_id exists
    const exists = await ReservationModel.exists({ exit_id });

    if (exists) {
      // Exit ID exists; deleting reservation
      const deletedReservation = await ReservationModel.findOneAndDelete({ exit_id });

      return res.status(200).json({
        valid: true,
        message: 'exit_id is valid and reservation deleted successfully',
        reservation: deletedReservation
      });
    } else {
      return res.status(404).json({ valid: false, message: 'exit_id not found' });
    }
  } catch (error) {
    console.error('Error validating exit_id:', error);
    return res.status(500).json({ valid: false, message: 'Error validating exit_id', error });
  }
});

// // API for validating and deleting reservation by exit_id
// app.get('/api/validate-exit-id/:exit_id', async (req, res) => {
//   const exit_id = req.params.exit_id;

//   // Validate exit_id format (if necessary)
//   if (!exit_id) {
//     return res.status(400).json({ valid: false, message: 'exit_id is required' });
//   }

//   try {
//     // Check if the exit_id exists
//     const exists = await ReservationModel.exists({ exit_id });

//     if (exists) {
//       // Wait for 10 seconds before deleting the reservation
//       await new Promise(resolve => setTimeout(resolve, 10000)); // 10000 ms = 10 seconds

//       // Exit ID exists; deleting reservation after the delay
//       const deletedReservation = await ReservationModel.findOneAndDelete({ exit_id });

//       return res.status(200).json({
//         valid: true,
//         DQR: true,  // Set DQR to true if the exit_id is valid
//         message: 'exit_id is valid and reservation deleted successfully',
//         reservation: deletedReservation
//       });
//     } else {
//       return res.status(404).json({ valid: false, message: 'exit_id not found' });
//     }
//   } catch (error) {
//     console.error('Error validating exit_id:', error);
//     return res.status(500).json({ valid: false, message: 'Error validating exit_id', error });
//   }
// });



// API to get total revenue
app.get('/api/reservations/total-revenue', async (req, res) => {
  try {
    const totalRevenue = await ReservationHistoryModel.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$price' } } }
    ]);

    if (totalRevenue.length === 0) {
      return res.status(404).json({ message: 'No revenue data found' });
    }

    res.status(200).json({ totalRevenue: totalRevenue[0].totalRevenue });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving total revenue', error: err.message });
  }
});

// Route to get all parking slots with status
app.get('/api/parkingslot', async (req, res) => {
  try {
    // Fetch all parking slots
    const parkingSlots = await ParkingSlotModel.find();

    // Fetch all reservations
    const reservations = await ReservationModel.find();

    // Map to store reservation info (which slot is occupied and by which reservation)
    const occupiedSlots = new Map(
      reservations.map((reservation) => [
        reservation.slot, 
        { arrived: reservation.arrived, reservationId: reservation._id },
      ])
    );

    // Construct the slots information
    const slotsInfo = parkingSlots.map((slot) => {
      const occupiedSlotInfo = occupiedSlots.get(slot.slotNumber);
      const isOccupied = !!occupiedSlotInfo;

      return {
        slotNumber: slot.slotNumber,
        status: isOccupied ? "occupied" : "available", // Determine if slot is occupied or available
        vehicleType: slot.vehicleType,
        reservationId: isOccupied ? occupiedSlotInfo.reservationId : undefined,
        arrived: isOccupied ? occupiedSlotInfo.arrived : undefined,
      };
    });

    // Send the response with the slots and status
    res.status(200).json(slotsInfo);
  } catch (err) {
    console.error('Error fetching parking slots:', err);
    res.status(500).send({
      message: 'Internal Server Error',
      error: err.message,
    });
  }
});

//API for statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const now = new Date();

    // Define the start of the day, week, month, and year
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - now.getDay()); // Adjust the start of the week to Sunday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Aggregate statistics for different time periods
    const statistics = await ReservationHistoryModel.aggregate([
      {
        $facet: {
          // Daily statistics
          daily: [
            { $match: { createdAt: { $gte: startOfDay } } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$price" } } }
          ],
          // Weekly statistics
          weekly: [
            { $match: { createdAt: { $gte: startOfWeek } } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$price" } } }
          ],
          // Monthly statistics
          monthly: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$price" } } }
          ],
          // Yearly statistics
          yearly: [
            { $match: { createdAt: { $gte: startOfYear } } },
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$price" } } }
          ],
          // Total statistics (all time)
          total: [
            { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$price" } } }
          ]
        }
      }
    ]);

    // Return the statistics response
    res.status(200).json(statistics[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

// API for Statistics Charts
app.get('/api/statistics-chart', async (req, res) => {
  try {
    const { vehicleType } = req.query;

    // If vehicleType is provided, filter by it, otherwise group all vehicles
    let matchStage = {};
    if (vehicleType) {
      matchStage = { vehicleType }; // Filter by vehicleType if specified
    }

    const reservations = await ReservationHistoryModel.aggregate([
      { $match: matchStage }, // Match based on the optional vehicleType
      { $project: { 
          vehicleType: 1, 
          price: 1, 
          createdAt: 1 
        }
      },
      { $group: {
          _id: "$vehicleType", // Group by vehicleType
          totalPrice: { $sum: "$price" }, // Sum of prices for the group
          reservations: { $push: { vehicleType: "$vehicleType", price: "$price", createdAt: "$createdAt" } } // Push selected fields into reservations array
        }
      }
    ]);

    res.status(200).json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching reservations' });
  }
});



// Centralized error handling middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
