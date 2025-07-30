const express = require("express");
const router = express.Router();
const getNetflixTickets = require("../controllers/netflixGetAllController.js");



router.post("/postticketsdata", getNetflixTickets.postticketsdata);                   
router.post("/qmdata", getNetflixTickets.qmdata);                   


router.get("/getNetflixTickets", getNetflixTickets.getNetflixTickets);  // using this api
router.put("/updateTicketByKey/:ticketKey", getNetflixTickets.updateTicketByKey);  // using this api
router.get('/dropdown', getNetflixTickets.CMTicketsFilterOptions); // uisng this api


module.exports =  router