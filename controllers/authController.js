const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const QM = require("../models/qmSchema");
const CM = require("../models/cmSchema");
// const generateToken = require('../utils/generateToken');
const dotenv = require('dotenv');
dotenv.config();

exports.googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ message: "Missing code from Google" });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.REDIRECT_URI
    );

    // Step 1: Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Step 2: Use access token to get user info
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const { data } = await oauth2.userinfo.get(); // this gives profile info

    const email = data.email;
    const name = data.name;

    // Step 3: Look for user in QM or CM
    let user = await QM.findOne({ emailId: email });
    let role = 0;

    if (!user) {
      user = await CM.findOne({ emailId: email });
      role = 1;
    }

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    // Step 4: Create JWT token
    const token = jwt.sign(
      {
        email: user.emailId,
        name: user.name,
        role,
        ...(user.qmid && { qmid: user.qmid }),
        ...(user.cmid && { cmid: user.cmid })
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Step 5: Redirect to frontend with token (or send JSON)
    res.redirect(`${process.env.CLIENT_URL}/google/callback?token=${token}&role=${role}&name=${encodeURIComponent(user.name)}`);// if frontend exists
    // res.status(200).json({ token, role, name: user.name });

  } catch (err) {
    console.error("Google Callback Error:", err.message);
    res.status(500).json({ message: "Google authentication failed" });
  }
};

exports.googleLogin = (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
  );

  const loginUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account', // ✅ Forces Gmail account chooser
    scope: ['profile', 'email'],
  });

  // ✅ Redirect to properly generated Google login URL
  res.redirect(loginUrl);
};