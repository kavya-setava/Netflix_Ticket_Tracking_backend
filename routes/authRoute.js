const express = require("express");
const { googleSignIn, googleLogin, googleCallback } = require("../controllers/authController");

const router = express.Router();

router.get("/login", googleLogin); // NOT /undefined/login!

router.post("/signin", googleSignIn); // Usually POST /api/google

module.exports = router;
