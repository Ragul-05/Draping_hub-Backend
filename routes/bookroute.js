const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

router.post('/book-appointment', async (req, res) => {
  try {
    const bookingData = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      service: req.body.service,
      style: req.body.style,
      date: req.body.date,
      time: req.body.time,
      message: req.body.message || ''
    };

    const booking = new Booking(bookingData);
    await booking.save();

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating booking',
      error: error.message
    });
  }
});

module.exports = router;