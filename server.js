const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Booking Schema
const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  service: { type: String, required: true },
  style: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model('Booking', bookingSchema);

// Google Sheets setup
const sheets = google.sheets('v4');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function getGoogleAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });
  return await auth.getClient();
}

async function updateGoogleSheet(data) {
  const auth = await getGoogleAuth();
  const values = [
    [
      new Date().toISOString(),
      data.name,
      data.email,
      data.phone,
      data.service,
      data.style,
      data.date,
      data.time,
      data.message || '',
    ],
  ];
  await sheets.spreadsheets.values.append({
    auth,
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'Sheet1!A:I',
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

// Email setup
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  logger: true,
  debug: true,
});

transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter verification failed:', error);
  } else {
    console.log('Email transporter is ready to send messages');
  }
});

async function sendNotification(data) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: 'New Booking Request',
    html: `
      <h2>New Booking Received</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Phone:</strong> ${data.phone}</p>
      <p><strong>Service:</strong> ${data.service}</p>
      <p><strong>Style:</strong> ${data.style}</p>
      <p><strong>Date:</strong> ${data.date}</p>
      <p><strong>Time:</strong> ${data.time}</p>
      <p><strong>Message:</strong> ${data.message || 'None'}</p>
    `,
  };

  return await transporter.sendMail(mailOptions);
}

// Booking endpoint
app.post('/api/book-appointment', async (req, res) => {
  try {
    const bookingData = req.body;

    // Save to MongoDB
    const booking = new Booking(bookingData);
    const savedBooking = await booking.save();

    // Update Google Sheet
    await updateGoogleSheet(bookingData);

    // Send email notification
    await sendNotification(bookingData);

    res.status(200).json({
      success: true,
      bookingId: savedBooking._id, // Use MongoDB ID instead of random string
    });
  } catch (error) {
    console.error('Error processing booking:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Booking failed', 
      error: error.message 
    });
  }
});

// Test email endpoint
app.get('/api/test-email', async (req, res) => {
  try {
    const testData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
      service: 'saree',
      style: 'Traditional Pleating',
      date: '2025-03-26',
      time: '10:00 AM',
      message: 'Test message',
    };
    await sendNotification(testData);
    res.status(200).json({ success: true, message: 'Test email sent' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, message: 'Test email failed', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});