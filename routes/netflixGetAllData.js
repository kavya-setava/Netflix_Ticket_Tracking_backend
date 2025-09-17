const express = require("express");
const router = express.Router();
const getNetflixTickets = require("../controllers/netflixGetAllController.js");



router.post("/postticketsdata", getNetflixTickets.postticketsdata);                   
router.post("/qmdata", getNetflixTickets.qmdata);                   


router.get("/getNetflixTickets", getNetflixTickets.getNetflixTickets);  // using this api
router.put("/updateTicketByKey/:ticketKey", getNetflixTickets.updateTicketByKey);  // using this api
router.put("/updateTicketByKey_DB/:ticketKey", getNetflixTickets.updateTicketByKey_DB);  // using this api
router.put("/updateTicketByKey_Sheet/:ticketKey", getNetflixTickets.updateTicketByKey_Sheet);  // using this api
router.get('/dropdown', getNetflixTickets.CMTicketsFilterOptions); // uisng this api not using 
router.get('/getCMs', getNetflixTickets.getCMs); // uisng this api
router.put('/update-backup-cm', getNetflixTickets.updateBackupCM);
router.put('/updateBackupCM_Sheet', getNetflixTickets.updateBackupCM_Sheet);
router.put('/updateBackupCM_DB', getNetflixTickets.updateBackupCM_DB);
// router.get("/getTicketSLA",getNetflixTickets.getTicketSLA);




module.exports =  router