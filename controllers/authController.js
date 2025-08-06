const fs = require("fs");
const path = require("path");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const UserData = require("../models/UserSchema");
require("dotenv").config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT_URI = process.env.REDIRECT_URI ;
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";

// ⬇️ STEP 1: Get Google Auth URL
const googleLogin = (req, res) => {
     const authUrl = `${GOOGLE_AUTH_URL}?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent`;
    console.log("🔗 Redirecting to Google Auth URL:", authUrl);
    res.json({ message: "Copy this URL and open in browser", authUrl });
};

// ⬇️ STEP 2: Handle Callback and Redirect to Frontend
    const googleCallback = async (req, res) => {
                try {
                    const { code, app } = req.query; // 'app' param determines frontend (e.g., 'angular' or 'react')

                    if (!code) {
                        return res.status(400).json({ message: "❌ No authorization code provided" });
                    }

                    console.log("🔹 Received Google OAuth Code:", code);

                    const params = new URLSearchParams();
                    params.append("code", code);
                    params.append("client_id", process.env.GOOGLE_CLIENT_ID);
                    params.append("client_secret", process.env.GOOGLE_CLIENT_SECRET);
                    params.append("redirect_uri", process.env.REDIRECT_URI);
                    params.append("grant_type", "authorization_code");

                    const tokenResponse = await axios.post(GOOGLE_TOKEN_URL, params, {
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    });

                    const { access_token, id_token } = tokenResponse.data;

                    console.log("✅ Google Tokens:", tokenResponse.data);

                
                    res.redirect(`http://localhost:5173/login?access_token=${access_token}&id_token=${id_token}`);
                } catch (error) {
                    console.error("❌ Google Token Exchange Error:", error.response?.data || error.message);
                    res.status(500).json({ message: "❌ Failed to get Google tokens" });
                }
            };


// ⬇️ STEP 3: Use ID Token to login user via backend
const googleSignIn = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) return res.status(400).json({ message: "❌ Token is required" });

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { email, name, sub: googleId } = ticket.getPayload();

        // Check if user exists in DB
        let user = await UserData.findOne({ emailId: email });

        if (!user) {
            return res.status(403).json({ message: "❌ Unauthorized: User not registered" });
        }

        // Generate auth token
        const authToken = jwt.sign(
            {
                userId: user.userId,
                email: user.emailId,
                name: user.name,
                role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1y" }
        );

        // Respond with user and token
        res.json({
            success: true,
            message: "✅ Login successful",
            token: authToken,
            user: {
                name: user.name,
                email: user.emailId,
                role: user.role,
                userId: user.userId,
            },
        });
    } catch (error) {
        console.error("❌ Google Sign-In Error:", error.message);
        res.status(500).json({ message: "❌ Login failed. Internal Server Error" });
    }
};

module.exports = { googleLogin, googleCallback, googleSignIn };