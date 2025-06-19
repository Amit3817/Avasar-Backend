const express = require('express');
const Contact = require('../models/Contact');
const { 
  createContact
} = require('../controllers/contactController');

const router = express.Router();

// Submit contact form
router.post('/', createContact);

// Get contact by ID (for user panel)
router.get('/:id', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 