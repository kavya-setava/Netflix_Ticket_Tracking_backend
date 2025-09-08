const express = require("express");
const router = express.Router();
const taskController  = require("../controllers/ticketsController");

router.post("/createtask", taskController.createTask);
router.get("/TaskDropdown", taskController.getTaskDropdown);
router.put("/update-task", taskController.updateTicketTask);


module.exports = router;