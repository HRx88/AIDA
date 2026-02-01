const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// Create a new task
router.post('/', taskController.createTask);

// Bulk create tasks
router.post('/bulk', taskController.bulkCreateTasks);

// Get all tasks for a schedule
router.get('/schedule/:scheduleId', taskController.getTasksBySchedule);

// Get tasks for a user on a specific date
router.get('/day/:userId/:date', taskController.getTasksByUserAndDate);

// Get tasks for a user in a specific month
router.get('/month/:userId/:year/:month', taskController.getTasksByMonth);

// Get routine tasks for a user
router.get('/routines/:userId', taskController.getRoutineTasks);

// Get task by ID
router.get('/:id', taskController.getTaskById);

// Update a task
router.put('/:id', taskController.updateTask);

// Reorder a task
router.put('/:id/reorder', taskController.reorderTask);

// Delete a task
router.delete('/:id', taskController.deleteTask);

module.exports = router;
