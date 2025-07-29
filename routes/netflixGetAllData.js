const express = require("express");
const router = express.Router();
const getNetflixTickets = require("../controllers/netflixGetAllController.js");



router.post("/postticketsdata", getNetflixTickets.postticketsdata);                   
router.post("/qmdata", getNetflixTickets.qmdata);                   


router.get("/getNetflixTickets", getNetflixTickets.getNetflixTickets);  
router.put("/updateTicketByKey/:ticketKey", getNetflixTickets.updateTicketByKey);  
router.get('/dropdown', getNetflixTickets.CMTicketsFilterOptions);


module.exports =  router