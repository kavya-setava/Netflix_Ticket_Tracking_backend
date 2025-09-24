const express = require('express');
const router = express.Router();
const {updateTicketActivity} = require('../controllers/utilizationController');

router.put("/ticketAction/:ticketId", updateTicketActivity);

module.exports = router;