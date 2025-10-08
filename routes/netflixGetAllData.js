const express = require("express");
const router = express.Router();
const getNetflixTickets = require("../controllers/netflixGetAllController.js");

// Define all routes
router.post("/postticketsdata", getNetflixTickets.postticketsdata);
router.post("/qmdata", getNetflixTickets.qmdata);

router.get("/getNetflixTickets", getNetflixTickets.getNetflixTickets);
router.put("/updateTicketByKey_DB/:ticketKey", getNetflixTickets.updateTicketByKey_DB);
router.put("/updateTicketByKey_Sheet/:ticketKey", getNetflixTickets.updateTicketByKey_Sheet);
router.get('/dropdown', getNetflixTickets.CMTicketsFilterOptions);
router.get('/getCMs', getNetflixTickets.getCMs);
router.put('/updateBackupCM_Sheet', getNetflixTickets.updateBackupCM_Sheet);
router.put('/updateBackupCM_DB', getNetflixTickets.updateBackupCM_DB);
router.get("/dropdown-tickets", getNetflixTickets.getDropdownTickets);

// Export router correctly
module.exports = router; // ✅ Important: export the router directly
